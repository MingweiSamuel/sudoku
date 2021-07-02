import firebase from "firebase/app";
import "firebase/auth";
import "firebase/database";

import * as consts from "./consts";

import * as init from "./initialize";

import * as dataLayer from "./dataLayer";
import * as utils from "./utils";
import * as timer from "./timer";
import "./modes";
import "./share";

const sudoku           = document.getElementById('sudoku')!             as unknown as SVGSVGElement;
const sudokuColors     = document.getElementById('sudoku-colors')!      as unknown as SVGGElement;
const sudokuHighlights = document.getElementById('sudoku-highlights')!  as unknown as SVGGElement;
const sudokuCursor     = document.getElementById('sudoku-cursor')!      as unknown as SVGGElement;
const sudokuGivens     = document.getElementById('sudoku-givens')!      as unknown as SVGGElement;
const sudokuGivensMask = document.getElementById('sudoku-givens-mask')! as unknown as SVGGElement;
const sudokuFilled     = document.getElementById('sudoku-filled')!      as unknown as SVGGElement;
const sudokuFilledMask = document.getElementById('sudoku-filled-mask')! as unknown as SVGGElement;
const sudokuCenter     = document.getElementById('sudoku-center')!      as unknown as SVGGElement;
const sudokuCorner     = document.getElementById('sudoku-corner')!      as unknown as SVGGElement;
const sudokuDrawing    = document.getElementById('sudoku-drawing')!     as unknown as SVGGElement;

timer.setTicking(!init.isNewGame);

function makeTs(): [ typeof firebase.database.ServerValue.TIMESTAMP, number ] {
  return [ firebase.database.ServerValue.TIMESTAMP, Date.now() ];
}


init.authPromise.then(main);

