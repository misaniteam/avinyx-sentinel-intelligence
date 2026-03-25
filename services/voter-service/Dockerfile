FROM nvidia/cuda:12.6.3-runtime-ubuntu24.04

ENV DEBIAN_FRONTEND=noninteractive
RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 python3-pip poppler-utils && \
    ln -sf /usr/bin/python3 /usr/bin/python && \
    rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY packages/shared /packages/shared
COPY services/voter-service/requirements.txt .
RUN pip install --no-cache-dir --break-system-packages \
    torch torchvision --index-url https://download.pytorch.org/whl/cu124 && \
    pip install --no-cache-dir --break-system-packages /packages/shared && \
    pip install --no-cache-dir --break-system-packages easyocr pdf2image pymupdf

# Pre-download EasyOCR detection + recognition models so they're available offline
# (gpu=False during build since no GPU is available in the build environment)
RUN python -c "import easyocr; easyocr.Reader(['en'], gpu=False); easyocr.Reader(['bn', 'en'], gpu=False); easyocr.Reader(['hi', 'en'], gpu=False)"

COPY services/voter-service/ .
CMD ["python", "main.py"]
