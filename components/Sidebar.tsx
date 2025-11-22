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
                <span className="text-white font-serif font-bold text-lg">K</span>
            </div>
            <h1 className="font-sans text-xl font-bold text-slate-800 tracking-tight">Kognia<span className="text-indigo-600">.ai</span></h1>
            </div>
            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mt-1 pl-1">Asistente Legal AI</p>
        </div>
        <button onClick={onClose} className="md:hidden p-2 text-slate-400 hover:text-slate-600">
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
        </button>
      </div>

      {/* Upload Section */}
      <div className="px-6 mb-6">
        <div className="bg-slate-50 rounded-2xl p-4 border border-slate-100 shadow-sm">
            <h2 className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-3">Subir Archivo</h2>
            <input
                type="file"
                ref={fileInputRef}
                onChange={handleFileChange}
                className="hidden"
                accept=".txt,.pdf" 
                multiple
            />
            <Button 
                onClick={() => fileInputRef.current?.click()} 
                className="w-full justify-center bg-white border border-indigo-100 text-indigo-600 hover:bg-indigo-50 hover:border-indigo-200 shadow-sm py-3 group"
                variant="secondary"
            >
                <div className="flex items-center gap-2">
                    <svg className="w-4 h-4 group-hover:-translate-y-0.5 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" /></svg>
                    <span className="text-sm font-semibold">Seleccionar PDF/TXT</span>
                </div>
            </Button>
        </div>
      </div>

      {/* File List (Rule 5) */}
      <div className="flex-1 overflow-y-auto px-6 pb-4 space-y-3">
        <h3 className="text-[11px] font-bold text-slate-400 uppercase tracking-wider pl-1">Documentos Activos</h3>
        {documents.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-24 text-center border border-dashed border-slate-200 rounded-xl bg-slate-50/50">
                <p className="text-xs text-slate-400 font-medium">Lista vacía</p>
            </div>
        ) : (
            documents.map((doc) => (
            <div key={doc.id} className="group relative p-3 bg-white rounded-xl border border-slate-100 shadow-sm hover:shadow-md transition-all duration-200">
                <div className="flex items-start gap-3">
                    <FileIcon fileName={doc.name} className="w-9 h-9 flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                        <p className="text-xs font-bold text-slate-700 truncate mb-1" title={doc.name}>{doc.name}</p>
                        <div className="flex items-center gap-3 text-[10px] text-slate-400 font-medium">
                            <span>{formatSize(doc.size)}</span>
                            <span className="w-1 h-1 rounded-full bg-slate-300"></span>
                            <span>{doc.pageCount} pág{doc.pageCount !== 1 ? 's' : ''}</span>
                        </div>
                    </div>
                    <button 
                        onClick={() => onRemoveDocument(doc.id)}
                        className="text-slate-300 hover:text-red-500 p-1 rounded-md hover:bg-red-50 transition-colors"
                        title="Eliminar documento"
                    >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                    </button>
                </div>
            </div>
            ))
        )}
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