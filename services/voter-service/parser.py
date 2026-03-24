import re
import structlog

logger = structlog.get_logger()

# Indian voter ID pattern: 2-3 uppercase letters followed by 6-10 digits,
# or WB/XX/XXX/XXXXXX format, or other state-specific formats
VOTER_ID_PATTERN = re.compile(
    r"([A-Z]{2,3}\d{6,10}|[A-Z]{2,3}/\d{2}/\d{3}/\d{5,6}|"
    r"WB/\d{2}/\d{3}/\d{5,6}|[A-Z]{3}\d{7})"
)

# Field patterns for electoral roll entries
NAME_PATTERN = re.compile(
    r"Name\s*[:\-]\s*(.+?)(?:\s*$|\s*(?:Photo|Available))",
    re.IGNORECASE | re.MULTILINE,
)
FATHERS_NAME_PATTERN = re.compile(
    r"(?:Father'?s?\s*(?:Name)?|Fathers\s*Name)\s*[:\-]\s*(.+?)(?:\s*$|\s*(?:House|Photo|Available))",
    re.IGNORECASE | re.MULTILINE,
)
HUSBANDS_NAME_PATTERN = re.compile(
    r"(?:Husband'?s?\s*(?:Name)?|Husbands\s*Name)\s*[:\-]\s*(.+?)(?:\s*$|\s*(?:House|Photo|Available))",
    re.IGNORECASE | re.MULTILINE,
)
MOTHERS_NAME_PATTERN = re.compile(
    r"(?:Mother'?s?\s*(?:Name)?|Mothers\s*Name)\s*[:\-]\s*(.+?)(?:\s*$|\s*(?:House|Photo|Available))",
    re.IGNORECASE | re.MULTILINE,
)
OTHERS_NAME_PATTERN = re.compile(
    r"Others\s*[:\-]\s*(.+?)(?:\s*$|\s*(?:House|Photo|Available))",
    re.IGNORECASE | re.MULTILINE,
)
AGE_PATTERN = re.compile(
    r"Age\s*[:\-]\s*(\d{1,3})",
    re.IGNORECASE,
)
GENDER_PATTERN = re.compile(
    r"Gender\s*[:\-]\s*(Male|Female|Third Gender|M|F)",
    re.IGNORECASE,
)
HOUSE_NUMBER_PATTERN = re.compile(
    r"House\s*Number\s*[:\-]\s*(.+?)(?:\s*$|\s*Age)",
    re.IGNORECASE | re.MULTILINE,
)
# Hindi field patterns
NAME_PATTERN_HI = re.compile(r"नाम\s*[:\-]\s*(.+?)(?:\s*$)", re.MULTILINE)
RELATION_PATTERN_HI = re.compile(
    r"(?:पिता/पति\s*का\s*नाम|पिता\s*का\s*नाम|पति\s*का\s*नाम)\s*[:\-]\s*(.+?)(?:\s*$)",
    re.MULTILINE,
)
AGE_PATTERN_HI = re.compile(r"आयु\s*[:\-]\s*(\d{1,3})")
GENDER_PATTERN_HI = re.compile(r"लिंग\s*[:\-]\s*(पुरुष|महिला|M|F)", re.IGNORECASE)

# Bengali field patterns
NAME_PATTERN_BN = re.compile(r"নাম\s*[:\-]\s*(.+?)(?:\s*$)", re.MULTILINE)
RELATION_PATTERN_BN = re.compile(
    r"(?:পিতা/স্বামীর\s*নাম|পিতার\s*নাম|স্বামীর\s*নাম)\s*[:\-]\s*(.+?)(?:\s*$)",
    re.MULTILINE,
)
AGE_PATTERN_BN = re.compile(r"বয়স\s*[:\-]\s*(\d{1,3})")
GENDER_PATTERN_BN = re.compile(r"লিঙ্গ\s*[:\-]\s*(পুরুষ|মহিলা|M|F)", re.IGNORECASE)


def parse_voter_data(text: str, language: str = "en") -> list[dict]:
    """Parse voter records from extracted PDF text.

    Supports the standard Indian Electoral Roll format with voter cards
    arranged in a grid. Each card contains:
      - Serial number and Voter ID
      - Name
      - Father's/Husband's/Mother's Name
      - House Number
      - Age and Gender
    """
    # First try the electoral roll card format (most common)
    voters = _parse_electoral_roll(text, language)
    if voters:
        logger.info("parsed_voter_data", format="electoral_roll", count=len(voters), language=language)
        return voters

    # Fallback to block format
    voters = _parse_block_format(text, language)
    logger.info("parsed_voter_data", format="block", count=len(voters), language=language)
    return voters


