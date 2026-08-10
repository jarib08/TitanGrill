/**
 * SectionHeader — Encabezado de sección/tab estándar.
 *
 * Props:
 *   title      — Título principal (h1)
 *   subtitle   — Subtítulo opcional
 *   icon       — Componente Lucide opcional (aparece junto al título)
 *   actions    — Nodo React (botones CTA a la derecha)
 *   className  — Clases extra en el wrapper
 */
export function SectionHeader({ title, subtitle, icon: Icon, actions, className = '' }) {
    return (
        <div className={`flex flex-wrap justify-between items-start gap-3 ${className}`}>
            <div>
                <h1 className="text-3xl font-serif text-white flex items-center gap-2">
                    {Icon && <Icon size={26} className="text-fire shrink-0" />}
                    {title}
                </h1>
                {subtitle && (
                    <p className="text-zinc-500 text-sm mt-1">{subtitle}</p>
                )}
            </div>
            {actions && (
                <div className="flex items-center gap-2 flex-wrap">
                    {actions}
                </div>
            )}
        </div>
    );
}
