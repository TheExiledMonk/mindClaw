# Integrated Memory System

This repository now includes a core `context-engine` implementation named `memory-system`.

It is designed to map the three memory layers from `dev_documentation.md` onto the existing OpenClaw runtime without treating memory as a sidecar plugin:

- Short-term memory: session-scoped working memory derived from the current transcript and exposed outward during prompt assembly.
- Long-term memory: distilled durable entries persisted across turns in `.openclaw-memory/long-term.json`.
- Permanent memory: a structural node tree persisted in `.openclaw-memory/permanent-tree.json`.

## Why the context-engine seam

The existing `context-engine` contract already owns the places your design needs:

- `assemble()` controls what memory packet is surfaced into the prompt.
- `afterTurn()` can analyze fresh turns and decide what graduates from short-term to long-term memory.
- `compact()` can remain on the proven legacy compaction path while still feeding compaction summaries back into memory state.

This keeps memory between raw transcript context and the prompt seen by the model.

## Current implementation shape

The initial implementation is intentionally conservative:

- It persists working memory per session under `.openclaw-memory/sessions/<session>.json`.
- It extracts durable long-term candidates from user turns using deterministic heuristics.
- It updates a permanent node tree with stable project, preference, identity, and operating-rule branches.
- It compiles a single outward-facing memory packet and injects it as `systemPromptAddition`.
- It delegates actual context compaction to the legacy engine for now.

## Activation

The legacy engine remains the default slot. To activate the new engine for your bot base, set:

```json
{
  "plugins": {
    "slots": {
      "contextEngine": "memory-system"
    }
  }
}
```

## Next recommended steps

1. Replace heuristic long-term promotion with a compiler pass that scores evidence, recurrence, and contradiction.
2. Make permanent tree updates schema-driven so project nodes, user identity nodes, and operating rules are explicit rather than inferred.
3. Move compaction ownership into `memory-system` once the compiler can produce canonical compressed working-memory state.
