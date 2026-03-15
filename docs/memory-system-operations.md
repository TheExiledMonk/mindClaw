# Memory System Operations

## Purpose

This document is the operator-facing entry point for inspecting, validating, and recovering the integrated memory system.

The memory stack now supports:

- working, long-term, and permanent memory layers
- structured `sqlite-graph` persistence
- review/adjudication with contested, scoped-alternative, superseded, and fragile-winner signals
- export/import, repair, and recovery
- acceptance validation over realistic lifecycle scenarios

## Primary Commands

### Diagnostics JSON

```bash
pnpm memory:diagnostics --session my-session --backend sqlite-graph --acceptance
```

Use this when another tool or script needs the full structured report.

### Diagnostics Summary

```bash
pnpm memory:diagnostics:summary --session my-session --backend sqlite-graph --acceptance
```

Use this for quick terminal checks or CI logs.

### Diagnostics Markdown

```bash
pnpm memory:diagnostics:markdown --session my-session --backend sqlite-graph --acceptance --out .artifacts/memory/report.md
```

Use this when you want a shareable operator report.

### Strict Production Gate

```bash
pnpm memory:diagnostics \
  --session my-session \
  --backend sqlite-graph \
  --acceptance \
  --acceptance-backend fs-json \
  --acceptance-backend sqlite-graph \
  --fail-on-acceptance \
  --fail-on-weak-winners \
  --fail-on-fragile-winners \
  --fail-on-entity-conflicts \
  --format summary
```

Use this before promotion or release validation.

### Repair

```bash
pnpm memory:diagnostics --session my-session --backend sqlite-graph --run-repair --format summary
```

This rewrites sanitized durable state and store metadata when the store is structurally valid but needs cleanup.

### Recovery

```bash
pnpm memory:diagnostics --session my-session --backend sqlite-graph --run-recover --format summary
```

This restores from the backup bundle when the SQLite store is unreadable or corrupted.

## What To Watch

### Health issues

- `contested concepts`
- `entity-linked contested concepts`
- `weak-evidence winners`
- `fragile authoritative winners`
- `superseded memory backlog`
- `stale memory backlog`
- `backup bundle missing`

### What the signals mean

- `weak-evidence winners`: authoritative winners still depend on lower-trust evidence classes
- `fragile winners`: an authoritative winner exists, but the margin over nearby alternatives is too small to treat as highly stable
- `entity-linked contested concepts`: multiple concepts tied to the same canonical entity family are still unresolved

## Acceptance Coverage

The acceptance suite currently covers:

- drift stability
- scope isolation
- contested visibility
- entity resolution
- evidence priority
- weak-evidence governance
- rivalry governance
- session handoff continuity
- backend parity
- runtime lifecycle
- permanence invalidation
- store recovery
- mixed lifecycle soak
- project lifecycle long run
- scope matrix resilience

## Recommended Release Workflow

1. Run diagnostics in summary mode.
2. Run diagnostics again with acceptance and strict failure flags.
3. If issues remain, inspect contested, fragile, or weak winners before release.
4. If the store is unhealthy, run repair or recovery and rerun diagnostics.
5. Save a markdown report for release evidence if needed.

## Current Backend Guidance

- Use `sqlite-graph` as the default durable backend.
- Keep `fs-json` available for parity checks and simple recovery flows.
- Treat `sqlite-doc` as transitional rather than the preferred production target.
