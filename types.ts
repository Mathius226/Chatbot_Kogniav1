export enum Sender {
  User = 'user',
  Bot = 'bot',
  System = 'system'
}

export interface DocumentChunk {
  id: string;
  text: string;
  embedding?: number[];
}

export interface UploadedDocument {
  id: string;
  name: string;
  content: string;
  chunks: DocumentChunk[]; // Added for RAG
  isIndexed: boolean;      // To track embedding status
  type: string;
  size: number;            // File size in bytes
  pageCount: number;       // Number of pages (1 for TXT)
  uploadDate: Date;
}

export interface LegalResponse {
  answer: string;
  source_excerpts: string[];
  confidence_score: number; // 0 to 100
}

export interface ChatMessage {
  id: string;
  sender: Sender;
  text?: string;
  audioUrl?: string; // URL for the recorded audio blob
  structuredResponse?: LegalResponse;
  timestamp: Date;
  isThinking?: boolean;
}

export interface GenerationState {
  isLoading: boolean;
  error: string | null;
}