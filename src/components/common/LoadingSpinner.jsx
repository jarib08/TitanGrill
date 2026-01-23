import React from 'react';
import { Flame } from 'lucide-react';

const LoadingSpinner = ({ message = 'Cargando...' }) => {
    return (
        <div className="min-h-screen bg-black flex flex-col items-center justify-center" role="status" aria-live="polite">
            <div className="w-16 h-16 bg-fire/10 rounded-full flex items-center justify-center mb-4 animate-pulse">
                <Flame size={32} className="text-fire animate-bounce" />
            </div>
            <p className="text-fire text-sm font-medium">{message}</p>
            <span className="sr-only">{message}</span>
        </div>
    );
};

export default LoadingSpinner;
