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
  initScrollIndicator();
};

// === Scroll Indicator ===
function initScrollIndicator() {
  const indicator = document.getElementById('scrollIndicator');
  const chatBox = document.getElementById('chatBox');
  if (!indicator || !chatBox) return;

  const segmentCount = 12;
  indicator.innerHTML = '';
  for (let i = 0; i < segmentCount; i++) {
    const seg = document.createElement('div');
    seg.classList.add('scroll-segment');
    indicator.appendChild(seg);
  }

  function updateIndicator() {
    const segments = indicator.querySelectorAll('.scroll-segment');
    const maxScroll = chatBox.scrollHeight - chatBox.clientHeight;
    if (maxScroll <= 0) {
      segments.forEach(seg => seg.classList.remove('active'));
      return;
    }
    const scrollPercent = chatBox.scrollTop / maxScroll;
    const activeIndex = Math.min(
      Math.floor(scrollPercent * segmentCount),
      segmentCount - 1
    );
    segments.forEach((seg, i) => {
      seg.classList.toggle('active', i === activeIndex);
    });
  }

  chatBox.addEventListener('scroll', updateIndicator);
  // Observer les mutations pour mettre a jour quand le contenu change
  const observer = new MutationObserver(updateIndicator);
  observer.observe(chatBox, { childList: true, subtree: true });
}

