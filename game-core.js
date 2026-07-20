export const GRID_SIZE = 8;
export const RESOURCE_KEYS = ["timber", "stone", "grain"];
export const BASE_CAPACITY = 500;
export const MAX_OFFLINE_SECONDS = 4 * 60 * 60;
export const MAX_BUILDING_LEVEL = 4;

export const BUILDING_TYPES = Object.freeze({
  hearth: {
    name: "Village Hearth",
    icon: "◆",
    description: "Unlocks higher upgrade levels across the village.",
    cost: {},
    upgradeCost: { timber: 90, stone: 70, grain: 50 },
    production: {},
  },
  timberYard: {
    name: "Timber Yard",
    icon: "♣",
    description: "Turns nearby woodland into a steady timber supply.",
    cost: { stone: 25, grain: 10 },
    upgradeCost: { stone: 60, grain: 35 },
    production: { timber: 2 },
  },
  stoneworks: {
    name: "Stoneworks",
    icon: "⬢",
    description: "Cuts sturdy stone for village construction.",
    cost: { timber: 35, grain: 10 },
    upgradeCost: { timber: 70, grain: 35 },
    production: { stone: 1.5 },
  },
  field: {
    name: "Sunfield",
    icon: "✦",
    description: "Grows grain to feed workers and future troops.",
    cost: { timber: 25, stone: 10 },
    upgradeCost: { timber: 55, stone: 40 },
    production: { grain: 1.5 },
  },
  storehouse: {
    name: "Storehouse",
    icon: "▣",
    description: "Protects supplies and raises every resource capacity.",
    cost: { timber: 50, stone: 35, grain: 20 },
    upgradeCost: { timber: 80, stone: 65, grain: 40 },
    production: {},
    capacity: 300,
  },
});

export function createInitialState(now = Date.now()) {
  return {
    version: 1,
    resources: {
      timber: 150,
      stone: 100,
      grain: 80,
    },
    buildings: [
      {
        id: "hearth-1",
        type: "hearth",
        x: Math.floor(GRID_SIZE / 2) - 1,
        y: Math.floor(GRID_SIZE / 2) - 1,
        level: 1,
      },
    ],
    lastUpdated: now,
    nextBuildingId: 2,
  };
}

export function getBuildingLevel(building) {
  return Number.isInteger(building?.level) && building.level >= 1
    ? Math.min(building.level, MAX_BUILDING_LEVEL)
    : 1;
}

export function getLevelMultiplier(level) {
  return 1 + (Math.max(1, level) - 1) * 0.75;
}

export function getUpgradeCost(type, currentLevel) {
  const baseCost = BUILDING_TYPES[type]?.upgradeCost;
  if (!baseCost || currentLevel >= MAX_BUILDING_LEVEL) return null;

  const costMultiplier = 1.65 ** Math.max(0, currentLevel - 1);
  return Object.fromEntries(
    Object.entries(baseCost).map(([resource, amount]) => [
      resource,
      Math.ceil((amount * costMultiplier) / 5) * 5,
    ]),
  );
}

export function getHearthLevel(state) {
  const hearth = state.buildings.find((building) => building.type === "hearth");
  return getBuildingLevel(hearth);
}

export function getCapacity(state) {
  return (
    BASE_CAPACITY +
    state.buildings.reduce(
      (total, building) =>
        total +
        (BUILDING_TYPES[building.type]?.capacity ?? 0) *
          getLevelMultiplier(getBuildingLevel(building)),
      0,
    )
  );
}

export function getProductionRates(state) {
  const rates = Object.fromEntries(RESOURCE_KEYS.map((key) => [key, 0]));

  for (const building of state.buildings) {
    const production = BUILDING_TYPES[building.type]?.production ?? {};
    for (const [resource, amount] of Object.entries(production)) {
      rates[resource] +=
        amount * getLevelMultiplier(getBuildingLevel(building));
    }
  }

  return rates;
}

export function advanceState(state, now = Date.now()) {
  const elapsedSeconds = Math.min(
    Math.max(0, (now - state.lastUpdated) / 1000),
    MAX_OFFLINE_SECONDS,
  );

  if (elapsedSeconds === 0) {
    return state;
  }

  const rates = getProductionRates(state);
  const capacity = getCapacity(state);
  const resources = { ...state.resources };

  for (const resource of RESOURCE_KEYS) {
    resources[resource] = Math.min(
      capacity,
      resources[resource] + rates[resource] * elapsedSeconds,
    );
  }

  return { ...state, resources, lastUpdated: now };
}

