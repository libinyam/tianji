#!/usr/bin/env python3
"""Read and write role findings in the review team workspace.

Commands:
  write     Write a role's findings and update session status
  read      Read one role's findings or all roles
  summary   Compact table of all scores and top findings
  mark-na   Mark a role as not applicable
"""

from __future__ import annotations

import argparse
import json
import sys
from datetime import datetime, timezone
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

ROLE_LABELS = {
    "A": "Planning Analyst",
    "B": "Frontend Engineer",
    "C": "Backend Engineer",
    "D": "Test Engineer",
    "E": "Code Reviewer",
    "F": "Product & Market",
    "G": "Security & DevOps",
}


def resolve_workspace(base_dir: str | Path) -> Path:
    ws = Path(base_dir) / WORKSPACE_NAME
    if not ws.exists():
        print(f"Error: no workspace at {ws}. Run team_workspace.py init first.", file=sys.stderr)
        sys.exit(1)
    return ws


def role_dir(ws: Path, role: str) -> Path:
    code = role.upper()
    if code not in ROLE_DIR_MAP:
        print(f"Error: unknown role '{role}'. Valid: {', '.join(ROLE_DIR_MAP)}", file=sys.stderr)
        sys.exit(1)
    return ws / ROLE_DIR_MAP[code]


def read_session(ws: Path) -> dict[str, Any]:
    with open(ws / "_session.json", "r", encoding="utf-8") as f:
        return json.load(f)


def write_session(ws: Path, session: dict[str, Any]) -> None:
    with open(ws / "_session.json", "w", encoding="utf-8") as f:
        json.dump(session, f, ensure_ascii=False, indent=2)
        f.write("\n")


def read_json(path: Path) -> Any:
    try:
        with open(path, "r", encoding="utf-8-sig") as f:
            return json.load(f)
    except json.JSONDecodeError as exc:
        print(f"Error: invalid JSON in {path}: {exc}", file=sys.stderr)
        sys.exit(1)
    except OSError as exc:
        print(f"Error: failed to read {path}: {exc}", file=sys.stderr)
        sys.exit(1)


def write_json(path: Path, data: Any) -> None:
    with open(path, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)
        f.write("\n")


# ---------------------------------------------------------------------------
# Commands
# ---------------------------------------------------------------------------

def cmd_write(ws: Path, role: str, findings_file: str, notes: str | None = None) -> dict[str, Any]:
    """Write a role's findings, update session, and append P0/P1 to cross-findings."""
    code = role.upper()
    rd = role_dir(ws, code)
    rd.mkdir(parents=True, exist_ok=True)

    # Load and validate findings
    findings_path = Path(findings_file)
    if not findings_path.exists():
        print(f"Error: findings file not found: {findings_file}", file=sys.stderr)
        sys.exit(1)

    findings = read_json(findings_path)

    # Basic validation
    if not isinstance(findings, dict):
        print("Error: findings must be a JSON object.", file=sys.stderr)
        sys.exit(1)

    findings["role"] = code
    findings["label"] = ROLE_LABELS.get(code, code)
    findings["timestamp"] = datetime.now(timezone.utc).isoformat()

    # Write findings
    write_json(rd / "findings.json", findings)

    # Write optional notes
    if notes:
        notes_path = Path(notes)
        if notes_path.exists():
            (rd / "notes.md").write_text(notes_path.read_text(encoding="utf-8"), encoding="utf-8")
        else:
            (rd / "notes.md").write_text(notes, encoding="utf-8")

    # Update session status
    session = read_session(ws)
    if code in session.get("roles", {}):
        session["roles"][code]["status"] = "completed"
    write_session(ws, session)

    # Append P0/P1 findings to cross-findings
    cross_path = ws / "_synthesis" / "cross-findings.json"
    if cross_path.exists():
        cross = read_json(cross_path)
    else:
        cross = {"findings": []}

    for f in findings.get("findings", []):
        severity = f.get("severity", "").upper()
        if severity in ("P0", "P1"):
            cross["findings"].append({
                "role": code,
                "finding_id": f.get("id", ""),
                "severity": severity,
                "title": f.get("title", ""),
                "evidence": f.get("evidence", ""),
                "files": f.get("files", []),
                "recommendation": f.get("recommendation", ""),
            })

    write_json(cross_path, cross)

    result = {
        "role": code,
        "status": "written",
        "findings_count": len(findings.get("findings", [])),
        "scores_count": len(findings.get("scores", {})),
    }
    print(json.dumps(result, ensure_ascii=False))
    return result


