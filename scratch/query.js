import { createClient } from '@supabase/supabase-js';

const supabase = createClient('https://[PROJECT_REF].supabase.co', '[ANON_KEY_REDACTADA]');

async function run() {
    const { data, error } = await supabase
        .from('movimientos_caja')
        .select('*')
        .order('fecha', { ascending: false })
        .limit(20);

    if (error) {
        console.error('Error:', error);
    } else {
        console.log(JSON.stringify(data, null, 2));
    }
}

run();
