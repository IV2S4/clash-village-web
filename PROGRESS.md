# Clash Village MVP Progress

Last updated: 2026-07-19

## Current state

The village economy and progression foundation is complete:

- Responsive original game interface with an 8×8 village grid.
- Three resources: timber, stone, and grain.
- Placeable Timber Yard, Stoneworks, Sunfield, and Storehouse buildings.
- Costs, passive production, resource caps, occupied-tile checks, and clear
  player feedback.
- A central Village Hearth and enough starting resources to make meaningful
  opening choices.
- Automatic local saves and up to four hours of offline production.
- New-village reset flow.
- Selectable building inspector with current effects, upgrade costs, and clear
  locked/affordable/max-level states.
- Four persistent building levels with scaling production and storage.
- Village Hearth progression gates upgrades for every other structure.
- Placeable Muster Lodge with level-scaled training queue capacity.
- Trainable original Trailguard troops with resource costs, sequential timers,
  persistent queue state, offline completion, and a visible ready-army count.
- Dependency-free local server and automated core-economy tests.

## MVP checklist

- [x] Build a village on a placement grid.
- [x] Gather resources over time.
- [x] Place resource and storage buildings.
- [x] Inspect and upgrade buildings.
- [x] Train troops using resources and elapsed time.
- [ ] Choose a raid target and deploy trained troops.
- [ ] Resolve a battle with victory/defeat, casualties, and loot.
- [ ] Feed raid rewards back into village progression.
- [ ] Add onboarding and final responsive/accessibility polish.

## Next priority

Add the first raid loop. Present a small choice of generated frontier targets,
let the player deploy trained Trailguards, and resolve victory or defeat with
casualties and resource loot. Persist the result so raid rewards feed directly
back into village progression.
