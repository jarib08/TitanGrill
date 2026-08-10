/**
 * LoadingSpinner — Indicadores de carga.
 *
 * <LoadingSpinner />           → spinner inline pequeño
 * <LoadingSpinner size="lg" /> → spinner más grande
 * <LoadingSpinner text="Cargando..." /> → con texto
 */
export function LoadingSpinner({ size = 'sm', text, className = '' }) {
    const sizeClass = size === 'lg' ? 'w-5 h-5 border-2' : 'w-3.5 h-3.5 border-2';
    return (
        <span className={`inline-flex items-center gap-2 ${className}`}>
            <span
                className={`${sizeClass} border-fire border-t-transparent rounded-full animate-spin shrink-0`}
                aria-hidden="true"
            />
            {text && <span className="text-xs text-zinc-400">{text}</span>}
        </span>
    );
}

/**
 * LoadingOverlay — Texto pulsante para módulos completos.
 */
export function LoadingOverlay({ text = 'Cargando...' }) {
    return (
        <div className="flex items-center gap-2 text-zinc-500 text-sm py-10 justify-center animate-pulse">
            <span className="w-3 h-3 border-2 border-fire border-t-transparent rounded-full animate-spin" />
            {text}
        </div>
    );
}

/**
 * SkeletonCard — Placeholder de card mientras carga.
 */
export function SkeletonCard({ className = '' }) {
    return (
        <div className={`bg-zinc-900 border border-zinc-800 rounded-2xl animate-pulse ${className}`} />
    );
}
