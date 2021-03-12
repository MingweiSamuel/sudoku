const NS_SVG = 'http://www.w3.org/2000/svg';

const sudoku = document.getElementById('sudoku');
const sudokuHighlights = document.getElementById('sudoku-highlights');
const sudokuHighlightsOthers = document.getElementById('sudoku-highlights-others');
const sudokuGivens = document.getElementById('sudoku-givens');
const sudokuFilled = document.getElementById('sudoku-filled');


const data = {
  uid: null,
  selected: {},
  filled: {},
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



function main(boardKey, user) {
  const refSelected = `boards/${boardKey}/selected/${user.uid}`;
  const refFilled = `boards/${boardKey}/filled`;


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

  firebase.database().ref(refFilled).on('value', snapshot => {
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

  function fillDigit(num) {
    const updates = {};
    for (let id = 0; id < 81; id++) {
      if (data.selected[user.uid][id]) {
        updates[id] = num;
      }
    }
    firebase.database().ref(refFilled).update(updates);
  }

  function select({ offsetX, offsetY }) {
    const x = (offsetX / 100) | 0;
    const y = (offsetY / 100) | 0;
    const id = xy2id(x, y);
    firebase.database().ref(refSelected).child(id).set(true);
  }
  function unselect() {
    firebase.database().ref(refSelected).remove();
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

  window.addEventListener('keydown', e => {
    console.log(e);
    if ('Delete' === e.key) {
      fillDigit(null);
    }
    else {
      const num = parseInt(e.key);
      if (Number.isNaN(num))
        return;
      fillDigit(num);
    }
  });
}
