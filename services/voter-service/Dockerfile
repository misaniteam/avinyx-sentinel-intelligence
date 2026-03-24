FROM python:3.12-slim
RUN apt-get update && apt-get install -y --no-install-recommends \
    poppler-utils && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY packages/shared /packages/shared
COPY services/voter-service/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY services/voter-service/ .
CMD ["python", "main.py"]
