FROM python:3.12-slim

# System deps for Surya OCR / OpenCV
RUN apt-get update && apt-get install -y --no-install-recommends \
    libgl1-mesa-glx libglib2.0-0 \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY packages/shared /packages/shared
COPY services/voter-service/requirements.txt .
RUN pip install --no-cache-dir /packages/shared && \
    pip install --no-cache-dir -r requirements.txt

COPY services/voter-service/ .
CMD ["python", "main.py"]
