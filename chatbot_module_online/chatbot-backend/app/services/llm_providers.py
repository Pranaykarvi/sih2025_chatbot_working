"""
LLM providers: Gemini (google-genai) primary, Groq fallback.
Dynamic model fallbacks, circuit breaker, latency logs, context-aware final fallback.
All blocking SDK calls run in asyncio.to_thread.
"""

from __future__ import annotations

import asyncio
import logging
import os
import threading
import time
from typing import Awaitable, Callable, List

from dotenv import load_dotenv

load_dotenv()

logger = logging.getLogger(__name__)

_GEMINI_DEFAULT_MODELS: tuple[str, ...] = (
    "gemini-2.0-flash",
    "gemini-1.5-flash",
)

_GROQ_DEFAULT_MODELS: tuple[str, ...] = (
    "llama-3.1-8b-instant",
    "llama-3.1-70b-versatile",
)

GEMINI_TIMEOUT_S = 60.0
GROQ_TIMEOUT_S = 60.0

# Minimum non-whitespace characters for an LLM reply to count as successful.
MIN_RESPONSE_CHARS = 10

# Soft circuit breaker: skip provider after this many consecutive logical failures.
CIRCUIT_THRESHOLD = 3

GROQ_SYSTEM_MESSAGE = "You are a helpful medical assistant."

FALLBACK_ANSWER = (
    "AI service is temporarily unavailable. Please try again later."
)

CONTEXT_SNIPPET_MAX_CHARS = 500

# Prefix for answers when LLMs fail but retrieval context exists (for metrics / logging).
CONTEXT_FALLBACK_PREFIX = (
    "Based on the retrieved documents (summary only; AI generation was unavailable):"
)


def is_context_fallback_answer(text: str) -> bool:
    return bool(text and text.strip().startswith(CONTEXT_FALLBACK_PREFIX))

# --- Lightweight circuit breaker (process-local; resets on redeploy) ---
_circuit_lock = threading.Lock()
_FAILED_COUNTS: dict[str, int] = {}


def should_skip(provider: str) -> bool:
    with _circuit_lock:
        return _FAILED_COUNTS.get(provider, 0) >= CIRCUIT_THRESHOLD


def mark_failure(provider: str) -> None:
    with _circuit_lock:
        n = _FAILED_COUNTS.get(provider, 0) + 1
        _FAILED_COUNTS[provider] = n
        logger.warning(
            "circuit provider=%s failure_streak=%d threshold=%d",
            provider,
            n,
            CIRCUIT_THRESHOLD,
        )


def reset_failure(provider: str) -> None:
    with _circuit_lock:
        if provider in _FAILED_COUNTS and _FAILED_COUNTS[provider] > 0:
            logger.info("circuit provider=%s reset after success", provider)
        _FAILED_COUNTS[provider] = 0


def _env_api_key(name: str) -> str | None:
    raw = os.getenv(name)
    if raw is None:
        return None
    v = raw.strip().strip('"').strip("'")
    return v or None


GEMINI_API_KEY = _env_api_key("GEMINI_API_KEY")
GROQ_API_KEY = _env_api_key("GROQ_API_KEY")

logger.info("Gemini API key configured: %s", bool(GEMINI_API_KEY))
logger.info("Groq API key configured: %s", bool(GROQ_API_KEY))


def is_valid_response(text: str | None, *, min_len: int = MIN_RESPONSE_CHARS) -> bool:
    """Reject empty, whitespace-only, or trivially short model outputs."""
    if text is None:
        return False
    s = text.strip()
    return len(s) >= min_len


def final_fallback(
    prompt: str,
    context: str | None = None,
    *,
    max_context_chars: int = CONTEXT_SNIPPET_MAX_CHARS,
) -> str:
    """
    Last resort when LLMs are unavailable: surface a trimmed slice of retrieved docs if present.
    Never raises.
    """
    _ = prompt  # reserved for future templating / analytics
    try:
        if context and str(context).strip():
            snippet = str(context).strip().replace("\r\n", "\n")
            if len(snippet) > max_context_chars:
                snippet = snippet[:max_context_chars].rstrip() + "…"
            return (
                f"{CONTEXT_FALLBACK_PREFIX}\n\n"
                f"{snippet}\n\n"
                "Please verify with a qualified clinician. You can try again shortly for a full AI-assisted answer."
            )
    except Exception as e:
        logger.exception("final_fallback context formatting failed: %s", e)
    return FALLBACK_ANSWER


