
from typing import List
import cohere
from app.config import COHERE_API_KEY
from tenacity import retry, wait_exponential, stop_after_attempt

co = cohere.Client(COHERE_API_KEY)

@retry(wait=wait_exponential(min=1, max=10), stop=stop_after_attempt(3))
def embed_texts(texts: List[str], model: str = "embed-english-v3.0", input_type="search_document") -> List[List[float]]:
    if not texts:
        return []
    response = co.embed(texts=texts, model=model, input_type=input_type)
    return response.embeddings

