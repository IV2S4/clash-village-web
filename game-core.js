export const GRID_SIZE = 8;
export const RESOURCE_KEYS = ["timber", "stone", "grain"];
export const BASE_CAPACITY = 500;
export const MAX_OFFLINE_SECONDS = 4 * 60 * 60;
export const MAX_BUILDING_LEVEL = 4;
export const TRAINING_QUEUE_BASE_CAPACITY = 3;
export const RAID_TARGET_COUNT = 3;
export const ONBOARDING_STEP_COUNT = 4;

const RAID_NAME_PREFIXES = [
  "Briar",
  "Cinder",
  "Dusk",
  "Moss",
  "Raven",
  "Thorn",
];
const RAID_NAME_SUFFIXES = [
  "Crossing",
  "Hollow",
  "Outpost",
  "Redoubt",
  "Stockade",
  "Watch",
];

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
  const raidOptions = generateRaidTargets(now);
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
    raidTargets: raidOptions.targets,
    raidStats: { wins: 0, losses: 0 },
    lastRaid: null,
    lastUpdated: now,
    nextBuildingId: 2,
    nextTrainingId: 1,
    nextRaidSeed: raidOptions.nextSeed,
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

export function getOnboardingProgress(state) {
  const raidAttempts =
    (state.raidStats?.wins ?? 0) + (state.raidStats?.losses ?? 0);
  const milestones = [
    state.buildings.some((building) =>
      ["timberYard", "stoneworks", "field"].includes(building.type),
    ),
    state.buildings.some((building) => building.type === "musterLodge"),
    raidAttempts > 0 ||
      (state.army?.trailguard ?? 0) > 0 ||
      (state.trainingQueue?.length ?? 0) > 0,
    raidAttempts > 0,
  ];
  const nextStepIndex = milestones.findIndex((complete) => !complete);

  return {
    completedSteps: milestones.filter(Boolean).length,
    currentStepIndex:
      nextStepIndex === -1 ? ONBOARDING_STEP_COUNT : nextStepIndex,
    isComplete: nextStepIndex === -1,
    milestones,
  };
}

function nextRandom(seed) {
  return (Math.imul(seed, 1_664_525) + 1_013_904_223) >>> 0;
}

export function generateRaidTargets(seed = Date.now(), hearthLevel = 1) {
  let randomState = Number.isFinite(seed) ? Math.floor(seed) >>> 0 : 1;
  const targets = Array.from({ length: RAID_TARGET_COUNT }, (_, index) => {
    randomState = nextRandom(randomState);
    const prefix = RAID_NAME_PREFIXES[randomState % RAID_NAME_PREFIXES.length];
    randomState = nextRandom(randomState);
    const suffix = RAID_NAME_SUFFIXES[randomState % RAID_NAME_SUFFIXES.length];
    const tier = index + 1;
    const recommendedTroops = Math.max(1, hearthLevel + tier - 1);
    randomState = nextRandom(randomState);
    const defense =
      recommendedTroops * TROOP_TYPES.trailguard.power -
      2 -
      (randomState % 3);
    const lootScale = recommendedTroops + hearthLevel;

    return {
      id: `frontier-${randomState}-${index}`,
      name: `${prefix} ${suffix}`,
      tier,
      defense,
      recommendedTroops,
      loot: {
        timber: 20 + lootScale * 18 + (randomState % 11),
        stone: 15 + lootScale * 14 + (randomState % 7),
        grain: 18 + lootScale * 16 + (randomState % 9),
      },
    };
  });

  return { targets, nextSeed: nextRandom(randomState) };
}

