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
  const [selectedProsForService, setSelectedProsForService] = useState<Set<string>>(new Set<string>());
  const [uploading, setUploading] = useState(false);

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
        .order('start_time', { ascending: false });

      if (!user.is_admin) {
        query = query.eq('professional_id', user.id);
      }

      const { data } = await query;
      if (data) setAppointments(data as any);
    }
    
    // --- FETCH SERVICES ---
    if (activeTab === 'services' || activeTab === 'appointments') {
      const { data } = await supabase.from('services').select('*').order('name');
      if (data) setServices(data);
    }

    // --- FETCH PROFESSIONALS (Needed for filters and linking) ---
    const { data: proData } = await supabase.from('professionals').select('*').order('name');
    if (proData) setProfessionals(proData);

    setLoading(false);
  };

  // --- ACTION HANDLERS ---

  const handleUpdateStatus = async (id: string, status: string) => {
    await supabase.from('appointments').update({ status }).eq('id', id);
    fetchData();
  };

  const handleDelete = async (table: string, id: string) => {
    if (window.confirm('Tem certeza que deseja excluir?')) {
      await supabase.from(table).delete().eq('id', id);
      fetchData();
    }
  };

  // --- SERVICE MANAGEMENT ---

  const openServiceModal = async (service?: Service) => {
    if (service) {
      setEditingService(service);
      // Fetch relationships
      const { data } = await supabase
        .from('service_professionals')
        .select('professional_id')
        .eq('service_id', service.id);
      
      const ids = new Set<string>((data || []).map((item: any) => item.professional_id));
      setSelectedProsForService(ids);
    } else {
      setEditingService({
        name: '', description: '', duration_minutes: 60, price: 0, 
        pix_key: '', image_url: '', pix_qr_url: '', category: 'Geral'
      });
      setSelectedProsForService(new Set<string>());
    }
    setShowServiceModal(true);
  };

  const handleQrUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return;
    const file = e.target.files[0];
    const fileExt = file.name.split('.').pop();
    const fileName = `${Math.random()}.${fileExt}`;
    const filePath = `qr-codes/${fileName}`;

    setUploading(true);
    try {
      const { error: uploadError } = await supabase.storage
        .from('images')
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      const { data } = supabase.storage.from('images').getPublicUrl(filePath);
      setEditingService(prev => ({ ...prev, pix_qr_url: data.publicUrl }));
    } catch (error) {
      alert('Erro ao fazer upload. Verifique se o Bucket "images" existe e é público.');
    } finally {
      setUploading(false);
    }
  };

  const handleSaveService = async () => {
    if (!editingService?.name) return;
    setSaving(true);

    // 1. Upsert Service
    const { data, error } = await supabase
      .from('services')
      .upsert(editingService)
      .select()
      .single();

    if (error || !data) {
      alert('Erro ao salvar serviço');
      setSaving(false);
      return;
    }

    // 2. Update Relationships (Delete all, then Insert selected)
    const serviceId = data.id;
    await supabase.from('service_professionals').delete().eq('service_id', serviceId);

    const relations = Array.from(selectedProsForService).map(proId => ({
      service_id: serviceId,
      professional_id: proId
    }));

    if (relations.length > 0) {
      await supabase.from('service_professionals').insert(relations);
    }

    setSaving(false);
    setShowServiceModal(false);
    fetchData();
  };

  // --- PROFESSIONAL MANAGEMENT ---

  const openProModal = (pro?: Professional) => {
    setEditingProProfile(pro || { name: '', role: '', bio: '', photo_url: '', email: '', password: '', is_admin: false });
    setShowProModal(true);
  };

  const handleSavePro = async () => {
    if (!editingProProfile?.name) return;
    setSaving(true);
    await supabase.from('professionals').upsert(editingProProfile);
    setSaving(false);
    setShowProModal(false);
    fetchData();
  };

  // --- SCHEDULE MANAGEMENT ---

  const openScheduleModal = async (pro: Professional) => {
    setEditingProSchedule(pro);
    setLoading(true);
    // Fetch existing availability
    const { data } = await supabase.from('availability').select('*').eq('professional_id', pro.id);
    
    // Initialize form for all 7 days
    const form: Partial<Availability>[] = [];
    for (let i = 0; i < 7; i++) {
      const existing = data?.find(d => d.day_of_week === i);
      form.push(existing || {
        professional_id: pro.id,
        day_of_week: i,
        is_available: false,
        time_slots: []
      });
    }
    setScheduleForm(form);
    setLoading(false);
  };

  const toggleSlot = (dayIndex: number, time: string) => {
    const newForm = [...scheduleForm];
    const day = newForm[dayIndex];
    if (!day.time_slots) day.time_slots = [];
    
    if (day.time_slots.includes(time)) {
      day.time_slots = day.time_slots.filter(t => t !== time);
    } else {
      day.time_slots.push(time);
    }
    setScheduleForm(newForm);
  };

  const handleSaveSchedule = async () => {
    setSaving(true);
    // Upsert all days
    const updates = scheduleForm.map(item => ({
      professional_id: editingProSchedule!.id,
      day_of_week: item.day_of_week,
      is_available: item.is_available,
      time_slots: item.time_slots
    }));
    
    await supabase.from('availability').upsert(updates, { onConflict: 'professional_id,day_of_week' });
    setSaving(false);
    setEditingProSchedule(null);
  };

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <header className="bg-white shadow-sm sticky top-0 z-30">
        <div className="max-w-6xl mx-auto px-4 py-4 flex justify-between items-center">
          <div className="flex items-center gap-2">
            <div className="bg-slate-900 text-white p-2 rounded-lg">
              <Icons.Admin className="w-5 h-5" />
            </div>
            <div>
              <h1 className="font-bold text-slate-900 leading-tight">Painel Administrativo</h1>
              <p className="text-xs text-slate-500">Olá, {user.name} ({user.is_admin ? 'Admin' : 'Profissional'})</p>
            </div>
          </div>
          <button 
            onClick={onLogout}
            className="flex items-center gap-2 text-sm font-bold text-rose-600 hover:text-rose-700 bg-rose-50 px-4 py-2 rounded-full transition"
          >
            <Icons.Logout className="w-4 h-4" /> Sair
          </button>
        </div>
        
        {/* Navigation Tabs */}
        <div className="flex justify-center border-t border-gray-100 bg-white">
          <nav className="flex gap-8">
            <button 
              onClick={() => setActiveTab('appointments')}
              className={`py-4 px-2 text-sm font-bold border-b-2 transition ${activeTab === 'appointments' ? 'border-rose-600 text-rose-600' : 'border-transparent text-gray-500 hover:text-slate-800'}`}
            >
              Agendamentos
            </button>
            <button 
              onClick={() => setActiveTab('services')}
              className={`py-4 px-2 text-sm font-bold border-b-2 transition ${activeTab === 'services' ? 'border-rose-600 text-rose-600' : 'border-transparent text-gray-500 hover:text-slate-800'}`}
            >
              Serviços
            </button>
            {user.is_admin && (
              <button 
                onClick={() => setActiveTab('professionals')}
                className={`py-4 px-2 text-sm font-bold border-b-2 transition ${activeTab === 'professionals' ? 'border-rose-600 text-rose-600' : 'border-transparent text-gray-500 hover:text-slate-800'}`}
              >
                Equipe
              </button>
            )}
          </nav>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-8">
        
        {/* --- APPOINTMENTS TAB --- */}
        {activeTab === 'appointments' && (
          <div className="animate-fade-in">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-bold text-slate-800">Próximos Agendamentos</h2>
              <button onClick={() => fetchData()} className="text-rose-600 hover:bg-rose-50 p-2 rounded-full"><Icons.Loading className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} /></button>
            </div>
            
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
              {appointments.length === 0 ? (
                <div className="p-12 text-center text-gray-400">Nenhum agendamento encontrado.</div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left">
                    <thead className="bg-gray-50 border-b border-gray-200">
                      <tr>
                        <th className="p-4 text-xs font-bold text-gray-500 uppercase">Cliente</th>
                        <th className="p-4 text-xs font-bold text-gray-500 uppercase">Serviço/Profissional</th>
                        <th className="p-4 text-xs font-bold text-gray-500 uppercase">Data/Hora</th>
                        <th className="p-4 text-xs font-bold text-gray-500 uppercase">Status</th>
                        <th className="p-4 text-xs font-bold text-gray-500 uppercase text-right">Ações</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {appointments.map(app => (
                        <tr key={app.id} className="hover:bg-gray-50 transition">
                          <td className="p-4">
                            <div className="font-bold text-slate-800">{app.customer_name}</div>
                            <div className="text-xs text-gray-500">{app.customer_phone}</div>
                          </td>
                          <td className="p-4">
                            <div className="text-sm font-medium text-slate-700">{app.services?.name}</div>
                            <div className="text-xs text-gray-500">{app.professionals?.name}</div>
                          </td>
                          <td className="p-4">
                            <div className="text-sm text-slate-700 font-medium">{formatDate(app.start_time).split(',')[0]}</div>
                            <div className="text-xs text-gray-500">{formatDate(app.start_time).split(',')[1]}</div>
                          </td>
                          <td className="p-4">
                            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium
                              ${app.status === 'confirmed' ? 'bg-green-100 text-green-800' : 
                                app.status === 'cancelled' || app.status === 'rejected' ? 'bg-red-100 text-red-800' : 
                                app.status === 'waiting_payment' ? 'bg-yellow-100 text-yellow-800' :
                                'bg-blue-100 text-blue-800'}`}>
                              {app.status === 'waiting_payment' ? 'Aguardando Pagamento' : 
                               app.status === 'confirmed' ? 'Confirmado' :
                               app.status === 'pending' ? 'Pendente' :
                               app.status === 'cancelled' ? 'Cancelado' : 'Rejeitado'}
                            </span>
                          </td>
                          <td className="p-4 text-right space-x-2">
                            {app.status !== 'confirmed' && app.status !== 'cancelled' && (
                              <button onClick={() => handleUpdateStatus(app.id, 'confirmed')} className="text-green-600 hover:bg-green-50 p-1 rounded" title="Confirmar"><Icons.Check className="w-5 h-5"/></button>
                            )}
                            {app.status !== 'rejected' && app.status !== 'cancelled' && (
                              <button onClick={() => handleUpdateStatus(app.id, 'rejected')} className="text-red-600 hover:bg-red-50 p-1 rounded" title="Rejeitar"><Icons.X className="w-5 h-5"/></button>
                            )}
                            {app.status === 'confirmed' && (
                              <button onClick={() => handleUpdateStatus(app.id, 'cancelled')} className="text-gray-400 hover:text-red-600 p-1" title="Cancelar"><Icons.X className="w-5 h-5"/></button>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}

        {/* --- SERVICES TAB --- */}
        {activeTab === 'services' && (
          <div className="animate-fade-in">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-bold text-slate-800">Gerenciar Serviços</h2>
              {user.is_admin && (
                <button onClick={() => openServiceModal()} className="bg-rose-600 hover:bg-rose-700 text-white px-4 py-2 rounded-lg font-bold text-sm flex items-center gap-2">
                  <Icons.Add className="w-4 h-4"/> Novo Serviço
                </button>
              )}
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {services.map(service => (
                <div key={service.id} className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden group">
                  <div className="h-40 bg-gray-100 overflow-hidden relative">
                     <img src={service.image_url} className="w-full h-full object-cover group-hover:scale-105 transition" alt={service.name} />
                     <div className="absolute top-2 right-2 bg-white/90 px-2 py-1 rounded text-xs font-bold shadow-sm">
                       R$ {service.price}
                     </div>
                  </div>
                  <div className="p-5">
                    <h3 className="font-bold text-lg text-slate-800 mb-1">{service.name}</h3>
                    <p className="text-xs text-gray-500 mb-4 line-clamp-2">{service.description}</p>
                    <div className="flex justify-between items-center mt-4">
                       <span className="text-xs bg-gray-100 px-2 py-1 rounded text-gray-600">{service.duration_minutes} min</span>
                       {user.is_admin && (
                         <div className="flex gap-2">
                           <button onClick={() => openServiceModal(service)} className="text-blue-600 hover:bg-blue-50 p-1.5 rounded"><Icons.Admin className="w-4 h-4"/></button>
                           <button onClick={() => handleDelete('services', service.id)} className="text-red-600 hover:bg-red-50 p-1.5 rounded"><Icons.Delete className="w-4 h-4"/></button>
                         </div>
                       )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* --- PROFESSIONALS TAB --- */}
        {activeTab === 'professionals' && user.is_admin && (
          <div className="animate-fade-in">
             <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-bold text-slate-800">Equipe Profissional</h2>
              <button onClick={() => openProModal()} className="bg-rose-600 hover:bg-rose-700 text-white px-4 py-2 rounded-lg font-bold text-sm flex items-center gap-2">
                <Icons.Add className="w-4 h-4"/> Novo Profissional
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {professionals.map(pro => (
                <div key={pro.id} className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm flex items-start gap-4">
                  <img src={pro.photo_url} alt={pro.name} className="w-16 h-16 rounded-full object-cover border-2 border-rose-100" />
                  <div className="flex-1">
                    <h3 className="font-bold text-lg text-slate-800">{pro.name}</h3>
                    <p className="text-sm text-rose-600 font-medium mb-1">{pro.role}</p>
                    <p className="text-xs text-gray-500 mb-4">{pro.email}</p>
                    <div className="flex gap-2">
                       <button 
                        onClick={() => openScheduleModal(pro)}
                        className="text-xs font-bold bg-slate-800 text-white px-3 py-1.5 rounded hover:bg-slate-700 transition"
                       >
                         Gerenciar Agenda
                       </button>
                       <button onClick={() => openProModal(pro)} className="text-blue-600 hover:bg-blue-50 p-1.5 rounded"><Icons.Admin className="w-4 h-4"/></button>
                       <button onClick={() => handleDelete('professionals', pro.id)} className="text-red-600 hover:bg-red-50 p-1.5 rounded"><Icons.Delete className="w-4 h-4"/></button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
        
        {/* If user is Pro (not admin), allow them to edit their own schedule */}
        {!user.is_admin && (
           <div className="fixed bottom-8 right-8">
             <button 
               onClick={() => openScheduleModal(user)}
               className="bg-slate-800 text-white px-6 py-3 rounded-full shadow-xl font-bold flex items-center gap-2 hover:bg-slate-700 transition"
             >
               <Icons.Clock className="w-5 h-5" /> Meu Horário
             </button>
           </div>
        )}

      </main>

      {/* --- SERVICE MODAL --- */}
      {showServiceModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-white rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-2xl p-6 relative">
            <button onClick={() => setShowServiceModal(false)} className="absolute top-4 right-4 text-gray-400 hover:text-gray-600"><Icons.X /></button>
            <h2 className="text-xl font-bold mb-6">{editingService?.id ? 'Editar Serviço' : 'Novo Serviço'}</h2>
            
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                 <div>
                   <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Nome</label>
                   <input 
                     type="text" className="w-full border rounded p-2" 
                     value={editingService?.name} onChange={e => setEditingService({...editingService, name: e.target.value})}
                   />
                 </div>
                 <div>
                   <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Preço (R$)</label>
                   <input 
                     type="number" className="w-full border rounded p-2" 
                     value={editingService?.price} onChange={e => setEditingService({...editingService, price: parseFloat(e.target.value)})}
                   />
                 </div>
              </div>
              
              <div>
                 <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Descrição</label>
                 <textarea 
                   className="w-full border rounded p-2 h-20" 
                   value={editingService?.description} onChange={e => setEditingService({...editingService, description: e.target.value})}
                 />
              </div>

              <div className="grid grid-cols-2 gap-4">
                 <div>
                   <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Duração (min)</label>
                   <input 
                     type="number" className="w-full border rounded p-2" 
                     value={editingService?.duration_minutes} onChange={e => setEditingService({...editingService, duration_minutes: parseInt(e.target.value)})}
                   />
                 </div>
                 <div>
                   <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Categoria</label>
                   <input 
                     type="text" className="w-full border rounded p-2" 
                     value={editingService?.category} onChange={e => setEditingService({...editingService, category: e.target.value})}
                   />
                 </div>
              </div>

              <div className="border-t pt-4 mt-4">
                 <h3 className="font-bold text-sm mb-3 text-slate-800">Pagamento Pix</h3>
                 <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                   <div>
                     <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Chave Pix</label>
                     <input 
                       type="text" className="w-full border rounded p-2 bg-yellow-50 border-yellow-200" placeholder="Ex: email@pix.com"
                       value={editingService?.pix_key} onChange={e => setEditingService({...editingService, pix_key: e.target.value})}
                     />
                   </div>
                   
                   {/* QR CODE UPLOAD SECTION */}
                   <div>
                      <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Imagem QR Code</label>
                      <div className="flex items-center gap-2">
                         <label className="cursor-pointer bg-slate-100 hover:bg-slate-200 text-slate-600 px-3 py-2 rounded text-xs font-bold flex items-center gap-2 transition">
                           <Icons.Upload className="w-4 h-4"/> Upload Imagem
                           <input type="file" accept="image/*" className="hidden" onChange={handleQrUpload} disabled={uploading} />
                         </label>
                         {uploading && <Icons.Loading className="animate-spin text-rose-600 w-4 h-4"/>}
                      </div>
                      <input 
                        type="text" 
                        placeholder="Ou cole URL da imagem..."
                        className="w-full border rounded p-2 text-xs mt-2" 
                        value={editingService?.pix_qr_url || ''} 
                        onChange={e => setEditingService({...editingService, pix_qr_url: e.target.value})}
                      />
                   </div>
                 </div>
                 {editingService?.pix_qr_url && (
                   <div className="mt-2 p-2 border rounded bg-gray-50 inline-block">
                      <img src={editingService.pix_qr_url} alt="QR Preview" className="h-24 w-24 object-contain" />
                   </div>
                 )}
              </div>
              
              <div className="border-t pt-4 mt-4">
                 <h3 className="font-bold text-sm mb-3 text-slate-800">Profissionais Habilitados</h3>
                 <div className="grid grid-cols-2 gap-2 max-h-32 overflow-y-auto p-2 border rounded bg-gray-50">
                    {professionals.map(pro => (
                      <label key={pro.id} className="flex items-center gap-2 cursor-pointer hover:bg-gray-100 p-1 rounded">
                        <input 
                          type="checkbox" 
                          checked={selectedProsForService.has(pro.id)}
                          onChange={e => {
                            const newSet = new Set(selectedProsForService);
                            e.target.checked ? newSet.add(pro.id) : newSet.delete(pro.id);
                            setSelectedProsForService(newSet);
                          }}
                          className="rounded text-rose-600 focus:ring-rose-500"
                        />
                        <span className="text-sm">{pro.name}</span>
                      </label>
                    ))}
                 </div>
              </div>

              <div className="border-t pt-6 flex justify-end gap-3">
                <button onClick={() => setShowServiceModal(false)} className="px-4 py-2 rounded-lg text-gray-600 hover:bg-gray-100 font-bold">Cancelar</button>
                <button 
                  onClick={handleSaveService} 
                  disabled={saving}
                  className="bg-rose-600 hover:bg-rose-700 text-white px-6 py-2 rounded-lg font-bold flex items-center gap-2"
                >
                  {saving && <Icons.Loading className="animate-spin w-4 h-4" />} Salvar Serviço
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* --- PROFESSIONAL MODAL --- */}
      {showProModal && (
         <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
           <div className="bg-white rounded-2xl w-full max-w-lg shadow-2xl p-6 relative">
             <button onClick={() => setShowProModal(false)} className="absolute top-4 right-4 text-gray-400 hover:text-gray-600"><Icons.X /></button>
             <h2 className="text-xl font-bold mb-6">{editingProProfile?.id ? 'Editar Profissional' : 'Novo Profissional'}</h2>
             
             <div className="space-y-4">
               <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Nome</label>
                  <input 
                    type="text" className="w-full border rounded p-2"
                    value={editingProProfile?.name} onChange={e => setEditingProProfile({...editingProProfile, name: e.target.value})}
                  />
               </div>
               <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Cargo</label>
                  <input 
                    type="text" className="w-full border rounded p-2"
                    value={editingProProfile?.role} onChange={e => setEditingProProfile({...editingProProfile, role: e.target.value})}
                  />
               </div>
               <div className="grid grid-cols-2 gap-4">
                 <div>
                    <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Email (Login)</label>
                    <input 
                      type="email" className="w-full border rounded p-2"
                      value={editingProProfile?.email} onChange={e => setEditingProProfile({...editingProProfile, email: e.target.value})}
                    />
                 </div>
                 <div>
                    <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Senha</label>
                    <input 
                      type="password" className="w-full border rounded p-2" placeholder="Nova senha..."
                      value={editingProProfile?.password} onChange={e => setEditingProProfile({...editingProProfile, password: e.target.value})}
                    />
                 </div>
               </div>
               <div>
                 <label className="flex items-center gap-2 mt-2">
                   <input 
                     type="checkbox" 
                     checked={editingProProfile?.is_admin || false}
                     onChange={e => setEditingProProfile({...editingProProfile, is_admin: e.target.checked})}
                   />
                   <span className="text-sm font-bold text-slate-700">Acesso Administrador</span>
                 </label>
               </div>

               <div className="border-t pt-6 flex justify-end gap-3">
                <button onClick={() => setShowProModal(false)} className="px-4 py-2 rounded-lg text-gray-600 hover:bg-gray-100 font-bold">Cancelar</button>
                <button 
                  onClick={handleSavePro} 
                  disabled={saving}
                  className="bg-rose-600 hover:bg-rose-700 text-white px-6 py-2 rounded-lg font-bold flex items-center gap-2"
                >
                  {saving && <Icons.Loading className="animate-spin w-4 h-4" />} Salvar
                </button>
              </div>
             </div>
           </div>
         </div>
      )}

      {/* --- SCHEDULE MODAL --- */}
      {editingProSchedule && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-white rounded-2xl w-full max-w-4xl max-h-[90vh] overflow-y-auto shadow-2xl p-6 relative">
            <button onClick={() => setEditingProSchedule(null)} className="absolute top-4 right-4 text-gray-400 hover:text-gray-600"><Icons.X /></button>
            <h2 className="text-xl font-bold mb-1">Gerenciar Agenda</h2>
            <p className="text-sm text-gray-500 mb-6">Defina os horários de atendimento para <span className="text-rose-600 font-bold">{editingProSchedule.name}</span></p>

            <div className="space-y-6">
              {scheduleForm.map((day, index) => (
                <div key={index} className="border-b border-gray-100 pb-4 last:border-0">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <label className="relative inline-flex items-center cursor-pointer">
                        <input 
                          type="checkbox" className="sr-only peer"
                          checked={day.is_available}
                          onChange={e => {
                             const newForm = [...scheduleForm];
                             newForm[index].is_available = e.target.checked;
                             setScheduleForm(newForm);
                          }}
                        />
                        <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-green-600"></div>
                      </label>
                      <span className={`font-bold ${day.is_available ? 'text-slate-800' : 'text-gray-400'}`}>
                        {DAYS_OF_WEEK[index]}
                      </span>
                    </div>
                  </div>
                  
                  {day.is_available && (
                    <div className="ml-14 grid grid-cols-4 md:grid-cols-8 gap-2">
                       {GENERATED_HOURS.map(hour => {
                         const isSelected = day.time_slots?.includes(hour);
                         return (
                           <button
                             key={hour}
                             onClick={() => toggleSlot(index, hour)}
                             className={`text-xs py-1.5 px-1 rounded border transition ${
                               isSelected 
                               ? 'bg-rose-600 text-white border-rose-600' 
                               : 'bg-white text-gray-500 border-gray-200 hover:border-rose-300'
                             }`}
                           >
                             {hour}
                           </button>
                         )
                       })}
                    </div>
                  )}
                </div>
              ))}
            </div>

            <div className="sticky bottom-0 bg-white pt-4 mt-4 border-t flex justify-end gap-3">
              <button onClick={() => setEditingProSchedule(null)} className="px-4 py-2 rounded-lg text-gray-600 hover:bg-gray-100 font-bold">Cancelar</button>
              <button 
                onClick={handleSaveSchedule} 
                disabled={saving}
                className="bg-green-600 hover:bg-green-700 text-white px-6 py-2 rounded-lg font-bold flex items-center gap-2"
              >
                {saving && <Icons.Loading className="animate-spin w-4 h-4" />} Salvar Horários
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};