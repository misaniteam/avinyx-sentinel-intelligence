FROM python:3.12-slim
WORKDIR /app
COPY packages/shared /packages/shared
COPY services/ai-pipeline-service/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY services/ai-pipeline-service/ .
CMD ["python", "main.py"]
