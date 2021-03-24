
const buttonSetter = document.getElementById('button-modes-setter')! as HTMLButtonElement;
const buttonSolver = document.getElementById('button-modes-solver')! as HTMLButtonElement;
const controls = document.getElementById('controls')! as HTMLDivElement;

export function setMode(setterMode: boolean) {
    controls.classList.toggle('show-setter', setterMode);
    buttonSetter.style.setProperty('display', setterMode ? 'none' : '');
    buttonSolver.style.setProperty('display', setterMode ? '' : 'none');
}

buttonSetter.addEventListener('click', _e => setMode(true));
buttonSolver.addEventListener('click', _e => setMode(false));
