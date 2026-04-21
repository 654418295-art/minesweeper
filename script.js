const config = {
  rows: 9,
  cols: 9,
  mines: 10,
};

const boardEl = document.querySelector("#board");
const statusEl = document.querySelector("#game-status");
const mineCountEl = document.querySelector("#mine-count");
const resetBtn = document.querySelector("#reset-btn");

let board = [];
let firstMove = true;
let gameOver = false;
let revealedSafeCells = 0;
let flaggedCount = 0;

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

function initBoard() {
  board = Array.from({ length: config.rows }, (_, row) =>
    Array.from({ length: config.cols }, (_, col) => createCell(row, col))
  );
  firstMove = true;
  gameOver = false;
  revealedSafeCells = 0;
  flaggedCount = 0;
  statusEl.textContent = "准备开始";
  updateMineCounter();
  renderBoard();
}

function updateMineCounter() {
  mineCountEl.textContent = String(config.mines - flaggedCount);
}

function getNeighbors(row, col) {
  const neighbors = [];

  for (let r = row - 1; r <= row + 1; r += 1) {
    for (let c = col - 1; c <= col + 1; c += 1) {
      if (r === row && c === col) {
        continue;
      }

      if (r >= 0 && r < config.rows && c >= 0 && c < config.cols) {
        neighbors.push(board[r][c]);
      }
    }
  }

  return neighbors;
}

function plantMines(safeRow, safeCol) {
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

function revealCell(row, col) {
  const cell = board[row][col];

  if (gameOver || cell.revealed || cell.flagged) {
    return;
  }

  if (firstMove) {
    plantMines(row, col);
    firstMove = false;
    statusEl.textContent = "进行中";
  }

  cell.revealed = true;

  if (cell.mine) {
    gameOver = true;
    statusEl.textContent = "踩雷了，游戏结束";
    revealAllMines();
    renderBoard();
    return;
  }

  revealedSafeCells += 1;

  if (cell.adjacentMines === 0) {
    getNeighbors(row, col).forEach((neighbor) => {
      if (!neighbor.revealed) {
        revealCell(neighbor.row, neighbor.col);
      }
    });
  }

  if (revealedSafeCells === config.rows * config.cols - config.mines) {
    gameOver = true;
    statusEl.textContent = "恭喜，你赢了";
    renderBoard();
    return;
  }

  renderBoard();
}

function revealAllMines() {
  board.flat().forEach((cell) => {
    if (cell.mine) {
      cell.revealed = true;
    }
  });
}

function toggleFlag(row, col) {
  const cell = board[row][col];

  if (gameOver || cell.revealed) {
    return;
  }

  cell.flagged = !cell.flagged;
  flaggedCount += cell.flagged ? 1 : -1;
  updateMineCounter();
  renderBoard();
}

function getCellText(cell) {
  if (cell.flagged && !cell.revealed) {
    return "⚑";
  }

  if (!cell.revealed) {
    return "";
  }

  if (cell.mine) {
    return "✹";
  }

  return cell.adjacentMines > 0 ? String(cell.adjacentMines) : "";
}

function renderBoard() {
  boardEl.innerHTML = "";

  board.flat().forEach((cell) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "cell";
    button.dataset.row = String(cell.row);
    button.dataset.col = String(cell.col);
    button.textContent = getCellText(cell);

    if (cell.revealed) {
      button.classList.add("revealed");
    }

    if (cell.flagged && !cell.revealed) {
      button.classList.add("flagged");
    }

    if (cell.mine && cell.revealed) {
      button.classList.add("mine");
    }

    if (cell.revealed && cell.adjacentMines > 0 && !cell.mine) {
      button.classList.add(`n${cell.adjacentMines}`);
    }

    button.addEventListener("click", () => revealCell(cell.row, cell.col));
    button.addEventListener("contextmenu", (event) => {
      event.preventDefault();
      toggleFlag(cell.row, cell.col);
    });

    boardEl.appendChild(button);
  });
}

resetBtn.addEventListener("click", initBoard);

initBoard();
