import React, { useRef } from 'react';
import { UploadedDocument } from '../types';
import { Button } from './Button';
import { FileIcon } from './FileIcon';

interface SidebarProps {
  documents: UploadedDocument[];
  onFileUpload: (files: FileList) => void;
  onRemoveDocument: (id: string) => void;
  onClearChat: () => void; // Rule 9
  isOpen: boolean; // Mobile state
  onClose: () => void; // Mobile state
}

export const Sidebar: React.FC<SidebarProps> = ({ 
    documents, 
    onFileUpload, 
    onRemoveDocument, 
    onClearChat,
    isOpen,
    onClose
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      onFileUpload(e.target.files);
      onClose(); // Close sidebar on mobile after upload
    }
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const formatSize = (bytes: number) => {
      if (bytes < 1024) return bytes + ' B';
      if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
      return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  };

  return (
    <>
    {/* Mobile Overlay */}
    {isOpen && (
        <div 
            className="fixed inset-0 bg-slate-900/20 backdrop-blur-sm z-30 md:hidden"
            onClick={onClose}
        ></div>
    )}

    {/* Sidebar Container */}
    <div className={`
        fixed md:static inset-y-0 left-0 z-40 w-80 bg-[#FDFDFD] border-r border-slate-100 
        transform transition-transform duration-300 ease-in-out flex flex-col shadow-[1px_0_20px_rgba(0,0,0,0.02)]
        ${isOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}
    `}>
      {/* Header */}
      <div className="p-6 pt-8 flex justify-between items-center">
        <div>
            <div className="flex items-center gap-3 mb-1">
            <div className="w-8 h-8 bg-slate-900 rounded-xl flex items-center justify-center shadow-lg shadow-slate-800/20">
                <span className="text-white font-serif font-bold text-lg">A</span>
            </div>
            <h1 className="font-sans text-xl font-bold text-slate-800 tracking-tight">Asistente<span className="text-indigo-600">.ai</span></h1>
            </div>
            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mt-1 pl-1">Asistente Municipal</p>
        </div>
        <button onClick={onClose} className="md:hidden p-2 text-slate-400 hover:text-slate-600">
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-6 pb-4 space-y-3">
        <div className="bg-slate-50 rounded-2xl p-4 border border-slate-100 shadow-sm text-sm text-slate-600">
          Este asistente responde preguntas basándose únicamente en los documentos oficiales del municipio cargados por el administrador.
        </div>
      </div>
      
      {/* Footer Actions */}
      <div className="p-6 mt-auto space-y-3">
         {/* Clear Chat (Rule 9) */}
         <button 
            onClick={onClearChat}
            className="w-full flex items-center justify-center gap-2 text-xs font-medium text-slate-500 hover:text-slate-800 py-2.5 rounded-xl hover:bg-slate-100 transition-colors"
         >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
            Limpiar Conversación
         </button>

         {/* Legal Disclaimer (Rule 11) */}
         <div className="bg-indigo-50/50 rounded-xl p-3 border border-indigo-100">
            <p className="text-[10px] text-indigo-800/70 leading-relaxed text-center">
                <strong>Nota:</strong> Las respuestas se generan mediante IA basada únicamente en los documentos subidos. No constituye asesoría legal profesional.
            </p>
         </div>
      </div>
    </div>
    </>
  );
};