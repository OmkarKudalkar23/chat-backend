const express = require("express");
const app = express();
const http = require("http");
const server = http.createServer(app);
const { Server } = require("socket.io");

const io = new Server(server, {
  cors: {
    origin: "https://chat-frontend-nine-sand.vercel.app",
    methods: ["GET", "POST"],
  },
});

const users = {};
const messageCounts = {};
const chatHistory = []; // store chat messages in memory

io.on("connection", (socket) => {
  console.log(socket.id, "connected");

  users[socket.id] = `User-${socket.id.slice(0, 4)}`;

  // Send chat history when a new client joins
  socket.emit("chatHistory", chatHistory);

  socket.emit("welcome", `Welcome ${users[socket.id]}! 🎉`);
  socket.broadcast.emit("newclient", `${users[socket.id]} joined the chat`);

  socket.on("setUsername", (username) => {
    users[socket.id] = username || users[socket.id];
  });

  socket.on("messageFromClientToServer", (msg) => {
    const now = Date.now();
    const windowSize = 10000; // 10 sec window
    const maxMessages = 5;    // limit per window

    if (!messageCounts[socket.id]) {
      messageCounts[socket.id] = [];
    }

    // Filter timestamps in current window
    messageCounts[socket.id] = messageCounts[socket.id].filter(
      (ts) => now - ts < windowSize
    );

    // If over the limit -> reject
    if (messageCounts[socket.id].length >= maxMessages) {
      socket.emit("errorMessage", "⏳ You're sending messages too fast!");
      return;
    }

    // Add new timestamp
    messageCounts[socket.id].push(now);

    // Build message object
    const messageObj = {
      id: socket.id,
      username: users[socket.id],
      text: msg,
      time: new Date(),
    };

    // Save to history
    chatHistory.push(messageObj);

    // Broadcast to all clients
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

    // Optional: also keep system messages in history
    chatHistory.push(leaveMsg);

    delete users[socket.id];
    delete messageCounts[socket.id];
  });
});

server.listen(4000, () =>
  console.log("Server running on http://localhost:4000")
);
