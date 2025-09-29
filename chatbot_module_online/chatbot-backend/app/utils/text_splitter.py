
def chunk_text(text: str, chunk_size: int = 1000, overlap: int = 150):
    if not text:
        return []
    chunks, start = [], 0
    n = len(text)
    while start < n:
        end = start + chunk_size
        chunks.append(text[start:end])
        start += chunk_size - overlap
    return chunks

