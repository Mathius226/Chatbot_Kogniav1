import express from "express";
import cors from "cors";
import { createServer as createViteServer } from "vite";
import path from "path";
import { fileURLToPath } from "url";
import { UploadedDocument, StatRecord, ChatMessage, Sender } from "./types.js";
import { queryLegalAssistant, indexDocument } from "./services/geminiService.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = 3000;

app.use(cors());
app.use(express.json({ limit: '50mb' }));

// In-memory state
let documents: UploadedDocument[] = [];
let stats: StatRecord[] = [];
let feedbackData: { messageId: string; type: 'up' | 'down'; question: string; answer: string; date: Date }[] = [];

const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "admin123";

// --- API Routes ---

app.post("/api/chat", async (req, res) => {
  console.log("Received /api/chat request");
  try {
    const { queryText } = req.body;
    if (!queryText) return res.status(400).json({ error: "queryText is required" });

    console.log("Calling queryLegalAssistant...");
    const response = await queryLegalAssistant(queryText, documents);
    console.log("queryLegalAssistant returned:", response);
    
    // Save stat
    const stat: StatRecord = {
      id: Date.now().toString(),
      question: queryText,
      answer: response.answer,
      date: new Date()
    };
    stats.push(stat);

    console.log("Sending response back to client");
    res.json({ response, statId: stat.id });
  } catch (error: any) {
    console.error("Chat error:", error);
    res.status(500).json({ error: error.message });
  }
});

app.post("/api/feedback", (req, res) => {
  const { messageId, type, question, answer } = req.body;
  if (!messageId || !type) return res.status(400).json({ error: "messageId and type are required" });

  feedbackData.push({ messageId, type, question, answer, date: new Date() });
  res.json({ success: true });
});

app.post("/api/admin/login", (req, res) => {
  const { password } = req.body;
  if (password === ADMIN_PASSWORD) {
    res.json({ success: true, token: "simple-admin-token" });
  } else {
    res.status(401).json({ error: "Invalid password" });
  }
});

// Simple middleware for admin
const requireAdmin = (req: express.Request, res: express.Response, next: express.NextFunction) => {
  const token = req.headers.authorization;
  if (token === "Bearer simple-admin-token") {
    next();
  } else {
    res.status(401).json({ error: "Unauthorized" });
  }
};

app.get("/api/admin/analytics", requireAdmin, (req, res) => {
  res.json({ stats, feedback: feedbackData, documentCount: documents.length });
});

app.post("/api/admin/reindex", requireAdmin, async (req, res) => {
  try {
    const { newDocuments } = req.body; // Array of raw documents from frontend
    if (!newDocuments || !Array.isArray(newDocuments)) {
      return res.status(400).json({ error: "newDocuments array is required" });
    }

    const processedDocs: UploadedDocument[] = [];
    for (const rawDoc of newDocuments) {
      const indexedDoc = await indexDocument(rawDoc);
      processedDocs.push(indexedDoc);
    }

    documents = processedDocs; // Replace documents
    res.json({ success: true, count: documents.length });
  } catch (error: any) {
    console.error("Reindex error:", error);
    res.status(500).json({ error: error.message });
  }
});

// Vite middleware for development
async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
