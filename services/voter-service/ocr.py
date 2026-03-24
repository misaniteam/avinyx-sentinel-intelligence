import numpy as np
from pdf2image import convert_from_bytes
import easyocr
import structlog

logger = structlog.get_logger()

EASYOCR_LANG_MAP = {
    "en": ["en"],
    "bn": ["bn", "en"],
    "hi": ["hi", "en"],
}

# Module-level reader cache to avoid re-downloading models per call
_readers: dict[str, easyocr.Reader] = {}


def _get_reader(language: str) -> easyocr.Reader:
    """Get or create a cached EasyOCR Reader for the given language."""
    if language not in _readers:
        langs = EASYOCR_LANG_MAP.get(language, ["en"])
        logger.info("initializing_easyocr_reader", langs=langs)
        _readers[language] = easyocr.Reader(langs, gpu=False)
        logger.info("easyocr_reader_ready", langs=langs)
    return _readers[language]


def extract_text(pdf_bytes: bytes, language: str = "en") -> str:
    """Extract text from PDF using pdf2image + EasyOCR."""
    logger.info("ocr_starting", pdf_size=len(pdf_bytes), language=language)

    reader = _get_reader(language)

    logger.info("converting_pdf_to_images")
    images = convert_from_bytes(pdf_bytes, dpi=200)
    logger.info("pdf_converted_to_images", page_count=len(images))

    pages = []
    for i, image in enumerate(images):
        logger.info("ocr_processing_page", page=i + 1, total=len(images))
        image_np = np.array(image)
        results = reader.readtext(image_np)
        page_text = " ".join([text for _, text, _ in results])
        if page_text and page_text.strip():
            pages.append(page_text)
        logger.info("ocr_page_done", page=i + 1, chars=len(page_text) if page_text else 0)

    text = "\n\n".join(pages)
    logger.info("ocr_complete", pages_with_text=len(pages), total_pages=len(images), total_chars=len(text))
    return text
