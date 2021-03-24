import * as init from "./initialize";

const buttonShare = document.getElementById('button-share')! as HTMLButtonElement;
init.authPromise.then(_user => {
    buttonShare.addEventListener('click', _e => {
        const targetGame = init.database.ref('game').push();
        targetGame.set({
            frozen: true,
            board: init.boardData.get(),
        });
        const win = window.open('#' + targetGame.key, '_blank');
        if (null == win) {
            alert('Failed to open window.');
            throw Error('Failed to open window,');
        }
        win.focus();
    });
});

// TODO: Note there is a bit of a race condition here, on when game data arrives....
const buttonPlay = document.getElementById('button-play')! as HTMLButtonElement;
buttonPlay.addEventListener('click', _e => {
    const targetGame = init.database.ref('game').push();
    targetGame.set({
        board: init.boardData.get(),
    });
    window.location.hash = '#' + targetGame.key;
    window.location.reload();
});
