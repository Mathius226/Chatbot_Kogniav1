import React, { useState, useRef, useEffect } from 'react';
import { Sidebar } from './components/Sidebar';
import { MessageItem } from './components/MessageItem';
import { Button } from './components/Button';
import { AudioRecorder } from './components/AudioRecorder';
import { UploadedDocument, ChatMessage, Sender } from './types';
import { queryLegalAssistant, indexDocument, transcribeAudio } from './services/geminiService';
import { extractTextFromFile } from './services/fileProcessing';

const SUGGESTIONS = [
  { text: "¿Cuál es el objeto del contrato?", icon: "🎯" },
  { text: "¿Qué obligaciones tengo?", icon: "⚖️" },
  { text: "¿Hay cláusula de confidencialidad?", icon: "🔒" },
  { text: "¿Cómo se puede terminar el acuerdo?", icon: "🚪" }
];

const App: React.FC = () => {
  const [documents, setDocuments] = useState<UploadedDocument[]>([]);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isIndexing, setIsIndexing] = useState(false); 
  const [dragActive, setDragActive] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false); // Rule 12 Mobile Sidebar
  
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isLoading, isIndexing]);

  // --- File Handling ---

  const processFiles = async (files: FileList) => {
    if (!files || files.length === 0) return;
    setIsIndexing(true);
    
    const tempId = 'indexing-' + Date.now();
    // Rule 2: Visual Progress Indicator
    setMessages(prev => [...prev, {
        id: tempId,
        sender: Sender.System,
        text: `Analizando ${files.length} documento(s)...`,
        timestamp: new Date()
    }]);

    const processedDocs: UploadedDocument[] = [];

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      try {
        const processed = await extractTextFromFile(file);
        
        const rawDoc: UploadedDocument = {
          id: Math.random().toString(36).substring(7),
          name: file.name,
          content: processed.text,
          chunks: [],
          isIndexed: false,
          type: file.type,
          size: file.size,
          pageCount: processed.pageCount,
          uploadDate: new Date()
        };
        
        const indexedDoc = await indexDocument(rawDoc);
        processedDocs.push(indexedDoc);
      } catch (err: any) {
        console.error("Error reading/indexing file", err);
        setMessages(prev => [...prev, {
            id: 'err-' + Date.now(),
            sender: Sender.System,
            text: `⚠️ Error con ${file.name}: ${err.message}`,
            timestamp: new Date()
        }]);
      }
    }

    setMessages(prev => prev.filter(m => m.id !== tempId));

    if (processedDocs.length > 0) {
      setDocuments(prev => [...prev, ...processedDocs]);
      // Rule 2: Success Message
      setMessages(prev => [...prev, {
        id: Date.now().toString(),
        sender: Sender.System,
        text: `✅ Documento listo. Puedes hacer preguntas sobre su contenido.`,
        timestamp: new Date()
      }]);
    }
    setIsIndexing(false);
  };

  const handleFileUpload = (files: FileList) => {
    processFiles(files);
  };

  const handleRemoveDocument = (id: string) => {
    setDocuments(prev => prev.filter(doc => doc.id !== id));
    if (documents.length === 1) {
        setMessages([]); // Clear chat if last doc removed
    }
  };

  const handleClearChat = () => { // Rule 9
      setMessages([]);
      setSidebarOpen(false);
  };

  // --- Drag & Drop ---

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      processFiles(e.dataTransfer.files);
    }
  };

  // --- Chat Logic ---

  const handleSendMessage = async (textOverride?: string) => {
    const text = textOverride || inputValue;
    if (!text.trim() || isLoading || isIndexing) return;

    setInputValue('');

    const userMsg: ChatMessage = {
      id: Date.now().toString(),
      sender: Sender.User,
      text: text,
      timestamp: new Date()
    };
    setMessages(prev => [...prev, userMsg]);
    
    await processQuery(text);
  };

  const handleAudioMessage = async (blob: Blob) => {
      setIsLoading(true);
      const audioUrl = URL.createObjectURL(blob);
      
      // 1. Show recording immediately
      const tempAudioId = Date.now().toString();
      setMessages(prev => [...prev, {
          id: tempAudioId,
          sender: Sender.User,
          audioUrl: audioUrl,
          text: "Procesando audio...", // Placeholder
          timestamp: new Date()
      }]);

      try {
          // 2. Transcribe
          const transcribedText = await transcribeAudio(blob);
          
          // 3. Update user message with text
          setMessages(prev => prev.map(msg => {
              if (msg.id === tempAudioId) {
                  return { ...msg, text: transcribedText };
              }
              return msg;
          }));

          // 4. Query with transcribed text
          await processQuery(transcribedText);

      } catch (error) {
          console.error(error);
          setMessages(prev => [...prev, {
              id: 'err-' + Date.now(),
              sender: Sender.System,
              text: "Error al procesar el audio. Intenta de nuevo.",
              timestamp: new Date()
          }]);
          setIsLoading(false);
      }
  };

  const processQuery = async (queryText: string) => {
    setIsLoading(true);

    const thinkingId = 'thinking-' + Date.now();
    setMessages(prev => [...prev, {
        id: thinkingId,
        sender: Sender.Bot,
        timestamp: new Date(),
        isThinking: true
    }]);

    try {
      const response = await queryLegalAssistant(queryText, documents);
      
      setMessages(prev => prev.map(msg => {
        if (msg.id === thinkingId) {
            return {
                id: Date.now().toString(),
                sender: Sender.Bot,
                timestamp: new Date(),
                isThinking: false,
                structuredResponse: response
            };
        }
        return msg;
      }));
    } catch (error) {
        setMessages(prev => prev.filter(msg => msg.id !== thinkingId));
        setMessages(prev => [...prev, {
            id: 'error-gen',
            sender: Sender.System,
            text: "El documento no contiene información suficiente sobre ese tema. ¿Quieres intentar con otra pregunta?", // Rule 4
            timestamp: new Date()
        }]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        handleSendMessage();
      }
  };

  return (
    <div 
        className="flex h-screen overflow-hidden bg-[#FDFDFD] font-sans text-slate-800"
        onDragEnter={handleDrag}
        onDragOver={handleDrag}
        onDragLeave={handleDrag}
        onDrop={handleDrop}
    >
      {/* Drag Overlay */}
      {dragActive && (
        <div className="absolute inset-0 z-50 bg-indigo-600/10 backdrop-blur-sm border-4 border-indigo-500 border-dashed m-4 rounded-3xl flex items-center justify-center pointer-events-none">
          <div className="bg-white p-8 rounded-2xl shadow-2xl flex flex-col items-center animate-bounce">
             <svg className="w-16 h-16 text-indigo-600 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" /></svg>
             <p className="text-xl font-bold text-indigo-900">Suelta el archivo aquí</p>
          </div>
        </div>
      )}

      {/* Sidebar (Responsive Rule 12) */}
      <Sidebar 
        documents={documents} 
        onFileUpload={handleFileUpload}
        onRemoveDocument={handleRemoveDocument}
        onClearChat={handleClearChat}
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
      />

      {/* Main Chat Area */}
      <main className="flex-1 flex flex-col h-full relative w-full">
        
        {/* Header Mobile */}
        <header className="absolute top-0 left-0 right-0 px-6 py-4 flex justify-between items-center z-10 bg-[#FDFDFD]/80 backdrop-blur-md md:bg-transparent">
            <div className="flex items-center gap-3 md:hidden">
                <button onClick={() => setSidebarOpen(true)} className="p-2 -ml-2 text-slate-500 hover:bg-slate-100 rounded-lg">
                    <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" /></svg>
                </button>
                <span className="font-bold text-lg text-slate-800">Kognia.ai</span>
            </div>
            <div className="ml-auto">
               {isIndexing && (
                 <div className="flex items-center gap-2 bg-white px-4 py-2 rounded-full shadow-sm border border-indigo-100">
                    <div className="w-4 h-4 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
                    <span className="text-xs font-medium text-indigo-600">Procesando...</span>
                 </div>
               )}
            </div>
        </header>

        {/* Messages Area */}
        <div className="flex-1 overflow-y-auto custom-scrollbar">
          <div className="max-w-3xl mx-auto px-6 pt-20 pb-6 min-h-full flex flex-col">
             
             {/* Empty State (Rule 1) */}
             {messages.length === 0 ? (
                <div className="flex-1 flex flex-col justify-center items-center text-center pb-20 animate-fade-in-up">
                    <div className="w-24 h-24 bg-white rounded-[2rem] flex items-center justify-center shadow-xl shadow-slate-200 mb-8 border border-slate-50 relative overflow-hidden group">
                         <div className="absolute inset-0 bg-gradient-to-tr from-indigo-50 to-white opacity-50 group-hover:scale-110 transition-transform duration-700"></div>
                        <span className="text-5xl relative z-10">⚖️</span>
                    </div>
                    <h2 className="text-3xl font-bold text-slate-900 mb-4 tracking-tight">Asistente Legal Inteligente</h2>
                    <p className="text-slate-500 max-w-md mb-10 leading-relaxed text-[15px]">
                        Bienvenido. Sube un documento legal (PDF o TXT) para comenzar. Luego podrás hacer preguntas sobre su contenido.
                    </p>

                    {/* Suggestions (Rule 7) */}
                    {documents.length > 0 && (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 w-full max-w-xl">
                            {SUGGESTIONS.map((s, i) => (
                                <button 
                                    key={i}
                                    onClick={() => handleSendMessage(s.text)}
                                    className="flex items-center gap-3 p-4 bg-white border border-slate-100 rounded-2xl shadow-sm hover:shadow-md hover:border-indigo-200 hover:-translate-y-0.5 transition-all duration-300 text-left group"
                                >
                                    <span className="text-xl bg-slate-50 p-2 rounded-lg group-hover:bg-indigo-50 transition-colors">{s.icon}</span>
                                    <span className="text-sm font-medium text-slate-600 group-hover:text-indigo-700">{s.text}</span>
                                </button>
                            ))}
                        </div>
                    )}

                    {documents.length === 0 && (
                        <div className="border-2 border-dashed border-slate-200 rounded-3xl p-10 w-full max-w-md bg-slate-50/50">
                            <p className="text-sm text-slate-400 font-medium mb-4">Arrastra tu archivo aquí</p>
                            <Button variant="primary" onClick={() => (document.querySelector('input[type="file"]') as HTMLInputElement)?.click()}>
                                Seleccionar Documento
                            </Button>
                        </div>
                    )}
                </div>
             ) : (
                 /* Messages List */
                 <div className="space-y-6">
                    {messages.map((msg) => (
                        <MessageItem key={msg.id} message={msg} />
                    ))}
                 </div>
             )}
             <div ref={messagesEndRef} />
          </div>
        </div>

        {/* Input Area */}
        <div className="p-4 md:p-6 bg-[#FDFDFD] relative z-20">
          <div className="max-w-3xl mx-auto">
             <form onSubmit={(e) => { e.preventDefault(); handleSendMessage(); }} 
                   className={`
                       relative flex items-end gap-2 bg-white rounded-[2rem] shadow-[0_5px_40px_rgba(0,0,0,0.04)] border border-slate-100 p-2 transition-all duration-300
                       ${isIndexing ? 'opacity-70 pointer-events-none grayscale' : ''}
                       ${inputValue ? 'ring-2 ring-indigo-500/10 border-indigo-200' : ''}
                   `}>
                
                {/* Audio Recorder */}
                <AudioRecorder 
                  onRecordingComplete={handleAudioMessage}
                  disabled={documents.length === 0 || isLoading} 
                />

                <textarea
                    value={inputValue}
                    onChange={(e) => setInputValue(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder={documents.length === 0 ? "Sube un documento primero..." : "Escribe o graba tu pregunta..."}
                    disabled={documents.length === 0 || isLoading || isIndexing}
                    className="w-full bg-transparent text-slate-700 font-medium placeholder:text-slate-400 px-3 py-4 focus:outline-none resize-none max-h-32 text-[15px]"
                    rows={1}
                    style={{ minHeight: '56px' }}
                />

                <Button 
                    type="submit" 
                    disabled={!inputValue.trim() || isLoading || documents.length === 0}
                    className={`
                        h-12 w-12 rounded-full flex items-center justify-center flex-shrink-0 mb-1 mr-1 transition-all duration-300
                        ${inputValue.trim() ? 'bg-slate-900 text-white shadow-lg shadow-slate-800/20 scale-100' : 'bg-slate-100 text-slate-300 scale-95'}
                    `}
                >
                    {isLoading ? (
                         <svg className="animate-spin h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                         </svg>
                    ) : (
                        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                           <path strokeLinecap="round" strokeLinejoin="round" d="M5 12h14M12 5l7 7-7 7" />
                        </svg>
                    )}
                </Button>
             </form>
             <div className="text-center mt-3">
                <p className="text-[10px] text-slate-400 font-medium opacity-60 inline-block px-3 py-1 bg-slate-50 rounded-full">
                    Kognia Legal AI • Respuestas basadas estrictamente en el documento
                </p>
             </div>
          </div>
        </div>
      </main>
    </div>
  );
};

export default App;