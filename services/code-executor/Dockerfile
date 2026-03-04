FROM python:3.12-slim
WORKDIR /app
COPY services/code-executor/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY services/code-executor/ .
ENV PYTHONPATH=/app
HEALTHCHECK --interval=30s --timeout=5s --retries=3 CMD python -c "print('ok')" || exit 1
CMD ["uvicorn", "src.main:app", "--host", "0.0.0.0", "--port", "8026"]
