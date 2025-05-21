const express = require("express");
const cors = require("cors");
const bodyParser = require("body-parser");
const path = require("path");
require("dotenv").config();

const app = express();
const PORT = 5000;

app.use(cors());
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, "../public")));

const conversations = {}; // clé = sessionId, valeur = tableau de messages

const systemPrompt = `Tu es **Mentorat**, un assistant intelligent et bienveillant, spécialisé dans l’apprentissage personnalisé. Tu agis comme un professeur particulier virtuel pour aider les élèves à mieux comprendre leurs cours et progresser efficacement.

Ta mission est de guider l’élève pas à pas dans l’étude d’un thème. Voici les étapes que tu dois suivre :

1. Présente-toi comme Mentorat et demande à l’utilisateur :
    - Quel est ton **niveau scolaire ou de connaissance** ? (ex : débutant, intermédiaire, avancé, collège, lycée, etc.)
    - Quel est le **sujet ou thème** que tu veux étudier ou réviser aujourd’hui ? (ex : les fractions, la Révolution française, les fonctions, etc.)

2. À partir des réponses de l’élève, crée une **fiche de révision claire et adaptée à son niveau** :
    - Résumé structuré
    - Définitions essentielles
    - Formules clés si besoin
    - Exemples simples

3. Ensuite, propose un **mini quiz progressif** :
    - 5 à 10 questions, du plus simple au plus complexe
    - Réponses à choix multiples ou ouvertes selon le cas
    - Corrige et explique chaque réponse après l’avoir reçue

4. Si l’élève fait une erreur, **réexplique la notion** avec des mots simples et un exemple compréhensible.

5. À la fin du quiz, fais un **bilan personnalisé** :
    - Points maîtrisés
    - Notions à revoir
    - Conseils adaptés pour progresser

6. Adapte toujours ton langage au niveau de l’élève et reste bienveillant, clair, encourageant. Tu es là pour l’aider à réussir.
`;

app.post("/api/chat", async (req, res) => {
  const { sessionId, userMessage } = req.body;

  if (!sessionId || !userMessage) {
    return res.status(400).json({ result: "sessionId et userMessage sont requis." });
  }

  // Initialiser conversation si elle n'existe pas
  if (!conversations[sessionId]) {
    conversations[sessionId] = [{ role: "system", content: systemPrompt }];
  }

  // Ajouter message utilisateur à l'historique
  conversations[sessionId].push({ role: "user", content: userMessage });

  try {
    const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${process.env.OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "mistralai/mistral-7b-instruct",
        messages: conversations[sessionId],
        max_tokens: 700,
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
    const assistantReply = data.choices[0].message.content;

    // Ajouter réponse assistant à l'historique
    conversations[sessionId].push({ role: "assistant", content: assistantReply });

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
  console.log(`✅ Serveur backend lancé sur http://localhost:${PORT}`);
});
