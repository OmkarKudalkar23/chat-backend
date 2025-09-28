const express = require("express");
const app = express();
const http = require("http");
const server = http.createServer(app);
const { Server } = require("socket.io");

const io = new Server(server, {
  cors: {
    origin: ["http://localhost:5173","https://chat-frontend-nine-sand.vercel.app"],
    methods: ["GET", "POST"],
  },
});

const users = {};
const messageCounts = {};
const chatHistory = [];

io.on("connection", (socket) => {
  users[socket.id] = `User-${socket.id.slice(0, 4)}`;
  socket.emit("chatHistory", chatHistory);
  socket.emit("welcome", `Welcome ${users[socket.id]}! 🎉`);
  socket.broadcast.emit("newclient", `${users[socket.id]} joined the chat`);
  io.emit("activeUsers", Object.values(users));

  socket.on("setUsername", (username) => {
    users[socket.id] = username || users[socket.id];
    io.emit("activeUsers", Object.values(users));
  });

  socket.on("clearChat", () => {
    chatHistory.length = 0;
    io.emit("chatHistory", chatHistory);
  });

  socket.on("typing", (isTyping) => {
    socket.broadcast.emit("userTyping", {
      username: users[socket.id],
      typing: isTyping,
    });
  });

  socket.on("messageFromClientToServer", (msg) => {
    const now = Date.now();
    const windowSize = 10000;
    const maxMessages = 5;

    if (!messageCounts[socket.id]) {
      messageCounts[socket.id] = [];
    }

    messageCounts[socket.id] = messageCounts[socket.id].filter(
      (ts) => now - ts < windowSize
    );

    if (messageCounts[socket.id].length >= maxMessages) {
      socket.emit("errorMessage", "⏳ You're sending messages too fast!");
      return;
    }

    messageCounts[socket.id].push(now);

    const messageObj = {
      id: socket.id,
      username: users[socket.id],
      text: msg,
      time: new Date(),
    };

    chatHistory.push(messageObj);
    io.emit("messageFromServerToClient", messageObj);
  });

  socket.on("disconnect", () => {
    const leaveMsg = {
      id: "server",
      username: "System",
      text: `${users[socket.id]} left the chat`,
      time: new Date(),
    };

    io.emit("messageFromServerToClient", leaveMsg);
    chatHistory.push(leaveMsg);
    delete users[socket.id];
    delete messageCounts[socket.id];
    io.emit("activeUsers", Object.values(users));
  });
});

server.listen(4000, () =>
  console.log("Server running on http://localhost:4000")
);
