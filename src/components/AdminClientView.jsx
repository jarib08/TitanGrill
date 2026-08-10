import React, { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient';
import LoyaltyCard from './LoyaltyCard';
import { ArrowLeft, Flame, Award, RefreshCw, Phone, Mail, Calendar, Share2, Minus, Plus } from 'lucide-react';

const AdminClientView = () => {
    const { clientId } = useParams();
    const navigate = useNavigate();
    const [client, setClient] = useState(null);
    const [loading, setLoading] = useState(true);
    const [actionLoading, setActionLoading] = useState(false);
    const [feedbackMessage, setFeedbackMessage] = useState({ type: '', text: '' });
    const [history, setHistory] = useState([]);

    // Fetch client details + recent stamp logs
    const fetchClientData = useCallback(async () => {
        if (!clientId) return;
        try {
            setLoading(true);
            const { data: clientRes, error: clientErr } = await supabase
                .from('clientes')
                .select('*')
                .eq('id', clientId)
                .single();

            if (clientErr) throw clientErr;
            setClient(clientRes);

            // Fetch stamp logs history
            const { data: logsData } = await supabase
                .from('stamp_logs')
                .select('*')
                .eq('cliente_id', clientId)
                .order('created_at', { ascending: false })
                .limit(10);

            // Fetch redemptions history
            const { data: redemptionsData } = await supabase
                .from('redemptions')
                .select('*')
                .eq('cliente_id', clientId)
                .order('redeemed_at', { ascending: false })
                .limit(10);

            // Combine history events
            const combinedHistory = [
                ...(logsData || []).map(l => ({ type: 'STAMP', date: l.created_at, details: '+1 Fuego Asignado' })),
                ...(redemptionsData || []).map(r => ({ type: 'REDEMPTION', date: r.redeemed_at, details: '🎁 Premio Hamburguesa Canjeado (-10 Fuegos)' }))
            ].sort((a, b) => new Date(b.date) - new Date(a.date));

            setHistory(combinedHistory);

        } catch (err) {
            console.error("Error fetching client details:", err);
            setFeedbackMessage({ type: 'error', text: 'Error al cargar los datos del cliente.' });
        } finally {
            setLoading(false);
        }
    }, [clientId]);

    useEffect(() => {
        fetchClientData();
    }, [fetchClientData]);

    // Handle Manual Add 1 Stamp
    const handleAddStamp = async () => {
        if (!client) return;
        setActionLoading(true);
        setFeedbackMessage({ type: '', text: '' });
        try {
            const newStamps = (client.stamps_count || 0) + 1;
            const { data, error } = await supabase
                .from('clientes')
                .update({ stamps_count: newStamps })
                .eq('id', client.id)
                .select()
                .single();

            if (error) throw error;

            // Log stamp in stamp_logs
            await supabase.from('stamp_logs').insert([{ cliente_id: client.id }]);

            setClient(data);
            setFeedbackMessage({ type: 'success', text: '🔥 ¡Sello de Fuego agregado con éxito!' });
            fetchClientData();
        } catch (err) {
            console.error("Error adding stamp:", err);
            setFeedbackMessage({ type: 'error', text: 'No se pudo agregar el sello.' });
        } finally {
            setActionLoading(false);
        }
    };

    // Handle Manual Remove 1 Stamp
    const handleRemoveStamp = async () => {
        if (!client || (client.stamps_count || 0) <= 0) return;
        setActionLoading(true);
        setFeedbackMessage({ type: '', text: '' });
        try {
            const newStamps = Math.max(0, (client.stamps_count || 0) - 1);
            const { data, error } = await supabase
                .from('clientes')
                .update({ stamps_count: newStamps })
                .eq('id', client.id)
                .select()
                .single();

            if (error) throw error;

            setClient(data);
            setFeedbackMessage({ type: 'success', text: 'Sello descontado correctamente.' });
            fetchClientData();
        } catch (err) {
            console.error("Error removing stamp:", err);
            setFeedbackMessage({ type: 'error', text: 'No se pudo descontar el sello.' });
        } finally {
            setActionLoading(false);
        }
    };

    // Handle Redeem Prize (10 stamps)
    const handleRedeemPrize = async () => {
        if (!client || (client.stamps_count || 0) < 10) return;
        setActionLoading(true);
        setFeedbackMessage({ type: '', text: '' });
        try {
            const newStamps = Math.max(0, (client.stamps_count || 0) - 10);
            const { data, error } = await supabase
                .from('clientes')
                .update({ stamps_count: newStamps })
                .eq('id', client.id)
                .select()
                .single();

            if (error) throw error;

            // Log redemption in redemptions table
            await supabase.from('redemptions').insert([{ cliente_id: client.id }]);

            setClient(data);
            setFeedbackMessage({ type: 'success', text: '🎉 ¡Premio canjeado con éxito! Se descontaron 10 Fuegos.' });
            fetchClientData();
        } catch (err) {
            console.error("Error redeeming prize:", err);
            setFeedbackMessage({ type: 'error', text: 'Error al procesar el canje.' });
        } finally {
            setActionLoading(false);
        }
    };

    if (loading) {
        return (
            <div className="min-h-screen bg-zinc-950 flex items-center justify-center text-fire animate-pulse font-serif text-xl">
                Cargando datos del cliente...
            </div>
        );
    }

    if (!client) {
        return (
            <div className="min-h-screen bg-zinc-950 text-white flex flex-col items-center justify-center p-6 text-center space-y-4 font-sans">
                <p className="text-zinc-400 text-lg">Cliente no encontrado en la base de datos.</p>
                <button
                    onClick={() => navigate('/admin')}
                    className="bg-fire hover:bg-orange-700 text-white px-6 py-2.5 rounded-xl font-bold text-xs uppercase tracking-wider transition-all"
                >
                    Volver al Dashboard
                </button>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-zinc-950 text-white p-4 md:p-8 flex flex-col items-center font-sans">
            <div className="w-full max-w-2xl space-y-6">
                {/* Header Navigation */}
                <div className="flex justify-between items-center border-b border-zinc-850 pb-4">
                    <button
                        onClick={() => navigate('/admin')}
                        className="flex items-center text-zinc-400 hover:text-white transition-colors text-xs font-bold uppercase tracking-wider"
                    >
                        <ArrowLeft size={16} className="mr-2 text-fire" />
                        Volver al Dashboard
                    </button>
                    <button
                        onClick={fetchClientData}
                        className="flex items-center gap-1.5 text-xs font-bold text-zinc-400 hover:text-white bg-zinc-900 border border-zinc-800 px-3 py-1.5 rounded-lg transition-all"
                    >
                        <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
                        Actualizar
                    </button>
                </div>

                {/* Feedback Notification Alert */}
                {feedbackMessage.text && (
                    <div className={`p-4 rounded-xl text-xs font-bold flex items-center justify-between shadow-lg ${
                        feedbackMessage.type === 'success' ? 'bg-emerald-950/80 border border-emerald-500/40 text-emerald-300' : 'bg-red-950/80 border border-red-500/40 text-red-300'
                    }`}>
                        <span>{feedbackMessage.text}</span>
                        <button onClick={() => setFeedbackMessage({ type: '', text: '' })} className="text-zinc-400 hover:text-white ml-2">✕</button>
                    </div>
                )}

                {/* Interactive Loyalty Digital Card */}
                <div className="flex justify-center my-4">
                    <LoyaltyCard client={client} />
                </div>

                {/* Quick Action Control Bar */}
                <div className="bg-zinc-900 border border-zinc-800/80 rounded-2xl p-5 space-y-4 shadow-xl">
                    <div className="flex justify-between items-center border-b border-zinc-850 pb-3">
                        <div>
                            <h2 className="text-lg font-serif font-bold text-white">{client.nombre}</h2>
                            <p className="text-xs text-zinc-400">Estado actual: <span className="text-fire font-bold font-mono">{client.stamps_count} Fuegos acumulados</span></p>
                        </div>
                        {client.stamps_count >= 10 && (
                            <span className="bg-gold/20 text-gold border border-gold/40 text-[10px] font-black uppercase px-3 py-1 rounded-full animate-bounce">
                                🎁 ¡Premio 10/10 Listo!
                            </span>
                        )}
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                        <button
                            onClick={handleAddStamp}
                            disabled={actionLoading}
                            className="bg-gradient-to-r from-orange-600 to-fire hover:from-orange-500 hover:to-fire text-white py-3 px-4 rounded-xl text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-2 shadow-lg shadow-fire/20 transition-all active:scale-95 disabled:opacity-50"
                        >
                            <Plus size={16} />
                            Otorgar +1 Fuego
                        </button>

                        <button
                            onClick={handleRemoveStamp}
                            disabled={actionLoading || (client.stamps_count || 0) <= 0}
                            className="bg-zinc-800 hover:bg-zinc-700 text-zinc-300 py-3 px-4 rounded-xl text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-2 border border-zinc-700 transition-all active:scale-95 disabled:opacity-50"
                        >
                            <Minus size={16} />
                            Descontar -1
                        </button>

                        <button
                            onClick={handleRedeemPrize}
                            disabled={actionLoading || (client.stamps_count || 0) < 10}
                            className={`py-3 px-4 rounded-xl text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-2 transition-all active:scale-95 shadow-lg ${
                                client.stamps_count >= 10
                                    ? 'bg-amber-500 hover:bg-amber-400 text-zinc-950 font-black shadow-amber-500/20'
                                    : 'bg-zinc-950 text-zinc-600 border border-zinc-850 cursor-not-allowed'
                            }`}
                        >
                            <Award size={16} />
                            Canjear Premio
                        </button>
                    </div>
                </div>

                {/* Client Profile Details Card */}
                <div className="bg-zinc-900 border border-zinc-800/60 rounded-2xl p-5 space-y-4">
                    <h3 className="text-sm font-bold uppercase tracking-wider text-zinc-400 border-b border-zinc-850 pb-2">Información del Cliente</h3>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                        <div className="flex items-center gap-3 bg-zinc-950 p-3 rounded-xl border border-zinc-850">
                            <Phone size={16} className="text-fire shrink-0" />
                            <div>
                                <p className="text-[10px] text-zinc-500 uppercase font-bold">Teléfono Celular</p>
                                <a 
                                    href={`https://wa.me/57${client.celular}`} 
                                    target="_blank" 
                                    rel="noopener noreferrer"
                                    className="text-zinc-200 font-mono hover:text-green-400 underline font-bold"
                                >
                                    {client.celular || 'No registrado'}
                                </a>
                            </div>
                        </div>

                        <div className="flex items-center gap-3 bg-zinc-950 p-3 rounded-xl border border-zinc-850">
                            <Mail size={16} className="text-blue-400 shrink-0" />
                            <div>
                                <p className="text-[10px] text-zinc-500 uppercase font-bold">Correo Electrónico</p>
                                <p className="text-zinc-200 truncate font-mono">{client.email || 'Sin email registrado'}</p>
                            </div>
                        </div>

                        <div className="flex items-center gap-3 bg-zinc-950 p-3 rounded-xl border border-zinc-850">
                            <Share2 size={16} className="text-gold shrink-0" />
                            <div>
                                <p className="text-[10px] text-zinc-500 uppercase font-bold">Código de Referidos</p>
                                <p className="text-gold font-mono font-bold">{client.referral_code || 'N/A'}</p>
                            </div>
                        </div>

                        <div className="flex items-center gap-3 bg-zinc-950 p-3 rounded-xl border border-zinc-850">
                            <Calendar size={16} className="text-purple-400 shrink-0" />
                            <div>
                                <p className="text-[10px] text-zinc-500 uppercase font-bold">Fecha de Registro</p>
                                <p className="text-zinc-300 font-mono">
                                    {client.created_at ? new Date(client.created_at).toLocaleDateString('es-ES') : 'Desconocida'}
                                </p>
                            </div>
                        </div>
                    </div>
                </div>

                {/* History Log Section */}
                <div className="bg-zinc-900 border border-zinc-800/60 rounded-2xl overflow-hidden shadow-lg space-y-3 p-5">
                    <h3 className="text-sm font-bold uppercase tracking-wider text-zinc-400 flex items-center gap-2">
                        <Flame size={16} className="text-fire" />
                        Historial Reciente de Fuegos y Canjes
                    </h3>
                    <div className="divide-y divide-zinc-850 bg-zinc-950 rounded-xl border border-zinc-850 overflow-hidden">
                        {history.length === 0 ? (
                            <div className="p-6 text-center text-zinc-500 text-xs">No hay actividad registrada para este cliente</div>
                        ) : (
                            history.map((event, idx) => (
                                <div key={idx} className="p-3.5 flex items-center justify-between text-xs hover:bg-zinc-900/50 transition-colors">
                                    <div className="flex items-center gap-3">
                                        <div className={`p-2 rounded-lg ${event.type === 'REDEMPTION' ? 'bg-gold/20 text-gold' : 'bg-fire/20 text-fire'}`}>
                                            {event.type === 'REDEMPTION' ? <Award size={14} /> : <Flame size={14} />}
                                        </div>
                                        <div>
                                            <p className="font-bold text-zinc-200">{event.details}</p>
                                            <p className="text-[10px] text-zinc-500 font-mono">
                                                {new Date(event.date).toLocaleString('es-ES')}
                                            </p>
                                        </div>
                                    </div>
                                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${
                                        event.type === 'REDEMPTION' ? 'bg-gold/10 text-gold border border-gold/30' : 'bg-fire/10 text-fire border border-fire/30'
                                    }`}>
                                        {event.type === 'REDEMPTION' ? 'CANJE' : 'SELLO'}
                                    </span>
                                </div>
                            ))
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default AdminClientView;
