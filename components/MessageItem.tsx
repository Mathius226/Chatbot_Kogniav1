import React, { useState } from 'react';
import { ChatMessage, Sender } from '../types';

interface MessageItemProps {
  message: ChatMessage;
  onFeedback?: (messageId: string, type: 'up' | 'down') => void;
}

export const MessageItem: React.FC<MessageItemProps> = ({ message, onFeedback }) => {
  const isUser = message.sender === Sender.User;
  const isBot = message.sender === Sender.Bot;
  const isSystem = message.sender === Sender.System;
  const [copied, setCopied] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);

  const handleCopy = () => {
    const textToCopy = message.structuredResponse?.answer || message.text || "";
    navigator.clipboard.writeText(textToCopy);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleSpeak = () => {
    const textToSpeak = message.structuredResponse?.answer || message.text;
    if (!textToSpeak) return;

    if (isSpeaking) {
      window.speechSynthesis.cancel();
      setIsSpeaking(false);
      return;
    }

    const utterance = new SpeechSynthesisUtterance(textToSpeak);
    utterance.lang = 'es-ES';
    utterance.rate = 1.0;
    
    utterance.onend = () => setIsSpeaking(false);
    utterance.onerror = () => setIsSpeaking(false);

    setIsSpeaking(true);
    window.speechSynthesis.speak(utterance);
  };

  if (message.isThinking) {
    return (
      <div className="flex justify-start mb-8 animate-fade-in-up">
        <div className="flex items-center gap-3 bg-white border border-slate-100 px-5 py-4 rounded-3xl rounded-tl-none shadow-sm">
          <div className="flex gap-1.5">
            <div className="w-2 h-2 bg-indigo-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
            <div className="w-2 h-2 bg-indigo-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
            <div className="w-2 h-2 bg-indigo-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
          </div>
          <span className="text-sm text-slate-500 font-medium">Analizando documento...</span>
        </div>
      </div>
    );
  }

  if (isSystem) {
    return (
        <div className="flex justify-center mb-6 animate-fade-in-up">
            <div className="bg-slate-100/80 backdrop-blur-sm px-4 py-2 rounded-full border border-slate-200">
                <p className="text-xs text-slate-500 font-medium flex items-center gap-2">
                    <svg className="w-3 h-3 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                    {message.text}
                </p>
            </div>
        </div>
    );
  }

  // Confidence Color Logic (Rule 13)
  const getConfidenceConfig = (score: number) => {
      if (score >= 90) return { color: 'bg-blue-500', text: 'Alta', bg: 'bg-blue-50', textCol: 'text-blue-700' };
      if (score >= 50) return { color: 'bg-amber-400', text: 'Media', bg: 'bg-amber-50', textCol: 'text-amber-700' };
      return { color: 'bg-rose-500', text: 'Baja', bg: 'bg-rose-50', textCol: 'text-rose-700' };
  };

  const confConfig = message.structuredResponse ? getConfidenceConfig(message.structuredResponse.confidence_score) : null;

  return (
    <div className={`flex mb-8 animate-fade-in-up group ${isUser ? 'justify-end' : 'justify-start'}`}>
      {isBot && (
        <div className="hidden sm:flex w-10 h-10 bg-gradient-to-br from-slate-800 to-black rounded-full flex-shrink-0 items-center justify-center mr-4 mt-1 shadow-lg shadow-slate-300/50">
          <span className="text-white text-xs font-bold">AI</span>
        </div>
      )}
      
      <div className={`max-w-[95%] sm:max-w-[85%] md:max-w-[75%] ${isUser ? 'order-1' : 'order-2'}`}>
        <div 
          className={`
            relative px-6 py-5 text-sm leading-relaxed shadow-sm transition-all duration-200
            ${isUser 
              ? 'bg-slate-900 text-white rounded-3xl rounded-tr-none shadow-xl shadow-indigo-500/10' 
              : 'bg-white border border-slate-100 text-slate-700 rounded-3xl rounded-tl-none shadow-md shadow-slate-200/40'
            }
          `}
        >
          {/* Audio Player for User Voice Messages */}
          {message.audioUrl && (
            <div className={`mb-3 ${isUser ? 'text-white' : 'text-slate-800'}`}>
              <audio controls src={message.audioUrl} className="h-8 w-full max-w-[200px]" />
            </div>
          )}

          {/* Main Content */}
          {isUser ? (
            <p className="font-medium text-[15px]">{message.text}</p>
          ) : (
            <div className="space-y-4">
              {/* The Answer */}
              <div className="prose prose-sm max-w-none text-slate-800 font-sans text-[15px] leading-7">
                {message.structuredResponse?.answer || message.text}
              </div>
              
              {/* Source Excerpts (Rule 3) */}
              {message.structuredResponse?.source_excerpts && message.structuredResponse.source_excerpts.length > 0 && (
                <div className="mt-4 pt-4 border-t border-slate-100">
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-3 flex items-center gap-2">
                    <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                    Fuente del documento
                  </p>
                  <div className="grid gap-3">
                    {message.structuredResponse.source_excerpts.map((excerpt, idx) => (
                      <div key={idx} className="bg-slate-50 p-3 rounded-lg border-l-4 border-indigo-200 text-xs text-slate-600 relative">
                         {excerpt}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Footer: Confidence & Actions */}
              <div className="flex items-center justify-between pt-2 mt-1">
                  <div className="flex items-center gap-3">
                      {/* Confidence Badge */}
                      {confConfig && message.structuredResponse && (
                        <div className={`flex items-center gap-2 px-2.5 py-1 rounded-md ${confConfig.bg}`}>
                            <div className={`w-2 h-2 rounded-full ${confConfig.color}`}></div>
                            <span className={`text-[10px] font-bold ${confConfig.textCol}`}>
                                {confConfig.text} ({message.structuredResponse.confidence_score}%)
                            </span>
                        </div>
                      )}

                      {/* Read Aloud Button (Accessibility) */}
                      <button
                        onClick={handleSpeak}
                        className={`flex items-center gap-1.5 text-[10px] font-medium transition-colors px-2 py-1 rounded hover:bg-slate-50 ${isSpeaking ? 'text-indigo-600 animate-pulse' : 'text-slate-400 hover:text-indigo-600'}`}
                        title="Leer en voz alta"
                      >
                         {isSpeaking ? (
                           <>
                             <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" /></svg>
                             <span>Leyendo...</span>
                           </>
                         ) : (
                            <>
                             <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" /></svg>
                             <span>Escuchar</span>
                            </>
                         )}
                      </button>
                  </div>

                  {/* Copy Button (Rule 14) */}
                  <div className="flex items-center gap-2">
                    {onFeedback && (
                      <div className="flex items-center gap-1 mr-2 border-r border-slate-200 pr-2">
                        <button 
                          onClick={() => onFeedback(message.id, 'up')}
                          className={`p-1 rounded hover:bg-slate-100 transition-colors ${message.feedback === 'up' ? 'text-green-600 bg-green-50' : 'text-slate-400'}`}
                          title="Útil"
                        >
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M14 10h4.764a2 2 0 011.789 2.894l-3.5 7A2 2 0 0115.263 21h-4.017c-.163 0-.326-.02-.485-.06L7 20m7-10V5a2 2 0 00-2-2h-.095c-.5 0-.905.405-.905.905 0 .714-.211 1.412-.608 2.006L7 11v9m7-10h-2M7 20H5a2 2 0 01-2-2v-6a2 2 0 012-2h2.514" /></svg>
                        </button>
                        <button 
                          onClick={() => onFeedback(message.id, 'down')}
                          className={`p-1 rounded hover:bg-slate-100 transition-colors ${message.feedback === 'down' ? 'text-red-600 bg-red-50' : 'text-slate-400'}`}
                          title="No útil"
                        >
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 14H5.236a2 2 0 01-1.789-2.894l3.5-7A2 2 0 018.736 3h4.018a2 2 0 01.485.06l3.76.94m-7 10v5a2 2 0 002 2h.096c.5 0 .905-.405.905-.904 0-.714.211-1.412.608-2.006L17 13V4m-7 10h2m5-10h2a2 2 0 012 2v6a2 2 0 01-2 2h-2.514" /></svg>
                        </button>
                      </div>
                    )}
                    <button 
                      onClick={handleCopy}
                      className="flex items-center gap-1.5 text-[10px] font-medium text-slate-400 hover:text-indigo-600 transition-colors px-2 py-1 rounded hover:bg-slate-50"
                    >
                        {copied ? (
                            <>
                              <svg className="w-3.5 h-3.5 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" /></svg>
                              <span className="text-green-500">Copiado</span>
                            </>
                        ) : (
                            <>
                              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3" /></svg>
                              <span>Copiar</span>
                            </>
                        )}
                    </button>
                  </div>
              </div>
            </div>
          )}
        </div>
        
        <span className={`text-[10px] text-slate-300 mt-2 block font-medium ${isUser ? 'text-right mr-1' : 'ml-1'}`}>
          {message.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
        </span>
      </div>
    </div>
  );
};