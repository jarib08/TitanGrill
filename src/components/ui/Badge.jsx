/**
 * Badge — Etiqueta de estado semántica.
 *
 * Variantes: 'success' | 'warning' | 'danger' | 'neutral' | 'info' | 'primary'
 * Size:      'sm' (default) | 'xs'
 */
const variantClasses = {
    success: 'bg-green-500/10 text-green-400 border border-green-500/20',
    warning: 'bg-orange-500/10 text-orange-400 border border-orange-500/20',
    danger:  'bg-red-500/10 text-red-400 border border-red-500/20',
    neutral: 'bg-zinc-800 text-zinc-400 border border-zinc-700',
    info:    'bg-blue-500/10 text-blue-400 border border-blue-500/20',
    primary: 'bg-fire/10 text-fire border border-fire/20',
};

const sizeClasses = {
    xs: 'text-[9px] px-1.5 py-0.5',
    sm: 'text-[10px] px-2 py-0.5',
};

export function Badge({ variant = 'neutral', size = 'sm', children, className = '' }) {
    return (
        <span
            className={`
                inline-flex items-center font-bold uppercase tracking-wide rounded
                ${variantClasses[variant] ?? variantClasses.neutral}
                ${sizeClasses[size] ?? sizeClasses.sm}
                ${className}
            `}
        >
            {children}
        </span>
    );
}
