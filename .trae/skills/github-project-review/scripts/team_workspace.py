#!/usr/bin/env python3
"""Manage the review team workspace directory.

Commands:
  init    Create workspace with session metadata and role directories
  status  Print workspace path and session state
  clean   Remove the workspace directory (with confirmation)
"""

from __future__ import annotations

import argparse
import json
import shutil
import sys
from datetime import datetime, timezone
from pathlib import Path
from typing import Any


WORKSPACE_NAME = ".github-review-workspace"

ROLE_DEFS = {
    "A": {"name": "planning", "label": "Planning Analyst"},
    "B": {"name": "frontend", "label": "Frontend Engineer"},
    "C": {"name": "backend", "label": "Backend Engineer"},
    "D": {"name": "testing", "label": "Test Engineer"},
    "E": {"name": "code-review", "label": "Code Reviewer"},
    "F": {"name": "product", "label": "Product & Market"},
    "G": {"name": "security", "label": "Security & DevOps"},
}


def init_workspace(
    base_dir: str | Path,
    repo: str,
    mode: str = "parallel",
    context_file: str | None = None,
) -> Path:
    """Create the workspace directory structure and session metadata."""
    base = Path(base_dir)
    ws = base / WORKSPACE_NAME

    if ws.exists():
        print(f"Error: workspace already exists at {ws}", file=sys.stderr)
        print("Run 'clean' first or use --force to overwrite.", file=sys.stderr)
        sys.exit(1)

    # Create directory structure
    dirs = [
        ws / "_context",
        ws / "_mailbox",
        ws / "_synthesis",
    ]
    for code, role in ROLE_DEFS.items():
        dirs.append(ws / f"role-{code.lower()}-{role['name']}")

    for d in dirs:
        d.mkdir(parents=True, exist_ok=True)

    # Write session metadata
    now = datetime.now(timezone.utc).isoformat()
    roles = {}
    for code, role in ROLE_DEFS.items():
        roles[code] = {
            "name": role["name"],
            "label": role["label"],
            "status": "pending",
            "applicable": True,
        }

    session: dict[str, Any] = {
        "repo": repo,
        "created_at": now,
        "phase": "initial",
        "mode": mode,
        "roles": roles,
        "escalation_count": 0,
        "request_count": 0,
    }
    _write_json(ws / "_session.json", session)

    # Initialize mailbox files
    _write_json(ws / "_mailbox" / "requests.json", {"requests": []})
    _write_json(ws / "_mailbox" / "escalations.json", {"escalations": []})

    # Initialize synthesis files
    _write_json(ws / "_synthesis" / "scores.json", {"scores": {}})
    _write_json(ws / "_synthesis" / "cross-findings.json", {"findings": []})

    # Copy context file if provided
    if context_file:
        src = Path(context_file)
        if src.exists():
            shutil.copy2(src, ws / "_context" / "repo-context.json")
        else:
            print(f"Warning: context file not found: {context_file}", file=sys.stderr)

    return ws


def get_workspace_status(ws: Path) -> dict[str, Any]:
    """Read and return the session status."""
    session_file = ws / "_session.json"
    if not session_file.exists():
        return {"error": f"No session found at {ws}"}
    return _read_json(session_file)


def format_status(session: dict[str, Any]) -> str:
    """Format session status as human-readable text."""
    if "error" in session:
        return session["error"]

    lines = [
        f"=== Team Status: {session.get('repo', 'unknown')} ===",
        f"Phase: {session.get('phase', 'unknown')}",
        f"Mode: {session.get('mode', 'unknown')}",
        f"Created: {session.get('created_at', 'unknown')}",
        "",
        "Roles:",
    ]

    for code in sorted(session.get("roles", {})):
        role = session["roles"][code]
        status = role.get("status", "pending")
        label = role.get("label", code)
        applicable = role.get("applicable", True)
        suffix = "" if applicable else " [N/A]"
        lines.append(f"  {code} {label:<25s} [{status}]{suffix}")

    lines.append("")
    lines.append(f"Escalations: {session.get('escalation_count', 0)}")
    lines.append(f"Requests: {session.get('request_count', 0)}")

    return "\n".join(lines)


def clean_workspace(base_dir: str | Path, force: bool = False) -> bool:
    """Remove the workspace directory.

    When force is False, prompt for confirmation via input(). The non-TTY
    guard lives in main() so this function stays testable with monkeypatched input.
    """
    ws = Path(base_dir) / WORKSPACE_NAME
    if not ws.exists():
        print("No workspace to clean.", file=sys.stderr)
        return False

    if not force:
        response = input(f"Remove workspace at {ws}? (y/N): ").strip().lower()
        if response not in ("y", "yes"):
            print("Aborted.", file=sys.stderr)
            return False

    shutil.rmtree(ws)
    print(f"Workspace removed: {ws}", file=sys.stderr)
    return True


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _read_json(path: Path) -> dict[str, Any]:
    with open(path, "r", encoding="utf-8") as f:
        return json.load(f)


def _write_json(path: Path, data: Any) -> None:
    with open(path, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)
        f.write("\n")


# ---------------------------------------------------------------------------
# CLI
# ---------------------------------------------------------------------------

def main() -> int:
    parser = argparse.ArgumentParser(description="Manage review team workspace.")
    sub = parser.add_subparsers(dest="command")

    # init
    p_init = sub.add_parser("init", help="Create workspace")
    p_init.add_argument("--repo", required=True, help="owner/repo being reviewed")
    p_init.add_argument("--mode", choices=["parallel", "sequential"], default="parallel")
    p_init.add_argument("--dir", default=".", help="Base directory for workspace")
    p_init.add_argument("--context", help="Path to repo-context.json to copy")

    # status
    p_status = sub.add_parser("status", help="Print workspace status")
    p_status.add_argument("--dir", default=".", help="Base directory")
    p_status.add_argument("--format", choices=["text", "json"], default="text")

    # clean
    p_clean = sub.add_parser("clean", help="Remove workspace")
    p_clean.add_argument("--dir", default=".", help="Base directory")
    p_clean.add_argument("--force", "-y", action="store_true", help="Skip confirmation (required in non-interactive mode)")

    args = parser.parse_args()

    if args.command == "init":
        ws = init_workspace(args.dir, args.repo, args.mode, args.context)
        print(f"Workspace created: {ws}", file=sys.stderr)
        print(json.dumps({"workspace": str(ws), "repo": args.repo, "mode": args.mode}))
        return 0

    if args.command == "status":
        ws = Path(args.dir) / WORKSPACE_NAME
        session = get_workspace_status(ws)
        if args.format == "json":
            print(json.dumps(session, ensure_ascii=False, indent=2))
        else:
            print(format_status(session))
        return 0

    if args.command == "clean":
        if not args.force and not sys.stdin.isatty():
            print("Error: non-interactive environment detected (stdin is not a TTY).\n"
                  "Pass --force to skip confirmation, or run from a terminal.",
                  file=sys.stderr)
            return 2
        clean_workspace(args.dir, args.force)
        return 0

    parser.print_help()
    return 1


if __name__ == "__main__":
    raise SystemExit(main())
