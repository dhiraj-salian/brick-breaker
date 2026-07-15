# Git Hooks

This project uses **local git hooks** for quality gates. They live in
`.githooks/` (tracked in git) and are enabled per-developer with one
command after cloning:

```bash
git config core.hooksPath .githooks
```

Without this, your commits and pushes won't be gated — `git` defaults to
`.git/hooks/` which is empty here.

## What runs and when

| Hook | When | Runs |
|---|---|---|
| `pre-commit` | Before `git commit` completes | `lint` + `unit tests` (~3s) |
| `pre-push` | Before `git push` completes | `lint` + `unit` + `worker tests` + `build` (~10s) |

Both are wired to `scripts/quality-gate.sh <level>`. The full gate
mirrors what CI runs in `.github/workflows/ci.yml`.

## Skipping (use sparingly)

```bash
git commit --no-verify -m "WIP"
git push --no-verify
```

If you skip the gate, the **CI workflow will still catch the failure**
and block merge — local hooks are a faster-feedback layer, not a bypass
of policy.

## How to add a new check

1. Add the command to `scripts/quality-gate.sh` (under `--quick` or
   `--full` depending on speed/importance).
2. Update the table above.
3. Commit both files.
