import re
import structlog

logger = structlog.get_logger()


def parse_voter_data(text: str, language: str = "en") -> list[dict]:
    """Parse voter records from extracted PDF text.

    Indian voter list PDFs typically contain blocks like:

    1  VOTER_NO
       Name: ...
       Father's/Husband's Name: ...
       Gender: Male/Female    Age: 45

    This parser uses regex to extract structured voter data from the text.
    """
    voters = []

    # Try table-style parsing first (common in voter lists)
    voters = _parse_tabular_format(text, language)
    if voters:
        logger.info("parsed_voter_data", format="tabular", count=len(voters), language=language)
        return voters

    # Fallback to block-style parsing
    voters = _parse_block_format(text, language)
    logger.info("parsed_voter_data", format="block", count=len(voters), language=language)
    return voters


def _parse_tabular_format(text: str, language: str) -> list[dict]:
    """Parse voter data from tabular format commonly found in Indian voter list PDFs.

    Typical pattern per voter entry:
    <serial_no>  <voter_id>
    <name>
    <father/husband name>
    <gender>  Age: <age>
    """
    voters = []

    # Pattern: voter serial/ID number, followed by name, relation, gender, age
    # Indian voter IDs follow the pattern: 3 letters + 7 digits (e.g., ABC1234567)
    voter_id_pattern = re.compile(r"[A-Z]{2,3}\d{6,7}")

    # Split text into lines for processing
    lines = text.split("\n")
    i = 0
    while i < len(lines):
        line = lines[i].strip()

        # Look for voter ID pattern
        match = voter_id_pattern.search(line)
        if match:
            voter_no = match.group(0)
            voter = {"voter_no": voter_no}

            # Look ahead for name, relation, gender, age in next few lines
            context_lines = []
            for j in range(i + 1, min(i + 6, len(lines))):
                context_lines.append(lines[j].strip())

            _extract_voter_details(voter, context_lines, language)

            if voter.get("name"):
                voters.append(voter)

        i += 1

    return voters


def _parse_block_format(text: str, language: str) -> list[dict]:
    """Parse voter data from block format with labeled fields."""
    voters = []

    # Common English field patterns
    name_patterns = [
        re.compile(r"(?:Name|नाम|নাম)\s*[:\-]\s*(.+)", re.IGNORECASE),
    ]
    relation_patterns = [
        re.compile(r"(?:Father'?s?\s*(?:/\s*)?Husband'?s?\s*Name|पिता/पति\s*का\s*नाम|পিতা/স্বামীর\s*নাম)\s*[:\-]\s*(.+)", re.IGNORECASE),
        re.compile(r"(?:Father'?s?\s*Name|पिता\s*का\s*नाम|পিতার\s*নাম)\s*[:\-]\s*(.+)", re.IGNORECASE),
        re.compile(r"(?:Husband'?s?\s*Name|पति\s*का\s*नाम|স্বামীর\s*নাম)\s*[:\-]\s*(.+)", re.IGNORECASE),
    ]
    gender_pattern = re.compile(r"(?:Sex|Gender|लिंग|লিঙ্গ)\s*[:\-]\s*(Male|Female|पुरुष|महिला|পুরুষ|মহিলা|M|F)", re.IGNORECASE)
    age_pattern = re.compile(r"(?:Age|आयु|বয়স)\s*[:\-]\s*(\d{1,3})", re.IGNORECASE)
    voter_no_pattern = re.compile(r"(?:Voter\s*(?:ID|No)|मतदाता\s*(?:पहचान|क्रमांक)|ভোটার\s*(?:নং|আইডি))\s*[:\-]?\s*([A-Z]{2,3}\d{6,7})", re.IGNORECASE)

    # Split into blocks by empty lines or numbered entries
    blocks = re.split(r"\n\s*\n|\n(?=\d+\s*[.\)]\s)", text)

    for block in blocks:
        voter: dict = {}

        # Extract voter number
        for pattern in [voter_no_pattern]:
            m = pattern.search(block)
            if m:
                voter["voter_no"] = m.group(1).strip()
                break

        # Also check for standalone voter ID pattern
        if "voter_no" not in voter:
            voter_id_match = re.search(r"[A-Z]{2,3}\d{6,7}", block)
            if voter_id_match:
                voter["voter_no"] = voter_id_match.group(0)

        # Extract name
        for pattern in name_patterns:
            m = pattern.search(block)
            if m:
                voter["name"] = m.group(1).strip()
                break

        # Extract father/husband name
        for pattern in relation_patterns:
            m = pattern.search(block)
            if m:
                voter["father_or_husband_name"] = m.group(1).strip()
                break

        # Extract gender
        m = gender_pattern.search(block)
        if m:
            raw_gender = m.group(1).strip().upper()
            if raw_gender in ("MALE", "M", "पुरुष", "পুরুষ"):
                voter["gender"] = "Male"
            elif raw_gender in ("FEMALE", "F", "महिला", "মহিলা"):
                voter["gender"] = "Female"
            else:
                voter["gender"] = raw_gender

        # Extract age
        m = age_pattern.search(block)
        if m:
            try:
                voter["age"] = int(m.group(1))
            except ValueError:
                pass

        if voter.get("name"):
            voters.append(voter)

    return voters


def _extract_voter_details(voter: dict, context_lines: list[str], language: str) -> None:
    """Extract voter details from context lines following a voter ID."""
    age_pattern = re.compile(r"(?:Age|आयु|বয়স)\s*[:\-]?\s*(\d{1,3})", re.IGNORECASE)
    gender_pattern = re.compile(r"(Male|Female|पुरुष|महिला|পুরুষ|মহিলা)", re.IGNORECASE)

    # First non-empty line is typically the name
    name_found = False
    for line in context_lines:
        if not line:
            continue

        if not name_found:
            # Skip lines that look like metadata
            if re.match(r"^\d+$", line) or re.match(r"^(Photo|फोटो|ছবি)", line, re.IGNORECASE):
                continue
            voter["name"] = line
            name_found = True
            continue

        # Second text line is typically father/husband name
        if "father_or_husband_name" not in voter and not age_pattern.search(line) and not gender_pattern.search(line):
            voter["father_or_husband_name"] = line
            continue

        # Look for gender
        gm = gender_pattern.search(line)
        if gm:
            raw = gm.group(1).upper()
            if raw in ("MALE", "पुरुष", "পুরুষ"):
                voter["gender"] = "Male"
            elif raw in ("FEMALE", "महिला", "মহিলা"):
                voter["gender"] = "Female"

        # Look for age
        am = age_pattern.search(line)
        if am:
            try:
                voter["age"] = int(am.group(1))
            except ValueError:
                pass
