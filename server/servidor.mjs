/******************************************************************************
 *					SERVIDOR WEB SOCKETS (port 8180)
 ******************************************************************************/

// Afegir el mòdul 'ws'
import WebSocket, { WebSocketServer } from "ws";

// Crear servidor WebSockets i escoltar en el port 8180
const wsServer = new WebSocketServer({ port: 8180 });
console.log("Servidor WebSocket escoltant en http://localhost:8180");

// Enviar missatge a tothom excepte a 'clientExclos'
//	(si no s'especifica qui és el 'clientExclos', s'envia a tots els clients)
function broadcast(missatge, clientExclos) {
  wsServer.clients.forEach(function each(client) {
    if (client.readyState === WebSocket.OPEN && client !== clientExclos) {
      client.send(missatge);
    }
  });
}

// Al rebre un nou client (nova connexió)
wsServer.on("connection", (client, peticio) => {
  // Guardar identificador (IP i Port) del nou client
  let id = peticio.socket.remoteAddress + ":" + peticio.socket.remotePort;

  // Enviar salutació al nou client
  //	i avisar a tots els altres que s'ha afegit un nou client
  client.send(`Benvingut <strong>${id}</strong>`);
  broadcast(`Nou client afegit: ${id}`, client);
  console.log(`Benvingut ${id}`);
  console.log(`Nou client afegit: ${id}`);

  // Al rebre un missatge d'aques client
  //	reenviar-lo a tothom (inclòs ell mateix)
  client.on("message", (missatge) => {
    broadcast(`<strong>${id}: </strong>${missatge}`);
    console.log(`Missatge de ${id} --> ${missatge}`);
  });
});

/******************************************************************************
 *						SERVIDOR WEB (port 8080)
 ******************************************************************************/

import { createServer } from "http";
import { parse } from "url";
import { existsSync, readFile } from "fs";

function header(resposta, codi, cType) {
  resposta.setHeader("Access-Control-Allow-Origin", "*");
  resposta.setHeader("Access-Control-Allow-Methods", "GET");
  if (cType) resposta.writeHead(codi, { "Content-Type": cType });
  else resposta.writeHead(codi);
}

function enviarArxiu(resposta, dades, filename, cType, err) {
  if (err) {
    header(resposta, 400, "text/html");
    resposta.end(
      "<p style='text-align:center;font-size:1.2rem;font-weight:bold;color:red'>Error al l legir l'arxiu</p>",
    );
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
        let filename = "." + q.pathname;

        if (filename == "./") filename += "index.html";
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
console.log("Servidor escoltant en http://localhost:8080");
