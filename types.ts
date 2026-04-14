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
  chunks: DocumentChunk[];
  isIndexed: boolean;
  type: string;
  size: number;
  pageCount: number;
  uploadDate: Date;
}

export interface LegalResponse {
  answer: string;
  source_excerpts: string[];
  confidence_score: number;
}

export interface ChatMessage {
  id: string;
  sender: Sender;
  text?: string;
  audioUrl?: string;
  structuredResponse?: LegalResponse;
  timestamp: Date;
  isThinking?: boolean;
  feedback?: 'up' | 'down';
}

export interface GenerationState {
  isLoading: boolean;
  error: string | null;
}

export interface StatRecord {
  id: string;
  question: string;
  answer: string;
  date: Date;
}