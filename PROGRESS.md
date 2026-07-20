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
- Dependency-free local server and automated core-economy tests.

## MVP checklist

- [x] Build a village on a placement grid.
- [x] Gather resources over time.
- [x] Place resource and storage buildings.
- [x] Inspect and upgrade buildings.
- [ ] Train troops using resources and elapsed time.
- [ ] Choose a raid target and deploy trained troops.
- [ ] Resolve a battle with victory/defeat, casualties, and loot.
- [ ] Feed raid rewards back into village progression.
- [ ] Add onboarding and final responsive/accessibility polish.

## Next priority

Add troop training. Introduce an original training building and at least one
troop type, with resource costs, a small timed queue, persistent completion, and
a visible army count. Keep the first version compact so the trained army can
feed directly into the raid loop in the following slice.
