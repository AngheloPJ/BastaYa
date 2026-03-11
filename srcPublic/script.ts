const connexio = new WebSocket('ws://localhost:8180');

const playButton = document.getElementById('playButton') as HTMLButtonElement;
const nicknameInput = document.getElementById('playerName') as HTMLInputElement;
const playerList = document.getElementById('playerList') as HTMLUListElement;
const chatMessages = document.getElementById('chatMessages') as HTMLTextAreaElement;
const chatInput = document.getElementById('chatInput') as HTMLInputElement;
const sendChatButton = document.getElementById('sendChatButton') as HTMLButtonElement;
const startGameButton = document.getElementById('startGameButton') as HTMLButtonElement;
const gameplayerList = document.getElementById('game-playerList') as HTMLUListElement;

playButton.addEventListener('click', play);
startGameButton.addEventListener('click', () => {
    connexio.send(JSON.stringify({ type: 'start_game_request' }));
});

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
        gameplayerList.innerHTML = '';
        data.users.forEach((user: { nickname: string }) => {
            const li = document.createElement('li');
            li.textContent = "-> " + user.nickname;
            playerList.appendChild(li);
            gameplayerList.appendChild(li.cloneNode(true) as HTMLLIElement);
        });
    }

    if (data.type === 'chat_message') {
        chatMessages.value += `${data.nickname}: ${data.message}\n`;
        chatMessages.scrollTop = chatMessages.scrollHeight;
    }

    if (data.type === 'host_status') {
        startGameButton.disabled = !data.isHost; // Se habilita solo si isHost es true
        if (data.isHost) {
            startGameButton.innerText = "Iniciar Juego";
        }
    }

    if (data.type === 'start_game') {
        const letterElement = document.getElementById('currentLetter');
        if (letterElement) letterElement.textContent = data.letter;
        showPage("game"); // Cambiamos a la pantalla de juego
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

sendChatButton.addEventListener('click', () => {
    const message = chatInput.value.trim();
    if (message !== '') {
        connexio.send(JSON.stringify({ 
            type: 'chat_message', 
            message: message 
        }));
        chatInput.value = '';
    }
});

chatInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') sendChatButton.click();
});