import WebSocket, { WebSocketServer } from "ws";
import { createServer } from "http";
import { existsSync, readFile } from "fs";
import { extname } from "path";

const PORT = process.env.PORT || 8080;
const server = createServer((peticio, resposta) => {
  peticio
    .on("error", console.error)
    .on("data", () => {})
    .on("end", () => {
      resposta.on("error", console.error);

      if (peticio.method === "GET") {
        const q = new URL(peticio.url, "http://" + peticio.headers.host);
        let filename = "./public" + q.pathname;
        if (filename === "./public/") filename += "index.html";

        if (existsSync(filename)) {
          const cType =
            MIME_TYPES[extname(filename)] || "application/octet-stream";
          readFile(filename, (err, dades) => {
            if (err) {
              resposta.writeHead(400, { "Content-Type": "text/html" });
              resposta.end("<p>Error al llegir l'arxiu</p>");
              return;
            }
            resposta.setHeader("Access-Control-Allow-Origin", "*");
            resposta.writeHead(200, { "Content-Type": cType });
            resposta.end(dades);
          });
        } else {
          resposta.writeHead(404, { "Content-Type": "text/html" });
          resposta.end("<p>404 Not Found</p>");
        }
      }
    });
});


const wsServer = new WebSocketServer({ server });
const clients = new Map();
const rooms = new Map();

server.listen(PORT, () => {
  console.log("SERVER: Running on port", PORT);
});

const CATEGORIAS_POOL = [
  "Marcas",
  "Vehículos",
  "Comida",
  "Título de canción/película/libro",
  "Animales",
  "Países o Ciudades",
  "Nombres de persona",
  "Profesiones",
  "Objetos de casa",
  "Colores",
  "Frutas o Verduras",
  "Deportes",
  "Personajes Famosos",
  "Ropa",
  "Partes del cuerpo",
  "Superhéroes",
];

const MIME_TYPES = {
  ".html": "text/html",
  ".css": "text/css",
  ".js": "application/javascript",
  ".json": "application/json",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".gif": "image/gif",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
};

const BASE_POINTS = 100;
const DUPLICATE_POINTS = 50;

