import type firebase from "firebase";

import * as utils from "./utils";

const timer = document.getElementById('timer')!;
const timerPause = document.getElementById('button-timer-pause')!;
const timerPlay = document.getElementById('button-timer-play')!;

timerPause.addEventListener('click', _e => setTicking(false));
timerPlay.addEventListener('click', _e => setTicking(true));

let ticking = false;

export function init(ref: firebase.database.Reference, onDataUpdate: (elapsedSeconds: number) => void) {
    ref.once('value', snapshot => {
        let elapsedSeconds = snapshot.val();
        // Update UI every second.
        setInterval(() => {
            if (!ticking) return;
            elapsedSeconds++;
            timer.textContent = utils.formatSecs(elapsedSeconds);
        }, 1000);
        // Save time every 10 seconds.
        setInterval(() => {
            if (!ticking) return;
            onDataUpdate(elapsedSeconds);
        }, 10000);
    });
}

export function setTicking(val: boolean): void {
    ticking = val;
    if (ticking) {
        timerPlay.style.display = 'none';
        timerPause.style.display = '';
    }
    else {
        timerPause.style.display = 'none';
        timerPlay.style.display = '';
    }
}
