import express from "express";
import path from "path";
import fs from "fs";
import { GoogleGenAI, Type } from "@google/genai";
import { createServer as createViteServer } from "vite";
import dotenv from "dotenv";

dotenv.config();

const app = express();
const PORT = 3000;

app.use(express.json());

// Set up server-side database path
const DB_DIR = path.join(process.cwd(), "data");
const DB_FILE = path.join(DB_DIR, "db.json");

// Ensure DB directory and database file exist
if (!fs.existsSync(DB_DIR)) {
  fs.mkdirSync(DB_DIR, { recursive: true });
}

// Interface definitions of our relationship DB
interface Exercise {
  id: string;
  title: string;
  description: string;
  completed: boolean;
}

interface PartnerProfile {
  name: string;
  avatar: string;
  mood: string;
}

interface CoupleProfile {
  partnerA: PartnerProfile;
  partnerB: PartnerProfile;
  loveScore: number;
  anniversary: string;
  strengths: string[];
  challenges: string[];
  exercises: Exercise[];
}

interface Message {
  id: string;
  sender: string;
  content: string;
  timestamp: number;
}

interface Database {
  profile: CoupleProfile;
  messages: Message[];
}

const defaultDb: Database = {
  profile: {
    partnerA: { name: "Merveille", avatar: "🌸", mood: "Heureuse et sereine" },
    partnerB: { name: "Jean-Baptiste", avatar: "✨", mood: "Rêveur et attentionné" },
    loveScore: 85,
    anniversary: "2024-04-14",
    strengths: [
      "Forte complicité émotionnelle et écoute attentive",
      "Confiance mutuelle solide",
      "Slogan secret complice : 🤞🏻"
    ],
    challenges: [
      "Trouver d'avantage de temps de qualité exclusif au quotidien",
      "Exprimer les petites insatisfactions de manière douce (CNV)"
    ],
    exercises: [
      {
        id: "ex-1",
        title: "La Carte d'Amour Cardinale",
        description: "Posez-vous une question sur un rêve ou projet secret de l'autre ce soir (ex: Quelle est sa plus grande aspiration actuelle ?).",
        completed: false
      },
      {
        id: "ex-2",
        title: "Exercice d'appréciation positive",
        description: "Prenez 5 minutes aujourd'hui pour citer un geste précis de la semaine passée que vous avez profondément adoré.",
        completed: false
      }
    ]
  },
  messages: [
    {
      id: "msg-init-1",
      sender: "Système",
      content: "Saint-Valentin ou quotidien, Wiki Love est votre havre de couple partagé.",
      timestamp: Date.now() - 3600 * 1000 * 48
    },
    {
      id: "msg-init-2",
      sender: "AI",
      content: "Bonjour Merveille et Jean-Baptiste. Je suis votre mentor de couple. Je serai direct, neutre, concis et attentif à votre dynamique. De quoi aimeriez-vous échanger ou vous confier ?",
      timestamp: Date.now() - 3600 * 1000 * 24
    }
  ]
};

// Helper functions to read/write DB
function readDb(): Database {
  try {
    if (fs.existsSync(DB_FILE)) {
      const data = fs.readFileSync(DB_FILE, "utf-8");
      return JSON.parse(data);
    }
  } catch (error) {
    console.error("Error reading database file, using fallback:", error);
  }
  return defaultDb;
}

function writeDb(db: Database) {
  try {
    fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2), "utf-8");
  } catch (error) {
    console.error("Error writing database file:", error);
  }
}

// Initialize database file with defaults if empty
if (!fs.existsSync(DB_FILE)) {
  writeDb(defaultDb);
}

// Lazy initialization of Gemini client
let geminiClient: GoogleGenAI | null = null;

function getGeminiClient(): GoogleGenAI {
  if (!geminiClient) {
    const key = process.env.GEMINI_API_KEY;
    if (!key) {
      console.warn("WARNING: GEMINI_API_KEY environment variable is not set. Chat functions will slide into offline mode or fallback.");
    }
    geminiClient = new GoogleGenAI({
      apiKey: key || "MOCK_KEY",
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        }
      }
    });
  }
  return geminiClient;
}

