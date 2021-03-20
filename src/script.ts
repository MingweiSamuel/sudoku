import * as hsluv from "hsluv";

import firebase from "firebase/app";
import "firebase/auth";
import "firebase/database";

type XYCoord = number;
type IdCoord = number;

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyAmZZULS1wzXF4Sfj6u_eVmigMOL1Ga5NI",
  authDomain: "sudoku-0.firebaseapp.com",
  databaseURL: "https://sudoku-0-default-rtdb.firebaseio.com",
  projectId: "sudoku-0",
  storageBucket: "sudoku-0.appspot.com",
  messagingSenderId: "410365958794",
  appId: "1:410365958794:web:e8fa3326b8d2735ce8ab73"
} as const;
// Initialize Firebase
firebase.initializeApp(firebaseConfig);

import * as util from "./util";

const NS_SVG = 'http://www.w3.org/2000/svg';

enum Mode {
  GIVENS = 'givens',
  FILLED = 'filled',
  CORNER = 'corner',
  CENTER = 'center',
  COLORS = 'colors',
}



const MODES = [ Mode.FILLED, Mode.CORNER, Mode.CENTER, Mode.COLORS ];

const DELETE_ORDER = [
  Mode.FILLED,
  Mode.CORNER,
  Mode.CENTER,
  Mode.COLORS,
] as const;

const BLOCKED_BY_GIVENS = {
  [Mode.GIVENS]: false,
  [Mode.FILLED]: true,
  [Mode.CORNER]: true,
  [Mode.CENTER]: true,
  [Mode.COLORS]: false,
} as const;

const SIZE = 9;

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
} as const;

const ARROWS = {
  ArrowUp:    [  0, -1 ],
  ArrowDown:  [  0,  1 ],
  ArrowLeft:  [ -1,  0 ],
  ArrowRight: [  1,  0 ],
} as const;

const COLORS = [
  [ 0.07, 0.07, 0.07, 1 ],
  [ 0.4, 0.4, 0.4, 0.6 ],
  [ 0.7, 0.7, 0.7, 0.6 ],
  hsluv.hsluvToRgb([  10, 100, 60 ]),
  hsluv.hsluvToRgb([  40, 100, 65 ]),
  hsluv.hsluvToRgb([  70, 100, 90 ]).concat(0.8),
  hsluv.hsluvToRgb([ 120, 100, 80 ]),
  hsluv.hsluvToRgb([ 230, 100, 85 ]),
  hsluv.hsluvToRgb([ 260, 100, 55 ]),
  hsluv.hsluvToRgb([ 300, 100, 70 ]),
].map(row => {
  for (let i = 0; i < 3; i++) {
    row[i] *= 255;
    row[i] |= 0;
  }
  row.length < 4 && row.push(0.6);
  return row as [ number, number, number, number ];
});

const DIGIT_REGEX = /Digit(\d)/;

const sudoku = document.getElementById('sudoku')!;
const sudokuColors = document.getElementById('sudoku-colors')!;
const sudokuHighlights = document.getElementById('sudoku-highlights')!;
const sudokuCursor = document.getElementById('sudoku-cursor')!;
const sudokuGivens = document.getElementById('sudoku-givens')!;
const sudokuGivensMask = document.getElementById('sudoku-givens-mask')!;
const sudokuFilled = document.getElementById('sudoku-filled')!;
const sudokuFilledMask = document.getElementById('sudoku-filled-mask')!;
const sudokuCenter = document.getElementById('sudoku-center')!;
const sudokuCorner = document.getElementById('sudoku-corner')!;