function main(user: firebase.User): void {
  const userId = user.uid;

  (window as any /* TODO */)._allClientsData = init.allClientsData;
  (window as any /* TODO */)._boardData = init.boardData;

  if (null != init.allClientsData.ref) {
    const refClient = init.allClientsData.ref.child(userId);
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
    timer.init(
      refClient.child('elapsedSeconds'),
      elapsedSeconds => init.allClientsData.update({
        [`${userId}/elapsedSeconds`]: elapsedSeconds,
      })
    );
  }

  // Sticky online (if closed in another tab).
  init.allClientsData.watch(`${userId}/online`, {
    onChange({ newVal }) {
      if (!newVal) {
        init.allClientsData.update({
          [`${userId}/online`]: true,
        });
      }
    }
  });

  // Client selected highlights.
  init.allClientsData.watch('*/selected/*', dataLayer.makeBind(sudokuHighlights, {
    create([ otherCid, id ]) {
      const el = document.createElementNS(consts.NS_SVG, 'use');

      if (otherCid !== userId) {
        const rgb = utils.cidToColor(otherCid);
        el.setAttribute('fill', `rgb(${rgb.join(',')})`);
        el.setAttribute('href', '#highlight');
      }
      else {
        el.setAttribute('fill', 'rgb(255, 215, 0)');
        el.setAttribute('href', '#highlight-self');
      }

      const [ x, y ] = utils.id2xy(+id);
      el.setAttribute('x', `${100 * x}`);
      el.setAttribute('y', `${100 * y}`);

      return el;
    },
  }));

  // Client cursor markers (small triangle in top left).
  init.allClientsData.watch('*/cursor', dataLayer.makeBind(sudokuCursor, {
    create() {
      const el = document.createElementNS(consts.NS_SVG, 'use');
      el.setAttribute('href', '#cursor');
      return el;
    },
    update(el, [ otherCid ], val: string) {
      const [ x, y ] = utils.id2xy(+val);

      let fillColor = '#fa0';
      if (otherCid !== userId) {
        const rgb = utils.cidToColor(otherCid);
        fillColor = `rgba(${rgb.join(',')}, 0.4)`;
      }

      el.setAttribute('data-cid', otherCid);
      el.setAttribute('x', `${100 * x}`);
      el.setAttribute('y', `${100 * y}`);
      el.setAttribute('fill', fillColor);
    },
  }));

  // Given cells.
  init.boardData.watch(`${consts.Mode.GIVENS}/*`, dataLayer.makeBind(sudokuGivens, {
    create() {
      const el = document.createElementNS(consts.NS_SVG, 'text');
      el.setAttribute('class', 'givens');
      return el;
    },
    update(el, [ id ], val: number) {
      const [ x, y ] = utils.id2xy(+id);
      el.textContent = '' + val;
      el.setAttribute('x', `${100 * x + 50}`);
      el.setAttribute('y', `${100 * y + 50}`);
    },
  }));
  // Given cells mask, for filled cells and pencil marks.
  init.boardData.watch(`${consts.Mode.GIVENS}/*`, dataLayer.makeBind(sudokuGivensMask, {
    create([ id ]) {
      const el = document.createElementNS(consts.NS_SVG, 'rect');
      el.setAttribute('width', '100');
      el.setAttribute('height', '100');
      el.setAttribute('fill', 'black');

      const [ x, y ] = utils.id2xy(+id);
      el.setAttribute('x', `${100 * x}`);
      el.setAttribute('y', `${100 * y}`);

      return el;
    },
  }));

  // Filled cells.
  init.boardData.watch(`${consts.Mode.FILLED}/*`, dataLayer.makeBind(sudokuFilled, {
    create() {
      const el = document.createElementNS(consts.NS_SVG, 'text');
      el.setAttribute('class', 'filled');
      el.setAttribute('mask', 'url(#sudoku-givens-mask)');
      return el;
    },
    update(el, [ id ], val) {
      const [ x, y ] = utils.id2xy(+id);
      el.textContent = '' + val;
      el.setAttribute('x', `${100 * x + 50}`);
      el.setAttribute('y', `${100 * y + 50}`);
    },
  }));
  // Filled cells mask, for pencil marks.
  init.boardData.watch(`${consts.Mode.FILLED}/*`, dataLayer.makeBind(sudokuFilledMask, {
    create([ id ]) {
      const el = document.createElementNS(consts.NS_SVG, 'rect');
      el.setAttribute('width', '100');
      el.setAttribute('height', '100');
      el.setAttribute('fill', 'black');

      const [ x, y ] = utils.id2xy(+id);
      el.setAttribute('x', `${100 * x}`);
      el.setAttribute('y', `${100 * y}`);

      return el;
    },
  }));

  // Corner pencil marks.
  init.boardData.watch(`${consts.Mode.CORNER}/*`, dataLayer.makeBind(sudokuCorner, {
    create() {
      return document.createElementNS(consts.NS_SVG, 'g');
    },
    update(g, [ id ], val: Record<number, boolean>) {
      while (g.lastChild) g.removeChild(g.lastChild);

      const [ x, y ] = utils.id2xy(+id);

      const nums = Object.entries(val)
        .filter(([ _, flag ]) => flag)
        .map(([ num ]) => num);

      for (let i = 0; i < nums.length; i++) {
        const [ dx, dy ] = utils.cornerMarkPos(i, nums.length);

        const el = document.createElementNS(consts.NS_SVG, 'text');
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
  init.boardData.watch(`${consts.Mode.CENTER}/*`, dataLayer.makeBind(sudokuCenter, {
    create([ id ]) {
      const el = document.createElementNS(consts.NS_SVG, 'text');
      el.setAttribute('class', 'center');
      el.setAttribute('mask', 'url(#sudoku-filled-mask)');

      const [ x, y ] = utils.id2xy(+id);
      el.setAttribute('x', `${100 * x + 50}`);
      el.setAttribute('y', `${100 * y + 50}`);

      return el;
    },
    update(el, [ _id ], val: Record<number, boolean>) {
      const text = utils.stringifyNums(val);
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
  init.boardData.watch(`${consts.Mode.COLORS}/*`, dataLayer.makeBind(sudokuColors, {
    create([ id ]) {
      const el = document.createElementNS(consts.NS_SVG, 'use');
      el.setAttribute('href', '#colors');

      const [ x, y ] = utils.id2xy(+id);
      el.setAttribute('x', `${100 * x}`);
      el.setAttribute('y', `${100 * y}`);

      return el;
    },
    update(el, [ _id ], val: number) {
      const color = consts.COLORS[val];
      el.setAttribute('fill', `rgba(${color.join(',')})`);
    },
  }));

  // Drawings.
  init.boardData.watch(`${consts.Mode.DRAWING}/*`, dataLayer.makeBind(sudokuDrawing, {
    create() {
      console.log('drawing!');
      const el = document.createElementNS(consts.NS_SVG, 'path');
      el.setAttribute('class', 'drawing');

      return el;
    },
    update(el, [ _id ], val: string) {
      el.setAttribute('d', val);
    }
  }));

  init.isFrozenPromise.then(isFrozen => isFrozen || startSolverMode(userId));
}

function startSolverMode(userId: string) {
  // Undo if REDO is false.
  // Redo if REDO is true.
  function updateHistory(redo: boolean): boolean {
    const historyEntries = Object.entries(init.allClientsData.get<object>(userId, redo ? 'historyUndone' : 'history') || {});
    if (0 === historyEntries.length) return false;

    const [ histKey, histVal ] = historyEntries.reduce((entryA, entryB) => {
      const order = (entryA[1].ts[0] - entryB[1].ts[0]) || (entryA[1].ts[1] - entryB[1].ts[1]);
      return (redo !== order > 0) ? entryA : entryB;
    });

    // Ignore empty entries (bug).
    if (!histVal.data) {
      init.allClientsData.update({
        [`${userId}/${redo ? 'historyUndone' : 'history'}/${histKey}`]: null,
      });
      updateHistory(redo);
    }

    const diffData = JSON.parse(histVal.data);
    // Update board changes.
    // TODO: USE OTHER TO RESOLVE CONFLICTS.
    init.boardData.update(redo ? diffData.forward : diffData.back);
    // Remove entry from historyUndone.
    // Add entry to history.
    init.allClientsData.update({
      [`${userId}/history/${histKey}`]: redo ? histVal : null,
      [`${userId}/historyUndone/${histKey}`]: redo ? null : histVal,
    });
    return true;
  }

  function fill(num: null | number, mode: consts.Mode): void {
    const madeChange = fillHelper(num, mode);
    if (null == num && !madeChange) {
      for (const deleteType of consts.DELETE_ORDER) {
        if (fillHelper(null, deleteType)) break;
      }
    }
  }

  function fillHelper(num: null | number, mode: consts.Mode): boolean {
    const update: dataLayer.Update = {};

    type BlockedGrid = (null | number)[] | Record<string | utils.IdCoord, number>;
    const blocked: Record<string | utils.IdCoord, boolean> = {};
    const entries = [
      ...Object.entries(consts.BLOCKED_BY_GIVENS[mode] && init.boardData.get<BlockedGrid>('givens') || {}),
      ...Object.entries(consts.BLOCKED_BY_FILLED[mode] && init.boardData.get<BlockedGrid>('filled') || {}),
    ];
    for (const [ id, val ] of entries) {
      if (null != val)
        blocked[id] = true;
    }

    const selected = Object.entries(init.allClientsData.get<Record<utils.IdCoord, boolean>>(userId, 'selected') || {})
      .filter(([ _, isSet ]) => isSet)
      .map(([ id, _ ]) => id)
      .filter(id => null == blocked[id as any]);

    if (!selected.length) return false;

    const markData = init.boardData.get<Record<string | utils.IdCoord, unknown>>(mode) || {};

    switch (mode) {
      case consts.Mode.GIVENS:
      case consts.Mode.FILLED:
      case consts.Mode.COLORS:
        if (null == num && selected.every(id => null == markData[id])) {
          return false; // Delete nothing.
        }
        for (const id of selected) {
          update[`${mode}/${id}`] = num;
        }
        break;
      case consts.Mode.CORNER:
      case consts.Mode.CENTER:
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
            allSet &&= !!markData[id] && (markData[id] as Record<utils.IdCoord, boolean>)[num];
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
    const history = init.boardData.update(update);
    return pushHistory(history);
  }

  function pushHistory(history: dataLayer.Diff | null): boolean {
    if (!history) return false;
    const key = init.allClientsData.ref!.child(`${userId}/history`).push().key;
    init.allClientsData.update({
      [`${userId}/history/${key}`]: {
        data: JSON.stringify(history),
        ts: makeTs(),
      },
      [`${userId}/historyUndone`]: null,
    });
    return true;
  }

  ((window as any).fillAllGivens = function(grid: number[]): boolean {
    if (!Array.isArray(grid)) throw Error('Grid is not array');
    if (81 !== grid.length) throw Error(`Bad grid length: ${grid.length}.`);

    const history = init.boardData.update({ givens: grid.map(x => x || null) });
    if (!history) return false;
    const key = init.allClientsData.ref!.child(`${userId}/history`).push().key;
    init.allClientsData.update({
      [`${userId}/history/${key}`]: {
        data: JSON.stringify(history),
        ts: makeTs(),
      },
      [`${userId}/historyUndone`]: null,
    });
    return true;
  });

  function loc2svg(xOff: number, yOff: number): null | [ number, number ] {
    const { width: elWidth, height: elHeight } = sudoku.getBoundingClientRect();
    const { x, y, width, height } = sudoku.viewBox.baseVal;
    if (xOff < 0 || yOff < 0) return null;
    const xPx = (width  * xOff / elWidth  + x);
    const yPx = (height * yOff / elHeight + y);
    return [ xPx, yPx ];
  }

  function loc2xy(xOff: number, yOff: number, limitCircle: boolean): null | [ utils.XYCoord, utils.XYCoord ] {
    const svgLoc = loc2svg(xOff, yOff);
    if (!svgLoc) return null;
    const [ xf, yf ] = svgLoc.map(px => px / 100);
    if (consts.SIZE <= xf || consts.SIZE <= yf) return null;

    if (limitCircle) {
      // Limit to circles.
      const xr = xf % 1 - 0.5;
      const yr = yf % 1 - 0.5;
      if (0.25 < xr * xr + yr * yr) return null;
    }

    return [ xf | 0, yf | 0 ];
  }

  function select(x: utils.XYCoord, y: utils.XYCoord, reset = false, mode: true | null = true): boolean {
    if (x < 0 || consts.SIZE <= x || y < 0 || consts.SIZE <= y) return false;

    const id = utils.xy2id(x, y);

    if (reset) {
      init.allClientsData.update({
        [`${userId}/selected`]: { [id]: mode },
        [`${userId}/cursor`]: id,
      });
      return true;
    }

    // // Short circuit if not reseting and already selected.
    // if (init.allClientsData.get(cid, 'selected', 'id')) {
    //   return false;
    // }

    init.allClientsData.update({
      [`${userId}/selected/${id}`]: mode,
      [`${userId}/cursor`]: id,
    });
    return true;
  }

  let fillMode: consts.Mode = consts.Mode.FILLED;

  {
    enum SelectingMode {
      NONE,
      SELECTING,
      DESELECTING,
      DRAWING,
    }
    let selectingMode: SelectingMode = SelectingMode.NONE;

    const drawingPoints: string[] = [];
    let drawingKey: string = "NULL";

    function updateDrawing(): string {
      const d = 'M ' + drawingPoints.join(' L ');
      init.boardData.update({
        [`${consts.Mode.DRAWING}/${drawingKey}`]: d,
      });
      return d;
    }

    sudoku.addEventListener('mousedown', e => {
      if (SelectingMode.NONE === selectingMode) {
        if (consts.Mode.DRAWING === fillMode) {
          const xySvg = loc2svg(e.offsetX, e.offsetY);
          if (!xySvg) return;

          selectingMode = SelectingMode.DRAWING;
          drawingKey = init.boardData.ref!.child(consts.Mode.DRAWING).push().key!;
          drawingPoints.push(xySvg.join(','));
        }
        else {
          const xy = loc2xy(e.offsetX, e.offsetY, false);
          if (!xy) return;
          if (0b0001 === e.buttons) {
            selectingMode = SelectingMode.SELECTING;
            select(...xy, !e.shiftKey && !e.ctrlKey && !e.altKey);
          }
          else if (0b0010 === e.buttons) {
            selectingMode = SelectingMode.DESELECTING;
            select(...xy, false, null)
          }
        }
      }
    });

    sudoku.addEventListener('mousemove', e => {
      if (SelectingMode.DRAWING == selectingMode) {
        const xySvg = loc2svg(e.offsetX, e.offsetY);
        if (!xySvg) return;

        drawingPoints.push(xySvg.join(','));
        updateDrawing();
      }
      else if (SelectingMode.NONE !== selectingMode) {
        const xy = loc2xy(e.offsetX, e.offsetY, true);
        if (!xy) return;

        select(...xy, false, SelectingMode.SELECTING === selectingMode ? true : null);
      }
    });

    window.addEventListener('mouseup', _e => {
      if (SelectingMode.DRAWING === selectingMode) {
        const d = updateDrawing();

        const key = `${consts.Mode.DRAWING}/${drawingKey}`;
        pushHistory({
          forward: {
            [key]: d,
          },
          back: {
            [key]: null,
          }
        });
        drawingPoints.length = 0; // Clear the list of points.
      }
      selectingMode = SelectingMode.NONE;
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
    fillMode = mode as consts.Mode;

    // Update button appearance.
    for (const inputButton of Array.from(document.getElementsByClassName('button-input')) as HTMLButtonElement[]) {
      const num = JSON.parse(inputButton.getAttribute('data-input')!);
      if (null != num) {
        inputButton.style.color = consts.Mode.COLORS === mode ? `rgb(${consts.COLORS[num].slice(0, 3).join(',')})` : '';
        inputButton.innerText = consts.Mode.COLORS === mode ? '\u25A8' : num;
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
      const bad = utils.checkGrid(Object.assign({}, init.boardData.get('filled'), init.boardData.get('givens')));
      if (0 === bad.size) {
        alert('Looks good!');
        timer.setTicking(false);
      }
      else {
        let lastId: utils.IdCoord = 0;
        const selected: Record<utils.IdCoord, true> = {};
        for (const id of bad) {
          selected[id] = true;
          lastId = id;
        }
        init.allClientsData.update({
          [`${userId}/selected`]: selected,
          [`${userId}/cursor`]: lastId,
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
    const DIGIT_REGEX = /Digit(\d)/;

    window.addEventListener('keydown', e => {
      let num: null | number;

      if ('Space' === e.code || 'Tab' === e.code) {
        e.preventDefault();

        let idx = consts.MODE_CYCLE.indexOf(fillMode) + 1 - (2 * (+e.shiftKey)) + consts.MODE_CYCLE.length;
        idx = idx % consts.MODE_CYCLE.length;

        setFillMode(consts.MODE_CYCLE[idx]);

        return;
      }

      if (e.code in consts.CODES) {
        num = consts.CODES[e.code as keyof typeof consts.CODES];
      }
      else if ('Alt' === e.code || 'AltLeft' === e.code || 'AltRight' === e.code) {
        e.preventDefault();
        return;
      }
      else if (e.code in consts.ARROWS) {
        e.preventDefault();
        let x = 0
        let y = 0;
        const cursor = init.allClientsData.get<null | undefined | number>(userId, 'cursor');
        if (null != cursor) {
          const [ dx, dy ] = consts.ARROWS[e.code as keyof typeof consts.ARROWS];
          const [ cx, cy ] = utils.id2xy(cursor);
          x = utils.wrap(cx + dx);
          y = utils.wrap(cy + dy);
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
        fill(num, consts.Mode.CORNER);
        setFillMode(consts.Mode.FILLED);
      }
      else if (e.ctrlKey || e.altKey) {
        fill(num, consts.Mode.CENTER);
        setFillMode(consts.Mode.FILLED);
      }
      else {
        fill(num, fillMode);
      }
    });
  }
}
