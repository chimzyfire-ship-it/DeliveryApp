import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';
import 'react-native-url-polyfill/auto';

// 1. Your Project URL
const supabaseUrl = 'https://qnbjgffsyzfrcxyqnnix.supabase.co';

// 2. Your ANON API Key (I transcribed the start from your screenshot)
// Make sure you copy the FULL key from your dashboard if this is cut off.
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFuYmpnZmZzeXpmcmN4eXFubml4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjU0NTk3NTMsImV4cCI6MjA4MTAzNTc1M30._vsvPLsLNLGwelNwALMd3m7To1IyoapJchrktBeScuc'; 
// (NOTE: Go to your Dashboard > Settings > API and copy the full 'anon public' key to be 100% sure, then paste it inside the quotes above)

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});