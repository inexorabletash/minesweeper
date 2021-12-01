/*----- constants -----*/
var bombImage = '<img src="images/bomb.png">';
var flagImage = '<img src="images/flag.png">';
var wrongBombImage = '<img src="images/wrong-bomb.png">'
var sizeLookup = {
  '9': {totalBombs: 10, tableWidth: '245px'},
  '16': {totalBombs: 40, tableWidth: '420px'},
  '30': {totalBombs: 160, tableWidth: '794px'}
};
var colors = [
  '',
  '#0000FA',
  '#4B802D',
  '#DB1300',
  '#202081',
  '#690400',
  '#457A7A',
  '#1B1B1B',
  '#7A7A7A',
];

/*----- app's state (variables) -----*/
var size = 16;
var board;
var bombCount;
var timeElapsed;
var adjBombs;
var hitBomb;
var elapsedTime;
var timerId;
var winner;

/*----- cached element references -----*/
var boardEl = document.getElementById('board');

/*----- event listeners -----*/
document.getElementById('size-btns').addEventListener('click', function(e) {
  size = parseInt(e.target.id.replace('size-', ''));
  init();
  render();
});

boardEl.addEventListener('contextmenu', function(e) {
  e.preventDefault();
});


boardEl.addEventListener('mousedown', function(e) {
  if (winner || hitBomb) return;
  var clickedEl, row, col, cell;
  clickedEl = e.target.tagName.toLowerCase() === 'img' ? e.target.parentElement : e.target;

  if (clickedEl.classList.contains('game-cell')) {
    // Click on non-revealed cell
    if (!timerId) setTimer();
    row = parseInt(clickedEl.dataset.row);
    col = parseInt(clickedEl.dataset.col);
    cell = board[row][col];
    if (e.button === 2) {
      // Right click - toggle flag
      if (bombCount > 0) {
        bombCount += cell.flag() ? -1 : 1;
      }
    } else if (!cell.flagged){
      // Left click - reveal if not flagged
      hitBomb = cell.reveal();
      if (hitBomb) {
        revealAll();
        clearInterval(timerId);
        e.target.style.backgroundColor = 'red';
      }
    }
    winner = getWinner();
    render();
  } else if (clickedEl.classList.contains('revealed') && e.shiftKey) {
    // Shift+Click on revealed cell - shortcut for revealing all
    // non-flagged adjacent cells.
    row = parseInt(clickedEl.dataset.row);
    col = parseInt(clickedEl.dataset.col);
    cell = board[row][col];

    // First count the number of adjacent flags.
    var adjacentFlagCount = 0;
    var dx, dy, other;
    for (dx = -1; dx <= 1; ++dx) {
      for (dy = -1; dy <= 1; ++dy) {
        if (dx || dy) {
          other = maybeGetCell(board, row + dy, col+dx);
          adjacentFlagCount += (other && other.flagged) ? 1 : 0;
        }
      }
    }

    // If enough are flagged, reveal all adjacent non-flagged cells.
    if (adjacentFlagCount === cell.adjBombs) {
      for (dx = -1; !hitBomb && dx <= 1; ++dx) {
        for (dy = -1; !hitBomb && dy <= 1; ++dy) {
          other = maybeGetCell(board, row + dy, col+dx);
          if (other && !other.revealed && !other.flagged) {
            hitBomb = other.reveal();
          }
        }
      }
      if (hitBomb) {
        revealAll();
        clearInterval(timerId);
        e.target.style.backgroundColor = 'red';
      }
      winner = getWinner();
      render();
    }
  }
});

function maybeGetCell(board, row, col) {
  if (row < 0 || row >= board.length)
    return null;
  var slice = board[row];
  if (col < 0 || col >= slice.length)
    return null;
  return slice[col];
}

function createResetListener() {
  document.getElementById('reset').addEventListener('click', function() {
    init();
    render();
  });
}

/*----- functions -----*/
function setTimer () {
  timerId = setInterval(function(){
    elapsedTime += 1;
    document.getElementById('timer').innerText = elapsedTime.toString().padStart(3, '0');
  }, 1000);
};

function revealAll() {
  board.forEach(function(rowArr) {
    rowArr.forEach(function(cell) {
      cell.reveal();
    });
  });
};

