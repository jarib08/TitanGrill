/**
 * EmptyState — Estado vacío estándar.
 *
 * Props:
 *   icon     — Componente de Lucide (opcional)
 *   title    — Texto principal
 *   message  — Subtexto opcional
 *   action   — Nodo React opcional (botón CTA)
 */
export function EmptyState({ icon: Icon, title, message, action, className = '' }) {
    return (
        <div className={`flex flex-col items-center justify-center py-10 px-4 text-center ${className}`}>
            {Icon && (
                <Icon size={40} className="text-zinc-700 mb-3" strokeWidth={1.5} />
            )}
            <p className="text-sm font-medium text-zinc-500">{title}</p>
            {message && (
                <p className="text-xs text-zinc-600 mt-1 max-w-xs">{message}</p>
            )}
            {action && (
                <div className="mt-4">{action}</div>
            )}
        </div>
    );
}
