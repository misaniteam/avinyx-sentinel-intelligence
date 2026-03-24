from io import BytesIO
import pdfplumber
import structlog

logger = structlog.get_logger()

EASYOCR_LANG_MAP = {
    "en": ["en"],
    "bn": ["bn", "en"],
    "hi": ["hi", "en"],
}


def extract_text(pdf_bytes: bytes, language: str = "en") -> str:
    """Extract text from PDF. Uses pdfplumber for text-based PDFs, EasyOCR fallback for scanned."""
    text = _extract_with_pdfplumber(pdf_bytes)
    if text and len(text.strip()) > 50:
        logger.info("text_extraction_method", method="pdfplumber", chars=len(text))
        return text

    logger.info("pdfplumber_insufficient_text", chars=len(text.strip()) if text else 0, falling_back="easyocr")
    return _extract_with_ocr(pdf_bytes, language)


def _extract_with_pdfplumber(pdf_bytes: bytes) -> str:
    """Extract text from a text-based PDF using pdfplumber."""
    pages = []
    with pdfplumber.open(BytesIO(pdf_bytes)) as pdf:
        for page in pdf.pages:
            page_text = page.extract_text()
            if page_text:
                pages.append(page_text)
    return "\n\n".join(pages)


def _extract_with_ocr(pdf_bytes: bytes, language: str = "en") -> str:
    """Extract text from a scanned PDF using pdf2image + EasyOCR."""
    from pdf2image import convert_from_bytes
    import easyocr

    langs = EASYOCR_LANG_MAP.get(language, ["en"])
    reader = easyocr.Reader(langs, gpu=False)

    images = convert_from_bytes(pdf_bytes, dpi=300)
    pages = []
    for i, image in enumerate(images):
        import numpy as np
        image_np = np.array(image)
        results = reader.readtext(image_np)
        page_text = " ".join([text for _, text, _ in results])
        if page_text and page_text.strip():
            pages.append(page_text)
        logger.debug("ocr_page_processed", page=i + 1, chars=len(page_text) if page_text else 0)
    text = "\n\n".join(pages)
    logger.info("text_extraction_method", method="easyocr", langs=langs, pages=len(images), chars=len(text))
    return text
