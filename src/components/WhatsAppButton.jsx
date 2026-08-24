import React from 'react';
import { MessageCircle } from 'lucide-react';
import { motion } from 'framer-motion';

const WhatsAppButton = () => {
    return (
        <motion.a
            href="https://wa.me/573004126441" // Placeholder number
            target="_blank"
            rel="noopener noreferrer"
            className="fixed bottom-6 right-6 z-50 group flex items-center justify-center"
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ delay: 2, type: 'spring' }}
        >
            <div className="absolute inset-0 bg-emerald-500 rounded-full blur-lg opacity-20 group-hover:opacity-40 transition-opacity duration-300"></div>
            <div className="relative bg-zinc-950 border border-emerald-500/30 w-14 h-14 rounded-full flex items-center justify-center shadow-2xl group-hover:bg-emerald-500/10 transition-colors">
                <MessageCircle size={28} className="text-emerald-500" strokeWidth={1.5} />
            </div>
        </motion.a>
    );
};

export default WhatsAppButton;
