import {
  BUILDING_TYPES,
  GRID_SIZE,
  MAX_BUILDING_LEVEL,
  RESOURCE_KEYS,
  advanceState,
  createInitialState,
  getBuildingAt,
  getBuildingLevel,
  getCapacity,
  getHearthLevel,
  getProductionRates,
  getUpgradeCost,
  hydrateState,
  placeBuilding,
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
const settlementJournal = document.querySelector("#settlement-journal");
const inspector = document.querySelector("#building-inspector");
const upgradeButton = document.querySelector("#upgrade-building");

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
    selectedBuildingType = null;
    selectedBuildingId = existing.id;
    announce(`${definition.name} level ${getBuildingLevel(existing)} selected.`);
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
      tile.classList.add("occupied", `building-${building.type}`);
      tile.classList.toggle("inspected", building.id === selectedBuildingId);
      tile.setAttribute(
        "aria-label",
        `${definition.name}, level ${getBuildingLevel(building)}, row ${y + 1}, column ${x + 1}`,
      );

      const icon = document.createElement("span");
      icon.className = "tile-icon";
      icon.setAttribute("aria-hidden", "true");
      icon.textContent = definition.icon;

      const label = document.createElement("span");
      label.className = "tile-label";
      label.textContent = `${definition.name} · L${getBuildingLevel(building)}`;
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

function getOutputSummary(building) {
  const definition = BUILDING_TYPES[building.type];
  const level = getBuildingLevel(building);
  const production = Object.entries(definition.production);

  if (production.length > 0) {
    return production
      .map(
        ([resource, amount]) =>
          `${(amount * level).toFixed(1)} ${RESOURCE_LABELS[resource]} / second`,
      )
      .join(" · ");
  }

  if (definition.capacity) {
    return `+${(definition.capacity * level).toLocaleString()} resource capacity`;
  }

  return `Supports level ${level} village buildings`;
}

function renderInspector() {
  const building = state.buildings.find(
    (candidate) => candidate.id === selectedBuildingId,
  );

  settlementJournal.hidden = Boolean(building);
  inspector.hidden = !building;
  if (!building) return;

  const definition = BUILDING_TYPES[building.type];
  const level = getBuildingLevel(building);
  const hearthLevel = getHearthLevel(state);
  const isMaxLevel = level >= MAX_BUILDING_LEVEL;
  const isHearthGated =
    building.type !== "hearth" && level >= hearthLevel;

  document.querySelector("#inspector-icon").textContent = definition.icon;
  document.querySelector("#inspector-name").textContent = definition.name;
  document.querySelector("#inspector-level").textContent = `Level ${level}`;
  document.querySelector("#inspector-description").textContent =
    definition.description;
  document.querySelector("#inspector-output").textContent =
    getOutputSummary(building);

  const cost = getUpgradeCost(building);
  document.querySelector("#upgrade-cost").textContent = isMaxLevel
    ? "All improvements complete"
    : formatCost(cost);

  upgradeButton.disabled = isMaxLevel;
  upgradeButton.textContent = isMaxLevel
    ? "Maximum level"
    : `Upgrade to level ${level + 1}`;

  const requirement = document.querySelector("#upgrade-requirement");
  if (isMaxLevel) {
    requirement.textContent = "This building has reached its final level.";
  } else if (isHearthGated) {
    requirement.textContent = `Requires Village Hearth level ${level + 1}.`;
  } else if (building.type === "hearth") {
    requirement.textContent =
      "Each Hearth level unlocks the same level for other buildings.";
  } else {
    requirement.textContent = `Village Hearth level ${hearthLevel} permits this upgrade.`;
  }
}

function render() {
  renderResources();
  renderGrid();
  renderBuildMenu();
  renderInspector();
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

document.querySelector("#close-inspector").addEventListener("click", () => {
  selectedBuildingId = null;
  render();
  announce("Building details closed.");
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
}, 1000);
