import React from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

const ErrorFallback = ({ error, resetErrorBoundary }) => {
    return (
        <div className="min-h-screen bg-black flex items-center justify-center p-6" role="alert">
            <div className="text-center max-w-md">
                <div className="w-20 h-20 bg-red-500/10 rounded-full flex items-center justify-center mx-auto mb-6">
                    <AlertTriangle size={40} className="text-red-500" />
                </div>
                <h1 className="text-2xl font-serif text-white mb-2">Algo sali\u00f3 mal</h1>
                <p className="text-zinc-400 text-sm mb-4">
                    Ha ocurrido un error inesperado en la aplicaci\u00f3n.
                </p>
                {import.meta.env.DEV && error && (
                    <pre className="text-left text-xs text-red-400 bg-zinc-900 p-4 rounded-lg mb-6 overflow-auto max-h-32">
                        {error.message}
                    </pre>
                )}
                <button
                    onClick={resetErrorBoundary}
                    className="inline-flex items-center gap-2 bg-fire text-white px-6 py-3 rounded-lg font-bold text-sm uppercase tracking-wider hover:bg-orange-600 transition-colors"
                >
                    <RefreshCw size={18} />
                    Intentar de nuevo
                </button>
            </div>
        </div>
    );
};

export default ErrorFallback;
