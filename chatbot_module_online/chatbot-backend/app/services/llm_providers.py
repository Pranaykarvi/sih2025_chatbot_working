import os
import logging
import asyncio
from dotenv import load_dotenv
import httpx
from typing import List

# Load environment variables from a .env file
load_dotenv()

# --- Logging Setup ---
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

# --- Configuration ---
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")
GROQ_API_KEY = os.getenv("GROQ_API_KEY")

# Debug: Log API key presence (not the actual keys)
logger.info("Gemini API Key present: %s", bool(GEMINI_API_KEY))
logger.info("Groq API Key present: %s", bool(GROQ_API_KEY))

# -------------------------------
# Provider Query Functions
# -------------------------------

async def query_gemini(prompt: str) -> str:
    """Sends a prompt to the Google Gemini API and returns the response."""
    if not GEMINI_API_KEY:
        raise ValueError("Gemini API key is missing from environment variables.")

    url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash-latest:generateContent?key={GEMINI_API_KEY}"
    headers = {"Content-Type": "application/json"}
    payload = {
        "contents": [{"parts": [{"text": prompt}]}]
    }

    try:
        logger.info("Sending request to Gemini API...")
        async with httpx.AsyncClient(timeout=30) as client:
            response = await client.post(url, json=payload, headers=headers)
            response.raise_for_status()  # Will raise an exception for 4xx/5xx responses
            data = response.json()
            logger.info("Received response from Gemini API")
            logger.debug("Raw response: %s", data)
            return data['candidates'][0]['content']['parts'][0]['text']
    except KeyError as e:
        logger.error("Failed to parse Gemini API response: %s. Response data: %s", str(e), data)
        raise
    except Exception as e:
        logger.error("Error in Gemini API call: %s", str(e))
        raise

async def query_groq(prompt: str) -> str:
    """Sends a prompt to the Groq API and returns the response."""
    if not GROQ_API_KEY:
        raise ValueError("Groq API key is missing from environment variables.")

    url = "https://api.groq.com/openai/v1/chat/completions"
    headers = {
        "Authorization": f"Bearer {GROQ_API_KEY}",
        "Content-Type": "application/json"
    }
    payload = {
        "model": "meta-llama/llama-4-maverick-17b-128e-instruct",  # Updated to use a valid model
        "messages": [{"role": "user", "content": prompt}],
        "max_tokens": 300,
        "temperature": 0.7
    }

    try:
        logger.info("Sending request to Groq API...")
        async with httpx.AsyncClient(timeout=20) as client:
            response = await client.post(url, json=payload, headers=headers)
            response.raise_for_status()
            data = response.json()
            logger.info("Received response from Groq API")
            logger.debug("Raw response: %s", data)
            return data['choices'][0]['message']['content']
    except KeyError as e:
        logger.error("Failed to parse Groq API response: %s. Response data: %s", str(e), data)
        raise
    except Exception as e:
        logger.error("Error in Groq API call: %s", str(e))
        raise

# -------------------------------
# Fallback Chain Logic
# -------------------------------

async def generate_text(prompt: str, provider_order: List[str] = None) -> str:
    """
    Attempts to generate text using a list of providers, falling back to the next
    one if a provider fails.
    """
    # Default order of providers if none is specified
    provider_order = provider_order or ["gemini", "groq"]
    
    logger.info("Starting text generation with providers order: %s", provider_order)
    logger.info("Prompt: %s", prompt[:100] + "..." if len(prompt) > 100 else prompt)

    provider_map = {
        "gemini": query_gemini,
        "groq": query_groq,
    }

    errors = []
    for provider_name in provider_order:
        try:
            query_func = provider_map.get(provider_name.lower())
            if not query_func:
                logger.warning("Unknown provider specified: %s", provider_name)
                continue

            logger.info("Attempting to generate text with provider: %s", provider_name)
            text = await query_func(prompt)

            if text and text.strip():
                logger.info("Provider '%s' succeeded.", provider_name)
                return text
            else:
                error_msg = f"Provider '{provider_name}' returned an empty response."
                logger.warning(error_msg)
                errors.append(error_msg)

        except httpx.HTTPStatusError as e:
            error_msg = f"Provider '{provider_name}' failed with HTTP status {e.response.status_code}: {e.response.text}"
            logger.warning(error_msg)
            errors.append(error_msg)
        except Exception as e:
            error_msg = f"An unexpected error occurred with provider '{provider_name}': {str(e)}"
            logger.warning(error_msg)
            errors.append(error_msg)

    # If all providers in the list have failed
    error_details = "\n".join(errors)
    logger.error("All providers failed. Details:\n%s", error_details)
    raise RuntimeError(f"All LLM providers failed to generate a response. Details:\n{error_details}")


# --- Example Usage ---
async def main():
    """Main function to run an example."""
    my_prompt = "Explain the concept of asynchronous programming in Python in a single paragraph."

    try:
        # Example 1: Default order (Gemini -> Groq)
        print("--- Attempting with default order (Gemini first) ---")
        response = await generate_text(my_prompt)
        print("Response:", response)

        print("\n" + "="*50 + "\n")

        # Example 2: Custom order (Groq -> Gemini)
        print("--- Attempting with custom order (Groq first) ---")
        response_groq_first = await generate_text(my_prompt, provider_order=["groq", "gemini"])
        print("Response:", response_groq_first)

    except RuntimeError as e:
        print(f"Error: {e}")
    except ValueError as e:
        print(f"Configuration Error: {e}")


if __name__ == "__main__":
    # To run this async code, we use asyncio.run()
    asyncio.run(main())