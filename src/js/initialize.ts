import firebase from "firebase/app";

import * as dataLayer from "./dataLayer";

firebase.initializeApp({
    apiKey: "AIzaSyAmZZULS1wzXF4Sfj6u_eVmigMOL1Ga5NI",
    authDomain: "sudoku-0.firebaseapp.com",
    databaseURL: "https://sudoku-0-default-rtdb.firebaseio.com",
    projectId: "sudoku-0",
    storageBucket: "sudoku-0.appspot.com",
    messagingSenderId: "410365958794",
    appId: "1:410365958794:web:e8fa3326b8d2735ce8ab73"
});

export const [ gameKey, isNewGame ] = ((): [ string, boolean ] => {
    if (window.location.hash) {
        return [ window.location.hash.slice(1), false ];
    }
    const gameKey = firebase.database().ref('game').push().key!;
    window.location.hash = '#' + gameKey;
    return [ gameKey, true ];
})();

export const database = firebase.database();
export const refGame = database.ref(`game/${gameKey}`);
export const allClientsData = new dataLayer.DataLayer(refGame.child('clients'));
export const boardData = new dataLayer.DataLayer(refGame.child('board'));

export const isFrozenPromise = new Promise<boolean>(resolve =>
    refGame.child('frozen').once('value', snapshot => {
        const layout = document.getElementById('layout')! as HTMLDivElement;
        if (snapshot.val()) {
            layout.classList.add('game-frozen');
        }
        else {
            layout.classList.add('game-playing');
        }
        resolve(snapshot.val());
    })
);

export const authPromise = new Promise<firebase.User>(resolve => {
    firebase.auth().onAuthStateChanged(user => user && resolve(user));
    firebase.auth().signInAnonymously();
});

// Once the initial hash is set, then if the user changes it refresh the page.
setTimeout(() => window.addEventListener('hashchange', _e => window.location.reload()), 1);
