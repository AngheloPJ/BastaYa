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

server.listen(PORT, () => {
  console.log("SERVER: Running on port", PORT);
});

let gameState = "waiting";
let gameData = {};
let votes = {};
let categoriesInPlay = [];
let currentCategoryIndex = 0;
let confirmations = 0;
let esperandoRespuestas = false;
let votingTimeout;

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

wsServer.on("connection", (client) => {
  const nomAleatori = randomNickname();
  const isFirst = clients.size === 0;
  clients.set(client, { nickname: nomAleatori, isHost: isFirst, points: 0 });
  
  client.send(JSON.stringify({ type: "host_status", isHost: isFirst }));
  broadcastUserList();
  
  client.on("message", (missatge) => {
    let data;
    try {
      data = JSON.parse(missatge);
    } catch {
      return;
    }
    
    const usuario = clients.get(client);
    
    if (data.type === "set_nickname") {
      usuario.nickname = data.nickname;
      clients.set(client, usuario);
      broadcastUserList();
    }
    
    if (data.type === "chat_message") {
      broadcast({
        type: "chat_message",
        nickname: usuario.nickname,
        message: data.message,
      });
    }
    
    if (data.type === "start_game_request" && usuario.isHost) {
      const lletres = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
      startGame(lletres[Math.floor(Math.random() * lletres.length)]);
    }
    
    if (data.type === "return_to_lobby" && usuario.isHost) {
      gameState = "waiting";
      gameData = {};
      votes = {};
      currentCategoryIndex = 0;
      confirmations = 0;
      esperandoRespuestas = false;
      clearTimeout(votingTimeout);
      clients.forEach((u) => (u.points = 0));
      broadcast({ type: "return_to_lobby" });
    }
    
    if (data.type === "submit_answers") {
      gameData[usuario.nickname] = data.answers;
      
      if (gameState === "started" && !esperandoRespuestas) {
        esperandoRespuestas = true;
        broadcast({ type: "stop_game", winner: usuario.nickname });
        
        setTimeout(() => {
          esperandoRespuestas = false;
          gameState = "finished";
          startVotingRound(0);
        }, 2000);
      }
    }
    
    if (data.type === "vote_word") {
      const { targetPlayer, category, isCorrect } = data;
      if (!votes[targetPlayer]) votes[targetPlayer] = {};
      if (!votes[targetPlayer][category])
        votes[targetPlayer][category] = { voters: new Map() };
      votes[targetPlayer][category].voters.set(client, isCorrect);
    }

    if (data.type === "confirm_vote") {
      confirmations++;
      if (confirmations >= clients.size) {
        clearTimeout(votingTimeout);
        startVotingRound(currentCategoryIndex + 1);
      }
    }
  });

  client.on("close", () => {
    const usuarioQueSeVa = clients.get(client);
    if (!usuarioQueSeVa) return;

    clients.delete(client);

    if (usuarioQueSeVa.isHost && clients.size > 0) {
      const nextClient = clients.keys().next().value;
      clients.get(nextClient).isHost = true;
      nextClient.send(JSON.stringify({ type: "host_status", isHost: true }));
    }

    broadcastUserList();
  });
});

function broadcast(missatge) {
  const data =
    typeof missatge === "string" ? missatge : JSON.stringify(missatge);
  wsServer.clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) client.send(data);
  });
}

function broadcastUserList() {
  const users = Array.from(clients.values()).map((c) => ({
    nickname: c.nickname,
    isHost: c.isHost,
  }));
  broadcast({ type: "user_list", users });
}

function randomNickname() {
  let nums = "";
  for (let i = 0; i < 5; i++) nums += Math.floor(Math.random() * 5);
  return "Anònim" + nums;
}

function startGame(letter) {
  gameState = "started";
  gameData = {};
  votes = {};
  currentCategoryIndex = 0;

  categoriesInPlay = [...CATEGORIAS_POOL]
    .sort(() => 0.5 - Math.random())
    .slice(0, 9);
  broadcast({ type: "start_game", letter, categories: categoriesInPlay });
}

function startVotingRound(index) {
  if (index >= categoriesInPlay.length) {
    calculateFinalScores();
    return;
  }

  currentCategoryIndex = index;
  confirmations = 0;

  broadcast({
    type: "start_voting_round",
    category: categoriesInPlay[index],
    answers: gameData,
  });

  votingTimeout = setTimeout(() => startVotingRound(index + 1), 15000);
}

function calculateFinalScores() {
  clients.forEach((user) => (user.points = 0));

  Object.keys(gameData).forEach((playerNick) => {
    Object.keys(gameData[playerNick]).forEach((catName) => {
      const answer = gameData[playerNick][catName];
      if (!answer || answer.trim() === "") return;

      const wordVotes = votes[playerNick]?.[catName];
      let isValid = true;

      if (wordVotes) {
        let pos = 0,
          neg = 0;
        wordVotes.voters.forEach((val) => (val ? pos++ : neg++));
        if (neg > pos) isValid = false;
      }

      if (isValid) {
        const clientEntry = Array.from(clients.values()).find(
          (u) => u.nickname === playerNick,
        );
        if (clientEntry) clientEntry.points += 100;
      }
    });
  });

  const results = Array.from(clients.values())
    .map((u) => ({ nickname: u.nickname, points: u.points }))
    .sort((a, b) => b.points - a.points);

  broadcast({ type: "final_results", results });
}
