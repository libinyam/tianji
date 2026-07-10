#!/usr/bin/env python3
"""Team status dashboard and completion checking.

Displays a human-readable or JSON team status board showing each role's status,
pending/resolved counts for requests and escalations, current phase, and whether
synthesis is ready.

Exit codes:
  0 -- ready for synthesis (all roles done, zero pending escalations)
  1 -- not ready
"""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path
from typing import Any


WORKSPACE_NAME = ".github-review-workspace"

ROLE_DIR_MAP = {
    "A": "role-a-planning",
    "B": "role-b-frontend",
    "C": "role-c-backend",
    "D": "role-d-testing",
    "E": "role-e-code-review",
    "F": "role-f-product",
    "G": "role-g-security",
}


def resolve_workspace(base_dir: str | Path) -> Path:
    ws = Path(base_dir) / WORKSPACE_NAME
    if not ws.exists():
        print(f"Error: no workspace at {ws}.", file=sys.stderr)
        sys.exit(2)
    return ws


def read_json(path: Path) -> Any:
    with open(path, "r", encoding="utf-8") as f:
        return json.load(f)


def get_team_status(ws: Path) -> dict[str, Any]:
    """Compute full team status from workspace files."""
    session = read_json(ws / "_session.json")

    # Count requests
    req_path = ws / "_mailbox" / "requests.json"
    total_req = 0
    pending_req = 0
    resolved_req = 0
    if req_path.exists():
        data = read_json(req_path)
        requests = data.get("requests", [])
        total_req = len(requests)
        pending_req = sum(1 for r in requests if r.get("status") == "pending")
        resolved_req = sum(1 for r in requests if r.get("status") in ("completed", "resolved"))

    # Count escalations
    esc_path = ws / "_mailbox" / "escalations.json"
    total_esc = 0
    pending_esc = 0
    resolved_esc = 0
    if esc_path.exists():
        data = read_json(esc_path)
        escalations = data.get("escalations", [])
        total_esc = len(escalations)
        pending_esc = sum(1 for e in escalations if e.get("status") == "pending")
        resolved_esc = sum(1 for e in escalations if e.get("status") == "resolved")

    # Count role completions
    roles_completed = 0
    roles_total = 0
    roles_applicable = 0
    for code in ROLE_DIR_MAP:
        role_info = session.get("roles", {}).get(code, {})
        roles_total += 1
        if role_info.get("applicable", True):
            roles_applicable += 1
            if role_info.get("status") == "completed":
                roles_completed += 1

    # Determine readiness
    all_applicable_done = roles_completed >= roles_applicable
    no_pending_escalations = pending_esc == 0
    ready = all_applicable_done and no_pending_escalations

    # Determine phase
    phase = session.get("phase", "initial")
    if all_applicable_done and pending_esc > 0:
        phase = "escalation"
    elif ready:
        phase = "synthesis"

    return {
        "repo": session.get("repo", "unknown"),
        "phase": phase,
        "mode": session.get("mode", "unknown"),
        "created_at": session.get("created_at", ""),
        "roles": session.get("roles", {}),
        "roles_completed": roles_completed,
        "roles_applicable": roles_applicable,
        "roles_total": roles_total,
        "total_requests": total_req,
        "pending_requests": pending_req,
        "resolved_requests": resolved_req,
        "total_escalations": total_esc,
        "pending_escalations": pending_esc,
        "resolved_escalations": resolved_esc,
        "ready_for_synthesis": ready,
    }


def format_status(status: dict[str, Any]) -> str:
    """Format status as human-readable text."""
    lines = [
        f"=== Team Status: {status['repo']} ===",
        f"Phase: {status['phase']}",
        f"Mode: {status['mode']}",
        "",
        "Roles:",
    ]

    for code in sorted(ROLE_DIR_MAP):
        role = status.get("roles", {}).get(code, {})
        label = role.get("label", code)
        st = role.get("status", "pending")
        applicable = role.get("applicable", True)

        # Get findings info if available
        ws = Path(".")  # placeholder
        suffix = "" if applicable else " [N/A]"
        finding_info = ""
        fp = None
        # Try to find findings file
        for base in [Path("."), Path(status.get("_workspace_dir", "."))]:
            candidate = base / WORKSPACE_NAME / ROLE_DIR_MAP[code] / "findings.json"
            if candidate.exists():
                fp = candidate
                break
        if fp:
            try:
                findings = read_json(fp)
                scores = findings.get("scores", {})
                finding_list = findings.get("findings", [])
                p0 = sum(1 for f in finding_list if f.get("severity", "").upper() == "P0")
                p1 = sum(1 for f in finding_list if f.get("severity", "").upper() == "P1")
                finding_info = f"  {len(scores)} scores, {len(finding_list)} findings ({p0} P0, {p1} P1)"
            except Exception:
                pass

        lines.append(f"  {code} {label:<25s} [{st}]{suffix}{finding_info}")

    lines.append("")
    lines.append(f"Roles: {status['roles_completed']}/{status['roles_applicable']} applicable completed")
    lines.append(f"Requests:   {status['total_requests']} total, {status['pending_requests']} pending, {status['resolved_requests']} resolved")
    lines.append(f"Escalations: {status['total_escalations']} total, {status['pending_escalations']} pending, {status['resolved_escalations']} resolved")
    lines.append("")

    if status["ready_for_synthesis"]:
        lines.append("Ready for synthesis: YES")
    else:
        reasons = []
        if status["roles_completed"] < status["roles_applicable"]:
            remaining = status["roles_applicable"] - status["roles_completed"]
            reasons.append(f"{remaining} role(s) still pending")
        if status["pending_escalations"] > 0:
            reasons.append(f"{status['pending_escalations']} pending escalation(s)")
        lines.append(f"Ready for synthesis: NO ({', '.join(reasons)})")

    return "\n".join(lines)


# ---------------------------------------------------------------------------
# CLI
# ---------------------------------------------------------------------------

def main() -> int:
    parser = argparse.ArgumentParser(description="Team status dashboard.")
    parser.add_argument("--dir", default=".", help="Base directory")
    parser.add_argument("--format", choices=["text", "json"], default="text")
    parser.add_argument("--check-complete", action="store_true",
                        help="Exit 0 if ready for synthesis, 1 otherwise")

    args = parser.parse_args()
    ws = resolve_workspace(args.dir)
    status = get_team_status(ws)

    if args.check_complete:
        sys.exit(0 if status["ready_for_synthesis"] else 1)

    if args.format == "json":
        print(json.dumps(status, ensure_ascii=False, indent=2))
    else:
        # Pass workspace dir for findings lookup
        status["_workspace_dir"] = str(ws.parent)
        print(format_status(status))

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
