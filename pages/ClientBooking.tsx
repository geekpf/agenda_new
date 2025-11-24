import React, { useEffect, useState } from 'react';
import { supabase } from '../services/supabaseClient';
import { Service, Professional, Availability, BookingStep, DAYS_OF_WEEK } from '../types';
import { Icons } from '../components/Icons';

// Helper functions for dates (replacing date-fns to ensure stability)
const startOfToday = () => {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
};

const setHours = (date: Date, hours: number) => {
  const d = new Date(date);
  d.setHours(hours);
  return d;
};

const setMinutes = (date: Date, minutes: number) => {
  const d = new Date(date);
  d.setMinutes(minutes);
  return d;
};

const addDays = (date: Date, days: number) => {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
};

const isSameDay = (d1: Date, d2: Date) => {
  return (
    d1.getDate() === d2.getDate() &&
    d1.getMonth() === d2.getMonth() &&
    d1.getFullYear() === d2.getFullYear()
  );
};

// Formatter for BRL currency
const formatBRL = (value: number) => {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
};

// Formatter for Date in PT-BR
const formatDatePT = (date: Date) => {
  return new Intl.DateTimeFormat('pt-BR', { day: 'numeric', month: 'long', year: 'numeric' }).format(date);
};

interface Props {
  onSuccess: () => void;
}