def _dedupe_model_ids(*candidates: str | None) -> list[str]:
    out: list[str] = []
    for c in candidates:
        if not c:
            continue
        m = c.strip()
        if m and m not in out:
            out.append(m)
    return out


def _gemini_models_to_try() -> list[str]:
    env_model = (os.getenv("GEMINI_MODEL") or "").strip()
    return _dedupe_model_ids(env_model, *_GEMINI_DEFAULT_MODELS)


def _groq_models_to_try() -> list[str]:
    env_model = (os.getenv("GROQ_MODEL") or "").strip()
    return _dedupe_model_ids(env_model, *_GROQ_DEFAULT_MODELS)


def _extract_gemini_text(response: object) -> str:
    text: str | None = None
    try:
        t = response.text  # type: ignore[attr-defined]
        if t is not None:
            text = t if isinstance(t, str) else str(t)
    except Exception as e:
        logger.warning("Gemini response.text unavailable: %s", e)

    if not (text or "").strip():
        try:
            cands = getattr(response, "candidates", None) or []
            if cands:
                content = getattr(cands[0], "content", None)
                parts = getattr(content, "parts", None) if content else None
                if parts and len(parts) > 0:
                    seg = parts[0]
                    raw = getattr(seg, "text", None)
                    if raw is None and seg is not None:
                        raw = str(seg)
                    if raw:
                        text = raw if isinstance(raw, str) else str(raw)
        except Exception as e:
            logger.warning("Gemini fallback extraction from candidates failed: %s", e)

    if not text:
        return ""
    return text.strip()


def _normalize_groq_message_content(content: object) -> str:
    if content is None:
        return ""
    if isinstance(content, str):
        return content.strip()
    if isinstance(content, list):
        parts: list[str] = []
        for item in content:
            if isinstance(item, str):
                parts.append(item)
            elif isinstance(item, dict) and "text" in item:
                parts.append(str(item["text"]))
            else:
                parts.append(str(item))
        return "".join(parts).strip()
    return str(content).strip()


def _call_gemini_sync(prompt: str) -> str:
    from google import genai

    if not GEMINI_API_KEY:
        raise ValueError("GEMINI_API_KEY is missing or empty")

    models = _gemini_models_to_try()
    if not models:
        raise RuntimeError("No Gemini model ids configured")

    client = genai.Client(api_key=GEMINI_API_KEY)
    last_error: Exception | None = None

    for i, model_id in enumerate(models):
        is_last = i == len(models) - 1
        t_model = time.perf_counter()
        try:
            logger.info(
                "Gemini attempt provider=gemini model=%s (%d/%d)",
                model_id,
                i + 1,
                len(models),
            )
            response = client.models.generate_content(
                model=model_id,
                contents=prompt,
            )
            text = _extract_gemini_text(response)
            if not text:
                raise RuntimeError("Empty Gemini response after parse")

            logger.info(
                "LLM success provider=gemini model=%s latency_s=%.3f out_chars=%d",
                model_id,
                time.perf_counter() - t_model,
                len(text),
            )
            return text
        except Exception as e:
            last_error = e
            logger.warning(
                "Gemini failed provider=gemini model=%s latency_s=%.3f error=%s: %s",
                model_id,
                time.perf_counter() - t_model,
                type(e).__name__,
                e,
                exc_info=is_last,
            )

    assert last_error is not None
    logger.error("Gemini: all models failed tried=%s", models)
    raise RuntimeError(f"All Gemini models failed: {last_error}") from last_error


