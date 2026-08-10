/**
 * BottomSheet — Modal unificado: bottom sheet en móvil, centrado en desktop.
 *
 * Props:
 *   open       — boolean
 *   onClose    — función
 *   title      — string
 *   subtitle   — string opcional
 *   maxWidth   — Tailwind max-width class, default 'sm:max-w-sm'
 *   children   — contenido del modal
 *   zIndex     — clase z-index, default 'z-[999]'
 */
export function BottomSheet({
    open,
    onClose,
    title,
    subtitle,
    maxWidth = 'sm:max-w-sm',
    children,
    zIndex = 'z-[999]',
}) {
    if (!open) return null;

    return (
        <div
            className={`fixed inset-0 bg-black/80 flex items-end sm:items-center justify-center p-0 sm:p-6 ${zIndex}`}
            onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
        >
            <div className={`w-full ${maxWidth} bg-zinc-900 border border-zinc-800 rounded-t-3xl sm:rounded-3xl shadow-2xl overflow-hidden`}>
                {/* Header */}
                {(title || subtitle) && (
                    <div className="p-5 flex justify-between items-start border-b border-zinc-800">
                        <div>
                            {subtitle && (
                                <p className="text-[10px] uppercase tracking-widest font-bold text-zinc-500 mb-0.5">
                                    {subtitle}
                                </p>
                            )}
                            {title && (
                                <h3 className="text-lg font-bold font-serif text-white leading-tight">
                                    {title}
                                </h3>
                            )}
                        </div>
                        <button
                            onClick={onClose}
                            className="text-zinc-500 hover:text-white transition-colors mt-0.5 p-1 -mr-1"
                            aria-label="Cerrar"
                        >
                            ✕
                        </button>
                    </div>
                )}

                {/* Content */}
                <div className="overflow-y-auto max-h-[85vh]">
                    {children}
                </div>
            </div>
        </div>
    );
}
