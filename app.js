import {
  BUILDING_TYPES,
  GRID_SIZE,
  MAX_BUILDING_LEVEL,
  RESOURCE_KEYS,
  TROOP_TYPES,
  advanceState,
  canAfford,
  createInitialState,
  getBuildingAt,
  getBuildingLevel,
  getCapacity,
  getHearthLevel,
  getLevelMultiplier,
  getProductionRates,
  getTrainingQueueCapacity,
  getUpgradeCost,
  hydrateState,
  placeBuilding,
  trainTroop,
  upgradeBuilding,
} from "./game-core.js";

const SAVE_KEY = "clash-village-save-v1";
const RESOURCE_LABELS = {
  timber: "Timber",
  stone: "Stone",
  grain: "Grain",
};

let state = loadGame();
let selectedBuildingType = null;
let selectedBuildingId = null;

const grid = document.querySelector("#village-grid");
const buildMenu = document.querySelector("#build-menu");
const selectionText = document.querySelector("#selection-text");
const message = document.querySelector("#message");
const inspectorEmpty = document.querySelector("#inspector-empty");
const inspectorContent = document.querySelector("#inspector-content");
const inspectorIcon = document.querySelector("#inspector-icon");
const inspectorName = document.querySelector("#inspector-name");
const inspectorLevel = document.querySelector("#inspector-level");
const inspectorDescription = document.querySelector("#inspector-description");
const inspectorOutput = document.querySelector("#inspector-output");
const inspectorRequirement = document.querySelector("#inspector-requirement");
const inspectorCost = document.querySelector("#inspector-cost");
const upgradeButton = document.querySelector("#upgrade-building");
const armyCount = document.querySelector("#army-count");
const queueCapacity = document.querySelector("#queue-capacity");
const trainingQueue = document.querySelector("#training-queue");
const trainTrailguardButton = document.querySelector("#train-trailguard");

function loadGame() {
  try {
    const saved = JSON.parse(localStorage.getItem(SAVE_KEY));
    return hydrateState(saved);
  } catch {
    return createInitialState();
  }
}

function saveGame() {
  localStorage.setItem(SAVE_KEY, JSON.stringify(state));
}

function formatAmount(value) {
  return Math.floor(value).toLocaleString();
}

function formatCost(cost) {
  if (!cost) return "Maximum level reached";
  return Object.entries(cost)
    .map(([resource, amount]) => `${amount} ${RESOURCE_LABELS[resource]}`)
    .join(" · ");
}

function announce(text, tone = "info") {
  message.textContent = text;
  message.dataset.tone = tone;
}

function renderResources() {
  const rates = getProductionRates(state);
  const capacity = getCapacity(state);

  for (const resource of RESOURCE_KEYS) {
    document.querySelector(`[data-resource="${resource}"] .resource-value`).textContent =
      `${formatAmount(state.resources[resource])} / ${capacity}`;
    document.querySelector(`[data-resource="${resource}"] .resource-rate`).textContent =
      `+${rates[resource].toFixed(1)}/s`;
  }
}

function createBuildMenu() {
  for (const [type, definition] of Object.entries(BUILDING_TYPES)) {
    if (type === "hearth") continue;

    const button = document.createElement("button");
    button.className = "build-card";
    button.type = "button";
    button.dataset.buildingType = type;
    button.innerHTML = `
      <span class="build-icon" aria-hidden="true">${definition.icon}</span>
      <span class="build-copy">
        <strong>${definition.name}</strong>
        <small>${definition.description}</small>
        <span class="cost">${formatCost(definition.cost)}</span>
      </span>
    `;
    button.addEventListener("click", () => {
      selectedBuildingType =
        selectedBuildingType === type ? null : type;
      selectedBuildingId = null;
      render();
      if (selectedBuildingType) {
        announce(`Choose an empty tile for ${definition.name}.`);
      } else {
        announce("Build selection cleared.");
      }
    });
    buildMenu.append(button);
  }
}

function createGrid() {
  for (let y = 0; y < GRID_SIZE; y += 1) {
    for (let x = 0; x < GRID_SIZE; x += 1) {
      const tile = document.createElement("button");
      tile.className = "village-tile";
      tile.type = "button";
      tile.dataset.x = x;
      tile.dataset.y = y;
      tile.setAttribute("aria-label", `Empty village tile, row ${y + 1}, column ${x + 1}`);
      tile.addEventListener("click", handleTileClick);
      grid.append(tile);
    }
  }
}

