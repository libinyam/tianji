#!/usr/bin/env python3
"""Persistent long-term memory for the review team.

Lives outside the per-session workspace (.github-review-workspace/) so it
survives `team_workspace.py clean`. Stores, per reviewed repository, the last
review snapshot and a timeline of past reviews, plus a shared team-learning
notebook and per-role experience files that accumulate across all reviews.

Commands:
  load    Print JSON with prior review profile + role memory for a repo
  save    Archive the current review conclusion as a repo profile
  learn   Append a learning note to a role's experience file
  history Print the review timeline for a repo
"""

from __future__ import annotations

import argparse
import json
import sys
from datetime import datetime, timezone
from pathlib import Path
from typing import Any


MEMORY_NAME = ".github-review-memory"

ROLE_DIR_MAP = {
    "A": "planning",
    "B": "frontend",
    "C": "backend",
    "D": "testing",
    "E": "code-review",
    "F": "product",
    "G": "security",
}

VALID_ROLES = set(ROLE_DIR_MAP)


def _memory_root(base_dir: str | Path) -> Path:
    return Path(base_dir) / MEMORY_NAME


def _repo_slug(repo: str) -> str:
    return repo.replace("/", "__").replace(" ", "-")


def _repo_profile_dir(base_dir: str | Path, repo: str) -> Path:
    return _memory_root(base_dir) / "repo-profiles" / _repo_slug(repo)


def _role_memory_dir(base_dir: str | Path) -> Path:
    return _memory_root(base_dir) / "role-memory"


def read_json(path: Path) -> Any:
    with open(path, "r", encoding="utf-8") as f:
        return json.load(f)


def write_json(path: Path, data: Any) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with open(path, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)
        f.write("\n")


def validate_role(role: str) -> str:
    code = role.upper()
    if code not in VALID_ROLES:
        print(f"Error: invalid role '{role}'. Valid: {', '.join(sorted(VALID_ROLES))}", file=sys.stderr)
        sys.exit(1)
    return code


# ---------------------------------------------------------------------------
# Commands
# ---------------------------------------------------------------------------

def cmd_load(base_dir: str | Path, repo: str) -> dict[str, Any]:
    """Load prior review profile and role memory for a repo.

    Called at Phase 1 so roles 'remember' what was found before.
    """
    profile_dir = _repo_profile_dir(base_dir, repo)
    last_path = profile_dir / "last-review.json"
    history_path = profile_dir / "history.jsonl"

    result: dict[str, Any] = {
        "repo": repo,
        "has_prior_review": False,
        "last_review": None,
        "review_count": 0,
        "role_memory": {},
    }

    if last_path.exists():
        result["has_prior_review"] = True
        result["last_review"] = read_json(last_path)

    if history_path.exists():
        result["review_count"] = sum(
            1 for line in history_path.read_text(encoding="utf-8").splitlines()
            if line.strip()
        )

    # Load accumulated role experience across all repos
    rmd = _role_memory_dir(base_dir)
    for code, name in ROLE_DIR_MAP.items():
        rp = rmd / f"role-{code.lower()}-{name}.md"
        if rp.exists():
            result["role_memory"][code] = {
                "role": name,
                "notes": rp.read_text(encoding="utf-8"),
            }

    print(json.dumps(result, ensure_ascii=False, indent=2))
    return result


def cmd_save(
    base_dir: str | Path,
    repo: str,
    decision: str,
    overall_avg: float | None,
    p0_count: int,
    p1_count: int,
    summary: str,
) -> dict[str, Any]:
    """Archive the current review conclusion as the repo's profile.

    Overwrites last-review.json and appends a line to history.jsonl.
    Called at the end of Phase 5.
    """
    profile_dir = _repo_profile_dir(base_dir, repo)
    profile_dir.mkdir(parents=True, exist_ok=True)

    now = datetime.now(timezone.utc).isoformat()

    snapshot: dict[str, Any] = {
        "repo": repo,
        "reviewed_at": now,
        "decision": decision,
        "overall_avg": overall_avg,
        "p0_count": p0_count,
        "p1_count": p1_count,
        "summary": summary,
    }

    write_json(profile_dir / "last-review.json", snapshot)

    history_path = profile_dir / "history.jsonl"
    with open(history_path, "a", encoding="utf-8") as f:
        f.write(json.dumps(snapshot, ensure_ascii=False) + "\n")

    result = {"repo": repo, "saved": True, "reviewed_at": now}
    print(json.dumps(result, ensure_ascii=False, indent=2))
    return result


