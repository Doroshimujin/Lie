const express = require("express");
const http = require("http");
const { Server } = require("socket.io");

const app = express();
const server = http.createServer(app);
const io = new Server(server);
const PORT = process.env.PORT || 3000;
const rooms = new Map();
const MAX_MESSAGE_LENGTH = 400;
const MAX_USERS_PER_ROOM = 10;

app.use(express.static("public"));
app.get("/health", (_req, res) => res.status(200).json({ ok: true }));

function roomLabel(id) {
  return "Room " + Number(id.slice(4));
}
function getRoom(id) {
  if (!rooms.has(id)) rooms.set(id, { users: new Set(), messages: [] });
  return rooms.get(id);
}
function cleanName(value) {
  const name = String(value || "").trim().replace(/[<>\u0000-\u001f]/g, "").slice(0, 20);
  return name || "Mystery";
}
function cleanMessage(value) {
  return String(value || "").trim().replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, "").slice(0, MAX_MESSAGE_LENGTH);
}
function findAvailableRoom() {
  let number = 1;
  while (true) {
    const id = "room" + number;
    const room = rooms.get(id);
    if (!room || room.users.size < MAX_USERS_PER_ROOM) return id;
    number++;
  }
}
function leaveCurrentRoom(socket) {
  const id = socket.data.currentRoom;
  if (!id) return;
  const room = rooms.get(id);
  socket.leave(id);
  socket.data.currentRoom = null;
  if (!room) return;
  room.users.delete(socket.id);
  io.to(id).emit("room-count", room.users.size);
  io.to(id).emit("system-message", (socket.data.nickname || "Mystery") + " left the room.");
  if (room.users.size === 0) rooms.delete(id);
}
function enterRoom(socket, id, name, callback) {
  const room = getRoom(id);
  if (room.users.size >= MAX_USERS_PER_ROOM && !room.users.has(socket.id)) {
    if (typeof callback === "function") callback({ ok: false, error: "This room is full." });
    return;
  }
  leaveCurrentRoom(socket);
  socket.data.currentRoom = id;
  socket.data.nickname = cleanName(name);
  room.users.add(socket.id);
  socket.join(id);
  socket.emit("chat-history", room.messages);
  io.to(id).emit("room-count", room.users.size);
  socket.to(id).emit("system-message", socket.data.nickname + " joined the room.");
  if (typeof callback === "function") callback({ ok: true, code: id, label: roomLabel(id), name: socket.data.nickname });
}

io.on("connection", (socket) => {
  socket.data.currentRoom = null;
  socket.data.nickname = "Mystery";
  socket.data.lastMessageAt = 0;

  // Automatically match the user into the first room with space.
  socket.on("join-random-room", ({ name } = {}, callback) => {
    const id = findAvailableRoom();
    enterRoom(socket, id, name, callback);
  });

  // Optional direct join, e.g. room1 or room2, for rooms that currently exist.
  socket.on("join-room", ({ code, name } = {}, callback) => {
    const id = String(code || "").trim().toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 20);
    if (!/^room[1-9][0-9]*$/.test(id) || !rooms.has(id)) {
      if (typeof callback === "function") callback({ ok: false, error: "That room is not open. Choose Join a random room." });
      return;
    }
    enterRoom(socket, id, name, callback);
  });

  socket.on("chat-message", (raw) => {
    const id = socket.data.currentRoom;
    if (!id) return;
    const now = Date.now();
    if (now - socket.data.lastMessageAt < 700) return;
    socket.data.lastMessageAt = now;
    const text = cleanMessage(raw);
    if (!text) return;
    const room = rooms.get(id);
    if (!room) return;
    const message = { name: socket.data.nickname || "Mystery", text, time: new Date().toISOString() };
    room.messages.push(message);
    if (room.messages.length > 100) room.messages.shift();
    io.to(id).emit("chat-message", message);
  });

  socket.on("disconnect", () => leaveCurrentRoom(socket));
});

server.listen(PORT, "0.0.0.0", () => console.log("Only Lies Chat listening on " + PORT));
