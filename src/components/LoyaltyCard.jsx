import React, { useState, useEffect } from 'react';
import QRCode from 'react-qr-code';
import { Flame, Share2, Copy, Check } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from '../lib/supabaseClient';
import { shareReferralLink } from '../lib/referralUtils';

const LoyaltyCard = ({ client: initialClient }) => {
    // Creamos un estado interno para que la tarjeta pueda redibujarse sola
    const [client, setClient] = useState(initialClient);
    const totalStamps = 10;

    // Share button states
    const [shareStatus, setShareStatus] = useState('idle'); // 'idle' | 'sharing' | 'copied' | 'error'

    // State to track if we are verifying data against the server
    const [isVerifying, setIsVerifying] = useState(true);
    const [showBigQr, setShowBigQr] = useState(false);

    // Efecto para sincronizar con Realtime + Polling de respaldo en vivo (3s)
    useEffect(() => {
        if (!initialClient?.id) return;

        // 1. Sincronizar el estado inicial (y forzar refresh desde DB para asegurar datos frescos)
        const fetchLatestData = async () => {
            setClient(initialClient);

            const { data, error } = await supabase
                .from('clientes')
                .select('*')
                .eq('id', initialClient.id)
                .maybeSingle();

            if (data && !error) {
                setClient(data);
                localStorage.setItem('titan_client', JSON.stringify(data));
            }
            setIsVerifying(false);
        };

        fetchLatestData();

        // 2. Polling de respaldo cada 3 segundos por si el WebSocket móvil parpadea
        const pollInterval = setInterval(async () => {
            const { data, error } = await supabase
                .from('clientes')
                .select('*')
                .eq('id', initialClient.id)
                .maybeSingle();

            if (data && !error) {
                setClient(prev => {
                    if (prev?.stamps_count !== data.stamps_count) {
                        localStorage.setItem('titan_client', JSON.stringify(data));
                        return data;
                    }
                    return prev;
                });
            }
        }, 3000);

        // 3. Suscribirse a cambios Postgres Realtime en tiempo real para este cliente
        const subscription = supabase
            .channel(`client-${initialClient.id}`)
            .on(
                'postgres_changes',
                {
                    event: 'UPDATE',
                    schema: 'public',
                    table: 'clientes',
                    filter: `id=eq.${initialClient.id}`
                },
                (payload) => {
                    if (payload.new) {
                        console.log('🔥 ¡Sello detectado en tiempo real!', payload.new);
                        setClient(payload.new);
                        localStorage.setItem('titan_client', JSON.stringify(payload.new));
                    }
                }
            )
            .subscribe();

        return () => {
            clearInterval(pollInterval);
            subscription.unsubscribe();
        };
    }, [initialClient]);

    // URL para el QR
    const qrValue = client?.id ? `${window.location.origin}/login?clientId=${client.id}` : 'DEMO';

    // Handle share button click
    const handleShare = async () => {
        if (!client?.referral_code) {
            console.error('No referral code available');
            return;
        }

        setShareStatus('sharing');

        try {
            const result = await shareReferralLink(client.referral_code, client.nombre);

            if (result.success) {
                if (result.method === 'share') {
                    setShareStatus('idle');
                } else if (result.method === 'clipboard') {
                    setShareStatus('copied');
                    setTimeout(() => setShareStatus('idle'), 2000);
                }
            } else {
                setShareStatus('error');
                setTimeout(() => setShareStatus('idle'), 2000);
            }
        } catch (error) {
            console.error('Error sharing:', error);
            setShareStatus('error');
            setTimeout(() => setShareStatus('idle'), 2000);
        }
    };


    return (
        <div className="w-full max-w-[400px] mx-auto aspect-[1.586/1] bg-[#141414] relative overflow-hidden group rounded-2xl border border-white/10 shadow-2xl">
            {/* Gradient Glow - Custom Radial for Oxide Red Effect - Adjusted opacity and position */}
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_100%_0%,#3d1a14_0%,transparent_35%)] opacity-50 pointer-events-none z-0"></div>

            <div className="relative z-10 flex flex-col h-full justify-between p-6">
                {/* Header */}
                <div className="flex justify-between items-start mb-1">
                    <div>
                        <h3 className="text-2xl font-serif font-bold tracking-wider text-[#e64a19] leading-none">TITAN GRILL</h3>
                        <p className="text-[0.6rem] text-zinc-500 uppercase tracking-[0.3em] font-medium mt-1 pl-0.5">CLUB MEMBER</p>
                    </div>
                    <p className="text-[0.65rem] text-zinc-600 font-mono tracking-widest mt-1">
                        ID: {client?.id?.slice(0, 8) || '...'}
                    </p>
                </div>

                {/* Main Content: QR + Grid */}
                <div className="flex items-center gap-4">
                    {/* QR Code - Clickable to expand */}
                    <div 
                        onClick={() => setShowBigQr(true)} 
                        title="Toca para ampliar el código QR"
                        className="bg-white p-2 rounded-2xl shrink-0 w-22 h-22 flex flex-col items-center justify-center shadow-lg cursor-pointer hover:scale-105 transition-transform relative group/qr"
                    >
                        <QRCode value={qrValue} size={80} className="w-full h-full" />
                        <span className="absolute -bottom-1 bg-fire text-white text-[8px] font-bold px-1.5 py-0.5 rounded-full shadow opacity-90 group-hover/qr:opacity-100 transition-opacity">
                            🔍 Tocar
                        </span>
                    </div>

                    {/* Stamps Grid */}
                    <div className="flex-1 grid grid-cols-5 gap-x-2 gap-y-2">
                        {[...Array(totalStamps)].map((_, i) => (
                            <div
                                key={i}
                                className={`aspect-square rounded-full flex items-center justify-center border transition-all duration-300
                                    ${client?.stamps_count > i
                                        ? 'border-[#e64a19] bg-[#e64a19]/10 shadow-[0_0_8px_rgba(230,74,25,0.3)]'
                                        : 'border-[#e64a19]/30 bg-transparent'
                                    }`}
                            >
                                {client?.stamps_count > i && (
                                    <motion.div
                                        initial={{ scale: 0 }}
                                        animate={{ scale: 1 }}
                                        key={`fire-${client.stamps_count}`}
                                    >
                                        <Flame size={16} className="text-fire fill-fire" />
                                    </motion.div>
                                )}
                                {client?.stamps_count <= i && (
                                    <Flame size={16} className="text-zinc-700/80 stroke-[1.5]" />
                                )}
                            </div>
                        ))}
                    </div>
                </div>

                {/* Footer Info */}
                <div className="flex justify-between items-end mt-1 relative z-20">
                    <div>
                        <h4 className="text-zinc-300 font-medium text-lg tracking-wide">{client?.nombre || 'Cliente'}</h4>
                        <p className="text-zinc-600 text-[0.7rem] font-light">{client?.stamps_count || 0} de 10 Sellos</p>
                    </div>

                    {/* Share Button Integrated - Compact & Premium */}
                    {client?.referral_code && (
                        <motion.button
                            onClick={(e) => {
                                e.stopPropagation();
                                handleShare();
                            }}
                            disabled={shareStatus === 'sharing'}
                            whileHover={{ scale: 1.05 }}
                            whileTap={{ scale: 0.95 }}
                            className="bg-banner px-4 py-1.5 rounded-full shadow-[0_0_15px_rgba(230,74,25,0.4)] border border-[#e64a19]/50 flex items-center gap-2 relative overflow-hidden group/btn"
                        >
                            {/* Inner Glow */}
                            <div className="absolute inset-0 bg-linear-to-r from-[#e64a19] to-[#ff7043] opacity-80 group-hover/btn:opacity-100 transition-opacity" />

                            {/* Shimmer Effect */}
                            <div className="absolute inset-0 bg-linear-to-r from-transparent via-white/40 to-transparent bg-size-[200%_100%] animate-shimmer opacity-0 group-hover/btn:opacity-100" />

                            <div className="relative z-10 flex items-center gap-1.5">
                                <AnimatePresence mode="wait">
                                    {shareStatus === 'idle' && (
                                        <motion.div
                                            key="idle"
                                            initial={{ opacity: 0 }}
                                            animate={{ opacity: 1 }}
                                            exit={{ opacity: 0 }}
                                            className="flex items-center gap-1.5"
                                        >
                                            <Share2 size={12} className="text-white fill-white/20" />
                                            <span className="text-white text-[0.6rem] font-bold uppercase tracking-widest font-mono">INVITA Y GANA</span>
                                        </motion.div>
                                    )}
                                    {shareStatus === 'sharing' && (
                                        <motion.div
                                            key="sharing"
                                            initial={{ scale: 0 }}
                                            animate={{ scale: 1 }}
                                            exit={{ scale: 0 }}
                                        >
                                            <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
                                        </motion.div>
                                    )}
                                    {shareStatus === 'copied' && (
                                        <motion.div
                                            key="copied"
                                            initial={{ opacity: 0, y: 10 }}
                                            animate={{ opacity: 1, y: 0 }}
                                            exit={{ opacity: 0, y: -10 }}
                                            className="flex items-center gap-1.5"
                                        >
                                            <Check size={12} className="text-white" />
                                            <span className="text-white text-[0.6rem] font-bold uppercase tracking-widest">COPIADO</span>
                                        </motion.div>
                                    )}
                                    {shareStatus === 'error' && (
                                        <motion.span
                                            key="error"
                                            initial={{ opacity: 0 }}
                                            animate={{ opacity: 1 }}
                                            className="text-white text-[0.6rem] font-bold"
                                        >
                                            ERROR
                                        </motion.span>
                                    )}
                                </AnimatePresence>
                            </div>
                        </motion.button>
                    )}
                </div>
            </div>
            {/* Prize Overlay - Premium Design */}
            <AnimatePresence>
                {/* Only show if stamps >= 10 AND we are not currently verifying data (to avoid flashes) */}
                {client?.stamps_count >= totalStamps && !isVerifying && (
                    <motion.div
                        initial={{ opacity: 0, backdropFilter: "blur(0px)" }}
                        animate={{ opacity: 1, backdropFilter: "blur(8px)" }}
                        exit={{ opacity: 0, backdropFilter: "blur(0px)" }}
                        className="absolute inset-0 z-30 flex items-center justify-center overflow-hidden rounded-2xl"
                    >
                        {/* Dark Gradient Overlay with Noise Texture */}
                        <div className="absolute inset-0 bg-linear-to-br from-black/95 via-black/90 to-[#2a0e0e]/90" />

                        {/* Animated Glow Effect moved to back */}
                        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[120%] h-[120%] bg-[radial-gradient(circle_at_center,#e64a19_0%,transparent_50%)] opacity-20 blur-3xl animate-pulse pointer-events-none" />

                        <motion.div
                            initial={{ scale: 0.9, y: 10, opacity: 0 }}
                            animate={{ scale: 1, y: 0, opacity: 1 }}
                            transition={{ type: "spring", stiffness: 300, damping: 20, delay: 0.1 }}
                            className="relative z-40 w-full h-full flex flex-col items-center justify-center p-4 text-center"
                        >
                            {/* Icon Container - Reduced size */}
                            <motion.div
                                animate={{
                                    boxShadow: ["0 0 20px rgba(230,74,25,0.3)", "0 0 40px rgba(230,74,25,0.6)", "0 0 20px rgba(230,74,25,0.3)"]
                                }}
                                transition={{ duration: 2, repeat: Infinity }}
                                className="w-12 h-12 md:w-14 md:h-14 bg-linear-to-tr from-[#e64a19] to-[#ff7043] rounded-full flex items-center justify-center mb-3 shadow-2xl ring-2 ring-[#e64a19]/20"
                            >
                                <Flame size={24} className="text-white fill-white drop-shadow-md" />
                            </motion.div>

                            {/* Main Title - Reduced Size */}
                            <h3 className="text-xl md:text-2xl font-serif font-black text-transparent bg-clip-text bg-linear-to-r from-white via-gray-200 to-gray-400 mb-1 uppercase tracking-tight drop-shadow-sm leading-tight">
                                ¡Premio<br />Alcanzado!
                            </h3>

                            {/* Divider */}
                            <div className="w-8 h-0.5 bg-[#e64a19] rounded-full mb-3 opacity-80" />

                            {/* Description - Compact */}
                            <div className="mb-4 space-y-0.5">
                                <p className="text-zinc-400 text-xs font-light tracking-wide">
                                    10/10 Sellos Completados
                                </p>
                                <p className="text-[#ff7043] text-sm md:text-base font-bold tracking-wide animate-pulse">
                                    ¡Es hora de canjear!
                                </p>
                            </div>

                            {/* Footer / Instruction - Styled as a badge */}
                            <div className="bg-white/5 backdrop-blur-md border border-white/10 rounded-full px-4 py-1.5">
                                <p className="text-[0.55rem] md:text-[0.65rem] text-zinc-400 uppercase tracking-[0.2em] font-medium leading-none">
                                    Muestra esta pantalla al staff
                                </p>
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Modal: Big QR Code for Easy Scanning at Counter */}
            <AnimatePresence>
                {showBigQr && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={() => setShowBigQr(false)}
                        className="fixed inset-0 bg-black/90 backdrop-blur-md z-[9999] flex flex-col items-center justify-center p-6"
                    >
                        <motion.div
                            initial={{ scale: 0.8, y: 20 }}
                            animate={{ scale: 1, y: 0 }}
                            exit={{ scale: 0.8, y: 20 }}
                            onClick={(e) => e.stopPropagation()}
                            className="bg-zinc-900 border border-fire/40 rounded-3xl p-6 max-w-sm w-full text-center space-y-4 shadow-2xl relative"
                        >
                            <div className="flex justify-between items-center border-b border-zinc-800 pb-3">
                                <h4 className="text-fire font-serif font-bold text-lg tracking-wide">Tarjeta Titan Grill</h4>
                                <button
                                    onClick={() => setShowBigQr(false)}
                                    className="text-zinc-400 hover:text-white p-1.5 rounded-lg bg-zinc-800 text-xs font-bold transition-colors"
                                >
                                    ✕
                                </button>
                            </div>

                            <div className="bg-white p-4 rounded-2xl mx-auto w-64 h-64 flex items-center justify-center shadow-2xl border-4 border-fire">
                                <QRCode value={qrValue} size={230} className="w-full h-full" />
                            </div>

                            <div className="space-y-1">
                                <p className="text-white font-bold text-base">{client?.nombre || 'Cliente'}</p>
                                <p className="text-zinc-400 text-xs font-mono">{client?.stamps_count || 0} de 10 Fuegos</p>
                                <p className="text-[11px] text-orange-400 font-medium pt-2">
                                    🔍 Muestra este QR al personal en caja para escanear fácilmente.
                                </p>
                            </div>

                            <button
                                onClick={() => setShowBigQr(false)}
                                className="w-full bg-fire hover:bg-orange-700 text-white py-3 rounded-xl text-xs font-bold uppercase tracking-wider transition-colors shadow-lg"
                            >
                                Cerrar Visor
                            </button>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
};

export default LoyaltyCard;

// Wrapper component alias for backward compatibility
export const LoyaltyCardWithShare = LoyaltyCard;
