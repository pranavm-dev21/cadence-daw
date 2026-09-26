# Copilot Instructions for Cadence DAW

See [AGENTS.md](../AGENTS.md) for the full Ponytail ruleset and project-specific architecture constraints.

## Quick Reference
- AudioBackend seam: UI → AudioBackend interface only, never raw AudioNodes
- Command bus: All mutations via commands.ts → executors.ts
- Deterministic DSP: Seeded PRNG (mulberry32), never Math.random()
- FX pattern: Extend FxBase for new effects
- Testing: Pure normalize* functions are unit-testable without audio context
