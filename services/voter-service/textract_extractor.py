import asyncio
import json

import pymupdf
import structlog
from aiobotocore.session import get_session

from sentinel_shared.config import get_settings

logger = structlog.get_logger()

MAX_RETRIES = 2
RETRY_BACKOFF_BASE = 2

SYSTEM_PROMPT = """You are a data extraction specialist. Extract ALL voter records from the given Indian Electoral Roll text.

For each voter, return a JSON object with these fields:
- "name": string (voter's full name, REQUIRED)
- "father_or_husband_name": string or null (relative's name)
- "relation_type": string or null (one of: "father", "husband", "mother", "other")
- "gender": string or null ("Male" or "Female")
- "age": integer or null
- "voter_no": string or null (serial/sequence number in the list)
- "serial_no": integer or null (same as voter_no as integer)
- "epic_no": string or null (EPIC voter ID, e.g. ATR2678928 or WB/17/114/066529)
- "house_number": string or null
- "section": string or null (section name/number from page header)
- "status": string or null (one of: "SHIFTED", "DELETED", "DUPLICATE", "ADJUDICATION", or null if active)

Rules:
- Extract EVERY voter on every page. Do not skip any.
- Return ONLY a JSON array. No markdown, no explanation, no code fences.
- If the text has no voter records, return: []
- For relation_type: "Father's Name" or "S/O" = "father", "Husband's Name" or "W/O" = "husband", "Mother's Name" or "D/O" = "mother", "Others" = "other"
- Preserve original names exactly as written (including capitalization)"""


# =========================================================
# TEXTRACT CLIENT (OCR)
# =========================================================

class TextractClient:
    def __init__(self):
        self.settings = get_settings()
        self._session = get_session()

    def _get_client_kwargs(self):
        region = self.settings.aws_textract_region
        return {
            "region_name": region,
            "endpoint_url": f"https://textract.{region}.amazonaws.com",
            "aws_access_key_id": self.settings.aws_textract_access_key_id,
            "aws_secret_access_key": self.settings.aws_textract_secret_access_key,
        }

    async def detect_text(self, page_pdf_bytes: bytes, page_num: int) -> str:
        """Send a single-page PDF to Textract and return extracted text."""
        for attempt in range(MAX_RETRIES + 1):
            try:
                async with self._session.create_client(
                    "textract", **self._get_client_kwargs()
                ) as client:
                    response = await client.detect_document_text(
                        Document={"Bytes": page_pdf_bytes}
                    )

                lines = [
                    block["Text"]
                    for block in response.get("Blocks", [])
                    if block["BlockType"] == "LINE" and block.get("Text")
                ]

                text = "\n".join(lines)
                logger.info("textract_page", page=page_num, lines=len(lines), chars=len(text))
                return text

            except Exception as e:
                if attempt < MAX_RETRIES:
                    wait = RETRY_BACKOFF_BASE ** (attempt + 1)
                    logger.warning(
                        "textract_retry", page=page_num, attempt=attempt + 1,
                        wait=wait, error=str(e),
                    )
                    await asyncio.sleep(wait)
                else:
                    logger.error("textract_page_failed", page=page_num, error=str(e))
                    raise


# =========================================================
# BEDROCK CLIENT (LLM structured extraction)
# =========================================================

class BedrockClient:
    def __init__(self):
        self.settings = get_settings()
        self._session = get_session()

    def _get_client_kwargs(self):
        # Use same IAM credentials as Textract, same region
        region = self.settings.aws_textract_region
        return {
            "region_name": region,
            "endpoint_url": f"https://bedrock-runtime.{region}.amazonaws.com",
            "aws_access_key_id": self.settings.aws_textract_access_key_id,
            "aws_secret_access_key": self.settings.aws_textract_secret_access_key,
        }

    async def extract_voters(self, text: str, chunk_index: int) -> list[dict]:
        """Send OCR text to Bedrock LLM and get structured voter JSON back."""
        model_id = self.settings.bedrock_voter_model_id

        body = json.dumps({
            "anthropic_version": "bedrock-2023-05-31",
            "max_tokens": 16384,
            "temperature": 0,
            "system": SYSTEM_PROMPT,
            "messages": [
                {
                    "role": "user",
                    "content": f"Extract all voter records from this electoral roll text:\n\n{text}",
                }
            ],
        })

        for attempt in range(MAX_RETRIES + 1):
            try:
                async with self._session.create_client(
                    "bedrock-runtime", **self._get_client_kwargs()
                ) as client:
                    response = await client.invoke_model(
                        modelId=model_id,
                        body=body,
                        contentType="application/json",
                        accept="application/json",
                    )

                response_body = await response["body"].read()
                result = json.loads(response_body)
                response_text = result["content"][0]["text"]

                voters = _parse_llm_response(response_text, chunk_index)
                logger.info("bedrock_chunk", chunk=chunk_index, voters=len(voters))
                return voters

            except Exception as e:
                if attempt < MAX_RETRIES:
                    wait = RETRY_BACKOFF_BASE ** (attempt + 1)
                    logger.warning(
                        "bedrock_retry", chunk=chunk_index, attempt=attempt + 1,
                        wait=wait, error=str(e),
                    )
                    await asyncio.sleep(wait)
                else:
                    logger.error("bedrock_chunk_failed", chunk=chunk_index, error=str(e))
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


