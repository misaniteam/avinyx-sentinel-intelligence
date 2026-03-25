import numpy as np
from pdf2image import convert_from_bytes
import easyocr
import pymupdf
import torch
import structlog

logger = structlog.get_logger()

EASYOCR_LANG_MAP = {
    "en": ["en"],
    "bn": ["bn", "en"],
    "hi": ["hi", "en"],
}

_use_gpu = torch.cuda.is_available()
_readers: dict[str, easyocr.Reader] = {}


def _get_reader(language: str):
    if language not in _readers:
        langs = EASYOCR_LANG_MAP.get(language, ["en"])
        logger.info("init_easyocr", langs=langs, gpu=_use_gpu)
        _readers[language] = easyocr.Reader(langs, gpu=_use_gpu)
    return _readers[language]


def _extract_text_pymupdf(pdf_bytes: bytes) -> str:
    doc = pymupdf.open(stream=pdf_bytes, filetype="pdf")
    pages = []

    for i, page in enumerate(doc):
        text = page.get_text("text")
        if text:
            pages.append(text)
        logger.info("pymupdf_page", page=i + 1, chars=len(text or ""))

    doc.close()
    return "\n\n".join(pages)


def _extract_text_easyocr(pdf_bytes: bytes, language: str) -> str:
    reader = _get_reader(language)
    images = convert_from_bytes(pdf_bytes, dpi=300)

    pages = []
    for i, image in enumerate(images):
        logger.info("ocr_page", page=i + 1)

        results = reader.readtext(np.array(image))
        page_text = "\n".join([t for _, t, _ in results])

        if page_text.strip():
            pages.append(page_text)

    return "\n\n".join(pages)


def extract_text(pdf_bytes: bytes, language: str = "en") -> str:
    logger.info("ocr_start")

    text = _extract_text_pymupdf(pdf_bytes)

    # Heuristic: electoral rolls are dense
    if not text or len(text) < 500:
        logger.info("fallback_easyocr")
        text = _extract_text_easyocr(pdf_bytes, language)

    logger.info("ocr_done", chars=len(text))
    return text