#!/usr/bin/env python3
"""Unit tests for team_synthesis.py, team_workspace.py, and team_findings.py."""

from __future__ import annotations

import json
import os
import sys
from pathlib import Path

import pytest

# Add scripts directory to path so we can import the modules
sys.path.insert(0, str(Path(__file__).parent.parent / "scripts"))

from team_workspace import init_workspace, WORKSPACE_NAME, ROLE_DEFS
from team_synthesis import (
    ROLE_DIR_MAP,
    ROLE_LABELS,
    compute_role_avg,
    load_all_findings,
    cmd_aggregate,
    cmd_scores,
    cmd_blockers,
    cmd_report_data,
    read_json,
    write_json,
)


# ---------------------------------------------------------------------------
# Helpers for building test fixtures
# ---------------------------------------------------------------------------

def _make_findings(
    scores: dict | None = None,
    findings: list | None = None,
    timestamp: str = "2025-01-01T00:00:00+00:00",
) -> dict:
    """Build a minimal findings dict."""
    return {
        "scores": scores or {},
        "findings": findings or [],
        "timestamp": timestamp,
    }


def _write_role_findings(ws: Path, role_code: str, data: dict) -> None:
    """Write findings.json directly into a role directory."""
    role_dir = ws / ROLE_DIR_MAP[role_code]
    role_dir.mkdir(parents=True, exist_ok=True)
    with open(role_dir / "findings.json", "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)


def _mark_role_na(ws: Path, role_code: str) -> None:
    """Mark a role as not-applicable in _session.json."""
    session_path = ws / "_session.json"
    session = read_json(session_path)
    session["roles"][role_code]["applicable"] = False
    session["roles"][role_code]["status"] = "skipped"
    write_json(session_path, session)


def _setup_workspace(tmp_path: Path, repo: str = "test/repo") -> Path:
    """Create a workspace via init_workspace and return its path."""
    return init_workspace(tmp_path, repo)


def _write_escalations(ws: Path, escalations: list) -> None:
    """Write escalation data to the mailbox."""
    esc_path = ws / "_mailbox" / "escalations.json"
    write_json(esc_path, {"escalations": escalations})


# ---------------------------------------------------------------------------
# compute_role_avg
# ---------------------------------------------------------------------------

class TestComputeRoleAvg:
    def test_plain_number_scores(self):
        """Scores as plain numeric values."""
        scores = {"dim1": 8, "dim2": 6, "dim3": 10}
        assert compute_role_avg(scores) == 8.0

    def test_dict_with_value_key(self):
        """Scores as dicts containing a 'value' key."""
        scores = {
            "dim1": {"value": 7, "evidence": "good docs"},
            "dim2": {"value": 9, "evidence": "great tests"},
        }
        assert compute_role_avg(scores) == 8.0

    def test_mixed_formats(self):
        """Mix of plain numbers and dicts with value key."""
        scores = {
            "dim1": 6,
            "dim2": {"value": 8, "evidence": "ok"},
            "dim3": 10,
        }
        assert compute_role_avg(scores) == 8.0

    def test_empty_scores(self):
        """Empty dict returns None."""
        assert compute_role_avg({}) is None

    def test_no_extractable_values(self):
        """Dict values that are dicts but lack a numeric 'value' key."""
        scores = {
            "dim1": {"evidence": "no value key"},
            "dim2": {"note": "also missing"},
        }
        assert compute_role_avg(scores) is None

    def test_none_value_in_dict(self):
        """Dict with value=None should be skipped."""
        scores = {
            "dim1": {"value": None, "evidence": "n/a"},
            "dim2": {"value": 8},
        }
        assert compute_role_avg(scores) == 8.0

    def test_string_value_in_dict_ignored(self):
        """Non-numeric value inside dict should be skipped."""
        scores = {
            "dim1": {"value": "high"},
            "dim2": {"value": 6},
        }
        assert compute_role_avg(scores) == 6.0

    def test_single_score(self):
        scores = {"dim1": 5}
        assert compute_role_avg(scores) == 5.0

    def test_float_scores(self):
        scores = {"dim1": 7.5, "dim2": 8.5}
        assert compute_role_avg(scores) == 8.0

    def test_mixed_valid_and_invalid(self):
        """Some plain numbers, some bad dicts, some strings."""
        scores = {
            "dim1": 10,
            "dim2": "bad",
            "dim3": {"value": 4},
            "dim4": {"no_value": True},
        }
        # Only dim1=10 and dim3=4 are valid
        assert compute_role_avg(scores) == 7.0

    def test_all_zeros(self):
        scores = {"dim1": 0, "dim2": 0, "dim3": 0}
        assert compute_role_avg(scores) == 0.0


# ---------------------------------------------------------------------------
# load_all_findings
# ---------------------------------------------------------------------------

class TestLoadAllFindings:
    def test_loads_all_roles_with_findings(self, tmp_path):
        ws = _setup_workspace(tmp_path)
        data_a = _make_findings(scores={"d1": 8})
        data_b = _make_findings(scores={"d1": 6})
        _write_role_findings(ws, "A", data_a)
        _write_role_findings(ws, "B", data_b)

        results = load_all_findings(ws)

        assert results["A"] is not None
        assert results["A"]["scores"]["d1"] == 8
        assert results["B"] is not None
        assert results["B"]["scores"]["d1"] == 6

    def test_returns_none_for_roles_without_findings(self, tmp_path):
        ws = _setup_workspace(tmp_path)
        _write_role_findings(ws, "A", _make_findings(scores={"d1": 8}))

        results = load_all_findings(ws)

        assert results["A"] is not None
        # All other roles should be None
        for code in ("B", "C", "D", "E", "F", "G"):
            assert results[code] is None

    def test_no_findings_at_all(self, tmp_path):
        ws = _setup_workspace(tmp_path)
        results = load_all_findings(ws)
        for code in ROLE_DIR_MAP:
            assert results[code] is None

    def test_all_roles_have_findings(self, tmp_path):
        ws = _setup_workspace(tmp_path)
        for code in ROLE_DIR_MAP:
            _write_role_findings(ws, code, _make_findings(scores={"d1": 5}))

        results = load_all_findings(ws)
        for code in ROLE_DIR_MAP:
            assert results[code] is not None

    def test_all_seven_role_codes_present(self, tmp_path):
        """load_all_findings always returns entries for all 7 roles."""
        ws = _setup_workspace(tmp_path)
        results = load_all_findings(ws)
        assert set(results.keys()) == set(ROLE_DIR_MAP.keys())


# ---------------------------------------------------------------------------
# cmd_aggregate
# ---------------------------------------------------------------------------

class TestCmdAggregate:
    def test_computes_per_role_averages(self, tmp_path):
        ws = _setup_workspace(tmp_path)
        _write_role_findings(ws, "A", _make_findings(
            scores={"d1": 8, "d2": 6},
            findings=[{"severity": "P1", "title": "minor"}],
        ))
        _write_role_findings(ws, "C", _make_findings(
            scores={"d1": 10, "d2": 10},
            findings=[],
        ))

        result = cmd_aggregate(ws)

        assert result["roles"]["A"]["avg_score"] == 7.0
        assert result["roles"]["C"]["avg_score"] == 10.0

    def test_computes_overall_average_excluding_na(self, tmp_path):
        ws = _setup_workspace(tmp_path)
        _write_role_findings(ws, "A", _make_findings(scores={"d1": 8}))
        _write_role_findings(ws, "B", _make_findings(scores={"d1": 6}))
        # Mark C as N/A — even if it has findings, it should be excluded
        _mark_role_na(ws, "C")
        _write_role_findings(ws, "C", _make_findings(scores={"d1": 2}))

        result = cmd_aggregate(ws)

        # Only A (8) and B (6) count → overall 7.0
        assert result["overall_avg"] == 7.0
        assert result["applicable_count"] == 2

    def test_writes_scores_json(self, tmp_path):
        ws = _setup_workspace(tmp_path)
        _write_role_findings(ws, "A", _make_findings(scores={"d1": 8}))

        cmd_aggregate(ws)

        scores_path = ws / "_synthesis" / "scores.json"
        assert scores_path.exists()
        data = read_json(scores_path)
        assert "roles" in data
        assert "overall_avg" in data

    def test_handles_missing_findings(self, tmp_path):
        """Roles without findings should have avg_score=None."""
        ws = _setup_workspace(tmp_path)
        _write_role_findings(ws, "A", _make_findings(scores={"d1": 8}))
        # Roles B-G have no findings

        result = cmd_aggregate(ws)

        assert result["roles"]["A"]["avg_score"] == 8.0
        for code in ("B", "C", "D", "E", "F", "G"):
            assert result["roles"][code]["avg_score"] is None

    def test_na_role_has_applicable_false(self, tmp_path):
        ws = _setup_workspace(tmp_path)
        _mark_role_na(ws, "F")

        result = cmd_aggregate(ws)

        assert result["roles"]["F"]["applicable"] is False
        assert result["roles"]["F"]["avg_score"] is None

    def test_overall_avg_none_when_no_applicable_scores(self, tmp_path):
        """If no applicable role has scores, overall_avg is None."""
        ws = _setup_workspace(tmp_path)
        # Mark all roles N/A
        for code in ROLE_DIR_MAP:
            _mark_role_na(ws, code)

        result = cmd_aggregate(ws)

        assert result["overall_avg"] is None
        assert result["applicable_count"] == 0

    def test_findings_count_and_p0_p1(self, tmp_path):
        ws = _setup_workspace(tmp_path)
        findings_list = [
            {"severity": "P0", "title": "critical"},
            {"severity": "P0", "title": "critical2"},
            {"severity": "P1", "title": "high"},
            {"severity": "P2", "title": "low"},
        ]
        _write_role_findings(ws, "A", _make_findings(
            scores={"d1": 8},
            findings=findings_list,
        ))

        result = cmd_aggregate(ws)

        assert result["roles"]["A"]["findings_count"] == 4
        assert result["roles"]["A"]["p0_count"] == 2
        assert result["roles"]["A"]["p1_count"] == 1

    def test_avg_score_rounded_to_one_decimal(self, tmp_path):
        ws = _setup_workspace(tmp_path)
        # 3 scores that produce a non-terminating decimal: (7+8+6)/3 = 7.0
        # Use (1+2+3)/3 = 2.0 — that's clean. Use (7+8)/3 → not possible with 2.
        # Let's use 3 scores: (7+8+6)/3 = 7.0. Try (1+2)/3 = 1.0.
        # Actually (5+6+7)/3 = 6.0. We need rounding: (5+6+8)/3 = 6.333...
        _write_role_findings(ws, "A", _make_findings(
            scores={"d1": 5, "d2": 6, "d3": 8},
        ))

        result = cmd_aggregate(ws)

        assert result["roles"]["A"]["avg_score"] == 6.3

    def test_dict_scores_with_value_key(self, tmp_path):
        """cmd_aggregate should handle dict-style scores via compute_role_avg."""
        ws = _setup_workspace(tmp_path)
        _write_role_findings(ws, "A", _make_findings(
            scores={
                "d1": {"value": 8, "evidence": "good"},
                "d2": {"value": 6, "evidence": "ok"},
            },
        ))

        result = cmd_aggregate(ws)

        assert result["roles"]["A"]["avg_score"] == 7.0


# ---------------------------------------------------------------------------
# cmd_scores
# ---------------------------------------------------------------------------

class TestCmdScores:
    def test_produces_markdown_table(self, tmp_path):
        ws = _setup_workspace(tmp_path)
        _write_role_findings(ws, "A", _make_findings(
            scores={"d1": {"value": 8, "evidence": "well documented"}},
        ))
        # Run aggregate first
        cmd_aggregate(ws)

        output = cmd_scores(ws)

        assert "| 维度 | 角色 | 评分 | 证据摘要 |" in output
        assert "|---|---|---:|---|" in output

    def test_shows_score_for_completed_role(self, tmp_path):
        ws = _setup_workspace(tmp_path)
        _write_role_findings(ws, "A", _make_findings(
            scores={"d1": {"value": 8, "evidence": "well documented"}},
        ))
        cmd_aggregate(ws)

        output = cmd_scores(ws)

        assert "Planning Analyst" in output
        assert "8.0/10" in output

    def test_shows_na_for_inapplicable_role(self, tmp_path):
        ws = _setup_workspace(tmp_path)
        _mark_role_na(ws, "F")
        cmd_aggregate(ws)

        output = cmd_scores(ws)

        assert "N/A" in output
        assert "不适用" in output

    def test_shows_pending_for_uncompleted_role(self, tmp_path):
        ws = _setup_workspace(tmp_path)
        # No findings written for any role
        cmd_aggregate(ws)

        output = cmd_scores(ws)

        # Roles with no findings and applicable=True show "—" / "未完成"
        assert "未完成" in output

    def test_includes_overall_average_line(self, tmp_path):
        ws = _setup_workspace(tmp_path)
        _write_role_findings(ws, "A", _make_findings(scores={"d1": 8}))
        _write_role_findings(ws, "B", _make_findings(scores={"d1": 6}))
        cmd_aggregate(ws)

        output = cmd_scores(ws)

        assert "综合均分" in output
        assert "7.0/10" in output

    def test_auto_aggregates_when_scores_missing(self, tmp_path):
        """cmd_scores auto-runs aggregate if scores.json doesn't exist."""
        ws = _setup_workspace(tmp_path)
        _write_role_findings(ws, "A", _make_findings(scores={"d1": 8}))

        # Remove the default scores.json written by init_workspace
        scores_path = ws / "_synthesis" / "scores.json"
        if scores_path.exists():
            scores_path.unlink()

        output = cmd_scores(ws)

        # Should have auto-aggregated and produced output
        assert scores_path.exists()
        assert "维度" in output

    def test_evidence_truncated_to_60_chars(self, tmp_path):
        ws = _setup_workspace(tmp_path)
        long_evidence = "A" * 100
        _write_role_findings(ws, "A", _make_findings(
            scores={"d1": {"value": 8, "evidence": long_evidence}},
        ))
        cmd_aggregate(ws)

        output = cmd_scores(ws)

        # The evidence in the table should be truncated to 60 chars
        assert "A" * 100 not in output
        assert "A" * 60 in output

    def test_roles_sorted_by_code(self, tmp_path):
        ws = _setup_workspace(tmp_path)
        _write_role_findings(ws, "C", _make_findings(scores={"d1": 8}))
        _write_role_findings(ws, "A", _make_findings(scores={"d1": 6}))
        cmd_aggregate(ws)

        output = cmd_scores(ws)
        lines = output.split("\n")

        # Find lines containing role labels
        role_lines = [l for l in lines if "Planning Analyst" in l or "Backend Engineer" in l]
        assert len(role_lines) == 2
        # Planning (A) should come before Backend (C)
        a_idx = next(i for i, l in enumerate(lines) if "Planning Analyst" in l)
        c_idx = next(i for i, l in enumerate(lines) if "Backend Engineer" in l)
        assert a_idx < c_idx


# ---------------------------------------------------------------------------
# cmd_blockers
# ---------------------------------------------------------------------------

class TestCmdBlockers:
    def test_collects_p0_findings(self, tmp_path):
        ws = _setup_workspace(tmp_path)
        _write_role_findings(ws, "A", _make_findings(
            findings=[
                {"severity": "P0", "id": "A-001", "title": "Critical bug",
                 "evidence": "crash on startup", "files": ["main.py"],
                 "recommendation": "fix it"},
                {"severity": "P1", "id": "A-002", "title": "High issue",
                 "evidence": "slow", "files": [], "recommendation": "optimize"},
            ],
        ))

        blockers = cmd_blockers(ws)

        assert len(blockers) == 1
        assert blockers[0]["finding_id"] == "A-001"
        assert blockers[0]["role"] == "A"
        assert blockers[0]["title"] == "Critical bug"

    def test_collects_p0_across_multiple_roles(self, tmp_path):
        ws = _setup_workspace(tmp_path)
        _write_role_findings(ws, "A", _make_findings(
            findings=[{"severity": "P0", "id": "A-001", "title": "A critical"}],
        ))
        _write_role_findings(ws, "C", _make_findings(
            findings=[{"severity": "P0", "id": "C-001", "title": "C critical"}],
        ))

        blockers = cmd_blockers(ws)

        assert len(blockers) == 2
        roles = {b["role"] for b in blockers}
        assert roles == {"A", "C"}

    def test_empty_when_no_p0(self, tmp_path):
        ws = _setup_workspace(tmp_path)
        _write_role_findings(ws, "A", _make_findings(
            findings=[
                {"severity": "P1", "id": "A-001", "title": "High"},
                {"severity": "P2", "id": "A-002", "title": "Medium"},
            ],
        ))

        blockers = cmd_blockers(ws)

        assert blockers == []

    def test_includes_escalation_resolutions(self, tmp_path):
        ws = _setup_workspace(tmp_path)
        _write_escalations(ws, [
            {
                "severity": "P0",
                "to_role": "A",
                "subject": "Security vulnerability",
                "resolution_summary": "Patched in v1.2",
                "resolution_finding_id": "ESC-001",
            },
        ])

        blockers = cmd_blockers(ws)

        # Should have the escalation entry
        esc_entries = [b for b in blockers if "[Escalation]" in b["title"]]
        assert len(esc_entries) == 1
        assert esc_entries[0]["evidence"] == "Patched in v1.2"
        assert esc_entries[0]["finding_id"] == "ESC-001"

    def test_escalation_without_resolution_ignored(self, tmp_path):
        ws = _setup_workspace(tmp_path)
        _write_escalations(ws, [
            {
                "severity": "P0",
                "to_role": "A",
                "subject": "Open issue",
                # No resolution_summary
            },
        ])

        blockers = cmd_blockers(ws)

        assert blockers == []

    def test_non_p0_escalation_ignored(self, tmp_path):
        ws = _setup_workspace(tmp_path)
        _write_escalations(ws, [
            {
                "severity": "P1",
                "to_role": "B",
                "subject": "Minor issue",
                "resolution_summary": "Fixed",
                "resolution_finding_id": "ESC-002",
            },
        ])

        blockers = cmd_blockers(ws)

        assert blockers == []

    def test_blockers_include_label(self, tmp_path):
        ws = _setup_workspace(tmp_path)
        _write_role_findings(ws, "G", _make_findings(
            findings=[{"severity": "P0", "id": "G-001", "title": "SQL injection"}],
        ))

        blockers = cmd_blockers(ws)

        assert len(blockers) == 1
        assert blockers[0]["label"] == "Security & DevOps"

    def test_combined_findings_and_escalations(self, tmp_path):
        """Blockers should include both direct P0 findings and escalation P0s."""
        ws = _setup_workspace(tmp_path)
        _write_role_findings(ws, "A", _make_findings(
            findings=[{"severity": "P0", "id": "A-001", "title": "Direct P0"}],
        ))
        _write_escalations(ws, [
            {
                "severity": "P0",
                "to_role": "C",
                "subject": "Escalated P0",
                "resolution_summary": "Resolved",
                "resolution_finding_id": "ESC-001",
            },
        ])

        blockers = cmd_blockers(ws)

        assert len(blockers) == 2


# ---------------------------------------------------------------------------
# cmd_report_data
# ---------------------------------------------------------------------------

class TestCmdReportData:
    def test_can_promote_high_scores_no_p0(self, tmp_path):
        """Overall avg >= 7 and no P0 → '可以推广'."""
        ws = _setup_workspace(tmp_path, repo="owner/good-repo")
        _write_role_findings(ws, "A", _make_findings(
            scores={"d1": 8, "d2": 9},
            findings=[{"severity": "P1", "title": "minor"}],
        ))
        _write_role_findings(ws, "B", _make_findings(
            scores={"d1": 7, "d2": 8},
        ))
        # Mark remaining roles as N/A to avoid diluting the average
        for code in ("C", "D", "E", "F", "G"):
            _mark_role_na(ws, code)

        # Remove stale placeholder so cmd_report_data auto-aggregates
        (ws / "_synthesis" / "scores.json").unlink()
        result = cmd_report_data(ws)

        assert result["decision"] == "可以推广"
        assert result["repo"] == "owner/good-repo"

    def test_not_promote_when_p0_exists(self, tmp_path):
        """Even with high scores, P0 → '暂不建议推广'."""
        ws = _setup_workspace(tmp_path)
        _write_role_findings(ws, "A", _make_findings(
            scores={"d1": 9, "d2": 10},
            findings=[{"severity": "P0", "id": "A-001", "title": "critical"}],
        ))
        for code in ("B", "C", "D", "E", "F", "G"):
            _mark_role_na(ws, code)

        (ws / "_synthesis" / "scores.json").unlink()
        result = cmd_report_data(ws)

        assert result["decision"] == "暂不建议推广"
        assert len(result["blockers"]) > 0

    def test_trial_promotion_mid_scores(self, tmp_path):
        """5 <= overall_avg < 7 and no P0 → '小范围试推广'."""
        ws = _setup_workspace(tmp_path)
        _write_role_findings(ws, "A", _make_findings(scores={"d1": 6}))
        _write_role_findings(ws, "B", _make_findings(scores={"d1": 5}))
        for code in ("C", "D", "E", "F", "G"):
            _mark_role_na(ws, code)

        (ws / "_synthesis" / "scores.json").unlink()
        result = cmd_report_data(ws)

        assert result["decision"] == "小范围试推广"

    def test_not_promote_low_scores(self, tmp_path):
        """Overall avg < 5 and no P0 → '暂不建议推广'."""
        ws = _setup_workspace(tmp_path)
        _write_role_findings(ws, "A", _make_findings(scores={"d1": 3}))
        _write_role_findings(ws, "B", _make_findings(scores={"d1": 2}))
        for code in ("C", "D", "E", "F", "G"):
            _mark_role_na(ws, code)

        (ws / "_synthesis" / "scores.json").unlink()
        result = cmd_report_data(ws)

        assert result["decision"] == "暂不建议推广"

    def test_includes_all_sections(self, tmp_path):
        """Verify the result dict has all expected top-level keys."""
        ws = _setup_workspace(tmp_path)
        _write_role_findings(ws, "A", _make_findings(scores={"d1": 8}))
        for code in ("B", "C", "D", "E", "F", "G"):
            _mark_role_na(ws, code)

        result = cmd_report_data(ws)

        expected_keys = {
            "repo", "decision", "scores", "blockers",
            "cross_findings", "escalations", "role_details", "overall_avg",
        }
        assert set(result.keys()) == expected_keys

    def test_role_details_for_applicable_role(self, tmp_path):
        ws = _setup_workspace(tmp_path)
        findings_data = _make_findings(
            scores={"d1": 8},
            findings=[{"severity": "P1", "title": "issue"}],
        )
        _write_role_findings(ws, "A", findings_data)
        for code in ("B", "C", "D", "E", "F", "G"):
            _mark_role_na(ws, code)

        result = cmd_report_data(ws)

        role_a = result["role_details"]["A"]
        assert role_a["applicable"] is True
        assert role_a["data"] is not None
        assert role_a["label"] == "Planning Analyst"

    def test_role_details_for_na_role(self, tmp_path):
        ws = _setup_workspace(tmp_path)
        _mark_role_na(ws, "F")
        _write_role_findings(ws, "A", _make_findings(scores={"d1": 8}))

        result = cmd_report_data(ws)

        role_f = result["role_details"]["F"]
        assert role_f["applicable"] is False

    def test_role_details_for_pending_role(self, tmp_path):
        """An applicable role with no findings should have data=None."""
        ws = _setup_workspace(tmp_path)
        _write_role_findings(ws, "A", _make_findings(scores={"d1": 8}))
        # B is applicable but has no findings

        result = cmd_report_data(ws)

        assert result["role_details"]["B"]["applicable"] is True
        assert result["role_details"]["B"]["data"] is None

    def test_includes_cross_findings(self, tmp_path):
        ws = _setup_workspace(tmp_path)
        _write_role_findings(ws, "A", _make_findings(scores={"d1": 8}))
        for code in ("B", "C", "D", "E", "F", "G"):
            _mark_role_na(ws, code)

        # Write cross-findings
        cross_path = ws / "_synthesis" / "cross-findings.json"
        write_json(cross_path, {"findings": [
            {"role": "A", "finding_id": "X-001", "title": "cross-role issue"},
        ]})

        result = cmd_report_data(ws)

        assert len(result["cross_findings"]) == 1
        assert result["cross_findings"][0]["finding_id"] == "X-001"

    def test_includes_escalations(self, tmp_path):
        ws = _setup_workspace(tmp_path)
        _write_role_findings(ws, "A", _make_findings(scores={"d1": 8}))
        for code in ("B", "C", "D", "E", "F", "G"):
            _mark_role_na(ws, code)

        _write_escalations(ws, [
            {"severity": "P1", "to_role": "A", "subject": "Question about arch"},
        ])

        result = cmd_report_data(ws)

        assert len(result["escalations"]) == 1

    def test_auto_aggregates_if_scores_missing(self, tmp_path):
        """cmd_report_data should auto-aggregate when scores.json is absent."""
        ws = _setup_workspace(tmp_path)
        _write_role_findings(ws, "A", _make_findings(scores={"d1": 8}))
        for code in ("B", "C", "D", "E", "F", "G"):
            _mark_role_na(ws, code)

        # Remove scores.json to force auto-aggregation
        scores_path = ws / "_synthesis" / "scores.json"
        if scores_path.exists():
            scores_path.unlink()

        result = cmd_report_data(ws)

        assert scores_path.exists()
        assert result["scores"] is not None

    def test_notes_included_in_role_details(self, tmp_path):
        ws = _setup_workspace(tmp_path)
        findings_data = _make_findings(scores={"d1": 8})
        _write_role_findings(ws, "A", findings_data)

        # Write a notes.md for role A
        notes_path = ws / ROLE_DIR_MAP["A"] / "notes.md"
        notes_path.write_text("# Notes\nSome observations.", encoding="utf-8")

        for code in ("B", "C", "D", "E", "F", "G"):
            _mark_role_na(ws, code)

        result = cmd_report_data(ws)

        assert result["role_details"]["A"]["notes"] is not None
        assert "Some observations" in result["role_details"]["A"]["notes"]

    def test_overall_avg_in_output(self, tmp_path):
        ws = _setup_workspace(tmp_path)
        _write_role_findings(ws, "A", _make_findings(scores={"d1": 8}))
        _write_role_findings(ws, "B", _make_findings(scores={"d1": 6}))
        for code in ("C", "D", "E", "F", "G"):
            _mark_role_na(ws, code)

        (ws / "_synthesis" / "scores.json").unlink()
        result = cmd_report_data(ws)

        assert result["overall_avg"] == 7.0

    def test_decision_boundary_exactly_7(self, tmp_path):
        """overall_avg == 7 should be '可以推广' (>= 7)."""
        ws = _setup_workspace(tmp_path)
        _write_role_findings(ws, "A", _make_findings(scores={"d1": 7}))
        for code in ("B", "C", "D", "E", "F", "G"):
            _mark_role_na(ws, code)

        (ws / "_synthesis" / "scores.json").unlink()
        result = cmd_report_data(ws)

        assert result["decision"] == "可以推广"

    def test_decision_boundary_exactly_5(self, tmp_path):
        """overall_avg == 5 should be '小范围试推广' (>= 5)."""
        ws = _setup_workspace(tmp_path)
        _write_role_findings(ws, "A", _make_findings(scores={"d1": 5}))
        for code in ("B", "C", "D", "E", "F", "G"):
            _mark_role_na(ws, code)

        (ws / "_synthesis" / "scores.json").unlink()
        result = cmd_report_data(ws)

        assert result["decision"] == "小范围试推广"

    def test_decision_boundary_below_5(self, tmp_path):
        """overall_avg == 4.9 should be '暂不建议推广'."""
        ws = _setup_workspace(tmp_path)
        # (4 + 5) / 2 = 4.5
        _write_role_findings(ws, "A", _make_findings(scores={"d1": 4}))
        _write_role_findings(ws, "B", _make_findings(scores={"d1": 5}))
        for code in ("C", "D", "E", "F", "G"):
            _mark_role_na(ws, code)

        (ws / "_synthesis" / "scores.json").unlink()
        result = cmd_report_data(ws)

        assert result["decision"] == "暂不建议推广"

    def test_no_applicable_roles_no_overall(self, tmp_path):
        """All roles N/A → overall_avg=None → '暂不建议推广'."""
        ws = _setup_workspace(tmp_path)
        for code in ROLE_DIR_MAP:
            _mark_role_na(ws, code)

        result = cmd_report_data(ws)

        assert result["overall_avg"] is None
        assert result["decision"] == "暂不建议推广"


# ---------------------------------------------------------------------------
# Integration: init_workspace structure
# ---------------------------------------------------------------------------

class TestInitWorkspace:
    def test_creates_all_role_directories(self, tmp_path):
        ws = init_workspace(tmp_path, "test/repo")
        for dirname in ROLE_DIR_MAP.values():
            assert (ws / dirname).is_dir()

    def test_creates_session_json(self, tmp_path):
        ws = init_workspace(tmp_path, "test/repo")
        session = read_json(ws / "_session.json")
        assert session["repo"] == "test/repo"
        assert session["mode"] == "parallel"
        assert len(session["roles"]) == 7

    def test_creates_synthesis_directory(self, tmp_path):
        ws = init_workspace(tmp_path, "test/repo")
        assert (ws / "_synthesis").is_dir()
        assert (ws / "_synthesis" / "scores.json").exists()
        assert (ws / "_synthesis" / "cross-findings.json").exists()

    def test_creates_mailbox_directory(self, tmp_path):
        ws = init_workspace(tmp_path, "test/repo")
        assert (ws / "_mailbox").is_dir()
        assert (ws / "_mailbox" / "requests.json").exists()
        assert (ws / "_mailbox" / "escalations.json").exists()


# ---------------------------------------------------------------------------
# End-to-end flow: init → write findings → aggregate → scores → blockers
# ---------------------------------------------------------------------------

class TestEndToEnd:
    def test_full_workflow_no_blockers(self, tmp_path):
        ws = _setup_workspace(tmp_path, repo="acme/widget")

        # Write findings for two roles, mark others N/A
        _write_role_findings(ws, "A", _make_findings(
            scores={"arch": 8, "docs": 7},
            findings=[{"severity": "P2", "title": "minor typo"}],
        ))
        _write_role_findings(ws, "B", _make_findings(
            scores={"ui": 9, "a11y": 8},
            findings=[],
        ))
        for code in ("C", "D", "E", "F", "G"):
            _mark_role_na(ws, code)

        # Aggregate
        agg = cmd_aggregate(ws)
        assert agg["overall_avg"] == 8.0
        assert agg["applicable_count"] == 2

        # Scores table
        table = cmd_scores(ws)
        assert "8.0/10" in table  # Role A avg
        assert "8.5/10" in table  # Role B avg
        assert "综合均分" in table

        # Blockers (no P0)
        blockers = cmd_blockers(ws)
        assert blockers == []

        # Report data
        report = cmd_report_data(ws)
        assert report["decision"] == "可以推广"
        assert report["repo"] == "acme/widget"
        assert report["overall_avg"] == 8.0

    def test_full_workflow_with_blockers(self, tmp_path):
        ws = _setup_workspace(tmp_path, repo="acme/risky")

        _write_role_findings(ws, "A", _make_findings(
            scores={"arch": 9, "docs": 8},
            findings=[
                {"severity": "P0", "id": "A-001", "title": "No auth",
                 "evidence": "missing auth middleware", "files": ["server.py"],
                 "recommendation": "Add authentication"},
            ],
        ))
        _write_role_findings(ws, "G", _make_findings(
            scores={"sec": 3, "infra": 4},
            findings=[
                {"severity": "P0", "id": "G-001", "title": "SQL injection",
                 "evidence": "raw SQL in handler", "files": ["db.py"],
                 "recommendation": "Use parameterized queries"},
                {"severity": "P1", "id": "G-002", "title": "No HTTPS redirect"},
            ],
        ))
        for code in ("B", "C", "D", "E", "F"):
            _mark_role_na(ws, code)

        agg = cmd_aggregate(ws)
        blockers = cmd_blockers(ws)
        assert len(blockers) == 2

        report = cmd_report_data(ws)
        assert report["decision"] == "暂不建议推广"
        assert len(report["blockers"]) == 2


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
