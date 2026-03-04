FROM python:3.12-slim

WORKDIR /app

COPY pyproject.toml .
COPY shared/ shared/
COPY apps/api/ apps/api/

RUN apt-get update && apt-get install -y --no-install-recommends curl && rm -rf /var/lib/apt/lists/*
RUN pip install --no-cache-dir -e .

EXPOSE 8011

CMD ["uvicorn", "apps.api.src.main:app", "--host", "0.0.0.0", "--port", "8011"]
