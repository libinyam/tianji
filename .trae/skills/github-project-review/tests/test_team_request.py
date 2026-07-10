#!/usr/bin/env python3
"""Unit tests for team_request.py commands."""

from __future__ import annotations

import json
import sys
from pathlib import Path

import pytest

# Add scripts directory to path so we can import the modules
sys.path.insert(0, str(Path(__file__).parent.parent / "scripts"))
from team_request import (
    VALID_PRIORITIES,
    VALID_ROLES,
    VALID_TYPES,
    cmd_list,
    cmd_pending_count,
    cmd_resolve,
    cmd_send,
    read_json,
    read_session,
)
from team_workspace import init_workspace


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _setup_ws(tmp_path: Path, repo: str = "test/repo") -> Path:
    """Create a fresh workspace and return the workspace path."""
    return init_workspace(tmp_path, repo)


def _read_requests(ws: Path) -> list[dict]:
    return read_json(ws / "_mailbox" / "requests.json")["requests"]


def _read_escalations(ws: Path) -> list[dict]:
    return read_json(ws / "_mailbox" / "escalations.json")["escalations"]


# ---------------------------------------------------------------------------
# cmd_send
# ---------------------------------------------------------------------------

class TestCmdSend:
    def test_send_regular_request(self, tmp_path, capsys):
        ws = _setup_ws(tmp_path)
        result = cmd_send(ws, "A", "B", "task", "P1", "Fix login bug")

        assert result["id"] == "REQ-001"
        assert result["status"] == "sent"
        assert result["type"] == "task"

        reqs = _read_requests(ws)
        assert len(reqs) == 1
        assert reqs[0]["id"] == "REQ-001"
        assert reqs[0]["from_role"] == "A"
        assert reqs[0]["to_role"] == "B"
        assert reqs[0]["type"] == "task"
        assert reqs[0]["priority"] == "P1"
        assert reqs[0]["subject"] == "Fix login bug"
        assert reqs[0]["status"] == "pending"
        assert reqs[0]["resolved_at"] is None
        assert reqs[0]["resolution"] is None

    def test_send_escalation_writes_both_files(self, tmp_path):
        ws = _setup_ws(tmp_path)
        result = cmd_send(ws, "D", "A", "escalation", "P0", "Critical security issue")

        # The return value uses the ESC- ID (mutated in memory after writing)
        assert result["id"] == "ESC-001"
        assert result["type"] == "escalation"

        # In requests.json the entry also uses ESC-xxx ID (consistent with escalations.json).
        reqs = _read_requests(ws)
        assert len(reqs) == 1
        assert reqs[0]["id"] == "ESC-001"
        assert reqs[0]["type"] == "escalation"

        # In escalations.json the entry has the ESC-xxx ID.
        escs = _read_escalations(ws)
        assert len(escs) == 1
        assert escs[0]["id"] == "ESC-001"
        assert escs[0]["from_role"] == "D"
        assert escs[0]["to_role"] == "A"
        assert escs[0]["severity"] == "P0"
        assert escs[0]["subject"] == "Critical security issue"
        assert escs[0]["status"] == "pending"
        assert escs[0]["resolved_at"] is None
        assert escs[0]["resolution_finding_id"] is None
        assert escs[0]["resolution_summary"] is None

    def test_auto_generates_sequential_request_ids(self, tmp_path):
        ws = _setup_ws(tmp_path)
        r1 = cmd_send(ws, "A", "B", "task", "P1", "First")
        r2 = cmd_send(ws, "A", "C", "task", "P2", "Second")
        r3 = cmd_send(ws, "B", "D", "info", "P1", "Third")

        assert r1["id"] == "REQ-001"
        assert r2["id"] == "REQ-002"
        assert r3["id"] == "REQ-003"

        reqs = _read_requests(ws)
        assert len(reqs) == 3
        assert [r["id"] for r in reqs] == ["REQ-001", "REQ-002", "REQ-003"]

    def test_auto_generates_sequential_escalation_ids(self, tmp_path):
        ws = _setup_ws(tmp_path)
        e1 = cmd_send(ws, "D", "A", "escalation", "P0", "First esc")
        e2 = cmd_send(ws, "E", "A", "escalation", "P1", "Second esc")

        assert e1["id"] == "ESC-001"
        assert e2["id"] == "ESC-002"

        escs = _read_escalations(ws)
        assert len(escs) == 2
        assert [e["id"] for e in escs] == ["ESC-001", "ESC-002"]

    def test_role_codes_case_insensitive(self, tmp_path):
        ws = _setup_ws(tmp_path)
        result = cmd_send(ws, "a", "b", "task", "P1", "Lowercase roles")

        reqs = _read_requests(ws)
        assert reqs[0]["from_role"] == "A"
        assert reqs[0]["to_role"] == "B"

    def test_invalid_from_role_exits(self, tmp_path):
        ws = _setup_ws(tmp_path)
        with pytest.raises(SystemExit):
            cmd_send(ws, "Z", "B", "task", "P1", "Bad from role")

    def test_invalid_to_role_exits(self, tmp_path):
        ws = _setup_ws(tmp_path)
        with pytest.raises(SystemExit):
            cmd_send(ws, "A", "X", "task", "P1", "Bad to role")

    def test_invalid_type_exits(self, tmp_path):
        ws = _setup_ws(tmp_path)
        with pytest.raises(SystemExit):
            cmd_send(ws, "A", "B", "bug", "P1", "Bad type")

    def test_invalid_priority_exits(self, tmp_path):
        ws = _setup_ws(tmp_path)
        with pytest.raises(SystemExit):
            cmd_send(ws, "A", "B", "task", "P9", "Bad priority")

    def test_session_counters_updated_for_request(self, tmp_path):
        ws = _setup_ws(tmp_path)
        cmd_send(ws, "A", "B", "task", "P1", "First")
        cmd_send(ws, "A", "C", "info", "P2", "Second")

        session = read_session(ws)
        assert session["request_count"] == 2
        assert session["escalation_count"] == 0

    def test_session_counters_updated_for_escalation(self, tmp_path):
        ws = _setup_ws(tmp_path)
        cmd_send(ws, "A", "B", "task", "P1", "Regular")
        cmd_send(ws, "D", "A", "escalation", "P0", "Escalation")

        session = read_session(ws)
        # Both regular requests and escalations increment request_count
        assert session["request_count"] == 2
        assert session["escalation_count"] == 1

    def test_json_context_parsed(self, tmp_path):
        ws = _setup_ws(tmp_path)
        ctx = json.dumps({"finding_id": "F-001", "detail": "missing auth"})
        cmd_send(ws, "E", "C", "task", "P1", "Fix auth", context=ctx)

        reqs = _read_requests(ws)
        assert reqs[0]["context"] == {"finding_id": "F-001", "detail": "missing auth"}

    def test_plain_text_context_wrapped(self, tmp_path):
        ws = _setup_ws(tmp_path)
        cmd_send(ws, "A", "B", "task", "P1", "Some task", context="Just a plain description")

        reqs = _read_requests(ws)
        assert reqs[0]["context"] == {"description": "Just a plain description"}

    def test_no_context_is_none(self, tmp_path):
        ws = _setup_ws(tmp_path)
        cmd_send(ws, "A", "B", "task", "P1", "No context")

        reqs = _read_requests(ws)
        assert reqs[0]["context"] is None

    def test_escalation_context_finding_id_propagated(self, tmp_path):
        ws = _setup_ws(tmp_path)
        ctx = json.dumps({"finding_id": "F-042", "severity": "high"})
        cmd_send(ws, "E", "A", "escalation", "P0", "Security finding", context=ctx)

        escs = _read_escalations(ws)
        assert escs[0]["trigger_finding_id"] == "F-042"
        assert escs[0]["context"] == {"finding_id": "F-042", "severity": "high"}

    def test_escalation_without_context_trigger_finding_id_empty(self, tmp_path):
        ws = _setup_ws(tmp_path)
        cmd_send(ws, "D", "A", "escalation", "P0", "No ctx escalation")

        escs = _read_escalations(ws)
        assert escs[0]["trigger_finding_id"] == ""
        assert escs[0]["context"] is None

    def test_created_at_is_set(self, tmp_path):
        ws = _setup_ws(tmp_path)
        cmd_send(ws, "A", "B", "task", "P1", "Timestamp check")

        reqs = _read_requests(ws)
        assert reqs[0]["created_at"] is not None
        # Should be an ISO-format timestamp string
        assert "T" in reqs[0]["created_at"]

    def test_all_valid_roles_accepted(self, tmp_path):
        ws = _setup_ws(tmp_path)
        roles = sorted(VALID_ROLES)
        for i, role in enumerate(roles):
            result = cmd_send(ws, role, roles[(i + 1) % len(roles)], "task", "P1", f"From {role}")
            assert result["status"] == "sent"

    def test_all_valid_types_accepted(self, tmp_path):
        ws = _setup_ws(tmp_path)
        for vtype in VALID_TYPES:
            result = cmd_send(ws, "A", "B", vtype, "P1", f"Type {vtype}")
            assert result["status"] == "sent"

    def test_all_valid_priorities_accepted(self, tmp_path):
        ws = _setup_ws(tmp_path)
        for pri in VALID_PRIORITIES:
            result = cmd_send(ws, "A", "B", "task", pri, f"Priority {pri}")
            assert result["status"] == "sent"

    def test_prints_json_result(self, tmp_path, capsys):
        ws = _setup_ws(tmp_path)
        cmd_send(ws, "A", "B", "task", "P1", "Print test")

        captured = capsys.readouterr()
        output = json.loads(captured.out.strip())
        assert output["id"] == "REQ-001"
        assert output["status"] == "sent"
        assert output["type"] == "task"


