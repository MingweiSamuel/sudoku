const NS_SVG = 'http://www.w3.org/2000/svg';

const CELLS = 81;

const sudoku = document.getElementById('sudoku');
const sudokuHighlights = document.getElementById('sudoku-highlights');
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
  const refClients = firebase.database().ref(`boards/${boardKey}/clients/${cid}`);
  refClients.set({ connected: true, name: null });
  refClients.onDisconnect().remove();

  const refSelected = firebase.database().ref(`boards/${boardKey}/selected/${cid}`);
  refSelected.onDisconnect().remove();

  const refFilled = firebase.database().ref(`boards/${boardKey}/filled`);
  const refCenter = firebase.database().ref(`boards/${boardKey}/center`);
  const refCorner = firebase.database().ref(`boards/${boardKey}/corner`);


  firebase.database().ref(`boards/${boardKey}/selected`).on('value', snapshot => {
    const selectedNew = snapshot.val() || {};
    const cids = new Set([ ...Object.keys(data.selected), ...Object.keys(selectedNew) ]);
    for (const otherCid of cids) {

      const uselected = data.selected[otherCid] || {};
      const uselectedNew = selectedNew[otherCid] || {};
      const isMe = otherCid === cid;

      for (let id = 0; id < CELLS; id++) {
        if (uselected[id]) {
          if (!uselectedNew[id]) {
            const remove = sudokuHighlights.querySelector(`[data-id="${id}"][data-cid="${otherCid}"]`);
            if (remove) sudokuHighlights.removeChild(remove);
          }
        }
        else if (uselectedNew[id]) {
          const [ x, y ] = id2xy(id);

          const highlight = document.createElementNS(NS_SVG, 'use');
          highlight.setAttribute('href', '#highlight');
          highlight.setAttribute('data-id', id);
          highlight.setAttribute('data-cid', otherCid);
          highlight.setAttribute('x', 100 * x);
          highlight.setAttribute('y', 100 * y);

          let fill = 'rgba(255, 215, 0, 0.5)';
          if (!isMe) {
            const rgb = cidToColor(otherCid);
            fill = `rgba(${rgb.join(',')}, 0.2)`;
          }
          highlight.setAttribute('fill', fill);

          sudokuHighlights.append(highlight);
        }
      }
    }
    data.selected = selectedNew;
  });

  refFilled.on('value', snapshot => {
    const filledNew = snapshot.val() || {};
    for (let id = 0; id < CELLS; id++) {
      if (null == data.filled[id]) {
        if (null != filledNew[id]) {
          const num = filledNew[id];
          const [ x, y ] = id2xy(id);

          const el = document.createElementNS(NS_SVG, 'text');
          el.setAttribute('data-id', id);
          el.textContent = '' + num;
          el.setAttribute('class', 'filled');
          el.setAttribute('x', 100 * x + 50);
          el.setAttribute('y', 100 * y + 50);

          sudokuFilled.appendChild(el);
        }
      }
      else if (null == filledNew[id]) {
        const remove = sudokuFilled.querySelector(`[data-id="${id}"]`);
        if (remove) sudokuFilled.removeChild(remove);
      }
      else if (data.filled[id] !== filledNew[id]) {
        const elem = sudokuFilled.querySelector(`[data-id="${id}"]`);
        elem.textContent = filledNew[id];
      }
    }
    data.filled = filledNew;
  });

  refCenter.on('value', snapshot => {
    const centerNew = snapshot.val() || {};
    for (let id = 0; id < CELLS; id++) {
      if (null == data.center[id]) {
        if (null != centerNew[id]) {
          const [ x, y ] = id2xy(id);

          const el = document.createElementNS(NS_SVG, 'text');
          el.setAttribute('data-id', id);
          el.textContent = stringifyNums(centerNew[id]);
          el.setAttribute('class', 'center');
          el.setAttribute('x', 100 * x + 50);
          el.setAttribute('y', 100 * y + 50);

          sudokuCenter.appendChild(el);
        }
      }
      else if (null == centerNew[id]) {
        const remove = sudokuCenter.querySelector(`[data-id="${id}"]`);
        if (remove) sudokuCenter.removeChild(remove);
      }
      else if (stringifyNums(data.center[id]) !== stringifyNums(centerNew[id])) {
        const elem = sudokuCenter.querySelector(`[data-id="${id}"]`);
        elem.textContent = stringifyNums(centerNew[id]);
      }
    }
    data.center = centerNew;
  });


  refCorner.on('value', snapshot => {
    const cornerNew = snapshot.val() || {};
    for (let id = 0; id < CELLS; id++) {

      if (null != data.corner[id]) {
        if (null != cornerNew[id] && stringifyNums(data.corner[id]) === stringifyNums(cornerNew[id])) {
          // No changes.
          continue;
        }
        const remove = sudokuCorner.querySelector(`[data-id="${id}"]`);
        if (remove) sudokuCorner.removeChild(remove);
      }

      if (null != cornerNew[id]) {
        const [ x, y ] = id2xy(id);

        const g = document.createElementNS(NS_SVG, 'g');
        g.setAttribute('data-id', id);

        const nums = Object.entries(cornerNew[id])
          .filter(([ _, flag ]) => flag)
          .map(([ num ]) => num);

        for (let i = 0; i < nums.length; i++) {
          const [ dx, dy ] = cornerPos(i, nums.length);

          const el = document.createElementNS(NS_SVG, 'text');
          el.setAttribute('data-id', id);
          el.textContent = '' + nums[i];
          el.setAttribute('class', 'corner');
          el.setAttribute('x', 100 * x + 50 + dx);
          el.setAttribute('y', 100 * y + 50 + dy);

          g.appendChild(el);
        }

        sudokuCorner.appendChild(g);
      }
    }
    data.corner = cornerNew;
  });



  function fillDigit(num) {
    const updates = {};
    for (let id = 0; id < CELLS; id++) {
      if (data.selected[cid][id]) {
        updates[id] = num;
      }
    }
    refFilled.update(updates);
  }

  function fill(num, type) {
    const updates = {};
    if (null == num) {
      for (let id = 0; id < CELLS; id++) {
        if (data.selected[cid][id]) {
          updates[id] = null;
        }
      }
    }
    else {
      let allSet = true;
      for (let id = 0; id < CELLS; id++) {
        if (data.selected[cid][id]) {
          allSet &= (data[type][id] || {})[num];
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

  function select({ offsetX, offsetY }) {
    const x = (offsetX / 100) | 0;
    const y = (offsetY / 100) | 0;
    const id = xy2id(x, y);
    refSelected.child(id).set(true);
  }
  function unselect() {
    refSelected.remove();
  }


  (() => {
    let selecting = false;

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

    window.addEventListener('mouseup', e => {
      selecting = false;
    });
  })();

  const DIGIT_REGEX = /Digit(\d)/;
  window.addEventListener('keydown', e => {
    let num = null;
    if ('Delete' !== e.code) {
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
