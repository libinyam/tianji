#!/usr/bin/env python3
"""Unit tests for team_workspace.py."""

from __future__ import annotations

import json
import sys
from pathlib import Path

import pytest

# Add scripts directory to path so we can import the module
sys.path.insert(0, str(Path(__file__).parent.parent / "scripts"))
from team_workspace import (
    ROLE_DEFS,
    WORKSPACE_NAME,
    clean_workspace,
    format_status,
    get_workspace_status,
    init_workspace,
)


# ---------------------------------------------------------------------------
# ROLE_DEFS
# ---------------------------------------------------------------------------

class TestRoleDefs:
    """Verify the ROLE_DEFS constant has the expected shape and content."""

    EXPECTED_CODES = {"A", "B", "C", "D", "E", "F", "G"}

    def test_has_all_seven_roles(self):
        assert len(ROLE_DEFS) == 7

    def test_role_codes(self):
        assert set(ROLE_DEFS.keys()) == self.EXPECTED_CODES

    def test_each_role_has_name_and_label(self):
        for code, role in ROLE_DEFS.items():
            assert "name" in role, f"Role {code} missing 'name'"
            assert "label" in role, f"Role {code} missing 'label'"
            assert isinstance(role["name"], str)
            assert isinstance(role["label"], str)
            assert len(role["name"]) > 0
            assert len(role["label"]) > 0

    def test_role_a_planning(self):
        assert ROLE_DEFS["A"]["name"] == "planning"
        assert ROLE_DEFS["A"]["label"] == "Planning Analyst"

    def test_role_b_frontend(self):
        assert ROLE_DEFS["B"]["name"] == "frontend"
        assert ROLE_DEFS["B"]["label"] == "Frontend Engineer"

    def test_role_c_backend(self):
        assert ROLE_DEFS["C"]["name"] == "backend"
        assert ROLE_DEFS["C"]["label"] == "Backend Engineer"

    def test_role_d_testing(self):
        assert ROLE_DEFS["D"]["name"] == "testing"
        assert ROLE_DEFS["D"]["label"] == "Test Engineer"

    def test_role_e_code_review(self):
        assert ROLE_DEFS["E"]["name"] == "code-review"
        assert ROLE_DEFS["E"]["label"] == "Code Reviewer"

    def test_role_f_product(self):
        assert ROLE_DEFS["F"]["name"] == "product"
        assert ROLE_DEFS["F"]["label"] == "Product & Market"

    def test_role_g_security(self):
        assert ROLE_DEFS["G"]["name"] == "security"
        assert ROLE_DEFS["G"]["label"] == "Security & DevOps"

    def test_role_names_are_unique(self):
        names = [r["name"] for r in ROLE_DEFS.values()]
        assert len(names) == len(set(names))


# ---------------------------------------------------------------------------
# init_workspace
# ---------------------------------------------------------------------------

