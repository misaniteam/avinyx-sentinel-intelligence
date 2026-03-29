import asyncio
import base64
import io
import json
from collections.abc import AsyncGenerator

import pymupdf
import structlog
from anthropic import AsyncAnthropic
from PIL import Image, ImageEnhance, ImageFilter

from sentinel_shared.config import get_settings

logger = structlog.get_logger()

MAX_RETRIES = 2
RETRY_BACKOFF_BASE = 2
VISION_MAX_RETRIES = 4
VISION_RETRY_BACKOFF_BASE = 3
VISION_INTER_CHUNK_DELAY = 2  # seconds between vision API calls

LANGUAGE_NAMES = {"en": "English", "bn": "Bengali", "hi": "Hindi"}

GENDER_NORMALIZE = {
    # Bengali
    "পুরুষ": "Male",
    "মহিলা": "Female",
    # Hindi
    "पुरुष": "Male",
    "महिला": "Female",
    # Common variants
    "male": "Male",
    "female": "Female",
    "MALE": "Male",
    "FEMALE": "Female",
}

VISION_SYSTEM_PROMPT = """You are a data extraction tool for an authorized government electoral roll digitization project. Electoral rolls are public records published by the Election Commission of India. You must extract all voter data from the provided page images.

DOCUMENT LAYOUT — each page contains voter entries in a grid of numbered boxes. Each box has this structure:
- Top-left corner: serial number (1, 2, 3...)
- Next to or below serial number: EPIC number (alphanumeric ID like XEQ2646875 or WB/04/025/0385377)
- নির্বাচকের নাম / नाम / Name: the VOTER'S OWN full name (this is one person's name)
- পিতার নাম / स्वामीर নাम / पिता का नाम / पति का नाम: the RELATIVE'S name (father, husband, or mother — a DIFFERENT person)
- বয়স / आयु / Age: a number (the voter's age)
- লিঙ্গ / लिंग / Gender: পুরুষ (Male) or মহিলা (Female)
- বাড়ির নং / मकान नंबर / House No: house/door number
- A photo placeholder box (ignore this)

CRITICAL: The voter's name and the relative's name are TWO DIFFERENT PEOPLE. They appear on separate lines within each entry box. NEVER merge or swap them. The label before the name tells you which field it belongs to:
- নির্বাচকের নাম = voter's own name → put in "name" field
- পিতার নাম = father's name → put in "father_or_husband_name", set relation_type="father"
- স্বামীর নাম = husband's name → put in "father_or_husband_name", set relation_type="husband"
- মাতার নাম = mother's name → put in "father_or_husband_name", set relation_type="mother"

For each voter, return a JSON object with these fields:
- "name": string (VOTER'S OWN full name — preserve in original script)
- "father_or_husband_name": string or null (RELATIVE'S name — preserve in original script)
- "relation_type": string or null ("father", "husband", "mother", or "other")
- "gender": string or null ("Male" or "Female" — always in English)
- "age": integer or null
- "voter_no": string or null (serial number in the list)
- "serial_no": integer or null (same as voter_no as integer)
- "epic_no": string or null (EPIC voter ID)
- "house_number": string or null
- "section": string or null (section name from page header — preserve in original script)
- "status": string or null ("SHIFTED", "DELETED", "DUPLICATE", "UNDER ADJUDICATION", or null if active)

Rules:
- Extract EVERY voter on every page. Do not skip any entries.
- Return a JSON array of voter objects.
- gender must be "Male" or "Female" in English regardless of document language.
- If a voter entry has an "UNDER ADJUDICATION" watermark, set status to "UNDER ADJUDICATION" and still extract all available data.
- Preserve names in their original script (Bengali/Hindi/English).
- Read each entry box carefully — do not confuse adjacent entries."""

