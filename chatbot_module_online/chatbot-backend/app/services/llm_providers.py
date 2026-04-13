"""
LLM providers: Gemini (primary) and Groq (fallback).
Uses official SDKs, structured logging, timeouts, retries, and Groq model fallbacks.
"""

from __future__ import annotations

import asyncio
import logging
import os
from typing import Awaitable, Callable, List

from dotenv import load_dotenv

load_dotenv()

logger = logging.getLogger(__name__)

GEMINI_MODEL = (os.getenv("GEMINI_MODEL") or "gemini-1.5-flash").strip()

# Primary + fallbacks (full Groq model ids). First successful wins inside _call_groq_sync.
# Override first candidate with env GROQ_MODEL if set.
_GROQ_DEFAULT_MODELS: tuple[str, ...] = (
    "llama3-8b-8192",
    "mixtral-8x7b-32768",
    "llama3-70b-8192",
)

GEMINI_TIMEOUT_S = 45.0
GROQ_TIMEOUT_S = 60.0

GROQ_SYSTEM_MESSAGE = "You are a helpful medical assistant."

FALLBACK_ANSWER = (
    "AI service is temporarily unavailable. Please try again later."
)


def _env_api_key(name: str) -> str | None:
    """Read API key; strip whitespace and accidental surrounding quotes."""
    raw = os.getenv(name)
    if raw is None:
        return None
    v = raw.strip().strip('"').strip("'")
    return v or None


GEMINI_API_KEY = _env_api_key("GEMINI_API_KEY")
GROQ_API_KEY = _env_api_key("GROQ_API_KEY")

logger.info("Gemini API key configured: %s", bool(GEMINI_API_KEY))
logger.info("Groq API key configured: %s", bool(GROQ_API_KEY))


def _groq_models_to_try() -> list[str]:
    """Ordered list of Groq model ids to try (env first, then defaults, no duplicates)."""
    env_model = (os.getenv("GROQ_MODEL") or "").strip()
    out: list[str] = []
    if env_model:
        out.append(env_model)
    for m in _GROQ_DEFAULT_MODELS:
        if m not in out:
            out.append(m)
    return out


def _normalize_groq_message_content(content: object) -> str:
    """Groq returns str; some SDK versions may return structured parts — normalize to str."""
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
    import google.generativeai as genai

    if not GEMINI_API_KEY:
        raise ValueError("GEMINI_API_KEY is missing or empty")

    genai.configure(api_key=GEMINI_API_KEY)
    model = genai.GenerativeModel(GEMINI_MODEL)
    response = model.generate_content(prompt)

    if not response.candidates:
        block = getattr(response, "prompt_feedback", None)
        logger.error(
            "Gemini returned no candidates (possibly blocked). prompt_feedback=%s",
            block,
        )
        raise RuntimeError("Gemini returned no candidates (blocked or empty response)")

    try:
        raw_text = response.text
    except ValueError as e:
        logger.error("Gemini response.text unavailable (safety/block): %s", e)
        raise RuntimeError("Gemini blocked or invalid response text") from e

    text = (raw_text or "").strip()
    if not text:
        logger.error("Gemini returned empty text after parse; candidates=%s", response.candidates)
        raise RuntimeError("Gemini returned empty text")
    return text


def _call_groq_sync_single_model(prompt: str, model_id: str) -> str:
    """One Groq completion for a specific model id (sync)."""
    from groq import Groq

    if not GROQ_API_KEY:
        raise ValueError("GROQ_API_KEY is missing or empty")

    client = Groq(api_key=GROQ_API_KEY, timeout=GROQ_TIMEOUT_S)
    completion = client.chat.completions.create(
        model=model_id,
        messages=[
            {"role": "system", "content": GROQ_SYSTEM_MESSAGE},
            {"role": "user", "content": prompt},
        ],
        max_tokens=2048,
        temperature=0.3,
    )

    if not completion.choices:
        logger.error("Groq returned no choices (model=%s): %s", model_id, completion)
        raise RuntimeError("Groq returned no choices")

    choice = completion.choices[0]
    if choice.message is None:
        logger.error("Groq choice has no message (model=%s): %s", model_id, choice)
        raise RuntimeError("Groq returned no message")

    # Correct access path (not .text)
    content = _normalize_groq_message_content(choice.message.content)
    if not content:
        logger.error("Groq empty content after parse (model=%s)", model_id)
        raise RuntimeError("Groq returned empty content")

    return content


