# Gate scripts

One script per task in `PLAN.md`. Each script exits 0 iff the task is genuinely complete.

## Contract

- Exits 0 on success, non-zero on any failure.
- May be updated in the same commit as the task — but only to **tighten** assertions. Never weaken.
- Assertions should be behavioural where possible (round-trip the feature) rather than structural (file exists).

## Bootstrap state

As of Phase 0, only `gate-template.sh` and `gate-A-01.sh` exist. Each agent writes their own gate scripts as they start each task. The Orchestrator reviews the gate alongside the implementation.

## Running

```bash
bash .agents/company-dev/checks/gate-<task-id>.sh
```

Run from anywhere — the script resolves the repo root via `$BASH_SOURCE`.

## Shared helpers

Put shared shell helpers in `.agents/company-dev/checks/lib/*.sh` and source them. Put longer Node-based round-trip scripts under `.agents/company-dev/checks/scripts/<task-id>-*.mjs` so the Bash gate stays readable.