SYSTEM_PROMPT = """You are a data extraction specialist. Extract ALL voter records from the given Indian Electoral Roll text.

The document may be in English, Bengali (বাংলা), or Hindi (हिन्दी). The language will be specified in the user message.

For each voter, return a JSON object with these fields:
- "name": string (voter's full name, REQUIRED — preserve in original script)
- "father_or_husband_name": string or null (relative's name — preserve in original script)
- "relation_type": string or null (one of: "father", "husband", "mother", "other")
- "gender": string or null ("Male" or "Female")
- "age": integer or null
- "voter_no": string or null (serial/sequence number in the list)
- "serial_no": integer or null (same as voter_no as integer)
- "epic_no": string or null (EPIC voter ID, e.g. ATR2678928 or WB/17/114/066529)
- "house_number": string or null
- "section": string or null (section name/number from page header — preserve in original script)
- "status": string or null (one of: "SHIFTED", "DELETED", "DUPLICATE", "UNDER ADJUDICATION", or null if active)

IMPORTANT: All JSON keys and enum values (relation_type, gender, status) MUST be in English regardless of document language. Only name, father_or_husband_name, house_number, and section should preserve the original script.

Language-specific field labels to recognize:
- Bengali: নাম (Voter Name), পিতার নাম (Father's Name), স্বামীর নাম (Husband's Name), মাতার নাম (Mother's Name), লিঙ্গ (Gender), বয়স (Age), পুরুষ (Male), মহিলা (Female), বাড়ির নং (House Number), ক্রমিক নং (Serial No)
- Hindi: नाम (Voter Name), पिता का नाम (Father's Name), पति का नाम (Husband's Name), माता का नाम (Mother's Name), लिंग (Gender), आयु (Age), पुरुष (Male), महिला (Female), मकान नंबर (House Number), क्रम संख्या (Serial No)

Rules:
- Extract EVERY voter on every page. Do not skip any.
- Return ONLY a JSON array. No markdown, no explanation, no code fences.
- If the text has no voter records, return: []
- For relation_type: "Father's Name"/"পিতার নাম"/"पिता का नाम" or "S/O" = "father", "Husband's Name"/"স্বামীর নাম"/"पति का नाम" or "W/O" = "husband", "Mother's Name"/"মাতার নাম"/"माता का नाम" or "D/O" = "mother", "Others" = "other"
- Preserve original names exactly as written (including script and capitalization)
- WATERMARK HANDLING: Some voter entries have an "UNDER ADJUDICATION" watermark stamped over them. OCR will mix watermark text (e.g. "UNDER", "ADJUDICATION") into the voter's name, relative name, and other fields. For these entries:
  - Set "status" to "UNDER ADJUDICATION"
  - Strip any watermark fragments ("UNDER", "ADJUDICATION", "UNDER ADJUDICATION") from the name, father/husband name, and other fields
  - Extract whatever data you can from the corrupted text — partial names are acceptable
  - Do NOT skip watermarked entries"""


# =========================================================
# CLAUDE VOTER CLIENT
# =========================================================


class ClaudeVoterClient:
    """Anthropic Claude API client for voter data extraction."""

    def __init__(self):
        self.settings = get_settings()
        self.client = AsyncAnthropic(api_key=self.settings.anthropic_api_key)
        self.model = self.settings.claude_voter_model_id

    async def extract_voters(
        self, text: str, chunk_index: int, language: str = "en"
    ) -> list[dict]:
        """Send OCR text to Claude and get structured voter JSON back."""
        language_name = LANGUAGE_NAMES.get(language, "English")

        for attempt in range(MAX_RETRIES + 1):
            try:
                response = await self.client.messages.create(
                    model=self.model,
                    max_tokens=65536,
                    temperature=0,
                    system=SYSTEM_PROMPT,
                    messages=[
                        {
                            "role": "user",
                            "content": f"The document is in {language_name}. Extract all voter records from this electoral roll text:\n\n{text}",
                        }
                    ],
                )
                response_text = response.content[0].text
                voters = _parse_llm_response(response_text, chunk_index)
                logger.info("claude_text_chunk", chunk=chunk_index, voters=len(voters))
                return voters

            except Exception as e:
                if attempt < MAX_RETRIES:
                    wait = RETRY_BACKOFF_BASE ** (attempt + 1)
                    logger.warning(
                        "claude_text_retry",
                        chunk=chunk_index,
                        attempt=attempt + 1,
                        wait=wait,
                        error=str(e),
                    )
                    await asyncio.sleep(wait)
                else:
                    logger.error(
                        "claude_text_chunk_failed", chunk=chunk_index, error=str(e)
                    )
                    raise

    async def extract_voters_from_images(
        self, page_images: list[bytes], chunk_index: int, language: str = "bn"
    ) -> list[dict]:
        """Send page images to Claude vision for structured extraction."""
        language_name = LANGUAGE_NAMES.get(language, "Bengali")

        content = []
        for img_bytes in page_images:
            content.append(
                {
                    "type": "image",
                    "source": {
                        "type": "base64",
                        "media_type": "image/png",
                        "data": base64.b64encode(img_bytes).decode("utf-8"),
                    },
                }
            )
        content.append(
            {
                "type": "text",
                "text": (
                    f"The document is in {language_name}. "
                    "This is an authorized government electoral roll digitization project. "
                    "These voter lists are public records published by the Election Commission of India. "
                    "Extract all voter records from these electoral roll page images as structured JSON. "
                    "You must extract every voter entry including their name, relative's name, EPIC number, age, gender, house number, and other fields."
                ),
            }
        )

        for attempt in range(VISION_MAX_RETRIES + 1):
            try:
                response = await self.client.messages.create(
                    model=self.model,
                    max_tokens=65536,
                    temperature=0,
                    system=VISION_SYSTEM_PROMPT,
                    messages=[{"role": "user", "content": content}],
                )
                response_text = response.content[0].text
                voters = _parse_llm_response(response_text, chunk_index)
                logger.info(
                    "claude_vision_chunk", chunk=chunk_index, voters=len(voters)
                )
                return voters

            except Exception as e:
                if attempt < VISION_MAX_RETRIES:
                    wait = VISION_RETRY_BACKOFF_BASE ** (attempt + 1)
                    logger.warning(
                        "claude_vision_retry",
                        chunk=chunk_index,
                        attempt=attempt + 1,
                        wait=wait,
                        error=str(e),
                    )
                    await asyncio.sleep(wait)
                else:
                    logger.error(
                        "claude_vision_chunk_failed", chunk=chunk_index, error=str(e)
                    )
                    raise