wsServer.on("connection", (client) => {
  const nomAleatori = randomNickname();
  clients.set(client, {
    nickname: nomAleatori,
    isHost: false,
    isSpectator: false,
    points: 0,
    roomCode: null,
  });

  client.send(JSON.stringify({ type: "host_status", isHost: false }));
  
  client.on("message", (missatge) => {
    let data;
    try {
      data = JSON.parse(missatge.toString());
    } catch {
      return;
    }
    
    const usuario = clients.get(client);
    if (!usuario) return;

    if (data.type === "create_room_request") {
      const nickname = String(data.nickname || "").trim();

      const roomCode = generateRoomCode();
      rooms.set(roomCode, createRoom(roomCode));
      if (nickname !== "") usuario.nickname = nickname;
      joinRoom(client, roomCode);
      client.send(JSON.stringify({ type: "room_created", roomCode }));
      return;
    }

    if (data.type === "join_room_request") {
      const nickname = String(data.nickname || "").trim();
      const roomCode = normalizeRoomCode(data.roomCode);

      if (!roomCode) {
        client.send(
          JSON.stringify({
            type: "error",
            message: "Debes introducir el código de la sala.",
          }),
        );
        return;
      }

      if (!rooms.has(roomCode)) {
        client.send(
          JSON.stringify({
            type: "error",
            message: "La sala no existe. Crea una o revisa el codigo.",
          }),
        );
        return;
      }

      if (nickname !== "") usuario.nickname = nickname;
      joinRoom(client, roomCode);
      return;
    }

    const room = getClientRoom(client);
    if (!room) return;
    const activePlayers = getActiveRoomClients(room);
    
    if (data.type === "set_nickname") {
      usuario.nickname = data.nickname;
      if (data.nickname.length > 20) return;

      clients.set(client, usuario);
      broadcastUserList(room);
    }
    
    if (data.type === "chat_message") {
      broadcastToRoom(room, {
        type: "chat_message",
        nickname: usuario.nickname,
        message: data.message,
      });
    }
    
    if (data.type === "start_game_request" && usuario.isHost && !usuario.isSpectator) {
      const lletres = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
      let lletra = lletres[Math.floor(Math.random() * lletres.length)];

      while (room.lletresJugades.includes(lletra)) {
        lletra = lletres[Math.floor(Math.random() * lletres.length)];
      }
      room.lletresJugades.push(lletra);
      if (room.lletresJugades.length > 5) room.lletresJugades.shift();

      startGame(room, lletra);
    }
    
    if (data.type === "return_to_lobby" && usuario.isHost) {
      room.phase = "lobby";
      room.gameState = "waiting";
      room.gameData = {};
      room.votes = {};
      room.currentCategoryIndex = 0;
      room.confirmations = 0;
      room.esperandoRespuestas = false;
      room.currentLetter = "";
      room.currentVotingCategory = "";
      room.finalResults = [];
      clearTimeout(room.votingTimeout);

      room.clients.forEach((c) => {
        const user = clients.get(c);
        if (user) {
          user.points = 0;
          user.isSpectator = false;
        }
      });

      assignHost(room);
      syncSpectatorStatus(room);
      syncHostStatus(room);
      broadcastToRoom(room, { type: "return_to_lobby" });
      broadcastUserList(room);
    }
    
    if (data.type === "submit_answers") {
      if (usuario.isSpectator) return;

      room.gameData[usuario.nickname] = data.answers;
      
      if (room.gameState === "started" && !room.esperandoRespuestas) {
        room.esperandoRespuestas = true;
        broadcastToRoom(room, { type: "stop_game", winner: usuario.nickname });
        
        setTimeout(() => {
          room.esperandoRespuestas = false;
          room.gameState = "finished";
          startVotingRound(room, 0);
        }, 2000);
      }
    }
    
    if (data.type === "vote_word") {
      if (usuario.isSpectator) return;

      const { category, isCorrect } = data;
      const targets = Array.isArray(data.targetPlayers)
        ? data.targetPlayers
        : [data.targetPlayer];

      targets.forEach((targetPlayer) => {
        if (!targetPlayer) return;
        if (!room.votes[targetPlayer]) room.votes[targetPlayer] = {};
        if (!room.votes[targetPlayer][category]) {
          room.votes[targetPlayer][category] = { voters: new Map() };
        }
        room.votes[targetPlayer][category].voters.set(client, isCorrect);
      });
    }

    if (data.type === "confirm_vote") {
      if (usuario.isSpectator) return;

      room.confirmations++;
      if (room.confirmations >= activePlayers.length) {
        clearTimeout(room.votingTimeout);
        startVotingRound(room, room.currentCategoryIndex + 1);
      }
    }
  });

  client.on("close", () => {
    leaveRoom(client);
    clients.delete(client);
  });
});

function createRoom(code) {
  return {
    code,
    clients: new Set(),
    phase: "lobby",
    gameState: "waiting",
    gameData: {},
    votes: {},
    categoriesInPlay: [],
    currentCategoryIndex: 0,
    confirmations: 0,
    esperandoRespuestas: false,
    votingTimeout: null,
    lletresJugades: [],
    currentLetter: "",
    currentVotingCategory: "",
    finalResults: [],
  };
}

function normalizeRoomCode(code) {
  return String(code || "")
    .trim()
    .toUpperCase();
}

function generateRoomCode() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";

  do {
    code = "";
    for (let i = 0; i < 6; i++) {
      code += chars[Math.floor(Math.random() * chars.length)];
    }
  } while (rooms.has(code));

  return code;
}

function getClientRoom(client) {
  const user = clients.get(client);
  if (!user?.roomCode) return null;
  return rooms.get(user.roomCode) || null;
}