class TestInitWorkspace:
    """Tests for init_workspace directory creation and session metadata."""

    def test_returns_workspace_path(self, tmp_path):
        ws = init_workspace(tmp_path, "owner/repo")
        assert ws == tmp_path / WORKSPACE_NAME

    def test_creates_workspace_directory(self, tmp_path):
        ws = init_workspace(tmp_path, "owner/repo")
        assert ws.is_dir()

    def test_creates_context_directory(self, tmp_path):
        ws = init_workspace(tmp_path, "owner/repo")
        assert (ws / "_context").is_dir()

    def test_creates_mailbox_directory(self, tmp_path):
        ws = init_workspace(tmp_path, "owner/repo")
        assert (ws / "_mailbox").is_dir()

    def test_creates_synthesis_directory(self, tmp_path):
        ws = init_workspace(tmp_path, "owner/repo")
        assert (ws / "_synthesis").is_dir()

    def test_creates_role_directories(self, tmp_path):
        ws = init_workspace(tmp_path, "owner/repo")
        for code, role in ROLE_DEFS.items():
            role_dir = ws / f"role-{code.lower()}-{role['name']}"
            assert role_dir.is_dir(), f"Missing role directory: {role_dir}"

    def test_creates_all_seven_role_directories(self, tmp_path):
        ws = init_workspace(tmp_path, "owner/repo")
        role_dirs = [d for d in ws.iterdir() if d.is_dir() and d.name.startswith("role-")]
        assert len(role_dirs) == 7

    def test_session_json_exists(self, tmp_path):
        ws = init_workspace(tmp_path, "owner/repo")
        assert (ws / "_session.json").is_file()

    def test_session_json_is_valid(self, tmp_path):
        ws = init_workspace(tmp_path, "owner/repo")
        with open(ws / "_session.json", "r", encoding="utf-8") as f:
            session = json.load(f)
        assert isinstance(session, dict)

    def test_session_json_repo_field(self, tmp_path):
        ws = init_workspace(tmp_path, "my-org/my-repo")
        session = json.loads((ws / "_session.json").read_text(encoding="utf-8"))
        assert session["repo"] == "my-org/my-repo"

    def test_session_json_default_mode(self, tmp_path):
        ws = init_workspace(tmp_path, "owner/repo")
        session = json.loads((ws / "_session.json").read_text(encoding="utf-8"))
        assert session["mode"] == "parallel"

    def test_session_json_custom_mode(self, tmp_path):
        ws = init_workspace(tmp_path, "owner/repo", mode="sequential")
        session = json.loads((ws / "_session.json").read_text(encoding="utf-8"))
        assert session["mode"] == "sequential"

    def test_session_json_phase_initial(self, tmp_path):
        ws = init_workspace(tmp_path, "owner/repo")
        session = json.loads((ws / "_session.json").read_text(encoding="utf-8"))
        assert session["phase"] == "initial"

    def test_session_json_has_created_at(self, tmp_path):
        ws = init_workspace(tmp_path, "owner/repo")
        session = json.loads((ws / "_session.json").read_text(encoding="utf-8"))
        assert "created_at" in session
        assert isinstance(session["created_at"], str)
        assert len(session["created_at"]) > 0

    def test_session_json_escalation_count_zero(self, tmp_path):
        ws = init_workspace(tmp_path, "owner/repo")
        session = json.loads((ws / "_session.json").read_text(encoding="utf-8"))
        assert session["escalation_count"] == 0

    def test_session_json_request_count_zero(self, tmp_path):
        ws = init_workspace(tmp_path, "owner/repo")
        session = json.loads((ws / "_session.json").read_text(encoding="utf-8"))
        assert session["request_count"] == 0

    def test_session_json_roles_structure(self, tmp_path):
        ws = init_workspace(tmp_path, "owner/repo")
        session = json.loads((ws / "_session.json").read_text(encoding="utf-8"))
        roles = session["roles"]
        assert set(roles.keys()) == set(ROLE_DEFS.keys())
        for code, role in roles.items():
            assert role["name"] == ROLE_DEFS[code]["name"]
            assert role["label"] == ROLE_DEFS[code]["label"]
            assert role["status"] == "pending"
            assert role["applicable"] is True

    def test_mailbox_requests_json(self, tmp_path):
        ws = init_workspace(tmp_path, "owner/repo")
        path = ws / "_mailbox" / "requests.json"
        assert path.is_file()
        data = json.loads(path.read_text(encoding="utf-8"))
        assert data == {"requests": []}

    def test_mailbox_escalations_json(self, tmp_path):
        ws = init_workspace(tmp_path, "owner/repo")
        path = ws / "_mailbox" / "escalations.json"
        assert path.is_file()
        data = json.loads(path.read_text(encoding="utf-8"))
        assert data == {"escalations": []}

    def test_synthesis_scores_json(self, tmp_path):
        ws = init_workspace(tmp_path, "owner/repo")
        path = ws / "_synthesis" / "scores.json"
        assert path.is_file()
        data = json.loads(path.read_text(encoding="utf-8"))
        assert data == {"scores": {}}

    def test_synthesis_cross_findings_json(self, tmp_path):
        ws = init_workspace(tmp_path, "owner/repo")
        path = ws / "_synthesis" / "cross-findings.json"
        assert path.is_file()
        data = json.loads(path.read_text(encoding="utf-8"))
        assert data == {"findings": []}

    def test_duplicate_workspace_exits(self, tmp_path):
        """Calling init_workspace twice on the same base should sys.exit(1)."""
        init_workspace(tmp_path, "owner/repo")
        with pytest.raises(SystemExit) as exc_info:
            init_workspace(tmp_path, "owner/repo")
        assert exc_info.value.code == 1

    def test_context_file_copied(self, tmp_path):
        ctx = tmp_path / "my-context.json"
        ctx.write_text(json.dumps({"key": "value"}), encoding="utf-8")
        ws = init_workspace(tmp_path, "owner/repo", context_file=str(ctx))
        dest = ws / "_context" / "repo-context.json"
        assert dest.is_file()
        data = json.loads(dest.read_text(encoding="utf-8"))
        assert data == {"key": "value"}

    def test_context_file_missing_prints_warning(self, tmp_path, capsys):
        ws = init_workspace(tmp_path, "owner/repo", context_file="/no/such/file.json")
        dest = ws / "_context" / "repo-context.json"
        assert not dest.exists()
        captured = capsys.readouterr()
        assert "Warning" in captured.err
        assert "not found" in captured.err

    def test_context_file_none_no_copy(self, tmp_path):
        ws = init_workspace(tmp_path, "owner/repo", context_file=None)
        dest = ws / "_context" / "repo-context.json"
        assert not dest.exists()

    def test_accepts_string_base_dir(self, tmp_path):
        ws = init_workspace(str(tmp_path), "owner/repo")
        assert ws.is_dir()

    def test_accepts_path_base_dir(self, tmp_path):
        ws = init_workspace(tmp_path, "owner/repo")
        assert ws.is_dir()

    def test_nested_base_dir_creates_parents(self, tmp_path):
        """init_workspace should work even if base_dir needs parent creation."""
        nested = tmp_path / "deep" / "nested"
        nested.mkdir(parents=True)
        ws = init_workspace(nested, "owner/repo")
        assert ws.is_dir()
        assert (ws / "_session.json").is_file()


