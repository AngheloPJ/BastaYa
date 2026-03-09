const connexio = new WebSocket('ws://localhost:8180');

const playButton = document.getElementById('playButton') as HTMLButtonElement;
const nicknameInput = document.getElementById('playerName') as HTMLInputElement;

playButton.addEventListener('click', play);

function showPage(pageId : string) {
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    if (document.getElementById('page-' + pageId) !== null) {
        document.getElementById('page-' + pageId)!.classList.add('active');
    }
}

function play() {
    if (nicknameInput.value.trim() !== '') {
        let jsonData = JSON.stringify({ type: "set_nickname", nickname: nicknameInput.value });
        connexio.send(jsonData);
    }
    showPage("lobby");
}

export function getConnexio() {
    return connexio;
}