# ---------------------------------------------------------------------------
# cmd_list
# ---------------------------------------------------------------------------

class TestCmdList:
    def _populate(self, ws):
        """Create a mix of requests and escalations for list tests."""
        cmd_send(ws, "A", "B", "task", "P1", "Task for B")
        cmd_send(ws, "A", "C", "info", "P2", "Info for C")
        cmd_send(ws, "D", "A", "escalation", "P0", "Escalation to A")
        cmd_send(ws, "E", "B", "task", "P1", "Another task for B")

    def test_list_all_items(self, tmp_path, capsys):
        ws = _setup_ws(tmp_path)
        self._populate(ws)
        results = cmd_list(ws)

        # All 4 items are in requests.json; escalations.json entries never
        # appear because _matches_filter hardcodes req_type="escalation" for
        # escalation entries that lack a "type" field.
        assert len(results) == 4

    def test_filter_by_status_pending(self, tmp_path):
        ws = _setup_ws(tmp_path)
        self._populate(ws)
        # All items start as pending
        results = cmd_list(ws, status="pending")
        assert len(results) == 4
        assert all(r["status"] == "pending" for r in results)

    def test_filter_by_status_completed(self, tmp_path):
        ws = _setup_ws(tmp_path)
        self._populate(ws)
        # Resolve one request, then filter
        cmd_resolve(ws, "REQ-001", "Done")
        results = cmd_list(ws, status="completed")
        assert len(results) == 1
        assert results[0]["id"] == "REQ-001"

    def test_filter_by_to_role(self, tmp_path):
        ws = _setup_ws(tmp_path)
        self._populate(ws)
        results = cmd_list(ws, to_role="B")
        assert len(results) == 2
        assert all(r["to_role"] == "B" for r in results)

    def test_filter_by_to_role_case_insensitive(self, tmp_path):
        ws = _setup_ws(tmp_path)
        self._populate(ws)
        results = cmd_list(ws, to_role="b")
        assert len(results) == 2

    def test_filter_by_from_role(self, tmp_path):
        ws = _setup_ws(tmp_path)
        self._populate(ws)
        results = cmd_list(ws, from_role="A")
        assert len(results) == 2
        assert all(r["from_role"] == "A" for r in results)

    def test_filter_by_from_role_case_insensitive(self, tmp_path):
        ws = _setup_ws(tmp_path)
        self._populate(ws)
        results = cmd_list(ws, from_role="a")
        assert len(results) == 2

    def test_filter_by_type_task(self, tmp_path):
        ws = _setup_ws(tmp_path)
        self._populate(ws)
        results = cmd_list(ws, req_type="task")
        assert len(results) == 2
        assert all(r["type"] == "task" for r in results)

    def test_filter_by_type_info(self, tmp_path):
        ws = _setup_ws(tmp_path)
        self._populate(ws)
        results = cmd_list(ws, req_type="info")
        assert len(results) == 1
        assert results[0]["type"] == "info"

    def test_filter_by_type_escalation(self, tmp_path):
        ws = _setup_ws(tmp_path)
        self._populate(ws)
        results = cmd_list(ws, req_type="escalation")
        assert len(results) == 1
        assert results[0]["type"] == "escalation"
        assert results[0]["id"] == "ESC-001"

    def test_source_requests_only(self, tmp_path):
        ws = _setup_ws(tmp_path)
        self._populate(ws)
        results = cmd_list(ws, source="requests")
        # Only items from requests.json
        assert len(results) == 4

    def test_source_escalations_returns_empty(self, tmp_path):
        """Escalation entries in escalations.json lack a 'type' field, so the
        hardcoded req_type='escalation' filter in cmd_list always rejects them.
        This tests the actual (buggy) behavior."""
        ws = _setup_ws(tmp_path)
        self._populate(ws)
        results = cmd_list(ws, source="escalations")
        # No results because escalation entries don't have "type" key
        assert len(results) == 0

    def test_source_all(self, tmp_path):
        ws = _setup_ws(tmp_path)
        self._populate(ws)
        results = cmd_list(ws, source="all")
        # Same as default — 4 items from requests.json
        assert len(results) == 4

    def test_combined_filters(self, tmp_path):
        ws = _setup_ws(tmp_path)
        self._populate(ws)
        results = cmd_list(ws, to_role="B", req_type="task")
        assert len(results) == 2
        assert all(r["to_role"] == "B" and r["type"] == "task" for r in results)

    def test_combined_from_and_to_role(self, tmp_path):
        ws = _setup_ws(tmp_path)
        self._populate(ws)
        results = cmd_list(ws, from_role="A", to_role="B")
        assert len(results) == 1
        assert results[0]["from_role"] == "A"
        assert results[0]["to_role"] == "B"

    def test_empty_workspace(self, tmp_path):
        ws = _setup_ws(tmp_path)
        results = cmd_list(ws)
        assert results == []

    def test_filter_no_matches(self, tmp_path):
        ws = _setup_ws(tmp_path)
        self._populate(ws)
        results = cmd_list(ws, to_role="G")
        assert results == []

    def test_prints_json(self, tmp_path, capsys):
        ws = _setup_ws(tmp_path)
        cmd_send(ws, "A", "B", "task", "P1", "Print test")
        capsys.readouterr()  # clear send output

        cmd_list(ws)
        captured = capsys.readouterr()
        output = json.loads(captured.out)
        assert isinstance(output, list)
        assert len(output) == 1


