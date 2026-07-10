#!/usr/bin/env python3
"""Unit tests for collect_repo_context.py pure functions."""

from __future__ import annotations

import os
import sys
from pathlib import Path

import pytest

# Add scripts directory to path so we can import the module
sys.path.insert(0, str(Path(__file__).parent.parent / "scripts"))
from collect_repo_context import (
    IMPORTANT_NAMES,
    TEXT_EXTENSIONS,
    decode_content,
    is_important_path,
    parse_repo_from_text,
    parse_target,
    run,
    summarize_tree,
    truncate,
)


# ---------------------------------------------------------------------------
# parse_repo_from_text
# ---------------------------------------------------------------------------

class TestParseRepoFromText:
    def test_owner_slash_repo(self):
        assert parse_repo_from_text("facebook/react") == "facebook/react"

    def test_owner_slash_repo_with_git_suffix(self):
        assert parse_repo_from_text("facebook/react.git") == "facebook/react"

    def test_https_url(self):
        assert parse_repo_from_text("https://github.com/facebook/react") == "facebook/react"

    def test_https_url_with_git_suffix(self):
        assert parse_repo_from_text("https://github.com/facebook/react.git") == "facebook/react"

    def test_https_url_trailing_slash(self):
        assert parse_repo_from_text("https://github.com/facebook/react/") == "facebook/react"

    def test_ssh_url(self):
        assert parse_repo_from_text("git@github.com:facebook/react.git") == "facebook/react"

    def test_ssh_url_no_suffix(self):
        assert parse_repo_from_text("git@github.com:facebook/react") == "facebook/react"

    def test_empty_string(self):
        assert parse_repo_from_text("") is None

    def test_random_text(self):
        assert parse_repo_from_text("hello world") is None

    def test_just_a_word(self):
        assert parse_repo_from_text("react") is None

    def test_url_with_extra_path(self):
        assert parse_repo_from_text("https://github.com/facebook/react/issues/123") is None

    def test_preserves_dashes_and_dots(self):
        assert parse_repo_from_text("my-org/my.repo-name") == "my-org/my.repo-name"

    def test_strips_whitespace(self):
        assert parse_repo_from_text("  facebook/react  ") == "facebook/react"


# ---------------------------------------------------------------------------
# parse_target
# ---------------------------------------------------------------------------

class TestParseTarget:
    def test_parse_owner_slash_repo(self):
        repo, local = parse_target("facebook/react")
        assert repo == "facebook/react"
        assert local is None

    def test_parse_https_url(self):
        repo, local = parse_target("https://github.com/facebook/react")
        assert repo == "facebook/react"
        assert local is None

    def test_parse_nonexistent_path(self):
        repo, local = parse_target("/this/path/does/not/exist/12345")
        assert repo is None
        assert local is None


# ---------------------------------------------------------------------------
# truncate
# ---------------------------------------------------------------------------

class TestTruncate:
    def test_short_text_unchanged(self):
        text = "hello world"
        assert truncate(text, 100) == "hello world"

    def test_exact_limit(self):
        text = "hello"
        assert truncate(text, 5) == "hello"

    def test_truncation_adds_notice(self):
        text = "a" * 200
        result = truncate(text, 100)
        assert result.startswith("a" * 100)
        assert "[truncated to 100 characters]" in result

    def test_empty_string(self):
        assert truncate("", 100) == ""

    def test_limit_zero(self):
        result = truncate("hello", 0)
        assert "[truncated to 0 characters]" in result


# ---------------------------------------------------------------------------
# decode_content
# ---------------------------------------------------------------------------

class TestDecodeContent:
    def test_valid_base64(self):
        import base64
        encoded = base64.b64encode(b"hello world").decode()
        result = decode_content({"content": encoded})
        assert result == "hello world"

    def test_empty_content(self):
        assert decode_content({"content": ""}) is None

    def test_missing_content_key(self):
        assert decode_content({}) is None

    def test_none_content(self):
        assert decode_content({"content": None}) is None

    def test_invalid_base64(self):
        # Invalid base64 raises Exception, decode_content catches and returns None
        result = decode_content({"content": "!!!not-base64!!!"})
        assert result is None

    def test_multiline_base64(self):
        import base64
        raw = b"line one\nline two"
        encoded = base64.b64encode(raw).decode()
        # Simulate GitHub API multiline format
        multiline = "\n".join(encoded[i:i + 76] for i in range(0, len(encoded), 76))
        result = decode_content({"content": multiline})
        assert result == "line one\nline two"


# ---------------------------------------------------------------------------
# is_important_path
# ---------------------------------------------------------------------------

