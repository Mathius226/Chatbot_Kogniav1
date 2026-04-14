import { GoogleGenAI, Type, Schema } from "@google/genai";
import { UploadedDocument, LegalResponse, DocumentChunk } from "../types";

// Initialize Gemini Client dynamically to ensure it picks up env changes
const getGeminiClient = () => {
  const rawKey = process.env.GEMINI_API_KEY || process.env.API_KEY || "";
  const cleanKey = rawKey.replace(/^["']|["']$/g, '').trim();
  if (!cleanKey) {
    throw new Error("API_KEY_MISSING");
  }
  return new GoogleGenAI({ apiKey: cleanKey });
};

// --- RAG CONSTANTS ---
const CHUNK_SIZE = 1000; // Characters per chunk
const CHUNK_OVERLAP = 200; // Overlap to maintain context
const EMBEDDING_MODEL = "text-embedding-004";
const GENERATION_MODEL = "gemini-2.5-flash";

// Threshold to switch from Full Context to Vector RAG
// Lowered to 50,000 chars to ensure fast responses.
const FULL_CONTEXT_THRESHOLD = 50000; 

// --- SYSTEM INSTRUCTION ---
const SYSTEM_INSTRUCTION = `
ROL: Asistente de Empleados Municipales.

OBJETIVO: Responder preguntas de los empleados del municipio basándote ÚNICA Y EXCLUSIVAMENTE en los documentos oficiales proporcionados.

REGLAS:
1. SOLO CONTEXTO: Tu respuesta debe derivarse estrictamente de los documentos proporcionados.
2. NO INVENTAR: Si la respuesta no se encuentra en el texto proporcionado, DEBES responder exactamente con esta frase: "No encontré esta información en los documentos oficiales". En este caso, pon confidence_score en 0.
3. EVIDENCIA: Todo lo que digas debe estar respaldado por el texto.
4. FORMATO: Usa párrafos cortos y lenguaje claro.

Estructura JSON de Salida:
- answer: La respuesta a la pregunta del empleado.
- source_excerpts: Array de strings con las citas EXACTAS del texto original que prueban tu respuesta.
- confidence_score: Un número entero (0-100). 
   - 90-100: Alta confianza (Explícito).
   - 50-89: Confianza media (Inferido).
   - 0-49: Baja confianza o No encontrado.
`;

const responseSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    answer: {
      type: Type.STRING,
      description: "La respuesta clara y fundamentada.",
    },
    source_excerpts: {
      type: Type.ARRAY,
      items: { type: Type.STRING },
      description: "Citas textuales exactas.",
    },
    confidence_score: {
      type: Type.INTEGER,
      description: "Nivel de confianza (0-100).",
    },
  },
  required: ["answer", "source_excerpts", "confidence_score"],
};

// --- RAG UTILITIES ---

function chunkText(text: string, chunkSize: number, overlap: number): string[] {
  const chunks: string[] = [];
  let start = 0;
  while (start < text.length) {
    const end = Math.min(start + chunkSize, text.length);
    chunks.push(text.slice(start, end));
    start += chunkSize - overlap;
  }
  return chunks;
}

function cosineSimilarity(vecA: number[], vecB: number[]): number {
  const dotProduct = vecA.reduce((sum, a, i) => sum + a * vecB[i], 0);
  const magnitudeA = Math.sqrt(vecA.reduce((sum, a) => sum + a * a, 0));
  const magnitudeB = Math.sqrt(vecB.reduce((sum, b) => sum + b * b, 0));
  return dotProduct / (magnitudeA * magnitudeB);
}

async function getEmbedding(text: string): Promise<number[]> {
  try {
    const ai = getGeminiClient();
    const result = await ai.models.embedContent({
      model: EMBEDDING_MODEL,
      contents: text,
    });
    return result.embeddings?.[0]?.values || [];
  } catch (error) {
    console.warn("Error getting embedding (skipping chunk):", error);
    return [];
  }
}

export const indexDocument = async (doc: UploadedDocument): Promise<UploadedDocument> => {
  const textChunks = chunkText(doc.content, CHUNK_SIZE, CHUNK_OVERLAP);
  const processedChunks: DocumentChunk[] = [];
  
  const maxChunksToIndex = 300; 
  const chunksToProcess = textChunks.slice(0, maxChunksToIndex);
  
  // Process in batches of 50 to avoid rate limits and payload size issues
  const BATCH_SIZE = 50;
  
  for (let i = 0; i < chunksToProcess.length; i += BATCH_SIZE) {
    const batch = chunksToProcess.slice(i, i + BATCH_SIZE);
    try {
      const ai = getGeminiClient();
      const result = await ai.models.embedContent({
        model: EMBEDDING_MODEL,
        contents: batch,
      });
      
      const embeddings = result.embeddings || [];
      
      batch.forEach((chunkText, index) => {
        const embeddingValues = embeddings[index]?.values;
        if (embeddingValues && embeddingValues.length > 0) {
          processedChunks.push({
            id: `${doc.id}-chunk-${i + index}`,
            text: chunkText,
            embedding: embeddingValues
          });
        }
      });
      
      // Small delay between batches
      if (i + BATCH_SIZE < chunksToProcess.length) {
        await new Promise(resolve => setTimeout(resolve, 500));
      }
    } catch (e: any) {
      console.warn(`Skipping batch ${i} to ${i + BATCH_SIZE} due to error:`, e);
      if (e.message === "API_KEY_MISSING" || e.message?.includes("API key not valid")) {
        throw new Error(e.message === "API_KEY_MISSING" ? "Falta la clave API de Gemini. Configura GEMINI_API_KEY en Settings." : "La clave API de Gemini configurada no es válida.");
      }
    }
  }

  return {
    ...doc,
    chunks: processedChunks,
    isIndexed: true
  };
};