# ---------------------------------------------------------------------------
# cmd_resolve
# ---------------------------------------------------------------------------

class TestCmdResolve:
    def test_resolve_regular_request(self, tmp_path):
        ws = _setup_ws(tmp_path)
        cmd_send(ws, "A", "B", "task", "P1", "Fix bug")

        result = cmd_resolve(ws, "REQ-001", "Bug fixed in commit abc123")
        assert result["id"] == "REQ-001"
        assert result["status"] == "resolved"

        reqs = _read_requests(ws)
        assert reqs[0]["status"] == "completed"
        assert reqs[0]["resolution"] == "Bug fixed in commit abc123"
        assert reqs[0]["resolved_at"] is not None

    def test_resolve_escalation_updates_both_files(self, tmp_path):
        ws = _setup_ws(tmp_path)
        cmd_send(ws, "D", "A", "escalation", "P0", "Security issue")

        # Both requests.json and escalations.json use ESC-001 for escalations.
        result = cmd_resolve(
            ws, "ESC-001", "Fixed the vulnerability",
            resolution_finding_id="F-099",
        )
        assert result["id"] == "ESC-001"
        assert result["status"] == "resolved"

        # Check escalations.json — updated
        escs = _read_escalations(ws)
        assert escs[0]["status"] == "resolved"

        # Check requests.json — also updated since same ID
        reqs = _read_requests(ws)
        assert reqs[0]["id"] == "ESC-001"
        assert reqs[0]["status"] == "resolved"
        assert reqs[0]["resolution"] == "Fixed the vulnerability"
        assert reqs[0]["resolved_at"] is not None

    def test_resolve_escalation_without_finding_id(self, tmp_path):
        ws = _setup_ws(tmp_path)
        cmd_send(ws, "D", "A", "escalation", "P0", "No finding ref")

        cmd_resolve(ws, "ESC-001", "Resolved without cross-ref")

        escs = _read_escalations(ws)
        assert escs[0]["status"] == "resolved"
        assert escs[0]["resolution_summary"] == "Resolved without cross-ref"
        assert escs[0]["resolution_finding_id"] is None

    def test_resolve_nonexistent_id_exits(self, tmp_path):
        ws = _setup_ws(tmp_path)
        cmd_send(ws, "A", "B", "task", "P1", "Something")

        with pytest.raises(SystemExit):
            cmd_resolve(ws, "REQ-999", "Does not exist")

    def test_resolve_nonexistent_id_empty_workspace(self, tmp_path):
        ws = _setup_ws(tmp_path)
        with pytest.raises(SystemExit):
            cmd_resolve(ws, "REQ-001", "Nothing to resolve")

    def test_resolve_preserves_other_requests(self, tmp_path):
        ws = _setup_ws(tmp_path)
        cmd_send(ws, "A", "B", "task", "P1", "First")
        cmd_send(ws, "A", "C", "task", "P2", "Second")
        cmd_send(ws, "B", "D", "task", "P1", "Third")

        cmd_resolve(ws, "REQ-002", "Done")

        reqs = _read_requests(ws)
        assert reqs[0]["status"] == "pending"
        assert reqs[1]["status"] == "completed"
        assert reqs[2]["status"] == "pending"

    def test_resolve_prints_json(self, tmp_path, capsys):
        ws = _setup_ws(tmp_path)
        cmd_send(ws, "A", "B", "task", "P1", "Print test")
        capsys.readouterr()  # clear send output

        cmd_resolve(ws, "REQ-001", "Resolved")
        captured = capsys.readouterr()
        output = json.loads(captured.out)
        assert output["id"] == "REQ-001"
        assert output["status"] == "resolved"

    def test_resolve_regular_request_status_is_completed(self, tmp_path):
        """When resolving a non-escalation request, requests.json status
        should be 'completed' (not 'resolved')."""
        ws = _setup_ws(tmp_path)
        cmd_send(ws, "A", "B", "info", "P2", "Info request")
        cmd_resolve(ws, "REQ-001", "Provided info")

        reqs = _read_requests(ws)
        assert reqs[0]["status"] == "completed"

    def test_resolve_escalation_by_esc_id_only_updates_escalations(self, tmp_path):
        """Resolving by ESC-xxx ID now updates both files since IDs are consistent."""
        ws = _setup_ws(tmp_path)
        cmd_send(ws, "A", "B", "task", "P1", "Task")
        cmd_send(ws, "D", "A", "escalation", "P0", "Esc")

        result = cmd_resolve(ws, "ESC-001", "Esc resolved")
        assert result["id"] == "ESC-001"
        assert result["status"] == "resolved"

        # escalations.json is updated
        escs = _read_escalations(ws)
        assert escs[0]["status"] == "resolved"
        assert escs[0]["resolution_summary"] == "Esc resolved"

        # requests.json entry (ESC-001) is also updated since IDs match
        reqs = _read_requests(ws)
        assert reqs[1]["id"] == "ESC-001"
        assert reqs[1]["status"] == "resolved"


