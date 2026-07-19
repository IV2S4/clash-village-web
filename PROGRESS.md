# Clash Village MVP Progress

Last updated: 2026-07-19

## Current state

The first playable village-building slice is complete:

- Responsive original game interface with an 8×8 village grid.
- Three resources: timber, stone, and grain.
- Placeable Timber Yard, Stoneworks, Sunfield, and Storehouse buildings.
- Costs, passive production, resource caps, occupied-tile checks, and clear
  player feedback.
- A central Village Hearth and enough starting resources to make meaningful
  opening choices.
- Automatic local saves and up to four hours of offline production.
- New-village reset flow.
- Dependency-free local server and automated core-economy tests.

## MVP checklist

- [x] Build a village on a placement grid.
- [x] Gather resources over time.
- [x] Place resource and storage buildings.
- [ ] Inspect and upgrade buildings.
- [ ] Train troops using resources and elapsed time.
- [ ] Choose a raid target and deploy trained troops.
- [ ] Resolve a battle with victory/defeat, casualties, and loot.
- [ ] Feed raid rewards back into village progression.
- [ ] Add onboarding and final responsive/accessibility polish.

## Next priority

Add building inspection and upgrades. Each producer should have levels,
increasing upgrade costs and stronger production; the Hearth level should gate
the maximum level of other buildings. This creates the progression layer needed
before troop training and raids are introduced.
