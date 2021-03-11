const NS_SVG = 'http://www.w3.org/2000/svg';

const sudoku = document.getElementById('sudoku');
const sudokuHighlights = document.getElementById('sudoku-highlights');
const sudokuGivens = document.getElementById('sudoku-givens');
const sudokuFilled = document.getElementById('sudoku-filled');

let selecting = false;

const selected = new Set();
function select({ offsetX, offsetY }) {
  const x = (offsetX / 100) | 0;
  const y = (offsetY / 100) | 0;
  const id = xy2id(x, y);
  if (!selected.has(id)) {
    selected.add(id);

    const highlight = document.createElementNS(NS_SVG, 'use');
    highlight.setAttribute('href', '#highlight');
    highlight.setAttribute('x', 100 * x);
    highlight.setAttribute('y', 100 * y);

    sudokuHighlights.append(highlight);
  }
}
function unselect() {
  selected.clear();
  while (sudokuHighlights.lastChild)
    sudokuHighlights.removeChild(sudokuHighlights.lastChild);
}

function xy2id(x, y) {
  return 9 * y + x;
}
function id2xy(id) {
  return [ id % 9, (id / 9) | 0 ];
}

sudoku.addEventListener('mousedown', e => {
  if (!selecting) {
    selecting = true;
    if (!e.shiftKey && !e.ctrlKey)
      unselect();
    select(e);
  }
});

sudoku.addEventListener('mousemove', e => {
  if (selecting)
    select(e);
});

window.addEventListener('keydown', e => {
  let num = Number(e.key);
  if (Number.isNaN(num))
    return;

  for (const id of selected) {
    const [ x, y ] = id2xy(id);

    const el = document.createElementNS(NS_SVG, 'text');
    el.textContent = '' + num;
    el.setAttribute('class', 'filled');
    el.setAttribute('x', 100 * x + 50);
    el.setAttribute('y', 100 * y + 50);

    sudokuFilled.appendChild(el);
  }
});

window.addEventListener('mouseup', e => {
  selecting = false;
});

// function setGiven('')
