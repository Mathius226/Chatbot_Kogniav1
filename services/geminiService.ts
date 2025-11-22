import { GoogleGenAI, Type, Schema } from "@google/genai";
import { UploadedDocument, LegalResponse, DocumentChunk } from "../types";

// Initialize Gemini Client
const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

// --- RAG CONSTANTS ---
const CHUNK_SIZE = 1000; // Characters per chunk
const CHUNK_OVERLAP = 200; // Overlap to maintain context
const EMBEDDING_MODEL = "text-embedding-004";
const GENERATION_MODEL = "gemini-2.5-flash";

// Threshold to switch from Full Context to Vector RAG
const FULL_CONTEXT_THRESHOLD = 60000; 

// --- SYSTEM INSTRUCTION ---
const SYSTEM_INSTRUCTION = `
ROL: Kognia Legal AI - Asistente Legal Claro y Accesible.

OBJETIVO: Explicar documentos legales a personas NO expertas en derecho.

REGLAS DE ESTILO (UX):
1. LENGUAJE SENCILLO: Evita la jerga legal ("legalese") innecesaria. En lugar de "La parte contratante se obliga a...", di "El contratista debe...".
2. RESPUESTAS DIRECTAS: Ve al grano. Ejemplo: "El contrato dura 1 año", no "Según la cláusula quinta del presente acuerdo...".
3. CERO ALUCINACIÓN: Si la respuesta no está en el texto, di: "El documento no contiene información suficiente sobre ese tema." y pon confidence_score en 0.
4. EVIDENCIA: Todo lo que digas debe estar respaldado por el texto.
5. FORMATO: Usa párrafos cortos.

Estructura JSON de Salida:
- answer: La respuesta explicativa y fácil de leer.
- source_excerpts: Array de strings con las citas EXACTAS del texto original que prueban tu respuesta. Incluye número de página si es posible verla en el contexto.
- confidence_score: Un número entero (0-100). 
   - 90-100: Alta confianza (Explícito).
   - 50-89: Confianza media (Infeirdo).
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
    const result = await ai.models.embedContent({
      model: EMBEDDING_MODEL,
      content: { parts: [{ text }] },
    });
    return result.embedding.values;
  } catch (error) {
    console.error("Error getting embedding:", error);
    return [];
  }
}

export const indexDocument = async (doc: UploadedDocument): Promise<UploadedDocument> => {
  const textChunks = chunkText(doc.content, CHUNK_SIZE, CHUNK_OVERLAP);
  const processedChunks: DocumentChunk[] = [];
  const maxChunksToIndex = 50; 
  
  for (let i = 0; i < Math.min(textChunks.length, maxChunksToIndex); i++) {
    const chunkText = textChunks[i];
    try {
        const embedding = await getEmbedding(chunkText);
        if (embedding.length > 0) {
        processedChunks.push({
            id: `${doc.id}-chunk-${i}`,
            text: chunkText,
            embedding: embedding
        });
        }
    } catch (e) {
        console.warn("Skipping chunk embedding due to error");
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
  let mode = "";

  if (totalLength < FULL_CONTEXT_THRESHOLD) {
      mode = "FULL_CONTEXT";
      contextToUse = documents.map(d => `--- DOCUMENTO: ${d.name} ---\n${d.content}`).join("\n\n");
  } else {
      mode = "HYBRID_RAG";
      const vectorChunks = await retrieveRelevantChunks(question, documents, 6);
      const preambles = documents.map(d => `[INICIO DEL DOCUMENTO ${d.name}]: ${d.content.substring(0, 3000)}...`).join("\n\n");
      
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
        temperature: 0.0,
      },
    });

    const textResponse = response.text;
    
    if (!textResponse) {
      throw new Error("Empty response from Gemini");
    }

    const parsed: LegalResponse = JSON.parse(textResponse);
    return parsed;

  } catch (error) {
    console.error("Error querying Gemini:", error);
    return {
      answer: "Lo siento, hubo un problema técnico al analizar el documento. Por favor, intenta reformular tu pregunta.",
      source_excerpts: [],
      confidence_score: 0
    };
  }
};