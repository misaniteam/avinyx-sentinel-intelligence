"""
Surya OCR engine for self-hosted document text extraction.

Replaces AWS Bedrock vision API calls for Bengali/Hindi voter list processing.
Models are loaded once at startup and reused across all SQS messages.
GPU auto-detected via PyTorch CUDA — works on both GPU (fast) and CPU (fallback).
"""

import io
import re
import structlog
from PIL import Image

logger = structlog.get_logger(__name__)

# Unicode ranges for quality validation
BENGALI_RANGE = re.compile(r"[\u0980-\u09FF]")
HINDI_RANGE = re.compile(r"[\u0900-\u097F]")

# Minimum characters per page to consider OCR successful
MIN_CHARS_PER_PAGE = 100


class SuryaOCREngine:
    """Wraps Surya OCR for document text extraction with GPU support."""

    def __init__(self):
        """Load Surya models into memory. Call once at startup."""
        from surya.recognition import RecognitionPredictor
        from surya.detection import DetectionPredictor

        self.det_predictor = DetectionPredictor()
        self.rec_predictor = RecognitionPredictor()

        self.device = str(self.rec_predictor.model.device)
        logger.info(
            "surya_models_loaded",
            device=self.device,
        )

    def extract_text(self, png_bytes: bytes, language: str = "bn") -> str:
        """
        Extract text from a PNG image using Surya OCR.

        Args:
            png_bytes: Raw PNG image bytes.
            language: Language code ("bn", "hi", "en").

        Returns:
            Extracted text with lines joined by newlines.
        """
        from surya.recognition import run_recognition
        from surya.detection import run_detection

        image = Image.open(io.BytesIO(png_bytes)).convert("RGB")

        # Map language codes to Surya language names
        lang_map = {"bn": ["bn"], "hi": ["hi"], "en": ["en"]}
        langs = lang_map.get(language, ["en"])

        # Detect text line bounding boxes
        det_results = run_detection([image], self.det_predictor)

        # Recognize text within detected regions
        rec_results = run_recognition(
            [image],
            langs,
            self.rec_predictor,
            det_results[0],
        )

        # Extract text lines sorted by vertical position (top to bottom)
        lines = []
        if rec_results and len(rec_results) > 0:
            result = rec_results[0]
            # Sort by y-coordinate for reading order
            text_lines = sorted(
                result.text_lines,
                key=lambda tl: (tl.bbox[1], tl.bbox[0]),
            )
            for tl in text_lines:
                if tl.text and tl.text.strip():
                    lines.append(tl.text.strip())

        text = "\n".join(lines)

        logger.debug(
            "surya_page_extracted",
            language=language,
            lines=len(lines),
            chars=len(text),
        )

        return text

    def validate_quality(self, text: str, language: str) -> bool:
        """
        Check if extracted text contains expected script characters.

        Returns False if text is too short or missing expected Unicode ranges.
        """
        if len(text) < MIN_CHARS_PER_PAGE:
            return False

        if language == "bn":
            return bool(BENGALI_RANGE.search(text))
        elif language == "hi":
            return bool(HINDI_RANGE.search(text))
        else:
            # English — just check minimum length
            return True
