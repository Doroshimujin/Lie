const socket = io();
const entry = document.getElementById("entry");
const chat = document.getElementById("chat");
const nickname = document.getElementById("nickname");
const roomCode = document.getElementById("roomCode");
const entryError = document.getElementById("entryError");
const messages = document.getElementById("messages");
let activeRoom = "";

function showError(message) { entryError.textContent = message || ""; }
function joinRoom(code) {
  showError("");
  socket.emit("join-room", { code, name: nickname.value }, (result) => {
    if (!result || !result.ok) { showError(result?.error || "Could not join. Try again."); return; }
    activeRoom = result.code;
    document.getElementById("activeCode").textContent = activeRoom;
    entry.classList.add("hidden");
    chat.classList.remove("hidden");
    messages.replaceChildren();
    document.getElementById("messageInput").focus();
  });
}
document.getElementById("createBtn").addEventListener("click", () => {
  socket.emit("create-room", (result) => {
    if (result?.ok) joinRoom(result.code);
    else showError("Could not create a room. Please try again.");
  });
});
document.getElementById("joinBtn").addEventListener("click", () => joinRoom(roomCode.value));
roomCode.addEventListener("keydown", (event) => { if (event.key === "Enter") joinRoom(roomCode.value); });
roomCode.addEventListener("input", () => { roomCode.value = roomCode.value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 5); });
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
  try { await navigator.clipboard.writeText(activeRoom); document.getElementById("copyBtn").textContent = "Copied!"; }
  catch { document.getElementById("copyBtn").textContent = activeRoom; }
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
socket.on("room-count", (count) => { document.getElementById("roomCount").textContent = count + (count === 1 ? " person" : " people"); });
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