async function retrieveRelevantChunks(question: string, documents: UploadedDocument[], topK: number = 5): Promise<string[]> {
  const questionEmbedding = await getEmbedding(question);
  if (questionEmbedding.length === 0) return [];

  const allChunks: { text: string; score: number, docName: string }[] = [];

  documents.forEach(doc => {
    doc.chunks.forEach(chunk => {
      if (chunk.embedding) {
        const score = cosineSimilarity(questionEmbedding, chunk.embedding);
        allChunks.push({ 
          text: chunk.text, 
          score, 
          docName: doc.name 
        });
      }
    });
  });

  allChunks.sort((a, b) => b.score - a.score);
  return allChunks.slice(0, topK).map(c => `[Fuente: ${c.docName}] ...${c.text}...`);
}

// --- AUDIO TRANSCRIPTION ---

// Helper to convert Blob to Base64
const blobToBase64 = (blob: Blob): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const result = reader.result as string;
      const base64 = result.split(',')[1]; // remove data:audio/xxx;base64,
      resolve(base64);
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
};

export const transcribeAudio = async (audioBlob: Blob): Promise<string> => {
  try {
    const base64Audio = await blobToBase64(audioBlob);
    
    const ai = getGeminiClient();
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash", // Multimodal capable
      contents: {
        parts: [
          {
            inlineData: {
              mimeType: audioBlob.type || "audio/webm",
              data: base64Audio
            }
          },
          {
            text: "Transcribe this audio exactly as spoken. Do not answer the question, just output the text transcript in the same language as the audio."
          }
        ]
      }
    });

    return response.text || "";
  } catch (error) {
    console.error("Error transcribing audio:", error);
    throw new Error("No se pudo transcribir el audio.");
  }
};

// --- MAIN QUERY FUNCTION ---

export const queryLegalAssistant = async (
  question: string,
  documents: UploadedDocument[]
): Promise<LegalResponse> => {
  
  if (documents.length === 0) {
    return {
      answer: "Por favor, carga primero un documento para que pueda analizarlo.",
      source_excerpts: [],
      confidence_score: 0
    };
  }

  const totalLength = documents.reduce((acc, doc) => acc + doc.content.length, 0);
  let contextToUse = "";
  
  // Logic:
  // If document fits in context (which is huge for Gemini 2.5), use Full Context for max accuracy.
  // Otherwise, fall back to RAG.
  if (totalLength < FULL_CONTEXT_THRESHOLD) {
      // FULL ACCURACY MODE
      contextToUse = documents.map(d => `--- DOCUMENTO: ${d.name} ---\n${d.content}`).join("\n\n");
  } else {
      // MASSIVE DOCUMENT MODE (Fallback)
      const vectorChunks = await retrieveRelevantChunks(question, documents, 10);
      const preambles = documents.map(d => `[INICIO DEL DOCUMENTO ${d.name}]: ${d.content.substring(0, 5000)}...`).join("\n\n");
      
      contextToUse = `
      SECCIONES INTRODUCTORIAS (Contexto General):
      ${preambles}

      FRAGMENTOS ESPECÍFICOS ENCONTRADOS (Contexto RAG):
      ${vectorChunks.join("\n\n")}
      `;
  }

  const prompt = `
  CONTEXTO DOCUMENTAL:
  """
  ${contextToUse}
  """

  PREGUNTA DEL USUARIO:
  "${question}"
  `;

  try {
    const ai = getGeminiClient();
    const response = await ai.models.generateContent({
      model: GENERATION_MODEL,
      contents: [
        {
          role: "user",
          parts: [{ text: prompt }]
        }
      ],
      config: {
        systemInstruction: SYSTEM_INSTRUCTION,
        responseMimeType: "application/json",
        responseSchema: responseSchema,
        temperature: 0.0, // Max determinism
      },
    });

    const textResponse = response.text;
    
    if (!textResponse) {
      throw new Error("Empty response from Gemini");
    }

    const parsed: LegalResponse = JSON.parse(textResponse);
    return parsed;

  } catch (error: any) {
    console.error("Error querying Gemini:", error);
    if (error.message === "API_KEY_MISSING") {
      return {
        answer: "⚠️ Error: No se ha configurado una clave API de Gemini. Por favor, añade la variable GEMINI_API_KEY en los Settings con una clave válida (AIza...).",
        source_excerpts: [],
        confidence_score: 0
      };
    }
    if (error.message?.includes("API key not valid")) {
       return {
        answer: "⚠️ Error: La clave API de Gemini configurada no es válida o ha sido revocada. Por favor, genera una nueva clave en Google AI Studio y actualízala en los Settings.",
        source_excerpts: [],
        confidence_score: 0
      };
    }
    return {
      answer: "Lo siento, hubo un problema técnico al analizar el documento. Por favor, intenta reformular tu pregunta.",
      source_excerpts: [],
      confidence_score: 0
    };
  }
};
