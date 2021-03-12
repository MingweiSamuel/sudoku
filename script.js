const NS_SVG = 'http://www.w3.org/2000/svg';

const sudoku = document.getElementById('sudoku');
const sudokuHighlights = document.getElementById('sudoku-highlights');
const sudokuGivens = document.getElementById('sudoku-givens');
const sudokuFilled = document.getElementById('sudoku-filled');
const sudokuCenter = document.getElementById('sudoku-center');
const sudokuCorner = document.getElementById('sudoku-corner');

const data = {
  uid: null,
  selected: {},
  filled: {},
  center: {},
  corner: {},
};




const boardKey = (() => {
  let boardKey;
  if (window.location.hash) {
    boardKey = window.location.hash.slice(1);
  }
  else {
    boardKey = firebase.database().ref().child('boards').push().key;
    window.location.hash = '#' + boardKey;
  }

  firebase.auth().onAuthStateChanged((user) => {
    if (user) {
      // User is signed in, see docs for a list of available properties
      // https://firebase.google.com/docs/reference/js/firebase.User
      main(boardKey, user);
    } else {
      // User is signed out
      // ...
    }
  });
  firebase.auth().signInAnonymously();
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

function uidToColor(uid) {
  const uidHash = hash(uid);
  const rgb = hsluv.hsluvToRgb([ uidHash % 360, 80, 60 ]);
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
  else if (len <= 6) {
    dx = (i % 3) * 30 - 30;
    dy = ((i / 3) | 0) * 60 - 30;
  }
  else {
    if (i < 3) {
      dx = i * 30 - 30;
      dy = -30;
    }
    else if (i < 5) {
      dx = i * 60 - 210;
      dy = 0;
    }
    else {
      const d = 60 / (len - 6);
      dx = (i - 5) * d - 30;
      dy = 30;
    }
  }
  return [ dx, dy ];
}



function main(boardKey, user) {
  const refSelected = firebase.database().ref(`boards/${boardKey}/selected/${user.uid}`);
  refSelected.onDisconnect().remove();

  const refFilled = firebase.database().ref(`boards/${boardKey}/filled`);
  const refCenter = firebase.database().ref(`boards/${boardKey}/center`);
  const refCorner = firebase.database().ref(`boards/${boardKey}/corner`);


  firebase.database().ref(`boards/${boardKey}/selected`).on('value', snapshot => {
    const selectedNew = snapshot.val() || {};
    const uids = new Set([ ...Object.keys(data.selected), ...Object.keys(selectedNew) ]);
    for (const uid of uids) {

      const uselected = data.selected[uid] || {};
      const uselectedNew = selectedNew[uid] || {};
      const isMe = uid === user.uid;

      for (let id = 0; id < 81; id++) {
        if (uselected[id] && !uselectedNew[id]) {
          const remove = sudokuHighlights.querySelector(`[data-id="${id}"][data-uid="${uid}"]`);
          if (remove) sudokuHighlights.removeChild(remove);
        }
        else if (!uselected[id] && uselectedNew[id]) {
          const [ x, y ] = id2xy(id);

          const highlight = document.createElementNS(NS_SVG, 'use');
          highlight.setAttribute('href', '#highlight');
          highlight.setAttribute('data-id', id);
          highlight.setAttribute('data-uid', uid);
          highlight.setAttribute('x', 100 * x);
          highlight.setAttribute('y', 100 * y);

          let fill = 'rgba(255, 215, 0, 0.5)';
          if (!isMe) {
            const rgb = uidToColor(uid);
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
    for (let id = 0; id < 81; id++) {
      if (null == data.filled[id] && null != filledNew[id]) {
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
      else if (null != data.filled[id] && null == filledNew[id]) {
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
    const formatNums = nums => Object.entries(nums)
      .filter(([ _, flag ]) => flag)
      .map(([ num ]) => num)
      .join('');

    const centerNew = snapshot.val() || {};
    for (let id = 0; id < 81; id++) {
      if (null == data.center[id] && null != centerNew[id]) {
        const [ x, y ] = id2xy(id);

        const el = document.createElementNS(NS_SVG, 'text');
        el.setAttribute('data-id', id);
        el.textContent = formatNums(centerNew[id]);
        el.setAttribute('class', 'center');
        el.setAttribute('x', 100 * x + 50);
        el.setAttribute('y', 100 * y + 50);

        sudokuCenter.appendChild(el);
      }
      else if (null != data.center[id] && null == centerNew[id]) {
        const remove = sudokuCenter.querySelector(`[data-id="${id}"]`);
        if (remove) sudokuCenter.removeChild(remove);
      }
      // NOTE! Object equality will generally be false.
      else if (data.center[id] !== centerNew[id]) {
        const elem = sudokuCenter.querySelector(`[data-id="${id}"]`);
        elem.textContent = formatNums(centerNew[id]);
      }
    }
    data.center = centerNew;
  });


  refCorner.on('value', snapshot => {
    const cornerNew = snapshot.val() || {};
    for (let id = 0; id < 81; id++) {
      // Full reset every time.
      const remove = sudokuCorner.querySelector(`[data-id="${id}"]`);
      if (remove) sudokuCorner.removeChild(remove);
      
      if (null != cornerNew[id]) {
        const [ x, y ] = id2xy(id);

        const g = document.createElementNS(NS_SVG, 'g');
        g.setAttribute('data-id', id);

        const nums = Object.entries(cornerNew[id])
          .filter(([ _, flag ]) => flag)
          .map(([ num ]) => num);

        for (let i = 0; i < nums.length; i++) {
          const [ dx, dy ] =cornerPos(i, nums.length);

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
    for (let id = 0; id < 81; id++) {
      if (data.selected[user.uid][id]) {
        updates[id] = num;
      }
    }
    refFilled.update(updates);
  }

  function fill(num, type) {
    console.log('FILL', num);

    const updates = {};
    if (null == num) {
      for (let id = 0; id < 81; id++) {
        if (data.selected[user.uid][id]) {
          updates[id] = null;
        }
      }
    }
    else {
      let allSet = true;
      for (let id = 0; id < 81; id++) {
        if (data.selected[user.uid][id]) {
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
    console.log(e);

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
