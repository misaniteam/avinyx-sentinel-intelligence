FROM python:3.12-slim
WORKDIR /app
COPY packages/shared /packages/shared
COPY services/tenant-service/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY services/tenant-service/ .
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8002"]
