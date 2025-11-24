import React, { useState } from 'react';
import { REQUIRED_SQL } from '../utils/dbSchema';
import { Icons } from './Icons';

export const SetupGuide: React.FC = () => {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(REQUIRED_SQL);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="min-h-screen bg-slate-900 text-white p-8 flex flex-col items-center justify-center">
      <div className="max-w-3xl w-full bg-slate-800 rounded-xl p-8 shadow-2xl border border-slate-700">
        <h1 className="text-3xl font-bold mb-4 text-rose-500 flex items-center gap-3">
          <Icons.Admin className="w-8 h-8" />
          Configuração do Sistema Necessária
        </h1>
        <p className="mb-6 text-gray-300">
          O banco de dados Supabase está conectado, mas as tabelas necessárias não foram encontradas.
          Por favor, execute o seguinte SQL no Editor SQL do seu projeto Supabase para inicializar o sistema.
        </p>
        
        <div className="relative mb-6">
          <pre className="bg-black p-4 rounded-lg overflow-x-auto text-xs text-green-400 font-mono h-64 border border-slate-700">
            {REQUIRED_SQL}
          </pre>
          <button 
            onClick={handleCopy}
            className="absolute top-2 right-2 bg-rose-600 hover:bg-rose-700 text-white px-3 py-1 rounded text-sm font-medium transition-colors"
          >
            {copied ? 'Copiado!' : 'Copiar SQL'}
          </button>
        </div>

        <div className="flex gap-4">
          <a 
            href="https://supabase.com/dashboard/project/stgzdrnlrlnmkfvefjwl/sql" 
            target="_blank" 
            rel="noreferrer"
            className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white text-center py-3 rounded-lg font-bold transition-colors"
          >
            Abrir Editor SQL do Supabase
          </a>
          <button 
            onClick={() => window.location.reload()}
            className="flex-1 bg-slate-700 hover:bg-slate-600 text-white py-3 rounded-lg font-bold transition-colors"
          >
            Já executei o SQL, Atualizar App
          </button>
        </div>
      </div>
    </div>
  );
};