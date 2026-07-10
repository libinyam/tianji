#!/usr/bin/env python3
"""Unit tests for create_review_issues.py."""

from __future__ import annotations

import json
import sys
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).parent.parent / "scripts"))
from create_review_issues import load_issues, parse_repo


class TestParseRepo:
    def test_owner_slash_repo(self):
        assert parse_repo("facebook/react") == "facebook/react"

    def test_https_url(self):
        assert parse_repo("https://github.com/facebook/react") == "facebook/react"

    def test_ssh_url(self):
        assert parse_repo("git@github.com:facebook/react.git") == "facebook/react"

    def test_invalid_input(self):
        assert parse_repo("hello world") is None

    def test_git_suffix(self):
        assert parse_repo("facebook/react.git") == "facebook/react"


class TestLoadIssues:
    def test_load_valid_array(self, tmp_path):
        issues = [
            {"title": "Bug 1", "body": "Description 1", "labels": ["bug"]},
            {"title": "Bug 2", "body": "Description 2"},
        ]
        f = tmp_path / "issues.json"
        f.write_text(json.dumps(issues), encoding="utf-8")
        result = load_issues(str(f))
        assert len(result) == 2
        assert result[0]["title"] == "Bug 1"
        assert result[0]["labels"] == ["bug"]
        assert result[1]["labels"] == ["review-finding"]

    def test_load_single_object(self, tmp_path):
        issue = {"title": "Bug 1", "body": "Description 1"}
        f = tmp_path / "issue.json"
        f.write_text(json.dumps(issue), encoding="utf-8")
        result = load_issues(str(f))
        assert len(result) == 1
        assert result[0]["title"] == "Bug 1"

    def test_skip_missing_title(self, tmp_path):
        issues = [{"title": "Bug 1", "body": "OK"}, {"body": "No title"}]
        f = tmp_path / "issues.json"
        f.write_text(json.dumps(issues), encoding="utf-8")
        result = load_issues(str(f))
        assert len(result) == 1

    def test_skip_missing_body(self, tmp_path):
        issues = [{"title": "Bug 1"}, {"title": "Bug 2", "body": "OK"}]
        f = tmp_path / "issues.json"
        f.write_text(json.dumps(issues), encoding="utf-8")
        result = load_issues(str(f))
        assert len(result) == 1

    def test_default_labels(self, tmp_path):
        issue = {"title": "Bug 1", "body": "Description"}
        f = tmp_path / "issue.json"
        f.write_text(json.dumps(issue), encoding="utf-8")
        result = load_issues(str(f))
        assert result[0]["labels"] == ["review-finding"]

    def test_custom_labels(self, tmp_path):
        issue = {"title": "Bug 1", "body": "Description", "labels": ["bug", "high-priority"]}
        f = tmp_path / "issue.json"
        f.write_text(json.dumps(issue), encoding="utf-8")
        result = load_issues(str(f))
        assert result[0]["labels"] == ["bug", "high-priority"]

    def test_invalid_json_raises_system_exit(self, tmp_path):
        f = tmp_path / "bad.json"
        f.write_text("not valid json at all", encoding="utf-8")
        with pytest.raises(SystemExit):
            load_issues(str(f))

    def test_non_list_non_dict_raises_system_exit(self, tmp_path):
        f = tmp_path / "bad.json"
        f.write_text('"just a string"', encoding="utf-8")
        with pytest.raises(SystemExit):
            load_issues(str(f))

    def test_bom_prefixed_json(self, tmp_path):
        # Simulate a UTF-8 BOM prefixed file (common from Windows PowerShell)
        issue = {"title": "BOM test", "body": "Description with BOM"}
        f = tmp_path / "bom-issues.json"
        content = json.dumps(issue)
        f.write_bytes(b"\xef\xbb\xbf" + content.encode("utf-8"))
        result = load_issues(str(f))
        assert len(result) == 1
        assert result[0]["title"] == "BOM test"

    def test_missing_file_raises_system_exit(self):
        with pytest.raises(SystemExit):
            load_issues("/nonexistent/path/file.json")


class TestSmoke:
    def test_default_labels_constant(self):
        from create_review_issues import DEFAULT_LABELS
        assert "review-finding" in DEFAULT_LABELS

    def test_api_base(self):
        from create_review_issues import API_BASE
        assert "github.com" in API_BASE


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
