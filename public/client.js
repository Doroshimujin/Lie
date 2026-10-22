const socket = io();
const entry = document.getElementById("entry");
const chat = document.getElementById("chat");
const nickname = document.getElementById("nickname");
const roomCode = document.getElementById("roomCode");
const entryError = document.getElementById("entryError");
const messages = document.getElementById("messages");
let activeRoom = "";

function showError(message) { entryError.textContent = message || ""; }
function showJoinedRoom(result) {
  activeRoom = result.code;
  document.getElementById("activeCode").textContent = result.label || result.code;
  entry.classList.add("hidden");
  chat.classList.remove("hidden");
  messages.replaceChildren();
  document.getElementById("messageInput").focus();
}
function joinRandomRoom() {
  showError("");
  socket.emit("join-random-room", { name: nickname.value }, (result) => {
    if (!result || !result.ok) {
      showError(result?.error || "Could not find a room. Please try again.");
      return;
    }
    showJoinedRoom(result);
  });
}
function joinRoom(code) {
  showError("");
  socket.emit("join-room", { code, name: nickname.value }, (result) => {
    if (!result || !result.ok) {
      showError(result?.error || "Could not join. Try again.");
      return;
    }
    showJoinedRoom(result);
  });
}
document.getElementById("createBtn").addEventListener("click", joinRandomRoom);
document.getElementById("joinBtn").addEventListener("click", () => joinRoom(roomCode.value));
roomCode.addEventListener("keydown", (event) => { if (event.key === "Enter") joinRoom(roomCode.value); });
roomCode.addEventListener("input", () => { roomCode.value = roomCode.value.toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 20); });
document.getElementById("messageForm").addEventListener("submit", (event) => {
  event.preventDefault();
  const input = document.getElementById("messageInput");
  const value = input.value.trim();
  if (!value) return;
  socket.emit("chat-message", value.slice(0, 400));
  input.value = "";
  input.focus();
});
document.getElementById("leaveBtn").addEventListener("click", () => location.reload());
document.getElementById("copyBtn").addEventListener("click", async () => {
  try {
    await navigator.clipboard.writeText(activeRoom);
    document.getElementById("copyBtn").textContent = "Copied!";
  } catch {
    document.getElementById("copyBtn").textContent = activeRoom;
  }
});
socket.on("chat-history", (history) => { messages.replaceChildren(); history.forEach(addMessage); });
socket.on("chat-message", addMessage);
socket.on("system-message", (text) => {
  const el = document.createElement("div");
  el.className = "system";
  el.textContent = text;
  messages.appendChild(el);
  messages.scrollTop = messages.scrollHeight;
});
socket.on("room-count", (count) => {
  document.getElementById("roomCount").textContent = count + "/10 people";
});
function addMessage(message) {
  const bubble = document.createElement("div");
  bubble.className = "bubble";
  const name = document.createElement("div");
  name.className = "name";
  name.textContent = message.name || "Mystery";
  const body = document.createElement("div");
  body.className = "text";
  body.textContent = message.text || "";
  bubble.append(name, body);
  messages.appendChild(bubble);
  messages.scrollTop = messages.scrollHeight;
}
