import numpy as np
from pdf2image import convert_from_bytes
import easyocr
import pymupdf
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


def _extract_text_pymupdf(pdf_bytes: bytes) -> str:
    """Extract text from PDF using pymupdf (works for digital/text-based PDFs).

    Uses layout-preserving extraction to maintain the column structure
    of electoral roll voter cards.
    """
    logger.info("pymupdf_extraction_starting", pdf_size=len(pdf_bytes))
    doc = pymupdf.open(stream=pdf_bytes, filetype="pdf")
    pages = []
    for i, page in enumerate(doc):
        # Use "text" sort mode which preserves reading order
        page_text = page.get_text("text")
        if page_text and page_text.strip():
            pages.append(page_text)
        logger.info("pymupdf_page_done", page=i + 1, chars=len(page_text) if page_text else 0)
    doc.close()
    text = "\n\n".join(pages)
    logger.info("pymupdf_extraction_complete", pages_with_text=len(pages), total_chars=len(text))
    return text


def _extract_text_easyocr(pdf_bytes: bytes, language: str) -> str:
    """Extract text from PDF using pdf2image + EasyOCR (fallback for scanned PDFs)."""
    reader = _get_reader(language)

    logger.info("converting_pdf_to_images")
    images = convert_from_bytes(pdf_bytes, dpi=300)
    logger.info("pdf_converted_to_images", page_count=len(images))

    pages = []
    for i, image in enumerate(images):
        logger.info("ocr_processing_page", page=i + 1, total=len(images))
        image_np = np.array(image)
        results = reader.readtext(image_np)
        page_text = "\n".join([text for _, text, _ in results])
        if page_text and page_text.strip():
            pages.append(page_text)
        logger.info("ocr_page_done", page=i + 1, chars=len(page_text) if page_text else 0)

    text = "\n\n".join(pages)
    logger.info("easyocr_extraction_complete", pages_with_text=len(pages), total_chars=len(text))
    return text


def extract_text(pdf_bytes: bytes, language: str = "en") -> str:
    """Extract text from PDF. Tries pymupdf first (fast, preserves layout),
    falls back to EasyOCR for scanned/image-based PDFs."""
    logger.info("ocr_starting", pdf_size=len(pdf_bytes), language=language)

    # Try pymupdf first — works for digitally generated PDFs
    text = _extract_text_pymupdf(pdf_bytes)

    # Check if pymupdf extracted meaningful text
    # Electoral roll PDFs should have "Name" or voter ID patterns
    if text and len(text.strip()) > 200:
        logger.info("using_pymupdf_text", total_chars=len(text))
        return text

    # Fallback to EasyOCR for scanned/image-based PDFs
    logger.info("pymupdf_insufficient_text, falling_back_to_easyocr",
                pymupdf_chars=len(text) if text else 0)
    text = _extract_text_easyocr(pdf_bytes, language)
    logger.info("ocr_complete", total_chars=len(text))
    return text
