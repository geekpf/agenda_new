import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://stgzdrnlrlnmkfvefjwl.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InN0Z3pkcm5scmxubWtmdmVmandsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjM5Mzc2MjYsImV4cCI6MjA3OTUxMzYyNn0.hNmuixWZu9rPt0fRu5hK2FX_C6vXYmUwh4XDk7A04kU';

export const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

export const checkDbConnection = async () => {
  try {
    // Check main table
    const { error: sError } = await supabase.from('services').select('count', { count: 'exact', head: true });
    if (sError && sError.code === '42P01') return false;

    // Check relationship table
    const { error: spError } = await supabase.from('service_professionals').select('count', { count: 'exact', head: true });
    if (spError && spError.code === '42P01') return false;

    // Check auth columns in professionals (Crucial for RBAC)
    // We try to select the 'email' column. If it doesn't exist, it throws error.
    const { error: pError } = await supabase.from('professionals').select('email').limit(1);
    if (pError) return false;

    return true;
  } catch (e) {
    return false;
  }
};