def cmd_read(ws: Path, role: str) -> dict[str, Any]:
    """Read findings for a single role or all roles."""
    if role.upper() == "ALL":
        results = {}
        for code in ROLE_DIR_MAP:
            fp = ws / ROLE_DIR_MAP[code] / "findings.json"
            if fp.exists():
                results[code] = read_json(fp)
            else:
                results[code] = None
        print(json.dumps(results, ensure_ascii=False, indent=2))
        return results

    code = role.upper()
    rd = role_dir(ws, code)
    fp = rd / "findings.json"
    if not fp.exists():
        print(json.dumps({"role": code, "findings": None, "message": "no findings yet"}))
        return {"role": code, "findings": None}

    data = read_json(fp)
    print(json.dumps(data, ensure_ascii=False, indent=2))
    return data


def cmd_summary(ws: Path) -> str:
    """Compact summary of all roles' scores and findings."""
    session = read_session(ws)
    lines = [f"=== Findings Summary: {session.get('repo', 'unknown')} ===", ""]

    for code in sorted(ROLE_DIR_MAP):
        role_info = session.get("roles", {}).get(code, {})
        label = role_info.get("label", code)
        status = role_info.get("status", "pending")
        applicable = role_info.get("applicable", True)

        fp = ws / ROLE_DIR_MAP[code] / "findings.json"
        if fp.exists():
            findings = read_json(fp)
            scores = findings.get("scores", {})
            finding_list = findings.get("findings", [])
            p0_count = sum(1 for f in finding_list if f.get("severity", "").upper() == "P0")
            p1_count = sum(1 for f in finding_list if f.get("severity", "").upper() == "P1")

            if scores:
                avg = sum(s.get("value", 0) if isinstance(s, dict) else 0 for s in scores.values()) / len(scores)
                score_str = f"avg {avg:.1f}/10"
            else:
                score_str = "no scores"

            lines.append(f"  {code} {label:<25s} [{status}]  {score_str}, {len(finding_list)} findings ({p0_count} P0, {p1_count} P1)")
        elif not applicable:
            lines.append(f"  {code} {label:<25s} [N/A]")
        else:
            lines.append(f"  {code} {label:<25s} [{status}]")

    output = "\n".join(lines)
    print(output)
    return output


def cmd_mark_na(ws: Path, role: str) -> dict[str, Any]:
    """Mark a role as not applicable."""
    code = role.upper()
    role_dir(ws, code)  # validate role code

    session = read_session(ws)
    if code in session.get("roles", {}):
        session["roles"][code]["status"] = "skipped"
        session["roles"][code]["applicable"] = False
    write_session(ws, session)

    result = {"role": code, "status": "marked_na"}
    print(json.dumps(result))
    return result


# ---------------------------------------------------------------------------
# CLI
# ---------------------------------------------------------------------------

def main() -> int:
    parser = argparse.ArgumentParser(description="Read/write role findings in team workspace.")
    sub = parser.add_subparsers(dest="command")

    # write
    p_write = sub.add_parser("write", help="Write role findings")
    p_write.add_argument("--dir", default=".", help="Base directory")
    p_write.add_argument("--role", required=True, choices=list(ROLE_DIR_MAP))
    p_write.add_argument("--findings-file", required=True, help="Path to findings JSON")
    p_write.add_argument("--notes", help="Path to notes.md or inline text")

    # read
    p_read = sub.add_parser("read", help="Read role findings")
    p_read.add_argument("--dir", default=".", help="Base directory")
    p_read.add_argument("--role", required=True, help="Role code (A-G) or 'all'")

    # summary
    p_summary = sub.add_parser("summary", help="Compact score table")
    p_summary.add_argument("--dir", default=".", help="Base directory")

    # mark-na
    p_na = sub.add_parser("mark-na", help="Mark role as not applicable")
    p_na.add_argument("--dir", default=".", help="Base directory")
    p_na.add_argument("--role", required=True, choices=list(ROLE_DIR_MAP))

    args = parser.parse_args()

    if args.command == "write":
        ws = resolve_workspace(args.dir)
        cmd_write(ws, args.role, args.findings_file, args.notes)
        return 0

    if args.command == "read":
        ws = resolve_workspace(args.dir)
        cmd_read(ws, args.role)
        return 0

    if args.command == "summary":
        ws = resolve_workspace(args.dir)
        cmd_summary(ws)
        return 0

    if args.command == "mark-na":
        ws = resolve_workspace(args.dir)
        cmd_mark_na(ws, args.role)
        return 0

    parser.print_help()
    return 1


if __name__ == "__main__":
    raise SystemExit(main())