# ---------------------------------------------------------------------------
# get_workspace_status
# ---------------------------------------------------------------------------

class TestGetWorkspaceStatus:
    """Tests for reading session state from the workspace."""

    def test_reads_session_correctly(self, tmp_path):
        ws = init_workspace(tmp_path, "owner/repo", mode="sequential")
        status = get_workspace_status(ws)
        assert status["repo"] == "owner/repo"
        assert status["mode"] == "sequential"
        assert status["phase"] == "initial"
        assert status["escalation_count"] == 0
        assert status["request_count"] == 0
        assert "roles" in status
        assert "created_at" in status

    def test_returns_all_roles(self, tmp_path):
        ws = init_workspace(tmp_path, "owner/repo")
        status = get_workspace_status(ws)
        assert set(status["roles"].keys()) == set(ROLE_DEFS.keys())

    def test_missing_session_returns_error(self, tmp_path):
        ws = tmp_path / WORKSPACE_NAME
        ws.mkdir()
        status = get_workspace_status(ws)
        assert "error" in status
        assert "No session found" in status["error"]

    def test_missing_workspace_returns_error(self, tmp_path):
        ws = tmp_path / WORKSPACE_NAME
        # Do not create ws at all
        status = get_workspace_status(ws)
        assert "error" in status

    def test_status_matches_written_session(self, tmp_path):
        ws = init_workspace(tmp_path, "test-org/test-repo")
        raw = json.loads((ws / "_session.json").read_text(encoding="utf-8"))
        status = get_workspace_status(ws)
        assert raw == status


# ---------------------------------------------------------------------------
# format_status
# ---------------------------------------------------------------------------

