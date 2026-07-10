#!/usr/bin/env python3
"""Create GitHub issues from a review findings JSON file.

Used by the Test Engineer (Role D) to file actionable test gaps as GitHub issues.
Supports gh CLI and GITHUB_TOKEN fallback, with --dry-run for preview.
"""

from __future__ import annotations

import argparse
import json
import os
import subprocess
import sys
import urllib.error
import urllib.request
from pathlib import Path
from typing import Any


API_BASE = "https://api.github.com"
DEFAULT_LABELS = ["review-finding"]
ISSUE_BODY_MAX = 65536
ISSUE_TITLE_MAX = 256


def run(cmd: list[str], check: bool = True) -> subprocess.CompletedProcess[str]:
    try:
        return subprocess.run(
            cmd,
            text=True,
            encoding="utf-8",
            errors="replace",
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            check=check,
        )
    except FileNotFoundError:
        # gh CLI or other command not installed / not on PATH
        return subprocess.CompletedProcess(
            args=cmd,
            returncode=127,
            stdout="",
            stderr=f"command not found: {cmd[0]}",
        )


def parse_repo(text: str) -> str | None:
    import re
    text = text.strip()
    if re.fullmatch(r"[\w.-]+/[\w.-]+", text):
        return text.removesuffix(".git")
    patterns = [
        r"github\.com[:/]([\w.-]+/[\w.-]+?)(?:\.git)?/?$",
        r"https?://github\.com/([\w.-]+/[\w.-]+?)(?:\.git)?/?$",
    ]
    for pattern in patterns:
        match = re.search(pattern, text)
        if match:
            return match.group(1).removesuffix(".git")
    return None


def truncate_field(value: str, limit: int) -> str:
    """Truncate a field to fit within GitHub limits, appending a notice if cut."""
    if len(value) <= limit:
        return value
    notice = f"\n\n[truncated to {limit} characters to fit GitHub limit]"
    return value[: max(limit - len(notice), 0)] + notice


def load_issues(file_path: str) -> list[dict[str, Any]]:
    """Load issue definitions from a JSON file."""
    path = Path(file_path)
    if not path.exists():
        print(f"Error: issues file not found: {file_path}", file=sys.stderr)
        sys.exit(1)

    try:
        with open(path, "r", encoding="utf-8-sig") as f:
            data = json.load(f)
    except json.JSONDecodeError as exc:
        print(f"Error: invalid JSON in issues file: {exc}", file=sys.stderr)
        sys.exit(1)
    except OSError as exc:
        print(f"Error: failed to read issues file: {exc}", file=sys.stderr)
        sys.exit(1)

    if isinstance(data, dict):
        data = [data]

    if not isinstance(data, list):
        print("Error: issues file must be a JSON array or a single object.", file=sys.stderr)
        sys.exit(1)

    issues: list[dict[str, Any]] = []
    for i, item in enumerate(data):
        if not isinstance(item, dict) or "title" not in item or "body" not in item:
            print(f"Warning: issue #{i} missing 'title' or 'body', skipping.", file=sys.stderr)
            continue
        issue = {
            "title": truncate_field(str(item["title"]), ISSUE_TITLE_MAX),
            "body": truncate_field(str(item["body"]), ISSUE_BODY_MAX),
            "labels": item.get("labels", DEFAULT_LABELS),
        }
        issues.append(issue)

    return issues


def create_issue_gh(repo: str, title: str, body: str, labels: list[str]) -> dict[str, Any]:
    """Create a GitHub issue using gh CLI."""
    cmd = [
        "gh", "issue", "create",
        "--repo", repo,
        "--title", title,
        "--body", body,
    ]
    for label in labels:
        cmd.extend(["--label", label])

    proc = run(cmd, check=False)
    if proc.returncode == 0:
        url = proc.stdout.strip()
        return {"success": True, "url": url, "method": "gh_cli"}
    return {"success": False, "error": proc.stderr.strip() or proc.stdout.strip(), "method": "gh_cli"}