def _call_groq_sync(prompt: str) -> str:
    from groq import Groq

    if not GROQ_API_KEY:
        raise ValueError("GROQ_API_KEY is missing or empty")

    models = _groq_models_to_try()
    if not models:
        raise RuntimeError("No Groq model ids configured")

    client = Groq(api_key=GROQ_API_KEY, timeout=GROQ_TIMEOUT_S)
    last_error: Exception | None = None

    for i, model_id in enumerate(models):
        is_last = i == len(models) - 1
        t_model = time.perf_counter()
        try:
            logger.info(
                "Groq attempt provider=groq model=%s (%d/%d)",
                model_id,
                i + 1,
                len(models),
            )
            completion = client.chat.completions.create(
                model=model_id,
                messages=[
                    {"role": "system", "content": GROQ_SYSTEM_MESSAGE},
                    {"role": "user", "content": prompt},
                ],
                max_tokens=2048,
                temperature=0.3,
            )

            choices = getattr(completion, "choices", None) or []
            if not choices:
                raise RuntimeError("Groq returned no choices")

            msg = getattr(choices[0], "message", None)
            if msg is None:
                raise RuntimeError("Groq choice has no message")

            raw = getattr(msg, "content", None)
            content = _normalize_groq_message_content(raw)
            if not content:
                raise RuntimeError("Empty Groq response")

            logger.info(
                "LLM success provider=groq model=%s latency_s=%.3f out_chars=%d",
                model_id,
                time.perf_counter() - t_model,
                len(content),
            )
            return content
        except Exception as e:
            last_error = e
            logger.warning(
                "Groq failed provider=groq model=%s latency_s=%.3f error=%s: %s",
                model_id,
                time.perf_counter() - t_model,
                type(e).__name__,
                e,
                exc_info=is_last,
            )

    assert last_error is not None
    logger.error("Groq: all models failed tried=%s", models)
    raise RuntimeError(f"All Groq models failed: {last_error}") from last_error


async def _run_sync(fn: Callable[[], str]) -> str:
    return await asyncio.to_thread(fn)


async def _with_one_retry(name: str, attempt_fn: Callable[[], Awaitable[str]]) -> str:
    last_exc: Exception | None = None
    for attempt in (1, 2):
        try:
            text = await attempt_fn()
            if text and text.strip():
                return text.strip()
            logger.warning(
                "%s provider retry: attempt %d/2 empty text",
                name,
                attempt,
            )
            last_exc = RuntimeError("empty response")
        except asyncio.TimeoutError as te:
            last_exc = te
            logger.error(
                "%s provider retry: attempt %d/2 asyncio.TimeoutError (timeout)",
                name,
                attempt,
            )
            if attempt == 2:
                raise
        except Exception as e:
            last_exc = e
            if attempt == 1:
                logger.warning(
                    "%s provider retry: attempt %d/2 failed %s: %s (retrying)",
                    name,
                    attempt,
                    type(e).__name__,
                    e,
                )
            else:
                logger.error(
                    "%s provider retry: attempt %d/2 failed %s: %s",
                    name,
                    attempt,
                    type(e).__name__,
                    e,
                    exc_info=True,
                )
    assert last_exc is not None
    raise last_exc


async def query_gemini(prompt: str) -> str:
    t_total = time.perf_counter()

    async def _once() -> str:
        try:
            return await asyncio.wait_for(
                _run_sync(lambda: _call_gemini_sync(prompt)),
                timeout=GEMINI_TIMEOUT_S,
            )
        except asyncio.TimeoutError:
            logger.error(
                "LLM timeout provider=gemini outer_timeout_s=%.1f",
                GEMINI_TIMEOUT_S,
            )
            raise

    try:
        text = await _with_one_retry("Gemini", _once)
        logger.info(
            "Gemini total latency_s=%.3f (includes retries)",
            time.perf_counter() - t_total,
        )
        return text
    except asyncio.TimeoutError:
        logger.error(
            "Gemini aborted after total latency_s=%.3f",
            time.perf_counter() - t_total,
        )
        raise


