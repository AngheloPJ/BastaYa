let connexio = new WebSocket('ws://localhost:8180');

const playButton = document.getElementById('playButton') as HTMLButtonElement;
const nicknameInput = document.getElementById('playerName') as HTMLInputElement;

playButton.addEventListener('click', play);

function play() {
    if (nicknameInput.value.trim() !== '') {
        let jsonData = JSON.stringify({ type: "set_nickname", nickname: nicknameInput.value });
        connexio.send(jsonData);
    }
    window.location.href = 'lobby.html';
}