function buildTable() {
  var topRow = `
  <tr>
    <td class="menu" id="window-title-bar" colspan="${size}">
      <div id="window-title"><img src="images/mine-menu-icon.png"> Minesweeper</div>
      <div id="window-controls"><img src="images/window-controls.png"></div>
    </td>
  <tr>
    <td class="menu" id="folder-bar" colspan="${size}">
      <div id="folder1"><a href="https://github.com/nickarocho/minesweeper/blob/master/readme.md" target="blank">Read Me </a></div>
      <div id="folder2"><a href="https://github.com/nickarocho/minesweeper" target="blank">Source Code</a></div>
    </td>
  </tr>
  </tr>
    <tr>
      <td class="menu" colspan="${size}">
          <section id="status-bar">
            <div id="bomb-counter">000</div>
            <div id="reset"><img src="images/smiley-face.png"></div>
            <div id="timer">000</div>
          </section>
      </td>
    </tr>
    `;
  boardEl.innerHTML = topRow + `<tr>${'<td class="game-cell"></td>'.repeat(size)}</tr>`.repeat(size);
  boardEl.style.width = sizeLookup[size].tableWidth;
  createResetListener();
  var cells = Array.from(document.querySelectorAll('td:not(.menu)'));
  cells.forEach(function(cell, idx) {
    cell.setAttribute('data-row', Math.floor(idx / size));
    cell.setAttribute('data-col', idx % size);
  });
}

function buildArrays() {
  var arr = Array(size).fill(null);
  arr = arr.map(function() {
    return new Array(size).fill(null);
  });
  return arr;
};

function buildCells(){
  board.forEach(function(rowArr, rowIdx) {
    rowArr.forEach(function(slot, colIdx) {
      board[rowIdx][colIdx] = new Cell(rowIdx, colIdx, board);
    });
  });
  addBombs();
  runCodeForAllCells(function(cell){
    cell.calcAdjBombs();
  });
};

function init() {
  buildTable();
  board = buildArrays();
  buildCells();
  bombCount = getBombCount();
  elapsedTime = 0;
  clearInterval(timerId);
  timerId = null;
  hitBomb = false;
  winner = false;
};

function getBombCount() {
  var count = 0;
  board.forEach(function(row){
    count += row.filter(function(cell) {
      return cell.bomb;
    }).length
  });
  return count;
};

function addBombs() {
  var currentTotalBombs = sizeLookup[`${size}`].totalBombs;
  while (currentTotalBombs !== 0) {
    var row = Math.floor(Math.random() * size);
    var col = Math.floor(Math.random() * size);
    var currentCell = board[row][col]
    if (!currentCell.bomb){
      currentCell.bomb = true
      currentTotalBombs -= 1
    }
  }
};

function getWinner() {
  for (var row = 0; row<board.length; row++) {
    for (var col = 0; col<board[0].length; col++) {
      var cell = board[row][col];
      if (!cell.revealed && !cell.bomb) return false;
    }
  }
  return true;
};

function render() {
  document.getElementById('bomb-counter').innerText = bombCount.toString().padStart(3, '0');
  var seconds = timeElapsed % 60;
  var tdList = Array.from(document.querySelectorAll('[data-row]'));
  tdList.forEach(function(td) {
    var rowIdx = parseInt(td.getAttribute('data-row'));
    var colIdx = parseInt(td.getAttribute('data-col'));
    var cell = board[rowIdx][colIdx];
    if (cell.flagged) {
      td.innerHTML = flagImage;
    } else if (cell.revealed) {
      if (cell.bomb) {
        td.innerHTML = bombImage;
      } else if (cell.adjBombs) {
        td.className = 'revealed'
        td.style.color = colors[cell.adjBombs];
        td.textContent = cell.adjBombs;
      } else {
        td.className = 'revealed'
      }
    } else {
      td.innerHTML = '';
    }
  });
  if (hitBomb) {
    document.getElementById('reset').innerHTML = '<img src=images/dead-face.png>';
    runCodeForAllCells(function(cell) {
      if (!cell.bomb && cell.flagged) {
        var td = document.querySelector(`[data-row="${cell.row}"][data-col="${cell.col}"]`);
        td.innerHTML = wrongBombImage;
      }
    });
  } else if (winner) {
    document.getElementById('reset').innerHTML = '<img src=images/cool-face.png>';
    clearInterval(timerId);
  }
};

function runCodeForAllCells(cb) {
  board.forEach(function(rowArr) {
    rowArr.forEach(function(cell) {
      cb(cell);
    });
  });
}

init();
render();
