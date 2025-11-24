export const REQUIRED_SQL = `
-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- 1. Services Table
create table if not exists services (
  id uuid default uuid_generate_v4() primary key,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  name text not null,
  description text,
  duration_minutes integer not null,
  price numeric not null,
  pix_key text,
  image_url text,
  category text default 'Geral'
);

-- 2. Professionals Table (Updated for Auth)
create table if not exists professionals (
  id uuid default uuid_generate_v4() primary key,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  name text not null,
  role text,
  bio text,
  photo_url text,
  email text unique,
  password text,
  is_admin boolean default false
);

-- 3. Service_Professionals Relation (Many-to-Many)
create table if not exists service_professionals (
  service_id uuid references services(id) on delete cascade,
  professional_id uuid references professionals(id) on delete cascade,
  primary key (service_id, professional_id)
);

-- 4. Availability Table
create table if not exists availability (
  id uuid default uuid_generate_v4() primary key,
  professional_id uuid references professionals(id) on delete cascade,
  day_of_week integer not null, -- 0-6
  time_slots text[], -- Array of specific start times e.g. ['09:00', '10:00']
  is_available boolean default true,
  unique(professional_id, day_of_week)
);

-- 5. Appointments Table
create table if not exists appointments (
  id uuid default uuid_generate_v4() primary key,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  service_id uuid references services(id),
  professional_id uuid references professionals(id),
  customer_name text not null,
  customer_phone text not null,
  start_time timestamp with time zone not null,
  end_time timestamp with time zone not null,
  status text default 'pending', -- pending, confirmed, rejected, cancelled
  notes text
);

-- RLS Policies
alter table services enable row level security;
create policy "Public read services" on services for select using (true);
create policy "Public modify services" on services for all using (true);

alter table professionals enable row level security;
create policy "Public read professionals" on professionals for select using (true);
create policy "Public modify professionals" on professionals for all using (true);

alter table service_professionals enable row level security;
create policy "Public read service_professionals" on service_professionals for select using (true);
create policy "Public modify service_professionals" on service_professionals for all using (true);

alter table availability enable row level security;
create policy "Public read availability" on availability for select using (true);
create policy "Public modify availability" on availability for all using (true);

alter table appointments enable row level security;
create policy "Public read appointments" on appointments for select using (true);
create policy "Public insert appointments" on appointments for insert with check (true);
create policy "Public modify appointments" on appointments for all using (true);

-- Initial Data Seeding
-- Create Services
insert into services (name, description, duration_minutes, price, pix_key, image_url, category) values 
('Corte Premium', 'Lavagem, corte e finalização', 60, 80.00, 'pix@aura.com', 'https://picsum.photos/400/300?random=1', 'Cabelo'),
('Manicure em Gel', 'Esmaltação de longa duração', 60, 120.00, 'pix@aura.com', 'https://picsum.photos/400/300?random=2', 'Unhas'),
('Massagem Relaxante', 'Alívio de stress e dores musculares', 60, 150.00, 'pix@aura.com', 'https://picsum.photos/400/300?random=3', 'Massagem')
on conflict do nothing;

-- Create Professionals
-- Admin User
insert into professionals (name, role, bio, photo_url, email, password, is_admin) values
('Administrador', 'Gerente', 'Gerente do sistema', 'https://ui-avatars.com/api/?name=Admin&background=0D8ABC&color=fff', 'admin@aura.com', 'admin', true);

-- Regular Pros
insert into professionals (name, role, bio, photo_url, email, password, is_admin) values
('Alice Silva', 'Cabeleireira', 'Especialista em cortes modernos.', 'https://picsum.photos/200/200?random=4', 'alice@aura.com', '123456', false),
('Bruno Santos', 'Massoterapeuta', 'Massagem terapêutica certificada.', 'https://picsum.photos/200/200?random=5', 'bruno@aura.com', '123456', false),
('Carla Dias', 'Manicure', 'Nail designer premiada.', 'https://picsum.photos/200/200?random=6', 'carla@aura.com', '123456', false);

-- Link Services to Professionals (Note: IDs are dynamic, this is logic for reference, usually ran manually or via specific lookup if UUIDs known)
-- Since UUIDs are random, this block in real SQL editor should be run carefully.
-- For this setup guide, we use subqueries which work if names are unique.
insert into service_professionals (service_id, professional_id) 
select s.id, p.id from services s, professionals p where s.name = 'Corte Premium' and p.name = 'Alice Silva';

insert into service_professionals (service_id, professional_id) 
select s.id, p.id from services s, professionals p where s.name = 'Massagem Relaxante' and p.name = 'Bruno Santos';

insert into service_professionals (service_id, professional_id) 
select s.id, p.id from services s, professionals p where s.name = 'Manicure em Gel' and p.name = 'Carla Dias';
`;