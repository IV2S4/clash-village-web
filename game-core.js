export const GRID_SIZE = 8;
export const RESOURCE_KEYS = ["timber", "stone", "grain"];
export const BASE_CAPACITY = 500;
export const MAX_OFFLINE_SECONDS = 4 * 60 * 60;
export const MAX_BUILDING_LEVEL = 5;

export const BUILDING_TYPES = Object.freeze({
  hearth: {
    name: "Village Hearth",
    icon: "◆",
    description: "The heart of your settlement.",
    cost: {},
    production: {},
    upgradeCost: { timber: 100, stone: 70, grain: 50 },
  },
  timberYard: {
    name: "Timber Yard",
    icon: "♣",
    description: "Produces 2 timber each second.",
    cost: { stone: 25, grain: 10 },
    production: { timber: 2 },
    upgradeCost: { timber: 30, stone: 40, grain: 20 },
  },
  stoneworks: {
    name: "Stoneworks",
    icon: "⬢",
    description: "Produces 1.5 stone each second.",
    cost: { timber: 35, grain: 10 },
    production: { stone: 1.5 },
    upgradeCost: { timber: 45, stone: 25, grain: 20 },
  },
  field: {
    name: "Sunfield",
    icon: "✦",
    description: "Produces 1.5 grain each second.",
    cost: { timber: 25, stone: 10 },
    production: { grain: 1.5 },
    upgradeCost: { timber: 35, stone: 25, grain: 15 },
  },
  storehouse: {
    name: "Storehouse",
    icon: "▣",
    description: "Raises every resource capacity by 300.",
    cost: { timber: 50, stone: 35, grain: 20 },
    production: {},
    capacity: 300,
    upgradeCost: { timber: 70, stone: 55, grain: 30 },
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

export function getCapacity(state) {
  return (
    BASE_CAPACITY +
    state.buildings.reduce(
      (total, building) =>
        total +
        (BUILDING_TYPES[building.type]?.capacity ?? 0) *
          getBuildingLevel(building),
      0,
    )
  );
}

export function getProductionRates(state) {
  const rates = Object.fromEntries(RESOURCE_KEYS.map((key) => [key, 0]));

  for (const building of state.buildings) {
    const production = BUILDING_TYPES[building.type]?.production ?? {};
    for (const [resource, amount] of Object.entries(production)) {
      rates[resource] += amount * getBuildingLevel(building);
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

export function getBuildingLevel(building) {
  return Number.isInteger(building?.level)
    ? Math.min(MAX_BUILDING_LEVEL, Math.max(1, building.level))
    : 1;
}

export function getHearthLevel(state) {
  return getBuildingLevel(
    state.buildings.find((building) => building.type === "hearth"),
  );
}

export function getUpgradeCost(building) {
  const definition = BUILDING_TYPES[building?.type];
  if (!definition) return {};

  const multiplier = 1.6 ** (getBuildingLevel(building) - 1);
  return Object.fromEntries(
    Object.entries(definition.upgradeCost).map(([resource, amount]) => [
      resource,
      Math.ceil((amount * multiplier) / 5) * 5,
    ]),
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
  const building = currentState.buildings.find(
    (candidate) => candidate.id === buildingId,
  );

  if (!building) {
    return { state: currentState, error: "That building could not be found." };
  }

  const currentLevel = getBuildingLevel(building);
  if (currentLevel >= MAX_BUILDING_LEVEL) {
    return { state: currentState, error: "This building is fully upgraded." };
  }

  if (
    building.type !== "hearth" &&
    currentLevel >= getHearthLevel(currentState)
  ) {
    return {
      state: currentState,
      error: `Upgrade the Village Hearth to level ${currentLevel + 1} first.`,
    };
  }

  const cost = getUpgradeCost(building);
  if (!canAfford(currentState, cost)) {
    return { state: currentState, error: "You need more resources to upgrade." };
  }

  const resources = { ...currentState.resources };
  for (const [resource, amount] of Object.entries(cost)) {
    resources[resource] -= amount;
  }

  const upgradedBuilding = { ...building, level: currentLevel + 1 };
  return {
    state: {
      ...currentState,
      resources,
      buildings: currentState.buildings.map((candidate) =>
        candidate.id === buildingId ? upgradedBuilding : candidate,
      ),
    },
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