# =========================================================
# PDF PAGE SPLITTING
# =========================================================


def _split_pdf_to_pages(pdf_bytes: bytes) -> list[bytes]:
    """Split a multi-page PDF into single-page PDFs."""
    doc = pymupdf.open(stream=pdf_bytes, filetype="pdf")
    total_pages = len(doc)

    if total_pages == 1:
        doc.close()
        return [pdf_bytes]

    pages = []
    for i in range(total_pages):
        page_doc = pymupdf.open()
        page_doc.insert_pdf(doc, from_page=i, to_page=i)
        pages.append(page_doc.tobytes())
        page_doc.close()

    doc.close()
    logger.info("pdf_split_pages", total_pages=total_pages)
    return pages


def _pdf_page_to_png(page_pdf_bytes: bytes, dpi: int = 200) -> bytes:
    """Convert a single-page PDF to a single PNG image."""
    doc = pymupdf.open(stream=page_pdf_bytes, filetype="pdf")
    page = doc[0]
    mat = pymupdf.Matrix(dpi / 72, dpi / 72)
    pix = page.get_pixmap(matrix=mat)
    png_bytes = pix.tobytes("png")
    doc.close()
    return png_bytes


def _enhance_image(png_bytes: bytes) -> bytes:
    """Apply contrast boost and sharpening to improve Bengali/Hindi text clarity."""
    img = Image.open(io.BytesIO(png_bytes))

    # Convert to grayscale for cleaner text
    img = img.convert("L")

    # Boost contrast — makes text darker, background whiter
    img = ImageEnhance.Contrast(img).enhance(1.8)

    # Sharpen edges of characters
    img = img.filter(ImageFilter.SHARPEN)

    # Convert back to RGB (required for PNG with good compatibility)
    img = img.convert("RGB")

    buf = io.BytesIO()
    img.save(buf, format="PNG")
    return buf.getvalue()


def _pdf_page_to_strips(page_pdf_bytes: bytes, num_strips: int = 2) -> list[bytes]:
    """Split a single-page PDF into horizontal strip PNGs for better OCR accuracy.

    For scanned PDFs with dense Bengali/Hindi text, smaller focused images
    produce significantly more accurate character recognition than full pages.
    Each strip is enhanced with contrast boost + sharpening.
    """
    doc = pymupdf.open(stream=page_pdf_bytes, filetype="pdf")
    page = doc[0]
    w, h = page.rect.width, page.rect.height

    # 2x zoom
    mat = pymupdf.Matrix(2, 2)

    header_frac = 0.02  # minimal header skip — voter entries start near top
    footer_frac = 0.02  # minimal footer skip
    overlap_frac = 0.04  # ~1 entry box overlap to avoid cutting through entries
    content_top = h * header_frac
    content_bottom = h * (1 - footer_frac)
    strip_height = (content_bottom - content_top) / num_strips
    overlap = h * overlap_frac

    strips = []
    for i in range(num_strips):
        y_top = content_top + i * strip_height - (overlap if i > 0 else 0)
        y_bottom = (
            content_top
            + (i + 1) * strip_height
            + (overlap if i < num_strips - 1 else 0)
        )
        # Clamp to page bounds
        y_top = max(0, y_top)
        y_bottom = min(h, y_bottom)
        clip = pymupdf.Rect(0, y_top, w, y_bottom)
        pix = page.get_pixmap(matrix=mat, clip=clip)
        raw_png = pix.tobytes("png")
        # Enhance for better text recognition
        strips.append(_enhance_image(raw_png))

    doc.close()
    logger.info("page_split_strips", strips=len(strips))
    return strips


