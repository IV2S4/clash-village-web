import test from "node:test";
import assert from "node:assert/strict";
import {
  BASE_CAPACITY,
  MAX_OFFLINE_SECONDS,
  advanceState,
  createInitialState,
  getCapacity,
  getProductionRates,
  hydrateState,
  placeBuilding,
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
