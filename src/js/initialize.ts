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

export const gameKey = (() => {
    if (window.location.hash) {
        return window.location.hash.slice(1);
    }
    let gameKey = firebase.database().ref('game').push().key!;
    window.location.hash = '#' + gameKey;
    return gameKey;
})();

export const authPromise = new Promise<firebase.User>((resolve, reject) => {
    firebase.auth().onAuthStateChanged(user => {
        user ? resolve(user) : reject(null);
    });
    firebase.auth().signInAnonymously();
});

const refGame = firebase.database().ref(`game/${gameKey}`);
export const allClientsData = new dataLayer.DataLayer(refGame.child('clients'));
export const boardData = new dataLayer.DataLayer(refGame.child('board'));
