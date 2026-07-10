# Security Policy

## Supported Versions

| Version | Supported |
|---------|-----------|
| latest on `main` | Yes |

## Reporting a Vulnerability

If you discover a security vulnerability in this project, please report it responsibly:

1. **Do NOT open a public GitHub issue.**
2. Email: `3478925144@qq.com`
3. Include:
   - Description of the vulnerability
   - Steps to reproduce
   - Potential impact
   - Suggested fix (if any)

You will receive a response within 72 hours. Please do not disclose the vulnerability publicly until a fix has been released.

## Security Considerations

This skill collects and analyzes GitHub repository data. Be aware of the following:

- **Private repositories**: The collector accesses private repos via `gh` CLI or `GITHUB_TOKEN`. Ensure tokens are stored securely and never committed.
- **Secret detection**: The collector reads config files (`.env.example`, `docker-compose.yml`, etc.) but truncates content. Reviewers should avoid including secrets in reports.
- **Report output**: For private repositories, the skill explicitly instructs agents to avoid exposing secrets or proprietary code snippets in the final report.
- **Token scope**: The collector requires `repo` scope for private repositories and `public_repo` (read-only) for public repositories.

## Best Practices for Users

- Use `gh auth login` with the minimum necessary scopes.
- If using `GITHUB_TOKEN`, set it via environment variable, not in config files.
- Review the collector output before sharing it externally.
- Rotate tokens regularly.
