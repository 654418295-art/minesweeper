const levels = [
  { rows: 6, cols: 6, mines: 6 },
  { rows: 7, cols: 7, mines: 8 },
  { rows: 8, cols: 8, mines: 10 },
  { rows: 9, cols: 9, mines: 12 },
  { rows: 10, cols: 10, mines: 15 },
  { rows: 11, cols: 11, mines: 20 },
  { rows: 12, cols: 12, mines: 26 },
  { rows: 13, cols: 13, mines: 32 },
  { rows: 14, cols: 14, mines: 40 },
  { rows: 15, cols: 15, mines: 50 },
];

const PARTICLE_COUNT = 18;
const boardEl = document.querySelector("#board");
const boardWrapEl = document.querySelector(".board-wrap");
const statusEl = document.querySelector("#game-status");
const mineCountEl = document.querySelector("#mine-count");
const levelEl = document.querySelector("#level-count");
const scoreEl = document.querySelector("#score-count");
const fxLayerEl = document.querySelector("#fx-layer");
const overlayEl = document.querySelector("#board-overlay");
const resetBtn = document.querySelector("#reset-btn");

let currentLevel = 0;
let board = [];
let firstMove = true;
let gameOver = false;
let transitionLock = false;
let revealedSafeCells = 0;
let flaggedCount = 0;
let activeCell = { row: 0, col: 0 };
let nextLevelTimer = null;
let detonatedCell = null;

function getConfig() {
  return levels[currentLevel];
}

function createCell(row, col) {
  return {
    row,
    col,
    mine: false,
    revealed: false,
    flagged: false,
    adjacentMines: 0,
  };
}

function isDetonatedCell(row, col) {
  return Boolean(
    detonatedCell && detonatedCell.row === row && detonatedCell.col === col
  );
}

function clearNextLevelTimer() {
  if (nextLevelTimer) {
    clearTimeout(nextLevelTimer);
    nextLevelTimer = null;
  }
}

function setOverlay(message, visible, variant = "default") {
  overlayEl.textContent = message;
  overlayEl.hidden = !visible;
  overlayEl.classList.toggle("show", visible);
  overlayEl.dataset.variant = visible ? variant : "";
}

function pulseBoard(className) {
  boardWrapEl.classList.remove("impact", "celebrate");
  void boardWrapEl.offsetWidth;
  boardWrapEl.classList.add(className);
}

function getCellCenter(row, col) {
  const selector = `[data-row="${row}"][data-col="${col}"]`;
  const cellEl = boardEl.querySelector(selector);

  if (!cellEl) {
    return null;
  }

  const cellRect = cellEl.getBoundingClientRect();
  const layerRect = fxLayerEl.getBoundingClientRect();

  return {
    x: cellRect.left - layerRect.left + cellRect.width / 2,
    y: cellRect.top - layerRect.top + cellRect.height / 2,
  };
}

function createFxFlagGraphic() {
  const flagEl = document.createElement("div");
  const poleEl = document.createElement("span");
  const clothEl = document.createElement("span");
  const tipEl = document.createElement("span");
  const baseEl = document.createElement("span");

  flagEl.className = "flag-graphic fx-flag";
  poleEl.className = "flag-pole";
  clothEl.className = "flag-cloth";
  tipEl.className = "flag-tip";
  baseEl.className = "flag-base";

  flagEl.append(poleEl, clothEl, tipEl, baseEl);
  return flagEl;
}

function createFlagFx(row, col, type) {
  const center = getCellCenter(row, col);

  if (!center) {
    return;
  }

  const effectEl = document.createElement("div");

  effectEl.className = `flag-fx flag-fx-${type}`;
  effectEl.style.left = `${center.x}px`;
  effectEl.style.top = `${center.y}px`;
  effectEl.appendChild(createFxFlagGraphic());
  fxLayerEl.appendChild(effectEl);

  window.setTimeout(() => {
    effectEl.remove();
  }, type === "drop" ? 1250 : 520);
}