class TestFormatStatus:
    """Tests for human-readable status formatting."""

    def _make_session(self, repo="owner/repo", mode="parallel", phase="initial"):
        """Build a minimal session dict for testing."""
        roles = {}
        for code, role in ROLE_DEFS.items():
            roles[code] = {
                "name": role["name"],
                "label": role["label"],
                "status": "pending",
                "applicable": True,
            }
        return {
            "repo": repo,
            "created_at": "2025-01-15T10:30:00+00:00",
            "phase": phase,
            "mode": mode,
            "roles": roles,
            "escalation_count": 0,
            "request_count": 0,
        }

    def test_error_dict_returns_error_message(self):
        result = format_status({"error": "something went wrong"})
        assert result == "something went wrong"

    def test_contains_repo_name(self):
        session = self._make_session(repo="facebook/react")
        output = format_status(session)
        assert "facebook/react" in output

    def test_contains_phase(self):
        session = self._make_session(phase="review")
        output = format_status(session)
        assert "Phase: review" in output

    def test_contains_mode(self):
        session = self._make_session(mode="sequential")
        output = format_status(session)
        assert "Mode: sequential" in output

    def test_contains_created_at(self):
        session = self._make_session()
        output = format_status(session)
        assert "Created: 2025-01-15T10:30:00+00:00" in output

    def test_contains_header(self):
        session = self._make_session(repo="owner/repo")
        output = format_status(session)
        assert "=== Team Status: owner/repo ===" in output

    def test_contains_roles_section(self):
        session = self._make_session()
        output = format_status(session)
        assert "Roles:" in output

    def test_lists_all_roles(self):
        session = self._make_session()
        output = format_status(session)
        for code, role in ROLE_DEFS.items():
            assert role["label"] in output
            assert code in output

    def test_shows_pending_status(self):
        session = self._make_session()
        output = format_status(session)
        assert "[pending]" in output

    def test_shows_completed_status(self):
        session = self._make_session()
        session["roles"]["A"]["status"] = "completed"
        output = format_status(session)
        assert "[completed]" in output

    def test_non_applicable_role_shows_na(self):
        session = self._make_session()
        session["roles"]["F"]["applicable"] = False
        output = format_status(session)
        assert "[N/A]" in output

    def test_applicable_role_no_na_suffix(self):
        session = self._make_session()
        output = format_status(session)
        assert "[N/A]" not in output

    def test_contains_escalation_count(self):
        session = self._make_session()
        session["escalation_count"] = 3
        output = format_status(session)
        assert "Escalations: 3" in output

    def test_contains_request_count(self):
        session = self._make_session()
        session["request_count"] = 7
        output = format_status(session)
        assert "Requests: 7" in output

    def test_roles_sorted_by_code(self):
        session = self._make_session()
        output = format_status(session)
        lines = output.split("\n")
        # Role lines are formatted as "  X Label ...  [status]"
        # (two leading spaces, then the single-letter code)
        role_lines = [
            l for l in lines
            if len(l) >= 3 and l.startswith("  ") and l[2] in ROLE_DEFS and l[3] == " "
        ]
        codes = [l[2] for l in role_lines]
        assert codes == sorted(codes)

    def test_missing_fields_use_unknown(self):
        """When session is missing fields, 'unknown' should be used."""
        output = format_status({})
        assert "unknown" in output

    def test_empty_roles_no_crash(self):
        session = {"repo": "x/y", "roles": {}, "phase": "done", "mode": "parallel",
                    "created_at": "now", "escalation_count": 0, "request_count": 0}
        output = format_status(session)
        assert "Roles:" in output
        assert "x/y" in output

    def test_integration_with_init(self, tmp_path):
        """Format the status of a freshly initialized workspace."""
        ws = init_workspace(tmp_path, "integration/test")
        session = get_workspace_status(ws)
        output = format_status(session)
        assert "integration/test" in output
        assert "Phase: initial" in output
        assert "Mode: parallel" in output
        assert "Escalations: 0" in output
        assert "Requests: 0" in output


# ---------------------------------------------------------------------------
# clean_workspace
# ---------------------------------------------------------------------------

