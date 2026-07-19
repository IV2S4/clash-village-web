# Clash Village MVP Progress

Last updated: 2026-07-19

## Current state

The village-building and progression foundation is complete:

- Responsive original game interface with an 8×8 village grid.
- Three resources: timber, stone, and grain.
- Placeable Timber Yard, Stoneworks, Sunfield, and Storehouse buildings.
- Costs, passive production, resource caps, occupied-tile checks, and clear
  player feedback.
- A central Village Hearth and enough starting resources to make meaningful
  opening choices.
- Automatic local saves and up to four hours of offline production.
- Building inspection with level, output, cost, and upgrade requirements.
- Five upgrade levels with scaling costs and stronger production/capacity.
- Village Hearth progression that gates every other building's maximum level.
- Backward-compatible loading for saves created before building levels existed.
- New-village reset flow.
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

Add troop training. Introduce a placeable training building, at least two
original troop types with distinct costs and stats, a timed training queue, and
an army-capacity limit. Trained units and queue progress must persist across
reloads so the following slice can use the army in raids.
