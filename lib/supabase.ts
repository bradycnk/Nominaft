
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL ?? 'https://cfncthqiqabezmemosrz.supabase.co';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY ?? 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNmbmN0aHFpcWFiZXptZW1vc3J6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzAxNjYzMjQsImV4cCI6MjA4NTc0MjMyNH0.UPXp8srAXTmttIxVLJgp4RNcJEa257xmyycIuEz1yw8';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