function createExplosion(row, col) {
  const center = getCellCenter(row, col);

  if (!center) {
    return;
  }

  const burstEl = document.createElement("div");
  const ringEl = document.createElement("span");
  const flashEl = document.createElement("span");

  burstEl.className = "explosion";
  burstEl.style.left = `${center.x}px`;
  burstEl.style.top = `${center.y}px`;

  for (let index = 0; index < PARTICLE_COUNT; index += 1) {
    const particleEl = document.createElement("span");
    const angle = (Math.PI * 2 * index) / PARTICLE_COUNT;
    const distance = 26 + Math.random() * 58;
    const lift = -4 - Math.random() * 18;

    particleEl.className = "explosion-particle";
    particleEl.style.setProperty("--dx", `${Math.cos(angle) * distance}px`);
    particleEl.style.setProperty("--dy", `${Math.sin(angle) * distance + lift}px`);
    particleEl.style.setProperty("--delay", `${Math.random() * 90}ms`);
    particleEl.style.setProperty("--size", `${7 + Math.random() * 11}px`);
    burstEl.appendChild(particleEl);
  }

  ringEl.className = "explosion-ring";
  flashEl.className = "explosion-flash";
  burstEl.append(ringEl, flashEl);
  fxLayerEl.appendChild(burstEl);
  pulseBoard("impact");

  window.setTimeout(() => {
    burstEl.remove();
  }, 1000);
}

function getScore() {
  return currentLevel * 100 + revealedSafeCells * 10;
}

function updateHeader() {
  const config = getConfig();
  levelEl.textContent = `${currentLevel + 1} / ${levels.length}`;
  mineCountEl.textContent = String(config.mines - flaggedCount);
  scoreEl.textContent = String(getScore());
}

function initBoard() {
  const config = getConfig();

  clearNextLevelTimer();
  board = Array.from({ length: config.rows }, (_, row) =>
    Array.from({ length: config.cols }, (_, col) => createCell(row, col))
  );
  firstMove = true;
  gameOver = false;
  transitionLock = false;
  revealedSafeCells = 0;
  flaggedCount = 0;
  activeCell = { row: 0, col: 0 };
  detonatedCell = null;
  statusEl.textContent = `第 ${currentLevel + 1} 关`;
  updateHeader();
  setOverlay("", false);
  fxLayerEl.innerHTML = "";
  renderBoard();
}

function updateMineCounter() {
  mineCountEl.textContent = String(getConfig().mines - flaggedCount);
}

function getNeighbors(row, col) {
  const { rows, cols } = getConfig();
  const neighbors = [];

  for (let r = row - 1; r <= row + 1; r += 1) {
    for (let c = col - 1; c <= col + 1; c += 1) {
      if (r === row && c === col) {
        continue;
      }

      if (r >= 0 && r < rows && c >= 0 && c < cols) {
        neighbors.push(board[r][c]);
      }
    }
  }

  return neighbors;
}

function plantMines(safeRow, safeCol) {
  const config = getConfig();
  let planted = 0;

  while (planted < config.mines) {
    const row = Math.floor(Math.random() * config.rows);
    const col = Math.floor(Math.random() * config.cols);
    const cell = board[row][col];

    if (cell.mine || (row === safeRow && col === safeCol)) {
      continue;
    }

    cell.mine = true;
    planted += 1;
  }

  board.flat().forEach((cell) => {
    cell.adjacentMines = getNeighbors(cell.row, cell.col).filter(
      (neighbor) => neighbor.mine
    ).length;
  });
}

function scheduleNextLevel() {
  transitionLock = true;
  nextLevelTimer = window.setTimeout(() => {
    nextLevelTimer = null;

    if (currentLevel < levels.length - 1) {
      currentLevel += 1;
      initBoard();
      return;
    }

    setOverlay("通关", true, "final");
    statusEl.textContent = "10 关全部完成";
    pulseBoard("celebrate");
    transitionLock = true;
  }, 1400);
}