// === Crée une nouvelle session de chat ===
function newChat() {
  const newId = Date.now().toString();
  const welcomeMessage = "===STICKER:salutations===\n\nBonjour champion !\nQue souhaites-tu apprendre aujourd'hui ?";
  const newChat = {
    id: newId,
    title: "",
    messages: [{ sender: "bot", text: welcomeMessage }],
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

    // Renommage au double-clic
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
    delBtn.innerHTML = '<img src="supprimer.svg" alt="Supprimer" />';
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

  chatBox.classList.toggle("empty", chat.messages.length === 0);

  setTimeout(() => {
    updateChatBoxHeight();
    scrollToBottom();
  }, 50);
}

// === Sauvegarde les données ===
function saveData() {
  localStorage.setItem("chatHistory", JSON.stringify(chatHistory));
  localStorage.setItem("currentChatId", currentChatId);
}

// === Supprime une session ===
function deleteChat(id) {
  chatHistory = chatHistory.filter((chat) => chat.id !== id);
  clearNiveauForChat(id);
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

// === Affiche un message dans le chat (sans scroll automatique) ===
function displayMessage(sender, text) {
  if (sender === "bot" && text !== "typing") {
    const sommairePattern = /={3,}\s*SOMMAIRE\s*={3,}[\r\n]*([\s\S]*?)[\r\n]*={3,}\s*FIN\s*SOMMAIRE\s*={3,}/i;
    if (sommairePattern.test(text)) {
      console.log("[DEBUG] Sommaire detecte");
      return displaySommaireMessage(text);
    }

    // Detection souple des chapitres : cherche **Chapitre X** ou ===CHAPITRE===
    if (/\*\*Chapitre\s+\d+/i.test(text) || /={3,}\s*CHAPITRE\s*={3,}/i.test(text)) {
      console.log("[DEBUG] Chapitre detecte dans le texte");
      return displayChapitreMessage(text);
    }

    // Detection des QCM
    const qcmPattern = /={3,}\s*QCM\s*={3,}[\r\n]*([\s\S]*?)[\r\n]*={3,}\s*FIN\s*QCM\s*={3,}/i;
    if (qcmPattern.test(text)) {
      console.log("[DEBUG] QCM detecte");
      return displayQCMMessage(text);
    }

    console.log("[DEBUG] Pas de sommaire ni chapitre ni QCM detecte");
  }

  const div = document.createElement("div");
  div.classList.add("message", sender);

  if (sender === "bot" && text === "typing") {
    div.classList.add("typing");
    div.innerText = "Assistant IA est en train d’écrire...";
  } else {
    // Nettoyage final des symboles markdown residuels
    let cleanText = text;
    cleanText = cleanText.replace(/\*\*/g, '');
    cleanText = cleanText.replace(/\*(?=\s)/g, '');
    cleanText = cleanText.replace(/^\s*={3,}\s*$/gm, '');
    cleanText = cleanText.replace(/\n{3,}/g, '\n\n');

    // Detection STICKER
    const stickerPattern = /={3,}\s*STICKER\s*:\s*(\w+)\s*={3,}/i;
    const stickerMatch = cleanText.match(stickerPattern);
    if (stickerMatch) {
      cleanText = cleanText.replace(stickerPattern, '').trim();
      const stickerImg = document.createElement('img');
      stickerImg.src = `${stickerMatch[1]}.png`;
      stickerImg.alt = 'Sticker';
      stickerImg.classList.add('sticker-img');
      div.appendChild(stickerImg);
    }

    const textSpan = document.createElement('span');
    textSpan.innerText = cleanText;
    div.appendChild(textSpan);
  }

  chatBox.appendChild(div);

  // Supprime la classe empty si un message est ajouté
  if (chatBox.classList.contains("empty")) {
    chatBox.classList.remove("empty");
  }

  updateChatBoxHeight();
  // On ne scroll pas ici pour éviter le scroll sur message utilisateur
}

function parseSommaire(raw) {
  console.log("[DEBUG] parseSommaire raw:", JSON.stringify(raw));
  const lines = raw.trim().split(/\r?\n/);
  const result = [];
  let current = null;
  let expectTitle = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();
    if (!trimmed) continue;

    // Ignorer la ligne "SOMMAIRE" seule
    if (trimmed.toUpperCase() === 'SOMMAIRE' && !current) continue;

    // Format : "1. Introduction" (numero + titre sur la meme ligne)
    const sectionMatch = trimmed.match(/^(\d+)\.\s*(.+)$/);
    if (sectionMatch) {
      if (current) result.push(current);
      current = { numero: sectionMatch[1], titre: sectionMatch[2], description: '' };
      expectTitle = false;
      continue;
    }

    // Format ancien : "1" seul sur une ligne
    const numOnlyMatch = trimmed.match(/^(\d+)$/);
    if (numOnlyMatch && !expectTitle) {
      if (current) result.push(current);
      current = { numero: numOnlyMatch[1], titre: '', description: '' };
      expectTitle = true;
      continue;
    }

    if (expectTitle && current) {
      current.titre = trimmed;
      expectTitle = false;
      continue;
    }

    // Description : tout texte apres le titre (ancien format tiret ou texte libre)
    if (current) {
      const desc = trimmed.replace(/^[-\*]\s*/, '');
      current.description += (current.description ? ' ' : '') + desc;
    }
  }

  if (current) result.push(current);

  // Fallback format pipe
  if (result.length === 0 || result.every(s => !s.titre)) {
    const pipeLines = lines.filter(l => l.includes('|'));
    if (pipeLines.length > 0) {
      return pipeLines.map(line => {
        const parts = line.split('|');
        return {
          numero: parts[0]?.trim() || '',
          titre: parts[1]?.trim() || '',
          description: parts[2]?.trim() || ''
        };
      });
    }
  }

  console.log("[DEBUG] parseSommaire result:", result);
  return result;
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

function buildSommaireHTML(data) {
  const palette = ['#c8eef0', '#f5d0a0', '#c5c8f0', '#f0c5d0', '#d0f0c5'];

  const itemsHtml = data.map((item, index) => {
    const color = palette[index % palette.length];
    return `
    <div class="theme-item">
      <div class="theme-header" style="background: ${color}">
        <div class="theme-numero">${item.numero}</div>
        <div class="theme-titre">${escapeHtml(item.titre)}</div>
      </div>
      <div class="theme-description">
        ${escapeHtml(item.description)}
      </div>
    </div>
  `;
  }).join('');

  return `
    <div class="themes-abordes">
      <div class="themes-header">
        <h2>THÈMES ABORDÉS</h2>
      </div>
      <div class="themes-body">
        ${itemsHtml}
      </div>
    </div>
  `;
}

function displaySommaireMessage(text) {
  const pattern = /={3,}\s*SOMMAIRE\s*={3,}[\r\n]*([\s\S]*?)[\r\n]*={3,}\s*FIN\s*SOMMAIRE\s*={3,}/i;
  const match = text.match(pattern);
  console.log("[DEBUG] text length:", text.length, "preview:", text.substring(0, 200));
  if (!match) {
    console.log("[DEBUG] pas de match sur ===SOMMAIRE===");
    return;
  }
  console.log("[DEBUG] Sommaire extrait:", match[1].substring(0, 100));

  let beforeText = text.substring(0, match.index).trim();
  let afterText = text.substring(match.index + match[0].length).trim();
  beforeText = beforeText.replace(/\*\*/g, '').replace(/\n{3,}/g, '\n\n');
  afterText = afterText.replace(/\*\*/g, '').replace(/\n{3,}/g, '\n\n');

  if (beforeText) {
    const div = document.createElement("div");
    div.classList.add("message", "bot");
    div.innerText = beforeText;
    chatBox.appendChild(div);
  }

  const sommaireData = parseSommaire(match[1]);
  let sommaireHtml;
  if (sommaireData.length === 0 || sommaireData.every(s => !s.titre)) {
    sommaireHtml = `<pre class="sommaire-raw">${escapeHtml(match[1])}</pre>`;
  } else {
    sommaireHtml = buildSommaireHTML(sommaireData);
  }
  const sommaireDiv = document.createElement("div");
  sommaireDiv.classList.add("message", "bot", "sommaire-message");
  sommaireDiv.innerHTML = sommaireHtml;
  chatBox.appendChild(sommaireDiv);

  if (afterText) {
    const div = document.createElement("div");
    div.classList.add("message", "bot");
    div.innerText = afterText;
    chatBox.appendChild(div);
  }

  if (chatBox.classList.contains("empty")) {
    chatBox.classList.remove("empty");
  }
  updateChatBoxHeight();
  displaySommaireActions();
}

function displaySommaireActions() {
  const actionsDiv = document.createElement("div");
  actionsDiv.classList.add("message", "bot", "sommaire-actions");

  const btnCommencons = document.createElement("button");
  btnCommencons.textContent = "Commençons";
  btnCommencons.classList.add("sommaire-action-btn", "btn-commencons");
  btnCommencons.onclick = () => {
    actionsDiv.remove();
    const niveau = getNiveauForChat(currentChatId);
    sendToBackend("Commençons", niveau);
  };

  const btnDesaccord = document.createElement("button");
  btnDesaccord.textContent = "Je ne suis pas d'accord";
  btnDesaccord.classList.add("sommaire-action-btn", "btn-desaccord");
  btnDesaccord.onclick = () => {
    actionsDiv.remove();
    const niveau = getNiveauForChat(currentChatId);
    sendToBackend("Je ne suis pas d'accord", niveau);
  };

  actionsDiv.appendChild(btnCommencons);
  actionsDiv.appendChild(btnDesaccord);
  chatBox.appendChild(actionsDiv);

  if (chatBox.classList.contains("empty")) {
    chatBox.classList.remove("empty");
  }
  updateChatBoxHeight();
  setTimeout(() => scrollToBottom(), 50);
}

function displayComprehensionActions() {
  const actionsDiv = document.createElement("div");
  actionsDiv.classList.add("message", "bot", "comprehension-actions");

  const btnCompris = document.createElement("button");
  btnCompris.textContent = "✅ J'ai compris";
  btnCompris.classList.add("comprehension-btn", "btn-compris");
  btnCompris.onclick = () => {
    actionsDiv.remove();
    const niveau = getNiveauForChat(currentChatId);
    sendToBackend("J'ai compris", niveau);
  };

  const btnPasCompris = document.createElement("button");
  btnPasCompris.textContent = "❌ Je n'ai pas compris";
  btnPasCompris.classList.add("comprehension-btn", "btn-pas-compris");
  btnPasCompris.onclick = () => {
    actionsDiv.remove();
    const niveau = getNiveauForChat(currentChatId);
    sendToBackend("Je n'ai pas compris", niveau);
  };

  const btnQuestion = document.createElement("button");
  btnQuestion.textContent = "❓ Poser une question";
  btnQuestion.classList.add("comprehension-btn", "btn-question");
  btnQuestion.onclick = () => {
    actionsDiv.remove();
    const niveau = getNiveauForChat(currentChatId);
    sendToBackend("Poser une question", niveau);
  };

  actionsDiv.appendChild(btnCompris);
  actionsDiv.appendChild(btnPasCompris);
  actionsDiv.appendChild(btnQuestion);
  chatBox.appendChild(actionsDiv);

  if (chatBox.classList.contains("empty")) {
    chatBox.classList.remove("empty");
  }
  updateChatBoxHeight();
  setTimeout(() => scrollToBottom(), 50);
}

function parseChapitre(raw) {
  const lines = raw.trim().split(/\r?\n/).filter(l => l.trim());
  // Extraire seulement les 3 premieres lignes (badge, titre, sous-titre)
  const badge = lines[0]?.trim() || '';
  const titre = lines[1]?.trim() || '';
  const sousTitre = lines[2]?.trim() || '';
  return { badge, titre, sousTitre };
}

function buildChapitreHTML(data) {
  return `
    <div class="chapitre-cours">
      <div class="chapitre-badge">${escapeHtml(data.badge)}</div>
      <h2 class="chapitre-titre">${escapeHtml(data.titre)}</h2>
      <div class="chapitre-section chapitre-sous-titre">
        <span class="section-label">Objectif</span>
        ${escapeHtml(data.sousTitre)}
      </div>
    </div>
  `;
}

function displayChapitreMessage(text) {
  // 1. Extraire le texte avant/apres les balises ===CHAPITRE===
  const chapitrePattern = /={3,}\s*CHAPITRE\s*={3,}[\r\n]*([\s\S]*?)[\r\n]*={3,}\s*FIN\s*CHAPITRE\s*={3,}/i;
  const match = text.match(chapitrePattern);

  if (!match) {
    // Fallback : afficher le texte brut nettoye
    const cleanText = text.replace(/\*\*/g, '').replace(/\n{3,}/g, '\n\n');
    const div = document.createElement("div");
    div.classList.add("message", "bot");
    div.innerText = cleanText;
    chatBox.appendChild(div);
    updateChatBoxHeight();
    return;
  }

  let beforeText = text.substring(0, match.index).trim();
  let afterText = text.substring(match.index + match[0].length).trim();
  beforeText = beforeText.replace(/\*\*/g, '').replace(/\n{3,}/g, '\n\n');
  afterText = afterText.replace(/\*\*/g, '').replace(/\n{3,}/g, '\n\n');

  // 2. Afficher le texte avant (si present)
  if (beforeText) {
    const div = document.createElement("div");
    div.classList.add("message", "bot");
    div.innerText = beforeText;
    chatBox.appendChild(div);
  }

  // 3. Parser le contenu du chapitre (3 lignes : badge, titre, sous-titre)
  const chapitreData = parseChapitre(match[1]);
  const chapitreHtml = buildChapitreHTML(chapitreData);
  const chapitreDiv = document.createElement("div");
  chapitreDiv.classList.add("message", "bot", "chapitre-message");
  chapitreDiv.innerHTML = chapitreHtml;
  chatBox.appendChild(chapitreDiv);

  // 4. Afficher le texte apres (si present)
  if (afterText) {
    const div = document.createElement("div");
    div.classList.add("message", "bot");
    div.innerText = afterText;
    chatBox.appendChild(div);
  }

  if (chatBox.classList.contains("empty")) {
    chatBox.classList.remove("empty");
  }
  updateChatBoxHeight();
  displayComprehensionActions();
}

// === QCM ===
function parseQCM(raw) {
  const lines = raw.trim().split(/\r?\n/).map(l => l.trim()).filter(Boolean);
  let question = '';
  const options = [];
  let reponse = '';
  let questionFound = false;

  for (const line of lines) {
    // Label explicite "Question :" (si present)
    const qMatch = line.match(/^Question\s*[:\-]?\s*(.+)$/i);
    if (qMatch) {
      question = qMatch[1];
      questionFound = true;
      continue;
    }
    // Options A, B, C, D
    const optMatch = line.match(/^([A-D])\s*[:\-\.]\s*(.+)$/i);
    if (optMatch) {
      options.push({ lettre: optMatch[1].toUpperCase(), texte: optMatch[2] });
      continue;
    }
    // Reponse (sans $ strict, accepte accent ou pas)
    const repMatch = line.match(/^R[eé]ponse\s*[:\-]?\s*([A-D])/i);
    if (repMatch) {
      reponse = repMatch[1].toUpperCase();
      continue;
    }
    // Si pas de label "Question" trouve, la premiere ligne non-option est la question
    if (!questionFound && !question) {
      question = line;
    }
  }

  return { question, options, reponse };
}

function buildQCMHTML(data) {
  const optionsHtml = data.options.map(opt => `
    <button class="qcm-option" data-lettre="${opt.lettre}">
      <div class="qcm-badge">${opt.lettre}</div>
      <div class="qcm-option-text">${escapeHtml(opt.texte)}</div>
    </button>
  `).join('');

  return `
    <div class="qcm-container">
      <div class="qcm-header">
        <h3>Question de vérification</h3>
        <p>Choisis la bonne réponse pour valider ta compréhension</p>
      </div>
      <div class="qcm-question">${escapeHtml(data.question)}</div>
      <div class="qcm-options">
        ${optionsHtml}
      </div>
    </div>
  `;
}

function displayQCMMessage(text) {
  const qcmPattern = /={3,}\s*QCM\s*={3,}[\r\n]*([\s\S]*?)[\r\n]*={3,}\s*FIN\s*QCM\s*={3,}/i;
  const match = text.match(qcmPattern);
  if (!match) return;

  let beforeText = text.substring(0, match.index).trim();
  let afterText = text.substring(match.index + match[0].length).trim();
  beforeText = beforeText.replace(/\*\*/g, '').replace(/\n{3,}/g, '\n\n');
  afterText = afterText.replace(/\*\*/g, '').replace(/\n{3,}/g, '\n\n');

  if (beforeText) {
    const div = document.createElement("div");
    div.classList.add("message", "bot");
    div.innerText = beforeText;
    chatBox.appendChild(div);
  }

  const qcmData = parseQCM(match[1]);
  console.log("[DEBUG QCM] question:", qcmData.question, "reponse:", qcmData.reponse, "options:", qcmData.options.map(o => o.lettre));
  if (!qcmData.reponse) {
    console.warn("[WARN] Reponse QCM non trouvee dans le texte parse");
  }
  if (qcmData.question && qcmData.options.length > 0) {
    const qcmHtml = buildQCMHTML(qcmData);
    const qcmDiv = document.createElement("div");
    qcmDiv.classList.add("message", "bot", "qcm-message");
    qcmDiv.innerHTML = qcmHtml;
    chatBox.appendChild(qcmDiv);

    // Gerer les clics sur les options
    const optionBtns = qcmDiv.querySelectorAll('.qcm-option');
    optionBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        const lettre = btn.dataset.lettre;
        const isCorrect = lettre === qcmData.reponse;
        // Desactiver tous les boutons
        optionBtns.forEach(b => b.disabled = true);
        // Marquer visuellement la reponse
        btn.classList.add(isCorrect ? 'selected-correct' : 'selected-wrong');
        // Afficher la modale
        showQCMModal(isCorrect);
        // Envoyer la reponse au backend
        const niveau = getNiveauForChat(currentChatId);
        sendToBackend(`Reponse QCM : ${lettre}`, niveau);
      });
    });
  }

  if (afterText) {
    const div = document.createElement("div");
    div.classList.add("message", "bot");
    div.innerText = afterText;
    chatBox.appendChild(div);
  }

  if (chatBox.classList.contains("empty")) {
    chatBox.classList.remove("empty");
  }
  updateChatBoxHeight();
}

