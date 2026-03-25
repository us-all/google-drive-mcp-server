# Security Policy

## Supported Versions

| Version | Supported |
|---------|-----------|
| 1.0.x   | ✅        |

## Reporting a Vulnerability

If you discover a security vulnerability, please report it responsibly:

1. **Do not** open a public issue
2. Email the maintainer directly or use GitHub's private vulnerability reporting
3. Include steps to reproduce and potential impact

We aim to respond within 48 hours and release a fix within 7 days for critical issues.

## Security Considerations

- **Credentials**: Never commit `.env`, `service-account.json`, or `token.json` files
- **Write safety**: Write operations are disabled by default (`GOOGLE_DRIVE_ALLOW_WRITE=false`)
- **Scopes**: Use the minimum required OAuth scopes for your use case
- **Service Account**: Limit domain-wide delegation to only the scopes needed
- **Docker**: Runtime container runs as non-root user