def cmd_learn(base_dir: str | Path, role: str, note: str, source_repo: str | None = None) -> dict[str, Any]:
    """Append a learning note to a role's experience file.

    Each role accumulates cross-project experience in role-memory/*.md.
    Called when a role discovers a reusable pattern worth remembering.
    """
    code = validate_role(role)
    rmd = _role_memory_dir(base_dir)
    rmd.mkdir(parents=True, exist_ok=True)

    rp = rmd / f"role-{code.lower()}-{ROLE_DIR_MAP[code]}.md"
    now = datetime.now(timezone.utc).isoformat()
    source_line = f" (from {source_repo})" if source_repo else ""
    entry = f"\n## {now}{source_line}\n\n{note}\n"

    with open(rp, "a", encoding="utf-8") as f:
        f.write(entry)

    result = {"role": code, "learned": True, "file": str(rp)}
    print(json.dumps(result, ensure_ascii=False))
    return result


def cmd_history(base_dir: str | Path, repo: str) -> list[dict[str, Any]]:
    """Print the review timeline for a repo."""
    history_path = _repo_profile_dir(base_dir, repo) / "history.jsonl"
    entries: list[dict[str, Any]] = []

    if history_path.exists():
        for line in history_path.read_text(encoding="utf-8").splitlines():
            line = line.strip()
            if line:
                try:
                    entries.append(json.loads(line))
                except json.JSONDecodeError:
                    continue

    print(json.dumps(entries, ensure_ascii=False, indent=2))
    return entries


# ---------------------------------------------------------------------------
# CLI
# ---------------------------------------------------------------------------

def main() -> int:
    parser = argparse.ArgumentParser(description="Persistent long-term memory for the review team.")
    sub = parser.add_subparsers(dest="command")

    # load
    p_load = sub.add_parser("load", help="Load prior review profile + role memory for a repo")
    p_load.add_argument("--repo", required=True, help="owner/repo")
    p_load.add_argument("--dir", default=".", help="Base directory")

    # save
    p_save = sub.add_parser("save", help="Archive current review conclusion")
    p_save.add_argument("--repo", required=True, help="owner/repo")
    p_save.add_argument("--decision", required=True, help="Promotion decision")
    p_save.add_argument("--overall-avg", type=float, default=None, help="Overall average score")
    p_save.add_argument("--p0-count", type=int, default=0, help="Number of P0 findings")
    p_save.add_argument("--p1-count", type=int, default=0, help="Number of P1 findings")
    p_save.add_argument("--summary", required=True, help="One-line summary of the review")
    p_save.add_argument("--dir", default=".", help="Base directory")

    # learn
    p_learn = sub.add_parser("learn", help="Append a learning note to a role's experience")
    p_learn.add_argument("--role", required=True, help="Role code (A-G)")
    p_learn.add_argument("--note", required=True, help="The learning note (markdown)")
    p_learn.add_argument("--source-repo", default=None, help="Repo this learning came from")
    p_learn.add_argument("--dir", default=".", help="Base directory")

    # history
    p_history = sub.add_parser("history", help="Print review timeline for a repo")
    p_history.add_argument("--repo", required=True, help="owner/repo")
    p_history.add_argument("--dir", default=".", help="Base directory")

    args = parser.parse_args()

    if args.command == "load":
        cmd_load(args.dir, args.repo)
        return 0

    if args.command == "save":
        cmd_save(args.dir, args.repo, args.decision, args.overall_avg, args.p0_count, args.p1_count, args.summary)
        return 0

    if args.command == "learn":
        cmd_learn(args.dir, args.role, args.note, args.source_repo)
        return 0

    if args.command == "history":
        cmd_history(args.dir, args.repo)
        return 0

    parser.print_help()
    return 1


if __name__ == "__main__":
    raise SystemExit(main())
