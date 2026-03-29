"""Tests for claude_extractor: PDF page splitting and LLM response parsing."""

import pymupdf
import pytest

from claude_extractor import (
    _split_pdf_to_pages,
    _parse_llm_response,
    _salvage_truncated_json,
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
# LLM Response Parsing Tests
# -------------------------


class TestParseLlmResponse:
    def test_valid_json_array(self):
        response = '[{"name": "Test Voter", "serial_no": 1, "voter_no": "1", "age": 30, "gender": "Male"}]'
        voters = _parse_llm_response(response, chunk_index=0)
        assert len(voters) == 1
        assert voters[0]["name"] == "Test Voter"
        assert voters[0]["serial_no"] == 1
        assert voters[0]["age"] == 30

    def test_strips_code_fences(self):
        response = '```json\n[{"name": "Test", "serial_no": 1, "voter_no": "1"}]\n```'
        voters = _parse_llm_response(response, chunk_index=0)
        assert len(voters) == 1
        assert voters[0]["name"] == "Test"

    def test_filters_phantom_entries(self):
        response = '[{"name": "Real Voter", "serial_no": 1, "voter_no": "1"}, {"name": "Phantom"}]'
        voters = _parse_llm_response(response, chunk_index=0)
        assert len(voters) == 1
        assert voters[0]["name"] == "Real Voter"

    def test_filters_entries_without_name(self):
        response = '[{"serial_no": 1, "voter_no": "1", "age": 30}]'
        voters = _parse_llm_response(response, chunk_index=0)
        assert len(voters) == 0

    def test_gender_normalization(self):
        response = '[{"name": "Test", "serial_no": 1, "voter_no": "1", "gender": "পুরুষ"}]'
        voters = _parse_llm_response(response, chunk_index=0)
        assert voters[0]["gender"] == "Male"

    def test_age_coercion(self):
        response = '[{"name": "Test", "serial_no": 1, "voter_no": "1", "age": "45"}]'
        voters = _parse_llm_response(response, chunk_index=0)
        assert voters[0]["age"] == 45

    def test_empty_array(self):
        voters = _parse_llm_response("[]", chunk_index=0)
        assert len(voters) == 0

    def test_non_array_response(self):
        voters = _parse_llm_response('{"error": "no data"}', chunk_index=0)
        assert len(voters) == 0

    def test_truncation_handling(self):
        response = '[{"name": "A", "serial_no": 1, "voter_no": "1"}, {"name": "B", "serial_no": 2, "voter_no": "2"}, {"name": "C", "serial_no":'
        voters = _parse_llm_response(response, chunk_index=0)
        assert len(voters) == 2

    def test_field_truncation(self):
        long_name = "A" * 300
        response = f'[{{"name": "{long_name}", "serial_no": 1, "voter_no": "1"}}]'
        voters = _parse_llm_response(response, chunk_index=0)
        assert len(voters[0]["name"]) == 255


class TestSalvageTruncatedJson:
    def test_salvages_two_complete_objects(self):
        text = '[{"name": "A", "age": 30}, {"name": "B", "age": 25}, {"name": "C"'
        result = _salvage_truncated_json(text, chunk_index=0)
        assert result is not None
        assert len(result) == 2

    def test_returns_none_for_garbage(self):
        result = _salvage_truncated_json("not json at all", chunk_index=0)
        assert result is None


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
