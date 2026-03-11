const connexio = new WebSocket('ws://10.92.254.149:8180');

const playButton = document.getElementById('playButton') as HTMLButtonElement;
const nicknameInput = document.getElementById('playerName') as HTMLInputElement;
const playerList = document.getElementById('playerList') as HTMLUListElement;
const chatMessages = document.getElementById('chatMessages') as HTMLTextAreaElement;
const chatInput = document.getElementById('chatInput') as HTMLInputElement;
const sendChatButton = document.getElementById('sendChatButton') as HTMLButtonElement;
const startGameButton = document.getElementById('startGameButton') as HTMLButtonElement;
const gameplayerList = document.getElementById('game-playerList') as HTMLUListElement;
const bastaYaButton = document.getElementById('bastaYaButton') as HTMLButtonElement;

playButton.addEventListener('click', play);
startGameButton.addEventListener('click', () => {
    connexio.send(JSON.stringify({ type: 'start_game_request' }));
});

function showPage(pageId: string) {
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

        data.users.forEach((user: { nickname: string, isHost: boolean }) => {
            const li = document.createElement('li');

            // Si el usuario es host, le ponemos la corona
            const crown = user.isHost ? ' 👑' : '';
            li.textContent = `• ${user.nickname} ${crown}`;

            playerList.appendChild(li);

            // Clonamos para la lista que aparece dentro del juego también
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

        // 1. Limpiar y habilitar inputs de categorías
        const inputs = document.querySelectorAll('.categoryInput') as NodeListOf<HTMLInputElement>;
        const labels = document.querySelectorAll('.categoryLabel');

        data.categories.forEach((cat: string, index: number) => {
            if (labels[index]) labels[index].textContent = cat;
            if (inputs[index]) {
                inputs[index].value = '';
                inputs[index].disabled = false;
            }
        });

        // 2. Lógica del botón "Basta Ya" con retraso de 10 segundos
        bastaYaButton.disabled = true; // Empieza deshabilitado
        let segundosRestantes = 10;
        bastaYaButton.innerText = `Basta Ya (${segundosRestantes}s)`;

        const countdown = setInterval(() => {
            segundosRestantes--;
            if (segundosRestantes > 0) {
                bastaYaButton.innerText = `Basta Ya (${segundosRestantes}s)`;
            } else {
                clearInterval(countdown);
                bastaYaButton.disabled = false; // Se habilita tras 10s
                bastaYaButton.innerText = "¡Basta Ya!";
            }
        }, 1000);

        showPage("game");
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