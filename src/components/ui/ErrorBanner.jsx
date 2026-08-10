/**
 * ErrorBanner — Aviso de error no bloqueante con opción de retry.
 *
 * Props:
 *   message   — string
 *   onRetry   — función opcional
 */
export function ErrorBanner({ message, onRetry, className = '' }) {
    return (
        <div className={`flex items-start gap-3 bg-red-950/30 border border-red-900/40 rounded-xl p-4 ${className}`}>
            <span className="text-red-400 text-lg leading-none shrink-0">⚠</span>
            <div className="flex-1 min-w-0">
                <p className="text-sm text-red-300 font-medium">Error al cargar datos</p>
                <p className="text-xs text-red-400/70 mt-0.5 break-words">{message}</p>
            </div>
            {onRetry && (
                <button
                    onClick={onRetry}
                    className="shrink-0 text-xs font-bold text-red-400 hover:text-red-300 bg-red-950/40 hover:bg-red-950/60 px-3 py-1.5 rounded-lg transition-colors"
                >
                    Reintentar
                </button>
            )}
        </div>
    );
}
