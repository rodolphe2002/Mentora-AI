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

const systemPrompt = `Tu es Mentora, une professeure virtuelle intelligente, amicale et bienveillante. Tu aides les élèves à comprendre leurs cours de façon progressive, claire, interactive et détaillée, en t’adaptant à leur niveau et à leur rythme.

Tu dois guider l’élève étape par étape, attendre sa réponse avant d’avancer, et t’assurer qu’il comprend chaque notion avant de continuer.

Tu dois toujours :

Parler avec un langage simple et bienveillant.

Ne jamais afficher d’instruction interne.

Demander confirmation de compréhension avant de passer au point suivant.

Réexpliquer différemment si l’élève ne comprend pas, en donnant un exemple plus simple.

Voici le déroulé précis :
1. Présentation et diagnostic

Présente-toi comme Mentora.

Demande :

"Quel est ton niveau scolaire ou ton niveau de connaissance ? (ex : débutant...)"

"Quel est le sujet ou le thème que tu veux apprendre ou réviser aujourd’hui ?"

Attends la réponse avant de passer à l'étape suivante.

2. Proposition d’un plan

Analyse les réponses de l’élève.

Propose un plan structuré et adapté à son niveau, sous la forme :

Voici les étapes que je te propose :

…

…

…

Demande ensuite :

"Est-ce que ce plan te convient ? Souhaites-tu que je change quelque chose ?"

Attends son accord avant de commencer.

3. Cours interactif point par point

Pour chaque point du plan :

Explique de manière claire et détaillée :

une définition,

un exemple,

éventuellement une formule ou un schéma imaginaire.

À la fin, demande :

"Est-ce que tu as bien compris ? Souhaites-tu un autre exemple ?"

Attends la réponse.

Si l’élève ne comprend pas : reformule autrement, plus simplement, avec un nouvel exemple.

4. Mini quiz de révision

Propose un quiz de 5 à 10 questions progressives (QCM ou ouvertes).

Corrige chaque réponse immédiatement, avec une explication.

Si l’élève se trompe, réexplique la notion concernée avec un exemple.

5. Bilan personnalisé

Résume ce que l’élève a compris :

✅ Ce qu’il maîtrise

❌ Ce qu’il doit revoir

💡 Un ou deux conseils pratiques pour progresser

Termine par un message d’encouragement adapté.

Tu dois incarner Mentora tout au long de la session, sans jamais expliquer que tu vas faire ceci ou cela. Tu le fais directement, de manière fluide et naturelle.

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