// Robust wrapper for Gemini API calls to handle retries and fallback models
async function generateContentWithFallback(
  client: GoogleGenAI,
  options: {
    contents: any;
    config?: any;
    defaultModel?: string;
  }
): Promise<any> {
  const modelsToTry = [
    options.defaultModel || "gemini-3-flash-preview",
    "gemini-3.1-flash-lite",
  ];

  let lastError: any = null;

  for (const model of modelsToTry) {
    for (let attempts = 1; attempts <= 3; attempts++) {
      try {
        console.log(`Attempting Gemini call with model: ${model} (attempt ${attempts}/3)`);
        const response = await client.models.generateContent({
          model: model,
          contents: options.contents,
          config: options.config,
        });
        return response;
      } catch (err: any) {
        lastError = err;
        const errMsg = err?.message || "";
        console.warn(`[Gemini Warn] Model ${model} attempt ${attempts} failed:`, errMsg);

        // Check if error is retriable
        // code 503, UNAVAILABLE, and rate limit errors (429) are retriable
        const isRetriable = errMsg.includes("503") || 
                            errMsg.includes("UNAVAILABLE") || 
                            errMsg.includes("high demand") || 
                            errMsg.includes("429") || 
                            errMsg.includes("rate limit");

        if (!isRetriable) {
          break; // Try next fallback model immediately
        }

        if (attempts < 3) {
          const waitTime = attempts * 1000;
          await new Promise((resolve) => setTimeout(resolve, waitTime));
        }
      }
    }
  }

  throw lastError || new Error("All models and retries failed to generate content.");
}

// 🤞🏻 Secret emoji check helper
function isSloganEmojiOnly(text: string): boolean {
  return text.trim() === "🤞🏻" || text.trim() === "🤞";
}

// System instruction context builder
function buildSystemInstruction(profile: CoupleProfile, sender: string): string {
  const currentPartner = sender;
  const otherPartner = sender === profile.partnerA.name ? profile.partnerB.name : profile.partnerA.name;
  
  return `Tu es "Wiki Love", le Mentor d'intimité, sexologue, psychologue, sociologue et conseiller secret de couple de ${profile.partnerA.name} et ${profile.partnerB.name}.
Actuellement, c'est ${currentPartner} qui te parle en direct sur son portable. Son/sa partenaire s'appelle ${otherPartner}.

RÈGLES DE CONDUITE ABSOLUES ET CRITIQUES :
1. ULTRA CONCIS : Ne fais JAMAIS de longs discours. Pas d'introduction polie ni de blabla inutile. Va droit au but. Réponds en MAXIMUM 1 à 3 phrases percutantes et instructives.
2. NEUTRE ET BIENVEILLANT : Ton ton est d'un professionnel averti, direct, lucide mais chaleureux.
3. MÉMOIRE DE COUPLE PARTAGÉE : Tu as accès aux souvenirs et dynamiques du couple :
   - Forces actuelles : ${profile.strengths.join(", ")}
   - Défis identifiés : ${profile.challenges.join(", ")}
4. INDIVIDUALITÉ SANS TRAHISON : Tu interagis individuellement avec chaque membre sur son propre portable. Tu gardes en tête le contexte partagé pour donner un conseil extrêmement équilibré, en orientant doucement vers la communication bienveillante (CNV - Communication Non Violente, méthode Gottman) sans jamais trahir les confidences brutes de manière agressive.
5. CONSEILS SEXOLOGUES ET RELATIONNELS : En cas de question intime ou sexologue, sois professionnel, clinique, ouvert et direct. Suggère des exercices simples.

RÈGLE D'OR SLOGAN SECRET :
Si le message envoyé est ou contient uniquement le slogan emoji "🤞🏻", tu dois RÉPONDRE DIRECTEMENT et UNIQUEMENT "wiki love love" (sans autre mot ou ponctuation).`;
}

// --- API ROUTES ---

// 1. Get entire relational profile and messages
app.get("/api/profile", (req, res) => {
  const db = readDb();
  res.json({
    profile: db.profile,
    messagesCount: db.messages.length
  });
});

// 2. Clear entire conversation and reset context securely
app.post("/api/reset", (req, res) => {
  const initialData: Database = {
    ...defaultDb,
    messages: [
      {
        id: "msg-reset-1",
        sender: "Système",
        content: "Espace de confiance réinitialisé.",
        timestamp: Date.now()
      },
      {
        id: "msg-reset-2",
        sender: "AI",
        content: "De retour à vos côtés. Prêt pour un nouveau départ dans la complicité.",
        timestamp: Date.now() + 10
      }
    ]
  };
  writeDb(initialData);
  res.json({ status: "success", db: initialData });
});

