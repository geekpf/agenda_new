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
      <div className="max-w-4xl w-full bg-slate-800 rounded-xl p-8 shadow-2xl border border-slate-700">
        <h1 className="text-3xl font-bold mb-4 text-rose-500 flex items-center gap-3">
          <Icons.Admin className="w-8 h-8" />
          Configuração do Sistema Necessária
        </h1>
        <p className="mb-6 text-gray-300">
          O sistema detectou que a estrutura do banco de dados precisa ser atualizada.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-6">
          {/* Step 1: SQL */}
          <div>
            <h3 className="font-bold text-lg mb-2 text-white">Passo 1: Rodar SQL</h3>
            <p className="text-sm text-gray-400 mb-2">Execute este comando no Editor SQL do Supabase para criar tabelas e colunas.</p>
            <div className="relative">
              <pre className="bg-black p-4 rounded-lg overflow-x-auto text-xs text-green-400 font-mono h-48 border border-slate-700">
                {REQUIRED_SQL}
              </pre>
              <button 
                onClick={handleCopy}
                className="absolute top-2 right-2 bg-rose-600 hover:bg-rose-700 text-white px-3 py-1 rounded text-sm font-medium transition-colors"
              >
                {copied ? 'Copiado!' : 'Copiar SQL'}
              </button>
            </div>
            <a 
              href="https://supabase.com/dashboard/project/stgzdrnlrlnmkfvefjwl/sql" 
              target="_blank" 
              rel="noreferrer"
              className="mt-2 block text-center bg-indigo-600 hover:bg-indigo-700 text-white py-2 rounded font-bold transition-colors text-sm"
            >
              Abrir Editor SQL
            </a>
          </div>

          {/* Step 2: Storage */}
          <div>
            <h3 className="font-bold text-lg mb-2 text-white">Passo 2: Configurar Storage</h3>
            <p className="text-sm text-gray-400 mb-4">Para o upload de QR Codes funcionar, você precisa criar um bucket.</p>
            
            <ol className="list-decimal list-inside space-y-2 text-sm text-gray-300 bg-slate-900 p-4 rounded-lg border border-slate-700">
              <li>Vá para a aba <strong>Storage</strong> no Supabase.</li>
              <li>Crie um novo Bucket chamado <strong>images</strong>.</li>
              <li>Ative a opção <strong>Public Bucket</strong>.</li>
              <li>Salve o bucket.</li>
            </ol>
            
            <a 
              href="https://supabase.com/dashboard/project/stgzdrnlrlnmkfvefjwl/storage/buckets" 
              target="_blank" 
              rel="noreferrer"
              className="mt-4 block text-center bg-teal-600 hover:bg-teal-700 text-white py-2 rounded font-bold transition-colors text-sm"
            >
              Ir para Storage
            </a>
          </div>
        </div>

        <button 
            onClick={() => window.location.reload()}
            className="w-full bg-slate-700 hover:bg-slate-600 text-white py-4 rounded-lg font-bold transition-colors text-lg"
          >
            Já realizei as configurações, Atualizar App
        </button>
      </div>
    </div>
  );
};