# DDD DOD — Threat Model (optional)

> **Optional file.** Keep if your project handles untrusted input, sensitive data, has external attack surface, or runs with elevated privileges. Delete if not.

## What this project defends against (in scope)

| # | Threat | Defense |
|---|--------|---------|
| T1 | <!-- e.g. "Malicious input crashes the CLI" --> | <!-- e.g. "All inputs validated; panics treated as bugs" --> |

## Out of scope (not defended against)

| # | Non-goal | Mitigation suggestion |
|---|----------|------------------------|
| N1 | <!-- e.g. "Kernel-level exploits" --> | <!-- e.g. "Run inside a VM if you need that boundary" --> |

## Trust assumptions

<!-- Who is the trusted operator? What inputs are trusted? Where does trust end? -->

## Security-relevant defaults

<!-- Lint config, sandbox flags, network restrictions, file mode bits. State them so the next reader sees them at a glance. -->
