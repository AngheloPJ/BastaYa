const protocol = location.protocol === "https:" ? "wss" : "ws";
const connexio = new WebSocket(`${protocol}://${location.host}`);

const playButton = document.getElementById('playButton') as HTMLButtonElement;
const nicknameInput = document.getElementById('playerName') as HTMLInputElement;
const playerList = document.getElementById('playerList') as HTMLUListElement;
const chatMessages = document.getElementById('chatMessages') as HTMLTextAreaElement;
const chatInput = document.getElementById('chatInput') as HTMLInputElement;
const sendChatButton = document.getElementById('sendChatButton') as HTMLButtonElement;
const startGameButton = document.getElementById('startGameButton') as HTMLButtonElement;
const gameplayerList = document.getElementById('game-playerList') as HTMLUListElement;
const bastaYaButton = document.getElementById('bastaYaButton') as HTMLButtonElement;
const playAgainButton = document.getElementById('playAgainButton') as HTMLButtonElement;

playButton.addEventListener('click', play);

startGameButton.addEventListener('click', () => {
    connexio.send(JSON.stringify({ type: 'start_game_request' }));
});

playAgainButton.disabled = true;
playAgainButton.addEventListener('click', () => {
    connexio.send(JSON.stringify({ type: 'return_to_lobby' }));
});

bastaYaButton.addEventListener('click', () => {
    const inputs = document.querySelectorAll('.categoryInput') as NodeListOf<HTMLInputElement>;
    const labels = document.querySelectorAll('.categoryLabel');
    const answers: { [key: string]: string } = {};

    inputs.forEach((input, index) => {
        const category = labels[index].textContent || `cat${index}`;
        answers[category] = input.value.trim();
        input.disabled = true;
    });

    connexio.send(JSON.stringify({ type: 'submit_answers', answers }));
    bastaYaButton.disabled = true;
});

sendChatButton.addEventListener('click', () => {
    const message = chatInput.value.trim();
    if (message !== '') {
        connexio.send(JSON.stringify({ type: 'chat_message', message }));
        chatInput.value = '';
    }
});

chatInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') sendChatButton.click();
});

function showPage(pageId: string) {
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    document.getElementById('page-' + pageId)?.classList.add('active');
}

function play() {
    if (nicknameInput.value.trim() !== '') {
        connexio.send(JSON.stringify({ type: 'set_nickname', nickname: nicknameInput.value }));
    }
    showPage('lobby');
}

connexio.addEventListener('message', (event) => {
    const data = JSON.parse(event.data);

    if (data.type === 'return_to_lobby') {
        showPage('lobby');
    }

    if (data.type === 'user_list') {
        playerList.innerHTML = '';
        gameplayerList.innerHTML = '';

        data.users.forEach((user: { nickname: string, isHost: boolean }) => {
            const li = document.createElement('li');
            li.textContent = `• ${user.nickname}${user.isHost ? ' 👑' : ''}`;
            playerList.appendChild(li);
            gameplayerList.appendChild(li.cloneNode(true) as HTMLLIElement);
        });
    }

    if (data.type === 'chat_message') {
        chatMessages.value += `${data.nickname}: ${data.message}\n`;
        chatMessages.scrollTop = chatMessages.scrollHeight;
    }

    if (data.type === 'host_status') {
        startGameButton.disabled = !data.isHost;
        playAgainButton.disabled = !data.isHost;
        if (data.isHost) startGameButton.innerText = 'Iniciar Juego';
    }

    if (data.type === 'start_game') {
        const letterElement = document.getElementById('currentLetter');
        if (letterElement) letterElement.textContent = data.letter;

        const inputs = document.querySelectorAll('.categoryInput') as NodeListOf<HTMLInputElement>;
        const labels = document.querySelectorAll('.categoryLabel');

        data.categories.forEach((cat: string, index: number) => {
            if (labels[index]) labels[index].textContent = cat;
            if (inputs[index]) {
                inputs[index].value = '';
                inputs[index].disabled = false;
            }
        });

        bastaYaButton.disabled = true;
        let segundosRestantes = 10;
        bastaYaButton.innerText = `Basta Ya (${segundosRestantes}s)`;

        const countdown = setInterval(() => {
            segundosRestantes--;
            if (segundosRestantes > 0) {
                bastaYaButton.innerText = `Basta Ya (${segundosRestantes}s)`;
            } else {
                clearInterval(countdown);
                bastaYaButton.disabled = false;
                bastaYaButton.innerText = '¡Basta Ya!';
            }
        }, 1000);

        showPage('game');
    }

    if (data.type === 'stop_game') {
        const inputs = document.querySelectorAll('.categoryInput') as NodeListOf<HTMLInputElement>;
        const labels = document.querySelectorAll('.categoryLabel');
        const answers: { [key: string]: string } = {};

        inputs.forEach((input, index) => {
            const category = labels[index].textContent || `cat${index}`;
            answers[category] = input.value.trim();
            input.disabled = true;
        });

        connexio.send(JSON.stringify({ type: 'submit_answers', answers }));
        alert('¡BASTA YA! El tiempo se ha agotado.');
    }

    if (data.type === 'start_voting_round') {
        showPage('voting');

        const categoryTitle = document.getElementById('categoryName');
        if (categoryTitle) categoryTitle.textContent = data.category;

        const answersGrid = document.getElementById('answersGrid');
        const confirmBtn = document.getElementById('confirmButton') as HTMLButtonElement;

        if (answersGrid) {
            answersGrid.innerHTML = '';

            Object.keys(data.answers).forEach(playerNick => {
                const answer = data.answers[playerNick][data.category];
                if (answer && answer.trim() !== '') {
                    const btn = document.createElement('button');
                    btn.className = 'answerButton correct';
                    btn.textContent = answer;

                    let isCorrect = true;
                    btn.onclick = () => {
                        isCorrect = !isCorrect;
                        btn.className = isCorrect ? 'answerButton correct' : 'answerButton incorrect';
                        connexio.send(JSON.stringify({
                            type: 'vote_word',
                            targetPlayer: playerNick,
                            category: data.category,
                            isCorrect
                        }));
                    };
                    answersGrid.appendChild(btn);
                }
            });
        }

        if (confirmBtn) {
            confirmBtn.disabled = false;
            confirmBtn.innerText = 'Confirmar';
            confirmBtn.onclick = () => {
                confirmBtn.disabled = true;
                confirmBtn.innerText = 'Esperando...';
                connexio.send(JSON.stringify({ type: 'confirm_vote' }));
            };
        }
    }

    if (data.type === 'final_results') {
        showPage('scores');

        data.results.forEach((player: { nickname: string, points: number }, index: number) => {
            const row = document.getElementById(`row${index + 1}`);
            if (row) {
                const nameCell = row.querySelector('.player');
                const pointsCell = row.querySelector('.points');
                if (nameCell) nameCell.textContent = player.nickname;
                if (pointsCell) pointsCell.textContent = player.points.toString();
            }
        });
    }
});