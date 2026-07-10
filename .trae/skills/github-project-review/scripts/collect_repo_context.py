#!/usr/bin/env python3
"""Collect reusable GitHub repository context for promotion-readiness reviews."""

from __future__ import annotations

import argparse
import base64
import collections
import json
import os
import re
import subprocess
import sys
import time
import urllib.error
import urllib.request
from pathlib import Path
from typing import Any
from urllib.parse import quote


IMPORTANT_NAMES = {
    ".env.example",
    ".gitignore",
    "biome.json",
    "bun.lockb",
    "Cargo.toml",
    "CODE_OF_CONDUCT.md",
    "CONTRIBUTING.md",
    "Dockerfile",
    "docker-compose.yml",
    "eslint.config.js",
    "go.mod",
    "LICENSE",
    "LICENSE.md",
    "Makefile",
    "netlify.toml",
    "package-lock.json",
    "package.json",
    "pnpm-lock.yaml",
    "pyproject.toml",
    "README.md",
    "requirements.txt",
    "SECURITY.md",
    "tailwind.config.js",
    "tsconfig.json",
    "vercel.json",
    "vite.config.js",
    "yarn.lock",
}

IMPORTANT_SUFFIXES = (
    ".github/workflows/",
    ".github/ISSUE_TEMPLATE/",
)

TEXT_EXTENSIONS = {
    ".c",
    ".cc",
    ".cfg",
    ".conf",
    ".cs",
    ".css",
    ".go",
    ".html",
    ".java",
    ".js",
    ".json",
    ".jsx",
    ".kt",
    ".md",
    ".mjs",
    ".py",
    ".rs",
    ".sh",
    ".toml",
    ".ts",
    ".tsx",
    ".txt",
    ".yaml",
    ".yml",
}

API_BASE = "https://api.github.com"
MAX_RETRIES = 3
RETRY_BASE_DELAY = 1.0  # seconds


