import React, { useState, useEffect } from 'react';
import { supabase } from './services/supabaseClient';
import { ClientBooking } from './pages/ClientBooking';
import { AdminDashboard } from './pages/AdminDashboard';
import { SetupGuide } from './components/SetupGuide';
import { Icons } from './components/Icons';
import { checkDbConnection } from './services/supabaseClient';
import { Professional } from './types';

// Simple Login Component
const LoginScreen: React.FC<{ onLogin: (user: Professional) => void, onCancel: () => void }> = ({ onLogin, onCancel }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    // Query professionals table
    const { data, error } = await supabase
      .from('professionals')
      .select('*')
      .eq('email', email)
      .eq('password', password) // In production, use Supabase Auth or hash comparison
      .single();

    if (error || !data) {
      setError('Credenciais inválidas. Tente admin@aura.com / admin');
      setLoading(false);
    } else {
      onLogin(data as Professional);
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-900/90 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-8 relative">
        <button onClick={onCancel} className="absolute top-4 right-4 text-gray-400 hover:text-gray-600"><Icons.X/></button>
        <div className="flex justify-center mb-6">
          <div className="bg-rose-100 p-3 rounded-full">
            <Icons.Lock className="w-8 h-8 text-rose-600" />
          </div>
        </div>
        <h2 className="text-2xl font-bold text-center text-slate-800 mb-2">Acesso Restrito</h2>
        <p className="text-center text-gray-500 mb-6 text-sm">Entre com suas credenciais de profissional ou administrador.</p>
        
        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <label className="block text-sm font-bold text-gray-600 mb-1">Email</label>
            <input 
              type="email" 
              required
              value={email}
              onChange={e => setEmail(e.target.value)}
              className="w-full border border-gray-300 rounded-lg p-3 focus:ring-2 focus:ring-rose-500 focus:border-rose-500 outline-none"
              placeholder="seu@email.com"
            />
          </div>
          <div>
            <label className="block text-sm font-bold text-gray-600 mb-1">Senha</label>
            <input 
              type="password" 
              required
              value={password}
              onChange={e => setPassword(e.target.value)}
              className="w-full border border-gray-300 rounded-lg p-3 focus:ring-2 focus:ring-rose-500 focus:border-rose-500 outline-none"
              placeholder="••••••"
            />
          </div>
          
          {error && <div className="text-red-500 text-sm text-center bg-red-50 p-2 rounded">{error}</div>}

          <button 
            type="submit" 
            disabled={loading}
            className="w-full bg-rose-600 hover:bg-rose-700 text-white py-3 rounded-xl font-bold transition flex justify-center items-center gap-2"
          >
            {loading ? <Icons.Loading className="animate-spin w-5 h-5"/> : 'Entrar'}
          </button>
        </form>
        
        <div className="mt-6 text-center">
           <p className="text-xs text-gray-400 bg-gray-50 p-2 rounded border">Demo Admin: admin@aura.com / admin</p>
        </div>
      </div>
    </div>
  );
};

function App() {
  const [currentUser, setCurrentUser] = useState<Professional | null>(null);
  const [showLogin, setShowLogin] = useState(false);
  const [dbReady, setDbReady] = useState<boolean | null>(null);

  useEffect(() => {
    const init = async () => {
      const isReady = await checkDbConnection();
      setDbReady(isReady);
    };
    init();
  }, []);

  if (dbReady === false) {
    return <SetupGuide />;
  }

  if (dbReady === null) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center text-white">
        <Icons.Loading className="animate-spin w-12 h-12 text-rose-500" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 font-sans text-slate-900">
      {/* If logged in, show Admin Dashboard */}
      {currentUser ? (
        <AdminDashboard user={currentUser} onLogout={() => setCurrentUser(null)} />
      ) : (
        <>
          <nav className="bg-white border-b border-gray-200 px-4 py-3 sticky top-0 z-50">
            <div className="max-w-6xl mx-auto flex justify-between items-center">
              <div className="flex items-center gap-2">
                <div className="bg-rose-600 text-white p-1.5 rounded-lg">
                  <Icons.Service className="w-5 h-5" />
                </div>
                <span className="font-bold text-lg tracking-tight text-slate-900">Aura<span className="text-rose-600">.</span></span>
              </div>
              <button 
                onClick={() => setShowLogin(true)}
                className="text-xs font-semibold text-gray-400 hover:text-rose-600 transition flex items-center gap-1"
              >
                <Icons.Admin className="w-3 h-3" /> Área Profissional
              </button>
            </div>
          </nav>

          <main className="max-w-6xl mx-auto py-8">
            <ClientBooking onSuccess={() => {}} />
          </main>

          <footer className="bg-slate-900 text-slate-400 py-12 px-4 mt-12">
            <div className="max-w-6xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-8 text-sm">
              <div>
                <h4 className="text-white font-bold mb-4">Aura Estética</h4>
                <p>Revelando sua beleza interior com cuidados profissionais e serviços premium.</p>
              </div>
              <div>
                <h4 className="text-white font-bold mb-4">Contato</h4>
                <p>Rua da Beleza, 123</p>
                <p>São Paulo, SP 01000-000</p>
                <p>(11) 99999-9999</p>
              </div>
              <div>
                <h4 className="text-white font-bold mb-4">Horários</h4>
                <p>Seg - Sex: 9:00 - 18:00</p>
                <p>Sáb: 10:00 - 16:00</p>
                <p>Dom: Fechado</p>
              </div>
            </div>
            <div className="max-w-6xl mx-auto mt-12 pt-8 border-t border-slate-800 text-center text-xs">
              © 2024 Aura Estética. Todos os direitos reservados.
            </div>
          </footer>

          {/* Login Modal Overlay */}
          {showLogin && (
            <LoginScreen 
              onLogin={(user) => { setCurrentUser(user); setShowLogin(false); }} 
              onCancel={() => setShowLogin(false)} 
            />
          )}
        </>
      )}
    </div>
  );
}

export default App;