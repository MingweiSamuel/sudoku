const NS_SVG = 'http://www.w3.org/2000/svg';

const sudoku = document.getElementById('sudoku');
const sudokuHighlights = document.getElementById('sudoku-highlights');

let selecting = false;

const selected = new Set();
function select(x, y) {
  const id = xy2id(x, y);
  if (!selected.has(id)) {
    selected.add(id);

    const highlight = document.createElementNS(NS_SVG, 'use');
    highlight.setAttribute('href', '#highlight');
    highlight.setAttribute('x', x);
    highlight.setAttribute('y', y);

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
// function id2xy(id) {
//   return [ id % 9, (id / 9) | 0 ];
// }

sudoku.addEventListener('mousedown', e => {
  if (!selecting) {
    selecting = true;
    if (!e.shiftKey && !e.ctrlKey)
      unselect();
  }
});

sudoku.addEventListener('mousemove', e => {
  if (selecting) {
    const x = 100 * ((e.offsetX / 100) | 0);
    const y = 100 * ((e.offsetY / 100) | 0);
    select(x, y);
  }
});

window.addEventListener('mouseup', e => {
  selecting = false;
});
