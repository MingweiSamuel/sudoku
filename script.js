const NS_SVG = 'http://www.w3.org/2000/svg';

const SIZE = 9;
const CELLS = 81;

const KEYS = {
  Delete: null,
};

const ARROWS = {
  ArrowUp:    [  0, -1 ],
  ArrowDown:  [  0,  1 ],
  ArrowLeft:  [ -1,  0 ],
  ArrowRight: [  1,  0 ],
};

const sudoku = document.getElementById('sudoku');
const sudokuHighlights = document.getElementById('sudoku-highlights');
const sudokuCursor = document.getElementById('sudoku-cursor');
const sudokuGivens = document.getElementById('sudoku-givens');
const sudokuFilled = document.getElementById('sudoku-filled');
const sudokuCenter = document.getElementById('sudoku-center');
const sudokuCorner = document.getElementById('sudoku-corner');

const data = {
  selected: {},
  filled: {},
  center: {},
  corner: {},
};




(() => {
  let boardKey;
  if (window.location.hash) {
    boardKey = window.location.hash.slice(1);
  }
  else {
    boardKey = firebase.database().ref('boards').push().key;
    window.location.hash = '#' + boardKey;
  }

  const cid = firebase.database().ref(`boards/${boardKey}/clients`).push().key;
  main(boardKey, cid);

  // firebase.auth().onAuthStateChanged((user) => {
  //   if (user) {
  //     // User is signed in, see docs for a list of available properties
  //     // https://firebase.google.com/docs/reference/js/firebase.User
  //     main(boardKey, user);
  //   } else {
  //     // User is signed out
  //     // ...
  //   }
  // });
  // firebase.auth().signInAnonymously();
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

const stringifyNums = nums => Object.entries(nums)
  .filter(([ _, flag ]) => flag)
  .map(([ num ]) => num)
  .join('');



function main(boardKey, cid) {
  const refAllClients = firebase.database().ref(`boards/${boardKey}/clients`);

  const refClient = refAllClients.child(cid);
  refClient.set({ connected: true, name: null });
  refClient.onDisconnect().remove();

  const refSelected = refClient.child('selected');
  const selectedData = watch(refSelected);
  const refCursor = refClient.child('cursor');
  const cursorData = watch(refCursor);

  const refFilled = firebase.database().ref(`boards/${boardKey}/filled`);
  const refCenter = firebase.database().ref(`boards/${boardKey}/center`);
  const refCorner = firebase.database().ref(`boards/${boardKey}/corner`);


  bind(refAllClients, sudokuHighlights, {
    pattern: '*/selected/*',
    create() {
      const el = document.createElementNS(NS_SVG, 'use');
      el.setAttribute('href', '#highlight');
      return el;
    },
    update(el, [ otherCid, id ], val) {
      const [ x, y ] = id2xy(id);

      let fillColor = 'rgba(255, 215, 0, 0.4)';
      if (otherCid !== cid) {
        const rgb = cidToColor(otherCid);
        fillColor = `rgba(${rgb.join(',')}, 0.15)`;
      }

      el.setAttribute('x', 100 * x);
      el.setAttribute('y', 100 * y);
      el.setAttribute('fill', fillColor);
    },
  });

  bind(refAllClients, sudokuCursor, {
    pattern: '*/cursor',
    create() {
      const el = document.createElementNS(NS_SVG, 'use');
      el.setAttribute('href', '#cursor');
      return el;
    },
    update(el, [ otherCid ], val) {
      const [ x, y ] = id2xy(val);

      let fillColor = '#f80';
      if (otherCid !== cid) {
        const rgb = cidToColor(otherCid);
        fillColor = `rgba(${rgb.join(',')}, 0.3)`;
      }
      
      el.setAttribute('data-cid', otherCid);
      el.setAttribute('x', 100 * x);
      el.setAttribute('y', 100 * y);
      el.setAttribute('fill', fillColor);
    },
  });

  const filledData = bind(refFilled, sudokuFilled, {
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
  });

  const centerData = bind(refCenter, sudokuCenter, {
    create() {
      const el = document.createElementNS(NS_SVG, 'text');
      el.setAttribute('class', 'center');
      return el;
    },
    update(el, [ id ], val) {
      const [ x, y ] = id2xy(id);
      el.textContent = stringifyNums(val);
      el.setAttribute('x', 100 * x + 50);
      el.setAttribute('y', 100 * y + 50);
    },
  });

  const cornerData = bind(refCorner, sudokuCorner, {
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
        el.setAttribute('x', 100 * x + 50 + dx);
        el.setAttribute('y', 100 * y + 50 + dy);

        g.appendChild(el);
      }

      sudokuCorner.appendChild(g);
    },
  });

  const getData = {
    center: centerData,
    corner: cornerData,
  };


  function fillDigit(num) {
    const updates = {};
    for (let id = 0; id < CELLS; id++) {
      if (selectedData()[id]) {
        updates[id] = num;
      }
    }
    refFilled.update(updates);
  }

  function fill(num, type) {
    const updates = {};
    if (null == num) {
      for (let id = 0; id < CELLS; id++) {
        if (selectedData()[id]) {
          updates[id] = null;
        }
      }
    }
    else {
      let allSet = true;
      for (let id = 0; id < CELLS; id++) {
        if (selectedData()[id]) {
          allSet &= (getData[type]()[id] || {})[num];
          updates[`${id}/${num}`] = true;
        }
      }
      // If they are all set, set to false.
      if (allSet) {
        for (const key of Object.keys(updates)) {
          updates[key] = null;
        }
      }
    }

    ({
      center: refCenter,
      corner: refCorner,
    })[type].update(updates);
  }

  function offset2xy({ offsetX, offsetY }) {
    const x = (offsetX / 100) | 0;
    const y = (offsetY / 100) | 0;
    return [ x, y ];
  }

  function select(x, y, reset = false) {
    const id = xy2id(x, y);
    if (reset) refSelected.set({ [id]: true });
    else refSelected.child(id).set(true);
    refCursor.set(id);
  }


  (() => {
    let selecting = false;

    sudoku.addEventListener('mousedown', e => {
      if (!selecting) {
        selecting = true;
        const [ x, y ] = offset2xy(e);
        select(x, y, !e.shiftKey && !e.ctrlKey);
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
  })();

  const DIGIT_REGEX = /Digit(\d)/;
  window.addEventListener('keydown', e => {
    let num;
    if (e.code in KEYS) {
      num = KEYS[e.code]
    }
    else if (e.code in ARROWS) {
      e.preventDefault();
      let x = 0
      let y = 0;
      const cursor = cursorData();
      if (null != cursor) {
        const [ dx, dy ] = ARROWS[e.code];
        const [ cx, cy ] = id2xy(cursor);
        x = wrap(cx + dx);
        y = wrap(cy + dy);
      }
      select(x, y, !e.shiftKey && !e.ctrlKey);
      return;
    }
    else {
      let match = DIGIT_REGEX.exec(e.code);
      if (!match) return;
      num = Number(match[1]);
    }

    e.preventDefault();

    if (e.ctrlKey) {
      fill(num, 'center');
    }
    else if (e.shiftKey) {
      fill(num, 'corner');
    }
    else {
      fillDigit(num);
    }
  });
}
