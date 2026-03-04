FROM python:3.12-slim
WORKDIR /app
COPY services/execution/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY shared/ shared/
COPY services/__init__.py services/
COPY services/execution/ services/execution/
ENV PYTHONPATH=/app
HEALTHCHECK --interval=30s --timeout=5s --retries=3 CMD python -c "print('ok')" || exit 1
CMD ["uvicorn", "services.execution.src.main:app", "--host", "0.0.0.0", "--port", "8020"]