# =========================================================
# LLM RESPONSE PARSING
# =========================================================


def _salvage_truncated_json(text: str, chunk_index: int) -> list[dict] | None:
    """Try to recover complete voter objects from truncated JSON array."""
    # Find the last complete object by looking for "},\n  {" or "}\n]" patterns
    # Work backwards to find the last complete "}"
    last_brace = text.rfind("}")
    while last_brace > 0:
        candidate = text[: last_brace + 1] + "\n]"
        try:
            records = json.loads(candidate)
            if isinstance(records, list):
                logger.warning(
                    "json_truncated_salvaged",
                    chunk=chunk_index,
                    salvaged=len(records),
                )
                return records
        except json.JSONDecodeError:
            pass
        last_brace = text.rfind("}", 0, last_brace)

    logger.warning(
        "json_parse_failed",
        chunk=chunk_index,
        error="could not salvage truncated JSON",
        response_preview=text[:500],
    )
    return None


def _parse_llm_response(text: str, chunk_index: int) -> list[dict]:
    """Parse LLM JSON response into voter dicts."""
    cleaned = text.strip()
    # Strip code fences if present
    if cleaned.startswith("```"):
        cleaned = cleaned.split("\n", 1)[-1]
    if cleaned.endswith("```"):
        cleaned = cleaned.rsplit("```", 1)[0]
    cleaned = cleaned.strip()

    try:
        records = json.loads(cleaned)
    except json.JSONDecodeError:
        # Truncated response — try to salvage complete objects
        records = _salvage_truncated_json(cleaned, chunk_index)
        if records is None:
            return []

    if not isinstance(records, list):
        logger.warning("unexpected_response_type", chunk=chunk_index)
        return []

    def _trunc(val, maxlen):
        """Truncate string to fit DB column."""
        if val is None:
            return None
        s = str(val).strip()
        return s[:maxlen] if s else None

    voters = []
    for r in records:
        if not isinstance(r, dict) or not r.get("name"):
            continue

        # Filter phantom entries: every valid voter has a serial number
        if not r.get("serial_no") and not r.get("voter_no"):
            continue

        # Coerce types
        age = r.get("age")
        if age is not None:
            try:
                age = int(age)
            except (ValueError, TypeError):
                age = None

        serial_no = r.get("serial_no")
        if serial_no is not None:
            try:
                serial_no = int(serial_no)
            except (ValueError, TypeError):
                serial_no = None

        voters.append(
            {
                "name": _trunc(r["name"], 255),
                "father_or_husband_name": _trunc(r.get("father_or_husband_name"), 255),
                "relation_type": _trunc(r.get("relation_type"), 20),
                "gender": _trunc(
                    GENDER_NORMALIZE.get(r.get("gender", ""), r.get("gender")), 10
                ),
                "age": age,
                "voter_no": _trunc(r.get("voter_no"), 50),
                "serial_no": serial_no,
                "epic_no": _trunc(r.get("epic_no"), 50),
                "house_number": _trunc(r.get("house_number"), 100),
                "section": _trunc(r.get("section"), 50),
                "status": _trunc(r.get("status"), 50),
                "raw_text": r.get("raw_text"),
            }
        )

    return voters


# =========================================================
# PUBLIC API
# =========================================================


