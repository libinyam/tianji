# Contributing to GitHub Project Review Skill

Thank you for your interest in contributing! This guide covers the basics.

## Getting Started

1. Fork the repository.
2. Clone your fork: `git clone https://github.com/<your-username>/github-project-review-skill.git`
3. Create a feature branch: `git checkout -b feat/your-feature`

## Development Setup

No external dependencies are required for the core collector script. For testing:

```bash
# Run tests
python -m pytest tests/ -v

# Smoke-test the collector
python scripts/collect_repo_context.py owner/repo --output test-context.json
```

## Code Style

- Python: follow PEP 8. Use type annotations as in the existing codebase.
- Keep functions focused and testable - pure functions (parsers, summarizers) should have unit tests.
- No external dependencies for `collect_repo_context.py` - stdlib only.

## Pull Request Checklist

Before submitting a PR, ensure:

- [ ] Code passes `python -m py_compile scripts/collect_repo_context.py`
- [ ] Tests pass: `python -m pytest tests/ -v`
- [ ] New pure functions have unit tests
- [ ] No secrets or tokens are committed
- [ ] Documentation is updated if behavior changes

## Commit Messages

Use conventional commit format:

```
feat: add language stats collection
fix: handle empty tree in summarize_tree
docs: update README with token fallback
test: add tests for parse_repo_from_text
```

## Reporting Issues

Use GitHub Issues. Include:

- Description of the problem or feature request
- Steps to reproduce (for bugs)
- Expected vs actual behavior
- Environment (OS, Python version, gh CLI version)

## License

By contributing, you agree that your contributions will be licensed under the MIT License.
