import * as init from "./initialize";

function cloneAndOpenGame(frozen: true | null, parent: string | null) {
    const targetGame = init.database.ref('game').push();
    targetGame.set({
        parent,
        frozen,
        board: init.boardData.get(),
    });
    const win = window.open('#' + targetGame.key, '_blank');
    if (null == win) {
        alert('Failed to open window, check your popup settings, or manually open this URL: '
            + window.location.href.replace(window.location.hash, '#' + targetGame.key));
        throw Error('Failed to open window.');
    }
    win.focus();
}

const buttonShare = document.getElementById('button-share')! as HTMLButtonElement;
init.authPromise.then(_user => {
    buttonShare.addEventListener('click', _e => cloneAndOpenGame(true, null));
});

// TODO: Note there is a bit of a race condition here, on when game data arrives....
const buttonPlay = document.getElementById('button-play')! as HTMLButtonElement;
buttonPlay.addEventListener('click', _e => cloneAndOpenGame(null, init.gameKey));
