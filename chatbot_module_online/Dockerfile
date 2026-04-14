FROM python:3.11-slim

ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1

WORKDIR /app

# Copy requirements.txt from the Dockerfile's directory (chatbot_module_online)
COPY requirements.txt /app/requirements.txt

RUN apt-get update && apt-get install -y build-essential libmagic1 && rm -rf /var/lib/apt/lists/*

# --no-cache-dir avoids stale wheel layers when bumping pins (e.g. groq/httpx).
RUN pip install --upgrade pip && pip install --no-cache-dir -r requirements.txt

# Copy the entire chatbot-backend folder into /app
COPY chatbot-backend /app

EXPOSE 8000

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000", "--log-level", "info"]
