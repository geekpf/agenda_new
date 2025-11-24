export interface Service {
  id: string;
  name: string;
  description: string;
  duration_minutes: number;
  price: number;
  pix_key: string;
  image_url: string;
  pix_qr_url?: string; // New field for custom QR Code image
  category: string;
}

export interface Professional {
  id: string;
  name: string;
  role: string;
  bio: string;
  photo_url: string;
  // Auth fields
  email?: string;
  password?: string;
  is_admin?: boolean;
}

export interface Availability {
  id: string;
  professional_id: string;
  day_of_week: number; // 0 = Sunday, 1 = Monday, etc.
  time_slots: string[]; // ["09:00", "10:00", "14:00"]
  is_available: boolean;
}

export interface Appointment {
  id: string;
  created_at: string;
  service_id: string;
  professional_id: string;
  customer_name: string;
  customer_phone: string;
  start_time: string; // ISO string
  end_time: string; // ISO string
  status: 'pending' | 'confirmed' | 'rejected' | 'cancelled';
  notes?: string;
  // Joins
  services?: Service;
  professionals?: Professional;
}

export enum BookingStep {
  SELECT_SERVICE = 0,
  SELECT_PROFESSIONAL = 1,
  SELECT_DATE = 2,
  USER_DETAILS = 3, // New Step
  PAYMENT = 4,      // Previously REVIEW
  CONFIRMATION = 5,
}

export const DAYS_OF_WEEK = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];