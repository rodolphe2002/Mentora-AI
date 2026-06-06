const express = require("express");
const cors = require("cors");
const bodyParser = require("body-parser");
const path = require("path");
const fs = require("fs");
require("dotenv").config();

const app = express();
const PORT = process.env.PORT || 5000;

// Fichier de persistance pour le QCM state
const QCM_STATE_FILE = path.join(__dirname, "qcm-state.json");

app.use(cors());
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, "../public")));

const conversations = {}; // clé = sessionId, valeur = tableau de messages
const sessionLevels = {}; // clé = sessionId, valeur = niveau d'études
const sessionQCMState = {}; // clé = sessionId, valeur = { count: 0, bonneReponse: null, enCours: false }

// Charger le QCM state depuis le fichier
function loadQCMState() {
  try {
    if (fs.existsSync(QCM_STATE_FILE)) {
      const data = fs.readFileSync(QCM_STATE_FILE, "utf8");
      const parsed = JSON.parse(data);
      Object.assign(sessionQCMState, parsed);
    }
  } catch (err) {
    console.error("Erreur chargement QCM state:", err);
  }
}

// Sauvegarder le QCM state dans le fichier
function saveQCMState() {
  try {
    fs.writeFileSync(QCM_STATE_FILE, JSON.stringify(sessionQCMState, null, 2), "utf8");
  } catch (err) {
    console.error("Erreur sauvegarde QCM state:", err);
  }
}

// Charger au demarrage
loadQCMState();

function getNiveauInstruction(niveau) {
  const instructions = {
    "Primaire": "L'élève est au primaire. Utilise un langage très simple, des analogies avec la vie quotidienne, des exemples concrets et visuels. Évite tout vocabulaire technique. Sois très encourageante et pédagogue. Utilise des comparaisons avec des objets familiers (bonbons, jeux, animaux, etc.).",
    "Collège": "L'élève est au collège. Utilise des explications claires et accessibles, avec des exemples pertinents et concrets. Introduis progressivement le vocabulaire technique en l'expliquant à chaque fois. Reste bienveillante et encourageante.",
    "Lycée": "L'élève est au lycée. Utilise des explications détaillées avec les notions du programme officiel. Tu peux employer le vocabulaire technique approprié et faire des liens avec les connaissances déjà acquises. Propose des exercices d'application.",
    "Université": "L'élève est à l'université. Utilise des explications complètes et rigoureuses avec le vocabulaire et les concepts avancés du domaine. Tu peux approfondir les aspects théoriques, les démonstrations et les références académiques.",
    "Professionnel": "L'élève est un professionnel. Adapte tes explications à un contexte professionnel et pratique, avec des cas d'usage concrets du monde du travail. Privilégie l'application directe et l'efficacité.",
    "Autre": "Adapte tes explications au niveau et au contexte de l'élève de manière flexible, en ajustant ton langage en fonction de ses réactions et de sa compréhension."
  };
  return instructions[niveau] || instructions["Autre"];
}