# =========================================================
# LLM RESPONSE PARSING
# =========================================================

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
    except json.JSONDecodeError as e:
        logger.warning(
            "json_parse_failed", chunk=chunk_index,
            error=str(e), response_preview=text[:500],
        )
        return []

    if not isinstance(records, list):
        logger.warning("unexpected_response_type", chunk=chunk_index)
        return []

    voters = []
    for r in records:
        if not isinstance(r, dict) or not r.get("name"):
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

        voters.append({
            "name": str(r["name"]).strip(),
            "father_or_husband_name": r.get("father_or_husband_name"),
            "relation_type": r.get("relation_type"),
            "gender": r.get("gender"),
            "age": age,
            "voter_no": str(r["voter_no"]) if r.get("voter_no") else None,
            "serial_no": serial_no,
            "epic_no": str(r.get("epic_no", "")).strip() or None,
            "house_number": r.get("house_number"),
            "section": r.get("section"),
            "status": r.get("status"),
            "raw_text": r.get("raw_text"),
        })

    return voters


# =========================================================
# PUBLIC API
# =========================================================

async def extract_voters_from_pdf(
    pdf_bytes: bytes,
    language: str = "en",
) -> list[dict]:
    """
    Extract voter records from a PDF using Textract OCR + Bedrock LLM.

    Pipeline:
    1. Split PDF into single pages (pymupdf)
    2. OCR each page via Textract detect_document_text
    3. Group page texts into chunks
    4. Send each chunk to Bedrock LLM for structured JSON extraction
    5. Deduplicate by epic_no
    """
    settings = get_settings()
    pages_per_chunk = settings.bedrock_voter_pages_per_chunk

    # Step 1: Split PDF
    pages = _split_pdf_to_pages(pdf_bytes)
    textract = TextractClient()

    logger.info("extraction_start", pages=len(pages), language=language)

    # Step 2: OCR all pages via Textract
    page_texts = []
    for i, page_bytes in enumerate(pages):
        try:
            text = await textract.detect_text(page_bytes, page_num=i + 1)
            if text.strip():
                page_texts.append(text)
        except Exception as e:
            logger.warning("textract_page_skipped", page=i + 1, error=str(e))

    full_text_len = sum(len(t) for t in page_texts)
    logger.info("textract_ocr_complete", pages_with_text=len(page_texts), total_chars=full_text_len)

    if not page_texts:
        logger.warning("no_text_extracted")
        return []

    # Step 3: Group into chunks for Bedrock
    text_chunks = []
    for i in range(0, len(page_texts), pages_per_chunk):
        chunk_pages = page_texts[i:i + pages_per_chunk]
        text_chunks.append("\n\n--- PAGE BREAK ---\n\n".join(chunk_pages))

    logger.info("bedrock_chunks_prepared", chunks=len(text_chunks), pages_per_chunk=pages_per_chunk)

    # Step 4: Send each chunk to Bedrock LLM
    bedrock = BedrockClient()
    all_voters = []
    for i, chunk_text in enumerate(text_chunks):
        try:
            voters = await bedrock.extract_voters(chunk_text, chunk_index=i)
            all_voters.extend(voters)
        except Exception as e:
            logger.warning("bedrock_chunk_skipped", chunk=i, error=str(e))

    # Step 5: Deduplicate by epic_no
    seen_epics = set()
    unique_voters = []
    for v in all_voters:
        epic = v.get("epic_no")
        if epic and epic in seen_epics:
            continue
        if epic:
            seen_epics.add(epic)
        unique_voters.append(v)

    logger.info(
        "extraction_complete",
        total=len(unique_voters),
        duplicates_removed=len(all_voters) - len(unique_voters),
    )

    return unique_voters