// 3. Update profiles manually (names, moods, anniversary)
app.post("/api/profile/update", (req, res) => {
  const db = readDb();
  const { partnerA, partnerB, anniversary, loveScore } = req.body;

  if (partnerA) db.profile.partnerA = { ...db.profile.partnerA, ...partnerA };
  if (partnerB) db.profile.partnerB = { ...db.profile.partnerB, ...partnerB };
  if (anniversary) db.profile.anniversary = anniversary;
  if (typeof loveScore === "number") db.profile.loveScore = loveScore;

  writeDb(db);
  res.json({ status: "success", profile: db.profile });
});

// 4. Get messages
app.get("/api/messages", (req, res) => {
  const db = readDb();
  res.json(db.messages);
});

// 5. Submit a message and generate advice from Wiki Love
app.post("/api/chat", async (req, res) => {
  const db = readDb();
  const { sender, content } = req.body;

  if (!sender || !content) {
    return res.status(400).json({ error: "Sender and Content are required fields." });
  }

  // 1. Add User message to log
  const userMsg: Message = {
    id: `msg-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
    sender,
    content: content.trim(),
    timestamp: Date.now()
  };
  db.messages.push(userMsg);

  // 1.5 Slogan absolute rule check
  if (isSloganEmojiOnly(content)) {
    const aiMsg: Message = {
      id: `ai-${Date.now()}`,
      sender: "AI",
      content: "wiki love love",
      timestamp: Date.now() + 50
    };
    db.messages.push(aiMsg);
    writeDb(db);
    return res.json({ response: aiMsg, messages: db.messages });
  }

  // Check if GEMINI_API_KEY is available
  if (!process.env.GEMINI_API_KEY) {
    // Elegant system fallback if key is missing when deploying or during startup
    const aiMsg: Message = {
      id: `ai-${Date.now()}`,
      sender: "AI",
      content: "Je suis à votre écoute, mais ma clé API Gemini est absente. Entrez le logo complice 🤞🏻 pour tester le slogan secret !",
      timestamp: Date.now() + 50
    };
    db.messages.push(aiMsg);
    writeDb(db);
    return res.json({ response: aiMsg, messages: db.messages });
  }

  try {
    const client = getGeminiClient();
    
    // Package messages context so Gemini knows the history limit to keep answers tailored
    const recentMessagesContext = db.messages
      .slice(-15) // take last 15 messages for history focus
      .map(m => `${m.sender}: ${m.content}`)
      .join("\n");

    const prompt = `Voici l'historique récent de nos échanges :\n${recentMessagesContext}\n\nRéponds maintenant au dernier message de ${sender} en t'inscrivant strictement dans ton rôle défini de Wiki Love de manière ultra concise.`;

    const instructions = buildSystemInstruction(db.profile, sender);

    const response = await generateContentWithFallback(client, {
      defaultModel: "gemini-3-flash-preview",
      contents: prompt,
      config: {
        systemInstruction: instructions,
        temperature: 0.85,
      }
    });

    const replyText = response.text ? response.text.trim() : "Je l'entends parfaitement. Prenons un moment pour respirer à deux.";

    const aiMsg: Message = {
      id: `ai-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      sender: "AI",
      content: replyText,
      timestamp: Date.now() + 100
    };

    db.messages.push(aiMsg);
    writeDb(db);
    res.json({ response: aiMsg, messages: db.messages });
  } catch (err: any) {
    console.error("Gemini API call failed:", err);
    const errorMsg: Message = {
      id: `ai-err-${Date.now()}`,
      sender: "AI",
      content: "Désolé, j'ai rencontré un petit nuage réseau. Quoi qu'il en soit, n'oubliez pas d'utiliser la communication douce.",
      timestamp: Date.now() + 100
    };
    db.messages.push(errorMsg);
    writeDb(db);
    res.status(500).json({ error: "Gemini communication failed", response: errorMsg, messages: db.messages });
  }
});