# ---------------------------------------------------------------------------
# cmd_pending_count
# ---------------------------------------------------------------------------

class TestCmdPendingCount:
    def test_count_empty_workspace(self, tmp_path):
        ws = _setup_ws(tmp_path)
        result = cmd_pending_count(ws)
        assert result == {"pending_requests": 0, "pending_escalations": 0}

    def test_count_all_pending(self, tmp_path):
        ws = _setup_ws(tmp_path)
        cmd_send(ws, "A", "B", "task", "P1", "Task 1")
        cmd_send(ws, "A", "C", "info", "P2", "Info 1")
        cmd_send(ws, "D", "A", "escalation", "P0", "Esc 1")

        result = cmd_pending_count(ws)
        # requests.json has 3 pending entries (2 regular + 1 escalation)
        assert result["pending_requests"] == 3
        # escalations.json has 1 pending entry
        assert result["pending_escalations"] == 1

    def test_count_after_resolve_request(self, tmp_path):
        ws = _setup_ws(tmp_path)
        cmd_send(ws, "A", "B", "task", "P1", "Task 1")
        cmd_send(ws, "A", "C", "task", "P2", "Task 2")
        cmd_resolve(ws, "REQ-001", "Done")

        result = cmd_pending_count(ws)
        assert result["pending_requests"] == 1
        assert result["pending_escalations"] == 0

    def test_count_after_resolve_escalation(self, tmp_path):
        ws = _setup_ws(tmp_path)
        cmd_send(ws, "A", "B", "task", "P1", "Task")
        cmd_send(ws, "D", "A", "escalation", "P0", "Esc")
        # Resolve by ESC-001: updates both requests.json and escalations.json
        cmd_resolve(ws, "ESC-001", "Fixed")

        result = cmd_pending_count(ws)
        # requests.json: REQ-001 (pending task), ESC-001 (resolved escalation)
        assert result["pending_requests"] == 1
        # escalations.json: ESC-001 is now resolved
        assert result["pending_escalations"] == 0

    def test_count_mixed_states(self, tmp_path):
        ws = _setup_ws(tmp_path)
        cmd_send(ws, "A", "B", "task", "P1", "Pending task")
        cmd_send(ws, "A", "C", "info", "P2", "Completed info")
        cmd_send(ws, "D", "A", "escalation", "P0", "Pending esc")
        cmd_send(ws, "E", "B", "task", "P1", "Another pending")

        cmd_resolve(ws, "REQ-002", "Done")

        result = cmd_pending_count(ws)
        # requests.json: REQ-001 (pending), REQ-002 (completed), ESC-001 (pending), REQ-003 (pending)
        assert result["pending_requests"] == 3
        # escalations.json: ESC-001 (pending)
        assert result["pending_escalations"] == 1

    def test_count_prints_json(self, tmp_path, capsys):
        ws = _setup_ws(tmp_path)
        cmd_send(ws, "A", "B", "task", "P1", "Task")
        capsys.readouterr()  # clear send output

        cmd_pending_count(ws)
        captured = capsys.readouterr()
        output = json.loads(captured.out)
        assert "pending_requests" in output
        assert "pending_escalations" in output

    def test_count_no_mailbox_files(self, tmp_path):
        """If mailbox files don't exist, counts should be zero."""
        ws = _setup_ws(tmp_path)
        # Remove the mailbox files
        (ws / "_mailbox" / "requests.json").unlink()
        (ws / "_mailbox" / "escalations.json").unlink()

        result = cmd_pending_count(ws)
        assert result == {"pending_requests": 0, "pending_escalations": 0}