def _parse_electoral_roll(text: str, language: str) -> list[dict]:
    """Parse voter data from Indian Electoral Roll PDF format.

    The text from pymupdf preserves the card structure. Each voter card block
    typically looks like:

        1                          ATR2678928
        Name : Abdullah Molla
        Fathers Name: lutfar rahaman Molla
        House Number : .
        Age : 63 Gender : Male

    Or with OCR it may be less structured but still has the key fields.
    """
    voters = []

    # Split text into voter card blocks using voter ID as delimiter
    # Find all voter IDs and their positions
    voter_id_matches = list(VOTER_ID_PATTERN.finditer(text))

    if not voter_id_matches:
        logger.info("no_voter_ids_found_in_text", text_length=len(text))
        return []

    logger.info("voter_ids_found", count=len(voter_id_matches))

    # Extract blocks: from each voter ID to the next voter ID
    for idx, match in enumerate(voter_id_matches):
        voter_id = match.group(1)

        # Skip voter IDs that are clearly not voter card IDs
        # (e.g., constituency codes, page numbers)
        if len(voter_id) < 8:
            continue

        # Get the block of text from just before this voter ID
        # to the next voter ID
        # Look back from the voter ID position to find the serial number
        block_start = match.start()
        # Look back up to 50 chars for serial number
        lookback_start = max(0, block_start - 50)
        prefix = text[lookback_start:block_start]
        # Find the serial number (last number in the prefix)
        serial_match = re.search(r"(\d+)\s*$", prefix)

        if idx + 1 < len(voter_id_matches):
            block_end = voter_id_matches[idx + 1].start()
            # Also look back from next voter ID to exclude its serial number
            next_prefix = text[max(0, block_end - 50):block_end]
            serial_next = re.search(r"(\d+)\s*$", next_prefix)
            if serial_next:
                block_end = max(0, block_end - 50) + serial_next.start()
        else:
            block_end = min(match.end() + 500, len(text))

        block = text[match.start():block_end]

        voter = _extract_voter_from_block(block, voter_id, language)
        if voter and voter.get("name"):
            # Add serial number if found
            if serial_match:
                voter["serial_no"] = serial_match.group(1).strip()
            voters.append(voter)

    # Deduplicate by voter_no (OCR might pick up the same ID twice)
    seen_ids = set()
    unique_voters = []
    for v in voters:
        vid = v.get("voter_no", "")
        if vid and vid in seen_ids:
            continue
        if vid:
            seen_ids.add(vid)
        unique_voters.append(v)

    return unique_voters


def _extract_voter_from_block(block: str, voter_id: str, language: str) -> dict:
    """Extract voter details from a single voter card text block."""
    voter = {"voter_no": voter_id}

    # Extract Name
    name = _extract_field(block, NAME_PATTERN)
    if not name and language == "hi":
        name = _extract_field(block, NAME_PATTERN_HI)
    if not name and language == "bn":
        name = _extract_field(block, NAME_PATTERN_BN)

    if name:
        # Clean up common OCR artifacts
        name = _clean_name(name)
        voter["name"] = name

    # Extract Father's/Husband's/Mother's Name
    relation_name = _extract_field(block, FATHERS_NAME_PATTERN)
    relation_type = "father"
    if not relation_name:
        relation_name = _extract_field(block, HUSBANDS_NAME_PATTERN)
        relation_type = "husband"
    if not relation_name:
        relation_name = _extract_field(block, MOTHERS_NAME_PATTERN)
        relation_type = "mother"
    if not relation_name:
        relation_name = _extract_field(block, OTHERS_NAME_PATTERN)
        relation_type = "other"

    # Try Hindi/Bengali patterns
    if not relation_name and language == "hi":
        relation_name = _extract_field(block, RELATION_PATTERN_HI)
    if not relation_name and language == "bn":
        relation_name = _extract_field(block, RELATION_PATTERN_BN)

    if relation_name:
        relation_name = _clean_name(relation_name)
        voter["father_or_husband_name"] = relation_name
        voter["relation_type"] = relation_type

    # Extract Age
    age_match = AGE_PATTERN.search(block)
    if not age_match and language == "hi":
        age_match = AGE_PATTERN_HI.search(block)
    if not age_match and language == "bn":
        age_match = AGE_PATTERN_BN.search(block)

    if age_match:
        try:
            age = int(age_match.group(1))
            if 1 <= age <= 150:
                voter["age"] = age
        except ValueError:
            pass

    # Extract Gender
    gender_match = GENDER_PATTERN.search(block)
    if not gender_match and language == "hi":
        gender_match = GENDER_PATTERN_HI.search(block)
    if not gender_match and language == "bn":
        gender_match = GENDER_PATTERN_BN.search(block)

    if gender_match:
        raw = gender_match.group(1).strip()
        voter["gender"] = _normalize_gender(raw)

    # Extract House Number
    house_match = HOUSE_NUMBER_PATTERN.search(block)
    if house_match:
        house_no = house_match.group(1).strip()
        if house_no and house_no != ".":
            voter["house_number"] = house_no

    return voter


