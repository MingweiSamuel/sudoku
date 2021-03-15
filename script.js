const NS_SVG = 'http://www.w3.org/2000/svg';

const FILLED = 'filled';
const CORNER = 'corner';
const CENTER = 'center';
const MODES = [ FILLED, CORNER, CENTER ];

const NUMS = [ null, 0, 1, 2, 3, 4, 5, 6, 7, 8, 9 ];
const SIZE = 9;
const CELLS = 81;

const CODES = {
  Delete: null,
  Backspace: null,
  Backquote: 0,
  KeyQ: 4,
  KeyW: 5,
  KeyE: 6,
  KeyA: 7,
  KeyS: 8,
  KeyD: 9,
};

const ARROWS = {
  ArrowUp:    [  0, -1 ],
  ArrowDown:  [  0,  1 ],
  ArrowLeft:  [ -1,  0 ],
  ArrowRight: [  1,  0 ],
};

const MODE_KEYS = {
  Shift: CORNER,
  Control: CENTER,
  Alt: CENTER,
};

const DIGIT_REGEX = /Digit(\d)/;

const sudoku = document.getElementById('sudoku');
const sudokuHighlights = document.getElementById('sudoku-highlights');
const sudokuCursor = document.getElementById('sudoku-cursor');
const sudokuGivens = document.getElementById('sudoku-givens');
const sudokuFilled = document.getElementById('sudoku-filled');
const sudokuFilledMask = document.getElementById('sudoku-filled-mask');
const sudokuCenter = document.getElementById('sudoku-center');
const sudokuCorner = document.getElementById('sudoku-corner');


(() => {
  let gameKey;
  if (window.location.hash) {
    gameKey = window.location.hash.slice(1);
  }
  else {
    gameKey = firebase.database().ref('game').push().key;
    window.location.hash = '#' + gameKey;
  }

  // const cid = firebase.database().ref(`game/${gameKey}/clients`).push().key;
  // main(gameKey, cid);

  firebase.auth().onAuthStateChanged((user) => {
    if (user) {
      // User is signed in, see docs for a list of available properties
      // https://firebase.google.com/docs/reference/js/firebase.User
      main(gameKey, user.uid);
    } else {
      // User is signed out
      // ...
    }
  });
  firebase.auth().signInAnonymously();
})();

function wrap(x) {
  return ((x % SIZE) + SIZE) % SIZE;
}


function hash(str) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash *= 31;
    hash += str.charCodeAt(i);
    hash |= 0;
  }
  return hash;
}

function cidToColor(cid) {
  const cidHash = hash(cid);
  const rgb = hsluv.hsluvToRgb([ cidHash % 360, 80, 60 ]);
  return rgb.map(x => 255 * x);
}

function xy2id(x, y) {
  return 9 * y + x;
}
function id2xy(id) {
  return [ id % 9, (id / 9) | 0 ];
}
function bx2id(box, idx) {
  const boxId = 27 * ((box / 3) | 0) + 3 * (box % 3);
  const idxId =  9 * ((idx / 3) | 0) +     (idx % 3);
  return boxId + idxId;
}

function cornerPos(i, len) {
  let dx, dy;
  if (len <= 4) {
    dx = (i % 2) * 60 - 30;
    dy = ((i / 2) | 0) * 60 - 30;
  }
  else {
    const half = (len / 2) | 0;
    if (i < half) {
      const d = 60 / (half - 1);
      dx = i * d - 30;
      dy = -30;
    }
    else {
      const d = 60 / (len - half - 1);
      dx = (i - half) * d - 30;
      dy = 30;
    }
  }
  return [ dx, dy ];
}

// TODO: Use this!
function checkGrid(filled) {
  const bad = new Set();
  const coordFns = [
    xy2id, // Rows.
    (i, j) => xy2id(j, i), // Cols.
    bx2id, // Boxes.
  ];
  for (const coordFn of coordFns) {
    for (let i = 0; i < SIZE; i++) {
      const valToId = {};
      for (let j = 0; j < SIZE; j++) {
        const id = coordFn(i, j);
        const val = filled[id];
        if (!val) bad.add(id);
        else if (val in valToId) {
          bad.add(valToId[val]);
          bad.add(id);
        }
        else valToId[val] = id;
      }
    }
  }
  return bad;
}

const stringifyNums = nums => Object.entries(nums)
  .filter(([ _, flag ]) => flag)
  .map(([ num ]) => num)
  .join('');

