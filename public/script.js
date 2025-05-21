const base = "https://mentora-ai.onrender.com";
// const base = "http://localhost:5000";


// === Récupération des éléments du DOM ===
const toggleBtn = document.getElementById("toggle-btn");
const sidebar = document.getElementById("sidebar");
const chatBox = document.getElementById("chatBox");
const historyList = document.getElementById("history");
const userInput = document.getElementById("userInput");
const niveauSelect = document.getElementById("niveau");

let chatHistory = JSON.parse(localStorage.getItem("chatHistory")) || [];
let currentChatId = localStorage.getItem("currentChatId") || null;

// === Toggle sidebar ===
toggleBtn.addEventListener("click", () => {
  sidebar.classList.toggle("active");
});

// === Au chargement de la page ===
window.onload = () => {
  if (chatHistory.length === 0) {
    newChat();
  } else {
    if (!currentChatId || !chatHistory.find(c => c.id === currentChatId)) {
      currentChatId = chatHistory[0].id;
    }
    updateSidebar();
    loadChat(currentChatId);
  }
};

// === Crée une nouvelle session de chat ===
function newChat() {
  const newId = Date.now().toString();
  const newChat = {
    id: newId,
    title: "", // Le titre sera défini après le 1er message
    messages: [],
  };
  chatHistory.unshift(newChat);
  currentChatId = newId;
  saveData();
  updateSidebar();
  loadChat(newId);
  if (window.innerWidth <= 768) {
    sidebar.classList.remove("active");
  }
}

// === Met à jour la sidebar avec les sessions ===
function updateSidebar() {
  historyList.innerHTML = "";
  chatHistory.forEach((chat) => {
    const li = document.createElement("li");
    li.innerText = chat.title || "Session sans titre";
    li.classList.toggle("active", chat.id === currentChatId);

    li.onclick = () => {
      loadChat(chat.id);
      if (window.innerWidth <= 768) {
        sidebar.classList.remove("active");
      }
    };

    const delBtn = document.createElement("button");
    delBtn.innerText = "×";
    delBtn.classList.add("delete-btn");
    delBtn.title = "Supprimer cette session";
    delBtn.onclick = (e) => {
      e.stopPropagation();
      deleteChat(chat.id);
    };

    li.appendChild(delBtn);
    historyList.appendChild(li);
  });
}

// === Charge une session de chat ===
function loadChat(id) {
  currentChatId = id;
  const chat = chatHistory.find((c) => c.id === id);
  if (!chat) return;
  chatBox.innerHTML = "";
  chat.messages.forEach(({ sender, text }) => {
    displayMessage(sender, text);
  });
  saveData();
  updateSidebar();
  scrollToBottom();
}

// === Sauvegarde l'historique et la session courante dans localStorage ===
function saveData() {
  localStorage.setItem("chatHistory", JSON.stringify(chatHistory));
  localStorage.setItem("currentChatId", currentChatId);
}

// === Supprime une session de chat ===
function deleteChat(id) {
  chatHistory = chatHistory.filter((chat) => chat.id !== id);
  if (currentChatId === id) {
    currentChatId = chatHistory.length > 0 ? chatHistory[0].id : null;
  }
  saveData();
  updateSidebar();
  if (currentChatId) {
    loadChat(currentChatId);
  } else {
    chatBox.innerHTML = "";
  }
}

// === Affiche un message dans la boîte de chat ===
function displayMessage(sender, text) {
  const div = document.createElement("div");
  div.classList.add("message", sender);
  if (sender === "bot" && text === "typing") {
    div.classList.add("typing");
    div.innerText = "Assistant IA est en train d’écrire...";
  } else {
    div.innerText = text;
  }
  chatBox.appendChild(div);
  scrollToBottom();
}

// === Scroll vers le bas pour afficher le dernier message ===
function scrollToBottom() {
  chatBox.scrollTop = chatBox.scrollHeight;
}

// === Gère l'appui sur la touche Entrée pour envoyer le message ===
function handleKeyPress(e) {
  if (e.key === "Enter" && !e.shiftKey) {
    e.preventDefault();
    sendMessage();
  }
}

// === Envoie le message utilisateur au backend et gère la réponse ===
async function sendMessage() {
  const userMessage = userInput.value.trim();
  if (!userMessage) return;

  if (!currentChatId) newChat();
  const chat = chatHistory.find((c) => c.id === currentChatId);

  // === Met à jour le titre si c'est le premier message
  if (chat.messages.length === 0) {
    const titleFromMessage = userMessage.split(" ").slice(0, 4).join(" ");
    chat.title = titleFromMessage.charAt(0).toUpperCase() + titleFromMessage.slice(1);
    updateSidebar();
  }

  // === Affiche le message utilisateur
  displayMessage("user", userMessage);
  chat.messages.push({ sender: "user", text: userMessage });
  saveData();

  userInput.value = "";

  // === Affiche le message "typing"
  displayMessage("bot", "typing");

  try {
    const response = await fetch(`${base}/api/chat`
, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        sessionId: currentChatId,
        userMessage: userMessage,
        niveau: niveauSelect.value,
      }),
    });

    if (!response.ok) throw new Error("Erreur réseau");

    const data = await response.json();

    // Supprime "typing"
    const typingMsg = document.querySelector(".bot.typing");
    if (typingMsg) typingMsg.remove();

    // Affiche la réponse du bot
    displayMessage("bot", data.result);
    chat.messages.push({ sender: "bot", text: data.result });
    saveData();
  } catch (error) {
    const typingMsg = document.querySelector(".bot.typing");
    if (typingMsg) typingMsg.remove();

    displayMessage("bot", "❌ Une erreur est survenue. Réessaie plus tard.");
    console.error("Erreur API :", error);
  }
}