export function scoutRaidTargets(state, seed = state.nextRaidSeed ?? Date.now()) {
  const generated = generateRaidTargets(seed, getHearthLevel(state));
  return {
    ...state,
    raidTargets: generated.targets,
    nextRaidSeed: generated.nextSeed,
  };
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

export function resolveRaid(
  state,
  targetId,
  troopsCommitted,
  now = Date.now(),
) {
  const currentState = advanceState(state, now);
  const target = currentState.raidTargets.find(
    (candidate) => candidate.id === targetId,
  );
  if (!target) {
    return { state: currentState, error: "Choose an available raid target." };
  }

  if (!Number.isInteger(troopsCommitted) || troopsCommitted < 1) {
    return { state: currentState, error: "Deploy at least one Trailguard." };
  }

  const readyTroops = currentState.army.trailguard ?? 0;
  if (troopsCommitted > readyTroops) {
    return { state: currentState, error: "Not enough Trailguards are ready." };
  }

  const attackPower = troopsCommitted * TROOP_TYPES.trailguard.power;
  const victory = attackPower >= target.defense;
  const pressure = target.defense / Math.max(1, attackPower + target.defense);
  const casualtyRate = victory
    ? Math.min(0.6, pressure * 0.85)
    : Math.min(1, 0.45 + pressure * 0.75);
  const casualties = Math.min(
    troopsCommitted,
    Math.max(1, Math.ceil(troopsCommitted * casualtyRate)),
  );
  const capacity = getCapacity(currentState);
  const resources = { ...currentState.resources };
  const loot = Object.fromEntries(RESOURCE_KEYS.map((resource) => [resource, 0]));

  if (victory) {
    for (const resource of RESOURCE_KEYS) {
      loot[resource] = Math.max(
        0,
        Math.min(target.loot[resource], capacity - resources[resource]),
      );
      resources[resource] += loot[resource];
    }
  }

  const lastRaid = {
    targetName: target.name,
    victory,
    committed: troopsCommitted,
    casualties,
    survivors: troopsCommitted - casualties,
    loot,
    completedAt: now,
  };
  const raidedState = scoutRaidTargets({
    ...currentState,
    resources,
    army: {
      ...currentState.army,
      trailguard: readyTroops - casualties,
    },
    raidStats: {
      wins: (currentState.raidStats?.wins ?? 0) + (victory ? 1 : 0),
      losses: (currentState.raidStats?.losses ?? 0) + (victory ? 0 : 1),
    },
    lastRaid,
  });

  return { state: raidedState, result: lastRaid };
}

function isValidRaidTarget(target) {
  return (
    target &&
    typeof target.id === "string" &&
    typeof target.name === "string" &&
    Number.isInteger(target.tier) &&
    target.tier > 0 &&
    Number.isFinite(target.defense) &&
    target.defense > 0 &&
    Number.isInteger(target.recommendedTroops) &&
    target.recommendedTroops > 0 &&
    RESOURCE_KEYS.every(
      (resource) =>
        Number.isFinite(target.loot?.[resource]) && target.loot[resource] >= 0,
    )
  );
}

function isValidRaidResult(result) {
  return (
    result &&
    typeof result.targetName === "string" &&
    typeof result.victory === "boolean" &&
    Number.isInteger(result.committed) &&
    Number.isInteger(result.casualties) &&
    Number.isInteger(result.survivors) &&
    Number.isFinite(result.completedAt) &&
    RESOURCE_KEYS.every(
      (resource) =>
        Number.isFinite(result.loot?.[resource]) && result.loot[resource] >= 0,
    )
  );
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
  const fallbackRaids = generateRaidTargets(
    value.nextRaidSeed ?? now,
    getBuildingLevel(
      validBuildings.find((building) => building.type === "hearth"),
    ),
  );
  const raidTargets =
    Array.isArray(value.raidTargets) &&
    value.raidTargets.length === RAID_TARGET_COUNT &&
    value.raidTargets.every(isValidRaidTarget)
      ? value.raidTargets
      : fallbackRaids.targets;
  const raidStats = {
    wins: Number.isInteger(value.raidStats?.wins)
      ? Math.max(0, value.raidStats.wins)
      : 0,
    losses: Number.isInteger(value.raidStats?.losses)
      ? Math.max(0, value.raidStats.losses)
      : 0,
  };

  return advanceState(
    {
      version: 1,
      resources,
      buildings: validBuildings,
      army,
      trainingQueue,
      raidTargets,
      raidStats,
      lastRaid: isValidRaidResult(value.lastRaid) ? value.lastRaid : null,
      lastUpdated: value.lastUpdated,
      nextBuildingId: Number.isInteger(value.nextBuildingId)
        ? value.nextBuildingId
        : validBuildings.length + 1,
      nextTrainingId: Number.isInteger(value.nextTrainingId)
        ? value.nextTrainingId
        : trainingQueue.length + 1,
      nextRaidSeed: Number.isInteger(value.nextRaidSeed)
        ? value.nextRaidSeed >>> 0
        : fallbackRaids.nextSeed,
    },
    now,
  );
}