class TestCleanWorkspace:
    """Tests for workspace removal."""

    def test_force_removes_workspace(self, tmp_path):
        init_workspace(tmp_path, "owner/repo")
        ws = tmp_path / WORKSPACE_NAME
        assert ws.is_dir()
        result = clean_workspace(tmp_path, force=True)
        assert result is True
        assert not ws.exists()

    def test_missing_workspace_returns_false(self, tmp_path):
        result = clean_workspace(tmp_path, force=True)
        assert result is False

    def test_missing_workspace_prints_message(self, tmp_path, capsys):
        clean_workspace(tmp_path, force=True)
        captured = capsys.readouterr()
        assert "No workspace to clean" in captured.err

    def test_force_true_skips_prompt(self, tmp_path):
        """With force=True, no input() call should happen."""
        init_workspace(tmp_path, "owner/repo")
        # If force were ignored, this would block on input()
        result = clean_workspace(tmp_path, force=True)
        assert result is True

    def test_force_false_decline(self, tmp_path, monkeypatch):
        """When user answers 'n', workspace should remain."""
        init_workspace(tmp_path, "owner/repo")
        ws = tmp_path / WORKSPACE_NAME
        monkeypatch.setattr("builtins.input", lambda _: "n")
        result = clean_workspace(tmp_path, force=False)
        assert result is False
        assert ws.is_dir()

    def test_force_false_confirm_yes(self, tmp_path, monkeypatch):
        """When user answers 'y', workspace should be removed."""
        init_workspace(tmp_path, "owner/repo")
        ws = tmp_path / WORKSPACE_NAME
        monkeypatch.setattr("builtins.input", lambda _: "y")
        result = clean_workspace(tmp_path, force=False)
        assert result is True
        assert not ws.exists()

    def test_force_false_confirm_yes_full(self, tmp_path, monkeypatch):
        """When user answers 'yes', workspace should be removed."""
        init_workspace(tmp_path, "owner/repo")
        monkeypatch.setattr("builtins.input", lambda _: "yes")
        result = clean_workspace(tmp_path, force=False)
        assert result is True

    def test_force_false_empty_input(self, tmp_path, monkeypatch):
        """Empty input should abort (not equal to 'y')."""
        init_workspace(tmp_path, "owner/repo")
        ws = tmp_path / WORKSPACE_NAME
        monkeypatch.setattr("builtins.input", lambda _: "")
        result = clean_workspace(tmp_path, force=False)
        assert result is False
        assert ws.is_dir()

    def test_force_false_abort_prints_message(self, tmp_path, monkeypatch, capsys):
        """Declining should print 'Aborted.'."""
        init_workspace(tmp_path, "owner/repo")
        monkeypatch.setattr("builtins.input", lambda _: "n")
        clean_workspace(tmp_path, force=False)
        captured = capsys.readouterr()
        assert "Aborted" in captured.err

    def test_force_removal_prints_confirmation(self, tmp_path, capsys):
        """Successful removal should print the workspace path."""
        init_workspace(tmp_path, "owner/repo")
        clean_workspace(tmp_path, force=True)
        captured = capsys.readouterr()
        assert "Workspace removed" in captured.err

    def test_accepts_string_base_dir(self, tmp_path):
        init_workspace(tmp_path, "owner/repo")
        result = clean_workspace(str(tmp_path), force=True)
        assert result is True

    def test_accepts_path_base_dir(self, tmp_path):
        init_workspace(tmp_path, "owner/repo")
        result = clean_workspace(tmp_path, force=True)
        assert result is True

    def test_removes_all_nested_content(self, tmp_path):
        """Ensure shutil.rmtree removes deeply nested role dirs and files."""
        ws = init_workspace(tmp_path, "owner/repo")
        # Verify there are files inside
        assert (ws / "_session.json").is_file()
        assert (ws / "_mailbox" / "requests.json").is_file()
        clean_workspace(tmp_path, force=True)
        assert not ws.exists()


# ---------------------------------------------------------------------------
# End-to-end workflow
# ---------------------------------------------------------------------------

class TestWorkflow:
    """Integration tests that exercise the full init -> status -> clean cycle."""

    def test_init_status_clean_cycle(self, tmp_path):
        ws = init_workspace(tmp_path, "cycle/repo", mode="sequential")
        assert ws.is_dir()

        status = get_workspace_status(ws)
        assert status["repo"] == "cycle/repo"
        assert status["mode"] == "sequential"

        output = format_status(status)
        assert "cycle/repo" in output
        assert "Mode: sequential" in output

        result = clean_workspace(tmp_path, force=True)
        assert result is True
        assert not ws.exists()

    def test_reinit_after_clean(self, tmp_path):
        """After cleaning, init should succeed again without error."""
        init_workspace(tmp_path, "first/repo")
        clean_workspace(tmp_path, force=True)
        ws = init_workspace(tmp_path, "second/repo")
        assert ws.is_dir()
        status = get_workspace_status(ws)
        assert status["repo"] == "second/repo"

    def test_init_with_context_then_status(self, tmp_path):
        ctx = tmp_path / "context.json"
        ctx.write_text(json.dumps({"description": "A test repo"}), encoding="utf-8")
        ws = init_workspace(tmp_path, "ctx/repo", context_file=str(ctx))

        assert (ws / "_context" / "repo-context.json").is_file()

        status = get_workspace_status(ws)
        assert status["repo"] == "ctx/repo"

        output = format_status(status)
        assert "ctx/repo" in output


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
