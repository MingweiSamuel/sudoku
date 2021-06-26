import firebase from "firebase/app";

import * as dataLayer from "./dataLayer";
import { DECODE_TABLE } from "./utils";

firebase.initializeApp({
    apiKey: "AIzaSyAmZZULS1wzXF4Sfj6u_eVmigMOL1Ga5NI",
    authDomain: "sudoku-0.firebaseapp.com",
    databaseURL: "https://sudoku-0-default-rtdb.firebaseio.com",
    projectId: "sudoku-0",
    storageBucket: "sudoku-0.appspot.com",
    messagingSenderId: "410365958794",
    appId: "1:410365958794:web:e8fa3326b8d2735ce8ab73"
});

export const database = firebase.database();
export const {
    gameKey,
    isNewGame,
    allClientsData,
    boardData,
    isFrozenPromise,
} = (() => {
    let gameKey;
    let isNewGame;
    if (window.location.hash) {
        const char1 = window.location.hash[1];
        if (char1 in DECODE_TABLE) {
            const boardData = new dataLayer.DataLayer(null);
            boardData.update({
                givens: DECODE_TABLE[char1 as keyof typeof DECODE_TABLE](window.location.hash.slice(2)),
            });
            return {
                gameKey: null,
                isNewGame: false,
                allClientsData: new dataLayer.DataLayer(null),
                boardData,
                isFrozenPromise: Promise.resolve(true),
            };
        }
        gameKey = window.location.hash.slice(1);
        isNewGame = false;
    }
    else {
        gameKey = firebase.database().ref('game').push().key!;
        isNewGame = true;
        history.replaceState(null, document.title, '#' + gameKey);
    }

    const refGame = database.ref(`game/${gameKey}`);
    const isFrozenPromise = new Promise<boolean>(resolve =>
        refGame.child('frozen').once('value', snapshot => resolve(snapshot.val())));
    return {
        gameKey,
        isNewGame,
        allClientsData: new dataLayer.DataLayer(refGame.child('clients')),
        boardData: new dataLayer.DataLayer(refGame.child('board')),
        isFrozenPromise,
    };
})();

export const authPromise = new Promise<firebase.User>(resolve => {
    firebase.auth().onAuthStateChanged(user => user && resolve(user));
    firebase.auth().signInAnonymously();
});

// Once the initial hash is set, then if the user changes it refresh the page.
setTimeout(() => window.addEventListener('hashchange', _e => window.location.reload()), 1);

// Set frozen CSS classes when resolved, after auth.
authPromise
    .then(() => isFrozenPromise)
    .then(frozen => {
        const layout = document.getElementById('layout')! as HTMLDivElement;
        if (frozen) {
            layout.classList.add('game-frozen');
        }
        else {
            layout.classList.add('game-playing');
        }
    });
