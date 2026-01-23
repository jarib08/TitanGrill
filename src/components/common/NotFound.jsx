import React from 'react';
import { Link } from 'react-router-dom';
import { Home, AlertCircle } from 'lucide-react';

const NotFound = () => {
    return (
        <div className="min-h-screen bg-black flex items-center justify-center p-6">
            <div className="text-center max-w-md">
                <div className="w-20 h-20 bg-fire/10 rounded-full flex items-center justify-center mx-auto mb-6">
                    <AlertCircle size={40} className="text-fire" />
                </div>
                <h1 className="text-4xl font-serif text-white mb-2">404</h1>
                <h2 className="text-xl text-zinc-400 mb-6">P\u00e1gina no encontrada</h2>
                <p className="text-zinc-500 text-sm mb-8">
                    La p\u00e1gina que buscas no existe o ha sido movida.
                </p>
                <Link
                    to="/"
                    className="inline-flex items-center gap-2 bg-fire text-white px-6 py-3 rounded-lg font-bold text-sm uppercase tracking-wider hover:bg-orange-600 transition-colors"
                >
                    <Home size={18} />
                    Volver al Inicio
                </Link>
            </div>
        </div>
    );
};

export default NotFound;