function joinRoom(client, roomCode) {
  const room = rooms.get(roomCode);
  const user = clients.get(client);
  if (!room || !user) return;

  leaveRoom(client, false);

  room.clients.add(client);
  user.roomCode = roomCode;
  user.points = 0;
  user.isSpectator = room.phase !== "lobby";

  assignHost(room);

  client.send(JSON.stringify({
    type: "room_joined",
    roomCode,
    nickname: user.nickname,
    isSpectator: user.isSpectator,
  }));
  syncHostStatus(room);
  broadcastUserList(room);
  sendRoomSnapshot(client, room);
}

function leaveRoom(client, shouldDeleteClient = true) {
  const user = clients.get(client);
  if (!user?.roomCode) return;

  const roomCode = user.roomCode;
  const room = rooms.get(roomCode);
  const wasHost = user.isHost;

  user.roomCode = null;
  user.isHost = false;
  user.isSpectator = false;
  user.points = 0;

  if (!room) return;

  room.clients.delete(client);

  if (room.clients.size === 0) {
    clearTimeout(room.votingTimeout);
    rooms.delete(roomCode);
    return;
  }

  if (wasHost) assignHost(room);

  syncHostStatus(room);
  broadcastUserList(room);

  if (!shouldDeleteClient) {
    client.send(JSON.stringify({ type: "host_status", isHost: false }));
  }
}

function broadcastToRoom(room, missatge) {
  const data =
    typeof missatge === "string" ? missatge : JSON.stringify(missatge);
  room.clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) client.send(data);
  });
}

function syncHostStatus(room) {
  room.clients.forEach((client) => {
    const user = clients.get(client);
    if (!user) return;
    client.send(JSON.stringify({ type: "host_status", isHost: user.isHost }));
  });
}

function syncSpectatorStatus(room) {
  room.clients.forEach((client) => {
    const user = clients.get(client);
    if (!user) return;
    client.send(
      JSON.stringify({ type: "spectator_status", isSpectator: user.isSpectator }),
    );
  });
}

function broadcastUserList(room) {
  const users = Array.from(room.clients)
    .map((client) => clients.get(client))
    .filter(Boolean)
    .map((c) => ({
      nickname: c.nickname,
      isHost: c.isHost,
      isSpectator: c.isSpectator,
    }));
  broadcastToRoom(room, { type: "user_list", users });
}

function getActiveRoomClients(room) {
  return Array.from(room.clients).filter((client) => {
    const user = clients.get(client);
    return Boolean(user && !user.isSpectator);
  });
}

function assignHost(room) {
  room.clients.forEach((client) => {
    const user = clients.get(client);
    if (user) user.isHost = false;
  });

  const nextHost = getActiveRoomClients(room)[0] || room.clients.values().next().value;
  const nextUser = clients.get(nextHost);
  if (nextUser) nextUser.isHost = true;
}

function sendRoomSnapshot(client, room) {
  if (room.phase === "game") {
    client.send(
      JSON.stringify({
        type: "start_game",
        letter: room.currentLetter,
        categories: room.categoriesInPlay,
      }),
    );
    return;
  }

  if (room.phase === "voting") {
    client.send(
      JSON.stringify({
        type: "start_voting_round",
        category: room.currentVotingCategory,
        votingOptions: buildVotingOptions(room, room.currentVotingCategory),
      }),
    );
    return;
  }

  if (room.phase === "scores") {
    client.send(JSON.stringify({ type: "final_results", results: room.finalResults }));
  }
}

function randomNickname() {
  let nums = "";
  for (let i = 0; i < 5; i++) nums += Math.floor(Math.random() * 5);
  return "Anònim" + nums;
}

