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
  getOnboardingProgress,
  getProductionRates,
  getTrainingQueueCapacity,
  getUpgradeCost,
  hydrateState,
  placeBuilding,
  resolveRaid,
  scoutRaidTargets,
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
let selectedRaidTargetId = state.raidTargets[0]?.id ?? null;

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
const raidTargets = document.querySelector("#raid-targets");
const raidTroops = document.querySelector("#raid-troops");
const launchRaidButton = document.querySelector("#launch-raid");
const scoutTargetsButton = document.querySelector("#scout-targets");
const raidRecord = document.querySelector("#raid-record");
const raidResult = document.querySelector("#raid-result");
const onboarding = document.querySelector("#onboarding");
const onboardingTitle = document.querySelector("#onboarding-title");
const onboardingIntro = document.querySelector("#onboarding-intro");
const onboardingProgress = document.querySelector("#onboarding-progress");
const onboardingProgressText = document.querySelector(
  "#onboarding-progress-text",
);
const onboardingAction = document.querySelector("#onboarding-action");
const dismissOnboardingButton = document.querySelector("#dismiss-onboarding");
const showOnboardingButton = document.querySelector("#show-onboarding");

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

function renderOnboarding() {
  onboarding.hidden = state.onboardingDismissed;
  showOnboardingButton.hidden = !state.onboardingDismissed;
  if (state.onboardingDismissed) return;

  const progress = getOnboardingProgress(state);
  const steps = [...onboarding.querySelectorAll("[data-onboarding-step]")];
  const completeCount = Object.values(progress).filter(Boolean).length;
  const nextStep = steps.find(
    (step) => !progress[step.dataset.onboardingStep],
  );

  for (const [index, step] of steps.entries()) {
    const isComplete = progress[step.dataset.onboardingStep];
    const marker = step.querySelector(".step-marker");
    step.classList.toggle("complete", isComplete);
    marker.textContent = isComplete ? "✓" : String(index + 1);
    step.removeAttribute("aria-current");
  }

  if (nextStep) nextStep.setAttribute("aria-current", "step");
  onboardingProgress.value = completeCount;
  onboardingProgress.textContent = `${completeCount} of 4`;
  onboardingProgressText.textContent = `${completeCount} of 4 steps complete`;
  onboardingAction.dataset.nextStep =
    nextStep?.dataset.onboardingStep ?? "complete";

  if (!nextStep) {
    onboardingTitle.textContent = "The frontier is open";
    onboardingIntro.textContent =
      "Your village can gather, train, and raid. Keep growing at your own pace.";
    onboardingAction.textContent = "Finish guide";
    dismissOnboardingButton.textContent = "Close";
    return;
  }

  onboardingTitle.textContent = "Prepare your village";
  onboardingIntro.textContent =
    "Follow the trail from gathering supplies to your first raid.";
  dismissOnboardingButton.textContent = "Not now";
  onboardingAction.textContent = {
    resourceBuilding: "Start with a Timber Yard",
    musterLodge: "Choose the Muster Lodge",
    trailguard: "Go to troop training",
    firstRaid: "Go to frontier targets",
  }[nextStep.dataset.onboardingStep];
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

function createRaidTargetCard(target) {
  const button = document.createElement("button");
  const heading = document.createElement("span");
  const name = document.createElement("strong");
  const tier = document.createElement("small");
  const details = document.createElement("span");
  const loot = document.createElement("span");

  button.type = "button";
  button.className = "raid-target-card";
  button.classList.toggle("selected", target.id === selectedRaidTargetId);
  button.setAttribute(
    "aria-pressed",
    String(target.id === selectedRaidTargetId),
  );
  heading.className = "raid-target-heading";
  name.textContent = target.name;
  tier.textContent = `Threat ${target.tier}`;
  details.className = "raid-target-detail";
  details.textContent =
    `${target.defense} defense · ${target.recommendedTroops} Trailguards advised`;
  loot.className = "raid-target-loot";
  loot.textContent = `Spoils: ${formatCost(target.loot)}`;
  heading.append(name, tier);
  button.append(heading, details, loot);
  button.addEventListener("click", () => {
    selectedRaidTargetId = target.id;
    raidTroops.value = Math.min(
      state.army.trailguard,
      target.recommendedTroops,
    );
    renderRaids();
  });
  return button;
}

function renderRaidResult() {
  const result = state.lastRaid;
  raidResult.hidden = !result;
  if (!result) return;

  raidResult.className = `raid-result ${result.victory ? "victory" : "defeat"}`;
  const title = document.createElement("strong");
  const detail = document.createElement("span");
  title.textContent = result.victory
    ? `Victory at ${result.targetName}`
    : `Defeat at ${result.targetName}`;

  const casualtyText =
    `${result.casualties} lost · ${result.survivors} returned`;
  const lootText = Object.values(result.loot).some((amount) => amount > 0)
    ? ` · Recovered ${formatCost(result.loot)}`
    : "";
  detail.textContent = `${casualtyText}${lootText}`;
  raidResult.replaceChildren(title, detail);
}

function renderRaids() {
  if (!state.raidTargets.some((target) => target.id === selectedRaidTargetId)) {
    selectedRaidTargetId = state.raidTargets[0]?.id ?? null;
  }

  raidTargets.replaceChildren(
    ...state.raidTargets.map(createRaidTargetCard),
  );
  raidRecord.textContent =
    `${state.raidStats.wins} victories · ${state.raidStats.losses} defeats`;

  const selectedTarget = state.raidTargets.find(
    (target) => target.id === selectedRaidTargetId,
  );
  const readyTroops = state.army.trailguard;
  raidTroops.max = readyTroops;
  raidTroops.disabled = readyTroops === 0;

  const currentDeployment = Number(raidTroops.value);
  if (
    !Number.isInteger(currentDeployment) ||
    currentDeployment < 1 ||
    currentDeployment > readyTroops
  ) {
    raidTroops.value = readyTroops
      ? Math.min(readyTroops, selectedTarget?.recommendedTroops ?? 1)
      : 0;
  }

  launchRaidButton.disabled = !selectedTarget || readyTroops === 0;
  launchRaidButton.textContent =
    readyTroops === 0 ? "Train Trailguards first" : "Launch raid";
  renderRaidResult();
}

function render() {
  renderResources();
  renderGrid();
  renderBuildMenu();
  renderOnboarding();
  renderInspector();
  renderArmy();
  renderRaids();
}

function focusGuideTarget(target) {
  const prefersReducedMotion = window.matchMedia(
    "(prefers-reduced-motion: reduce)",
  ).matches;
  target.scrollIntoView({
    behavior: prefersReducedMotion ? "auto" : "smooth",
    block: "center",
  });
  target.focus({ preventScroll: true });
}

function dismissOnboarding() {
  state = { ...state, onboardingDismissed: true };
  saveGame();
  renderOnboarding();
  showOnboardingButton.focus();
}

onboardingAction.addEventListener("click", () => {
  const nextStep = onboardingAction.dataset.nextStep;

  if (nextStep === "complete") {
    dismissOnboarding();
    return;
  }

  if (nextStep === "resourceBuilding" || nextStep === "musterLodge") {
    const buildingType =
      nextStep === "resourceBuilding" ? "timberYard" : "musterLodge";
    selectedBuildingType = buildingType;
    selectedBuildingId = null;
    render();
    focusGuideTarget(
      buildMenu.querySelector(`[data-building-type="${buildingType}"]`),
    );
    announce(
      `${BUILDING_TYPES[buildingType].name} selected. Choose an empty village tile.`,
    );
    return;
  }

  const target =
    nextStep === "trailguard"
      ? document.querySelector("#army-title")
      : document.querySelector("#raid-title");
  focusGuideTarget(target);
});

dismissOnboardingButton.addEventListener("click", dismissOnboarding);

showOnboardingButton.addEventListener("click", () => {
  state = { ...state, onboardingDismissed: false };
  saveGame();
  renderOnboarding();
  focusGuideTarget(onboardingTitle);
});

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

scoutTargetsButton.addEventListener("click", () => {
  state = scoutRaidTargets(state);
  selectedRaidTargetId = state.raidTargets[0].id;
  saveGame();
  renderRaids();
  announce("New frontier targets have been scouted.");
});

launchRaidButton.addEventListener("click", () => {
  const result = resolveRaid(
    state,
    selectedRaidTargetId,
    Number(raidTroops.value),
  );
  state = result.state;

  if (result.error) {
    announce(result.error, "error");
  } else {
    selectedRaidTargetId = state.raidTargets[0].id;
    announce(
      result.result.victory
        ? `Raid won! Supplies from ${result.result.targetName} reached the village.`
        : `The company withdrew from ${result.result.targetName}. Train and try again.`,
      result.result.victory ? "success" : "error",
    );
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
  selectedRaidTargetId = state.raidTargets[0].id;
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
  renderOnboarding();
  renderInspector();
  renderArmy();
}, 1000);
