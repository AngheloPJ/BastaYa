const connexio = new WebSocket('ws://localhost:8180');

const playButton = document.getElementById('playButton') as HTMLButtonElement;
const nicknameInput = document.getElementById('playerName') as HTMLInputElement;
const playerList = document.getElementById('playerList') as HTMLUListElement;
const chatMessages = document.getElementById('chatMessages') as HTMLUListElement;
const chatInput = document.getElementById('chatInput') as HTMLInputElement;
const sendChatButton = document.getElementById('sendChatButton') as HTMLButtonElement;
const startGameButton = document.getElementById('startGameButton') as HTMLButtonElement;

playButton.addEventListener('click', play);

function showPage(pageId : string) {
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    if (document.getElementById('page-' + pageId) !== null) {
        document.getElementById('page-' + pageId)!.classList.add('active');
    }
}

// attach message handler immediately so we don't miss broadcasts
connexio.addEventListener('message', (event) => {
    const data = JSON.parse(event.data);
    if (data.type === 'user_list') {
        playerList.innerHTML = '';
        data.users.forEach((user: { nickname: string }) => {
            const li = document.createElement('li');
            li.textContent = user.nickname;
            playerList.appendChild(li);
        });
    }
});

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