FROM python:3.12-slim

WORKDIR /app
COPY packages/shared /packages/shared
COPY services/voter-service/requirements.txt .
RUN pip install --no-cache-dir /packages/shared && \
    pip install --no-cache-dir -r requirements.txt

COPY services/voter-service/ .
CMD ["python", "main.py"]