export const ClientBooking: React.FC<Props> = ({ onSuccess }) => {
  const [step, setStep] = useState<BookingStep>(BookingStep.SELECT_SERVICE);
  const [services, setServices] = useState<Service[]>([]);
  const [professionals, setProfessionals] = useState<Professional[]>([]);
  const [availabilities, setAvailabilities] = useState<Availability[]>([]);
  
  const [selectedService, setSelectedService] = useState<Service | null>(null);
  const [selectedProfessional, setSelectedProfessional] = useState<Professional | null>(null);
  const [selectedDate, setSelectedDate] = useState<Date>(startOfToday());
  const [selectedTimeSlot, setSelectedTimeSlot] = useState<string | null>(null);
  
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchInitialData();
  }, []);

  const fetchInitialData = async () => {
    setLoading(true);
    const { data: sData } = await supabase.from('services').select('*');
    if (sData) setServices(sData);
    setLoading(false);
  };

  const fetchProfessionalsForService = async (serviceId: string) => {
    setLoading(true);
    // Query the join table to find professionals linked to this service
    const { data, error } = await supabase
      .from('service_professionals')
      .select('professionals(*)')
      .eq('service_id', serviceId);
      
    if (data) {
      // Extract the nested professional objects
      const pros = data.map((item: any) => item.professionals) as Professional[];
      setProfessionals(pros);
    } else {
      setProfessionals([]);
    }
    setLoading(false);
  };

  const fetchAvailability = async (proId: string) => {
    const { data } = await supabase.from('availability').select('*').eq('professional_id', proId);
    if (data) setAvailabilities(data);
  };

  const handleServiceSelect = (service: Service) => {
    setSelectedService(service);
    fetchProfessionalsForService(service.id);
    setStep(BookingStep.SELECT_PROFESSIONAL);
  };

  const handleProfessionalSelect = async (pro: Professional) => {
    setSelectedProfessional(pro);
    await fetchAvailability(pro.id);
    setStep(BookingStep.SELECT_DATE);
  };

  const generateTimeSlots = () => {
    if (!selectedProfessional || !selectedService) return [];
    
    const dayOfWeek = selectedDate.getDay();
    const schedule = availabilities.find(a => a.day_of_week === dayOfWeek);
    
    if (!schedule || !schedule.is_available) return [];
    
    if (schedule.time_slots && schedule.time_slots.length > 0) {
      return schedule.time_slots.sort();
    }

    return [];
  };

  const handleBooking = async () => {
    if (!selectedService || !selectedProfessional || !selectedTimeSlot) return;
    
    setLoading(true);
    setError(null);

    // Construct timestamp
    const [hours, minutes] = selectedTimeSlot.split(':').map(Number);
    const startDate = setMinutes(setHours(selectedDate, hours), minutes);
    const endDate = setMinutes(startDate, startDate.getMinutes() + selectedService.duration_minutes);

    const { error: bookingError } = await supabase.from('appointments').insert({
      service_id: selectedService.id,
      professional_id: selectedProfessional.id,
      customer_name: customerName,
      customer_phone: customerPhone,
      start_time: startDate.toISOString(),
      end_time: endDate.toISOString(),
      status: 'pending' // pending until confirmed
    });

    setLoading(false);

    if (bookingError) {
      setError('Falha ao criar agendamento. Por favor, tente novamente.');
    } else {
      setStep(BookingStep.CONFIRMATION);
    }
  };

  const renderProgressBar = () => (
    <div className="w-full bg-gray-200 h-2 rounded-full mb-8">
      <div 
        className="bg-rose-500 h-2 rounded-full transition-all duration-300" 
        style={{ width: `${(step / 4) * 100}%` }}
      />
    </div>
  );

  if (step === BookingStep.CONFIRMATION) {
    return (
      <div className="text-center py-12 px-4 animate-fade-in">
        <div className="w-20 h-20 bg-green-100 text-green-600 rounded-full flex items-center justify-center mx-auto mb-6">
          <Icons.Check className="w-10 h-10" />
        </div>
        <h2 className="text-3xl font-bold text-slate-800 mb-4">Solicitação Enviada!</h2>
        <p className="text-gray-600 mb-8 max-w-md mx-auto">
          Seu pedido de agendamento para <strong>{selectedService?.name}</strong> com <strong>{selectedProfessional?.name}</strong> foi enviado. 
          Entraremos em contato em breve via WhatsApp para confirmar os detalhes.
        </p>
        <button 
          onClick={() => window.location.reload()}
          className="bg-rose-600 text-white px-8 py-3 rounded-full font-semibold shadow-lg hover:bg-rose-700 transition"
        >
          Agendar Outro
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto p-4 md:p-8 bg-white min-h-[600px] rounded-2xl shadow-xl">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-slate-800">Agende seu Horário</h1>
        {step > 0 && (
          <button 
            onClick={() => setStep(step - 1)}
            className="text-gray-500 hover:text-rose-600 flex items-center gap-1 text-sm font-medium"
          >
            <Icons.Back className="w-4 h-4" /> Voltar
          </button>
        )}
      </div>

      {renderProgressBar()}

      {/* Step 0: Services */}
      {step === BookingStep.SELECT_SERVICE && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {services.map(service => (
            <div 
              key={service.id}
              onClick={() => handleServiceSelect(service)}
              className="border border-gray-200 p-4 rounded-xl hover:border-rose-500 hover:shadow-lg cursor-pointer transition flex gap-4 group"
            >
              <div className="w-24 h-24 bg-gray-100 rounded-lg overflow-hidden flex-shrink-0">
                <img src={service.image_url} alt={service.name} className="w-full h-full object-cover group-hover:scale-105 transition" />
              </div>
              <div>
                <h3 className="font-bold text-lg text-slate-800 group-hover:text-rose-600">{service.name}</h3>
                <p className="text-sm text-gray-500 mb-2">{service.description}</p>
                <div className="flex items-center gap-3 text-sm font-medium">
                  <span className="text-green-600 flex items-center"><Icons.Money className="w-3 h-3 mr-1"/> {formatBRL(service.price)}</span>
                  <span className="text-blue-600 flex items-center"><Icons.Clock className="w-3 h-3 mr-1"/> {service.duration_minutes}m</span>
                </div>
              </div>
            </div>
          ))}
          {services.length === 0 && !loading && (
            <p className="text-center col-span-2 text-gray-500 py-12">Nenhum serviço disponível.</p>
          )}
          {loading && <div className="col-span-2 flex justify-center py-12"><Icons.Loading className="animate-spin w-8 h-8 text-rose-500"/></div>}
        </div>
      )}

      {/* Step 1: Professionals */}
      {step === BookingStep.SELECT_PROFESSIONAL && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {professionals.length > 0 ? (
            professionals.map(pro => (
              <div 
                key={pro.id}
                onClick={() => handleProfessionalSelect(pro)}
                className="bg-white border border-gray-200 rounded-xl p-6 text-center hover:border-rose-500 hover:shadow-xl cursor-pointer transition"
              >
                <div className="w-24 h-24 mx-auto rounded-full overflow-hidden mb-4 border-2 border-rose-100">
                  <img src={pro.photo_url} alt={pro.name} className="w-full h-full object-cover" />
                </div>
                <h3 className="font-bold text-lg text-slate-800">{pro.name}</h3>
                <p className="text-rose-500 text-sm font-medium mb-2">{pro.role}</p>
                <p className="text-xs text-gray-500 line-clamp-2">{pro.bio}</p>
              </div>
            ))
          ) : (
            <div className="col-span-3 text-center py-12 bg-gray-50 rounded-lg border border-dashed border-gray-300">
              <p className="text-gray-500 mb-2">Nenhum profissional disponível para este serviço.</p>
              <button onClick={() => setStep(BookingStep.SELECT_SERVICE)} className="text-rose-600 font-bold hover:underline">Escolher outro serviço</button>
            </div>
          )}
          {loading && <div className="col-span-3 flex justify-center"><Icons.Loading className="animate-spin w-8 h-8 text-rose-500"/></div>}
        </div>
      )}

      {/* Step 2: Date & Time */}
      {step === BookingStep.SELECT_DATE && (
        <div className="flex flex-col md:flex-row gap-8">
          <div className="flex-1">
            <h3 className="font-semibold text-slate-700 mb-4 flex items-center gap-2"><Icons.Calendar className="w-5 h-5"/> Selecione a Data</h3>
            <div className="grid grid-cols-4 gap-2">
              {[0, 1, 2, 3, 4, 5, 6, 7].map(offset => {
                const date = addDays(startOfToday(), offset);
                const isSelected = isSameDay(date, selectedDate);
                const dayName = DAYS_OF_WEEK[date.getDay()].substring(0, 3);
                return (
                  <button
                    key={offset}
                    onClick={() => { setSelectedDate(date); setSelectedTimeSlot(null); }}
                    className={`p-3 rounded-lg border text-center transition ${isSelected ? 'bg-rose-600 text-white border-rose-600' : 'bg-white hover:bg-rose-50 border-gray-200'}`}
                  >
                    <div className="text-xs uppercase font-bold opacity-70">{dayName}</div>
                    <div className="text-lg font-bold">{date.getDate()}</div>
                  </button>
                );
              })}
            </div>
          </div>
          <div className="flex-1">
            <h3 className="font-semibold text-slate-700 mb-4 flex items-center gap-2"><Icons.Clock className="w-5 h-5"/> Horários Disponíveis</h3>
            <div className="grid grid-cols-3 gap-2 max-h-64 overflow-y-auto">
              {generateTimeSlots().map(slot => (
                <button
                  key={slot}
                  onClick={() => setSelectedTimeSlot(slot)}
                  className={`py-2 px-1 rounded-md text-sm font-medium border transition ${selectedTimeSlot === slot ? 'bg-slate-800 text-white border-slate-800' : 'bg-white hover:border-slate-400 border-gray-200 text-gray-700'}`}
                >
                  {slot}
                </button>
              ))}
              {generateTimeSlots().length === 0 && (
                 <div className="col-span-3 text-center text-sm text-gray-400 py-8 bg-gray-50 rounded-lg">Nenhum horário disponível para este dia.</div>
              )}
            </div>
          </div>
          <div className="w-full md:w-auto flex items-end">
             <button
              disabled={!selectedTimeSlot}
              onClick={() => setStep(BookingStep.REVIEW)}
              className="w-full md:w-auto bg-rose-600 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-rose-700 text-white px-8 py-3 rounded-lg font-bold flex items-center justify-center gap-2 transition"
             >
               Próximo <Icons.Next className="w-4 h-4" />
             </button>
          </div>
        </div>
      )}

      {/* Step 3: Review & Pay */}
      {step === BookingStep.REVIEW && selectedService && selectedProfessional && (
        <div className="animate-fade-in">
          <div className="bg-rose-50 p-6 rounded-xl border border-rose-100 mb-6">
            <h3 className="font-bold text-rose-800 mb-4 text-lg">Confirmar Detalhes</h3>
            <div className="space-y-3 text-slate-700">
              <div className="flex justify-between border-b border-rose-200 pb-2">
                <span className="text-gray-500">Serviço</span>
                <span className="font-semibold">{selectedService.name}</span>
              </div>
              <div className="flex justify-between border-b border-rose-200 pb-2">
                <span className="text-gray-500">Profissional</span>
                <span className="font-semibold">{selectedProfessional.name}</span>
              </div>
              <div className="flex justify-between border-b border-rose-200 pb-2">
                <span className="text-gray-500">Data e Hora</span>
                <span className="font-semibold">{formatDatePT(selectedDate)} às {selectedTimeSlot}</span>
              </div>
              <div className="flex justify-between pt-2">
                <span className="text-gray-500">Valor Total</span>
                <span className="font-bold text-lg">{formatBRL(selectedService.price)}</span>
              </div>
              <div className="flex justify-between text-rose-600 font-bold">
                <span>Sinal Necessário (50%)</span>
                <span>{formatBRL(selectedService.price / 2)}</span>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-8">
            <div>
              <h3 className="font-bold text-slate-800 mb-4">Seus Dados</h3>
              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-1">Nome Completo</label>
                  <input 
                    type="text" 
                    value={customerName} 
                    onChange={e => setCustomerName(e.target.value)}
                    className="w-full border border-gray-300 rounded-lg p-3 focus:ring-2 focus:ring-rose-500 focus:border-rose-500 outline-none transition"
                    placeholder="Maria Silva"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-1">Telefone (WhatsApp)</label>
                  <input 
                    type="tel" 
                    value={customerPhone} 
                    onChange={e => setCustomerPhone(e.target.value)}
                    className="w-full border border-gray-300 rounded-lg p-3 focus:ring-2 focus:ring-rose-500 focus:border-rose-500 outline-none transition"
                    placeholder="(11) 99999-9999"
                  />
                </div>
              </div>
            </div>

            <div className="bg-gray-900 text-white p-6 rounded-xl flex flex-col items-center text-center">
              <h4 className="font-bold text-yellow-400 mb-2 flex items-center gap-2"><Icons.Money className="w-5 h-5"/> Pagamento Pix</h4>
              <p className="text-sm text-gray-400 mb-4">Escaneie o código para pagar o sinal de 50%.</p>
              <div className="bg-white p-2 rounded-lg mb-4">
                {/* Simulated QR Code */}
                <img src={`https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${selectedService.pix_key}`} alt="Pix QR" className="w-32 h-32" />
              </div>
              <div className="text-xs break-all bg-gray-800 p-2 rounded w-full font-mono text-gray-300">
                {selectedService.pix_key}
              </div>
              <p className="text-xs text-gray-500 mt-2">O agendamento será confirmado após envio do comprovante via WhatsApp.</p>
            </div>
          </div>

          {error && <div className="bg-red-50 text-red-600 p-3 rounded-lg mb-4 text-sm">{error}</div>}

          <button 
            onClick={handleBooking}
            disabled={!customerName || !customerPhone || loading}
            className="w-full bg-rose-600 disabled:opacity-50 hover:bg-rose-700 text-white py-4 rounded-xl font-bold text-lg shadow-xl hover:shadow-2xl transition transform hover:-translate-y-1"
          >
            {loading ? 'Processando...' : 'Confirmar Agendamento'}
          </button>
        </div>
      )}
    </div>
  );
};