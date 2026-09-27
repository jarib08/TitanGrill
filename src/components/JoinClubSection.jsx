import React, { useState } from 'react';
import { Flame, UserPlus, CheckCircle2, Ticket } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from '../lib/supabaseClient';
import { setToStorage } from '../hooks/useLocalStorage';
import { STORAGE_KEYS } from '../constants';
import { LoyaltyCardWithShare } from './LoyaltyCard';

const JoinClubSection = () => {
    const [formData, setFormData] = useState({
        name: '',
        phone: '',
        email: ''
    });
    const [loading, setLoading] = useState(false);
    const [success, setSuccess] = useState(false);
    const [clientData, setClientData] = useState(null);
    const [error, setError] = useState('');

    const handlePhoneChange = (value) => {
        const cleaned = value.replace(/\D/g, '').slice(0, 10);
        setFormData(prev => ({ ...prev, phone: cleaned }));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (formData.phone.length !== 10) {
            setError('El celular debe tener 10 dígitos');
            return;
        }

        setLoading(true);
        setError('');

        try {
            // Una sola RPC atomica: si el celular ya tiene tarjeta la devuelve,
            // si no la crea. Reemplaza el consultar-e-insertar que podia
            // duplicar tarjetas, y ya no necesita SELECT publico sobre clientes.
            const { data, error: rpcError } = await supabase.rpc('fn_registrar_cliente_publico', {
                p_nombre: formData.name.trim(),
                p_celular: formData.phone,
                p_email: formData.email.trim() || null,
                p_referred_by: null
            });

            if (rpcError) throw rpcError;
            if (!data?.success) throw new Error(data?.message || 'No se pudo completar el registro.');

            setClientData(data.cliente);
            setToStorage(STORAGE_KEYS.CLIENT, data.cliente);
            setSuccess(true);
        } catch (err) {
            console.error("Error joining club:", err);
            setError('Hubo un error al registrarte. Inténtalo de nuevo.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <section id="join-club" className="py-24 bg-black relative overflow-hidden">
            {/* Background Effects */}
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full h-full bg-[radial-gradient(circle_at_center,rgba(255,69,0,0.05)_0%,transparent_70%)] pointer-events-none" />
            
            <div className="max-w-4xl mx-auto px-6 relative z-10">
                <AnimatePresence mode="wait">
                    {!success ? (
                        <motion.div
                            key="form"
                            initial={{ opacity: 0, y: 20 }}
                            whileInView={{ opacity: 1, y: 0 }}
                            viewport={{ once: true }}
                            className="text-center"
                        >
                            <div className="inline-flex items-center justify-center w-16 h-16 bg-fire/10 rounded-2xl mb-6 border border-fire/20">
                                <Flame className="text-fire fill-fire" size={32} />
                            </div>
                            
                            <h2 className="text-3xl md:text-5xl font-serif text-white mb-4 px-2">
                                Únete al Club <span className="text-fire">Titan Grill</span>
                            </h2>


                            <p className="text-zinc-400 max-w-xl mx-auto mb-10 text-base md:text-lg px-4">
                                Regístrate hoy y empieza a acumular sellos de fuego por cada visita. ¡Tu lealtad merece ser recompensada!
                            </p>


                            <div className="max-w-md mx-auto bg-zinc-900/50 backdrop-blur-md border border-white/5 p-6 md:p-8 rounded-3xl shadow-2xl">

                                <form onSubmit={handleSubmit} className="space-y-4">
                                    <div className="text-left">
                                        <label className="text-zinc-500 text-xs uppercase tracking-widest font-bold ml-1 mb-2 block">Nombre Completo</label>
                                        <input
                                            type="text"
                                            required
                                            placeholder="Ej. Juan Pérez"
                                            className="w-full bg-black/50 border border-zinc-800 rounded-xl px-4 py-3 text-white outline-none focus:border-fire transition-colors"
                                            value={formData.name}
                                            onChange={e => setFormData({...formData, name: e.target.value})}
                                        />
                                    </div>
                                    <div className="text-left">
                                        <label className="text-zinc-500 text-xs uppercase tracking-widest font-bold ml-1 mb-2 block">Número de Celular</label>
                                        <input
                                            type="tel"
                                            required
                                            placeholder="300 000 0000"
                                            className="w-full bg-black/50 border border-zinc-800 rounded-xl px-4 py-3 text-white outline-none focus:border-fire transition-colors"
                                            value={formData.phone}
                                            onChange={e => handlePhoneChange(e.target.value)}
                                        />
                                    </div>
                                    <div className="text-left">
                                        <label className="text-zinc-500 text-xs uppercase tracking-widest font-bold ml-1 mb-2 block">Email (Opcional)</label>
                                        <input
                                            type="email"
                                            placeholder="tu@email.com"
                                            className="w-full bg-black/50 border border-zinc-800 rounded-xl px-4 py-3 text-white outline-none focus:border-fire transition-colors"
                                            value={formData.email}
                                            onChange={e => setFormData({...formData, email: e.target.value})}
                                        />
                                    </div>

                                    {error && <p className="text-red-500 text-sm">{error}</p>}

                                    <button
                                        type="submit"
                                        disabled={loading}
                                        className="w-full bg-fire text-white font-bold py-4 rounded-xl uppercase tracking-[0.1em] md:tracking-[0.2em] text-xs md:text-sm hover:bg-orange-600 transition-all shadow-[0_10px_20px_rgba(255,69,0,0.2)] active:scale-[0.98] disabled:opacity-50"
                                    >

                                        {loading ? 'Procesando...' : 'Registrarme y Obtener Tarjeta'}
                                    </button>
                                </form>
                            </div>
                        </motion.div>
                    ) : (
                        <motion.div
                            key="success"
                            initial={{ opacity: 0, scale: 0.9 }}
                            animate={{ opacity: 1, scale: 1 }}
                            className="text-center"
                        >
                            <div className="inline-flex items-center justify-center w-20 h-20 bg-green-500/10 rounded-full mb-8 border border-green-500/20">
                                <CheckCircle2 className="text-green-500" size={40} />
                            </div>
                            <h2 className="text-3xl font-serif text-white mb-2">¡Bienvenido al Club!</h2>
                            <p className="text-zinc-400 mb-12">Aquí tienes tu tarjeta digital lista para usar.</p>
                            
                            <div className="max-w-sm mx-auto mb-10 transform rotate-1 hover:rotate-0 transition-transform duration-500">
                                <LoyaltyCardWithShare client={clientData} />
                            </div>

                            <div className="bg-zinc-900/50 border border-white/5 p-6 rounded-2xl inline-block">
                                <p className="text-zinc-400 text-sm flex items-center gap-2">
                                    <Ticket size={16} className="text-fire" />
                                    Muestra tu código QR en caja para sumar puntos
                                </p>
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>
        </section>
    );
};

export default JoinClubSection;
