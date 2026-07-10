#!/usr/bin/env python3
"""Unit tests for team_findings.py commands."""

from __future__ import annotations

import json
import sys
from pathlib import Path

import pytest

# Add scripts directory to path so we can import the modules
sys.path.insert(0, str(Path(__file__).parent.parent / "scripts"))
from team_workspace import init_workspace, WORKSPACE_NAME
from team_findings import (
    cmd_write,
    cmd_read,
    cmd_summary,
    cmd_mark_na,
    read_session,
    read_json,
    resolve_workspace,
    ROLE_DIR_MAP,
)


@pytest.fixture
def ws(tmp_path):
    """Create a fresh workspace and return its Path."""
    return init_workspace(tmp_path, "owner/test-repo")


@pytest.fixture
def base_dir(tmp_path, ws):
    """Return the base directory (parent of workspace)."""
    return tmp_path


def _write_findings(path: Path, data: dict) -> Path:
    """Helper to dump a findings dict to a JSON file."""
    with open(path, "w", encoding="utf-8") as f:
        json.dump(data, f)
    return path


SAMPLE_FINDINGS = {
    "scores": {"code_quality": {"value": 8}, "docs": {"value": 6}},
    "findings": [
        {
            "id": "F001",
            "severity": "P0",
            "title": "Critical bug",
            "evidence": "stack trace in logs",
            "files": ["src/main.py"],
            "recommendation": "Fix the null check",
        },
        {
            "id": "F002",
            "severity": "P1",
            "title": "Missing tests",
            "evidence": "coverage 40%",
            "files": ["src/utils.py"],
            "recommendation": "Add unit tests",
        },
        {
            "id": "F003",
            "severity": "P2",
            "title": "Minor style issue",
            "evidence": "inconsistent naming",
            "files": [],
            "recommendation": "Run linter",
        },
    ],
}

FINDINGS_NO_HIGH_SEVERITY = {
    "scores": {"perf": {"value": 9}},
    "findings": [
        {"id": "F100", "severity": "P2", "title": "Slow query", "evidence": "", "files": [], "recommendation": ""},
        {"id": "F101", "severity": "P3", "title": "Old dep", "evidence": "", "files": [], "recommendation": ""},
    ],
}


# ---------------------------------------------------------------------------
# cmd_write
# ---------------------------------------------------------------------------

class TestCmdWrite:
    def test_writes_findings_json(self, ws, tmp_path):
        ffile = _write_findings(tmp_path / "f.json", SAMPLE_FINDINGS)
        cmd_write(ws, "A", str(ffile))
        out = read_json(ws / ROLE_DIR_MAP["A"] / "findings.json")
        assert out["role"] == "A"
        assert out["label"] == "Planning Analyst"
        assert "timestamp" in out
        assert len(out["findings"]) == 3

    def test_updates_session_status_to_completed(self, ws, tmp_path):
        ffile = _write_findings(tmp_path / "f.json", SAMPLE_FINDINGS)
        cmd_write(ws, "B", str(ffile))
        session = read_session(ws)
        assert session["roles"]["B"]["status"] == "completed"

    def test_appends_p0_p1_to_cross_findings(self, ws, tmp_path):
        ffile = _write_findings(tmp_path / "f.json", SAMPLE_FINDINGS)
        cmd_write(ws, "C", str(ffile))
        cross = read_json(ws / "_synthesis" / "cross-findings.json")
        severities = [f["severity"] for f in cross["findings"]]
        assert "P0" in severities
        assert "P1" in severities
        assert "P2" not in severities

    def test_cross_findings_role_field(self, ws, tmp_path):
        ffile = _write_findings(tmp_path / "f.json", SAMPLE_FINDINGS)
        cmd_write(ws, "D", str(ffile))
        cross = read_json(ws / "_synthesis" / "cross-findings.json")
        assert all(f["role"] == "D" for f in cross["findings"])

    def test_no_p0_p1_means_empty_cross(self, ws, tmp_path):
        ffile = _write_findings(tmp_path / "f.json", FINDINGS_NO_HIGH_SEVERITY)
        cmd_write(ws, "E", str(ffile))
        cross = read_json(ws / "_synthesis" / "cross-findings.json")
        assert cross["findings"] == []

    def test_invalid_findings_file_exits(self, ws, tmp_path):
        with pytest.raises(SystemExit):
            cmd_write(ws, "A", str(tmp_path / "nonexistent.json"))

    def test_findings_not_dict_exits(self, ws, tmp_path):
        ffile = tmp_path / "bad.json"
        ffile.write_text("[1,2,3]")
        with pytest.raises(SystemExit):
            cmd_write(ws, "A", str(ffile))

    def test_notes_from_file(self, ws, tmp_path):
        ffile = _write_findings(tmp_path / "f.json", SAMPLE_FINDINGS)
        notes_file = tmp_path / "notes.md"
        notes_file.write_text("# My Notes\nSome content", encoding="utf-8")
        cmd_write(ws, "A", str(ffile), notes=str(notes_file))
        notes_out = (ws / ROLE_DIR_MAP["A"] / "notes.md").read_text(encoding="utf-8")
        assert "My Notes" in notes_out

    def test_notes_inline_text(self, ws, tmp_path):
        ffile = _write_findings(tmp_path / "f.json", SAMPLE_FINDINGS)
        cmd_write(ws, "F", str(ffile), notes="inline note text")
        notes_out = (ws / ROLE_DIR_MAP["F"] / "notes.md").read_text(encoding="utf-8")
        assert notes_out == "inline note text"

    def test_return_value(self, ws, tmp_path):
        ffile = _write_findings(tmp_path / "f.json", SAMPLE_FINDINGS)
        result = cmd_write(ws, "A", str(ffile))
        assert result["role"] == "A"
        assert result["status"] == "written"
        assert result["findings_count"] == 3
        assert result["scores_count"] == 2

    def test_case_insensitive_role(self, ws, tmp_path):
        ffile = _write_findings(tmp_path / "f.json", SAMPLE_FINDINGS)
        result = cmd_write(ws, "a", str(ffile))
        assert result["role"] == "A"


    def test_accepts_utf8_bom_findings_file(self, ws, tmp_path):
        ffile = tmp_path / "bom-findings.json"
        payload = json.dumps(SAMPLE_FINDINGS)
        ffile.write_text(payload, encoding="utf-8-sig")
        result = cmd_write(ws, "A", str(ffile))
        assert result["role"] == "A"
        assert result["findings_count"] == 3

    def test_invalid_json_exits_cleanly(self, ws, tmp_path):
        ffile = tmp_path / "bad.json"
        ffile.write_text("{bad json", encoding="utf-8")
        with pytest.raises(SystemExit):
            cmd_write(ws, "A", str(ffile))

