#!/usr/bin/env python3
"""Inter-role task requests and escalation management.

Commands:
  send     Send a request or escalation from one role to another
  list     List requests/escalations with optional filters
  resolve  Mark a request or escalation as resolved
  pending-count  Quick count of pending items
"""

from __future__ import annotations

import argparse
import json
import sys
from datetime import datetime, timezone
from pathlib import Path
from typing import Any


WORKSPACE_NAME = ".github-review-workspace"

VALID_ROLES = {"A", "B", "C", "D", "E", "F", "G"}
VALID_TYPES = {"task", "escalation", "info"}
VALID_PRIORITIES = {"P0", "P1", "P2"}
VALID_REQUEST_STATUSES = {"pending", "acknowledged", "completed", "declined"}
VALID_ESCALATION_STATUSES = {"pending", "acknowledged", "resolved"}


def resolve_workspace(base_dir: str | Path) -> Path:
    ws = Path(base_dir) / WORKSPACE_NAME
    if not ws.exists():
        print(f"Error: no workspace at {ws}. Run team_workspace.py init first.", file=sys.stderr)
        sys.exit(1)
    return ws


def read_json(path: Path) -> Any:
    with open(path, "r", encoding="utf-8") as f:
        return json.load(f)


def write_json(path: Path, data: Any) -> None:
    with open(path, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)
        f.write("\n")


def read_session(ws: Path) -> dict[str, Any]:
    return read_json(ws / "_session.json")


def write_session(ws: Path, session: dict[str, Any]) -> None:
    write_json(ws / "_session.json", session)


# ---------------------------------------------------------------------------
# Commands
# ---------------------------------------------------------------------------

def cmd_send(
    ws: Path,
    from_role: str,
    to_role: str,
    req_type: str,
    priority: str,
    subject: str,
    context: str | None = None,
) -> dict[str, Any]:
    """Send a request or escalation."""
    from_code = from_role.upper()
    to_code = to_role.upper()

    if from_code not in VALID_ROLES:
        print(f"Error: invalid from_role '{from_role}'", file=sys.stderr)
        sys.exit(1)
    if to_code not in VALID_ROLES:
        print(f"Error: invalid to_role '{to_role}'", file=sys.stderr)
        sys.exit(1)
    if req_type not in VALID_TYPES:
        print(f"Error: invalid type '{req_type}'", file=sys.stderr)
        sys.exit(1)
    if priority not in VALID_PRIORITIES:
        print(f"Error: invalid priority '{priority}'", file=sys.stderr)
        sys.exit(1)

    # Parse context
    ctx = None
    if context:
        try:
            ctx = json.loads(context)
        except json.JSONDecodeError:
            ctx = {"description": context}

    now = datetime.now(timezone.utc).isoformat()

    # Read current requests
    req_path = ws / "_mailbox" / "requests.json"
    req_data = read_json(req_path) if req_path.exists() else {"requests": []}

    # Generate ID: use ESC- prefix for escalations, REQ- for others
    if req_type == "escalation":
        esc_path = ws / "_mailbox" / "escalations.json"
        esc_data = read_json(esc_path) if esc_path.exists() else {"escalations": []}
        esc_count = len(esc_data["escalations"]) + 1
        item_id = f"ESC-{esc_count:03d}"
    else:
        req_count = sum(1 for r in req_data.get("requests", []) if r.get("type") != "escalation") + 1
        item_id = f"REQ-{req_count:03d}"

    entry: dict[str, Any] = {
        "id": item_id,
        "from_role": from_code,
        "to_role": to_code,
        "type": req_type,
        "priority": priority,
        "subject": subject,
        "context": ctx,
        "status": "pending",
        "created_at": now,
        "resolved_at": None,
        "resolution": None,
    }
    req_data["requests"].append(entry)
    write_json(req_path, req_data)

    # If escalation, also write to escalations log with a separate copy
    if req_type == "escalation":
        esc_entry: dict[str, Any] = {
            "id": item_id,
            "from_role": from_code,
            "to_role": to_code,
            "trigger_finding_id": (ctx or {}).get("finding_id", ""),
            "severity": priority,
            "subject": subject,
            "context": ctx,
            "status": "pending",
            "created_at": now,
            "resolved_at": None,
            "resolution_finding_id": None,
            "resolution_summary": None,
        }
        esc_data["escalations"].append(esc_entry)
        write_json(esc_path, esc_data)

    # Update session counters
    session = read_session(ws)
    if req_type == "escalation":
        session["escalation_count"] = session.get("escalation_count", 0) + 1
    session["request_count"] = session.get("request_count", 0) + 1
    write_session(ws, session)

    result = {"id": item_id, "status": "sent", "type": req_type}
    print(json.dumps(result, ensure_ascii=False))
    return result


def cmd_list(
    ws: Path,
    status: str | None = None,
    to_role: str | None = None,
    from_role: str | None = None,
    req_type: str | None = None,
    source: str = "all",
) -> list[dict[str, Any]]:
    """List requests/escalations with filters."""
    results: list[dict[str, Any]] = []

    if source in ("all", "requests"):
        req_path = ws / "_mailbox" / "requests.json"
        if req_path.exists():
            data = read_json(req_path)
            for r in data.get("requests", []):
                if _matches_filter(r, status, to_role, from_role, req_type):
                    results.append(r)

    if source in ("all", "escalations"):
        esc_path = ws / "_mailbox" / "escalations.json"
        if esc_path.exists():
            data = read_json(esc_path)
            for e in data.get("escalations", []):
                if _matches_filter(e, status, to_role, from_role, "escalation"):
                    results.append(e)

    print(json.dumps(results, ensure_ascii=False, indent=2))
    return results


