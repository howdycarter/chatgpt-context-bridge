# Publishing and Launch Handoff

This repo is ready to publish, but the current Windows machine is not authenticated to GitHub and the target repository does not yet exist.

## Current Local State

- Branch: `main`
- Commit: `7fe20f9 Initial open-source release`
- Intended remote: `https://github.com/howdycarter/chatgpt-context-bridge.git`
- Verification: `npm run verify` passes locally
- Plugin validation: `plugin/` passes the Codex plugin validator

## Create and Push the Public Repo

Run this from the repository root after GitHub auth is available:

```powershell
gh auth login
gh repo create howdycarter/chatgpt-context-bridge --public --description "Draft-only MCP bridge for turning ChatGPT and Codex conversations into reviewed Homebase and Notion-ready context."
git push -u origin main
```

If the repo is created in the browser instead, keep the name `howdycarter/chatgpt-context-bridge`, then run:

```powershell
git push -u origin main
```

## Verify Public Availability

```powershell
git ls-remote https://github.com/howdycarter/chatgpt-context-bridge.git
```

The social scheduler refuses to run until this check succeeds.

## Schedule Launch Posts

After the public repo exists:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\schedule-omnisocials-launch.ps1
```

The script:

- loads `OMNISOCIALS_API_KEY` from `C:\Users\built\Documents\Socials\.env.local` unless already exported;
- verifies the GitHub repo URL resolves;
- verifies connected OmniSocials accounts;
- creates scheduled launch posts for LinkedIn/Facebook/Threads/Instagram and X;
- writes sanitized proof to `social/launch-schedule-proof.json`.

The script does not publish immediately or delete anything.
