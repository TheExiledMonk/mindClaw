# Memory System Architecture

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

The largest remaining production gaps are not plumbing gaps. They are deeper semantic refinement and broader long-run benchmark breadth.
