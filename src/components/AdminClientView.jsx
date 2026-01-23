import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient';
import LoyaltyCard from './LoyaltyCard';
import { ArrowLeft, RefreshCw } from 'lucide-react';

const AdminClientView = () => {
    const { clientId } = useParams();
    const navigate = useNavigate();
    const [client, setClient] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchClient = async () => {
            if (!clientId) return;
            try {
                const { data, error } = await supabase
                    .from('clientes')
                    .select('*')
                    .eq('id', clientId)
                    .single();

                if (error) throw error;
                setClient(data);
            } catch (err) {
                console.error("Error fetching client:", err);
                alert("Error al cargar cliente");
            } finally {
                setLoading(false);
            }
        };

        fetchClient();
    }, [clientId]);

    if (loading) return <div className="min-h-screen bg-black text-white flex items-center justify-center">Cargando...</div>;
    if (!client) return <div className="min-h-screen bg-black text-white flex items-center justify-center">Cliente no encontrado</div>;

    return (
        <div className="min-h-screen bg-black p-6 flex flex-col items-center">
            <div className="w-full max-w-md">
                <button
                    onClick={() => navigate('/admin')}
                    className="flex items-center text-zinc-400 hover:text-white mb-6 transition-colors"
                >
                    <ArrowLeft size={20} className="mr-2" />
                    Volver al Dashboard
                </button>

                <h1 className="text-2xl font-serif text-fire mb-8 text-center">Verificación de Sello</h1>

                <LoyaltyCard client={client} />

                <div className="mt-8 text-center">
                    <h2 className="text-xl text-white font-serif mb-2">{client.nombre}</h2>
                    <p className="text-zinc-500 mb-2">Sellos actuales: <span className="text-white font-bold">{client.stamps_count}</span></p>
                </div>
            </div>
        </div>
    );
};

export default AdminClientView;
