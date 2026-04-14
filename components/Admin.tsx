import React, { useState, useEffect } from 'react';
import { Button } from './Button';
import { extractTextFromFile } from '../services/fileProcessing';
import { UploadedDocument } from '../types';

export const Admin: React.FC = () => {
  const [password, setPassword] = useState('');
  const [token, setToken] = useState(localStorage.getItem('admin_token') || '');
  const [stats, setStats] = useState<any>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadMessage, setUploadMessage] = useState('');

  useEffect(() => {
    if (token) {
      fetchStats();
    }
  }, [token]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch('/api/admin/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password })
      });
      if (res.ok) {
        const data = await res.json();
        setToken(data.token);
        localStorage.setItem('admin_token', data.token);
      } else {
        alert('Contraseña incorrecta');
      }
    } catch (error) {
      console.error(error);
    }
  };

  const fetchStats = async () => {
    try {
      const res = await fetch('/api/admin/analytics', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setStats(data);
      } else if (res.status === 401) {
        setToken('');
        localStorage.removeItem('admin_token');
      }
    } catch (error) {
      console.error(error);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setIsUploading(true);
    setUploadMessage('Procesando archivos localmente...');

    try {
      const rawDocs: UploadedDocument[] = [];
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const processed = await extractTextFromFile(file);
        rawDocs.push({
          id: Math.random().toString(36).substring(7),
          name: file.name,
          content: processed.text,
          chunks: [],
          isIndexed: false,
          type: file.type,
          size: file.size,
          pageCount: processed.pageCount,
          uploadDate: new Date()
        });
      }

      setUploadMessage('Enviando al servidor para indexar (esto puede tardar)...');
      
      const res = await fetch('/api/admin/reindex', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ newDocuments: rawDocs })
      });

      if (res.ok) {
        const data = await res.json();
        setUploadMessage(`¡Éxito! ${data.count} documentos indexados.`);
        fetchStats();
      } else {
        throw new Error('Error en el servidor al indexar');
      }
    } catch (error: any) {
      setUploadMessage(`Error: ${error.message}`);
    } finally {
      setIsUploading(false);
    }
  };

  if (!token) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <form onSubmit={handleLogin} className="bg-white p-8 rounded-2xl shadow-sm border border-slate-100 w-full max-w-sm">
          <h2 className="text-2xl font-bold text-slate-900 mb-6 text-center">Admin Login</h2>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Contraseña"
            className="w-full px-4 py-3 rounded-xl border border-slate-200 mb-4 focus:ring-2 focus:ring-indigo-500 outline-none"
          />
          <Button type="submit" className="w-full">Entrar</Button>
        </form>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 p-8">
      <div className="max-w-5xl mx-auto">
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-3xl font-bold text-slate-900">Panel de Administración</h1>
          <div className="flex items-center gap-4">
            <a href="/" className="text-indigo-600 hover:text-indigo-800 font-medium text-sm">Ir al Chat</a>
            <button 
              onClick={() => { setToken(''); localStorage.removeItem('admin_token'); }}
              className="text-slate-500 hover:text-slate-800 font-medium text-sm"
            >
              Cerrar Sesión
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm">
            <p className="text-sm text-slate-500 font-medium mb-1">Consultas Totales</p>
            <p className="text-3xl font-bold text-indigo-600">{stats?.stats?.length || 0}</p>
          </div>
          <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm">
            <p className="text-sm text-slate-500 font-medium mb-1">Documentos Activos</p>
            <p className="text-3xl font-bold text-indigo-600">{stats?.documentCount || 0}</p>
          </div>
          <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm">
            <p className="text-sm text-slate-500 font-medium mb-1">Feedback Recibido</p>
            <p className="text-3xl font-bold text-indigo-600">{stats?.feedback?.length || 0}</p>
          </div>
        </div>

        <div className="bg-white p-8 rounded-2xl border border-slate-100 shadow-sm mb-8">
          <h2 className="text-xl font-bold text-slate-800 mb-4">Recargar Documentos</h2>
          <p className="text-slate-500 mb-4 text-sm">
            Sube los nuevos documentos oficiales. Esto reemplazará la base de conocimiento actual.
          </p>
          <input 
            type="file" 
            multiple 
            accept=".pdf,.txt"
            onChange={handleFileUpload}
            disabled={isUploading}
            className="block w-full text-sm text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100 cursor-pointer"
          />
          {uploadMessage && (
            <p className={`mt-4 text-sm font-medium ${uploadMessage.includes('Error') ? 'text-red-500' : 'text-indigo-600'}`}>
              {uploadMessage}
            </p>
          )}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm">
            <h2 className="text-xl font-bold text-slate-800 mb-4">Últimas Consultas</h2>
            <div className="space-y-4 max-h-96 overflow-y-auto pr-2">
              {stats?.stats?.slice().reverse().map((s: any) => (
                <div key={s.id} className="p-4 bg-slate-50 rounded-xl">
                  <p className="font-medium text-slate-800 text-sm">Q: {s.question}</p>
                  <p className="text-sm text-slate-600 mt-1 line-clamp-2">A: {s.answer}</p>
                  <p className="text-xs text-slate-400 mt-2">{new Date(s.date).toLocaleString()}</p>
                </div>
              ))}
              {(!stats?.stats || stats.stats.length === 0) && (
                <p className="text-slate-500 text-sm">No hay consultas aún.</p>
              )}
            </div>
          </div>

          <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm">
            <h2 className="text-xl font-bold text-slate-800 mb-4">Feedback de Usuarios</h2>
            <div className="space-y-4 max-h-96 overflow-y-auto pr-2">
              {stats?.feedback?.slice().reverse().map((f: any, i: number) => (
                <div key={i} className="p-4 bg-slate-50 rounded-xl flex gap-3">
                  <div className="text-2xl">{f.type === 'up' ? '👍' : '👎'}</div>
                  <div>
                    <p className="font-medium text-slate-800 text-sm">Q: {f.question}</p>
                    <p className="text-xs text-slate-400 mt-1">{new Date(f.date).toLocaleString()}</p>
                  </div>
                </div>
              ))}
              {(!stats?.feedback || stats.feedback.length === 0) && (
                <p className="text-slate-500 text-sm">No hay feedback aún.</p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
