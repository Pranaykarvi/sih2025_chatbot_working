"""
LLM providers: Gemini (primary) and Groq (fallback).
Uses official SDKs, structured logging, short timeouts, and one retry per provider.
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
# Override on Render if Groq deprecates an id: e.g. llama-3.1-8b-instant
GROQ_MODEL = (os.getenv("GROQ_MODEL") or "llama3-8b-8192").strip()
GEMINI_TIMEOUT_S = 45.0
GROQ_TIMEOUT_S = 45.0

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


def _call_groq_sync(prompt: str) -> str:
    from groq import Groq

    if not GROQ_API_KEY:
        raise ValueError("GROQ_API_KEY is missing or empty")

    client = Groq(api_key=GROQ_API_KEY)
    completion = client.chat.completions.create(
        model=GROQ_MODEL,
        messages=[{"role": "user", "content": prompt}],
        max_tokens=1024,
        temperature=0.7,
    )
    choice = completion.choices[0] if completion.choices else None
    if not choice or not choice.message:
        logger.error("Groq returned no choices: %s", completion)
        raise RuntimeError("Groq returned no message")
    content = (choice.message.content or "").strip()
    if not content:
        raise RuntimeError("Groq returned empty content")
    return content


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
            timeout=GROQ_TIMEOUT_S,
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
    If all fail and allow_fallback_message is True, returns FALLBACK_ANSWER instead of raising.
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
            # Traceback already logged on final retry inside query_*; keep summary here
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