def _extract_field(text: str, pattern: re.Pattern) -> str | None:
    """Extract a field value using a regex pattern, returning cleaned text or None."""
    match = pattern.search(text)
    if match:
        value = match.group(1).strip()
        if value:
            return value
    return None


def _clean_name(name: str) -> str:
    """Clean up a name string from common OCR/PDF artifacts."""
    # Remove trailing "Photo", "Available", "House", etc.
    name = re.sub(
        r"\s*(?:Photo|Available|House\s*Number|Age|Gender|Fathers|Husbands|Mothers|Others).*$",
        "",
        name,
        flags=re.IGNORECASE,
    )
    # Remove leading/trailing whitespace and common punctuation artifacts
    name = name.strip(" \t\n\r.,;:")
    # Collapse multiple spaces
    name = re.sub(r"\s+", " ", name)
    return name


def _normalize_gender(raw: str) -> str:
    """Normalize gender string to standard form."""
    raw_upper = raw.upper().strip()
    if raw_upper in ("MALE", "M", "पुरुष", "পুরুষ"):
        return "Male"
    elif raw_upper in ("FEMALE", "F", "महिला", "মহিলা"):
        return "Female"
    elif raw_upper in ("THIRD GENDER",):
        return "Third Gender"
    return raw


def _parse_block_format(text: str, language: str) -> list[dict]:
    """Fallback: parse voter data from block format with labeled fields.

    Used when the electoral roll format parsing doesn't find results,
    e.g., for differently formatted voter lists.
    """
    voters = []

    # Split into blocks by empty lines or numbered entries
    blocks = re.split(r"\n\s*\n|\n(?=\d+\s*[.\)]\s)", text)

    for block in blocks:
        voter: dict = {}

        # Extract voter ID
        voter_id_match = VOTER_ID_PATTERN.search(block)
        if voter_id_match:
            voter["voter_no"] = voter_id_match.group(1)

        # Extract name
        name = _extract_field(block, NAME_PATTERN)
        if not name and language == "hi":
            name = _extract_field(block, NAME_PATTERN_HI)
        if not name and language == "bn":
            name = _extract_field(block, NAME_PATTERN_BN)
        if name:
            voter["name"] = _clean_name(name)

        # Extract relation name
        relation = _extract_field(block, FATHERS_NAME_PATTERN)
        if not relation:
            relation = _extract_field(block, HUSBANDS_NAME_PATTERN)
        if not relation:
            relation = _extract_field(block, MOTHERS_NAME_PATTERN)
        if not relation:
            relation = _extract_field(block, OTHERS_NAME_PATTERN)
        if not relation and language == "hi":
            relation = _extract_field(block, RELATION_PATTERN_HI)
        if not relation and language == "bn":
            relation = _extract_field(block, RELATION_PATTERN_BN)
        if relation:
            voter["father_or_husband_name"] = _clean_name(relation)

        # Extract gender
        gender_match = GENDER_PATTERN.search(block)
        if not gender_match and language == "hi":
            gender_match = GENDER_PATTERN_HI.search(block)
        if not gender_match and language == "bn":
            gender_match = GENDER_PATTERN_BN.search(block)
        if gender_match:
            voter["gender"] = _normalize_gender(gender_match.group(1))

        # Extract age
        age_match = AGE_PATTERN.search(block)
        if not age_match and language == "hi":
            age_match = AGE_PATTERN_HI.search(block)
        if not age_match and language == "bn":
            age_match = AGE_PATTERN_BN.search(block)
        if age_match:
            try:
                age = int(age_match.group(1))
                if 1 <= age <= 150:
                    voter["age"] = age
            except ValueError:
                pass

        if voter.get("name"):
            voters.append(voter)

    return voters
