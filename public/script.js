const base = window.location.hostname === "localhost"
  ? "http://localhost:5000"
  : "https://mentora-ai.onrender.com";

// === Récupération des éléments du DOM ===
const toggleBtn = document.getElementById("toggle-btn");
const sidebar = document.getElementById("sidebar");
const chatBox = document.getElementById("chatBox");
const historyList = document.getElementById("history");
const userInput = document.getElementById("userInput");

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
    title: "",
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

// === Met à jour la sidebar ===
function updateSidebar() {
  historyList.innerHTML = "";
  chatHistory.forEach((chat) => {
    const li = document.createElement("li");
    li.classList.toggle("active", chat.id === currentChatId);

    const span = document.createElement("span");
    span.textContent = chat.title || "Session sans titre";
    span.classList.add("chat-title");

    // === Renommage au double-clic ===
    span.ondblclick = () => {
      const input = document.createElement("input");
      input.type = "text";
      input.value = span.textContent;
      input.classList.add("rename-input");
      li.replaceChild(input, span);
      input.focus();

      input.onblur = () => {
        const newTitle = input.value.trim() || "Session sans titre";
        chat.title = newTitle;
        saveData();
        updateSidebar();
      };

      input.onkeydown = (e) => {
        if (e.key === "Enter") input.blur();
      };
    };

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

    li.appendChild(span);
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

// === Sauvegarde les données ===
function saveData() {
  localStorage.setItem("chatHistory", JSON.stringify(chatHistory));
  localStorage.setItem("currentChatId", currentChatId);
}

// === Supprime une session ===
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

// === Affiche un message dans le chat ===
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

// === Scroll en bas ===
function scrollToBottom() {
  chatBox.scrollTop = chatBox.scrollHeight;
}

// === Gère la touche entrée ===
function handleKeyPress(e) {
  if (e.key === "Enter" && !e.shiftKey) {
    e.preventDefault();
    sendMessage();
  }
}

// === Envoie un message et reçoit la réponse du backend ===
async function sendMessage() {
  const userMessage = userInput.value.trim();
  if (!userMessage) return;

  if (!currentChatId) newChat();
  const chat = chatHistory.find((c) => c.id === currentChatId);

  if (chat.messages.length === 0) {
    const titleFromMessage = userMessage.split(" ").slice(0, 4).join(" ");
    chat.title = titleFromMessage.charAt(0).toUpperCase() + titleFromMessage.slice(1);
    updateSidebar();
  }

  displayMessage("user", userMessage);
  chat.messages.push({ sender: "user", text: userMessage });
  saveData();

  userInput.value = "";
  displayMessage("bot", "typing");

  try {
    const response = await fetch(`${base}/api/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        sessionId: currentChatId,
        userMessage: userMessage
      }),
    });

    if (!response.ok) throw new Error("Erreur réseau");

    const data = await response.json();

    const typingMsg = document.querySelector(".bot.typing");
    if (typingMsg) typingMsg.remove();

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

// Sur mobile : ajuste la vue quand le clavier s'affiche
window.addEventListener("resize", () => {
  const chatInput = document.querySelector(".chat-input");
  const chatBox = document.querySelector(".chat-box");
  if (window.innerHeight < 500) {
    chatInput.scrollIntoView({ behavior: "smooth", block: "end" });
  }
});