function handleLevelWin() {
  const config = getConfig();

  gameOver = true;
  setOverlay("胜利", true, "success");
  pulseBoard("celebrate");

  if (currentLevel < levels.length - 1) {
    statusEl.textContent = `第 ${currentLevel + 1} 关胜利，进入下一关`;
  } else {
    statusEl.textContent = `第 ${currentLevel + 1} 关胜利`;
  }

  renderBoard();

  if (revealedSafeCells === config.rows * config.cols - config.mines) {
    scheduleNextLevel();
  }
}

function revealAllMines() {
  board.flat().forEach((cell) => {
    if (cell.mine) {
      cell.revealed = true;
    }
  });
}

function revealCell(row, col) {
  const config = getConfig();
  const cell = board[row][col];

  if (gameOver || transitionLock || cell.revealed || cell.flagged) {
    return;
  }

  if (firstMove) {
    plantMines(row, col);
    firstMove = false;
    statusEl.textContent = `第 ${currentLevel + 1} 关进行中`;
  }

  cell.revealed = true;

  if (cell.mine) {
    gameOver = true;
    detonatedCell = { row, col };
    statusEl.textContent = "踩雷了，游戏结束";
    revealAllMines();
    renderBoard();
    setOverlay("爆炸", true, "danger");
    createExplosion(row, col);
    return;
  }

  revealedSafeCells += 1;
  updateHeader();

  if (cell.adjacentMines === 0) {
    getNeighbors(row, col).forEach((neighbor) => {
      if (!neighbor.revealed) {
        revealCell(neighbor.row, neighbor.col);
      }
    });
  }

  if (revealedSafeCells === config.rows * config.cols - config.mines) {
    handleLevelWin();
    return;
  }

  renderBoard();
}

function toggleFlag(row, col) {
  const cell = board[row][col];

  if (gameOver || transitionLock || cell.revealed) {
    return;
  }

  const willFlag = !cell.flagged;

  cell.flagged = willFlag;
  flaggedCount += willFlag ? 1 : -1;
  updateMineCounter();
  renderBoard();
  createFlagFx(row, col, willFlag ? "drop" : "lift");
}

function buildFlagGraphic() {
  const flagEl = document.createElement("div");
  const poleEl = document.createElement("span");
  const clothEl = document.createElement("span");
  const tipEl = document.createElement("span");
  const baseEl = document.createElement("span");

  flagEl.className = "flag-graphic";
  poleEl.className = "flag-pole";
  clothEl.className = "flag-cloth";
  tipEl.className = "flag-tip";
  baseEl.className = "flag-base";

  flagEl.append(poleEl, clothEl, tipEl, baseEl);
  return flagEl;
}

function buildMineGraphic(variant) {
  const mineEl = document.createElement("div");
  const coreEl = document.createElement("span");
  const hubEl = document.createElement("span");

  mineEl.className = `mine-graphic ${variant}`;
  coreEl.className = "mine-core";
  hubEl.className = "mine-hub";

  mineEl.append(coreEl, hubEl);

  for (let index = 0; index < 8; index += 1) {
    const spikeEl = document.createElement("span");

    spikeEl.className = "mine-spike";
    spikeEl.style.setProperty("--angle", `${index * 45}deg`);
    mineEl.appendChild(spikeEl);
  }

  if (variant === "detonated") {
    for (let index = 0; index < 4; index += 1) {
      const shardEl = document.createElement("span");

      shardEl.className = "mine-shard";
      shardEl.style.setProperty("--shard-angle", `${index * 90 + 25}deg`);
      mineEl.appendChild(shardEl);
    }
  }

  return mineEl;
}

function buildCellContent(cell) {
  const contentEl = document.createElement("span");

  contentEl.className = "cell-content";

  if (cell.flagged && !cell.revealed) {
    contentEl.appendChild(buildFlagGraphic());
    return contentEl;
  }

  if (cell.revealed && cell.mine) {
    contentEl.appendChild(
      buildMineGraphic(
        isDetonatedCell(cell.row, cell.col) ? "detonated" : "revealed"
      )
    );
    return contentEl;
  }

  if (cell.revealed && cell.adjacentMines > 0) {
    const numberEl = document.createElement("span");

    numberEl.className = `cell-number n${cell.adjacentMines}`;
    numberEl.textContent = String(cell.adjacentMines);
    contentEl.appendChild(numberEl);
  }

  return contentEl;
}