(() => {
  let gameKey: string;
  if (window.location.hash) {
    gameKey = window.location.hash.slice(1);
  }
  else {
    gameKey = firebase.database().ref('game').push().key!;
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

function wrap(x: number): XYCoord {
  return ((x % SIZE) + SIZE) % SIZE;
}


function hash(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash *= 31;
    hash += str.charCodeAt(i);
    hash |= 0;
  }
  return hash;
}

function cidToColor(cid: string): [ number, number, number ] {
  const cidHash = hash(cid);
  const rgb = hsluv.hsluvToRgb([ cidHash % 360, 80, 60 ]);
  return rgb.map(x => 255 * x) as [ number, number, number ];
}

function xy2id(x: XYCoord, y: XYCoord): IdCoord {
  return 9 * y + x;
}
function id2xy(id: IdCoord): [ XYCoord, XYCoord ] {
  return [ id % 9, (id / 9) | 0 ];
}
function bx2id(box: number, idx: number): number {
  const boxId = 27 * ((box / 3) | 0) + 3 * (box % 3);
  const idxId =  9 * ((idx / 3) | 0) +     (idx % 3);
  return boxId + idxId;
}

function cornerMarkPos(i: number, len: number): [ number, number ] {
  let dx: number, dy: number;
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

function formatSecs(secs: number): string {
  const nums: number[] = [];
  // Seconds.
  nums.unshift(secs % 60);
  secs = (secs / 60) | 0;
  // Minutes.
  nums.unshift(secs % 60);
  secs = (secs / 60) | 0;
  // Hours.
  if (secs) nums.unshift(secs);

  return nums
    .map(n => n.toString())
    .map((s, i) => i ? s.padStart(2, '0') : s)
    .join(':');
}

// TODO: Use this!
function checkGrid(filled: Record<IdCoord, number>): Set<IdCoord> {
  const bad = new Set<number>();
  const coordFns = [
    xy2id, // Rows.
    (i: number, j: number) => xy2id(j, i), // Cols.
    bx2id, // Boxes.
  ];
  for (const coordFn of coordFns) {
    for (let i = 0; i < SIZE; i++) {
      const valToId: Record<number, IdCoord> = {};
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

const stringifyNums = (nums: Record<number, boolean>) => Object.entries(nums)
  .filter(([ _, flag ]) => flag)
  .map(([ num ]) => num)
  .join('');

function makeTs(): [ typeof firebase.database.ServerValue.TIMESTAMP, number ] {
  return [ firebase.database.ServerValue.TIMESTAMP, Date.now() ];
}

function main(gameKey: string, cid: string): void {
  const refGame = firebase.database().ref(`game/${gameKey}`);
  const refAllClients = refGame.child('clients');
  const allClientsData = new util.DataLayer(refAllClients);

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

  // Setup timer.
  (() => {
    const timer = document.getElementById('timer')!;
    const timerPause = document.getElementById('button-timer-pause')!;
    const timerPlay = document.getElementById('button-timer-play')!;

    let ticking = true;

    const elapsedSeconds = refClient.child('elapsedSeconds');
    elapsedSeconds.once('value', snapshot => {
      let elapsedSeconds = snapshot.val();
      // Update UI every second.
      setInterval(() => {
        if (!ticking) return;
        elapsedSeconds++;
        timer.textContent = formatSecs(elapsedSeconds);
      }, 1000);
      // Save time every 10 seconds.
      setInterval(() => {
        if (!ticking) return;
        allClientsData.update({
          [`${cid}/elapsedSeconds`]: elapsedSeconds,
        });
      }, 10000);
    });

    timerPause.addEventListener('click', _e => {
      console.log('click');
      ticking = false;
      timerPause.style.display = 'none';
      timerPlay.style.display = '';
    });

    timerPlay.addEventListener('click', _e => {
      ticking = true;
      timerPlay.style.display = 'none';
      timerPause.style.display = '';
    });
  })();

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
  const boardData = new util.DataLayer(refBoard);
  (window as any /* TODO */)._boardData = boardData;

  // Client selected highlights.
  allClientsData.watch('*/selected/*', util.makeBind(sudokuHighlights, {
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

      const [ x, y ] = id2xy(+id);
      el.setAttribute('x', `${100 * x}`);
      el.setAttribute('y', `${100 * y}`);

      return el;
    },
  }));

  // Client cursor markers (small triangle in top left).
  allClientsData.watch('*/cursor', util.makeBind(sudokuCursor, {
    create() {
      const el = document.createElementNS(NS_SVG, 'use');
      el.setAttribute('href', '#cursor');
      return el;
    },
    update(el, [ otherCid ], val: string) {
      const [ x, y ] = id2xy(+val);

      let fillColor = '#fa0';
      if (otherCid !== cid) {
        const rgb = cidToColor(otherCid);
        fillColor = `rgba(${rgb.join(',')}, 0.4)`;
      }
      
      el.setAttribute('data-cid', otherCid);
      el.setAttribute('x', `${100 * x}`);
      el.setAttribute('y', `${100 * y}`);
      el.setAttribute('fill', fillColor);
    },
  }));

  // Given cells.
  boardData.watch(`${Mode.GIVENS}/*`, util.makeBind(sudokuGivens, {
    create() {
      const el = document.createElementNS(NS_SVG, 'text');
      el.setAttribute('class', 'givens');
      return el;
    },
    update(el, [ id ], val: number) {
      const [ x, y ] = id2xy(+id);
      el.textContent = '' + val;
      el.setAttribute('x', `${100 * x + 50}`);
      el.setAttribute('y', `${100 * y + 50}`);
    },
  }));
  // Given cells mask, for filled cells and pencil marks.
  boardData.watch(`${Mode.GIVENS}/*`, util.makeBind(sudokuGivensMask, {
    create([ id ]) {
      const el = document.createElementNS(NS_SVG, 'rect');
      el.setAttribute('width', '100');
      el.setAttribute('height', '100');
      el.setAttribute('fill', 'black');
      
      const [ x, y ] = id2xy(+id);
      el.setAttribute('x', `${100 * x}`);
      el.setAttribute('y', `${100 * y}`);

      return el;
    },
  }));

  // Filled cells.
  boardData.watch(`${Mode.FILLED}/*`, util.makeBind(sudokuFilled, {
    create() {
      const el = document.createElementNS(NS_SVG, 'text');
      el.setAttribute('class', 'filled');
      el.setAttribute('mask', 'url(#sudoku-givens-mask)');
      return el;
    },
    update(el, [ id ], val) {
      const [ x, y ] = id2xy(+id);
      el.textContent = '' + val;
      el.setAttribute('x', `${100 * x + 50}`);
      el.setAttribute('y', `${100 * y + 50}`);
    },
  }));
  // Filled cells mask, for pencil marks.
  boardData.watch(`${Mode.FILLED}/*`, util.makeBind(sudokuFilledMask, {
    create([ id ]) {
      const el = document.createElementNS(NS_SVG, 'rect');
      el.setAttribute('width', '100');
      el.setAttribute('height', '100');
      el.setAttribute('fill', 'black');
      
      const [ x, y ] = id2xy(+id);
      el.setAttribute('x', `${100 * x}`);
      el.setAttribute('y', `${100 * y}`);

      return el;
    },
  }));

  // Corner pencil marks.
  boardData.watch(`${Mode.CORNER}/*`, util.makeBind(sudokuCorner, {
    create() {
      return document.createElementNS(NS_SVG, 'g');
    },
    update(g, [ id ], val: Record<number, boolean>) {
      while (g.lastChild) g.removeChild(g.lastChild);

      const [ x, y ] = id2xy(+id);

      const nums = Object.entries(val)
        .filter(([ _, flag ]) => flag)
        .map(([ num ]) => num);

      for (let i = 0; i < nums.length; i++) {
        const [ dx, dy ] = cornerMarkPos(i, nums.length);

        const el = document.createElementNS(NS_SVG, 'text');
        el.textContent = '' + nums[i];
        el.setAttribute('class', 'corner');
        el.setAttribute('mask', 'url(#sudoku-filled-mask)');
        el.setAttribute('x', `${100 * x + 50 + dx}`);
        el.setAttribute('y', `${100 * y + 50 + dy}`);

        g.appendChild(el);
      }

      sudokuCorner.appendChild(g);
    },
  }));

  // Center pencil marks.
  boardData.watch(`${Mode.CENTER}/*`, util.makeBind(sudokuCenter, {
    create([ id ]) {
      const el = document.createElementNS(NS_SVG, 'text');
      el.setAttribute('class', 'center');
      el.setAttribute('mask', 'url(#sudoku-filled-mask)');
      
      const [ x, y ] = id2xy(+id);
      el.setAttribute('x', `${100 * x + 50}`);
      el.setAttribute('y', `${100 * y + 50}`);

      return el;
    },
    update(el, [ _id ], val: Record<number, boolean>) {
      const text = stringifyNums(val);
      el.textContent = text;

      if (text.length >= 8) {
        el.setAttribute('textLength', '95');
        el.setAttribute('lengthAdjust', 'spacingAndGlyphs');
      }
      else {
        el.removeAttribute('textLength');
        el.removeAttribute('lengthAdjust');
      }
    },
  }));

  // Center pencil marks.
  boardData.watch(`${Mode.COLORS}/*`, util.makeBind(sudokuColors, {
    create([ id ]) {
      const el = document.createElementNS(NS_SVG, 'use');
      el.setAttribute('href', '#colors');

      const [ x, y ] = id2xy(+id);
      el.setAttribute('x', `${100 * x}`);
      el.setAttribute('y', `${100 * y}`);

      return el;
    },
    update(el, [ _id ], val: number) {
      const color = COLORS[val];
      el.setAttribute('fill', `rgba(${color.join(',')})`);
    },
  }));

  // Undo if REDO is false.
  // Redo if REDO is true.
  function updateHistory(redo: boolean): boolean {
    const historyEntries = Object.entries(allClientsData.get<object>(cid, redo ? 'historyUndone' : 'history') || {});
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

  function fill(num: null | number, mode: Mode): void {
    const madeChange = fillHelper(num, mode);
    if (null == num && !madeChange) {
      for (const deleteType of DELETE_ORDER) {
        if (fillHelper(null, deleteType)) break;
      }
    }
  }

  function fillHelper(num: null | number, mode: Mode): boolean {
    const update: util.Update = {};

    const blockedGivens = BLOCKED_BY_GIVENS[mode] && boardData.get<Record<string | IdCoord, number>>('givens') || {};
    const selected = Object.entries(allClientsData.get<Record<IdCoord, boolean>>(cid, 'selected') || {})
      .filter(([ _, isSet ]) => isSet)
      .map(([ id, _ ]) => id)
      .filter(id => !blockedGivens || !blockedGivens[id as any]);

    if (!selected.length) return false;
  
    const markData: Record<string | IdCoord, unknown> = (boardData.data as any)?.[mode] || {};

    switch (mode) {
      case Mode.GIVENS:
      case Mode.FILLED:
      case Mode.COLORS:
        if (null == num && selected.every(id => null == markData[id])) {
          return false; // Delete nothing.
        }
        for (const id of selected) {
          update[`${mode}/${id}`] = num;
        }
        break;
      case Mode.CORNER:
      case Mode.CENTER:
        if (null == num) {
          if (selected.every(id => null == markData[id])) {
            return false; // Delete nothing.
          }
          for (const id of selected) {
            update[`${mode}/${id}`] = null;
          }
        }
        else {
          let allSet = true;
          for (const id of selected) {
            allSet &&= !!markData[id] && (markData[id] as Record<IdCoord, boolean>)[num];
            update[`${mode}/${id}/${num}`] = true;
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
        throw new Error(`Unknown type: ${mode}.`);
    }
    // Update and add update to history.
    const history = boardData.update(update);
    if (!history) return false;
    const key = allClientsData.ref.child(`${cid}/history`).push().key;
    allClientsData.update({
      [`${cid}/history/${key}`]: {
        data: JSON.stringify(history),
        ts: makeTs(),
      },
      [`${cid}/historyUndone`]: null,
    });
    return true;
  }

  function loc2xy(xOff: number, yOff: number, limitCircle: boolean): null | [ XYCoord, XYCoord ] {
    const { width, height } = sudoku.getBoundingClientRect();
    if (xOff < 0 || yOff < 0) return null;
    const xf = SIZE * xOff / width;
    const yf = SIZE * yOff / height;
    if (SIZE <= xf || SIZE <= yf) return null;

    if (limitCircle) {
      // Limit to circles.
      const xr = xf % 1 - 0.5;
      const yr = yf % 1 - 0.5;
      if (0.25 < xr * xr + yr * yr) return null;
    }

    return [ xf | 0, yf | 0 ];
  }

  function select(x: XYCoord, y: XYCoord, reset = false, mode: true | null = true): boolean {
    if (x < 0 || SIZE <= x || y < 0 || SIZE <= y) return false;

    const id = xy2id(x, y);

    if (reset) {
      allClientsData.update({
        [`${cid}/selected`]: { [id]: mode },
        [`${cid}/cursor`]: id,
      });
      return true;
    }

    // // Short circuit if not reseting and already selected.
    // if (allClientsData.get(cid, 'selected', 'id')) {
    //   return false;
    // }

    allClientsData.update({
      [`${cid}/selected/${id}`]: mode,
      [`${cid}/cursor`]: id,
    });
    return true;
  }


  {
    let selectingMode = 0; // 0 for none, 1 for selecting, 2 for deselecting.

    sudoku.addEventListener('mousedown', e => {
      if (0 === selectingMode) {
        const xy = loc2xy(e.offsetX, e.offsetY, false);
        if (!xy) return;
        if (0b0001 === e.buttons) {
          selectingMode = 1;
          select(...xy, !e.shiftKey && !e.ctrlKey && !e.altKey);
        }
        else if (0b0010 === e.buttons) {
          selectingMode = 2;
          select(...xy, false, null)
        }
      }
    });

    sudoku.addEventListener('mousemove', e => {
      if (0 !== selectingMode) {
        const xy = loc2xy(e.offsetX, e.offsetY, true);
        if (!xy) return;
        select(...xy, false, 1 === selectingMode ? true : null);
      }
    });

    window.addEventListener('mouseup', _e => {
      if (0 !== selectingMode) {
        selectingMode = 0;
      }
    });

    sudoku.addEventListener('contextmenu', e => {
      e.preventDefault();
    });
  }

  {
    function handleTouch(e: TouchEvent, reset = false): void {
      e.preventDefault();

      const { top, left } = sudoku.getBoundingClientRect();

      for (let i = 0; i < e.targetTouches.length; i++) {
        const touch = e.targetTouches.item(i)!;
        const xy = loc2xy(touch.clientX - left, touch.clientY - top, true);
        if (!xy) continue;
        select(...xy, reset);
      }
    }
    sudoku.addEventListener('touchstart', e => handleTouch(e, 1 === e.targetTouches.length));
    sudoku.addEventListener('touchmove', e => handleTouch(e));
  }

  let fillMode: Mode = Mode.FILLED;

  function setFillMode(arg: string | HTMLButtonElement): void {
    let el: HTMLButtonElement;
    let mode: string;
    if ('string' !== typeof arg) {
      el = arg;
      mode = el.getAttribute('data-mode')!;
    }
    else {
      mode = arg;
      el = document.querySelector(`.button-mode[data-mode="${mode}"]`)!;
    }
    if (0 > MODES.indexOf(mode as any)) throw new Error(`Unknown mode: ${mode}.`);
    fillMode = mode as Mode;

    // Update button appearance.
    for (const inputButton of Array.from(document.getElementsByClassName('button-input')) as HTMLButtonElement[]) {
      const num = JSON.parse(inputButton.getAttribute('data-input')!);
      if (null != num) {
        inputButton.style.color = Mode.COLORS === mode ? `rgb(${COLORS[num].slice(0, 3).join(',')})` : '';
        inputButton.innerText = Mode.COLORS === mode ? '\u25A8' : num;
      }
    }

    for (const button of Array.from(document.getElementsByClassName('button-mode'))) {
      button.classList.add('control-btn-inv');
    }
    el && el.classList.remove('control-btn-inv');
  }
  (window as any)._setFillMode = setFillMode;

  {
    document.getElementById('button-undo')!.addEventListener('click', _e => updateHistory(false));
    document.getElementById('button-redo')!.addEventListener('click', _e => updateHistory(true));
    document.getElementById('button-check')!.addEventListener('click', _e => {
      const bdObj: { filled?: Record<IdCoord, number>, givens?: Record<IdCoord, number> } = boardData.data as object || {};
      const bad = checkGrid(Object.assign({}, bdObj.filled, bdObj.givens));
      if (0 === bad.size) {
        alert('Looks good!');
      }
      else {
        let lastId: IdCoord = 0;
        const selected: Record<IdCoord, true> = {};
        for (const id of bad) {
          selected[id] = true;
          lastId = id;
        }
        allClientsData.update({
          [`${cid}/selected`]: selected,
          [`${cid}/cursor`]: lastId,
        });
        alert("Something's wrong!");
      }
    });

    for (const button of Array.from(document.getElementsByClassName('button-mode'))) {
      button.addEventListener('click', e => setFillMode(e.currentTarget as HTMLButtonElement));
    }

    function onButtonInput(this: Element, _e: Event): void {
      const val = JSON.parse(this.getAttribute('data-input')!);
      fill(val, fillMode);
    }
    for (const button of Array.from(document.getElementsByClassName('button-input'))) {
      button.addEventListener('click', onButtonInput);
    }
  }

  {
    window.addEventListener('keydown', e => {
      let num: null | number;

      if ('Space' === e.code || 'Tab' === e.code) {
        e.preventDefault();

        let idx = MODES.indexOf(fillMode) + 1 - (2 * (+e.shiftKey)) + MODES.length;
        idx = idx % MODES.length;

        setFillMode(MODES[idx]);

        return;
      }

      if (e.code in CODES) {
        num = CODES[e.code as keyof typeof CODES];
      }
      else if ('Alt' === e.code || 'AltLeft' === e.code || 'AltRight' === e.code) {
        e.preventDefault();
        return;
      }
      else if (e.code in ARROWS) {
        e.preventDefault();
        let x = 0
        let y = 0;
        const cursor = allClientsData.get<null | undefined | number>(cid, 'cursor');
        if (null != cursor) {
          const [ dx, dy ] = ARROWS[e.code as keyof typeof ARROWS];
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
        return;
      }
      else {
        let match = DIGIT_REGEX.exec(e.code);
        if (!match) return;
        num = Number(match[1]);
      }

      e.preventDefault();

      if (e.shiftKey) {
        fill(num, Mode.CORNER);
        setFillMode(Mode.FILLED);
      }
      else if (e.ctrlKey || e.altKey) {
        fill(num, Mode.CENTER);
        setFillMode(Mode.FILLED);
      }
      else {
        fill(num, fillMode);
      }
    });
  }
}
