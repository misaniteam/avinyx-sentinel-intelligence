FROM python:3.12-slim
WORKDIR /app
COPY packages/shared /packages/shared
COPY services/ingestion-worker/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY services/ingestion-worker/ .
CMD ["python", "main.py"]