# ---------------------------------------------------------------------------
# Edge cases and integration
# ---------------------------------------------------------------------------

class TestEdgeCases:
    def test_send_after_resolve_keeps_counters(self, tmp_path):
        """Session counters are cumulative, not decremented on resolve."""
        ws = _setup_ws(tmp_path)
        cmd_send(ws, "A", "B", "task", "P1", "Task 1")
        cmd_send(ws, "A", "C", "task", "P2", "Task 2")
        cmd_resolve(ws, "REQ-001", "Done")
        cmd_send(ws, "B", "D", "task", "P1", "Task 3")

        session = read_session(ws)
        assert session["request_count"] == 3

    def test_escalation_count_cumulative(self, tmp_path):
        ws = _setup_ws(tmp_path)
        cmd_send(ws, "D", "A", "escalation", "P0", "Esc 1")
        cmd_send(ws, "E", "A", "escalation", "P1", "Esc 2")
        cmd_resolve(ws, "ESC-001", "Fixed")

        session = read_session(ws)
        # Counter is not decremented on resolve
        assert session["escalation_count"] == 2
        assert session["request_count"] == 2

    def test_mixed_requests_and_escalations_ordering(self, tmp_path):
        ws = _setup_ws(tmp_path)
        cmd_send(ws, "A", "B", "task", "P1", "Req 1")          # REQ-001
        cmd_send(ws, "D", "A", "escalation", "P0", "Esc 1")    # ESC-001
        cmd_send(ws, "B", "C", "info", "P2", "Req 3")          # REQ-002

        reqs = _read_requests(ws)
        assert len(reqs) == 3
        # Escalations use ESC-xxx IDs in both files
        assert reqs[0]["id"] == "REQ-001"
        assert reqs[1]["id"] == "ESC-001"
        assert reqs[1]["type"] == "escalation"
        assert reqs[2]["id"] == "REQ-002"

        # In escalations.json the entry also has ESC-001
        escs = _read_escalations(ws)
        assert len(escs) == 1
        assert escs[0]["id"] == "ESC-001"

    def test_list_after_resolve_shows_updated_status(self, tmp_path):
        ws = _setup_ws(tmp_path)
        cmd_send(ws, "A", "B", "task", "P1", "Task")
        cmd_resolve(ws, "REQ-001", "Completed")

        pending = cmd_list(ws, status="pending")
        assert len(pending) == 0

        completed = cmd_list(ws, status="completed")
        assert len(completed) == 1
        assert completed[0]["resolution"] == "Completed"

    def test_pending_count_consistent_with_list(self, tmp_path):
        ws = _setup_ws(tmp_path)
        cmd_send(ws, "A", "B", "task", "P1", "Task 1")
        cmd_send(ws, "C", "D", "info", "P2", "Info 1")
        cmd_send(ws, "D", "A", "escalation", "P0", "Esc 1")
        cmd_resolve(ws, "REQ-001", "Done")

        counts = cmd_pending_count(ws)
        pending_list = cmd_list(ws, status="pending")

        # pending_requests counts from requests.json, which includes all types
        pending_from_reqs = [r for r in pending_list if "type" in r]
        assert counts["pending_requests"] == len(pending_from_reqs)


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
