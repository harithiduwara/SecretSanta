# ADR-0003: Randomized bipartite matching for draws

- **Status:** Accepted
- **Date:** 2026-11-16

## Context

Naive "shuffle and retry" draws fail unpredictably with many exclusions and can loop forever on infeasible
configurations; enterprise rosters may have thousands of people and department rules.

## Decision

Model the draw as a perfect matching in the bipartite graph _givers × receivers_ with edges for allowed pairs.
Use Kuhn's augmenting-path algorithm over adjacency lists shuffled with a CSPRNG, processing givers in random order.
Reciprocal pairs (A↔B) are removed afterwards by randomized local 2-swaps. An optional single-cycle mode uses a
bounded randomized DFS. All results are re-validated independently.

## Consequences

- ✅ Polynomial time; if any valid assignment exists, random mode finds one (or reports infeasibility clearly).
- ✅ Statistically verified to produce all valid derangements for small groups.
- ⚠️ Distribution is not perfectly uniform over all valid matchings under heavy constraints (acceptable for the
  domain; documented here).
- ⚠️ Single-loop mode is NP-hard in general; bounded search may report failure on highly constrained rosters.