export function canAfford(state, cost) {
  return Object.entries(cost).every(
    ([resource, amount]) => state.resources[resource] >= amount,
  );
}

export function getBuildingAt(state, x, y) {
  return state.buildings.find(
    (building) => building.x === x && building.y === y,
  );
}

export function placeBuilding(state, type, x, y, now = Date.now()) {
  const definition = BUILDING_TYPES[type];
  if (!definition || type === "hearth") {
    return { state, error: "That building cannot be placed." };
  }

  if (
    !Number.isInteger(x) ||
    !Number.isInteger(y) ||
    x < 0 ||
    y < 0 ||
    x >= GRID_SIZE ||
    y >= GRID_SIZE
  ) {
    return { state, error: "Choose a tile inside the village." };
  }

  const currentState = advanceState(state, now);
  if (getBuildingAt(currentState, x, y)) {
    return { state: currentState, error: "That tile is already occupied." };
  }

  if (!canAfford(currentState, definition.cost)) {
    return { state: currentState, error: "You need more resources." };
  }

  const resources = { ...currentState.resources };
  for (const [resource, amount] of Object.entries(definition.cost)) {
    resources[resource] -= amount;
  }

  const building = {
    id: `${type}-${currentState.nextBuildingId}`,
    type,
    x,
    y,
    level: 1,
  };

  return {
    state: {
      ...currentState,
      resources,
      buildings: [...currentState.buildings, building],
      nextBuildingId: currentState.nextBuildingId + 1,
    },
    building,
  };
}

export function upgradeBuilding(state, buildingId, now = Date.now()) {
  const currentState = advanceState(state, now);
  const buildingIndex = currentState.buildings.findIndex(
    (building) => building.id === buildingId,
  );

  if (buildingIndex === -1) {
    return { state: currentState, error: "That building no longer exists." };
  }

  const building = currentState.buildings[buildingIndex];
  const level = getBuildingLevel(building);
  if (level >= MAX_BUILDING_LEVEL) {
    return { state: currentState, error: "This building is fully upgraded." };
  }

  const nextLevel = level + 1;
  if (building.type !== "hearth" && nextLevel > getHearthLevel(currentState)) {
    return {
      state: currentState,
      error: `Upgrade the Village Hearth to level ${nextLevel} first.`,
    };
  }

  const cost = getUpgradeCost(building.type, level);
  if (!canAfford(currentState, cost)) {
    return { state: currentState, error: "You need more resources." };
  }

  const resources = { ...currentState.resources };
  for (const [resource, amount] of Object.entries(cost)) {
    resources[resource] -= amount;
  }

  const upgradedBuilding = { ...building, level: nextLevel };
  const buildings = [...currentState.buildings];
  buildings[buildingIndex] = upgradedBuilding;

  return {
    state: { ...currentState, resources, buildings },
    building: upgradedBuilding,
  };
}

export function hydrateState(value, now = Date.now()) {
  if (
    !value ||
    value.version !== 1 ||
    !value.resources ||
    !Array.isArray(value.buildings) ||
    !Number.isFinite(value.lastUpdated)
  ) {
    return createInitialState(now);
  }

  const validBuildings = value.buildings
    .filter(
      (building) =>
        BUILDING_TYPES[building.type] &&
        Number.isInteger(building.x) &&
        Number.isInteger(building.y) &&
        building.x >= 0 &&
        building.y >= 0 &&
        building.x < GRID_SIZE &&
        building.y < GRID_SIZE,
    )
    .map((building) => ({
      ...building,
      level: getBuildingLevel(building),
    }));

  const resources = Object.fromEntries(
    RESOURCE_KEYS.map((resource) => [
      resource,
      Number.isFinite(value.resources[resource])
        ? Math.max(0, value.resources[resource])
        : 0,
    ]),
  );

  return advanceState(
    {
      version: 1,
      resources,
      buildings: validBuildings,
      lastUpdated: value.lastUpdated,
      nextBuildingId: Number.isInteger(value.nextBuildingId)
        ? value.nextBuildingId
        : validBuildings.length + 1,
    },
    now,
  );
}
