import test from "node:test";
import assert from "node:assert/strict";
import {
  BASE_CAPACITY,
  MAX_OFFLINE_SECONDS,
  advanceState,
  createInitialState,
  getBuildingLevel,
  getCapacity,
  getProductionRates,
  getTrainingQueueCapacity,
  getUpgradeCost,
  hydrateState,
  placeBuilding,
  trainTroop,
  upgradeBuilding,
} from "./game-core.js";

test("a new village starts with a hearth and starter resources", () => {
  const state = createInitialState(1_000);

  assert.equal(state.buildings.length, 1);
  assert.equal(state.buildings[0].type, "hearth");
  assert.deepEqual(state.resources, { timber: 150, stone: 100, grain: 80 });
});

test("placing a producer deducts its cost and starts production", () => {
  const initial = createInitialState(1_000);
  const result = placeBuilding(initial, "timberYard", 0, 0, 1_000);

  assert.equal(result.error, undefined);
  assert.equal(result.state.resources.stone, 75);
  assert.equal(result.state.resources.grain, 70);
  assert.equal(getProductionRates(result.state).timber, 2);

  const advanced = advanceState(result.state, 11_000);
  assert.equal(advanced.resources.timber, 170);
});

test("placement rejects occupied tiles without charging resources", () => {
  const initial = createInitialState(1_000);
  const hearth = initial.buildings[0];
  const result = placeBuilding(
    initial,
    "stoneworks",
    hearth.x,
    hearth.y,
    1_000,
  );

  assert.equal(result.error, "That tile is already occupied.");
  assert.deepEqual(result.state.resources, initial.resources);
});

test("placement rejects purchases the village cannot afford", () => {
  const initial = {
    ...createInitialState(1_000),
    resources: { timber: 0, stone: 0, grain: 0 },
  };
  const result = placeBuilding(initial, "storehouse", 0, 0, 1_000);

  assert.equal(result.error, "You need more resources.");
  assert.equal(result.state.buildings.length, 1);
});

test("storehouses raise capacity and production never exceeds it", () => {
  const initial = createInitialState(1_000);
  const storehouse = placeBuilding(initial, "storehouse", 0, 0, 1_000).state;
  const producing = placeBuilding(storehouse, "timberYard", 1, 0, 1_000).state;

  assert.equal(getCapacity(producing), BASE_CAPACITY + 300);
  assert.equal(
    advanceState(producing, 1_000 + 1_000_000).resources.timber,
    BASE_CAPACITY + 300,
  );
});

test("offline gains are capped at four hours", () => {
  const initial = createInitialState(1_000);
  const producing = placeBuilding(initial, "timberYard", 0, 0, 1_000).state;
  const highCapacity = {
    ...producing,
    buildings: [
      ...producing.buildings,
      ...Array.from({ length: 100 }, (_, index) => ({
        id: `store-${index}`,
        type: "storehouse",
        x: 1,
        y: 1,
      })),
    ],
  };
  const advanced = advanceState(
    highCapacity,
    1_000 + (MAX_OFFLINE_SECONDS + 500) * 1000,
  );

  assert.equal(
    advanced.resources.timber,
    highCapacity.resources.timber + MAX_OFFLINE_SECONDS * 2,
  );
});

test("invalid saves fall back to a fresh village", () => {
  const state = hydrateState({ version: 99 }, 5_000);

  assert.equal(state.lastUpdated, 5_000);
  assert.equal(state.buildings[0].type, "hearth");
});

test("legacy saves gain valid level-one buildings", () => {
  const legacy = createInitialState(1_000);
  delete legacy.buildings[0].level;

  const state = hydrateState(legacy, 1_000);

  assert.equal(getBuildingLevel(state.buildings[0]), 1);
  assert.equal(state.buildings[0].level, 1);
});

test("the hearth gates upgrades for other buildings", () => {
  const richVillage = {
    ...createInitialState(1_000),
    resources: { timber: 1_000, stone: 1_000, grain: 1_000 },
  };
  const withYard = placeBuilding(
    richVillage,
    "timberYard",
    0,
    0,
    1_000,
  ).state;

  const blocked = upgradeBuilding(withYard, "timberYard-2", 1_000);
  assert.equal(blocked.error, "Upgrade the Village Hearth to level 2 first.");

  const hearthUpgraded = upgradeBuilding(withYard, "hearth-1", 1_000).state;
  const yardUpgraded = upgradeBuilding(
    hearthUpgraded,
    "timberYard-2",
    1_000,
  );

  assert.equal(yardUpgraded.error, undefined);
  assert.equal(yardUpgraded.building.level, 2);
  assert.equal(getProductionRates(yardUpgraded.state).timber, 3.5);
});