def run(cmd: list[str], cwd: str | None = None, check: bool = True) -> subprocess.CompletedProcess[str]:
    try:
        return subprocess.run(
            cmd,
            cwd=cwd,
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


# ---------------------------------------------------------------------------
# GitHub API access: gh CLI first, then GITHUB_TOKEN fallback via urllib
# ---------------------------------------------------------------------------

def gh_api(path: str) -> Any:
    """Fetch from GitHub API via gh CLI, with automatic urllib fallback."""
    proc = run(["gh", "api", path], check=False)
    if proc.returncode == 0:
        try:
            return json.loads(proc.stdout)
        except json.JSONDecodeError:
            return {"_raw": proc.stdout, "_path": path}

    # Fallback to urllib + GITHUB_TOKEN
    token = os.environ.get("GITHUB_TOKEN")
    if token:
        return urllib_api(path, token)

    return {
        "_error": proc.stderr.strip() or proc.stdout.strip(),
        "_error_source": "gh_cli",
        "_path": path,
    }


def urllib_api(path: str, token: str) -> Any:
    """Fetch from GitHub REST API via urllib with retry and rate-limit handling."""
    url = f"{API_BASE}/{path}" if not path.startswith("http") else path
    headers = {
        "Authorization": f"Bearer {token}",
        "Accept": "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
        "User-Agent": "github-project-review-skill",
    }

    for attempt in range(MAX_RETRIES):
        try:
            req = urllib.request.Request(url, headers=headers)
            with urllib.request.urlopen(req, timeout=30) as resp:
                body = resp.read().decode("utf-8", errors="replace")
                try:
                    return json.loads(body)
                except json.JSONDecodeError:
                    return {"_raw": body, "_path": path}
        except urllib.error.HTTPError as exc:
            if exc.code == 403:
                # Check rate limit
                remaining = exc.headers.get("X-RateLimit-Remaining") if exc.headers else None
                if remaining == "0":
                    reset_ts = exc.headers.get("X-RateLimit-Reset") if exc.headers else None
                    wait = int(reset_ts) - int(time.time()) if reset_ts else 60
                    if wait > 0 and attempt < MAX_RETRIES - 1:
                        wait = min(wait, 60)
                        print(f"Rate limited. Waiting {wait}s before retry {attempt + 1}/{MAX_RETRIES}...", file=sys.stderr)
                        time.sleep(wait)
                        continue
                return {"_error": f"403 Forbidden (rate limit or access denied): {exc.reason}", "_path": path, "_error_source": "urllib"}
            if exc.code == 404:
                return {"_error": "404 Not Found", "_path": path, "_error_source": "urllib"}
            if exc.code in (429, 502, 503) and attempt < MAX_RETRIES - 1:
                delay = RETRY_BASE_DELAY * (2 ** attempt)
                print(f"HTTP {exc.code}. Retrying in {delay}s (attempt {attempt + 1}/{MAX_RETRIES})...", file=sys.stderr)
                time.sleep(delay)
                continue
            body = exc.read().decode("utf-8", errors="replace") if exc.fp else ""
            return {"_error": f"HTTP {exc.code}: {exc.reason}", "_body": body[:500], "_path": path, "_error_source": "urllib"}
        except urllib.error.URLError as exc:
            if attempt < MAX_RETRIES - 1:
                delay = RETRY_BASE_DELAY * (2 ** attempt)
                print(f"URL error: {exc.reason}. Retrying in {delay}s (attempt {attempt + 1}/{MAX_RETRIES})...", file=sys.stderr)
                time.sleep(delay)
                continue
            return {"_error": str(exc.reason), "_path": path, "_error_source": "urllib"}

    return {"_error": "Max retries exceeded", "_path": path, "_error_source": "urllib"}


# ---------------------------------------------------------------------------
# Target parsing
# ---------------------------------------------------------------------------

def parse_target(target: str) -> tuple[str | None, Path | None]:
    candidate = Path(target).expanduser()
    if candidate.exists():
        remote = run(["git", "-C", str(candidate), "remote", "get-url", "origin"], check=False)
        if remote.returncode == 0:
            repo = parse_repo_from_text(remote.stdout.strip())
            if repo:
                return repo, candidate
        return None, candidate
    return parse_repo_from_text(target), None


def parse_repo_from_text(text: str) -> str | None:
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


# ---------------------------------------------------------------------------
# Content decoding
# ---------------------------------------------------------------------------

def decode_content(item: dict[str, Any]) -> str | None:
    content = item.get("content")
    if not content:
        return None
    try:
        return base64.b64decode(content.replace("\n", "")).decode("utf-8", errors="replace")
    except Exception:
        return None


# ---------------------------------------------------------------------------
# Tree summarization
# ---------------------------------------------------------------------------

def summarize_tree(paths: list[str]) -> dict[str, Any]:
    extensions: collections.Counter[str] = collections.Counter()
    top_dirs: collections.Counter[str] = collections.Counter()
    test_paths: list[str] = []
    workflow_paths: list[str] = []
    for path in paths:
        suffix = Path(path).suffix.lower() or "[none]"
        extensions[suffix] += 1
        top_dirs[path.split("/", 1)[0]] += 1
        lowered = path.lower()
        if any(token in lowered for token in ("test", "spec", "__tests__")):
            test_paths.append(path)
        if lowered.startswith(".github/workflows/"):
            workflow_paths.append(path)
    return {
        "file_count": len(paths),
        "top_extensions": extensions.most_common(20),
        "top_directories": top_dirs.most_common(20),
        "test_paths_sample": test_paths[:80],
        "workflow_paths": workflow_paths,
    }


def is_important_path(path: str) -> bool:
    name = Path(path).name
    lowered = path.lower()
    if name in IMPORTANT_NAMES:
        return True
    if any(lowered.startswith(prefix.lower()) for prefix in IMPORTANT_SUFFIXES):
        return True
    if lowered.startswith(("docs/", "examples/")) and Path(path).suffix.lower() in {".md", ".mdx"}:
        return True
    if lowered in {"src/app.tsx", "src/main.tsx", "src/index.ts", "src/index.tsx", "src/app.jsx"}:
        return True
    return False


def truncate(text: str, limit: int) -> str:
    if len(text) <= limit:
        return text
    return text[:limit] + f"\n\n[truncated to {limit} characters]"


# ---------------------------------------------------------------------------
# GitHub collection
# ---------------------------------------------------------------------------

def collect_github(repo: str, max_file_chars: int) -> dict[str, Any]:
    meta = gh_api(f"repos/{repo}")
    default_branch = meta.get("default_branch", "main") if isinstance(meta, dict) else "main"
    branch_ref = quote(default_branch, safe="")
    tree = gh_api(f"repos/{repo}/git/trees/{branch_ref}?recursive=1")
    paths = []
    if isinstance(tree, dict):
        paths = [item["path"] for item in tree.get("tree", []) if item.get("type") == "blob"]

    readme_obj = gh_api(f"repos/{repo}/readme")
    readme = decode_content(readme_obj) if isinstance(readme_obj, dict) else None

    important_paths = [path for path in paths if is_important_path(path)]
    important_paths = sorted(dict.fromkeys(important_paths))[:120]
    files: dict[str, Any] = {}
    for path in important_paths:
        item = gh_api(f"repos/{repo}/contents/{quote(path, safe='/')}?ref={quote(default_branch, safe='')}")
        if isinstance(item, dict) and not item.get("_error"):
            content = decode_content(item)
            if content is not None:
                files[path] = truncate(content, max_file_chars)
            else:
                files[path] = {"note": "content unavailable or binary"}
        else:
            files[path] = item

    return {
        "source": "github",
        "repository": repo,
        "metadata": meta,
        "readme": truncate(readme, max_file_chars * 2) if readme else None,
        "tree_summary": summarize_tree(paths),
        "notable_paths": important_paths,
        "file_contents": files,
        "recent_commits": gh_api(f"repos/{repo}/commits?per_page=10"),
        "open_issues": gh_api(f"repos/{repo}/issues?state=open&per_page=50"),
        "contributors": gh_api(f"repos/{repo}/contributors?per_page=30"),
        "latest_release": gh_api(f"repos/{repo}/releases/latest"),
        "languages": gh_api(f"repos/{repo}/languages"),
        "recent_prs": gh_api(f"repos/{repo}/pulls?state=all&per_page=20&sort=updated&direction=desc"),
    }


# ---------------------------------------------------------------------------
# Local collection
# ---------------------------------------------------------------------------

def collect_local(path: Path, max_file_chars: int) -> dict[str, Any]:
    root = path.resolve()
    paths: list[str] = []
    for file_path in root.rglob("*"):
        if not file_path.is_file():
            continue
        rel = file_path.relative_to(root).as_posix()
        if any(part in {".git", "node_modules", "dist", "build", ".next", ".venv"} for part in file_path.parts):
            continue
        paths.append(rel)

    files: dict[str, str] = {}
    for rel in sorted(p for p in paths if is_important_path(p))[:120]:
        file_path = root / rel
        if file_path.suffix.lower() not in TEXT_EXTENSIONS and file_path.name not in IMPORTANT_NAMES:
            continue
        try:
            files[rel] = truncate(file_path.read_text(encoding="utf-8", errors="replace"), max_file_chars)
        except OSError as exc:
            files[rel] = f"[read error: {exc}]"

    remote = run(["git", "-C", str(root), "remote", "get-url", "origin"], check=False)
    commits = run(["git", "-C", str(root), "log", "-10", "--pretty=format:%h %cI %s"], check=False)

    # Detect language distribution from local files
    lang_counter: collections.Counter[str] = collections.Counter()
    lang_map = {
        ".py": "Python", ".js": "JavaScript", ".mjs": "JavaScript", ".jsx": "JavaScript",
        ".ts": "TypeScript", ".tsx": "TypeScript", ".go": "Go", ".rs": "Rust",
        ".java": "Java", ".kt": "Kotlin", ".c": "C", ".cc": "C++",
        ".cs": "C#", ".rb": "Ruby", ".swift": "Swift", ".php": "PHP",
        ".html": "HTML", ".css": "CSS", ".sh": "Shell",
    }
    for p in paths:
        ext = Path(p).suffix.lower()
        if ext in lang_map:
            lang_counter[lang_map[ext]] += os.path.getsize(root / p)
    languages = dict(lang_counter.most_common(20)) if lang_counter else None

    return {
        "source": "local",
        "path": str(root),
        "repository": parse_repo_from_text(remote.stdout.strip()) if remote.returncode == 0 else None,
        "tree_summary": summarize_tree(paths),
        "notable_paths": sorted(files),
        "file_contents": files,
        "recent_commits": commits.stdout.splitlines() if commits.returncode == 0 else [],
        "languages": languages,
    }


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def main() -> int:
    parser = argparse.ArgumentParser(description="Collect GitHub repository review context as JSON.")
    parser.add_argument("target", help="owner/repo, GitHub URL, or local project path")
    parser.add_argument("--output", "-o", help="Write JSON to this path instead of stdout")
    parser.add_argument("--max-file-chars", type=int, default=12000, help="Max characters per collected file")
    args = parser.parse_args()

    repo, local_path = parse_target(args.target)
    context: dict[str, Any]
    if repo:
        auth = run(["gh", "auth", "status"], check=False)
        if auth.returncode != 0:
            token = os.environ.get("GITHUB_TOKEN")
            if token:
                print("gh CLI not available, using GITHUB_TOKEN for API access.", file=sys.stderr)
                context = collect_github(repo, args.max_file_chars)
                context["auth_method"] = "github_token"
                if local_path:
                    context["local_path"] = str(local_path.resolve())
            elif local_path:
                context = collect_local(local_path, args.max_file_chars)
                context["github_error"] = auth.stderr.strip()
            else:
                print("gh CLI is not authenticated and GITHUB_TOKEN is not set.\n"
                      "Run `gh auth login` or set the GITHUB_TOKEN environment variable.",
                      file=sys.stderr)
                return 2
        else:
            context = collect_github(repo, args.max_file_chars)
            context["auth_method"] = "gh_cli"
            if local_path:
                context["local_path"] = str(local_path.resolve())
    elif local_path:
        context = collect_local(local_path, args.max_file_chars)
    else:
        print("Could not resolve target. Use owner/repo, GitHub URL, or a local path.", file=sys.stderr)
        return 2

    output = json.dumps(context, ensure_ascii=False, indent=2)
    if args.output:
        Path(args.output).write_text(output + "\n", encoding="utf-8")
        print(f"Context written to {args.output}", file=sys.stderr)
    else:
        print(output)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
