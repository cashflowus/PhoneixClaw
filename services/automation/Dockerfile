FROM python:3.12-slim
WORKDIR /app
COPY services/automation/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY services/automation/ .
ENV PYTHONPATH=/app
HEALTHCHECK --interval=30s --timeout=5s --retries=3 CMD python -c "print('ok')" || exit 1
CMD ["python", "-m", "src.main"]