class TestIsImportantPath:
    def test_package_json(self):
        assert is_important_path("package.json") is True

    def test_tsconfig(self):
        assert is_important_path("tsconfig.json") is True

    def test_dockerfile(self):
        assert is_important_path("Dockerfile") is True

    def test_readme(self):
        assert is_important_path("README.md") is True

    def test_workflow_file(self):
        assert is_important_path(".github/workflows/ci.yml") is True

    def test_issue_template(self):
        assert is_important_path(".github/ISSUE_TEMPLATE/bug.md") is True

    def test_random_source_file(self):
        assert is_important_path("src/utils/helper.ts") is False

    def test_docs_markdown(self):
        assert is_important_path("docs/getting-started.md") is True

    def test_examples_markdown(self):
        assert is_important_path("examples/demo.md") is True

    def test_src_entry_point(self):
        assert is_important_path("src/main.tsx") is True

    def test_env_example(self):
        assert is_important_path(".env.example") is True

    def test_lockfile(self):
        assert is_important_path("package-lock.json") is True

    def test_nested_config(self):
        assert is_important_path("packages/core/package.json") is True

    def test_random_nested_file(self):
        assert is_important_path("packages/core/src/index.ts") is False

    def test_case_insensitive_workflow(self):
        assert is_important_path(".GITHUB/WORKFLOWS/ci.yml") is True


# ---------------------------------------------------------------------------
# summarize_tree
# ---------------------------------------------------------------------------

class TestSummarizeTree:
    def test_empty_paths(self):
        result = summarize_tree([])
        assert result["file_count"] == 0
        assert result["top_extensions"] == []
        assert result["top_directories"] == []
        assert result["test_paths_sample"] == []
        assert result["workflow_paths"] == []

    def test_single_file(self):
        result = summarize_tree(["README.md"])
        assert result["file_count"] == 1
        assert result["top_extensions"] == [(".md", 1)]
        assert result["top_directories"] == [("README.md", 1)]

    def test_multiple_files(self):
        paths = ["src/index.ts", "src/app.tsx", "README.md", "package.json"]
        result = summarize_tree(paths)
        assert result["file_count"] == 4
        assert (".ts", 1) in result["top_extensions"]
        assert (".tsx", 1) in result["top_extensions"]
        assert (".md", 1) in result["top_extensions"]
        assert (".json", 1) in result["top_extensions"]
        assert ("src", 2) in result["top_directories"]

    def test_test_paths_detection(self):
        paths = ["src/app.tsx", "src/__tests__/app.test.ts", "tests/test_helper.py"]
        result = summarize_tree(paths)
        assert "src/__tests__/app.test.ts" in result["test_paths_sample"]
        assert "tests/test_helper.py" in result["test_paths_sample"]

    def test_workflow_paths_detection(self):
        paths = [".github/workflows/ci.yml", ".github/workflows/deploy.yml", "src/app.ts"]
        result = summarize_tree(paths)
        assert ".github/workflows/ci.yml" in result["workflow_paths"]
        assert ".github/workflows/deploy.yml" in result["workflow_paths"]

    def test_no_extension(self):
        result = summarize_tree(["Makefile", "Dockerfile"])
        assert result["file_count"] == 2
        assert ("[none]", 2) in result["top_extensions"]

    def test_test_paths_limit(self):
        """Test paths should be capped at 80."""
        paths = [f"tests/test_{i}.py" for i in range(100)]
        result = summarize_tree(paths)
        assert len(result["test_paths_sample"]) == 80

    def test_extension_distribution_order(self):
        paths = ["a.ts", "b.ts", "c.ts", "d.md", "e.md", "f.json"]
        result = summarize_tree(paths)
        exts = dict(result["top_extensions"])
        assert exts[".ts"] == 3
        assert exts[".md"] == 2
        assert exts[".json"] == 1


# ---------------------------------------------------------------------------
# run() with missing command
# ---------------------------------------------------------------------------

class TestRunMissingCommand:
    def test_missing_command_returns_127(self):
        """run() should catch FileNotFoundError and return returncode=127."""
        result = run(["this-command-does-not-exist-9999", "--version"], check=False)
        assert result.returncode == 127
        assert "not found" in result.stderr

    def test_missing_gh_returns_127(self):
        """Simulate gh not installed."""
        result = run(["gh-nonexistent-9999", "auth", "status"], check=False)
        assert result.returncode == 127


# ---------------------------------------------------------------------------
# Integration / smoke tests
# ---------------------------------------------------------------------------

class TestSmoke:
    def test_important_names_not_empty(self):
        assert len(IMPORTANT_NAMES) > 10

    def test_text_extensions_not_empty(self):
        assert len(TEXT_EXTENSIONS) > 10

    def test_important_names_contains_key_files(self):
        assert "package.json" in IMPORTANT_NAMES
        assert "README.md" in IMPORTANT_NAMES
        assert "Dockerfile" in IMPORTANT_NAMES
        assert "LICENSE" in IMPORTANT_NAMES
        assert "tsconfig.json" in IMPORTANT_NAMES
        assert "SECURITY.md" in IMPORTANT_NAMES

    def test_text_extensions_contains_key_types(self):
        assert ".py" in TEXT_EXTENSIONS
        assert ".ts" in TEXT_EXTENSIONS
        assert ".tsx" in TEXT_EXTENSIONS
        assert ".md" in TEXT_EXTENSIONS
        assert ".yaml" in TEXT_EXTENSIONS
        assert ".json" in TEXT_EXTENSIONS


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
