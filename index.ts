import { WebSocketServer, WebSocket } from "ws";
import cors from "cors";
import express from "express";
import http from "http";

//vars
const app = express();
app.use(express.json());
app.use(cors());
const server = http.createServer(app);

const wss = new WebSocketServer({ server });
const transactions = Array<string>();
const sockets = Array<WebSocket>();
const queue = Array<Array<string>>();

let miningStatus = false;

// web socket logic
wss.on("connection", (ws) => {
  console.log("new join");
  sockets.push(ws);

  // send total number of nodes to everyone
  sockets.forEach((socket) => {
    socket.send(JSON.stringify({ type: "nodes", data: sockets.length }));
  });

  // Handle socket messages
  ws.on("message", (message) => {
    const data = JSON.parse(message.toString());

    // handle transaction
    if (data.type === "create-transaction") {
      transactions.push(data.data);
      console.log("Transactions length: ", transactions.length);
      handleTransactions();
    }

    // broadcast mined block and give the reward to the minner;
    if (data.type === "mining-successful") {
      console.log("Mining successful");
      sockets.forEach((socket) => {
        socket.send(
          JSON.stringify({
            type: "create-block",
            data: data.data,
            reward: ws == socket ? "0.1" : "0.0",
          }),
        );
      });
      handleQueue();
    }
  });

  // let everyone know when a node disconnects
  ws.on("close", () => {
    console.log("Node disconnected");
    const index = sockets.indexOf(ws);
    sockets.splice(index, 1);
    if (sockets.length == 0) {
      queue.length = 0;
      miningStatus = false;
      transactions.length = 0;
    }
    sockets.forEach((socket) => {
      socket.send(JSON.stringify({ type: "nodes", data: sockets.length }));
    });
  });
});

function handleTransactions() {
  if (transactions.length >= 20 && !miningStatus) {
    miningStatus = true;
    sockets.forEach((socket) => {
      socket.send(
        JSON.stringify({
          type: "start-mining-block",
          data: transactions,
          initialBits: "00000",
        }),
      );
    });
    transactions.length = 0; // reset transactions after sending
  } else if (transactions.length >= 20 && miningStatus) {
    queue.push([...transactions]);
    transactions.length = 0;
  }
}

function handleQueue() {
  if (queue.length > 0) {
    const transaction = queue.shift();
    sockets.forEach((socket) => {
      socket.send(
        JSON.stringify({
          type: "start-mining-block",
          data: transaction,
          initialBits: "00000",
        }),
      );
    });
  } else miningStatus = false;
}

// Start the server
app.get("/", (req, res) => {
  res.send("WebSocket server is running");
});

server.listen(3000, () => {
  console.log("Server is listening on port 3000");
});