function startGame(room, letter) {
  room.phase = "game";
  room.gameState = "started";
  room.gameData = {};
  room.votes = {};
  room.currentCategoryIndex = 0;
  room.currentLetter = letter;
  room.currentVotingCategory = "";
  room.finalResults = [];

  room.categoriesInPlay = [...CATEGORIAS_POOL]
    .sort(() => 0.5 - Math.random())
    .slice(0, 9);
  broadcastToRoom(room, {
    type: "start_game",
    letter,
    categories: room.categoriesInPlay,
  });
}

function startVotingRound(room, index) {
  if (index >= room.categoriesInPlay.length) {
    calculateFinalScores(room);
    return;
  }

  room.phase = "voting";
  room.currentCategoryIndex = index;
  room.confirmations = 0;
  room.currentVotingCategory = room.categoriesInPlay[index];

  broadcastToRoom(room, {
    type: "start_voting_round",
    category: room.currentVotingCategory,
    votingOptions: buildVotingOptions(room, room.currentVotingCategory),
  });

  room.votingTimeout = setTimeout(() => startVotingRound(room, index + 1), 15000);
}

function calculateFinalScores(room) {
  getActiveRoomClients(room).forEach((client) => {
    const user = clients.get(client);
    if (user) user.points = 0;
  });

  const duplicateCountsByCategory = {};
  room.categoriesInPlay.forEach((category) => {
    duplicateCountsByCategory[category] = {};
    Object.keys(room.gameData).forEach((playerNick) => {
      const answer = room.gameData[playerNick]?.[category];
      if (!isMeaningfulAnswer(answer)) return;
      const normalized = normalizeAnswer(answer);
      duplicateCountsByCategory[category][normalized] =
        (duplicateCountsByCategory[category][normalized] || 0) + 1;
    });
  });

  Object.keys(room.gameData).forEach((playerNick) => {
    Object.keys(room.gameData[playerNick]).forEach((catName) => {
      const answer = room.gameData[playerNick][catName];
      if (!isMeaningfulAnswer(answer)) return;

      const wordVotes = room.votes[playerNick]?.[catName];
      let isValid = true;

      if (wordVotes) {
        let neg = 0;
        wordVotes.voters.forEach((val) => {
          if (!val) neg++;
        });

        // Solo se veta si la mayoria de la sala lo marca como incorrecto.
        if (neg > getActiveRoomClients(room).length / 2) isValid = false;
      }

      if (isValid) {
        const duplicateCount =
          duplicateCountsByCategory[catName]?.[normalizeAnswer(answer)] || 1;
        const pointsToAdd =
          duplicateCount > 1 ? DUPLICATE_POINTS : BASE_POINTS;

        const clientEntry = getActiveRoomClients(room)
          .map((client) => clients.get(client))
          .find((u) => u?.nickname === playerNick);
        if (clientEntry) clientEntry.points += pointsToAdd;
      }
    });
  });

  const results = getActiveRoomClients(room)
    .map((client) => clients.get(client))
    .filter(Boolean)
    .map((u) => ({ nickname: u.nickname, points: u.points }))
    .sort((a, b) => b.points - a.points);

  room.phase = "scores";
  room.finalResults = results;
  broadcastToRoom(room, { type: "final_results", results });
}

function normalizeAnswer(answer) {
  return String(answer || "")
    .trim()
    .toLowerCase();
}

function isMeaningfulAnswer(answer) {
  return normalizeAnswer(answer).length > 1;
}

function buildVotingOptions(room, category) {
  const uniqueAnswers = new Map();

  Object.keys(room.gameData).forEach((playerNick) => {
    const answer = room.gameData[playerNick]?.[category];
    if (!isMeaningfulAnswer(answer)) return;

    const key = normalizeAnswer(answer);
    if (!uniqueAnswers.has(key)) {
      uniqueAnswers.set(key, {
        answer: String(answer).trim(),
        targetPlayers: [],
      });
    }
    uniqueAnswers.get(key).targetPlayers.push(playerNick);
  });

  return Array.from(uniqueAnswers.values());
}