function buildSystemPrompt(niveau) {
  const niveauInstruction = niveau ? getNiveauInstruction(niveau) : "";
  const diagnosticStep = niveau
    ? `1. Présentation

Présente-toi brièvement comme Mentora.

Le niveau de l'élève est déjà connu : ${niveau}. Le sujet a été communiqué dans son premier message utilisateur. Tu n'as PAS besoin de redemander ni son niveau ni son sujet.

Adapte tes explications pour un niveau ${niveau}.`
    : `1. Présentation et diagnostic

Présente-toi comme Mentora.

Demande :

"Quel est ton niveau scolaire ou ton niveau de connaissance ? (ex : débutant...)"

"Quel est le sujet ou le thème que tu veux apprendre ou réviser aujourd’hui ?"

Attends la réponse avant de passer à l'étape suivante.`;

  const sommaireStep = niveau
    ? `2. Themes abordes (OBLIGATOIRE avant toute explication)\n\nGenere IMMEDIATEMENT les themes abordes du sujet. N'explique RIEN avant. N'explique RIEN apres.\n\nUtilise EXACTEMENT ce format (respecte les balises et la structure) :\n\n===SOMMAIRE===\n1. Titre de la premiere section\nDescription de la section en une ou deux phrases.\n\n2. Titre de la deuxieme section\nDescription de la section en une ou deux phrases.\n\n3. Titre de la troisieme section\nDescription de la section en une ou deux phrases.\n...\n===FIN SOMMAIRE===\n\nRegles :\n- 5 a 10 sections.\n- Chaque section : numero + titre sur la meme ligne, puis une description courte de 1 a 2 phrases.\n- Saute une ligne entre chaque section.\n- N'ajoute aucun texte avant ===SOMMAIRE===.\n- Apres ===FIN SOMMAIRE===, ecris seulement : "Voici les themes abordes dans ce cours. Est-ce que cela te convient ? Souhaites-tu que je modifie quelque chose avant de commencer ?"`
    : ``;

  const suite = niveau
    ? `3. Cours interactif chapitre par chapitre\n\nPour chaque chapitre du sommaire :\n1. Affiche le numero et le titre du chapitre en gras, par exemple : **Chapitre 1 : Introduction**\n2. Sur la ligne suivante, ecris UNIQUEMENT le titre du chapitre en francais (pas d'anglais).
3. Sur la ligne suivante, ecris l'objectif d'apprentissage en une phrase courte.
5. Explique la notion avec un exemple concret adapte au niveau ${niveau}.\n6. NE POSE PAS de question de comprehension a la fin de l'explication. Les questions sont gerees par un systeme de QCM exterieur.\n7. Attends la reponse de l'eleve.\n8. Passe au chapitre suivant uniquement apres confirmation.\n\n4. Mini quiz de revision\n5 a 10 questions progressives. Corrige immediatement.\n\n5. Bilan personnalise\nResume : ✅ maitrise, ❌ a revoir, 💡 conseils.\nTermine par un encouragement.`
    : `2. Proposition d'un plan\nAnalyse les reponses.\nPropose un plan structure adapte.\nDemande : "Est-ce que ce plan te convient ?"\nAttends l'accord.\n\n3. Cours interactif chapitre par chapitre\nExplique chaque point avec exemples.\nPose des questions.\nAttends confirmation.\nReformule si besoin.\n\n4. Mini quiz de revision\n5 a 10 questions. Corrige immediatement.\n\n5. Bilan personnalise\nResume : ✅, ❌, 💡.\nTermine par un encouragement.`;

  return `Tu es Mentora, une professeure virtuelle intelligente, amicale et bienveillante. Tu aides les eleves a comprendre leurs cours de facon progressive, claire, interactive et detaillee, en t'adaptant a leur niveau et a leur rythme.

Tu dois guider l'eleve etape par etape, attendre sa reponse avant d'avancer, et t'assurer qu'il comprend chaque notion avant de continuer.

Tu dois toujours :
Parler avec un langage simple et bienveillant.
Toujours repondre en FRANCAIS, meme pour les titres et les exemples. Jamais en anglais.
Ne jamais afficher d'instruction interne.
Demander confirmation de comprehension avant de passer au point suivant.
Reexpliquer differemment si l'eleve ne comprend pas, en donnant un exemple plus simple.
REGLE CRITIQUE : Si tu t'es deja presentee dans cette conversation (l'eleve t'a deja repondu), NE te represente JAMAIS une deuxieme fois. Ne dis plus "Je suis Mentora" ni "Bienvenue". Passe directement au contenu demande.

${niveauInstruction ? "INSTRUCTION DE NIVEAU SPECIFIQUE :\n" + niveauInstruction + "\n\n" : ""}${diagnosticStep}

${sommaireStep}

${suite}

Tu dois incarner Mentora tout au long de la session, sans jamais expliquer que tu vas faire ceci ou cela. Tu le fais directement, de maniere fluide et naturelle.

`;
}

