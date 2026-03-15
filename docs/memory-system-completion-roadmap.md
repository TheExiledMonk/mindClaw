# Memory System Completion Roadmap

## Goal

This roadmap defines the remaining work required to take the integrated memory system from a strong production prototype to a production-ready subsystem that is trustworthy over long runs, multi-session use, and future agent expansion.

The phases are ordered by dependency, not by ease.

## Production Definition

The memory system is considered production-ready when all of the following are true:

- durable identity converges reliably across paraphrases, repeated sessions, and scoped variants
- contradictions, supersessions, and revisions are adjudicated through explicit policy rather than mostly heuristic overwrite rules
- permanent memory is ontology-led, auditable, and governed by clear promotion and invalidation rules
- structured SQLite persistence is the default durable store, with migrations and repair paths
- retrieval is explainable, scope-aware, and benchmarked against realistic multi-session scenarios
- runtime checkpoints, tool outcomes, and artifact/file state are integrated as first-class memory inputs
- observability exists for store health, memory quality, and retrieval/adjudication behavior

## Phase 1: Structured Concept Layer

### Objective

Separate durable memory observations from reusable concepts so revisions and paraphrases can converge on a concept rather than only a text record.

### Deliverables

- first-class concept persistence in `sqlite-graph`
- alias persistence in `sqlite-graph`
- concept reconstruction from structured rows
- mapping from durable memory entries to concept records
- concept-level audit information available to later compiler/retrieval stages

### Exit Criteria

- concepts persist independently of long-term memory blobs
- aliases survive reloads and reflect paraphrase history
- one concept can be linked to multiple durable memory observations
- tests cover concept persistence and alias reconstruction

## Phase 2: Revision And Adjudication Engine

### Objective

Turn current rule-based revision flags into a structured adjudication pipeline over concepts and observations.

### Deliverables

- explicit revision records
- adjudication states with history
- resolution policy for contradiction, supersession, refinement, narrowing, and scoped alternatives
- evidence weighting by source, recurrence, artifact anchoring, and recency
- carry-forward/review outputs driven by adjudication state

### Exit Criteria

- revision decisions are stored and inspectable
- contradictions can remain unresolved without collapsing concept identity
- superseded vs contested vs scoped-alternative behavior is deterministic and tested

## Phase 3: Permanent Ontology Hardening

### Objective

Formalize permanent memory as a schema-driven ontology rather than a tree inferred from categories and text.

### Deliverables

- explicit permanent node classes
- explicit edge classes and allowed parent/child relationships
- promotion rules from concept/adjudication state into permanent nodes
- invalidation, pruning, and historical layering rules
- branch-level auditability

### Exit Criteria

- permanent memory no longer relies on free-form branch inference alone
- obsolete or superseded permanent knowledge can be retired or historicalized cleanly
- ontology rules are tested

## Phase 4: Runtime Integration Expansion

### Objective

Feed the memory subsystem with richer structured signals from actual runtime behavior.

### Deliverables

- ingestion of tool outcomes
- ingestion of artifact/file diffs
- task completion and handoff checkpoints
- branch/workspace/environment change events
- explicit review triggers for task completion, sleep, handoff, and failure

### Exit Criteria

- memory no longer depends mainly on user-message text and compaction summaries
- runtime state materially affects compiler and retrieval decisions

## Phase 5: Retrieval And Compiler Maturity

### Objective

Make retrieval and compilation concept-driven, explainable, and benchmarkable.

### Deliverables

- concept-level retrieval passes
- concept deduplication in packets
- stronger provenance/explainability in retrieval audit
- explicit compiler stages: extraction, concept linking, revision classification, pattern synthesis, permanence proposal, review
- improved aging/compression tied to concept value rather than only time/access

### Exit Criteria

- packets do not surface near-duplicate memories for the same concept
- retrieval reasons clearly explain concept, scope, and adjudication relevance
- compiler stages are explicit in code and testable

## Phase 6: Store Operations And Migrations

### Objective

Make structured storage robust enough for upgrades, repair, and operational use.

### Deliverables

- schema versioning and migrations
- store integrity checks
- repair/rebuild tooling
- export/import tooling
- backend diagnostics and fallback behavior

### Exit Criteria

- store schema can evolve without destructive resets
- corrupted or partially written stores can be diagnosed and repaired

## Phase 7: Evaluation And Observability

### Objective

Prove the system works under realistic long-run conditions and make failures visible.

### Deliverables

- multi-session benchmark suite
- long-run drift tests
- scope bleed tests
- contradiction/supersession correctness tests
- backend parity tests
- metrics and diagnostics for concept counts, contested counts, permanent backlog, retrieval quality signals

### Exit Criteria

- the memory system has a repeatable acceptance suite
- regressions in identity, adjudication, permanence, or retrieval are detectable

## Current Priority Order

1. Phase 1: Structured Concept Layer
2. Phase 2: Revision And Adjudication Engine
3. Phase 3: Permanent Ontology Hardening
4. Phase 4: Runtime Integration Expansion
5. Phase 5: Retrieval And Compiler Maturity
6. Phase 6: Store Operations And Migrations
7. Phase 7: Evaluation And Observability

## What We Are Doing Next

The next active implementation target is Phase 1.

Specifically:

- persist concept rows in `sqlite-graph`
- persist alias rows in `sqlite-graph`
- reconstruct concept state on load
- test concept/alias persistence and reload behavior
