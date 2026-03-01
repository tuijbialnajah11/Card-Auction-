import { createClient } from '@supabase/supabase-js';

// Using credentials provided by the user
const supabaseUrl = 'https://fnzmxwmorlhxolvrjulg.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZuem14d21vcmxoeG9sdnJqdWxnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzIyOTI2MzUsImV4cCI6MjA4Nzg2ODYzNX0.PQt09Fmp14gafaLZM-osZ1G9gxnHi6wDGr1PhmI-dXI';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
