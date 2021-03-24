
const buttonSetter = document.getElementById('button-modes-setter')! as HTMLButtonElement;
const buttonSolver = document.getElementById('button-modes-solver')! as HTMLButtonElement;
const controls = document.getElementById('controls')! as HTMLDivElement;

buttonSetter.addEventListener('click', _e => {
    controls.classList.add('show-setter');
    buttonSetter.style.setProperty('display', 'none');
    buttonSolver.style.setProperty('display', '');
});
buttonSolver.addEventListener('click', _e => {
    controls.classList.remove('show-setter');
    buttonSolver.style.setProperty('display', 'none');
    buttonSetter.style.setProperty('display', '');
});