async def query_groq(prompt: str) -> str:
    t_total = time.perf_counter()
    outer_timeout = GROQ_TIMEOUT_S + 20

    async def _once() -> str:
        try:
            return await asyncio.wait_for(
                _run_sync(lambda: _call_groq_sync(prompt)),
                timeout=outer_timeout,
            )
        except asyncio.TimeoutError:
            logger.error(
                "LLM timeout provider=groq outer_timeout_s=%.1f",
                outer_timeout,
            )
            raise

    try:
        text = await _with_one_retry("Groq", _once)
        logger.info(
            "Groq total latency_s=%.3f (includes retries)",
            time.perf_counter() - t_total,
        )
        return text
    except asyncio.TimeoutError:
        logger.error(
            "Groq aborted after total latency_s=%.3f",
            time.perf_counter() - t_total,
        )
        raise


async def generate_text(
    prompt: str,
    provider_order: List[str] | None = None,
    *,
    allow_fallback_message: bool = True,
    retrieval_context: str | None = None,
) -> str:
    """
    Validate keys → optional circuit skip → Gemini → Groq → context-aware final fallback.
    Never returns None. Uses retrieval_context for final_fallback when LLMs fail.
    """
    provider_order = provider_order or ["gemini", "groq"]

    if not GEMINI_API_KEY and not GROQ_API_KEY:
        logger.error("generate_text: no GEMINI_API_KEY and no GROQ_API_KEY")
        if allow_fallback_message:
            return final_fallback(prompt, retrieval_context)
        raise RuntimeError("No LLM API keys configured")

    logger.info(
        "generate_text start order=%s prompt_chars=%d context_chars=%s gemini_models=%s groq_models=%s",
        provider_order,
        len(prompt),
        len(retrieval_context or "") if retrieval_context else 0,
        _gemini_models_to_try(),
        _groq_models_to_try(),
    )

    provider_map = {
        "gemini": query_gemini,
        "groq": query_groq,
    }

    errors: list[str] = []

    for provider_name in provider_order:
        key = provider_name.lower()
        fn = provider_map.get(key)
        if not fn:
            logger.warning("Unknown provider skipped: %s", provider_name)
            continue

        if key == "gemini" and not GEMINI_API_KEY:
            logger.warning("Skipping provider=gemini: missing GEMINI_API_KEY")
            errors.append("gemini: no API key")
            continue
        if key == "groq" and not GROQ_API_KEY:
            logger.warning("Skipping provider=groq: missing GROQ_API_KEY")
            errors.append("groq: no API key")
            continue

        if should_skip(key):
            logger.warning(
                "Skipping provider=%s: circuit open (failures >= %d)",
                key,
                CIRCUIT_THRESHOLD,
            )
            errors.append(f"{key}: circuit open")
            continue

        try:
            logger.info("Trying provider=%s", key)
            text = await fn(prompt)

            if is_valid_response(text):
                reset_failure(key)
                logger.info(
                    "generate_text success provider=%s out_chars=%d",
                    key,
                    len(text.strip()),
                )
                return text.strip()

            logger.error(
                "Provider=%s returned invalid/short response; treating as failure",
                key,
            )
            mark_failure(key)
            errors.append(f"{key}: invalid short response")
        except asyncio.TimeoutError:
            mark_failure(key)
            err = f"{key}: TimeoutError"
            logger.error("generate_text provider=%s asyncio.TimeoutError", key)
            errors.append(err)
        except Exception as e:
            mark_failure(key)
            err = f"{key}: {type(e).__name__}: {e}"
            logger.error(
                "generate_text provider=%s failed: %s",
                key,
                err,
                exc_info=True,
            )
            errors.append(err)

    detail = "; ".join(errors) if errors else "no providers attempted"
    logger.error("generate_text: all providers exhausted. %s", detail)

    if allow_fallback_message:
        out = final_fallback(prompt, retrieval_context)
        logger.warning(
            "generate_text: returning final_fallback context_used=%s",
            bool(retrieval_context and retrieval_context.strip()),
        )
        return out

    raise RuntimeError(f"All LLM providers failed. {detail}")


async def main() -> None:
    out = await generate_text(
        "Say hello in one word.",
        provider_order=["gemini", "groq"],
        retrieval_context=None,
    )
    print(out)


if __name__ == "__main__":
    asyncio.run(main())