def _call_groq_sync(prompt: str) -> str:
    """
    Try Groq models in order until one succeeds.
    Logs each failure; full traceback only on final candidate (Render-friendly).
    """
    models = _groq_models_to_try()
    last_error: Exception | None = None
    for i, model_id in enumerate(models):
        is_last = i == len(models) - 1
        try:
            logger.info("Groq attempting model=%s (%d/%d)", model_id, i + 1, len(models))
            result = _call_groq_sync_single_model(prompt, model_id)
            logger.info("Groq success model=%s out_chars=%d", model_id, len(result))
            return result
        except Exception as e:
            last_error = e
            logger.warning(
                "Groq failed model=%s: %s: %s",
                model_id,
                type(e).__name__,
                e,
                exc_info=is_last,
            )

    assert last_error is not None
    logger.error("Groq exhausted all model candidates")
    raise last_error


async def _run_sync(fn: Callable[[], str]) -> str:
    return await asyncio.to_thread(fn)


async def _with_one_retry(name: str, attempt_fn: Callable[[], Awaitable[str]]) -> str:
    last_exc: Exception | None = None
    for attempt in (1, 2):
        try:
            text = await attempt_fn()
            if text and text.strip():
                return text.strip()
            logger.warning("%s attempt %d: empty text", name, attempt)
            last_exc = RuntimeError("empty response")
        except Exception as e:
            last_exc = e
            if attempt == 1:
                logger.warning(
                    "%s attempt %d failed: %s: %s (retrying)",
                    name,
                    attempt,
                    type(e).__name__,
                    e,
                )
            else:
                logger.error(
                    "%s attempt %d failed: %s: %s",
                    name,
                    attempt,
                    type(e).__name__,
                    e,
                    exc_info=True,
                )
    assert last_exc is not None
    raise last_exc


async def query_gemini(prompt: str) -> str:
    async def _once() -> str:
        return await asyncio.wait_for(
            _run_sync(lambda: _call_gemini_sync(prompt)),
            timeout=GEMINI_TIMEOUT_S,
        )

    return await _with_one_retry("Gemini", _once)


async def query_groq(prompt: str) -> str:
    async def _once() -> str:
        return await asyncio.wait_for(
            _run_sync(lambda: _call_groq_sync(prompt)),
            timeout=GROQ_TIMEOUT_S + 15,
        )

    return await _with_one_retry("Groq", _once)


async def generate_text(
    prompt: str,
    provider_order: List[str] | None = None,
    *,
    allow_fallback_message: bool = True,
) -> str:
    """
    Try providers in order (default Gemini -> Groq).
    If all fail and allow_fallback_message is True, returns FALLBACK_ANSWER.
    """
    provider_order = provider_order or ["gemini", "groq"]
    logger.info("LLM chain start order=%s prompt_chars=%d", provider_order, len(prompt))

    provider_map = {
        "gemini": query_gemini,
        "groq": query_groq,
    }

    errors: list[str] = []

    for provider_name in provider_order:
        fn = provider_map.get(provider_name.lower())
        if not fn:
            logger.warning("Unknown provider skipped: %s", provider_name)
            continue
        try:
            logger.info("LLM trying provider=%s", provider_name)
            text = await fn(prompt)
            if text:
                logger.info("LLM success provider=%s out_chars=%d", provider_name, len(text))
                return text
        except Exception as e:
            err = f"{provider_name}: {type(e).__name__}: {e}"
            logger.error("LLM provider failed (summary): %s", err)
            errors.append(err)

    detail = "; ".join(errors) if errors else "no providers attempted"
    logger.error("All LLM providers failed. %s", detail)

    if allow_fallback_message:
        return FALLBACK_ANSWER

    raise RuntimeError(f"All LLM providers failed. {detail}")


async def main() -> None:
    """CLI smoke test."""
    out = await generate_text("Say hello in one word.", provider_order=["gemini", "groq"])
    print(out)


if __name__ == "__main__":
    asyncio.run(main())
