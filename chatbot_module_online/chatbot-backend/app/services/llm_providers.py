"""
LLM providers: Gemini (google-genai) primary, Groq mandatory fallback.
Explicit ORDER (gemini → groq); Groq is never circuit-skipped.
Dynamic model fallbacks, Gemini-only circuit breaker, latency logs, context-aware final fallback.
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

# Soft circuit breaker (Gemini only). Groq is NEVER skipped — it is mandatory fallback.
CIRCUIT_THRESHOLD = 3

# Explicit LLM execution order (Gemini first, Groq always attempted if Gemini does not return valid text).
ORDER: list[str] = ["gemini", "groq"]

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

_groq_client_init_logged = False
_groq_client_init_log_lock = threading.Lock()


def should_skip(provider: str) -> bool:
    """Groq is never circuit-skipped so fallback always runs when Gemini fails."""
    if provider.lower() == "groq":
        return False
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


def _is_gemini_quota_exhausted(exc: BaseException) -> bool:
    """Detect quota / rate limit so we fail fast to Groq without silent retry storms."""
    msg = f"{type(exc).__name__} {exc}".upper()
    if "RESOURCE_EXHAUSTED" in msg:
        return True
    if "429" in msg:
        return True
    if "QUOTA" in msg and ("EXCEED" in msg or "EXHAUST" in msg):
        return True
    if "RATE_LIMIT" in msg or "RATE-LIMIT" in msg:
        return True
    return False


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
            if _is_gemini_quota_exhausted(e):
                logger.warning(
                    "Gemini quota exhausted or rate-limited on model=%s → skipping remaining Gemini models",
                    model_id,
                )
                raise RuntimeError(f"Gemini quota exhausted: {e}") from e

    assert last_error is not None
    logger.error("Gemini: all models failed tried=%s", models)
    raise RuntimeError(f"All Gemini models failed: {last_error}") from last_error


def _call_groq_sync(prompt: str) -> str:
    global _groq_client_init_logged
    from groq import Groq

    if not GROQ_API_KEY:
        raise ValueError("GROQ_API_KEY is missing or empty")

    models = _groq_models_to_try()
    if not models:
        raise RuntimeError("No Groq model ids configured")

    client = Groq(api_key=GROQ_API_KEY, timeout=GROQ_TIMEOUT_S)
    with _groq_client_init_log_lock:
        if not _groq_client_init_logged:
            logger.info("Groq client initialized successfully")
            _groq_client_init_logged = True

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

    last_exc: Exception | None = None
    for attempt in (1, 2):
        try:
            text = await _once()
            if text and text.strip():
                logger.info(
                    "Gemini total latency_s=%.3f (includes retries)",
                    time.perf_counter() - t_total,
                )
                return text.strip()
            logger.warning(
                "Gemini provider retry: attempt %d/2 empty text",
                attempt,
            )
            last_exc = RuntimeError("empty response")
        except asyncio.TimeoutError as te:
            last_exc = te
            logger.error(
                "Gemini provider retry: attempt %d/2 asyncio.TimeoutError",
                attempt,
            )
            if attempt == 2:
                raise
        except Exception as e:
            last_exc = e
            if _is_gemini_quota_exhausted(e):
                logger.warning(
                    "Gemini quota exhausted → skipping outer retries (attempt %d/2)",
                    attempt,
                )
                raise
            if attempt == 1:
                logger.warning(
                    "Gemini provider retry: attempt %d/2 failed %s: %s (retrying)",
                    attempt,
                    type(e).__name__,
                    e,
                )
            else:
                logger.error(
                    "Gemini provider retry: attempt %d/2 failed %s: %s",
                    attempt,
                    type(e).__name__,
                    e,
                    exc_info=True,
                )
    assert last_exc is not None
    raise last_exc


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
    Explicit order: Gemini → Groq (mandatory if Gemini fails) → context-aware final fallback.
    Groq is never circuit-skipped. Never returns None when allow_fallback_message is True.
    """
    raw_order = provider_order or list(ORDER)
    normalized_order: list[str] = []
    seen: set[str] = set()
    for p in raw_order:
        key = (p or "").lower().strip()
        if not key or key in seen:
            continue
        seen.add(key)
        normalized_order.append(key)

    errors: list[str] = []

    if not GEMINI_API_KEY and not GROQ_API_KEY:
        logger.error("generate_text: no GEMINI_API_KEY and no GROQ_API_KEY")
        if allow_fallback_message:
            out = final_fallback(prompt, retrieval_context)
            fb_kind = (
                "context_fallback"
                if (retrieval_context and str(retrieval_context).strip())
                else "static_fallback"
            )
            logger.info("FINAL RESPONSE GENERATED BY: %s", fb_kind)
            return out
        raise RuntimeError("No LLM API keys configured")

    logger.info(
        "generate_text start order=%s prompt_chars=%d context_chars=%s gemini_models=%s groq_models=%s",
        normalized_order,
        len(prompt),
        len(retrieval_context or "") if retrieval_context else 0,
        _gemini_models_to_try(),
        _groq_models_to_try(),
    )

    provider_map = {
        "gemini": query_gemini,
        "groq": query_groq,
    }

    # --- GEMINI ---
    if "gemini" in normalized_order:
        if not GEMINI_API_KEY:
            logger.warning("Skipping provider=gemini: missing GEMINI_API_KEY")
            errors.append("gemini: no API key")
        elif should_skip("gemini"):
            logger.warning(
                "Skipping provider=gemini: circuit open (failures >= %d)",
                CIRCUIT_THRESHOLD,
            )
            errors.append("gemini: circuit open")
        else:
            try:
                logger.info("Trying provider=gemini")
                text = await provider_map["gemini"](prompt)
                if is_valid_response(text):
                    reset_failure("gemini")
                    logger.info(
                        "LLM SUCCESS provider=gemini out_chars=%d",
                        len(text.strip()),
                    )
                    logger.info("FINAL RESPONSE GENERATED BY: gemini")
                    return text.strip()
                logger.error(
                    "Provider=gemini returned invalid/short response; treating as failure",
                )
                mark_failure("gemini")
                errors.append("gemini: invalid short response")
            except asyncio.TimeoutError:
                mark_failure("gemini")
                logger.error("generate_text provider=gemini asyncio.TimeoutError")
                errors.append("gemini: TimeoutError")
            except Exception as e:
                mark_failure("gemini")
                if _is_gemini_quota_exhausted(e):
                    logger.warning(
                        "Gemini quota exhausted or rate-limited → failing over to Groq: %s",
                        e,
                    )
                else:
                    logger.warning("Gemini failed: %s", e, exc_info=True)
                errors.append(f"gemini: {type(e).__name__}: {e}")

    # --- GROQ (mandatory fallback; circuit breaker never skips Groq) ---
    if "groq" in normalized_order:
        if not GROQ_API_KEY:
            logger.warning("Skipping provider=groq: missing GROQ_API_KEY")
            errors.append("groq: no API key")
        else:
            try:
                logger.info("Trying provider=groq")
                text = await provider_map["groq"](prompt)
                if is_valid_response(text):
                    reset_failure("groq")
                    logger.info(
                        "LLM SUCCESS provider=groq out_chars=%d",
                        len(text.strip()),
                    )
                    logger.info("FINAL RESPONSE GENERATED BY: groq")
                    return text.strip()
                logger.error(
                    "Provider=groq returned invalid/short response; treating as failure",
                )
                mark_failure("groq")
                errors.append("groq: invalid short response")
            except asyncio.TimeoutError:
                mark_failure("groq")
                logger.error("generate_text provider=groq asyncio.TimeoutError")
                errors.append("groq: TimeoutError")
            except Exception as e:
                mark_failure("groq")
                logger.error("Groq failed: %s", e, exc_info=True)
                errors.append(f"groq: {type(e).__name__}: {e}")

    for key in normalized_order:
        if key not in provider_map:
            logger.warning("Unknown provider skipped: %s", key)

    detail = "; ".join(errors) if errors else "no LLM providers ran successfully"
    logger.error("generate_text: all providers exhausted. %s", detail)

    if allow_fallback_message:
        out = final_fallback(prompt, retrieval_context)
        fb_kind = (
            "context_fallback"
            if (retrieval_context and str(retrieval_context).strip())
            else "static_fallback"
        )
        logger.error("Both providers failed → using fallback (%s)", fb_kind)
        logger.warning(
            "generate_text: returning final_fallback context_used=%s",
            bool(retrieval_context and retrieval_context.strip()),
        )
        logger.info("FINAL RESPONSE GENERATED BY: %s", fb_kind)
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
