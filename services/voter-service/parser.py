import re
import structlog

logger = structlog.get_logger()

# -------------------------
# REGEX DEFINITIONS
# -------------------------

EPIC_REGEX = re.compile(r"\b[A-Z]{3}\d{7}\b")

RELATION_REGEX = re.compile(r"(S/O|W/O|D/O)\s+([A-Za-z .]+)", re.IGNORECASE)

AGE_REGEX = re.compile(r"Age[:\s]*(\d{2,3})", re.IGNORECASE)
GENDER_REGEX = re.compile(r"\b(Male|Female)\b", re.IGNORECASE)

HOUSE_REGEX = re.compile(r"House\s*No[:\s]*([\w/-]+)", re.IGNORECASE)

STATUS_KEYWORDS = ["SHIFTED", "DELETED", "DUPLICATE", "ADJUDICATION"]


# -------------------------
# HELPERS
# -------------------------

def _extract_status(text: str):
    t = text.upper()
    for s in STATUS_KEYWORDS:
        if s in t:
            return s
    return None


def _clean_text(text: str):
    return re.sub(r"\s+", " ", text).strip()


# -------------------------
# CORE PARSER
# -------------------------

def parse_voter_data(text: str, language: str = "en"):
    """
    Parse electoral roll OCR text into structured voter records.

    Strategy:
    - Split using EPIC numbers (most reliable anchor)
    - Parse each block independently
    """

    if not text:
        return []

    text = text.replace("\n", " ")

    # 🔥 Split blocks by EPIC
    epic_positions = [(m.start(), m.group()) for m in EPIC_REGEX.finditer(text)]

    voters = []

    for i, (pos, epic) in enumerate(epic_positions):
        try:
            # Define block boundaries
            start = pos
            end = epic_positions[i + 1][0] if i + 1 < len(epic_positions) else len(text)

            block = text[start:end]
            block = _clean_text(block)

            # -------------------------
            # FIELD EXTRACTION
            # -------------------------

            # EPIC
            epic_no = epic

            # Relation + relative name
            relation_match = RELATION_REGEX.search(block)
            relation_type = None
            relative_name = None

            if relation_match:
                relation_type = relation_match.group(1).upper()
                relative_name = relation_match.group(2).strip()

            # Gender
            gender_match = GENDER_REGEX.search(block)
            gender = gender_match.group(1).capitalize() if gender_match else None

            # Age
            age_match = AGE_REGEX.search(block)
            age = int(age_match.group(1)) if age_match else None

            # House number
            house_match = HOUSE_REGEX.search(block)
            house_number = house_match.group(1) if house_match else None

            # Name extraction (before relation)
            name = None
            if relation_match:
                name_part = block[:relation_match.start()]
                name_tokens = name_part.split()

                # Heuristic: last 2–4 tokens are name
                name = " ".join(name_tokens[-4:]).strip()

            # Serial number (optional)
            serial_match = re.search(r"\b(\d{1,4})\b", block[:20])
            serial_no = int(serial_match.group(1)) if serial_match else None

            # Status
            status = _extract_status(block)

            # -------------------------
            # FINAL OBJECT
            # -------------------------

            if name:  # minimal validation
                voters.append({
                    "name": name,
                    "father_or_husband_name": relative_name,
                    "relation_type": relation_type,
                    "gender": gender,
                    "age": age,
                    "voter_no": str(serial_no) if serial_no else None,
                    "serial_no": serial_no,
                    "epic_no": epic_no,
                    "house_number": house_number,
                    "section": None,  # can enhance later
                    "status": status,
                    "raw_text": block,
                })

        except Exception as e:
            logger.warning("block_parse_failed", error=str(e), block=block[:200])

    logger.info("parsed_voters", count=len(voters))
    return voters