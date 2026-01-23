import { createClient } from '@supabase/supabase-js';
import { ERROR_MESSAGES } from '../constants';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

// Validate required environment variables
if (!supabaseUrl || !supabaseAnonKey) {
    const errorMessage = ERROR_MESSAGES.SUPABASE_MISSING;
    console.error(errorMessage);
    // In production, we throw to prevent the app from running with invalid config
    if (import.meta.env.PROD) {
        throw new Error(errorMessage);
    }
}

// Create Supabase client with options
export const supabase = createClient(supabaseUrl || '', supabaseAnonKey || '', {
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