def _matches_filter(
    item: dict[str, Any],
    status: str | None,
    to_role: str | None,
    from_role: str | None,
    req_type: str | None,
) -> bool:
    if status and item.get("status") != status:
        return False
    if to_role and item.get("to_role") != to_role.upper():
        return False
    if from_role and item.get("from_role") != from_role.upper():
        return False
    if req_type and item.get("type") != req_type:
        return False
    return True


def cmd_resolve(
    ws: Path,
    item_id: str,
    resolution_summary: str,
    resolution_finding_id: str | None = None,
) -> dict[str, Any]:
    """Mark a request or escalation as resolved."""
    resolved = False

    # Try escalations first
    esc_path = ws / "_mailbox" / "escalations.json"
    if esc_path.exists():
        esc_data = read_json(esc_path)
        for e in esc_data.get("escalations", []):
            if e["id"] == item_id:
                e["status"] = "resolved"
                e["resolved_at"] = datetime.now(timezone.utc).isoformat()
                e["resolution_finding_id"] = resolution_finding_id
                e["resolution_summary"] = resolution_summary
                write_json(esc_path, esc_data)
                resolved = True
                break

    # Also update in requests.json
    req_path = ws / "_mailbox" / "requests.json"
    if req_path.exists():
        req_data = read_json(req_path)
        for r in req_data.get("requests", []):
            if r["id"] == item_id:
                r["status"] = "resolved" if resolved else "completed"
                r["resolved_at"] = datetime.now(timezone.utc).isoformat()
                r["resolution"] = resolution_summary
                write_json(req_path, req_data)
                if not resolved:
                    resolved = True
                break

    if not resolved:
        print(f"Error: no request or escalation found with id '{item_id}'", file=sys.stderr)
        sys.exit(1)

    result = {"id": item_id, "status": "resolved"}
    print(json.dumps(result))
    return result


def cmd_pending_count(ws: Path) -> dict[str, int]:
    """Quick count of pending requests and escalations."""
    pending_req = 0
    pending_esc = 0

    req_path = ws / "_mailbox" / "requests.json"
    if req_path.exists():
        data = read_json(req_path)
        pending_req = sum(1 for r in data.get("requests", []) if r.get("status") == "pending")

    esc_path = ws / "_mailbox" / "escalations.json"
    if esc_path.exists():
        data = read_json(esc_path)
        pending_esc = sum(1 for e in data.get("escalations", []) if e.get("status") == "pending")

    result = {"pending_requests": pending_req, "pending_escalations": pending_esc}
    print(json.dumps(result))
    return result


# ---------------------------------------------------------------------------
# CLI
# ---------------------------------------------------------------------------

def main() -> int:
    parser = argparse.ArgumentParser(description="Manage inter-role requests and escalations.")
    sub = parser.add_subparsers(dest="command")

    # send
    p_send = sub.add_parser("send", help="Send a request or escalation")
    p_send.add_argument("--dir", default=".")
    p_send.add_argument("--from", dest="from_role", required=True, choices=list(VALID_ROLES))
    p_send.add_argument("--to", dest="to_role", required=True, choices=list(VALID_ROLES))
    p_send.add_argument("--type", dest="req_type", required=True, choices=list(VALID_TYPES))
    p_send.add_argument("--priority", required=True, choices=list(VALID_PRIORITIES))
    p_send.add_argument("--subject", required=True)
    p_send.add_argument("--context", help="JSON string or plain text context")

    # list
    p_list = sub.add_parser("list", help="List requests/escalations")
    p_list.add_argument("--dir", default=".")
    p_list.add_argument("--status", choices=list(VALID_REQUEST_STATUSES | VALID_ESCALATION_STATUSES))
    p_list.add_argument("--to", dest="to_role", choices=list(VALID_ROLES))
    p_list.add_argument("--from", dest="from_role", choices=list(VALID_ROLES))
    p_list.add_argument("--type", dest="req_type", choices=list(VALID_TYPES))
    p_list.add_argument("--source", choices=["all", "requests", "escalations"], default="all")

    # resolve
    p_resolve = sub.add_parser("resolve", help="Resolve a request or escalation")
    p_resolve.add_argument("--dir", default=".")
    p_resolve.add_argument("--id", required=True, help="Request or escalation ID")
    p_resolve.add_argument("--resolution-summary", required=True)
    p_resolve.add_argument("--resolution-finding-id", help="Cross-reference finding ID")

    # pending-count
    p_pending = sub.add_parser("pending-count", help="Count pending items")
    p_pending.add_argument("--dir", default=".")

    args = parser.parse_args()

    if args.command == "send":
        ws = resolve_workspace(args.dir)
        cmd_send(ws, args.from_role, args.to_role, args.req_type, args.priority, args.subject, args.context)
        return 0

    if args.command == "list":
        ws = resolve_workspace(args.dir)
        cmd_list(ws, args.status, args.to_role, args.from_role, args.req_type, args.source)
        return 0

    if args.command == "resolve":
        ws = resolve_workspace(args.dir)
        cmd_resolve(ws, args.id, args.resolution_summary, args.resolution_finding_id)
        return 0

    if args.command == "pending-count":
        ws = resolve_workspace(args.dir)
        cmd_pending_count(ws)
        return 0

    parser.print_help()
    return 1


if __name__ == "__main__":
    raise SystemExit(main())