function handleTileClick(event) {
  const tile = event.currentTarget;
  const x = Number(tile.dataset.x);
  const y = Number(tile.dataset.y);
  const existing = getBuildingAt(state, x, y);

  if (existing) {
    const definition = BUILDING_TYPES[existing.type];
    selectedBuildingId = existing.id;
    selectedBuildingType = null;
    announce(`${definition.name} selected. Review its upgrade below.`);
    render();
    return;
  }

  if (!selectedBuildingType) {
    selectedBuildingId = null;
    announce("Select a building below, then choose an empty tile.");
    render();
    return;
  }

  const result = placeBuilding(state, selectedBuildingType, x, y);
  state = result.state;

  if (result.error) {
    announce(result.error, "error");
  } else {
    const definition = BUILDING_TYPES[selectedBuildingType];
    announce(`${definition.name} built. Production is already running!`, "success");
    selectedBuildingType = null;
    selectedBuildingId = result.building.id;
    saveGame();
  }

  render();
}

function renderGrid() {
  for (const tile of grid.children) {
    const x = Number(tile.dataset.x);
    const y = Number(tile.dataset.y);
    const building = getBuildingAt(state, x, y);

    tile.className = "village-tile";
    tile.replaceChildren();

    if (building) {
      const definition = BUILDING_TYPES[building.type];
      const level = getBuildingLevel(building);
      tile.classList.add("occupied", `building-${building.type}`);
      tile.classList.toggle("selected-building", building.id === selectedBuildingId);
      tile.setAttribute(
        "aria-label",
        `${definition.name}, level ${level}, row ${y + 1}, column ${x + 1}`,
      );

      const icon = document.createElement("span");
      icon.className = "tile-icon";
      icon.setAttribute("aria-hidden", "true");
      icon.textContent = definition.icon;

      const label = document.createElement("span");
      label.className = "tile-label";
      label.textContent = `${definition.name} · Lv ${level}`;
      tile.append(icon, label);
    } else {
      tile.setAttribute(
        "aria-label",
        `Empty village tile, row ${y + 1}, column ${x + 1}`,
      );
      if (selectedBuildingType) tile.classList.add("buildable");
    }
  }
}

function renderBuildMenu() {
  for (const button of buildMenu.children) {
    const type = button.dataset.buildingType;
    button.classList.toggle("selected", selectedBuildingType === type);
    button.setAttribute(
      "aria-pressed",
      String(selectedBuildingType === type),
    );
  }

  selectionText.textContent = selectedBuildingType
    ? `Placing: ${BUILDING_TYPES[selectedBuildingType].name}`
    : "Select a structure to build";
}

function getOutputText(building) {
  const definition = BUILDING_TYPES[building.type];
  const level = getBuildingLevel(building);
  const multiplier = getLevelMultiplier(level);
  const production = Object.entries(definition.production);

  if (production.length > 0) {
    return production
      .map(
        ([resource, amount]) =>
          `${(amount * multiplier).toFixed(1)} ${RESOURCE_LABELS[resource].toLowerCase()}/s`,
      )
      .join(" · ");
  }

  if (definition.capacity) {
    return `+${formatAmount(definition.capacity * multiplier)} capacity per resource`;
  }

  if (definition.trainingCapacity) {
    return `${definition.trainingCapacity + level - 1} training queue slots`;
  }

  return `Allows village buildings to reach level ${level}`;
}

