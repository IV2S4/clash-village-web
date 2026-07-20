export const GRID_SIZE = 8;
export const RESOURCE_KEYS = ["timber", "stone", "grain"];
export const BASE_CAPACITY = 500;
export const MAX_OFFLINE_SECONDS = 4 * 60 * 60;
export const MAX_BUILDING_LEVEL = 4;
export const TRAINING_QUEUE_BASE_CAPACITY = 3;

export const TROOP_TYPES = Object.freeze({
  trailguard: {
    name: "Trailguard",
    icon: "▲",
    description: "A steady village defender ready for frontier raids.",
    cost: { grain: 30, timber: 10 },
    trainingSeconds: 8,
    power: 12,
  },
});

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
  musterLodge: {
    name: "Muster Lodge",
    icon: "⚑",
    description: "Trains Trailguards and expands the village training queue.",
    cost: { timber: 80, stone: 55, grain: 35 },
    upgradeCost: { timber: 90, stone: 75, grain: 60 },
    production: {},
    trainingCapacity: TRAINING_QUEUE_BASE_CAPACITY,
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
    army: {
      trailguard: 0,
    },
    trainingQueue: [],
    lastUpdated: now,
    nextBuildingId: 2,
    nextTrainingId: 1,
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

export function getTrainingQueueCapacity(state) {
  return state.buildings.reduce((total, building) => {
    const baseCapacity = BUILDING_TYPES[building.type]?.trainingCapacity ?? 0;
    if (!baseCapacity) return total;
    return total + baseCapacity + getBuildingLevel(building) - 1;
  }, 0);
}

export function advanceState(state, now = Date.now()) {
  const elapsedSeconds = Math.min(
    Math.max(0, (now - state.lastUpdated) / 1000),
    MAX_OFFLINE_SECONDS,
  );
  const rates = getProductionRates(state);
  const capacity = getCapacity(state);
  const resources = { ...state.resources };

  if (elapsedSeconds > 0) {
    for (const resource of RESOURCE_KEYS) {
      resources[resource] = Math.min(
        capacity,
        resources[resource] + rates[resource] * elapsedSeconds,
      );
    }
  }

  const completed = state.trainingQueue.filter((item) => item.finishesAt <= now);
  const trainingQueue = state.trainingQueue.filter((item) => item.finishesAt > now);
  const army = { ...state.army };
  for (const item of completed) {
    army[item.troopType] = (army[item.troopType] ?? 0) + 1;
  }

  if (elapsedSeconds === 0 && completed.length === 0) return state;
  return { ...state, resources, army, trainingQueue, lastUpdated: now };
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

export function trainTroop(state, troopType, now = Date.now()) {
  const currentState = advanceState(state, now);
  const definition = TROOP_TYPES[troopType];
  if (!definition) {
    return { state: currentState, error: "That troop cannot be trained." };
  }

  const queueCapacity = getTrainingQueueCapacity(currentState);
  if (queueCapacity === 0) {
    return { state: currentState, error: "Build a Muster Lodge before training troops." };
  }

  if (currentState.trainingQueue.length >= queueCapacity) {
    return { state: currentState, error: "The training queue is full." };
  }

  if (!canAfford(currentState, definition.cost)) {
    return { state: currentState, error: "You need more resources." };
  }

  const resources = { ...currentState.resources };
  for (const [resource, amount] of Object.entries(definition.cost)) {
    resources[resource] -= amount;
  }

  const previousFinish = currentState.trainingQueue.at(-1)?.finishesAt ?? now;
  const training = {
    id: `training-${currentState.nextTrainingId}`,
    troopType,
    finishesAt:
      Math.max(now, previousFinish) + definition.trainingSeconds * 1000,
  };

  return {
    state: {
      ...currentState,
      resources,
      trainingQueue: [...currentState.trainingQueue, training],
      nextTrainingId: currentState.nextTrainingId + 1,
    },
    training,
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
  const army = Object.fromEntries(
    Object.keys(TROOP_TYPES).map((troopType) => [
      troopType,
      Number.isInteger(value.army?.[troopType])
        ? Math.max(0, value.army[troopType])
        : 0,
    ]),
  );
  const trainingQueue = Array.isArray(value.trainingQueue)
    ? value.trainingQueue.filter(
        (item) =>
          TROOP_TYPES[item?.troopType] &&
          typeof item.id === "string" &&
          Number.isFinite(item.finishesAt),
      )
    : [];

  return advanceState(
    {
      version: 1,
      resources,
      buildings: validBuildings,
      army,
      trainingQueue,
      lastUpdated: value.lastUpdated,
      nextBuildingId: Number.isInteger(value.nextBuildingId)
        ? value.nextBuildingId
        : validBuildings.length + 1,
      nextTrainingId: Number.isInteger(value.nextTrainingId)
        ? value.nextTrainingId
        : trainingQueue.length + 1,
    },
    now,
  );
}
