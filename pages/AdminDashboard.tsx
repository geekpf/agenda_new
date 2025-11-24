import React, { useEffect, useState } from 'react';
import { supabase } from '../services/supabaseClient';
import { Service, Professional, Appointment, Availability, DAYS_OF_WEEK } from '../types';
import { Icons } from '../components/Icons';

// Helper for date formatting inside Admin
const formatDate = (dateString: string) => {
  return new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }).format(new Date(dateString));
};

const GENERATED_HOURS = Array.from({ length: 15 }, (_, i) => {
  const hour = i + 7; // Start at 7 AM
  return `${hour.toString().padStart(2, '0')}:00`;
});

interface AdminDashboardProps {
  user: Professional;
  onLogout: () => void;
}

export const AdminDashboard: React.FC<AdminDashboardProps> = ({ user, onLogout }) => {
  const [activeTab, setActiveTab] = useState<'appointments' | 'services' | 'professionals'>('appointments');
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [professionals, setProfessionals] = useState<Professional[]>([]);
  const [loading, setLoading] = useState(false);

  // --- SERVICE MODAL STATE ---
  const [showServiceModal, setShowServiceModal] = useState(false);
  const [editingService, setEditingService] = useState<Partial<Service> | null>(null);
  const [selectedProsForService, setSelectedProsForService] = useState<Set<string>>(new Set());

  // --- PROFESSIONAL MODAL STATE ---
  const [showProModal, setShowProModal] = useState(false);
  const [editingProProfile, setEditingProProfile] = useState<Partial<Professional> | null>(null);

  // --- SCHEDULE MODAL STATE ---
  const [editingProSchedule, setEditingProSchedule] = useState<Professional | null>(null);
  const [scheduleForm, setScheduleForm] = useState<Partial<Availability>[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchData();
  }, [activeTab]);

  const fetchData = async () => {
    setLoading(true);
    
    // --- FETCH APPOINTMENTS ---
    if (activeTab === 'appointments') {
      let query = supabase
        .from('appointments')
        .select(`*, services (name), professionals (name)`)
        .order('start_time', { ascending: true });
      
      // RBAC: If not admin, only show own appointments
      if (!user.is_admin) {
        query = query.eq('professional_id', user.id);
      }

      const { data } = await query;
      if (data) setAppointments(data as any);
    } 
    
    // --- FETCH SERVICES ---
    else if (activeTab === 'services') {
      if (user.is_admin) {
        // Admin sees all
        const { data } = await supabase.from('services').select('*').order('created_at');
        if (data) setServices(data);
      } else {
        // Pro sees only linked services
        // Supabase doesn't support complex joins in one go easily for this without view, so we do 2 steps
        const { data: rels } = await supabase.from('service_professionals').select('service_id').eq('professional_id', user.id);
        const serviceIds = rels?.map((r: any) => r.service_id) || [];
        
        if (serviceIds.length > 0) {
          const { data } = await supabase.from('services').select('*').in('id', serviceIds);
          if (data) setServices(data);
        } else {
          setServices([]);
        }
      }
    } 
    
    // --- FETCH PROFESSIONALS ---
    else if (activeTab === 'professionals') {
      if (user.is_admin) {
        const { data } = await supabase.from('professionals').select('*');
        if (data) setProfessionals(data);
      }
    }
    setLoading(false);
  };

  // --- APPOINTMENT ACTIONS ---
  const updateStatus = async (id: string, status: string) => {
    await supabase.from('appointments').update({ status }).eq('id', id);
    fetchData();
  };

  // --- SERVICE MANAGEMENT (Admin Only) ---
  const openServiceModal = async (service: Service | null) => {
    if (!user.is_admin) return; // Guard

    // Need all professionals to populate checkbox list
    const { data: allPros } = await supabase.from('professionals').select('*');
    if (allPros) setProfessionals(allPros);

    if (service) {
      setEditingService(service);
      const { data: rels } = await supabase
        .from('service_professionals')
        .select('professional_id')
        .eq('service_id', service.id);
      
      const ids = new Set<string>(rels?.map((r: any) => r.professional_id) || []);
      setSelectedProsForService(ids);
    } else {
      setEditingService({ name: '', price: 0, duration_minutes: 60, description: '', pix_key: '', image_url: '' });
      setSelectedProsForService(new Set());
    }
    setShowServiceModal(true);
  };

  const toggleProSelection = (id: string) => {
    const newSet = new Set(selectedProsForService);
    if (newSet.has(id)) newSet.delete(id);
    else newSet.add(id);
    setSelectedProsForService(newSet);
  };

  const saveService = async () => {
    if (!editingService?.name) return;
    setSaving(true);
    
    const { data: savedService, error } = await supabase
      .from('services')
      .upsert(editingService)
      .select()
      .single();

    if (error) {
      alert('Erro ao salvar serviço');
      setSaving(false);
      return;
    }

    if (savedService) {
      await supabase.from('service_professionals').delete().eq('service_id', savedService.id);
      const relations = Array.from(selectedProsForService).map(pid => ({
        service_id: savedService.id,
        professional_id: pid
      }));
      if (relations.length > 0) {
        await supabase.from('service_professionals').insert(relations);
      }
    }

    setSaving(false);
    setShowServiceModal(false);
    fetchData();
  };

  const deleteService = async (id: string) => {
    if (confirm('Tem certeza que deseja excluir este serviço?')) {
      await supabase.from('services').delete().eq('id', id);
      fetchData();
    }
  };

  // --- PROFESSIONAL MANAGEMENT (Admin Only) ---
  const openProModal = (pro: Professional | null) => {
    if (pro) {
      setEditingProProfile(pro);
    } else {
      setEditingProProfile({ name: '', role: '', bio: '', photo_url: '', email: '', password: '123' });
    }
    setShowProModal(true);
  };

  const saveProProfile = async () => {
    if (!editingProProfile?.name) return;
    setSaving(true);
    await supabase.from('professionals').upsert(editingProProfile);
    setSaving(false);
    setShowProModal(false);
    fetchData();
  };

   const deletePro = async (id: string) => {
    if (confirm('Tem certeza? Isso excluirá também a agenda e histórico.')) {
      await supabase.from('professionals').delete().eq('id', id);
      fetchData();
    }
  };

  // --- SCHEDULE MANAGEMENT ---
  const openScheduleEditor = async (pro: Professional) => {
    setEditingProSchedule(pro);
    setLoading(true);
    
    const { data: existing } = await supabase.from('availability').select('*').eq('professional_id', pro.id);

    const days: Partial<Availability>[] = [];
    for (let i = 0; i < 7; i++) {
      const existingDay = existing?.find(d => d.day_of_week === i);
      if (existingDay) {
        days.push({ ...existingDay, time_slots: existingDay.time_slots || [] });
      } else {
        days.push({ professional_id: pro.id, day_of_week: i, time_slots: [], is_available: false });
      }
    }
    setScheduleForm(days);
    setLoading(false);
  };

  const toggleDayAvailability = (index: number) => {
    const newSchedule = [...scheduleForm];
    newSchedule[index].is_available = !newSchedule[index].is_available;
    setScheduleForm(newSchedule);
  };

  const toggleTimeSlot = (dayIndex: number, slot: string) => {
    const newSchedule = [...scheduleForm];
    const currentSlots = newSchedule[dayIndex].time_slots || [];
    
    if (currentSlots.includes(slot)) {
      newSchedule[dayIndex].time_slots = currentSlots.filter(s => s !== slot);
    } else {
      newSchedule[dayIndex].time_slots = [...currentSlots, slot].sort();
    }
    
    if (newSchedule[dayIndex].time_slots?.length && newSchedule[dayIndex].time_slots.length > 0) {
      newSchedule[dayIndex].is_available = true;
    }
    setScheduleForm(newSchedule);
  };

  const saveSchedule = async () => {
    if (!editingProSchedule) return;
    setSaving(true);
    const updates = scheduleForm.map(day => ({
      professional_id: editingProSchedule.id,
      day_of_week: day.day_of_week,
      time_slots: day.time_slots,
      is_available: day.is_available
    }));

    await supabase.from('availability').upsert(updates, { onConflict: 'professional_id,day_of_week' });
    setSaving(false);
    setEditingProSchedule(null);
  };

  return (
    <div className="bg-gray-100 min-h-screen">
      {/* Header */}
      <header className="bg-slate-900 text-white p-4 shadow-lg sticky top-0 z-10">
        <div className="max-w-6xl mx-auto flex justify-between items-center">
          <div className="flex items-center gap-3">
             <div className="bg-rose-600 p-2 rounded-lg"><Icons.Admin className="w-5 h-5" /></div>
             <div>
               <h1 className="text-xl font-bold leading-none">Painel Administrativo</h1>
               <p className="text-xs text-slate-400">Olá, {user.name} ({user.is_admin ? 'Admin' : 'Profissional'})</p>
             </div>
          </div>
          <div className="flex gap-4 items-center">
            <nav className="flex gap-2">
              <button onClick={() => setActiveTab('appointments')} className={`px-3 py-1 rounded-md text-sm font-medium transition ${activeTab === 'appointments' ? 'bg-slate-700 text-white' : 'text-slate-400 hover:text-white'}`}>Agendamentos</button>
              
              <button onClick={() => setActiveTab('services')} className={`px-3 py-1 rounded-md text-sm font-medium transition ${activeTab === 'services' ? 'bg-slate-700 text-white' : 'text-slate-400 hover:text-white'}`}>
                {user.is_admin ? 'Serviços' : 'Meus Serviços'}
              </button>
              
              {user.is_admin && (
                <button onClick={() => setActiveTab('professionals')} className={`px-3 py-1 rounded-md text-sm font-medium transition ${activeTab === 'professionals' ? 'bg-slate-700 text-white' : 'text-slate-400 hover:text-white'}`}>Equipe</button>
              )}
            </nav>
            <div className="h-6 w-px bg-slate-700 mx-2"></div>
            <button onClick={onLogout} className="text-rose-500 hover:text-rose-400" title="Sair"><Icons.Logout className="w-5 h-5"/></button>
          </div>
        </div>
      </header>

      {/* SUB-HEADER FOR NON-ADMINS TO MANAGE SCHEDULE */}
      {!user.is_admin && (
        <div className="bg-white border-b p-4 text-center">
          <button 
            onClick={() => openScheduleEditor(user)}
            className="bg-slate-800 text-white px-6 py-2 rounded-full font-bold shadow hover:bg-slate-700 transition flex items-center gap-2 mx-auto"
          >
            <Icons.Clock className="w-4 h-4" /> Gerenciar Minha Disponibilidade
          </button>
        </div>
      )}

      <main className="max-w-6xl mx-auto p-4 md:p-8">
        {loading && !showServiceModal && !showProModal && !editingProSchedule && <div className="text-center py-8"><Icons.Loading className="animate-spin w-8 h-8 mx-auto text-rose-600"/></div>}

        {/* --- APPOINTMENTS TAB --- */}
        {!loading && activeTab === 'appointments' && (
          <div className="space-y-4">
             <div className="flex justify-between items-end mb-4">
               <h2 className="text-2xl font-bold text-slate-800">Agendamentos</h2>
               <span className="text-sm text-gray-500">{appointments.length} encontrados</span>
            </div>
            {appointments.length === 0 && <p className="text-center text-gray-500 py-12">Nenhum agendamento encontrado.</p>}
            {appointments.map(app => (
              <div key={app.id} className="bg-white p-6 rounded-xl shadow-sm border border-gray-200 flex flex-col md:flex-row justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className={`px-2 py-0.5 rounded text-xs font-bold uppercase ${
                      app.status === 'confirmed' ? 'bg-green-100 text-green-700' :
                      app.status === 'rejected' ? 'bg-red-100 text-red-700' :
                      app.status === 'cancelled' ? 'bg-gray-100 text-gray-600' :
                      'bg-yellow-100 text-yellow-700'
                    }`}>
                      {app.status === 'confirmed' ? 'Confirmado' : app.status === 'rejected' ? 'Rejeitado' : app.status === 'cancelled' ? 'Cancelado' : 'Pendente'}
                    </span>
                    <span className="text-sm text-gray-500">{formatDate(app.start_time)}</span>
                  </div>
                  <h3 className="font-bold text-lg">{app.services?.name}</h3>
                  <p className="text-gray-600 text-sm">Cliente: <b>{app.customer_name}</b> ({app.customer_phone})</p>
                  <p className="text-gray-500 text-xs">Profissional: {app.professionals?.name}</p>
                </div>
                <div className="flex gap-2 items-center">
                  {/* Both Admin and Pro can confirm/reject their own appointments */}
                  {app.status === 'pending' && (
                    <>
                      <button onClick={() => updateStatus(app.id, 'confirmed')} className="bg-green-600 text-white px-3 py-2 rounded text-sm font-bold flex items-center gap-1"><Icons.Check className="w-4 h-4"/> Confirmar</button>
                      <button onClick={() => updateStatus(app.id, 'rejected')} className="bg-red-100 text-red-700 px-3 py-2 rounded text-sm font-bold flex items-center gap-1"><Icons.X className="w-4 h-4"/> Rejeitar</button>
                    </>
                  )}
                  {app.status === 'confirmed' && <button onClick={() => updateStatus(app.id, 'cancelled')} className="bg-gray-200 text-gray-700 px-3 py-2 rounded text-sm font-bold">Cancelar</button>}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* --- SERVICES TAB --- */}
        {!loading && activeTab === 'services' && (
          <div>
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-2xl font-bold text-slate-800">{user.is_admin ? 'Menu de Serviços' : 'Meus Serviços'}</h2>
              {user.is_admin && (
                <button onClick={() => openServiceModal(null)} className="bg-rose-600 text-white px-4 py-2 rounded-lg text-sm font-bold flex items-center gap-2 hover:bg-rose-700">
                  <Icons.Add className="w-4 h-4" /> Adicionar Serviço
                </button>
              )}
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {services.length === 0 && <p className="col-span-3 text-center text-gray-500">Nenhum serviço encontrado.</p>}
              {services.map(s => (
                <div key={s.id} className="bg-white rounded-xl shadow-sm overflow-hidden border border-gray-200 group relative">
                   {user.is_admin && (
                     <div className="absolute top-2 right-2 flex gap-2 opacity-0 group-hover:opacity-100 transition">
                        <button onClick={() => openServiceModal(s)} className="bg-blue-500 text-white p-2 rounded-full shadow"><Icons.Admin className="w-4 h-4"/></button>
                        <button onClick={() => deleteService(s.id)} className="bg-red-500 text-white p-2 rounded-full shadow"><Icons.Delete className="w-4 h-4"/></button>
                     </div>
                   )}
                   <div className="h-40 bg-gray-200"><img src={s.image_url} alt={s.name} className="w-full h-full object-cover"/></div>
                   <div className="p-4">
                     <h3 className="font-bold text-lg">{s.name}</h3>
                     <p className="text-sm text-gray-500 mb-2">{s.description}</p>
                     <div className="flex items-center justify-between text-xs font-bold text-gray-400">
                       <span>{s.duration_minutes} min</span>
                       <span className="text-green-600 text-sm">R$ {s.price}</span>
                     </div>
                   </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* --- PROFESSIONALS TAB (Admin Only) --- */}
        {!loading && activeTab === 'professionals' && user.is_admin && (
          <div>
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-2xl font-bold text-slate-800">Equipe</h2>
              <button onClick={() => openProModal(null)} className="bg-rose-600 text-white px-4 py-2 rounded-lg text-sm font-bold flex items-center gap-2 hover:bg-rose-700">
                <Icons.Add className="w-4 h-4" /> Adicionar Profissional
              </button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
               {professionals.map(p => (
                 <div key={p.id} className="bg-white p-6 rounded-xl shadow-sm border border-gray-200 text-center relative group">
                    <div className="absolute top-2 right-2 flex gap-2 opacity-0 group-hover:opacity-100 transition">
                      <button onClick={() => openProModal(p)} className="bg-blue-100 text-blue-600 p-2 rounded-full hover:bg-blue-200"><Icons.Admin className="w-4 h-4"/></button>
                      <button onClick={() => deletePro(p.id)} className="bg-red-100 text-red-600 p-2 rounded-full hover:bg-red-200"><Icons.Delete className="w-4 h-4"/></button>
                   </div>
                   <img src={p.photo_url} alt={p.name} className="w-24 h-24 rounded-full mx-auto mb-4 object-cover"/>
                   <h3 className="font-bold text-lg">{p.name}</h3>
                   <p className="text-rose-500 text-sm font-medium mb-1">{p.role}</p>
                   {p.is_admin && <span className="bg-purple-100 text-purple-700 text-xs px-2 py-0.5 rounded font-bold">Admin</span>}
                   
                   <button onClick={() => openScheduleEditor(p)} className="w-full bg-slate-800 text-white py-2 rounded-lg text-sm hover:bg-slate-900 transition mt-4">Gerenciar Agenda</button>
                 </div>
               ))}
            </div>
          </div>
        )}
      </main>

      {/* --- MODAL: SERVICE (ADD/EDIT) --- */}
      {showServiceModal && editingService && user.is_admin && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
           <div className="bg-white rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
             <div className="bg-slate-900 text-white p-4 flex justify-between items-center sticky top-0">
               <h3 className="font-bold">{editingService.id ? 'Editar Serviço' : 'Novo Serviço'}</h3>
               <button onClick={() => setShowServiceModal(false)}><Icons.X/></button>
             </div>
             <div className="p-6 space-y-4">
               <div className="grid grid-cols-2 gap-4">
                 <input className="border p-2 rounded w-full" placeholder="Nome" value={editingService.name} onChange={e => setEditingService({...editingService, name: e.target.value})} />
                 <input className="border p-2 rounded w-full" type="number" placeholder="Preço (R$)" value={editingService.price} onChange={e => setEditingService({...editingService, price: parseFloat(e.target.value)})} />
                 <input className="border p-2 rounded w-full" type="number" placeholder="Duração (min)" value={editingService.duration_minutes} onChange={e => setEditingService({...editingService, duration_minutes: parseInt(e.target.value)})} />
                 <input className="border p-2 rounded w-full" placeholder="Chave Pix" value={editingService.pix_key} onChange={e => setEditingService({...editingService, pix_key: e.target.value})} />
                 <input className="border p-2 rounded w-full col-span-2" placeholder="URL da Imagem" value={editingService.image_url} onChange={e => setEditingService({...editingService, image_url: e.target.value})} />
                 <textarea className="border p-2 rounded w-full col-span-2" placeholder="Descrição" value={editingService.description} onChange={e => setEditingService({...editingService, description: e.target.value})} />
               </div>
               
               <div className="border-t pt-4">
                 <h4 className="font-bold mb-3">Profissionais que realizam este serviço:</h4>
                 <div className="grid grid-cols-2 gap-2">
                   {professionals.map(p => (
                     <label key={p.id} className="flex items-center gap-2 p-2 border rounded hover:bg-gray-50 cursor-pointer">
                       <input 
                        type="checkbox" 
                        checked={selectedProsForService.has(p.id)} 
                        onChange={() => toggleProSelection(p.id)}
                        className="w-4 h-4 accent-rose-600"
                       />
                       <span className="text-sm">{p.name}</span>
                     </label>
                   ))}
                 </div>
               </div>
             </div>
             <div className="p-4 border-t flex justify-end gap-2 bg-gray-50">
               <button onClick={() => setShowServiceModal(false)} className="px-4 py-2 text-gray-600">Cancelar</button>
               <button onClick={saveService} disabled={saving} className="bg-rose-600 text-white px-6 py-2 rounded-lg font-bold">{saving ? 'Salvando...' : 'Salvar'}</button>
             </div>
           </div>
        </div>
      )}

      {/* --- MODAL: PROFESSIONAL (ADD/EDIT PROFILE) --- */}
      {showProModal && editingProProfile && user.is_admin && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
           <div className="bg-white rounded-2xl w-full max-w-lg">
             <div className="bg-slate-900 text-white p-4 flex justify-between items-center rounded-t-2xl">
               <h3 className="font-bold">{editingProProfile.id ? 'Editar Perfil' : 'Novo Profissional'}</h3>
               <button onClick={() => setShowProModal(false)}><Icons.X/></button>
             </div>
             <div className="p-6 space-y-4">
                 <input className="border p-2 rounded w-full" placeholder="Nome Completo" value={editingProProfile.name} onChange={e => setEditingProProfile({...editingProProfile, name: e.target.value})} />
                 <input className="border p-2 rounded w-full" placeholder="Cargo / Especialidade" value={editingProProfile.role} onChange={e => setEditingProProfile({...editingProProfile, role: e.target.value})} />
                 <input className="border p-2 rounded w-full" placeholder="URL da Foto" value={editingProProfile.photo_url} onChange={e => setEditingProProfile({...editingProProfile, photo_url: e.target.value})} />
                 <textarea className="border p-2 rounded w-full h-24" placeholder="Biografia curta" value={editingProProfile.bio} onChange={e => setEditingProProfile({...editingProProfile, bio: e.target.value})} />
                 
                 <div className="bg-gray-50 p-3 rounded-lg border">
                   <h4 className="font-bold text-sm mb-2 text-gray-500 uppercase">Acesso ao Sistema</h4>
                   <div className="space-y-2">
                     <input className="border p-2 rounded w-full text-sm" placeholder="Email (Login)" value={editingProProfile.email || ''} onChange={e => setEditingProProfile({...editingProProfile, email: e.target.value})} />
                     <input className="border p-2 rounded w-full text-sm" placeholder="Senha" value={editingProProfile.password || ''} onChange={e => setEditingProProfile({...editingProProfile, password: e.target.value})} />
                     <label className="flex items-center gap-2 mt-2">
                       <input type="checkbox" checked={editingProProfile.is_admin || false} onChange={e => setEditingProProfile({...editingProProfile, is_admin: e.target.checked})} className="accent-rose-600"/>
                       <span className="text-sm font-bold text-slate-700">Acesso de Administrador</span>
                     </label>
                   </div>
                 </div>
             </div>
             <div className="p-4 border-t flex justify-end gap-2 bg-gray-50 rounded-b-2xl">
               <button onClick={() => setShowProModal(false)} className="px-4 py-2 text-gray-600">Cancelar</button>
               <button onClick={saveProProfile} disabled={saving} className="bg-rose-600 text-white px-6 py-2 rounded-lg font-bold">{saving ? 'Salvando...' : 'Salvar'}</button>
             </div>
           </div>
        </div>
      )}

      {/* --- MODAL: SCHEDULE EDITOR (Shared) --- */}
      {editingProSchedule && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl overflow-hidden max-h-[90vh] flex flex-col">
            <div className="bg-slate-900 text-white p-6 flex justify-between items-center shrink-0">
              <h3 className="text-xl font-bold flex items-center gap-2"><Icons.Clock className="w-6 h-6 text-rose-500" /> Agenda: {editingProSchedule.name}</h3>
              <button onClick={() => setEditingProSchedule(null)} className="text-slate-400 hover:text-white"><Icons.X className="w-6 h-6" /></button>
            </div>
            <div className="p-6 overflow-y-auto flex-1 space-y-6">
                {scheduleForm.map((day, dayIndex) => (
                  <div key={day.day_of_week} className="border-b border-gray-100 pb-4 last:border-0">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-3">
                        <input type="checkbox" checked={day.is_available} onChange={() => toggleDayAvailability(dayIndex)} className="w-5 h-5 accent-rose-600 rounded cursor-pointer"/>
                        <span className={`font-bold text-lg ${day.is_available ? 'text-slate-800' : 'text-gray-400'}`}>{DAYS_OF_WEEK[day.day_of_week || 0]}</span>
                      </div>
                    </div>
                    {day.is_available && (
                      <div className="grid grid-cols-4 sm:grid-cols-5 md:grid-cols-8 gap-2 pl-8">
                        {GENERATED_HOURS.map(slot => (
                            <button key={slot} onClick={() => toggleTimeSlot(dayIndex, slot)} className={`py-1.5 px-2 rounded-md text-sm font-medium transition ${day.time_slots?.includes(slot) ? 'bg-rose-600 text-white shadow-md transform scale-105' : 'bg-white border border-gray-200 text-gray-600 hover:border-rose-300 hover:bg-rose-50'}`}>{slot}</button>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
            </div>
            <div className="p-6 border-t border-gray-200 bg-gray-50 flex justify-end gap-3 shrink-0">
              <button onClick={() => setEditingProSchedule(null)} className="px-6 py-2 rounded-lg font-bold text-slate-600 hover:bg-slate-200 transition">Cancelar</button>
              <button onClick={saveSchedule} disabled={saving} className="bg-rose-600 hover:bg-rose-700 text-white px-8 py-2 rounded-lg font-bold shadow-lg disabled:opacity-50 transition">{saving ? 'Salvando...' : 'Salvar Agenda'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};