# ---------------------------------------------------------------------------
# cmd_read
# ---------------------------------------------------------------------------

class TestCmdRead:
    def test_read_single_role_with_findings(self, ws, tmp_path):
        ffile = _write_findings(tmp_path / "f.json", SAMPLE_FINDINGS)
        cmd_write(ws, "A", str(ffile))
        data = cmd_read(ws, "A")
        assert data["role"] == "A"
        assert len(data["findings"]) == 3

    def test_read_role_with_no_findings(self, ws):
        data = cmd_read(ws, "B")
        assert data["role"] == "B"
        assert data["findings"] is None

    def test_read_all_roles(self, ws, tmp_path):
        ffile = _write_findings(tmp_path / "f.json", SAMPLE_FINDINGS)
        cmd_write(ws, "A", str(ffile))
        results = cmd_read(ws, "all")
        assert "A" in results
        assert results["A"] is not None
        # Other roles have no findings yet
        assert results["B"] is None

    def test_read_all_case_insensitive(self, ws, tmp_path):
        ffile = _write_findings(tmp_path / "f.json", SAMPLE_FINDINGS)
        cmd_write(ws, "C", str(ffile))
        results = cmd_read(ws, "ALL")
        assert results["C"] is not None


# ---------------------------------------------------------------------------
# cmd_summary
# ---------------------------------------------------------------------------

class TestCmdSummary:
    def test_summary_contains_repo_name(self, ws):
        output = cmd_summary(ws)
        assert "owner/test-repo" in output

    def test_summary_with_findings(self, ws, tmp_path):
        ffile = _write_findings(tmp_path / "f.json", SAMPLE_FINDINGS)
        cmd_write(ws, "A", str(ffile))
        output = cmd_summary(ws)
        assert "Planning Analyst" in output
        assert "completed" in output
        assert "3 findings" in output
        assert "1 P0" in output
        assert "1 P1" in output

    def test_summary_shows_avg_score(self, ws, tmp_path):
        ffile = _write_findings(tmp_path / "f.json", SAMPLE_FINDINGS)
        cmd_write(ws, "A", str(ffile))
        output = cmd_summary(ws)
        # scores: 8 and 6 -> avg 7.0
        assert "7.0/10" in output

    def test_summary_pending_role(self, ws):
        output = cmd_summary(ws)
        assert "pending" in output

    def test_summary_na_role(self, ws):
        cmd_mark_na(ws, "G")
        output = cmd_summary(ws)
        assert "N/A" in output


# ---------------------------------------------------------------------------
# cmd_mark_na
# ---------------------------------------------------------------------------

class TestCmdMarkNa:
    def test_sets_status_to_skipped(self, ws):
        cmd_mark_na(ws, "D")
        session = read_session(ws)
        assert session["roles"]["D"]["status"] == "skipped"

    def test_sets_applicable_false(self, ws):
        cmd_mark_na(ws, "D")
        session = read_session(ws)
        assert session["roles"]["D"]["applicable"] is False

    def test_return_value(self, ws):
        result = cmd_mark_na(ws, "E")
        assert result == {"role": "E", "status": "marked_na"}

    def test_case_insensitive(self, ws):
        result = cmd_mark_na(ws, "f")
        assert result["role"] == "F"
        session = read_session(ws)
        assert session["roles"]["F"]["applicable"] is False


# ---------------------------------------------------------------------------
# resolve_workspace
# ---------------------------------------------------------------------------

class TestResolveWorkspace:
    def test_valid_workspace(self, ws, base_dir):
        resolved = resolve_workspace(str(base_dir))
        assert resolved == ws

    def test_missing_workspace_exits(self, tmp_path):
        with pytest.raises(SystemExit):
            resolve_workspace(str(tmp_path))


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
