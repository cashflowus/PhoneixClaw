FROM python:3.13-slim AS builder
WORKDIR /app
COPY services/trade-executor/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

FROM python:3.13-slim
WORKDIR /app
COPY --from=builder /usr/local/lib/python3.13/site-packages /usr/local/lib/python3.13/site-packages
COPY --from=builder /usr/local/bin /usr/local/bin
COPY shared/ /app/shared/
COPY services/trade-executor/ /app/services/trade-executor/
ENV PYTHONPATH=/app
CMD ["python", "services/trade-executor/main.py"]
