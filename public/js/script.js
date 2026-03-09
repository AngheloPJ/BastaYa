"use strict";
let connexio = new WebSocket('ws://localhost:8180');
const playButton = document.getElementById('playButton');
const nicknameInput = document.getElementById('playerName');
playButton.addEventListener('click', play);
function play() {
    connexio.send('connection');
    if (nicknameInput.value.trim() !== '') {
        let jsonData = JSON.stringify({ type: "set_nickname", nickname: nicknameInput.value });
        connexio.send(jsonData);
    }
    window.location.href = 'lobby.html';
}
//# sourceMappingURL=script.js.map