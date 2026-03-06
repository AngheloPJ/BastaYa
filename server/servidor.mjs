/*
────────────────────────────
📦 Servidor WS | 8180
──────────────────────────── 
*/

import WebSocket, { WebSocketServer } from "ws";
const clients = new Map();

const wsServer = new WebSocketServer({ port: 8180 });
console.log("📦 Servidor WS (Nodo): http://localhost:8180");

/**
 * Listener de nueva connexió
 * Es dispara quan un client es conecta
 */
wsServer.on("connection", (client, req) => {
  // ~ Guardar el client amb un nick aleatori
  const nomAleatori = randomNickname();
  clients.set(client, nomAleatori);
  broadcast(nomAleatori + " s'ha connectat.");

  // ~ Actualitzar llista d'usuaris connectats
  getOnlinePlayers();

  // ~ Enviar missatges segons el tipus
  client.on("message", (missatge) => {
    const data = JSON.parse(missatge);

    if (data.type === 'set_nickname') {
      clients.set(client, data.nickname);
      broadcast(JSON.stringify({ type: "update_nickname", nickname: data.nickname }));
    }

    if (data.type == 'chat_message') {
      const nickname = clients.get(client) || nomAleatori;
      broadcast(JSON.stringify({ type: "chat_message", nickname, message: data.message }));
    }

  });
});

// ~ Funciones útiles (WS)

/**
 * Enviar missatge a tots els clients (Brodcast)
 * @param {*} missatge El missatge a enviar
 * @param {*} clientExclos Els clients esclosos
 */
function broadcast(missatge, clientExclos) {
  const data = typeof msg === 'string' ? msg : JSON.stringify(missatge);
  wsServer.clients.forEach(client => {
    if (client.readyState === WebSocket.OPEN && client !== clientExclos)
      client.send(data);
  });
}

/**
 * Función per crear un nom aleatori amb 5 números.
 * @returns Retorna el missatge amb els 5 dígits.
 */
function randomNickname() {
  let nums = "", nickname = "Anònim";
  for (let i = 0; i < 5; i++) nums += Math.floor(Math.random() * 5);
  console.log(nickname + nums);
  return nickname + nums;
}

/**
 * Funció per enviar tots els jugadors connectats
 */
function getOnlinePlayers() {
  const nicknames = Array.from(clients.values());
  broadcast(JSON.stringify({ type: 'user_list', users: nicknames }));
}

/*
─────────────────────────────
📦 Servidor (Backend) | 8080
───────────────────────────── 
*/

import { createServer } from "http";
import { parse } from "url";
import { existsSync, readFile } from "fs";

function header(resposta, codi, cType) {
  resposta.setHeader("Access-Control-Allow-Origin", "*");
  resposta.setHeader("Access-Control-Allow-Methods", "GET");
  if (cType) resposta.writeHead(codi, { "Content-Type": cType });
  else resposta.writeHead(codi);
}

function enviarArxiu(resposta, dades, cType, err) {
  if (err) {
    header(resposta, 400, "text/html");
    resposta.end("<p style='text-align:center;font-size:1.2rem;font-weight:bold;color:red'>Error al l legir l'arxiu</p>");
    return;
  }

  header(resposta, 200, cType);
  resposta.write(dades);
  resposta.end();
}

function onRequest(peticio, resposta) {
  let cosPeticio = "";

  peticio
    .on("error", function (err) {
      console.error(err);
    })
    .on("data", function (dades) {
      cosPeticio += dades;
    })
    .on("end", function () {
      resposta.on("error", function (err) {
        console.error(err);
      });

      if (peticio.method == "GET") {
        let q = parse(peticio.url, true);
        let filename = "./public" + q.pathname;

        if (filename == "./public/") filename += "index.html";
        if (existsSync(filename)) {
          readFile(filename, function (err, dades) {
            enviarArxiu(resposta, dades, filename, undefined, err);
          });
        } else {
          header(resposta, 404, "text/html");
          resposta.end(
            "<p style='text-align:center;font-size:1.2rem;font-weight:bold;color:red'>404 Not Found</p>",
          );
        }
      }
    });
}

let server = createServer();
server.on("request", onRequest);

server.listen(8080);
console.log("📦 Servidor (Backend): http://localhost:8080");
