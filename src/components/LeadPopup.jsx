import React, { useState, useEffect } from 'react';
import { X, Flame, Ticket, UserPlus } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from '../lib/supabaseClient';
import { LoyaltyCardWithShare } from './LoyaltyCard';
import { extractReferralCodeFromURL } from '../lib/referralUtils';

const LeadPopup = () => {
    const [isOpen, setIsOpen] = useState(false);
    const [showCard, setShowCard] = useState(false);
    const [clientData, setClientData] = useState(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    // State to track if user is already registered (persisted)
    const [isRegistered, setIsRegistered] = useState(false);

    const [phoneError, setPhoneError] = useState('');

    // Referral system states
    const [referralCode, setReferralCode] = useState(null);
    const [referrerId, setReferrerId] = useState(null);
    const [referrerName, setReferrerName] = useState(null);
    const [referralValidating, setReferralValidating] = useState(false);

    const [formData, setFormData] = useState({
        name: '',
        phone: '',
        email: ''
    });

    useEffect(() => {
        // Check persistence - If registered, show button, don't show popup.
        const savedClient = localStorage.getItem('titan_client');
        if (savedClient) {
            setClientData(JSON.parse(savedClient));
            setIsRegistered(true);
        } else {
            // User NOT registered, trigger popup timer unless closed in this session
            const timer = setTimeout(() => {
                const isClosed = sessionStorage.getItem('popup_closed');
                if (!isClosed) {
                    setIsOpen(true);
                }
            }, 5000);
            return () => clearTimeout(timer);
        }
    }, []);

    // Detect and validate referral code from URL
    useEffect(() => {
        const validateReferralCode = async () => {
            const code = extractReferralCodeFromURL();

            if (!code) return;

            setReferralCode(code);
            setReferralValidating(true);

            try {
                // Call Supabase RPC to get referrer info
                const { data, error } = await supabase
                    .rpc('get_client_by_referral_code', { ref_code: code });

                if (error) throw error;

                if (data && data.length > 0) {
                    const referrer = data[0];
                    setReferrerId(referrer.client_id);
                    setReferrerName(referrer.client_name);
                    console.log('✅ Código de referido válido:', referrer.client_name);
                } else {
                    console.warn('⚠️ Código de referido no encontrado');
                    setReferralCode(null);
                }
            } catch (err) {
                console.error('Error al validar código de referido:', err);
                setReferralCode(null);
            } finally {
                setReferralValidating(false);
            }
        };

        validateReferralCode();
    }, []);

    const handleClose = () => {
        setIsOpen(false);
        sessionStorage.setItem('popup_closed', 'true');
    };

    const handleCardClose = () => {
        setShowCard(false);
    };

    const handleShowMyCard = () => {
        setShowCard(true);
    };

    const handlePhoneChange = (value) => {
        // Solo permitir números
        const cleaned = value.replace(/\D/g, '');
        setFormData({ ...formData, phone: cleaned });

        // Validar longitud
        if (cleaned.length === 0) {
            setPhoneError('');
        } else if (cleaned.length !== 10) {
            setPhoneError('El número debe tener exactamente 10 dígitos');
        } else {
            setPhoneError('');
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        setError('');

        // Validación final de teléfono
        if (formData.phone.length !== 10) {
            setError('El número de celular debe tener exactamente 10 dígitos');
            setLoading(false);
            return;
        }

        // Construct payload with referral info
        const payload = {
            nombre: formData.name,
            celular: formData.phone,
            email: formData.email,
            stamps_count: 0,
            // Add referrer if valid code was detected
            ...(referrerId && { referred_by: referrerId })
        };

        try {
            // 1. Check existence
            let { data: existingUser } = await supabase
                .from('clientes')
                .select('*')
                .eq('celular', formData.phone)
                .single();

            let client;

            if (existingUser) {
                client = existingUser;
            } else {
                // 2. Insert new
                const { data: newUser, error: insertError } = await supabase
                    .from('clientes')
                    .insert([payload])
                    .select()
                    .single();

                if (insertError) throw insertError;
                client = newUser;
            }

            setClientData(client);
            localStorage.setItem('titan_client', JSON.stringify(client));
            setIsRegistered(true);

            // Workflow: Close Form -> Open Card
            setIsOpen(false);
            setTimeout(() => setShowCard(true), 300);

        } catch (err) {
            console.error("Supabase Error:", err);
            setError('Error al registrar. Verifica tu conexión.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <>
            {/* 0. "My Card" Floating Button (Only for Registered Users) */}
            <AnimatePresence>
                {isRegistered && !showCard && (
                    <motion.button
                        initial={{ scale: 0, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        exit={{ scale: 0, opacity: 0 }}
                        className="fixed bottom-6 left-6 z-99 bg-zinc-900 border border-gold/50 text-gold p-3 rounded-full shadow-xl shadow-black/50 flex items-center gap-2 pr-5 hover:bg-zinc-800 transition-colors"
                        onClick={handleShowMyCard}
                    >
                        <div className="bg-gold/20 p-2 rounded-full">
                            <Ticket size={20} />
                        </div>
                        <span className="text-xs font-bold uppercase tracking-wider">Mi Tarjeta</span>
                    </motion.button>
                )}
            </AnimatePresence>

            {/* 1. Registration Form Modal */}
            <AnimatePresence>
                {isOpen && !isRegistered && (
                    <div className="fixed inset-0 z-100 flex items-center justify-center bg-black/80 backdrop-blur-sm">
                        <motion.div
                            initial={{ scale: 0.9, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            exit={{ scale: 0.9, opacity: 0 }}
                            className="relative w-[90%] max-w-sm bg-zinc-900 border border-white/10 rounded-2xl shadow-2xl overflow-hidden"
                        >
                            <button
                                onClick={handleClose}
                                className="absolute top-4 right-4 text-zinc-500 hover:text-white"
                            >
                                <X size={20} />
                            </button>

                            <div className="p-6 pt-10">
                                <div className="text-center mb-6">
                                    <div className="w-12 h-12 bg-fire rounded-full flex items-center justify-center mx-auto mb-3 shadow-[0_0_15px_rgba(255,69,0,0.5)]">
                                        <Flame className="text-white fill-white" size={24} />
                                    </div>
                                    <h2 className="text-xl font-serif text-white mb-1">Únete al Club Titan</h2>
                                    <p className="text-zinc-400 text-xs">Regístrate para acumular puntos.</p>

                                    {/* Referral Badge */}
                                    {referrerName && (
                                        <motion.div
                                            initial={{ opacity: 0, y: -10 }}
                                            animate={{ opacity: 1, y: 0 }}
                                            className="mt-3 bg-gold/10 border border-gold/30 rounded-lg p-2 flex items-center gap-2 justify-center"
                                        >
                                            <UserPlus size={14} className="text-gold" />
                                            <p className="text-gold text-xs font-medium">
                                                Invitado por <span className="font-bold">{referrerName}</span>
                                            </p>
                                        </motion.div>
                                    )}
                                </div>

                                <form onSubmit={handleSubmit} className="space-y-3">
                                    <input
                                        type="text"
                                        placeholder="Nombre"
                                        required
                                        className="w-full bg-black/30 border border-zinc-700 rounded-lg px-4 py-3 text-white text-sm focus:border-fire outline-none"
                                        value={formData.name}
                                        onChange={e => setFormData({ ...formData, name: e.target.value })}
                                    />
                                    <div>
                                        <input
                                            type="tel"
                                            placeholder="Celular (10 dígitos)"
                                            required
                                            maxLength="10"
                                            className={`w-full bg-black/30 border rounded-lg px-4 py-3 text-white text-sm focus:border-fire outline-none ${phoneError ? 'border-red-500' : 'border-zinc-700'
                                                }`}
                                            value={formData.phone}
                                            onChange={e => handlePhoneChange(e.target.value)}
                                        />
                                        {phoneError && (
                                            <p className="text-red-400 text-xs mt-1 ml-1">{phoneError}</p>
                                        )}
                                    </div>
                                    <input
                                        type="email"
                                        placeholder="Email (Opcional)"
                                        className="w-full bg-black/30 border border-zinc-700 rounded-lg px-4 py-3 text-white text-sm focus:border-fire outline-none"
                                        value={formData.email}
                                        onChange={e => setFormData({ ...formData, email: e.target.value })}
                                    />

                                    {error && <p className="text-red-500 text-xs text-center">{error}</p>}

                                    <button
                                        type="submit"
                                        disabled={loading || phoneError}
                                        className="w-full bg-fire text-white font-bold py-3 rounded-lg text-sm uppercase tracking-widest hover:bg-orange-600 transition-colors mt-2 disabled:opacity-50 disabled:cursor-not-allowed"
                                    >
                                        {loading ? '...' : 'Registrarme y Obtener Tarjeta'}
                                    </button>
                                </form>
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>

            {/* 2. Success/Card Modal */}
            <AnimatePresence>
                {showCard && (
                    <div className="fixed inset-0 z-110 flex items-center justify-center bg-black/95 backdrop-blur-xl p-4">
                        <motion.div
                            initial={{ opacity: 0, y: 50 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: 50 }}
                            className="w-full max-w-sm flex flex-col items-center"
                        >
                            {/* Card */}
                            <div className="w-full mb-8 transform hover:scale-105 transition-transform duration-300">
                                <LoyaltyCardWithShare client={clientData} />
                            </div>

                            {/* Instructions */}
                            <div className="text-center px-6">
                                <h3 className="text-gold font-serif text-2xl mb-2">¡Membresía Activada!</h3>
                                <p className="text-zinc-400 text-sm mb-4 leading-relaxed">
                                    Presenta este código QR a nuestro staff cada vez que nos visites para sumar sellos de fuego.
                                </p>



                                <button
                                    onClick={handleCardClose}
                                    className="px-8 py-3 rounded-full border border-zinc-700 text-white text-xs uppercase tracking-widest hover:bg-white/10 transition-colors"
                                >
                                    Cerrar Tarjeta
                                </button>
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>
        </>
    );
};

export default LeadPopup;
