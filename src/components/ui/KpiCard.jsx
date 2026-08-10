/**
 * KpiCard — Tarjeta de indicador clave.
 *
 * Props:
 *   label      — Texto del label (string, uppercase interno)
 *   value      — Valor principal (string o número)
 *   badge      — Texto del badge inferior (string)
 *   icon       — Componente Lucide (opcional)
 *   accent     — Color semántico: 'fire'|'green'|'gold'|'blue'|'red'|'purple'|'pink'|'yellow'|'zinc'
 *   onClick    — Función opcional (hace la card clickeable)
 *   className  — Clases extra
 */
const accentMap = {
    fire:   { label: 'text-fire',   border: 'hover:border-fire/40',   icon: 'text-fire',   badge: 'text-orange-200/40 bg-fire/5' },
    green:  { label: 'text-green-400', border: 'hover:border-green-500/40', icon: 'text-green-400', badge: 'text-green-200/40 bg-green-500/5' },
    gold:   { label: 'text-yellow-400', border: 'hover:border-yellow-400/40', icon: 'text-yellow-400', badge: 'text-yellow-200/40 bg-yellow-400/5' },
    blue:   { label: 'text-blue-400', border: 'hover:border-blue-500/40', icon: 'text-blue-400', badge: 'text-blue-200/40 bg-blue-500/5' },
    red:    { label: 'text-red-400', border: 'hover:border-red-500/40',  icon: 'text-red-400',  badge: 'text-red-200/40 bg-red-500/5' },
    purple: { label: 'text-purple-400', border: 'hover:border-purple-500/40', icon: 'text-purple-400', badge: 'text-purple-200/40 bg-purple-500/5' },
    pink:   { label: 'text-pink-400', border: 'hover:border-pink-500/40', icon: 'text-pink-400', badge: 'text-pink-200/40 bg-pink-500/5' },
    yellow: { label: 'text-yellow-400', border: 'hover:border-yellow-500/40', icon: 'text-yellow-400', badge: 'text-yellow-200/40 bg-yellow-500/5' },
    zinc:   { label: 'text-zinc-400', border: 'hover:border-zinc-600',  icon: 'text-zinc-400', badge: 'text-zinc-400 bg-zinc-950/50' },
};

export function KpiCard({
    label,
    value,
    badge,
    icon: Icon,
    accent = 'zinc',
    onClick,
    className = '',
}) {
    const colors = accentMap[accent] ?? accentMap.zinc;
    const Tag = onClick ? 'button' : 'div';

    return (
        <Tag
            onClick={onClick}
            className={`
                bg-zinc-900 border border-zinc-800/60 p-5 rounded-2xl
                relative overflow-hidden group transition-colors
                ${colors.border}
                ${onClick ? 'cursor-pointer active:scale-[0.98] transition-transform text-left w-full' : ''}
                ${className}
            `}
        >
            {/* Background icon watermark */}
            {Icon && (
                <div className="absolute top-0 right-0 p-5 opacity-5 group-hover:opacity-10 transition-opacity pointer-events-none">
                    <Icon size={56} className={colors.icon} />
                </div>
            )}

            <p className={`text-[10px] uppercase tracking-widest font-bold mb-2 ${colors.label}`}>
                {label}
            </p>
            <h3 className="text-2xl font-bold text-white leading-none">
                {value}
            </h3>
            {badge && (
                <span className={`text-[10px] inline-block px-2 py-0.5 rounded mt-3 ${colors.badge}`}>
                    {badge}
                </span>
            )}
        </Tag>
    );
}
