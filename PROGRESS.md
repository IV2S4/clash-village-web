# Clash Village MVP Progress

Last updated: 2026-07-20

## Current state

The playable end-to-end MVP loop is complete:

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
- Three persistent, generated frontier raid targets with escalating defenses and
  resource spoils.
- Trailguard deployment, deterministic victory/defeat resolution, casualties,
  capped loot rewards, refreshed targets, and a persistent raid record.
- Raid rewards feed directly back into village building and troop progression.
- Responsive raid controls and result feedback verified at a 375px viewport.
- Dependency-free local server and 19 automated core game tests.

## MVP checklist

- [x] Build a village on a placement grid.
- [x] Gather resources over time.
- [x] Place resource and storage buildings.
- [x] Inspect and upgrade buildings.
- [x] Train troops using resources and elapsed time.
- [x] Choose a raid target and deploy trained troops.
- [x] Resolve a battle with victory/defeat, casualties, and loot.
- [x] Feed raid rewards back into village progression.
- [ ] Add onboarding and final responsive/accessibility polish.

## Next priority

The core MVP is playable from village construction through raids. Keep future
changes to light polish: add a compact first-session onboarding path that points
players from resource buildings to the Muster Lodge and first raid, then review
keyboard focus, contrast, and small-screen labels without expanding scope.
