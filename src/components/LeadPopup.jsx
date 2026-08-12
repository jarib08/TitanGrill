import React, { useState, useEffect, useCallback } from 'react';
import { X, Flame, Ticket, UserPlus } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase, handleSupabaseError } from '../lib/supabaseClient';
import { LoyaltyCardWithShare } from './LoyaltyCard';
import { extractReferralCodeFromURL } from '../lib/referralUtils';
import { getFromStorage, setToStorage } from '../hooks/useLocalStorage';
import { STORAGE_KEYS, TIMING, ERROR_MESSAGES, PATTERNS, Z_INDEX } from '../constants';

const LeadPopup = () => {
    const [isOpen, setIsOpen] = useState(false);
    const [showCard, setShowCard] = useState(false);
    const [clientData, setClientData] = useState(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [isRegistered, setIsRegistered] = useState(false);
    const [phoneError, setPhoneError] = useState('');
    const [emailError, setEmailError] = useState('');

    // Referral system states
    const [, setReferralCode] = useState(null);
    const [referrerId, setReferrerId] = useState(null);
    const [referrerName, setReferrerName] = useState(null);
    const [, setReferralValidating] = useState(false);

    const [formData, setFormData] = useState({
        name: '',
        phone: '',
        email: ''
    });

    // Check persistence on mount
    useEffect(() => {
        const savedClient = getFromStorage(STORAGE_KEYS.CLIENT);
        if (savedClient) {
            setClientData(savedClient);
            setIsRegistered(true);
        } else {
            const timer = setTimeout(() => {
                const isClosed = sessionStorage.getItem(STORAGE_KEYS.POPUP_CLOSED);
                if (!isClosed) {
                    setIsOpen(true);
                }
            }, TIMING.POPUP_DELAY_MS);
            return () => clearTimeout(timer);
        }
    }, []);

    // Handle ESC key to close modal
    useEffect(() => {
        const handleEsc = (e) => {
            if (e.key === 'Escape') {
                if (showCard) {
                    setShowCard(false);
                } else if (isOpen) {
                    handleClose();
                }
            }
        };
        window.addEventListener('keydown', handleEsc);
        return () => window.removeEventListener('keydown', handleEsc);
    }, [isOpen, showCard, handleClose]);

    // Detect and validate referral code from URL
    useEffect(() => {
        const validateReferralCode = async () => {
            const code = extractReferralCodeFromURL();
            if (!code) return;

            setReferralCode(code);
            setReferralValidating(true);

            try {
                const { data, error } = await supabase
                    .rpc('get_client_by_referral_code', { ref_code: code });

                if (error) {
                    handleSupabaseError(error, 'validateReferralCode');
                    setReferralCode(null);
                    return;
                }

                if (data && data.length > 0) {
                    const referrer = data[0];
                    setReferrerId(referrer.client_id);
                    setReferrerName(referrer.client_name);
                } else {
                    setReferralCode(null);
                }
            } catch (err) {
                console.error('Error validating referral code:', err);
                setReferralCode(null);
            } finally {
                setReferralValidating(false);
            }
        };

        validateReferralCode();
    }, []);

    const handleClose = useCallback(() => {
        setIsOpen(false);
        sessionStorage.setItem(STORAGE_KEYS.POPUP_CLOSED, 'true');
    }, []);

    const handleCardClose = useCallback(() => {
        setShowCard(false);
    }, []);

    const handleShowMyCard = useCallback(() => {
        setShowCard(true);
    }, []);

    const handlePhoneChange = useCallback((value) => {
        const cleaned = value.replace(/\D/g, '');
        setFormData(prev => ({ ...prev, phone: cleaned }));

        if (cleaned.length === 0) {
            setPhoneError('');
        } else if (cleaned.length !== 10) {
            setPhoneError(ERROR_MESSAGES.PHONE_LENGTH);
        } else {
            setPhoneError('');
        }
    }, []);

    const handleEmailChange = useCallback((value) => {
        setFormData(prev => ({ ...prev, email: value }));

        if (value && !PATTERNS.EMAIL.test(value)) {
            setEmailError(ERROR_MESSAGES.EMAIL_INVALID);
        } else {
            setEmailError('');
        }
    }, []);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        setError('');

        // Final validation
        if (formData.phone.length !== 10) {
            setError(ERROR_MESSAGES.PHONE_REQUIRED);
            setLoading(false);
            return;
        }

        if (formData.email && !PATTERNS.EMAIL.test(formData.email)) {
            setError(ERROR_MESSAGES.EMAIL_INVALID);
            setLoading(false);
            return;
        }

        const payload = {
            nombre: formData.name.trim(),
            celular: formData.phone,
            email: formData.email.trim() || null,
            stamps_count: 0,
            ...(referrerId && { referred_by: referrerId })
        };

        try {
            // Use maybeSingle() to avoid error when no results
            const { data: existingUser, error: selectError } = await supabase
                .from('clientes')
                .select('*')
                .eq('celular', formData.phone)
                .maybeSingle();

            if (selectError) {
                handleSupabaseError(selectError, 'checkExistingUser');
                throw selectError;
            }

            let client = existingUser;

            if (!existingUser) {
                const { data: newUser, error: insertError } = await supabase
                    .from('clientes')
                    .insert([payload])
                    .select()
                    .single();

                if (insertError) {
                    const errorInfo = handleSupabaseError(insertError, 'insertUser');
                    // Handle race condition: if unique violation, try to fetch the user
                    if (errorInfo?.isUniqueViolation) {
                        const { data: retryUser } = await supabase
                            .from('clientes')
                            .select('*')
                            .eq('celular', formData.phone)
                            .maybeSingle();
                        if (retryUser) {
                            client = retryUser;
                        } else {
                            throw insertError;
                        }
                    } else {
                        throw insertError;
                    }
                } else {
                    client = newUser;
                }
            }

            setClientData(client);
            setToStorage(STORAGE_KEYS.CLIENT, client);
            setIsRegistered(true);
            setIsOpen(false);
            setTimeout(() => setShowCard(true), 300);

        } catch (err) {
            console.error("Registration Error:", err);
            setError(ERROR_MESSAGES.REGISTER_ERROR);
        } finally {
            setLoading(false);
        }
    };

    return (
        <>
            {/* Floating "My Card" Button */}
            <AnimatePresence>
                {isRegistered && !showCard && (
                    <motion.button
                        initial={{ scale: 0, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        exit={{ scale: 0, opacity: 0 }}
                        className="fixed bottom-6 left-6 bg-zinc-900 border border-gold/50 text-gold p-3 rounded-full shadow-xl shadow-black/50 flex items-center gap-2 pr-5 hover:bg-zinc-800 transition-colors focus:outline-none focus:ring-2 focus:ring-gold"
                        style={{ zIndex: Z_INDEX.floatingButton }}
                        onClick={handleShowMyCard}
                        aria-label="Ver mi tarjeta de fidelidad"
                    >
                        <div className="bg-gold/20 p-2 rounded-full">
                            <Ticket size={20} aria-hidden="true" />
                        </div>
                        <span className="text-xs font-bold uppercase tracking-wider">Mi Tarjeta</span>
                    </motion.button>
                )}
            </AnimatePresence>

            {/* Registration Form Modal */}
            <AnimatePresence>
                {isOpen && !isRegistered && (
                    <div
                        className="fixed inset-0 flex items-center justify-center bg-black/80 backdrop-blur-sm"
                        style={{ zIndex: Z_INDEX.overlay }}
                        role="dialog"
                        aria-modal="true"
                        aria-labelledby="registration-title"
                    >
                        <motion.div
                            initial={{ scale: 0.9, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            exit={{ scale: 0.9, opacity: 0 }}
                            className="relative w-[90%] max-w-sm bg-zinc-900 border border-white/10 rounded-2xl shadow-2xl overflow-hidden"
                        >
                            <button
                                onClick={handleClose}
                                className="absolute top-4 right-4 text-zinc-500 hover:text-white focus:outline-none focus:ring-2 focus:ring-fire rounded"
                                aria-label="Cerrar formulario de registro"
                            >
                                <X size={20} aria-hidden="true" />
                            </button>

                            <div className="p-6 pt-10">
                                <div className="text-center mb-6">
                                    <div className="w-12 h-12 bg-fire rounded-full flex items-center justify-center mx-auto mb-3 shadow-[0_0_15px_rgba(255,69,0,0.5)]">
                                        <Flame className="text-white fill-white" size={24} aria-hidden="true" />
                                    </div>
                                    <h2 id="registration-title" className="text-xl font-serif text-white mb-1">
                                        Únete al Club Titan
                                    </h2>
                                    <p className="text-zinc-400 text-xs">Regístrate para acumular puntos.</p>


                                    {/* Referral Badge */}
                                    {referrerName && (
                                        <motion.div
                                            initial={{ opacity: 0, y: -10 }}
                                            animate={{ opacity: 1, y: 0 }}
                                            className="mt-3 bg-gold/10 border border-gold/30 rounded-lg p-2 flex items-center gap-2 justify-center"
                                        >
                                            <UserPlus size={14} className="text-gold" aria-hidden="true" />
                                            <p className="text-gold text-xs font-medium">
                                                Invitado por <span className="font-bold">{referrerName}</span>
                                            </p>
                                        </motion.div>
                                    )}
                                </div>

                                <form onSubmit={handleSubmit} className="space-y-3" noValidate>
                                    <div>
                                        <label htmlFor="name" className="sr-only">Nombre</label>
                                        <input
                                            id="name"
                                            type="text"
                                            placeholder="Nombre"
                                            required
                                            autoComplete="name"
                                            className="w-full bg-black/30 border border-zinc-700 rounded-lg px-4 py-3 text-white text-sm focus:border-fire focus:ring-1 focus:ring-fire outline-none"
                                            value={formData.name}
                                            onChange={e => setFormData({ ...formData, name: e.target.value })}
                                        />
                                    </div>

                                    <div>
                                        <label htmlFor="phone" className="sr-only">Celular</label>
                                        <input
                                            id="phone"
                                            type="tel"
                                            placeholder="Celular (10 dígitos)"

                                            required
                                            maxLength="10"
                                            autoComplete="tel"
                                            aria-describedby={phoneError ? "phone-error" : undefined}
                                            aria-invalid={phoneError ? "true" : "false"}
                                            className={`w-full bg-black/30 border rounded-lg px-4 py-3 text-white text-sm focus:border-fire focus:ring-1 focus:ring-fire outline-none ${phoneError ? 'border-red-500' : 'border-zinc-700'}`}
                                            value={formData.phone}
                                            onChange={e => handlePhoneChange(e.target.value)}
                                        />
                                        {phoneError && (
                                            <p id="phone-error" className="text-red-400 text-xs mt-1 ml-1" role="alert">
                                                {phoneError}
                                            </p>
                                        )}
                                    </div>

                                    <div>
                                        <label htmlFor="email" className="sr-only">Email (Opcional)</label>
                                        <input
                                            id="email"
                                            type="email"
                                            placeholder="Email (Opcional)"
                                            autoComplete="email"
                                            aria-describedby={emailError ? "email-error" : undefined}
                                            aria-invalid={emailError ? "true" : "false"}
                                            className={`w-full bg-black/30 border rounded-lg px-4 py-3 text-white text-sm focus:border-fire focus:ring-1 focus:ring-fire outline-none ${emailError ? 'border-red-500' : 'border-zinc-700'}`}
                                            value={formData.email}
                                            onChange={e => handleEmailChange(e.target.value)}
                                        />
                                        {emailError && (
                                            <p id="email-error" className="text-red-400 text-xs mt-1 ml-1" role="alert">
                                                {emailError}
                                            </p>
                                        )}
                                    </div>

                                    {error && (
                                        <p className="text-red-500 text-xs text-center" role="alert">
                                            {error}
                                        </p>
                                    )}

                                    <button
                                        type="submit"
                                        disabled={loading || !!phoneError || !!emailError}
                                        className="w-full bg-fire text-white font-bold py-3 rounded-lg text-sm uppercase tracking-widest hover:bg-orange-600 transition-colors mt-2 disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-fire focus:ring-offset-2 focus:ring-offset-zinc-900"
                                    >
                                        {loading ? 'Registrando...' : 'Registrarme y Obtener Tarjeta'}
                                    </button>
                                </form>
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>

            {/* Success/Card Modal */}
            <AnimatePresence>
                {showCard && (
                    <div
                        className="fixed inset-0 flex items-center justify-center bg-black/95 backdrop-blur-xl p-4"
                        style={{ zIndex: Z_INDEX.cardModal }}
                        role="dialog"
                        aria-modal="true"
                        aria-labelledby="card-title"
                    >
                        <motion.div
                            initial={{ opacity: 0, y: 50 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: 50 }}
                            className="w-full max-w-sm flex flex-col items-center"
                        >
                            <div className="w-full mb-8 transform hover:scale-105 transition-transform duration-300">
                                <LoyaltyCardWithShare client={clientData} />
                            </div>

                            <div className="text-center px-6">
                                <h3 id="card-title" className="text-gold font-serif text-2xl mb-2">
                                    ¡Membresía Activada!
                                </h3>
                                <p className="text-zinc-400 text-sm mb-4 leading-relaxed">
                                    Presenta este código QR a nuestro staff cada vez que nos visites para sumar sellos de fuego.
                                </p>


                                <button
                                    onClick={handleCardClose}
                                    className="px-8 py-3 rounded-full border border-zinc-700 text-white text-xs uppercase tracking-widest hover:bg-white/10 transition-colors focus:outline-none focus:ring-2 focus:ring-white"
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
