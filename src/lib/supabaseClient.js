import { createClient } from '@supabase/supabase-js';
import { ERROR_MESSAGES } from '../constants';

// B5: antes habia una URL y una anon key hardcodeadas como fallback, asi que la
// validacion de abajo NUNCA podia fallar: un despliegue mal configurado se
// conectaba a produccion en silencio. Ahora la configuracion es obligatoria y
// el fallo es ruidoso.
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
    const errorMessage =
        `${ERROR_MESSAGES.SUPABASE_MISSING}. ` +
        `Faltan: ${[!supabaseUrl && 'VITE_SUPABASE_URL', !supabaseAnonKey && 'VITE_SUPABASE_ANON_KEY'].filter(Boolean).join(', ')}. ` +
        `Defina estas variables en .env antes de compilar.`;
    console.error(errorMessage);
    throw new Error(errorMessage);
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
