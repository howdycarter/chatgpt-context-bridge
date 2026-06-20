# Security Policy

## Supported Versions

This repository is pre-1.0. Security fixes target the latest `main` branch.

## Reporting A Vulnerability

Please do not open public issues for secrets, credential exposure, auth bypasses, or private-data leakage. Report privately to the maintainer first.

## Data Boundary

Context Bridge is designed as a draft-staging tool:

- imports are limited to configured local roots;
- writes stay under `CONTEXT_BRIDGE_DATA_DIR`;
- Homebase and Notion canonical writes are intentionally out of scope;
- audit events mark `canonicalWrites: false` and `reviewRequired: true`;
- generated images and media stay staged until publication rights are reviewed.

Do not commit `.env`, `.env.local`, `data/`, `work/`, generated staging files, API keys, exported private chats, or local media captures.
