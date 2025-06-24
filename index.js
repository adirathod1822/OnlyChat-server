const express = require("express");
const http = require("http");
const cors = require("cors");
const { Server } = require("socket.io");

const app = express();
app.use(cors());

const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: ["http://localhost:3000", "https://onlychat-1f5ee.web.app"],
    methods: ["GET", "POST"],
  },
});

const users = {}; // email -> socket.id

io.on("connection", (socket) => {
  console.log("🟢 Connected:", socket.id);

  socket.on("register_user", (email) => {
    users[email] = socket.id;
    console.log("✅ Registered:", email, "→", socket.id);
    sendOnlineUsers();
  });

  socket.on("get_online_users", () => {
    socket.emit("online_users", Object.keys(users));
  });

  socket.on("send_private_message", ({ to, from, text }) => {
    const targetSocket = users[to];
    if (targetSocket) {
      io.to(targetSocket).emit("receive_private_message", { from, to, text });
    }
  });

  socket.on("disconnect", () => {
    for (let email in users) {
      if (users[email] === socket.id) {
        console.log("❌ Disconnected:", email);
        delete users[email];
        break;
      }
    }
    sendOnlineUsers();
  });

  function sendOnlineUsers() {
    const onlineEmails = Object.keys(users);
    io.emit("online_users", onlineEmails);
  }
});

server.listen(5000, () => console.log("🚀 Server running on port 5000"));