function getCellLabel(cell) {
  if (cell.flagged && !cell.revealed) {
    return `第 ${cell.row + 1} 行，第 ${cell.col + 1} 列，已插旗`;
  }

  if (!cell.revealed) {
    return `第 ${cell.row + 1} 行，第 ${cell.col + 1} 列，未翻开`;
  }

  if (cell.mine) {
    return isDetonatedCell(cell.row, cell.col)
      ? `第 ${cell.row + 1} 行，第 ${cell.col + 1} 列，踩中地雷`
      : `第 ${cell.row + 1} 行，第 ${cell.col + 1} 列，显示地雷`;
  }

  if (cell.adjacentMines > 0) {
    return `第 ${cell.row + 1} 行，第 ${cell.col + 1} 列，数字 ${cell.adjacentMines}`;
  }

  return `第 ${cell.row + 1} 行，第 ${cell.col + 1} 列，空白`;
}

function focusActiveCell() {
  const selector = `[data-row="${activeCell.row}"][data-col="${activeCell.col}"]`;
  const button = boardEl.querySelector(selector);

  if (button) {
    button.focus();
  }
}

function moveActiveCell(rowDelta, colDelta) {
  const config = getConfig();

  if (transitionLock) {
    return;
  }

  activeCell.row = Math.max(0, Math.min(config.rows - 1, activeCell.row + rowDelta));
  activeCell.col = Math.max(0, Math.min(config.cols - 1, activeCell.col + colDelta));
  renderBoard();
}

function renderBoard() {
  const config = getConfig();

  boardEl.innerHTML = "";
  boardEl.style.setProperty("--cols", String(config.cols));

  board.flat().forEach((cell) => {
    const button = document.createElement("button");

    button.type = "button";
    button.className = "cell";
    button.dataset.row = String(cell.row);
    button.dataset.col = String(cell.col);
    button.setAttribute("aria-label", getCellLabel(cell));

    if (cell.revealed) {
      button.classList.add("revealed");
    }

    if (cell.flagged && !cell.revealed) {
      button.classList.add("flagged");
    }

    if (cell.mine && cell.revealed) {
      button.classList.add("mine");
      if (isDetonatedCell(cell.row, cell.col)) {
        button.classList.add("mine-detonated");
      } else {
        button.classList.add("mine-spotted");
      }
    }

    if (cell.revealed && cell.adjacentMines > 0 && !cell.mine) {
      button.classList.add(`n${cell.adjacentMines}`);
    }

    button.tabIndex =
      cell.row === activeCell.row && cell.col === activeCell.col ? 0 : -1;
    button.appendChild(buildCellContent(cell));

    button.addEventListener("click", () => revealCell(cell.row, cell.col));
    button.addEventListener("contextmenu", (event) => {
      event.preventDefault();
      toggleFlag(cell.row, cell.col);
    });
    button.addEventListener("focus", () => {
      activeCell = { row: cell.row, col: cell.col };
    });

    boardEl.appendChild(button);
  });

  focusActiveCell();
}

resetBtn.addEventListener("click", () => {
  initBoard();
});

document.addEventListener("keydown", (event) => {
  if (event.target === resetBtn) {
    return;
  }

  switch (event.key) {
    case "ArrowUp":
      event.preventDefault();
      moveActiveCell(-1, 0);
      break;
    case "ArrowDown":
      event.preventDefault();
      moveActiveCell(1, 0);
      break;
    case "ArrowLeft":
      event.preventDefault();
      moveActiveCell(0, -1);
      break;
    case "ArrowRight":
      event.preventDefault();
      moveActiveCell(0, 1);
      break;
    case "1":
      event.preventDefault();
      revealCell(activeCell.row, activeCell.col);
      break;
    case "2":
      event.preventDefault();
      toggleFlag(activeCell.row, activeCell.col);
      break;
    default:
      break;
  }
});

initBoard();
