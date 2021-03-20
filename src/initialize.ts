import firebase from "firebase/app";

export function initialize(): Promise<[ string, string ]> {
    firebase.initializeApp({
        apiKey: "AIzaSyAmZZULS1wzXF4Sfj6u_eVmigMOL1Ga5NI",
        authDomain: "sudoku-0.firebaseapp.com",
        databaseURL: "https://sudoku-0-default-rtdb.firebaseio.com",
        projectId: "sudoku-0",
        storageBucket: "sudoku-0.appspot.com",
        messagingSenderId: "410365958794",
        appId: "1:410365958794:web:e8fa3326b8d2735ce8ab73"
    });


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

    return new Promise((resolve, reject) => {
        firebase.auth().onAuthStateChanged((user) => {
            if (user) {
                // User is signed in, see docs for a list of available properties
                // https://firebase.google.com/docs/reference/js/firebase.User
                resolve([ gameKey, user.uid ]);
            } else {
                // User is signed out
                reject(null);
            }
        });
        firebase.auth().signInAnonymously();
    });
}