app.post("/api/chat", async (req, res) => {
  const { sessionId, userMessage, niveau, history } = req.body;

  if (!sessionId || !userMessage) {
    return res.status(400).json({ result: "sessionId et userMessage sont requis." });
  }

  // Si un niveau est fourni, l'associer à la session
  if (niveau) {
    sessionLevels[sessionId] = niveau;
  }

  const currentNiveau = sessionLevels[sessionId] || null;

  // Reconstruire la conversation à partir de l'historique envoyé par le frontend
  // ou utiliser la mémoire si pas d'historique (retrocompatibilite)
  let conversation;
  if (history && Array.isArray(history) && history.length > 0) {
    conversation = [{ role: "system", content: buildSystemPrompt(currentNiveau) }];
    // Ajouter l'historique sans le system prompt déjà présent
    for (const msg of history) {
      if (msg.role && msg.content && msg.role !== "system") {
        conversation.push(msg);
      }
    }
  } else if (conversations[sessionId]) {
    conversation = conversations[sessionId];
  } else {
    conversation = [{ role: "system", content: buildSystemPrompt(currentNiveau) }];
  }
  conversations[sessionId] = conversation;

  // === MESSAGES SPECIAUX ===
  let messageToSend = userMessage;
  const lowerMsg = userMessage.trim().toLowerCase();

  // Sommaire
  if (lowerMsg === "commençons" || lowerMsg === "commencons") {
    messageToSend = "L'eleve a valide le sommaire et souhaite commencer. Presente immediatement le Chapitre 1 avec la carte pedagogique (badge, titre, sous-titre) puis explique la premiere notion.";
  } else if (lowerMsg === "je ne suis pas d'accord" || lowerMsg === "je ne suis pas d accord") {
    messageToSend = "L'eleve n'est pas satisfait du sommaire. Demande-lui poliment et simplement quelles modifications il souhaite apporter au sommaire (ajouter, supprimer ou modifier des sections). Ne recommence pas le cours, ne dis pas 'ne t'inquiete pas', concentre-toi sur la question de modification.";
  }

  // Comprehension chapitre
  else if (lowerMsg === "j'ai compris" || lowerMsg === "jai compris") {
    sessionQCMState[sessionId] = { count: 0, bonneReponse: null, enCours: true };
    saveQCMState();
    messageToSend = `L'eleve dit avoir compris la notion. AVANT de passer au chapitre suivant, tu dois verifier sa comprehension avec 3 QCM consecutifs reussis.

Genere le PREMIER QCM (question a choix multiples avec 4 options A, B, C, D) portant sur la notion que tu viens d'expliquer. Adapte la difficulte au niveau de l'eleve.

Utilise EXACTEMENT ce format :

===QCM===
Question : [ta question ici]
A. [option A]
B. [option B]
C. [option C]
D. [option D]
Réponse : [lettre de la bonne reponse]
===FIN QCM===

N'ajoute aucun texte avant ou apres les balises ===QCM===.`;
  } else if (lowerMsg.startsWith("reponse qcm :")) {
    const reponseEleve = lowerMsg.replace("reponse qcm :", "").trim().toUpperCase();
    const qcmState = sessionQCMState[sessionId];
    if (qcmState && qcmState.bonneReponse) {
      if (reponseEleve === qcmState.bonneReponse) {
        qcmState.count++;
        saveQCMState();
        if (qcmState.count >= 3) {
          sessionQCMState[sessionId] = { count: 0, bonneReponse: null, enCours: false };
          saveQCMState();
          messageToSend = `L'eleve a repondu correctement (${reponseEleve}). C'est son 3eme QCM reussi CONSECUTIF ! Felicite-le chaleureusement puis passe IMMEDIATEMENT au chapitre suivant en suivant le sommaire. Presente le chapitre avec la carte pedagogique (badge, titre, sous-titre) puis explique la notion.`;
        } else {
          messageToSend = `L'eleve a repondu correctement (${reponseEleve}). C'est son ${qcmState.count}eme QCM reussi sur 3 necessaires.

Felicite-le brievement puis genere immediatement un NOUVEAU QCM DIFFERENT sur la MEME notion (pas la meme question). Adapte la difficulte.

Utilise EXACTEMENT ce format :

===QCM===
Question : [ta question]
A. [option]
B. [option]
C. [option]
D. [option]
Réponse : [lettre]
===FIN QCM===

N'ajoute aucun texte avant ou apres.`;
        }
      } else {
        qcmState.count = 0;
        saveQCMState();
        messageToSend = `L'eleve a repondu ${reponseEleve} mais la bonne reponse etait ${qcmState.bonneReponse}.

Explique brievement et bienveillamment pourquoi sa reponse est incorrecte, rappelle les points importants de la notion, puis genere un NOUVEAU QCM DIFFERENT sur la MEME notion.

Utilise EXACTEMENT ce format :

===QCM===
Question : [ta question]
A. [option]
B. [option]
C. [option]
D. [option]
Réponse : [lettre]
===FIN QCM===

N'ajoute aucun texte avant ou apres.`;
      }
    } else {
      messageToSend = "L'eleve a repondu a un QCM mais aucun QCM n'est en cours. Genere un QCM sur la derniere notion expliquee avec le format ===QCM=== ... ===FIN QCM===.";
    }
  } else if (lowerMsg === "je n'ai pas compris" || lowerMsg === "je nai pas compris") {
    messageToSend = "L'eleve n'a pas compris la notion que tu viens d'expliquer. Reexplique la avec des mots plus simples, des exemples concrets et adapte l'explication a son niveau. Ne passe PAS au chapitre suivant. Apres ta reexplication, demande-lui s'il a mieux compris.";
  } else if (lowerMsg === "poser une question") {
    messageToSend = "L'eleve veut poser une question sur la notion que tu viens d'expliquer. Dis-lui : 'Vas-y, je t'ecoute. Pose-moi ta question.' et attends sa reponse.";
  }

  // Ajouter message utilisateur à l'historique
  conversation.push({ role: "user", content: messageToSend });

  try {
    const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${process.env.OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "meta-llama/llama-3-8b-instruct",
        messages: conversation,
        max_tokens: 1200,
        temperature: 0.7,
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return res.status(429).json({ result: "Limite API dépassée." });
      }
      throw new Error(`Erreur API OpenRouter : ${response.statusText}`);
    }

    const data = await response.json();
    const originalReply = data.choices[0].message.content;
    let assistantReply = originalReply;

    // === POST-PROCESSING ===
    // 1. Supprimer toutes les instructions entre parentheses
    assistantReply = assistantReply.replace(/\s*\([^)]*\)\s*/gi, '\n\n');

    // 2. Supprimer les lignes d'instructions en gras
    assistantReply = assistantReply.replace(/\*\*[^*]*attendez[^*]*\*\*/gi, '');
    assistantReply = assistantReply.replace(/\*\*[^*]*pensez[^*]*\*\*/gi, '');
    assistantReply = assistantReply.replace(/\*\*[^*]*Patienter[^*]*\*\*/gi, '');

    // 3. Supprimer les lignes isolées de "==" ou "===" mal formées
    assistantReply = assistantReply.replace(/^[\s]*={2,3}[\s]*$/gm, '');

    // 4. Supprimer les repetitions de boutons
    assistantReply = assistantReply.replace(/Commençons\s*\n\s*Je ne suis pas d'accord/gi, '');
    assistantReply = assistantReply.replace(/\*\*Commençons\*\*/gi, '');
    assistantReply = assistantReply.replace(/\*\*Je ne suis pas d'accord\*\*/gi, '');

    // 5. Nettoyer les lignes vides multiples
    assistantReply = assistantReply.replace(/\n{3,}/g, '\n\n');

    // 6. Si l'IA a genere un sommaire sans les balises, les ajouter
    if (!assistantReply.includes('===SOMMAIRE===')) {
      const startMatch = assistantReply.match(/\*\*Sommaire[^*]*\*\*\s*\n\s*SOMMAIRE|SOMMAIRE/i);
      if (startMatch) {
        const startIdx = startMatch.index;
        const endMatch = assistantReply.substring(startIdx).match(/Voici le plan|Est-ce que ce sommaire|Nous allons commencer/i);
        const endIdx = endMatch ? startIdx + endMatch.index : assistantReply.length;
        const before = assistantReply.substring(0, startIdx).trim();
        const sommaire = assistantReply.substring(startIdx, endIdx).trim();
        const after = assistantReply.substring(endIdx).trim();
        if (sommaire) {
          assistantReply = `${before}\n\n===SOMMAIRE===\n${sommaire}\n===FIN SOMMAIRE===\n\n${after}`;
        }
      }
    }

    // 7. Envelopper les chapitres detectes dans ===CHAPITRE===
    const chapitreGlobalPattern = /\*\*Chapitre\s+\d+[^*]*\*\*[\s\S]*?(?=\*\*Chapitre\s+\d+|$)/gi;
    if (chapitreGlobalPattern.test(assistantReply) && !assistantReply.includes('===CHAPITRE===')) {
      assistantReply = assistantReply.replace(chapitreGlobalPattern, (match) => {
        const allLines = match.trim().split(/\r?\n/);
        const nonEmptyLines = allLines.map(l => l.trim()).filter(Boolean);
        const badge = nonEmptyLines[0]?.replace(/\*\*/g, '') || '';
        const titre = nonEmptyLines[1] || '';
        const sousTitre = nonEmptyLines[2] || '';
        // Trouver ou commence le contenu (apres la 3eme ligne non vide)
        let nonEmptyCount = 0;
        let contentStart = allLines.length;
        for (let i = 0; i < allLines.length; i++) {
          if (allLines[i].trim()) nonEmptyCount++;
          if (nonEmptyCount === 3) {
            contentStart = i + 1;
            break;
          }
        }
        const contenu = allLines.slice(contentStart).join('\n').trim();
        return `===CHAPITRE===\n${badge}\n${titre}\n${sousTitre}\n===FIN CHAPITRE===\n\n${contenu}`;
      });
    }

    // 8. SUPPRESSION RADICALE des symboles markdown et balises polluantes
    assistantReply = assistantReply.replace(/\*\*/g, '');           // **gras**
    assistantReply = assistantReply.replace(/\*(?=\s)/g, '');     // * tiret de liste
    assistantReply = assistantReply.replace(/\s*\*\s*$/gm, '');   // lignes se terminant par *

    // 9. Nettoyer les labels parasites (apres suppression des **)
    assistantReply = assistantReply.replace(/^Badge\s*:\s*/gim, '');
    assistantReply = assistantReply.replace(/^Titre\s*:\s*/gim, '');
    assistantReply = assistantReply.replace(/^Sous-titre\s*:\s*/gim, '');
    assistantReply = assistantReply.replace(/^Objectif\s*:\s*/gim, '');
    assistantReply = assistantReply.replace(/^Question\s*:\s*/gim, '');
    assistantReply = assistantReply.replace(/^Exemple\s*:\s*/gim, '');

    // 10. Nettoyer les lignes de balises mal formees ou vides (ne pas toucher aux balises avec texte)
    assistantReply = assistantReply.replace(/^\s*={3,}\s*$/gm, '');

    // 10. Parser le QCM pour stocker la bonne reponse
    const qcmPatternInReply = /={3,}\s*QCM\s*={3,}[\s\S]*?={3,}\s*FIN\s*QCM\s*={3,}/i;
    if (qcmPatternInReply.test(assistantReply)) {
      const qcmMatch = assistantReply.match(qcmPatternInReply);
      if (qcmMatch) {
        const repMatch = qcmMatch[0].match(/R[eé]ponse\s*[:\-]?\s*([A-D])/i);
        if (repMatch && sessionQCMState[sessionId]) {
          sessionQCMState[sessionId].bonneReponse = repMatch[1].toUpperCase();
          saveQCMState();
        }
      }
    }

    // 11. Nettoyer les lignes vides multiples
    assistantReply = assistantReply.replace(/\n{3,}/g, '\n\n');
    assistantReply = assistantReply.trim();

    // Ajouter reponse ORIGINALE à l'historique (pour ne pas confondre l'IA)
    conversation.push({ role: "assistant", content: originalReply });

    return res.json({ result: assistantReply });
  } catch (error) {
    console.error("Erreur API OpenRouter:", error);
    return res.status(500).json({ result: "Erreur lors de la réponse de l'IA." });
  }
});

app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "../public/index.html"));
});

app.listen(PORT, () => {
  console.log(`✅ Serveur backend lancé sur le port ${PORT}`);
});