function renderInspector() {
  const building = state.buildings.find(
    (candidate) => candidate.id === selectedBuildingId,
  );

  inspectorEmpty.hidden = Boolean(building);
  inspectorContent.hidden = !building;
  if (!building) return;

  const definition = BUILDING_TYPES[building.type];
  const level = getBuildingLevel(building);
  const nextLevel = level + 1;
  const isMaxLevel = level >= MAX_BUILDING_LEVEL;
  const isHearthGated =
    building.type !== "hearth" && nextLevel > getHearthLevel(state);
  const cost = getUpgradeCost(building.type, level);
  const isAffordable = cost ? canAfford(state, cost) : false;

  inspectorIcon.textContent = definition.icon;
  inspectorName.textContent = definition.name;
  inspectorLevel.textContent = `Level ${level} / ${MAX_BUILDING_LEVEL}`;
  inspectorDescription.textContent = definition.description;
  inspectorOutput.textContent = getOutputText(building);
  inspectorCost.textContent = formatCost(cost);

  if (isMaxLevel) {
    inspectorRequirement.textContent = "Mastered";
  } else if (isHearthGated) {
    inspectorRequirement.textContent = `Requires Hearth level ${nextLevel}`;
  } else if (!isAffordable) {
    inspectorRequirement.textContent = "Gather more resources";
  } else {
    inspectorRequirement.textContent = `Ready for level ${nextLevel}`;
  }

  upgradeButton.textContent = isMaxLevel
    ? "Fully upgraded"
    : `Upgrade to level ${nextLevel}`;
  upgradeButton.disabled = isMaxLevel || isHearthGated || !isAffordable;
}

function renderArmy() {
  const troop = TROOP_TYPES.trailguard;
  const capacity = getTrainingQueueCapacity(state);
  const queueLength = state.trainingQueue.length;

  armyCount.textContent = formatAmount(state.army.trailguard);
  queueCapacity.textContent = `${queueLength} / ${capacity} slots`;
  trainingQueue.replaceChildren();

  if (queueLength === 0) {
    const empty = document.createElement("li");
    empty.className = "queue-empty";
    empty.textContent =
      capacity === 0
        ? "Build a Muster Lodge to begin training."
        : "The lodge is ready for new recruits.";
    trainingQueue.append(empty);
  } else {
    for (const [index, item] of state.trainingQueue.entries()) {
      const row = document.createElement("li");
      const label = document.createElement("span");
      const remaining = document.createElement("span");
      label.textContent = `${index + 1}. ${TROOP_TYPES[item.troopType].name}`;
      remaining.className = "queue-time";
      remaining.textContent = `${Math.max(1, Math.ceil((item.finishesAt - Date.now()) / 1000))}s`;
      row.append(label, remaining);
      trainingQueue.append(row);
    }
  }

  const hasLodge = capacity > 0;
  const isFull = queueLength >= capacity;
  const isAffordable = canAfford(state, troop.cost);
  trainTrailguardButton.disabled = !hasLodge || isFull || !isAffordable;
  trainTrailguardButton.textContent = !hasLodge
    ? "Build a Muster Lodge"
    : isFull
      ? "Queue full"
      : !isAffordable
        ? "Gather supplies"
        : "Train Trailguard";
}

function render() {
  renderResources();
  renderGrid();
  renderBuildMenu();
  renderInspector();
  renderArmy();
}

upgradeButton.addEventListener("click", () => {
  if (!selectedBuildingId) return;

  const result = upgradeBuilding(state, selectedBuildingId);
  state = result.state;

  if (result.error) {
    announce(result.error, "error");
  } else {
    const definition = BUILDING_TYPES[result.building.type];
    announce(
      `${definition.name} upgraded to level ${result.building.level}!`,
      "success",
    );
    saveGame();
  }

  render();
});

trainTrailguardButton.addEventListener("click", () => {
  const result = trainTroop(state, "trailguard");
  state = result.state;

  if (result.error) {
    announce(result.error, "error");
  } else {
    announce("A Trailguard joined the training queue.", "success");
    saveGame();
  }

  render();
});

document.querySelector("#reset-game").addEventListener("click", () => {
  const confirmed = window.confirm(
    "Start a new village? Your current buildings and resources will be erased.",
  );
  if (!confirmed) return;

  state = createInitialState();
  selectedBuildingType = null;
  selectedBuildingId = null;
  saveGame();
  render();
  announce("A fresh village is ready.", "success");
});

document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "visible") {
    state = advanceState(state);
    render();
  } else {
    saveGame();
  }
});

window.addEventListener("beforeunload", saveGame);

createBuildMenu();
createGrid();
render();

setInterval(() => {
  state = advanceState(state);
  saveGame();
  renderResources();
  renderInspector();
  renderArmy();
}, 1000);
