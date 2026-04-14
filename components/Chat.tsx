import React, { useState, useRef, useEffect } from 'react';
import { Sidebar } from './Sidebar';
import { MessageItem } from './MessageItem';
import { Button } from './Button';
import { AudioRecorder } from './AudioRecorder';
import { ChatMessage, Sender } from '../types';
import { transcribeAudio } from '../services/geminiService';

const SUGGESTIONS = [
  { text: "¿Cuáles son los requisitos para vacaciones?", icon: "🏖️" },
  { text: "¿Cómo solicito un permiso médico?", icon: "🏥" },
  { text: "¿Cuál es el horario de atención al público?", icon: "⏰" },
  { text: "¿Qué dice el reglamento sobre vestimenta?", icon: "👔" }
];

export const Chat: React.FC = () => {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isLoading]);

  const handleClearChat = () => {
      setMessages([]);
      setSidebarOpen(false);
  };

  const handleFeedback = async (messageId: string, type: 'up' | 'down') => {
    setMessages(prev => prev.map(msg => 
      msg.id === messageId ? { ...msg, feedback: type } : msg
    ));

    const msg = messages.find(m => m.id === messageId);
    if (!msg) return;

    // Find the question (the user message right before this bot message)
    const msgIndex = messages.findIndex(m => m.id === messageId);
    let question = "Desconocida";
    if (msgIndex > 0 && messages[msgIndex - 1].sender === Sender.User) {
      question = messages[msgIndex - 1].text || "Audio";
    }

    try {
      await fetch('/api/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messageId,
          type,
          question,
          answer: msg.structuredResponse?.answer || msg.text || ""
        })
      });
    } catch (error) {
      console.error("Error saving feedback:", error);
    }
  };

  const handleSendMessage = async (textOverride?: string) => {
    const text = textOverride || inputValue;
    if (!text.trim() || isLoading) return;

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
      
      const tempAudioId = Date.now().toString();
      setMessages(prev => [...prev, {
          id: tempAudioId,
          sender: Sender.User,
          audioUrl: audioUrl,
          text: "Procesando audio...",
          timestamp: new Date()
      }]);

      try {
          const transcribedText = await transcribeAudio(blob);
          
          setMessages(prev => prev.map(msg => {
              if (msg.id === tempAudioId) {
                  return { ...msg, text: transcribedText };
              }
              return msg;
          }));

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
    console.log("processQuery started with:", queryText);
    setIsLoading(true);

    const thinkingId = 'thinking-' + Date.now();
    setMessages(prev => [...prev, {
        id: thinkingId,
        sender: Sender.Bot,
        timestamp: new Date(),
        isThinking: true
    }]);

    try {
      console.log("Fetching /api/chat...");
      
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 30000); // 30 seconds timeout
      
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ queryText }),
        signal: controller.signal
      });
      clearTimeout(timeoutId);
      console.log("Fetch response status:", res.status);

      if (!res.ok) throw new Error("Error en el servidor: " + res.status);
      const data = await res.json();
      console.log("Fetch response data:", data);

      setMessages(prev => prev.map(msg => {
        if (msg.id === thinkingId) {
            console.log("Replacing thinking message with response");
            return {
                id: data.statId || Date.now().toString(),
                sender: Sender.Bot,
                timestamp: new Date(),
                isThinking: false,
                structuredResponse: data.response
            };
        }
        return msg;
      }));

    } catch (error) {
        console.error("Error en processQuery:", error);
        setMessages(prev => {
            const filtered = prev.filter(msg => msg.id !== thinkingId);
            return [...filtered, {
                id: 'error-gen-' + Date.now(),
                sender: Sender.System,
                text: "Hubo un error de conexión con el servidor. Por favor, revisa tu conexión o intenta de nuevo.",
                timestamp: new Date()
            }];
        });
    } finally {
      console.log("processQuery finished");
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
    <div className="flex h-screen overflow-hidden bg-[#FDFDFD] font-sans text-slate-800">
      <Sidebar 
        documents={[]} 
        onFileUpload={() => {}}
        onRemoveDocument={() => {}}
        onClearChat={handleClearChat}
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
      />

      <main className="flex-1 flex flex-col h-full relative w-full">
        <header className="absolute top-0 left-0 right-0 px-6 py-4 flex justify-between items-center z-10 bg-[#FDFDFD]/80 backdrop-blur-md md:bg-transparent">
            <div className="flex items-center gap-3 md:hidden">
                <button onClick={() => setSidebarOpen(true)} className="p-2 -ml-2 text-slate-500 hover:bg-slate-100 rounded-lg">
                    <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" /></svg>
                </button>
                <span className="font-bold text-lg text-slate-800">Asistente Municipal</span>
            </div>
        </header>

        <div className="flex-1 overflow-y-auto custom-scrollbar">
          <div className="max-w-3xl mx-auto px-6 pt-20 pb-6 min-h-full flex flex-col">
             {messages.length === 0 ? (
                <div className="flex-1 flex flex-col justify-center items-center text-center pb-20 animate-fade-in-up">
                    <div className="w-24 h-24 bg-white rounded-[2rem] flex items-center justify-center shadow-xl shadow-slate-200 mb-8 border border-slate-50 relative overflow-hidden group">
                         <div className="absolute inset-0 bg-gradient-to-tr from-indigo-50 to-white opacity-50 group-hover:scale-110 transition-transform duration-700"></div>
                        <span className="text-5xl relative z-10">🏛️</span>
                    </div>
                    <h2 className="text-3xl font-bold text-slate-900 mb-4 tracking-tight">Asistente para Empleados</h2>
                    <p className="text-slate-500 max-w-md mb-10 leading-relaxed text-[15px]">
                        Hazme preguntas sobre los documentos oficiales del municipio.
                    </p>

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
                </div>
             ) : (
                 <div className="space-y-6">
                    {messages.map((msg) => (
                        <MessageItem key={msg.id} message={msg} onFeedback={handleFeedback} />
                    ))}
                 </div>
             )}
             <div ref={messagesEndRef} />
          </div>
        </div>

        <div className="p-4 md:p-6 bg-[#FDFDFD] relative z-20">
          <div className="max-w-3xl mx-auto">
             <form onSubmit={(e) => { e.preventDefault(); handleSendMessage(); }} 
                   className={`
                       relative flex items-end gap-2 bg-white rounded-[2rem] shadow-[0_5px_40px_rgba(0,0,0,0.04)] border border-slate-100 p-2 transition-all duration-300
                       ${inputValue ? 'ring-2 ring-indigo-500/10 border-indigo-200' : ''}
                   `}>
                
                <AudioRecorder 
                  onRecordingComplete={handleAudioMessage}
                  disabled={isLoading} 
                />

                <textarea
                    value={inputValue}
                    onChange={(e) => setInputValue(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder="Escribe o graba tu pregunta..."
                    disabled={isLoading}
                    className="w-full bg-transparent text-slate-700 font-medium placeholder:text-slate-400 px-3 py-4 focus:outline-none resize-none max-h-32 text-[15px]"
                    rows={1}
                    style={{ minHeight: '56px' }}
                />

                <Button 
                    type="submit" 
                    disabled={!inputValue.trim() || isLoading}
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
             <div className="text-center mt-3 flex flex-col items-center gap-2">
                <p className="text-[10px] text-slate-400 font-medium opacity-60 inline-block px-3 py-1 bg-slate-50 rounded-full">
                    Asistente Municipal • Respuestas basadas estrictamente en los documentos oficiales
                </p>
                <a href="/admin" className="text-[10px] text-slate-300 hover:text-slate-500 transition-colors">
                  Acceso Administrador
                </a>
             </div>
          </div>
        </div>
      </main>
    </div>
  );
};
