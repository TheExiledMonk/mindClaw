# Memory System Architecture

## Current Direction

The integrated memory system now has four explicit architecture layers:

1. Concept identity
   Each durable memory carries a `semanticKey`, stable `id`, `conceptKey`, canonical text, alias history, `ontologyKind`, and adjudication state.

   Equivalent memories can now also attach through a second-stage concept matcher when wording changes but category, artifact, and scope overlap still indicate the same concept.

2. Revision and adjudication
   Contradictions move memories into a contested state. Supersession marks old memories as superseded and carries that status into retrieval, review, and permanent memory.
   Durable merges also classify revisions as `reasserted`, `updated`, `narrowed`, or `contested`.

3. Runtime checkpoints
   The runner can trigger `review()` on compaction and on milestone-like checkpoints, not only during explicit manual review.

4. Storage backend seam
   The store persists through a dedicated backend interface. `fs-json` remains the simplest backend, `sqlite-doc` stores the same logical documents in a single SQLite file, and `sqlite-graph` now persists memories, permanent nodes, graph nodes, and graph edges as first-class SQLite rows.

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
