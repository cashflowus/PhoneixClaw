FROM python:3.12-slim

WORKDIR /app

COPY services/llm-gateway/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY services/llm-gateway/main.py .

RUN apt-get update && apt-get install -y --no-install-recommends curl && rm -rf /var/lib/apt/lists/*

EXPOSE 8050

CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8050"]
