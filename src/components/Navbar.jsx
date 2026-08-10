import React, { useState, useEffect } from 'react';
import { Menu, X, ShoppingBag } from 'lucide-react';
import { Link } from 'react-router-dom';

const Navbar = () => {
    const [isOpen, setIsOpen] = useState(false);
    const [scrolled, setScrolled] = useState(false);

    useEffect(() => {
        const handleScroll = () => {
            setScrolled(window.scrollY > 50);
        };
        window.addEventListener('scroll', handleScroll);
        return () => window.removeEventListener('scroll', handleScroll);
    }, []);

    return (
        <nav className={`fixed w-full z-50 transition-all duration-500 ${scrolled ? 'bg-zinc-950/80 backdrop-blur-md shadow-lg border-b border-white/5' : 'bg-transparent'}`}>
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                <div className="flex items-center justify-between h-24">
                    <div className="shrink-0">
                        <Link to="/" className="text-3xl font-serif font-bold text-white tracking-widest hover:text-fire transition-colors duration-300">
                            TITAN<span className="text-fire">.</span>
                        </Link>
                    </div>

                    <div className="hidden md:block">
                        <div className="ml-10 flex items-center space-x-8">
                            <a href="#menu" className="text-zinc-300 hover:text-fire transition-colors uppercase tracking-widest text-xs font-semibold">Carta</a>
                            <a href="#location" className="text-zinc-300 hover:text-fire transition-colors uppercase tracking-widest text-xs font-semibold">Ubicación</a>
                            <a href="#join-club" className="text-zinc-300 hover:text-gold transition-colors uppercase tracking-widest text-xs font-semibold">Únete al Club</a>
                            <Link
                                to="/menu"
                                className="bg-gradient-to-r from-orange-600 to-fire hover:from-orange-500 hover:to-fire text-white px-5 py-2.5 rounded-full uppercase tracking-wider text-xs font-extrabold shadow-lg shadow-fire/30 transition-all flex items-center gap-1.5 active:scale-95"
                            >
                                <ShoppingBag size={14} /> Pedido Virtual
                            </Link>
                        </div>
                    </div>

                    <div className="md:hidden">
                        <button
                            onClick={() => setIsOpen(!isOpen)}
                            className="text-white hover:text-fire transition-colors p-2"
                        >
                            {isOpen ? <X size={24} /> : <Menu size={24} />}
                        </button>
                    </div>
                </div>
            </div>

            {/* Mobile Menu */}
            {isOpen && (
                <div className="md:hidden bg-zinc-950/95 backdrop-blur-xl border-b border-zinc-800 absolute w-full">
                    <div className="px-4 py-8 space-y-6 flex flex-col items-center">
                        <Link
                            to="/menu"
                            onClick={() => setIsOpen(false)}
                            className="w-full text-center bg-gradient-to-r from-orange-600 to-fire text-white py-3.5 rounded-2xl font-extrabold uppercase tracking-wider text-sm shadow-lg shadow-fire/30"
                        >
                            <ShoppingBag size={16} className="mx-auto inline" /> Hacer Pedido Virtual
                        </Link>
                        <a href="#menu" className="text-lg font-serif text-white hover:text-fire" onClick={() => setIsOpen(false)}>Ver Carta</a>
                        <a href="#location" className="text-lg font-serif text-white hover:text-fire" onClick={() => setIsOpen(false)}>Ubicación</a>
                        <a href="#join-club" className="text-lg font-serif text-gold font-bold" onClick={() => setIsOpen(false)}>Únete al Club</a>
                    </div>
                </div>
            )}
        </nav>
    );
};

export default Navbar;
