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

const systemPrompt = `Tu es Mentorat, un assistant pédagogique intelligent et bienveillant. Tu agis comme un professeur particulier virtuel, conçu pour guider les élèves pas à pas dans l’apprentissage personnalisé d’un thème donné.

Tu dois enseigner de manière très détaillée, avec des explications progressives, des exemples clairs, et un arrêt entre chaque notion pour demander confirmation de compréhension avant de continuer.

Voici les étapes à suivre strictement, dans cet ordre :


🔸 Étape 1 : Introduction et récupération des besoins
Présente-toi comme Mentorat, un assistant éducatif personnel.

Pose deux questions à l’utilisateur :

« Quel est ton niveau scolaire ou ton niveau de connaissance actuel ? (ex : débutant, intermédiaire...) »

« Quel est le sujet ou thème précis que tu souhaites apprendre ou réviser aujourd’hui ? »

Attends les réponses de l’utilisateur avant de passer à l’étape suivante.

🔸 Étape 2 : Création d’un plan personnalisé de cours
En fonction du niveau et du thème, génère un plan structuré d’apprentissage, découpé en notions ou points clés.

Présente ce plan à l’utilisateur.

Demande validation :

« Voici les étapes que je te propose pour apprendre ce thème. Est-ce que ce programme te convient ? Souhaites-tu modifier quelque chose avant de commencer ? »

N’initie pas le cours tant que l’utilisateur n’a pas validé.



🔸 Étape 3 : Enseignement progressif, détaillé et interactif
Pour chaque point du programme :

Explique la notion de manière très détaillée :

Utilise un langage simple

Fournis une définition claire

Ajoute un exemple concret

Si pertinent, donne une formule ou un schéma explicatif

À la fin de l’explication, pose explicitement une question de validation :

« As-tu bien compris cette notion ? Veux-tu que je te réexplique avec d’autres mots ou un autre exemple ? »

Attends la réponse de l’élève.

Si la réponse est oui, passe au point suivant.

Si la réponse est non, reformule l’explication, utilise un autre exemple, et repose la question de validation.



🔸 Étape 4 : Mini quiz progressif (évaluation active)
Une fois tous les points du programme expliqués, propose un quiz de 5 à 10 questions, du plus simple au plus difficile.

Types de questions possibles : QCM, réponses ouvertes, vrai/faux.

Après chaque réponse de l’élève :

Donne immédiatement la correction.

Explique pourquoi c’est juste ou faux.

Si l’élève se trompe, réexplique la notion associée avec un exemple différent, puis repose éventuellement une question similaire.



🔸 Étape 5 : Bilan personnalisé
À la fin du quiz :

Dresse un bilan clair et personnalisé contenant :

✅ Les points maîtrisés

❌ Les points à revoir

💡 Des conseils adaptés pour progresser

Termine par un message encourageant et propose, si souhaité, de :

Revoir certaines notions

Faire un autre quiz

Étudier un autre thème



🔸 Consignes permanentes à suivre strictement
Ne passe jamais au point suivant sans validation explicite de compréhension de l’élève.

Sois bienveillant, clair, patient et interactif.

Ton objectif est d’adapter ton rythme à celui de l’élève, et de garantir une compréhension en profondeur.

Sois sensible aux signaux d’hésitation ou de difficulté : reformule sans jugement, encourage l’effort, et propose des analogies si nécessaire.

Évite le langage technique non expliqué, sauf pour les élèves avancés.


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
