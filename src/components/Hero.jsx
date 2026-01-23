import React from 'react';
import { ChevronDown } from 'lucide-react';
import { motion } from 'framer-motion';

const Hero = () => {
    const scrollToMenu = () => {
        const menuSection = document.getElementById('menu');
        menuSection?.scrollIntoView({ behavior: 'smooth' });
    };

    return (
        <section className="relative h-screen flex items-center justify-center overflow-hidden bg-black">
            {/* Background Image */}
            <div className="absolute inset-0 z-0">
                <img
                    src="/menu/hero_Background_Image.jpg"
                    alt="Premium Grill"
                    className="w-full h-full object-cover opacity-60"
                />
                {/* Gradients for text readability and luxury vibe */}
                <div className="absolute inset-0 bg-[linear-gradient(to_top,var(--tw-gradient-stops))] from-black via-black/40 to-transparent"></div>
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,var(--tw-gradient-stops))] from-transparent to-black/80"></div>
            </div>

            {/* Content */}
            <div className="relative z-10 text-center px-6 max-w-4xl mx-auto mt-[-5vh]">
                <motion.div
                    initial={{ opacity: 0, y: 30 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 1.2, ease: "easeOut" }}
                >
                    <div className="inline-block border-b border-gold/50 pb-2 mb-6">
                        <span className="text-gold tracking-[0.4em] text-xs md:text-sm uppercase font-semibold">

                        </span>
                    </div>

                    <h1 className="text-5xl md:text-7xl lg:text-9xl font-serif text-white mb-6 leading-tight tracking-tight drop-shadow-2xl">
                        Titan<span className="text-fire">.</span>Grill
                    </h1>
                </motion.div>

                <motion.p
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.6, duration: 1 }}
                    className="text-lg md:text-2xl text-zinc-300 mb-12 font-light max-w-xl mx-auto font-sans leading-relaxed"
                >
                    Fuego, sabor, y poder en cada bocado. <br />
                    <span className="text-gold/80 italic font-serif">Únete al Club Exclusivo.</span>
                </motion.p>

                <motion.div
                    initial={{ scale: 0.9, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    transition={{ delay: 1 }}
                >
                    <button
                        onClick={scrollToMenu}
                        className="group relative px-10 py-4 bg-transparent overflow-hidden rounded-none border border-white/20 transition-all hover:border-gold hover:bg-gold/10"
                    >
                        <div className="absolute inset-0 w-0 bg-gold/10 transition-all duration-250 ease-out group-hover:w-full"></div>
                        <span className="relative text-white group-hover:text-gold uppercase tracking-[0.3em] text-xs font-bold">Ver Menú</span>
                    </button>
                </motion.div>
            </div>

            {/* Scroll Indicator */}
            <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1, y: [0, 10, 0] }}
                transition={{ delay: 1.5, repeat: Infinity, duration: 2 }}
                className="absolute bottom-12 z-10 text-white/30"
            >
                <ChevronDown size={28} strokeWidth={1} />
            </motion.div>
        </section>
    );
};

export default Hero;