def create_issue_urllib(repo: str, title: str, body: str, labels: list[str], token: str) -> dict[str, Any]:
    """Create a GitHub issue using the REST API via urllib."""
    url = f"{API_BASE}/repos/{repo}/issues"
    headers = {
        "Authorization": f"Bearer {token}",
        "Accept": "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
        "User-Agent": "github-project-review-skill",
    }
    payload = json.dumps({"title": title, "body": body, "labels": labels}).encode("utf-8")

    try:
        req = urllib.request.Request(url, data=payload, headers=headers, method="POST")
        with urllib.request.urlopen(req, timeout=30) as resp:
            result = json.loads(resp.read().decode("utf-8", errors="replace"))
            return {"success": True, "url": result.get("html_url", ""), "method": "urllib", "number": result.get("number")}
    except urllib.error.HTTPError as exc:
        body_text = exc.read().decode("utf-8", errors="replace") if exc.fp else ""
        return {"success": False, "error": f"HTTP {exc.code}: {exc.reason} - {body_text[:300]}", "method": "urllib"}
    except urllib.error.URLError as exc:
        return {"success": False, "error": str(exc.reason), "method": "urllib"}


def create_issue(repo: str, title: str, body: str, labels: list[str]) -> dict[str, Any]:
    """Create a GitHub issue, trying gh CLI first, then GITHUB_TOKEN."""
    # Try gh CLI first
    auth = run(["gh", "auth", "status"], check=False)
    if auth.returncode == 0:
        return create_issue_gh(repo, title, body, labels)

    # Fallback to GITHUB_TOKEN
    token = os.environ.get("GITHUB_TOKEN")
    if token:
        return create_issue_urllib(repo, title, body, labels, token)

    return {
        "success": False,
        "error": "gh CLI not authenticated and GITHUB_TOKEN not set. Run `gh auth login` or set GITHUB_TOKEN.",
        "method": "none",
    }


def main() -> int:
    parser = argparse.ArgumentParser(description="Create GitHub issues from review findings.")
    parser.add_argument("repo", help="owner/repo or GitHub URL")
    parser.add_argument("--issues-file", "-f", required=True, help="JSON file with issue definitions")
    parser.add_argument("--dry-run", action="store_true", help="Preview issues without creating them")
    parser.add_argument("--yes", "-y", action="store_true", help="Skip confirmation prompt (required in non-interactive mode)")
    args = parser.parse_args()

    repo = parse_repo(args.repo)
    if not repo:
        print(f"Error: could not parse repository from '{args.repo}'", file=sys.stderr)
        return 2

    issues = load_issues(args.issues_file)
    if not issues:
        print("No valid issues to create.", file=sys.stderr)
        return 1

    print(f"Loaded {len(issues)} issue(s) from {args.issues_file}", file=sys.stderr)
    print(f"Target repository: {repo}", file=sys.stderr)
    print("", file=sys.stderr)

    if args.dry_run:
        print("=== DRY RUN ===\n", file=sys.stderr)
        for i, issue in enumerate(issues, 1):
            print(f"[{i}/{len(issues)}] {issue['title']}")
            print(f"Labels: {', '.join(issue['labels'])}")
            print(f"Body:\n{issue['body']}")
            print("\n" + "-" * 60 + "\n")
        print("Dry run complete. No issues were created.", file=sys.stderr)
        return 0

    if not args.yes:
        if not sys.stdin.isatty():
            print("Error: non-interactive environment detected (stdin is not a TTY).\n"
                  "Pass --yes to skip confirmation, or run from a terminal.",
                  file=sys.stderr)
            return 2
        print("The following issues will be created:", file=sys.stderr)
        for i, issue in enumerate(issues, 1):
            print(f"  {i}. {issue['title']}  [{', '.join(issue['labels'])}]", file=sys.stderr)
        print("", file=sys.stderr)
        response = input("Proceed? (y/N): ").strip().lower()
        if response not in ("y", "yes"):
            print("Aborted.", file=sys.stderr)
            return 1

    results: list[dict[str, Any]] = []
    success_count = 0
    for i, issue in enumerate(issues, 1):
        print(f"[{i}/{len(issues)}] Creating: {issue['title']}", file=sys.stderr)
        result = create_issue(repo, issue["title"], issue["body"], issue["labels"])
        results.append({"title": issue["title"], **result})
        if result["success"]:
            success_count += 1
            print(f"  -> Created: {result['url']}", file=sys.stderr)
        else:
            print(f"  -> FAILED: {result['error']}", file=sys.stderr)

    print(f"\nDone: {success_count}/{len(issues)} issues created successfully.", file=sys.stderr)

    output = json.dumps({"repository": repo, "total": len(issues), "created": success_count, "results": results}, ensure_ascii=False, indent=2)
    print(output)
    return 0 if success_count == len(issues) else 1


if __name__ == "__main__":
    raise SystemExit(main())