// === Modale QCM ===
function showQCMModal(isCorrect) {
  const modal = document.getElementById('qcmModal');
  const icon = document.getElementById('qcmModalIcon');
  const title = document.getElementById('qcmModalTitle');
  const text = document.getElementById('qcmModalText');
  const btn = document.getElementById('qcmModalBtn');

  if (!modal || !icon || !title || !text || !btn) return;

  modal.classList.remove('hidden', 'success', 'error');
  modal.classList.add(isCorrect ? 'success' : 'error');

  if (isCorrect) {
    icon.src = 'gagner.png';
    icon.alt = 'Reussite';
    title.textContent = 'Bravo !';
    text.textContent = 'Bonne reponse';
    btn.textContent = 'Continuer';
    btn.onclick = () => {
      modal.classList.add('hidden');
    };
    // Fermeture auto apres 3s
    setTimeout(() => {
      if (!modal.classList.contains('hidden')) {
        modal.classList.add('hidden');
      }
    }, 3000);
  } else {
    icon.src = 'mauvais.png';
    icon.alt = 'Erreur';
    title.textContent = 'Ce n\'est pas la bonne reponse';
    text.textContent = 'Ne te decourage pas, chaque erreur est une occasion d\'apprendre !';
    btn.textContent = 'Je vais reessayer';
    btn.onclick = () => {
      modal.classList.add('hidden');
    };
  }
}

