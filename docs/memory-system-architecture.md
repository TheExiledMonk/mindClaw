# Memory System Architecture

## Fork Status

MindClaw currently forks the OpenClaw codebase from tag `v2026.3.13-1`, the `2026.03.13` stable line, and extends that runtime with a deeply integrated memory subsystem.

The product rename does not yet imply a full config/state migration. Runtime compatibility remains intentionally aligned with the inherited OpenClaw layout for now:

- `mindclaw` is the primary CLI surface
- `openclaw` still works as a compatibility alias
- config still lives in `openclaw.json`
- runtime state still lives under `~/.openclaw`
- legacy `OPENCLAW_*` environment variables are still valid

## System Shape

The memory system is built around three memory layers plus a compiler/retrieval pipeline:

1. Short-term working memory
   Session-scoped active context, recent events, active goals, active constraints, carry-forward notes, and recent artifact/workspace state.

2. Long-term durable memory
   Concepts, observations, revisions, adjudications, patterns, and scoped knowledge that survive across turns and sessions.

3. Permanent memory
   Structural node-tree memory for the most stable constraints, facts, patterns, identity, preferences, and project artifact structure.

4. Compiler and retrieval pipeline
   The machinery that decides what gets stored, what gets revised, what gets retired, and what gets surfaced back into the prompt.

## Current Direction

The integrated memory system is now much closer to a production architecture than a prototype. The most important layers are:

1. Concept identity
   Each durable memory carries a `semanticKey`, stable `id`, `conceptKey`, canonical text, alias history, `ontologyKind`, and adjudication state.

   Equivalent memories can now also attach through a second-stage concept matcher when wording changes but category, artifact, and scope overlap still indicate the same concept.

2. Revision and adjudication
   Contradictions move memories into a contested state. Supersession marks old memories as superseded and carries that status into retrieval, review, and permanent memory.
   Durable merges also classify revisions as `reasserted`, `updated`, `narrowed`, or `contested`.

3. Runtime checkpoints
   The runner can trigger `review()` on compaction and on milestone-like checkpoints, not only during explicit manual review.

4. Canonical entities
   Durable memories can now carry persisted canonical `entityIds` in addition to alias bags. Retrieval, concept matching, and adjudication can all reason over shared entity families instead of only text and scope overlap.

5. Storage backend seam
   The store persists through a dedicated backend interface. `fs-json` remains the simplest backend, `sqlite-doc` stores the same logical documents in a single SQLite file, and `sqlite-graph` persists memories, concepts, revisions, adjudications, permanent nodes, graph nodes, graph edges, and canonical entities as first-class SQLite rows.

## Lifecycle Summary

The practical flow is:

1. ingest transcript plus structured runtime signals
2. maintain short-term working memory
3. compile durable observations into long-term concepts
4. adjudicate contradictions, revisions, supersessions, and scoped alternatives
5. update permanent memory only from eligible durable state
6. retrieve a scoped, ranked, explainable memory packet for the next turn

This keeps the memory system between raw context and the outward prompt instead of leaving memory as an optional retrieval addon.

## Permanent Promotion Policy

Permanent memory is no longer a direct mirror of long-term memory.

- `eligible`: high-confidence constraints, critical memories, revised memories, or durable artifact-anchored memories
- `deferred`: durable memories that are useful but still lack enough evidence for permanent retention
- `blocked`: superseded, temporary, or contested memories that should not become permanent truth

Blocked or deferred memories can still remain in long-term memory and retrieval; the policy only governs what may become structural permanent memory.

## Permanent Ontology

Permanent memory is now intended to be ontology-led rather than category-led:

- `constraints`
- `patterns`
- `outcomes`
- `facts`
- `identity`
- `preferences`
- project artifact branches under `projects/current-bot/artifacts`

This is still a first formalization, not a final schema.

## Next Backend Candidates

- `sqlite-hybrid`: structured records plus lightweight embedding lookup
- `lancedb-hybrid`: keep graph/metadata local and use vector search for recall

## Evaluation Priorities

- repeated equivalent instructions should converge on one durable identity
- contradictions should become contested rather than silently overwriting
- superseded memories should remain retrievable with downgrade notes when relevant
- permanent tree branches should reflect updated adjudication state in the same turn
- checkpoint review should trigger on milestones without spamming every turn
- scope matrices across customer/version/profile/environment combinations should not bleed
- weak or fragile winners should be visible to operators before release

## Operator State

Current operator-facing capabilities now include:

- diagnostics in `json`, `summary`, and `markdown` formats
- acceptance validation and release-style failure gates
- repair and backup-based recovery
- explicit health signals for contested concepts, weak winners, fragile winners, and scope alternatives

## Current Production Posture

This is now in strong production-ready territory for an engineered memory system:

- the architecture is integrated rather than bolted on
- durable state is structured and recoverable
- adjudication and scope governance are explicit
- permanent memory is governed rather than append-only
- operator tooling and acceptance validation exist

The largest remaining gaps are no longer basic plumbing. They are broader soak breadth, deeper semantic refinement, and any future decision to migrate config/state naming from inherited OpenClaw paths to MindClaw-native ones.