test("upgrades deduct scaling costs and improve storehouse capacity", () => {
  const richVillage = {
    ...createInitialState(1_000),
    resources: { timber: 1_000, stone: 1_000, grain: 1_000 },
  };
  const withStorehouse = placeBuilding(
    richVillage,
    "storehouse",
    0,
    0,
    1_000,
  ).state;
  const hearthUpgraded = upgradeBuilding(
    withStorehouse,
    "hearth-1",
    1_000,
  ).state;
  const cost = getUpgradeCost("storehouse", 1);
  const upgraded = upgradeBuilding(
    hearthUpgraded,
    "storehouse-2",
    1_000,
  ).state;

  assert.equal(
    upgraded.resources.timber,
    hearthUpgraded.resources.timber - cost.timber,
  );
  assert.equal(getCapacity(upgraded), BASE_CAPACITY + 300 * 1.75);
  assert.deepEqual(getUpgradeCost("storehouse", 4), null);
});

test("a Muster Lodge enables a paid timed training queue", () => {
  const initial = createInitialState(1_000);
  const withLodge = placeBuilding(initial, "musterLodge", 0, 0, 1_000).state;
  const result = trainTroop(withLodge, "trailguard", 1_000);

  assert.equal(result.error, undefined);
  assert.equal(result.state.resources.timber, withLodge.resources.timber - 10);
  assert.equal(result.state.resources.grain, withLodge.resources.grain - 30);
  assert.equal(result.state.trainingQueue.length, 1);
  assert.equal(result.training.finishesAt, 9_000);
  assert.equal(result.state.army.trailguard, 0);
});

test("queued troops complete sequentially while the village is away", () => {
  const richVillage = {
    ...createInitialState(1_000),
    resources: { timber: 1_000, stone: 1_000, grain: 1_000 },
  };
  let state = placeBuilding(richVillage, "musterLodge", 0, 0, 1_000).state;
  state = trainTroop(state, "trailguard", 1_000).state;
  state = trainTroop(state, "trailguard", 1_000).state;

  assert.deepEqual(
    state.trainingQueue.map((item) => item.finishesAt),
    [9_000, 17_000],
  );

  const oneComplete = advanceState(state, 10_000);
  assert.equal(oneComplete.army.trailguard, 1);
  assert.equal(oneComplete.trainingQueue.length, 1);

  const allComplete = advanceState(oneComplete, 20_000);
  assert.equal(allComplete.army.trailguard, 2);
  assert.equal(allComplete.trainingQueue.length, 0);
});

test("training requires a lodge, resources, and an open queue slot", () => {
  const initial = createInitialState(1_000);
  assert.equal(
    trainTroop(initial, "trailguard", 1_000).error,
    "Build a Muster Lodge before training troops.",
  );

  let state = placeBuilding(initial, "musterLodge", 0, 0, 1_000).state;
  assert.equal(getTrainingQueueCapacity(state), 3);
  state = {
    ...state,
    resources: { timber: 1_000, stone: 1_000, grain: 1_000 },
  };
  for (let index = 0; index < 3; index += 1) {
    state = trainTroop(state, "trailguard", 1_000).state;
  }
  assert.equal(
    trainTroop(state, "trailguard", 1_000).error,
    "The training queue is full.",
  );

  const poorVillage = { ...state, trainingQueue: [], resources: { timber: 0, stone: 0, grain: 0 } };
  assert.equal(
    trainTroop(poorVillage, "trailguard", 1_000).error,
    "You need more resources.",
  );
});

test("legacy saves hydrate with an empty army and training queue", () => {
  const legacy = createInitialState(1_000);
  delete legacy.army;
  delete legacy.trainingQueue;
  delete legacy.nextTrainingId;

  const state = hydrateState(legacy, 1_000);
  assert.deepEqual(state.army, { trailguard: 0 });
  assert.deepEqual(state.trainingQueue, []);
  assert.equal(state.nextTrainingId, 1);
});