// === Scroll en bas ===
function scrollToBottom() {
  chatBox.scrollTop = chatBox.scrollHeight;
}

// === Met à jour la hauteur du chat box ===
function updateChatBoxHeight() {
  if (chatBox.classList.contains("empty")) {
    chatBox.style.maxHeight = "150px";
  } else {
    chatBox.style.maxHeight = "";
    chatBox.style.height = "auto";
  }
}

// === Gère la touche entrée ===
function handleKeyPress(e) {
  if (e.key === "Enter" && !e.shiftKey) {
    e.preventDefault();
    sendMessage();
  }
}

function getNiveauForChat(chatId) {
  return localStorage.getItem(`niveau_${chatId}`);
}

function setNiveauForChat(chatId, niveau) {
  localStorage.setItem(`niveau_${chatId}`, niveau);
}

function clearNiveauForChat(chatId) {
  localStorage.removeItem(`niveau_${chatId}`);
}

// === Affiche les boutons de sélection du niveau ===
function displayNiveauSelector(sujet) {
  const niveaux = ["Primaire", "Collège", "Lycée"];

  const container = document.createElement("div");
  container.classList.add("message", "bot", "niveau-selector");

  const title = document.createElement("h3");
  title.textContent = "Quel est ton niveau d'études ?";
  title.classList.add("niveau-title");
  container.appendChild(title);

  const buttonsDiv = document.createElement("div");
  buttonsDiv.classList.add("niveau-buttons");

  niveaux.forEach((niveau) => {
    const btn = document.createElement("button");
    btn.textContent = niveau;
    btn.classList.add("niveau-btn");
    btn.onclick = () => {
      btn.classList.add("selected");
      setTimeout(() => selectNiveau(sujet, niveau, container), 180);
    };
    buttonsDiv.appendChild(btn);
  });

  container.appendChild(buttonsDiv);
  chatBox.appendChild(container);

  // Supprime la classe empty si présente
  if (chatBox.classList.contains("empty")) {
    chatBox.classList.remove("empty");
  }

  updateChatBoxHeight();
  setTimeout(() => {
    scrollToBottom();
  }, 50);
}