async def extract_voters_from_pdf(
    pdf_bytes: bytes,
    language: str = "en",
) -> AsyncGenerator[list[dict], None]:
    """
    Extract voter records from a PDF, yielding deduplicated voters per chunk.

    Pipeline varies by language:
    - English: pymupdf text extraction → Claude API text-based structured extraction
    - Bengali/Hindi: PDF → PNG strips → Claude API vision extraction

    Yields a list[dict] after each chunk so the caller can insert to DB
    incrementally. Deduplicates by epic_no across chunks.
    """
    settings = get_settings()
    pages_per_chunk = settings.voter_pages_per_chunk

    # Step 1: Split PDF into single pages
    pages = _split_pdf_to_pages(pdf_bytes)

    logger.info("extraction_start", pages=len(pages), language=language)

    claude = ClaudeVoterClient()
    seen_epics: set[str] = set()
    seen_serials: dict[
        int, dict
    ] = {}  # serial_no → voter dict (for completeness comparison)

    def _deduplicate(voters: list[dict]) -> list[dict]:
        unique = []
        for v in voters:
            epic = v.get("epic_no")
            serial = v.get("serial_no")

            # Skip by epic_no
            if epic and epic in seen_epics:
                continue

            # Duplicate serial_no — prefer version with EPIC
            if serial is not None and serial in seen_serials:
                prev = seen_serials[serial]
                if epic and not prev.get("epic_no"):
                    # Better version found — yield it as an update
                    seen_serials[serial] = v
                    if epic:
                        seen_epics.add(epic)
                    v["_replace_serial"] = True  # signal processor to update
                    unique.append(v)
                continue

            if serial is not None:
                seen_serials[serial] = v
            if epic:
                seen_epics.add(epic)
            unique.append(v)
        return unique

    if language == "en":
        # ---- ENGLISH: pymupdf text extraction → Claude text ----
        doc = pymupdf.open(stream=pdf_bytes, filetype="pdf")
        page_texts = []
        for i in range(len(doc)):
            text = doc[i].get_text()
            if text.strip():
                page_texts.append(text)
        doc.close()

        full_text_len = sum(len(t) for t in page_texts)
        logger.info(
            "pymupdf_text_complete",
            pages_with_text=len(page_texts),
            total_chars=full_text_len,
        )

        if not page_texts:
            logger.warning("no_text_extracted")
            return

        text_chunks = []
        for i in range(0, len(page_texts), pages_per_chunk):
            chunk_pages = page_texts[i : i + pages_per_chunk]
            text_chunks.append("\n\n--- PAGE BREAK ---\n\n".join(chunk_pages))

        logger.info(
            "claude_text_chunks_prepared",
            chunks=len(text_chunks),
            pages_per_chunk=pages_per_chunk,
        )

        for i, chunk_text in enumerate(text_chunks):
            try:
                voters = await claude.extract_voters(
                    chunk_text, chunk_index=i, language=language
                )
                unique = _deduplicate(voters)
                if unique:
                    yield unique
            except Exception as e:
                logger.warning("claude_text_chunk_skipped", chunk=i, error=str(e))

    else:
        # ---- BENGALI / HINDI: PDF → PNG strips → Claude vision ----
        logger.info(
            "vision_mode",
            language=language,
        )

        # Skip first 2 pages (cover/summary + polling station map — no voter data)
        voter_pages = pages[2:] if len(pages) > 2 else pages
        logger.info(
            "vision_pages_skipped",
            skipped=len(pages) - len(voter_pages),
            processing=len(voter_pages),
        )

        all_strips: list[bytes] = []
        for i, page_bytes in enumerate(voter_pages):
            try:
                strips = _pdf_page_to_strips(page_bytes, num_strips=3)
                for j, strip in enumerate(strips):
                    all_strips.append(strip)
                    logger.info(
                        "page_strip",
                        page=i + 1,
                        strip=j + 1,
                        size_kb=len(strip) // 1024,
                    )
            except Exception as e:
                logger.warning("page_strip_failed", page=i + 1, error=str(e))

        if not all_strips:
            logger.warning("no_strips_generated")
            return

        # Each strip is one chunk (one API call per strip)
        image_chunks = [[strip] for strip in all_strips]

        logger.info("vision_chunks_prepared", chunks=len(image_chunks))

        for i, chunk_images in enumerate(image_chunks):
            try:
                voters = await claude.extract_voters_from_images(
                    chunk_images, chunk_index=i, language=language
                )
                unique = _deduplicate(voters)
                if unique:
                    yield unique
            except Exception as e:
                logger.warning("claude_vision_chunk_skipped", chunk=i, error=str(e))

            # Delay between vision API calls to avoid rate limiting
            if i < len(image_chunks) - 1:
                await asyncio.sleep(VISION_INTER_CHUNK_DELAY)