function makeTs() {
  return [ firebase.database.ServerValue.TIMESTAMP, Date.now() ];
}

function main(gameKey, cid) {
  const refGame = firebase.database().ref(`game/${gameKey}`);
  const refAllClients = refGame.child('clients');
  const allClientsData = new DataLayer(refAllClients);

  const refClient = refAllClients.child(cid);
  refClient.update({
    // cursor: null,
    // selected: null,
    // history: null,
    // historyUndone: null,
    online: true,
    ts: makeTs(),
  });
  refClient.child('online').onDisconnect().set(false);

  // Sticky online (if closed in another tab).
  allClientsData.watch(`${cid}/online`, {
    onChange({ newVal }) {
      if (!newVal) {
        allClientsData.update({
          [`${cid}/online`]: true,
        });
      }
    }
  });

  const refBoard = refGame.child('board');
  const boardData = new DataLayer(refBoard);
  window._boardData = boardData;

  // Client selected highlights.
  allClientsData.watch('*/selected/*', makeBind(sudokuHighlights, {
    create([ otherCid, id ]) {
      const el = document.createElementNS(NS_SVG, 'use');

      if (otherCid !== cid) {
        const rgb = cidToColor(otherCid);
        el.setAttribute('fill', `rgb(${rgb.join(',')})`);
        el.setAttribute('href', '#highlight');
      }
      else {
        el.setAttribute('fill', 'rgb(255, 215, 0)');
        el.setAttribute('href', '#highlight-self');
      }

      const [ x, y ] = id2xy(id);
      el.setAttribute('x', 100 * x);
      el.setAttribute('y', 100 * y);

      return el;
    },
  }));

  // Client cursor markers (small triangle in top left).
  allClientsData.watch('*/cursor', makeBind(sudokuCursor, {
    create() {
      const el = document.createElementNS(NS_SVG, 'use');
      el.setAttribute('href', '#cursor');
      return el;
    },
    update(el, [ otherCid ], val) {
      const [ x, y ] = id2xy(val);

      let fillColor = '#fa0';
      if (otherCid !== cid) {
        const rgb = cidToColor(otherCid);
        fillColor = `rgba(${rgb.join(',')}, 0.4)`;
      }
      
      el.setAttribute('data-cid', otherCid);
      el.setAttribute('x', 100 * x);
      el.setAttribute('y', 100 * y);
      el.setAttribute('fill', fillColor);
    },
  }));

  // Filled cells.
  boardData.watch(`${FILLED}/*`, makeBind(sudokuFilled, {
    create() {
      const el = document.createElementNS(NS_SVG, 'text');
      el.setAttribute('class', 'filled');
      return el;
    },
    update(el, [ id ], val) {
      const [ x, y ] = id2xy(id);
      el.textContent = '' + val;
      el.setAttribute('x', 100 * x + 50);
      el.setAttribute('y', 100 * y + 50);
    },
  }));
  // Filled cells mask, for pencil marks.
  boardData.watch(`${FILLED}/*`, makeBind(sudokuFilledMask, {
    create() {
      const el = document.createElementNS(NS_SVG, 'rect');
      el.setAttribute('width', '100');
      el.setAttribute('height', '100');
      el.setAttribute('fill', 'black');
      return el;
    },
    update(el, [ id ], _val) {
      const [ x, y ] = id2xy(id);
      el.setAttribute('x', 100 * x);
      el.setAttribute('y', 100 * y);
    },
  }));

  // Corner pencil marks.
  boardData.watch(`${CORNER}/*`, makeBind(sudokuCorner, {
    create() {
      return document.createElementNS(NS_SVG, 'g');
    },
    update(g, [ id ], val) {
      while (g.lastChild) g.removeChild(g.lastChild);

      const [ x, y ] = id2xy(id);

      const nums = Object.entries(val)
        .filter(([ _, flag ]) => flag)
        .map(([ num ]) => num);

      for (let i = 0; i < nums.length; i++) {
        const [ dx, dy ] = cornerPos(i, nums.length);

        const el = document.createElementNS(NS_SVG, 'text');
        el.textContent = '' + nums[i];
        el.setAttribute('class', 'corner');
        el.setAttribute('mask', 'url(#sudoku-filled-mask)');
        el.setAttribute('x', 100 * x + 50 + dx);
        el.setAttribute('y', 100 * y + 50 + dy);

        g.appendChild(el);
      }

      sudokuCorner.appendChild(g);
    },
  }));

  // Center pencil marks.
  boardData.watch(`${CENTER}/*`, makeBind(sudokuCenter, {
    create() {
      const el = document.createElementNS(NS_SVG, 'text');
      el.setAttribute('class', 'center');
      el.setAttribute('mask', 'url(#sudoku-filled-mask)');
      return el;
    },
    update(el, [ id ], val) {
      const [ x, y ] = id2xy(id);
      const text = stringifyNums(val);
      el.textContent = text;
      el.setAttribute('x', 100 * x + 50);
      el.setAttribute('y', 100 * y + 50);
      if (text.length >= 8) {
        el.setAttribute('textLength', 95);
        el.setAttribute('lengthAdjust', 'spacingAndGlyphs');
      }
      else {
        el.removeAttribute('textLength');
        el.removeAttribute('lengthAdjust');
      }
    },
  }));

  // Undo if REDO is false.
  // Redo if REDO is true.
  function updateHistory(redo) {
    const historyEntries = Object.entries(allClientsData.get(cid, redo ? 'historyUndone' : 'history') || {});
    if (0 === historyEntries.length) return false;

    const [ histKey, histVal ] = historyEntries.reduce((entryA, entryB) => {
      const order = (entryA[1].ts[0] - entryB[1].ts[0]) || (entryA[1].ts[1] - entryB[1].ts[1]);
      return (redo !== order > 0) ? entryA : entryB;
    });

    // Ignore empty entries (bug).
    if (!histVal.data) {
      allClientsData.update({
        [`${cid}/${redo ? 'historyUndone' : 'history'}/${histKey}`]: null,
      });
      updateHistory(redo);
    }

    const diffData = JSON.parse(histVal.data);
    // Update board changes.
    // TODO: USE OTHER TO RESOLVE CONFLICTS.
    boardData.update(redo ? diffData.forward : diffData.back);
    // Remove entry from historyUndone.
    // Add entry to history.
    allClientsData.update({
      [`${cid}/history/${histKey}`]: redo ? histVal : null,
      [`${cid}/historyUndone/${histKey}`]: redo ? null : histVal,
    });
    return true;
  }

  function fill(num, type) {
    const update = {};
    const selected = Object.entries(allClientsData.get(cid, 'selected') || {})
      .filter(([ _, isSet ]) => isSet)
      .map(([ key, _ ]) => key);

    switch (type) {
      case FILLED:
        for (const id of selected) {
          update[`${type}/${id}`] = num;
        }
        break;
      case CORNER:
      case CENTER:
        if (null == num) {
          for (const id of selected) {
            update[`${type}/${id}`] = null;
          }
        }
        else {
          const filledData = boardData.data[type] || {};

          let allSet = true;
          for (const id of selected) {
            allSet &&= filledData[id] && filledData[id][num];
            update[`${type}/${id}/${num}`] = true;
          }
          // If they are all set, unset all.
          if (allSet) {
            for (const key of Object.keys(update)) {
              update[key] = null;
            }
          }
        }
        break;
      default:
        throw new Error(`Unknown type: ${type}.`);
    }
    // Update and add update to history.
    const history = boardData.update(update);
    if (history) {
      const key = allClientsData.ref.child(`${cid}/history`).push().key;
      allClientsData.update({
        [`${cid}/history/${key}`]: {
          data: JSON.stringify(history),
          ts: makeTs(),
        },
        [`${cid}/historyUndone`]: null,
      });
    }
  }

  function offset2xy({ offsetX, offsetY }) {
    const { width, height } = sudoku.getBoundingClientRect();
    const x = (9 * offsetX / width) | 0;
    const y = (9 * offsetY / height) | 0;
    return [ x, y ];
  }

  function select(x, y, reset = false) {
    if (x < 0 || SIZE <= x || y < 0 || SIZE <= y) return false;

    const id = xy2id(x, y);

    if (reset) {
      allClientsData.update({
        [`${cid}/selected`]: null,
      });
    }
    else if (allClientsData.get(cid, 'selected', 'id')) {
      // Short circuit if not reseting and already selected.
      return false;
    }

    allClientsData.update({
      [`${cid}/selected/${id}`]: true,
      [`${cid}/cursor`]: id,
    });
    return true;
  }


  {
    let selecting = false;

    sudoku.addEventListener('mousedown', e => {
      if (!selecting) {
        selecting = true;
        const [ x, y ] = offset2xy(e);
        select(x, y, !e.shiftKey && !e.ctrlKey && !e.altKey);
      }
    });

    sudoku.addEventListener('mousemove', e => {
      if (selecting) {
        const [ x, y ] = offset2xy(e);
        select(x, y);
      }
    });

    window.addEventListener('mouseup', e => {
      selecting = false;
    });
  }

  {
    function handleTouch(e, reset = false) {
      e.preventDefault();

      const { top, left } = sudoku.getBoundingClientRect();

      for (let i = 0; i < e.targetTouches.length; i++) {
        const touch = e.targetTouches.item(i);
        const [ x, y ] = offset2xy({
          offsetX: touch.clientX - left,
          offsetY: touch.clientY - top,
        });
        select(x, y, reset);
      }
    }
    sudoku.addEventListener('touchstart', e => handleTouch(e, 1 === e.targetTouches.length));
    sudoku.addEventListener('touchmove', e => handleTouch(e));
  }

  let fillMode = FILLED;
  let fillModeOld = null;

  function setFillMode(mode) {
    let el = null;
    if ('string' !== typeof mode) {
      el = mode;
      mode = el.getAttribute('data-mode');
    }
    else {
      el = document.querySelector(`.button-mode[data-mode="${mode}"]`);
    }

    fillMode = mode;

    for (const button of document.getElementsByClassName('button-mode')) {
      button.classList.add('control-btn-inv');
    }
    el.classList.remove('control-btn-inv');
  }

  {
    document.getElementById('button-undo').addEventListener('click', e => updateHistory(false));
    document.getElementById('button-redo').addEventListener('click', e => updateHistory(true));

    for (const button of document.getElementsByClassName('button-mode')) {
      button.addEventListener('click', e => setFillMode(e.currentTarget));
    }


    const onInput = e => {
      const val = JSON.parse(e.currentTarget.getAttribute('data-input'));
      fill(val, fillMode);
    };
    for (const button of document.getElementsByClassName('button-input')) {
      button.addEventListener('click', onInput);
    }
  }

  {
    window.addEventListener('keydown', e => {
      let num;

      if (e.key in MODE_KEYS) {
        e.preventDefault();
        if (null == fillModeOld)
          fillModeOld = fillMode;
        setFillMode(MODE_KEYS[e.key]);
        return;
      }
      if ('Space' === e.code) {
        e.preventDefault();

        let idx = MODES.indexOf(fillModeOld || fillMode) + 1 - (2 * e.shiftKey) + MODES.length;
        idx = idx % MODES.length;

        fillModeOld = null;
        setFillMode(MODES[idx]);

        return;
      }

      if (e.code in CODES) {
        num = CODES[e.code]
      }
      else if ('Alt' === e.code || 'AltLeft' === e.code || 'AltRight' === e.code) {
        e.preventDefault();
        return;
      }
      else if (e.code in ARROWS) {
        e.preventDefault();
        let x = 0
        let y = 0;
        const cursor = allClientsData.get(cid, 'cursor');
        if (null != cursor) {
          const [ dx, dy ] = ARROWS[e.code];
          const [ cx, cy ] = id2xy(cursor);
          x = wrap(cx + dx);
          y = wrap(cy + dy);
        }
        select(x, y, !e.shiftKey && !e.ctrlKey && !e.altKey);
        return;
      }
      else if ('KeyZ' === e.code) {
        if (e.ctrlKey) {
          e.preventDefault();
          updateHistory(e.shiftKey);
        }
        return;
      }
      else if ('KeyY' === e.code) {
        if (e.ctrlKey) {
          e.preventDefault();
          updateHistory(true);
        }
      }
      else {
        let match = DIGIT_REGEX.exec(e.code);
        if (!match) return;
        num = Number(match[1]);
      }

      e.preventDefault();

      if (e.shiftKey) {
        fill(num, CORNER);
        fillModeOld = FILLED; // Reset if user is using keys.
      }
      else if (e.ctrlKey || e.altKey) {
        fill(num, CENTER);
        fillModeOld = FILLED; // Reset if user is using keys.
      }
      else {
        fill(num, FILLED);
      }
    });

    window.addEventListener('keyup', e => {
      if (e.key in MODE_KEYS) {
        e.preventDefault();
        if (e.shiftKey) {
          setFillMode(CORNER);
        }
        else if (e.ctrlKey || e.altKey) {
          setFillMode(CENTER);
        }
        else if (fillModeOld) {
          setFillMode(fillModeOld);
          fillModeOld = null;
        }
      }
    });
  }
}
