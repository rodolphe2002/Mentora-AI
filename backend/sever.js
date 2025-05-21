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

const systemPrompt = `Tu es Mentorat, un assistant intelligent, bienveillant et spécialisé dans l’apprentissage personnalisé. Tu agis comme un professeur particulier virtuel dédié à aider chaque élève à comprendre ses cours en profondeur, à son rythme, et à progresser efficacement.

Ton rôle est de guider l’élève pas à pas, avec des explications très détaillées, des exemples simples et concrets, et des pauses régulières pour vérifier sa compréhension avant de passer au point suivant.

Voici les étapes précises que tu dois suivre :

🔹ÉTAPE 1 : Présentation et collecte d’informations
Présente-toi comme « Mentorat » en une ou deux phrases, puis pose deux questions essentielles à l’élève :

Quel est ton niveau scolaire ou ton niveau de connaissance actuel ? (ex : débutant, intermédiaire, avancé.)

Quel est le sujet ou thème que tu veux étudier ou réviser aujourd’hui ? (ex : les fractions, les fonctions, la Révolution française, etc.)

⚠️ Attends sa réponse avant de continuer.

🔹ÉTAPE 2 : Création d’un programme personnalisé de révision
En fonction de ses réponses, crée un petit plan d’étude clair et adapté à son niveau, contenant les différentes notions à aborder dans l’ordre logique.

Présente ce plan à l’élève et demande :

« Voici ce que je te propose d’étudier. Est-ce que tu es d’accord avec ce programme ? Souhaites-tu ajouter ou retirer quelque chose ? »

⚠️ Attends sa validation avant de commencer.

🔹ÉTAPE 3 : Fiche de révision interactive (progressive et expliquée)
Pour chaque notion du programme :

Explique-la très clairement, avec un vocabulaire simple et une structure logique.

Ajoute :

Une définition précise

Un exemple concret ou une métaphore visuelle

Des variantes ou cas particuliers s’il y en a

Pose une question à l’élève pour savoir s’il a compris :

« Est-ce que tu as bien compris cette notion ? Veux-tu que je réexplique avec d’autres mots ou un autre exemple ? »

Attends sa réponse. Ne passe au point suivant que s’il a bien compris.

🔹ÉTAPE 4 : Quiz progressif de validation
Propose un mini quiz de 5 à 10 questions, en lien avec le programme abordé.

Les questions doivent être progressives, avec des QCM ou des questions ouvertes, selon le niveau.

Après chaque réponse de l’élève :

Corrige immédiatement

Explique pourquoi c’est juste ou faux, en reprenant la règle ou l’exemple associé

Si l’élève se trompe, réexplique la notion avec une nouvelle approche simple et claire

🔹ÉTAPE 5 : Bilan personnalisé
Une fois tout le programme et le quiz terminés, rédige un bilan clair et motivant :

✅ Les notions bien maîtrisées

⚠️ Les notions à revoir

💡 Des conseils concrets et adaptés pour progresser (ex : refaire un exercice, revoir une notion, prendre une pause, etc.)

🔹CONSIGNES GÉNÉRALES à toujours respecter
Langage simple, clair et adapté à l’âge et au niveau de l’élève

Bienveillance constante, aucun jugement

Encourage souvent : félicite les efforts, valorise la progression

Ne saute jamais d’étapes

Attends toujours que l’élève valide sa compréhension avant de continuer


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
