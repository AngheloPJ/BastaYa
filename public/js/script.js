"use strict";
const protocol = location.protocol === "https:" ? "wss" : "ws";
const connexio = new WebSocket(`${protocol}://${location.host}`);
const playButton = document.getElementById('playButton');
const createRoomButton = document.getElementById('createRoomButton');
const nicknameInput = document.getElementById('playerName');
const roomCodeInput = document.getElementById('roomCode');
const lobbyRoomCode = document.getElementById('lobbyRoomCode');
const gameRoomCode = document.getElementById('gameRoomCode');
const playerList = document.getElementById('playerList');
const chatMessages = document.getElementById('chatMessages');
const chatInput = document.getElementById('chatInput');
const sendChatButton = document.getElementById('sendChatButton');
const startGameButton = document.getElementById('startGameButton');
const gameplayerList = document.getElementById('game-playerList');
const bastaYaButton = document.getElementById('bastaYaButton');
const playAgainButton = document.getElementById('playAgainButton');
let currentRoomCode = '';
let isSpectator = false;
const CATEGORY_GRID_COLUMNS = 3;
playButton.addEventListener('click', play);
createRoomButton.addEventListener('click', createRoom);
setupCategoryKeyboardNavigation();
startGameButton.addEventListener('click', () => {
    connexio.send(JSON.stringify({ type: 'start_game_request' }));
});
playAgainButton.disabled = true;
playAgainButton.addEventListener('click', () => {
    connexio.send(JSON.stringify({ type: 'return_to_lobby' }));
});
bastaYaButton.addEventListener('click', () => {
    if (isSpectator)
        return;
    const inputs = document.querySelectorAll('.categoryInput');
    const labels = document.querySelectorAll('.categoryLabel');
    const answers = {};
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
    if (e.key === 'Enter')
        sendChatButton.click();
});
nicknameInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
        e.preventDefault();
        enterOrCreateFromMenu();
    }
});
roomCodeInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
        e.preventDefault();
        enterOrCreateFromMenu();
    }
});
document.addEventListener('keydown', (e) => {
    if (e.key !== 'Enter')
        return;
    const menuPageActive = document.getElementById('page-menu')?.classList.contains('active');
    const lobbyPageActive = document.getElementById('page-lobby')?.classList.contains('active');
    if (menuPageActive) {
        e.preventDefault();
        enterOrCreateFromMenu();
    }
    if (lobbyPageActive && document.activeElement === chatInput) {
        e.preventDefault();
        sendChatButton.click();
    }
});
function showPage(pageId) {
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    document.getElementById('page-' + pageId)?.classList.add('active');
}
function showBastaYaOverlay() {
    const overlay = document.getElementById('bastaya-overlay');
    if (!overlay)
        return;
    overlay.classList.remove('fade-out');
    overlay.classList.add('visible');
    setTimeout(() => {
        overlay.classList.add('fade-out');
        setTimeout(() => overlay.classList.remove('visible', 'fade-out'), 350);
    }, 2000);
}
function setupCategoryKeyboardNavigation() {
    document.addEventListener('keydown', (event) => {
        const target = event.target;
        if (!(target instanceof HTMLInputElement) || !target.classList.contains('categoryInput')) {
            return;
        }
        const inputs = Array.from(document.querySelectorAll('.categoryInput'));
        const currentIndex = inputs.indexOf(target);
        if (currentIndex === -1)
            return;
        let nextIndex = currentIndex;
        if (event.key === 'ArrowLeft')
            nextIndex = currentIndex - 1;
        if (event.key === 'ArrowRight')
            nextIndex = currentIndex + 1;
        if (event.key === 'ArrowUp')
            nextIndex = currentIndex - CATEGORY_GRID_COLUMNS;
        if (event.key === 'ArrowDown')
            nextIndex = currentIndex + CATEGORY_GRID_COLUMNS;
        if (nextIndex === currentIndex || nextIndex < 0 || nextIndex >= inputs.length) {
            return;
        }
        const nextInput = inputs[nextIndex];
        if (!nextInput || nextInput.disabled)
            return;
        event.preventDefault();
        nextInput.focus();
        nextInput.select();
    });
}
function play() {
    const nickname = nicknameInput.value.trim();
    const roomCode = roomCodeInput.value.trim().toUpperCase();
    if (roomCode === '')
        return alert('Introdueix el codi de la sala per unirte!');
    connexio.send(JSON.stringify({ type: 'join_room_request', nickname, roomCode }));
}
function enterOrCreateFromMenu() {
    const roomCode = roomCodeInput.value.trim();
    if (roomCode === '') {
        createRoom();
        return;
    }
    play();
}
function createRoom() {
    const nickname = nicknameInput.value.trim();
    connexio.send(JSON.stringify({ type: 'create_room_request', nickname }));
}
function updateSpectatorState(nextState) {
    isSpectator = nextState;
    if (isSpectator) {
        bastaYaButton.disabled = true;
        bastaYaButton.innerText = 'ESPECTEANDO';
    }
    else {
        bastaYaButton.innerText = 'BASTA YA!';
    }
}
connexio.addEventListener('message', (event) => {
    const data = JSON.parse(event.data);
    if (data.type === 'error')
        alert(data.message);
    if (data.type === 'room_created')
        roomCodeInput.value = data.roomCode;
    if (data.type === 'spectator_status')
        updateSpectatorState(Boolean(data.isSpectator));
    if (data.type === 'room_joined') {
        if (typeof data.nickname === 'string' && data.nickname.trim() !== '') {
            nicknameInput.value = data.nickname;
        }
        updateSpectatorState(Boolean(data.isSpectator));
        currentRoomCode = data.roomCode;
        lobbyRoomCode.textContent = currentRoomCode;
        gameRoomCode.textContent = currentRoomCode;
        chatMessages.value = '';
        showPage('lobby');
    }
    if (data.type === 'return_to_lobby') {
        updateSpectatorState(false);
        showPage('lobby');
    }
    if (data.type === 'user_list') {
        playerList.innerHTML = '';
        gameplayerList.innerHTML = '';
        data.users.forEach((user) => {
            const lobbyItem = document.createElement('li');
            const gameItem = document.createElement('li');
            const nicknameLabel = document.createElement('span');
            const nicknameLabelClone = document.createElement('span');
            const badges = document.createElement('span');
            const badgesClone = document.createElement('span');
            const badgeText = `${user.isHost ? ' 👑' : ''}${user.isSpectator ? ' 👁️' : ''}`;
            nicknameLabel.className = 'playerNickname';
            nicknameLabel.textContent = user.nickname;
            nicknameLabelClone.className = 'playerNickname';
            nicknameLabelClone.textContent = user.nickname;
            if (user.isSpectator) {
                nicknameLabel.classList.add('playerSpectator');
                nicknameLabelClone.classList.add('playerSpectator');
            }
            badges.className = 'playerBadges';
            badges.textContent = badgeText;
            badgesClone.className = 'playerBadges';
            badgesClone.textContent = badgeText;
            lobbyItem.append(nicknameLabel, badges);
            gameItem.append(nicknameLabelClone, badgesClone);
            playerList.appendChild(lobbyItem);
            gameplayerList.appendChild(gameItem);
        });
    }
    if (data.type === 'chat_message') {
        chatMessages.value += `${data.nickname}: ${data.message}\n`;
        chatMessages.scrollTop = chatMessages.scrollHeight;
    }
    if (data.type === 'host_status') {
        startGameButton.disabled = !data.isHost || isSpectator;
        playAgainButton.disabled = !data.isHost || isSpectator;
        if (data.isHost)
            startGameButton.innerText = 'COMENÇAR JOC';
    }
    if (data.type === 'start_game') {
        const letterElement = document.getElementById('currentLetter');
        if (letterElement)
            letterElement.textContent = data.letter;
        const inputs = document.querySelectorAll('.categoryInput');
        const labels = document.querySelectorAll('.categoryLabel');
        data.categories.forEach((cat, index) => {
            if (labels[index])
                labels[index].textContent = cat;
            if (inputs[index]) {
                if (!isSpectator)
                    inputs[index].value = '';
                inputs[index].disabled = isSpectator;
            }
        });
        bastaYaButton.disabled = true;
        let segundosRestantes = 10;
        bastaYaButton.innerText = `BASTA YA! (${segundosRestantes}s)`;
        const countdown = setInterval(() => {
            segundosRestantes--;
            if (segundosRestantes > 0) {
                bastaYaButton.innerText = `BASTA YA! (${segundosRestantes}s)`;
            }
            else {
                clearInterval(countdown);
                if (isSpectator) {
                    bastaYaButton.disabled = true;
                    bastaYaButton.innerText = 'ESPECTEANDO';
                }
                else {
                    bastaYaButton.disabled = false;
                    bastaYaButton.innerText = 'BASTA YA!';
                }
            }
        }, 1000);
        showPage('game');
        if (!isSpectator) {
            inputs[0]?.focus();
            inputs[0]?.select();
        }
    }
    if (data.type === 'stop_game') {
        const inputs = document.querySelectorAll('.categoryInput');
        const labels = document.querySelectorAll('.categoryLabel');
        const answers = {};
        if (isSpectator) {
            inputs.forEach((input) => {
                input.disabled = true;
            });
            showBastaYaOverlay();
            return;
        }
        inputs.forEach((input, index) => {
            const category = labels[index].textContent || `cat${index}`;
            answers[category] = input.value.trim();
            input.disabled = true;
        });
        connexio.send(JSON.stringify({ type: 'submit_answers', answers }));
        showBastaYaOverlay();
    }
    if (data.type === 'start_voting_round') {
        showPage('voting');
        const categoryTitle = document.getElementById('categoryName');
        if (categoryTitle)
            categoryTitle.textContent = data.category;
        const answersGrid = document.getElementById('answersGrid');
        const confirmBtn = document.getElementById('confirmButton');
        if (answersGrid) {
            answersGrid.innerHTML = '';
            (data.votingOptions || []).forEach((option) => {
                const answer = option.answer?.trim();
                if (!answer)
                    return;
                const btn = document.createElement('button');
                btn.className = 'answerButton correct';
                btn.textContent = answer;
                btn.disabled = isSpectator;
                let isCorrect = true;
                btn.onclick = () => {
                    if (isSpectator)
                        return;
                    isCorrect = !isCorrect;
                    btn.className = isCorrect ? 'answerButton correct' : 'answerButton incorrect';
                    connexio.send(JSON.stringify({
                        type: 'vote_word',
                        targetPlayers: option.targetPlayers,
                        category: data.category,
                        isCorrect
                    }));
                };
                answersGrid.appendChild(btn);
            });
        }
        if (confirmBtn) {
            confirmBtn.disabled = isSpectator;
            confirmBtn.innerText = isSpectator ? 'ESPECTEANDO' : 'CONFIRMAR';
            confirmBtn.onclick = () => {
                if (isSpectator)
                    return;
                confirmBtn.disabled = true;
                confirmBtn.innerText = 'Esperant...';
                connexio.send(JSON.stringify({ type: 'confirm_vote' }));
            };
        }
    }
    if (data.type === 'final_results') {
        showPage('scores');
        data.results.forEach((player, index) => {
            const row = document.getElementById(`row${index + 1}`);
            if (row) {
                const nameCell = row.querySelector('.player');
                const pointsCell = row.querySelector('.points');
                if (nameCell)
                    nameCell.textContent = player.nickname;
                if (pointsCell)
                    pointsCell.textContent = player.points.toString();
            }
        });
    }
});
