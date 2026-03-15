# Memory System Architecture

## Current Direction

The integrated memory system now has four explicit architecture layers:

1. Concept identity
   Each durable memory carries a `semanticKey`, stable `id`, `ontologyKind`, and adjudication state.

2. Revision and adjudication
   Contradictions move memories into a contested state. Supersession marks old memories as superseded and carries that status into retrieval, review, and permanent memory.

3. Runtime checkpoints
   The runner can trigger `review()` on compaction and on milestone-like checkpoints, not only during explicit manual review.

4. Storage backend seam
   The store persists a metadata file and resolves a backend through a dedicated backend interface. Only `fs-json` exists today, but the code no longer assumes raw file IO everywhere.

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

- `sqlite-graph`: structured node and edge storage with transactional updates
- `sqlite-hybrid`: structured records plus lightweight embedding lookup
- `lancedb-hybrid`: keep graph/metadata local and use vector search for recall

## Evaluation Priorities

- repeated equivalent instructions should converge on one durable identity
- contradictions should become contested rather than silently overwriting
- superseded memories should remain retrievable with downgrade notes when relevant
- permanent tree branches should reflect updated adjudication state in the same turn
- checkpoint review should trigger on milestones without spamming every turn
