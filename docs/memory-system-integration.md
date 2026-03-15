# Integrated Memory System

## Fork Baseline

MindClaw is currently a fork of the OpenClaw codebase at tag `v2026.3.13-1`, the `2026.03.13` stable line.

The product surface is now branded as MindClaw, but this memory subsystem was built by extending the OpenClaw runtime rather than replacing it wholesale. That matters for two reasons:

- the memory system is tightly integrated into the existing `context-engine` lifecycle instead of bolted on as a plugin sidecar
- compatibility is intentionally preserved for the current config and state layout, including legacy `.openclaw`, `openclaw.json`, and `OPENCLAW_*` paths while the MindClaw rename settles in

## Purpose

The integrated `memory-system` is the core memory engine for MindClaw.

It exists to turn raw transcript flow into a layered memory model that can:

- keep active working context coherent
- consolidate reusable knowledge over time
- preserve stable permanent knowledge in a structural node tree
- feed only relevant memory back into the prompt seen by the model

The design goal is not "store more transcript". The design goal is to make memory an active subsystem that selects, revises, adjudicates, retires, and reuses knowledge across sessions.

## Memory Layers

The subsystem maps the three-layer design from `dev_documentation.md` in the workspace root into the runtime:

### Short-Term Memory

Short-term memory is working memory for the current session and recent turn window.

It contains active context such as:

- recent transcript-derived events
- active goals and constraints
- recent outcomes
- active artifacts and workspace state
- carry-forward notes from review

It is high-availability memory, not permanent truth.

### Long-Term Memory

Long-term memory stores durable observations and compiled knowledge that should survive beyond the current working context.

This layer contains things like:

- recurring fixes and failure patterns
- scoped rules for customer, version, profile, or environment
- artifact-linked lessons
- strategies, constraints, and outcomes
- repeated observations that have become patterns

Long-term memory is adjudicated rather than blindly appended. It supports contradiction, supersession, scoped alternatives, revision history, and concept-level consolidation.

### Permanent Memory

Permanent memory is the structural node tree.

It is not the same thing as long-term memory. Only eligible durable knowledge is promoted into permanent branches. Permanent memory is used for the most stable operating knowledge such as:

- persistent constraints
- stable facts
- established patterns
- identity and preference branches
- project artifact structure under `projects/current-bot/artifacts`

Permanent memory also supports invalidation, pruning, and historical retirement so obsolete knowledge does not remain silently authoritative forever.

## Why It Lives In The Context Engine

The existing `context-engine` contract already owns the correct control points:

- `assemble()` builds the outward memory packet that sits between transcript state and prompt context
- `afterTurn()` analyzes new turns and decides what should remain working memory, become durable memory, or affect permanent state
- `compact()` and `review()` give the subsystem explicit consolidation checkpoints

This means memory sits in the path that actually determines what the model sees, rather than acting as an optional retrieval sidecar.

## Lifecycle

The memory lifecycle now works like this:

1. Runtime context arrives with transcript state plus structured signals such as artifacts, workspace state, branch, checkpoints, tool outcomes, diff signals, retries, and prompt-construction failures.
2. `assemble()` compiles a memory packet from short-term memory, ranked long-term memory, artifact anchors, graph traversal, and permanent memory.
3. The model receives that outward packet as part of prompt assembly.
4. `afterTurn()` compiles new observations, updates working memory, merges long-term candidates into concepts, records revisions and adjudications, and updates permanent memory.
5. `review()` runs at explicit checkpoints to consolidate, age, retire, carry forward, and prepare the next-session continuity state.

## Current Implementation Shape

The implementation is no longer a thin prototype. The important current behaviors are:

- working memory persists per session under `.openclaw-memory/sessions/<session>.json`
- durable memory supports `fs-json`, `sqlite-doc`, and `sqlite-graph` backends
- `sqlite-graph` stores memories, concepts, aliases, revisions, adjudications, permanent nodes, graph nodes, graph edges, and canonical entities as first-class rows
- retrieval is scope-aware, artifact-aware, graph-aware, entity-aware, and task-mode-aware
- long-term memory uses concept identity, revision tracking, contradiction handling, supersession, scoped alternatives, and evidence-based adjudication
- permanent memory is updated from adjudicated durable state rather than treated as a direct mirror
- diagnostics, acceptance, repair, export/import, and backup recovery are built into the subsystem

## Current Runtime Status

`memory-system` is the active integrated context engine for this fork. It is no longer just an optional experimental path documented for later activation.

## Compatibility Notes

MindClaw is rebranding the product surface, but compatibility is currently preserved on purpose:

- CLI branding: `mindclaw` is the primary surface, with `openclaw` retained as a compatibility alias
- config path: `openclaw.json` remains the active config name
- state path: `~/.openclaw` remains the active runtime home
- environment variables: legacy `OPENCLAW_*` names still apply

That means you can drop this fork in without also having to migrate config and state paths immediately.

## Operator References

For operational guidance, see:

- `docs/memory-system-architecture.md`
- `docs/memory-system-operations.md`
- `docs/memory-system-completion-roadmap.md`
