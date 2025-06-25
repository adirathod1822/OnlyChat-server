const express = require("express");
const http = require("http");
const cors = require("cors");
const { Server } = require("socket.io");

const app = express();


const allowedOrigins = [
  "http://localhost:3000",
  "https://onlychat-1f5ee.web.app",
  "https://onlychat.uk",
];

app.use(cors({
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.includes(origin)) {
      return callback(null, true);
    }
    return callback(new Error("Not allowed by CORS"));
  },
  methods: ["GET", "POST"],
  credentials: true,
}));

const server = http.createServer(app);


const io = new Server(server, {
  cors: {
    origin: allowedOrigins,
    methods: ["GET", "POST"],
    credentials: true,
  },
});


const users = {}; 

io.on("connection", (socket) => {
  console.log("🟢 New connection:", socket.id);

  socket.on("register_user", (email) => {
    users[email] = socket.id;
    console.log("✅ Registered:", email, "→", socket.id);
    broadcastOnlineUsers();
  });


  socket.on("get_online_users", () => {
    socket.emit("online_users", Object.keys(users));
  });


  socket.on("send_private_message", ({ to, from, text }) => {
    const targetSocketId = users[to];
    if (targetSocketId) {
      io.to(targetSocketId).emit("receive_private_message", { from, to, text });
    }
  });


  socket.on("disconnect", () => {
    for (const email in users) {
      if (users[email] === socket.id) {
        console.log("❌ Disconnected:", email);
        delete users[email];
        break;
      }
    }
    broadcastOnlineUsers();
  });


  function broadcastOnlineUsers() {
    const onlineUsers = Object.keys(users);
    io.emit("online_users", onlineUsers);
  }
});

const PORT = 5000;
server.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});
