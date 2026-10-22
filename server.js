const express = require("express");
const http = require("http");
const { Server } = require("socket.io");

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: false } });
const PORT = process.env.PORT || 3000;
const rooms = new Map();
const MAX_MESSAGE_LENGTH = 400;
const MAX_USERS_PER_ROOM = 50;

app.use(express.static("public"));
app.get("/health", (_req, res) => res.status(200).json({ ok: true }));

function makeRoomCode() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  for (let i = 0; i < 5; i++) code += chars[Math.floor(Math.random() * chars.length)];
  return code;
}
function getRoom(code) {
  if (!rooms.has(code)) rooms.set(code, { users: new Set(), messages: [] });
  return rooms.get(code);
}
function cleanName(value) {
  const name = String(value || "").trim().replace(/[<>\u0000-\u001f]/g, "").slice(0, 20);
  return name || "Mystery";
}
function cleanMessage(value) {
  return String(value || "").trim().replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, "").slice(0, MAX_MESSAGE_LENGTH);
}

io.on("connection", (socket) => {
  let currentRoom = null;
  let nickname = "Mystery";
  let lastMessageAt = 0;

  socket.on("create-room", (callback) => {
    let code;
    do { code = makeRoomCode(); } while (rooms.has(code));
    getRoom(code);
    if (typeof callback === "function") callback({ ok: true, code });
  });

  socket.on("join-room", ({ code, name } = {}, callback) => {
    code = String(code || "").toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 5);
    if (!code || !rooms.has(code)) {
      if (typeof callback === "function") callback({ ok: false, error: "Room not found. Create one first." });
      return;
    }
    const room = getRoom(code);
    if (room.users.size >= MAX_USERS_PER_ROOM && !room.users.has(socket.id)) {
      if (typeof callback === "function") callback({ ok: false, error: "This room is full." });
      return;
    }
    if (currentRoom) {
      socket.leave(currentRoom);
      const old = rooms.get(currentRoom);
      if (old) old.users.delete(socket.id);
    }
    currentRoom = code;
    nickname = cleanName(name);
    socket.join(code);
    room.users.add(socket.id);
    socket.emit("chat-history", room.messages);
    io.to(code).emit("room-count", room.users.size);
    socket.to(code).emit("system-message", nickname + " joined the room.");
    if (typeof callback === "function") callback({ ok: true, code, name: nickname });
  });

  socket.on("chat-message", (raw) => {
    if (!currentRoom) return;
    const now = Date.now();
    if (now - lastMessageAt < 700) return;
    lastMessageAt = now;
    const text = cleanMessage(raw);
    if (!text) return;
    const message = { name: nickname, text, time: new Date().toISOString() };
    const room = rooms.get(currentRoom);
    if (!room) return;
    room.messages.push(message);
    if (room.messages.length > 100) room.messages.shift();
    io.to(currentRoom).emit("chat-message", message);
  });

  socket.on("disconnect", () => {
    if (!currentRoom) return;
    const room = rooms.get(currentRoom);
    if (!room) return;
    room.users.delete(socket.id);
    io.to(currentRoom).emit("room-count", room.users.size);
    io.to(currentRoom).emit("system-message", nickname + " left the room.");
    if (room.users.size === 0) rooms.delete(currentRoom);
  });
});

server.listen(PORT, "0.0.0.0", () => console.log("Only Lies Chat listening on " + PORT));