// === Gère la sélection du niveau ===
async function selectNiveau(sujet, niveau, selectorElement) {
  if (!currentChatId) return;

  // Retire le sélecteur
  if (selectorElement && selectorElement.parentNode) {
    selectorElement.remove();
  }

  setNiveauForChat(currentChatId, niveau);

  const chat = chatHistory.find((c) => c.id === currentChatId);

  // Affiche le niveau choisi comme message bot
  const confirmation = `Merci ! Je vais adapter mes explications pour un niveau ${niveau.toLowerCase()}.`;
  displayMessage("bot", confirmation);
  chat.messages.push({ sender: "bot", text: confirmation });
  saveData();

  await sendToBackend(sujet, niveau);
}

// === Envoie un message au backend ===
async function sendToBackend(userMessage, niveau = null) {
  const chat = chatHistory.find((c) => c.id === currentChatId);

  displayMessage("bot", "typing");

  try {
    // Construire l'historique pour le backend (exclure typing et messages system)
    const history = chat.messages
      .filter((m) => m.text !== "typing")
      .map((m) => ({
        role: m.sender === "bot" ? "assistant" : "user",
        content: m.text,
      }));

    const payload = {
      sessionId: currentChatId,
      userMessage: userMessage,
      history: history,
    };
    if (niveau) payload.niveau = niveau;

    const response = await fetch(`${base}/api/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (!response.ok) throw new Error("Erreur réseau");

    const data = await response.json();

    const typingMsg = document.querySelector(".bot.typing");
    if (typingMsg) typingMsg.remove();

    displayMessage("bot", data.result);
    chat.messages.push({ sender: "bot", text: data.result });
    saveData();

    setTimeout(() => {
      scrollToBottom();
    }, 50);
  } catch (error) {
    const typingMsg = document.querySelector(".bot.typing");
    if (typingMsg) typingMsg.remove();

    displayMessage("bot", "❌ Une erreur est survenue. Réessaie plus tard.");
    console.error("Erreur API :", error);

    setTimeout(() => {
      scrollToBottom();
    }, 50);
  }
}

// === Envoie un message et reçoit la réponse du backend ===
async function sendMessage() {
  const userMessage = userInput.value.trim();
  if (!userMessage) return;

  if (!currentChatId) newChat();
  const chat = chatHistory.find((c) => c.id === currentChatId);

  // Compte les messages utilisateur réels (hors sélection de niveau)
  const userMsgCount = chat.messages.filter((m) => m.sender === "user").length;

  // Définir le titre à partir du premier message utilisateur
  if (userMsgCount === 0) {
    const titleFromMessage = userMessage.split(" ").slice(0, 4).join(" ");
    chat.title = titleFromMessage.charAt(0).toUpperCase() + titleFromMessage.slice(1);
    updateSidebar();
  }

  displayMessage("user", userMessage);
  chat.messages.push({ sender: "user", text: userMessage });
  saveData();

  userInput.value = "";

  // Vérifier si on doit demander le niveau (premier message et niveau non défini)
  const niveau = getNiveauForChat(currentChatId);
  if (!niveau && userMsgCount === 0) {
    displayNiveauSelector(userMessage);
    return;
  }

  await sendToBackend(userMessage, niveau);
}

// Sur mobile : ajuste la vue quand le clavier s'affiche
window.addEventListener("resize", () => {
  const chatInput = document.querySelector(".chat-input");
  if (window.innerHeight < 500) {
    chatInput.scrollIntoView({ behavior: "smooth", block: "end" });
  }
});