// 6. Relationship Dynamics Analyzer Engine
// Calls Gemini to synthesize the shared log and build dynamic profile elements
app.post("/api/analyze-dynamics", async (req, res) => {
  const db = readDb();

  if (!process.env.GEMINI_API_KEY) {
    return res.status(200).json({ 
      status: "mock", 
      profile: db.profile,
      message: "Clé API absente. Analyse dynamique impossible."
    });
  }

  try {
    const client = getGeminiClient();
    // Exclude system message and grab couples messages
    const chatTimeline = db.messages
      .filter(m => m.sender !== "Système")
      .slice(-30) // last 30 messages
      .map(m => `${m.sender}: ${m.content}`)
      .join("\n");

    if (chatTimeline.trim().length === 0) {
      return res.json({ status: "empty", profile: db.profile });
    }

    const analysisPrompt = `Tu es l'analyste psychologue et thérapeute de Wiki Love. Examine l'échange de couple ci-dessous :
---
${chatTimeline}
---

Génère une analyse et une synthèse de leur dynamique de couple actuelle au format JSON.
Tu dois renvoyer STRICTEMENT un objet JSON respectant ce schéma exact (sans aucun autre texte) :
{
  "loveScore": <un entier de 0 à 100 estimant l'harmonie et la connexion actuelle d'après leur ton et complicité>,
  "strengths": ["Trois affirmations claires de leurs forces de couple tirées des échanges récents"],
  "challenges": ["Deux ou trois défis perçus dans leur communication ou vie à deux"],
  "exercises": [
    {
      "title": "Nom de l'exercice 1 (méthode Gottman, thérapie de couple ou CNV)",
      "description": "Une consigne concrète de moins de 150 caractères pour les inviter à se rapprocher."
    },
    {
      "title": "Nom de l'exercice 2 (méthode Gottman, thérapie de couple ou CNV)",
      "description": "Une autre consigne concrète."
    }
  ]
}`;

    const response = await generateContentWithFallback(client, {
      defaultModel: "gemini-3-flash-preview",
      contents: analysisPrompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          required: ["loveScore", "strengths", "challenges", "exercises"],
          properties: {
            loveScore: { type: Type.INTEGER },
            strengths: { type: Type.ARRAY, items: { type: Type.STRING } },
            challenges: { type: Type.ARRAY, items: { type: Type.STRING } },
            exercises: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                required: ["title", "description"],
                properties: {
                  title: { type: Type.STRING },
                  description: { type: Type.STRING }
                }
              }
            }
          }
        }
      }
    });

    const rawResponseText = response.text ? response.text.trim() : "";
    const parsedData = JSON.parse(rawResponseText);

    // Update the database with synthesized dynamics
    db.profile.loveScore = parsedData.loveScore;
    db.profile.strengths = parsedData.strengths || db.profile.strengths;
    db.profile.challenges = parsedData.challenges || db.profile.challenges;
    
    if (parsedData.exercises && parsedData.exercises.length > 0) {
      db.profile.exercises = parsedData.exercises.map((e: any, index: number) => ({
        id: `ex-gen-${index}-${Date.now()}`,
        title: e.title,
        description: e.description,
        completed: false
      }));
    }

    writeDb(db);
    res.json({ status: "success", profile: db.profile });

  } catch (error: any) {
    console.error("Dynamics analysis failed:", error);
    res.status(500).json({ error: "Analysis process failed", details: error.message });
  }
});

// 7. Toggle exercise completion
app.post("/api/exercise/toggle", (req, res) => {
  const db = readDb();
  const { id } = req.body;

  db.profile.exercises = db.profile.exercises.map(ex => {
    if (ex.id === id) {
      return { ...ex, completed: !ex.completed };
    }
    return ex;
  });

  writeDb(db);
  res.json({ status: "success", profile: db.profile });
});

// 8. Custom user questions/desires (boîte à secrets / rituels)
// Allow injecting some direct custom exercises or shared note-taking
app.post("/api/profile/custom-exercise", (req, res) => {
  const db = readDb();
  const { title, description } = req.body;

  if (title && description) {
    db.profile.exercises.unshift({
      id: `ex-cust-${Date.now()}`,
      title,
      description,
      completed: false
    });
    writeDb(db);
    res.json({ status: "success", profile: db.profile });
  } else {
    res.status(400).json({ error: "Missing title or description." });
  }
});


// --- INTEGRATE VITE FOR DEV VS SERVING STATIC IN PRODUCTION ---

async function runServer() {
  if (process.env.NODE_ENV !== "production") {
    // Development Mode
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    // Production Mode: serving static react files
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Wiki Love Server is running at http://localhost:${PORT}`);
  });
}

runServer();
