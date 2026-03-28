"""Tests for textract_extractor: PDF page splitting, key matching, and FORMS parsing."""

import pymupdf
import pytest

from textract_extractor import (
    _split_pdf_to_pages,
    _match_key,
    _cluster_by_position,
    parse_page_forms,
)


# -------------------------
# Helpers
# -------------------------


def _make_pdf(num_pages: int) -> bytes:
    doc = pymupdf.open()
    for _ in range(num_pages):
        doc.new_page()
    pdf_bytes = doc.tobytes()
    doc.close()
    return pdf_bytes


def _make_textract_response(kv_pairs: list[dict], lines: list[dict] = None) -> dict:
    """Build a mock Textract AnalyzeDocument response with KEY_VALUE_SET blocks."""
    blocks = [{"BlockType": "PAGE", "Id": "page-0"}]
    block_id = 0

    for kv in kv_pairs:
        block_id += 1
        val_id = f"val-{block_id}"
        key_id = f"key-{block_id}"
        word_key_id = f"wkey-{block_id}"
        word_val_id = f"wval-{block_id}"

        # Word blocks
        blocks.append(
            {
                "BlockType": "WORD",
                "Id": word_key_id,
                "Text": kv["key"],
            }
        )
        blocks.append(
            {
                "BlockType": "WORD",
                "Id": word_val_id,
                "Text": kv["value"],
            }
        )

        # VALUE block
        blocks.append(
            {
                "BlockType": "KEY_VALUE_SET",
                "Id": val_id,
                "EntityTypes": ["VALUE"],
                "Geometry": {"BoundingBox": {"Top": kv["top"]}},
                "Relationships": [{"Type": "CHILD", "Ids": [word_val_id]}],
            }
        )

        # KEY block
        blocks.append(
            {
                "BlockType": "KEY_VALUE_SET",
                "Id": key_id,
                "EntityTypes": ["KEY"],
                "Geometry": {"BoundingBox": {"Top": kv["top"]}},
                "Relationships": [
                    {"Type": "VALUE", "Ids": [val_id]},
                    {"Type": "CHILD", "Ids": [word_key_id]},
                ],
            }
        )

    for line in lines or []:
        block_id += 1
        blocks.append(
            {
                "BlockType": "LINE",
                "Id": f"line-{block_id}",
                "Text": line["text"],
                "Geometry": {"BoundingBox": {"Top": line["top"]}},
            }
        )

    return {"Blocks": blocks}


# -------------------------
# PDF Page Splitting Tests
# -------------------------


class TestPdfPageSplitting:
    def test_single_page_no_split(self):
        pdf = _make_pdf(1)
        pages = _split_pdf_to_pages(pdf)
        assert len(pages) == 1

    def test_multi_page_split(self):
        pdf = _make_pdf(5)
        pages = _split_pdf_to_pages(pdf)
        assert len(pages) == 5
        for page_bytes in pages:
            doc = pymupdf.open(stream=page_bytes, filetype="pdf")
            assert len(doc) == 1
            doc.close()


# -------------------------
# Key Matching Tests
# -------------------------


class TestKeyMatching:
    def test_exact_matches(self):
        assert _match_key("Name") == ("name", None)
        assert _match_key("Age") == ("age", None)
        assert _match_key("Gender") == ("gender", None)

    def test_relation_keys(self):
        assert _match_key("Father's Name")[1] == "father"
        assert _match_key("Fathers Name")[1] == "father"
        assert _match_key("Husband's Name")[1] == "husband"
        assert _match_key("Husbands Name")[1] == "husband"
        assert _match_key("Mother's Name")[1] == "mother"
        assert _match_key("Others")[1] == "other"

    def test_with_colon(self):
        assert _match_key("Name:") == ("name", None)
        assert _match_key("Age:") == ("age", None)

    def test_house_number_variants(self):
        assert _match_key("House Number") == ("house_number", None)
        assert _match_key("House No") == ("house_number", None)
        assert _match_key("House No.") == ("house_number", None)

    def test_unknown_key(self):
        assert _match_key("Photo Available") is None
        assert _match_key("Assembly Constituency") is None


# -------------------------
# FORMS Parsing Tests
# -------------------------


class TestFormsParsing:
    def test_single_voter(self):
        response = _make_textract_response(
            kv_pairs=[
                {"key": "Name", "value": "Abdullah Molla", "top": 0.10},
                {"key": "Fathers Name", "value": "Lutfar Rahaman", "top": 0.12},
                {"key": "Age", "value": "63", "top": 0.14},
                {"key": "Gender", "value": "Male", "top": 0.14},
                {"key": "House Number", "value": "149", "top": 0.15},
            ],
            lines=[
                {"text": "ATR2678928", "top": 0.09},
                {"text": "1", "top": 0.09},
            ],
        )
        voters = parse_page_forms(response, page_num=1)
        assert len(voters) == 1
        v = voters[0]
        assert v["name"] == "Abdullah Molla"
        assert v["father_or_husband_name"] == "Lutfar Rahaman"
        assert v["relation_type"] == "father"
        assert v["age"] == 63
        assert v["gender"] == "Male"
        assert v["house_number"] == "149"
        assert v["epic_no"] == "ATR2678928"

    def test_two_voters_different_positions(self):
        response = _make_textract_response(
            kv_pairs=[
                {"key": "Name", "value": "Voter One", "top": 0.10},
                {"key": "Fathers Name", "value": "Father One", "top": 0.12},
                {"key": "Age", "value": "40", "top": 0.13},
                {"key": "Name", "value": "Voter Two", "top": 0.30},
                {"key": "Husbands Name", "value": "Husband Two", "top": 0.32},
                {"key": "Age", "value": "35", "top": 0.33},
            ],
            lines=[
                {"text": "ABC1234567", "top": 0.09},
                {"text": "DEF7654321", "top": 0.29},
            ],
        )
        voters = parse_page_forms(response, page_num=1)
        assert len(voters) == 2
        assert voters[0]["name"] == "Voter One"
        assert voters[0]["relation_type"] == "father"
        assert voters[1]["name"] == "Voter Two"
        assert voters[1]["relation_type"] == "husband"

    def test_voter_without_name_skipped(self):
        response = _make_textract_response(
            kv_pairs=[
                {"key": "Age", "value": "50", "top": 0.10},
                {"key": "Gender", "value": "Male", "top": 0.12},
            ],
        )
        voters = parse_page_forms(response, page_num=1)
        assert len(voters) == 0

    def test_empty_response(self):
        voters = parse_page_forms({"Blocks": []}, page_num=1)
        assert len(voters) == 0


# -------------------------
# Clustering Tests
# -------------------------


class TestClustering:
    def test_two_clusters(self):
        items = [
            {"key": "a", "value": "1", "top": 0.10},
            {"key": "b", "value": "2", "top": 0.12},
            {"key": "c", "value": "3", "top": 0.50},
            {"key": "d", "value": "4", "top": 0.52},
        ]
        clusters = _cluster_by_position(items, threshold=0.035)
        assert len(clusters) == 2
        assert len(clusters[0]) == 2
        assert len(clusters[1]) == 2

    def test_single_cluster(self):
        items = [
            {"key": "a", "value": "1", "top": 0.10},
            {"key": "b", "value": "2", "top": 0.12},
            {"key": "c", "value": "3", "top": 0.13},
        ]
        clusters = _cluster_by_position(items, threshold=0.035)
        assert len(clusters) == 1

    def test_empty_items(self):
        assert _cluster_by_position([], threshold=0.035) == []


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
