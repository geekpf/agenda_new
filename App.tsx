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
    <div className="fixed inset-0 bg-slate-900/90 z-50 flex items-center justify-center p-4 backdrop-blur-sm animate-fade-in">
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

// Hire System Modal (Sales Pitch)
const HireModal: React.FC<{ onClose: () => void }> = ({ onClose }) => (
  <div className="fixed inset-0 bg-slate-900/90 z-50 flex items-center justify-center p-4 backdrop-blur-sm animate-fade-in">
    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden relative">
       <button onClick={onClose} className="absolute top-4 right-4 text-white/80 hover:text-white z-10 bg-black/20 rounded-full p-1"><Icons.X className="w-5 h-5"/></button>
       
       <div className="bg-gradient-to-br from-rose-600 to-purple-800 p-8 text-white text-center relative overflow-hidden">
         <div className="absolute top-0 left-0 w-full h-full opacity-10 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')]"></div>
         <Icons.Rocket className="w-16 h-16 mx-auto mb-4 text-yellow-300 drop-shadow-lg" />
         <h2 className="text-3xl font-bold mb-2">Tenha o Aura no seu Negócio</h2>
         <p className="text-rose-100 text-sm leading-relaxed max-w-xs mx-auto">
           Automatize agendamentos, receba pagamentos via Pix e organize sua equipe com um sistema profissional.
         </p>
       </div>

       <div className="p-8">
         <ul className="space-y-4 mb-8">
           <li className="flex items-center gap-3 text-slate-700 font-medium">
             <div className="bg-green-100 text-green-600 p-1.5 rounded-full"><Icons.Check className="w-4 h-4"/></div> 
             Agendamento Online 24/7
           </li>
           <li className="flex items-center gap-3 text-slate-700 font-medium">
             <div className="bg-green-100 text-green-600 p-1.5 rounded-full"><Icons.Check className="w-4 h-4"/></div> 
             Pagamento Pix Automático (Sinal)
           </li>
           <li className="flex items-center gap-3 text-slate-700 font-medium">
             <div className="bg-green-100 text-green-600 p-1.5 rounded-full"><Icons.Check className="w-4 h-4"/></div> 
             Gestão de Agenda por Profissional
           </li>
           <li className="flex items-center gap-3 text-slate-700 font-medium">
             <div className="bg-green-100 text-green-600 p-1.5 rounded-full"><Icons.Check className="w-4 h-4"/></div> 
             Sem Mensalidades Abusivas
           </li>
         </ul>

         <a 
           href="https://wa.me/5511999999999?text=Olá,%20vi%20o%20sistema%20Aura%20e%20gostaria%20de%20saber%20mais%20sobre%20como%20contratar%20para%20meu%20negócio." 
           target="_blank" 
           rel="noreferrer"
           className="block w-full bg-[#25D366] hover:bg-[#128C7E] text-white text-center py-4 rounded-xl font-bold text-lg shadow-lg hover:shadow-xl transition transform hover:-translate-y-1 flex items-center justify-center gap-2"
         >
           <Icons.WhatsApp className="w-6 h-6" />
           Contratar via WhatsApp
         </a>
         <p className="text-center text-xs text-gray-400 mt-4">Fale diretamente com nosso time de vendas.</p>
       </div>
    </div>
  </div>
);

function App() {
  const [currentUser, setCurrentUser] = useState<Professional | null>(null);
  const [showLogin, setShowLogin] = useState(false);
  const [showHireModal, setShowHireModal] = useState(false);
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
          <nav className="bg-white border-b border-gray-200 px-4 py-3 sticky top-0 z-40 shadow-sm">
            <div className="max-w-6xl mx-auto flex justify-between items-center">
              <div className="flex items-center gap-2">
                <div className="bg-rose-600 text-white p-1.5 rounded-lg">
                  <Icons.Service className="w-5 h-5" />
                </div>
                <span className="font-bold text-xl tracking-tight text-slate-900">Aura<span className="text-rose-600">.</span></span>
              </div>
              
              <div className="flex items-center gap-3">
                <button 
                  onClick={() => setShowHireModal(true)}
                  className="hidden md:flex bg-slate-100 text-slate-700 hover:bg-slate-200 px-4 py-2 rounded-full text-xs font-bold transition items-center gap-2 border border-slate-200"
                >
                  <Icons.Rocket className="w-3 h-3 text-rose-600" />
                  Quero esse Sistema
                </button>

                <div className="h-6 w-px bg-gray-300 hidden md:block"></div>

                <button 
                  onClick={() => setShowLogin(true)}
                  className="text-xs font-bold text-slate-600 hover:text-rose-600 transition flex items-center gap-1 px-2 py-1"
                >
                  <Icons.Lock className="w-3 h-3" /> Login Profissional
                </button>
              </div>
            </div>
          </nav>

          <main className="max-w-6xl mx-auto py-8">
            <ClientBooking onSuccess={() => {}} />
          </main>

          <footer className="bg-slate-900 text-slate-400 py-12 px-4 mt-12">
            <div className="max-w-6xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-8 text-sm">
              <div>
                <h4 className="text-white font-bold mb-4 flex items-center gap-2"><Icons.Service className="w-4 h-4 text-rose-500"/> Aura Estética</h4>
                <p>Revelando sua beleza interior com cuidados profissionais e serviços premium.</p>
                <button onClick={() => setShowHireModal(true)} className="mt-4 text-rose-400 hover:text-rose-300 text-xs font-bold underline">
                  Adquira este software para sua empresa
                </button>
              </div>
              <div>
                <h4 className="text-white font-bold mb-4">Contato</h4>
                <p className="flex items-center gap-2"><Icons.Location className="w-3 h-3"/> Rua da Beleza, 123</p>
                <p className="pl-5">São Paulo, SP 01000-000</p>
                <p className="flex items-center gap-2 mt-2"><Icons.WhatsApp className="w-3 h-3"/> (11) 99999-9999</p>
              </div>
              <div>
                <h4 className="text-white font-bold mb-4">Horários</h4>
                <p>Seg - Sex: 9:00 - 18:00</p>
                <p>Sáb: 10:00 - 16:00</p>
                <p>Dom: Fechado</p>
              </div>
            </div>
            <div className="max-w-6xl mx-auto mt-12 pt-8 border-t border-slate-800 text-center text-xs flex justify-between items-center">
              <span>© 2024 Aura Estética. Todos os direitos reservados.</span>
              <span className="opacity-50">v1.2.0</span>
            </div>
          </footer>

          {/* Login Modal Overlay */}
          {showLogin && (
            <LoginScreen 
              onLogin={(user) => { setCurrentUser(user); setShowLogin(false); }} 
              onCancel={() => setShowLogin(false)} 
            />
          )}

          {/* Hire System Modal Overlay */}
          {showHireModal && (
            <HireModal onClose={() => setShowHireModal(false)} />
          )}
        </>
      )}
    </div>
  );
}

export default App;