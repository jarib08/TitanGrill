import { createClient } from '@supabase/supabase-js';
import { ERROR_MESSAGES } from '../constants';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://mbyjehhplruoqlgphfvw.supabase.co';
const envAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
const LEGACY_JWT_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1ieWplaGhwbHJ1b3FsZ3BoZnZ3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjgyNTc0MjgsImV4cCI6MjA4MzgzMzQyOH0.XZBO_hn7kRsrNw5Pg9uC4C9eUq5VoSKuh6Txw4qwhyw';

const supabaseAnonKey = (envAnonKey && envAnonKey.startsWith('eyJ')) ? envAnonKey : LEGACY_JWT_ANON_KEY;

// Validate required environment variables
if (!supabaseUrl || !supabaseAnonKey) {
    const errorMessage = ERROR_MESSAGES.SUPABASE_MISSING;
    console.error(errorMessage);
    if (import.meta.env.PROD) {
        throw new Error(errorMessage);
    }
}

// Create Supabase client with options
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: true
    }
});

// Helper function to handle Supabase errors consistently
export const handleSupabaseError = (error, context = '') => {
    if (!error) return null;

    const message = error.message || 'Unknown error';
    const code = error.code || 'UNKNOWN';

    console.error(`Supabase Error${context ? ` (${context})` : ''}: [${code}] ${message}`);

    return {
        message,
        code,
        isAuthError: code.startsWith('auth/') || message.includes('auth'),
        isNetworkError: message.includes('fetch') || message.includes('network'),
        isUniqueViolation: code === '23505'
    };
};

export default supabase;
