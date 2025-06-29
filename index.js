const express = require("express");
const http = require("http");
const cors = require("cors");
const { Server } = require("socket.io");
const admin = require("firebase-admin");

const app = express();

const serviceAccount = require("./onlychat-admin.json");

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

const firestore = admin.firestore();

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


  socket.on("send_private_message", (msg) => {
    let { from, to, text, timestamp, ...rest } = msg;

    if (!timestamp || isNaN(new Date(timestamp).getTime())) {
      timestamp = Date.now();
    }

    const forwardMsg = {
      from,
      to,
      text,
      timestamp,
      ...rest,
    };

    const targetSocketId = users[to];
    if (targetSocketId) {
      io.to(targetSocketId).emit("receive_private_message", forwardMsg);
    }
  });

  socket.on("typing", (data) => {
    const { from, to } = data;
    const targetSocketId = users[to];
    if (targetSocketId) {
      io.to(targetSocketId).emit("typing", { from, to });
    }
  });

  socket.on("stop_typing", (data) => {
    const { from, to } = data;
    const targetSocketId = users[to];
    if (targetSocketId) {
      io.to(targetSocketId).emit("stop_typing", { from, to });
    }
  });

  socket.on("disconnect", async () => {
    for (const email in users) {
      if (users[email] === socket.id) {
        console.log("❌ Disconnected:", email);
        try {
          await firestore.collection("users").doc(email).update({
            online: false,
            last_changed: admin.firestore.FieldValue.serverTimestamp(),
          });
          console.log(`📉 Set ${email} offline in Firestore`);
        } catch (err) {
          console.error("❌ Firestore update failed:", err);
        }

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

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});
