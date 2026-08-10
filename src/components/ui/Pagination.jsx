import React from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

/**
 * Pagination — Fase 6.3
 * Props:
 *   currentPage  {number}   — base-0
 *   totalPages   {number}   — Math.ceil(total / pageSize)
 *   totalItems   {number}   — total real de registros
 *   pageSize     {number}   — registros por página (default 20)
 *   onPrev       {fn}
 *   onNext       {fn}
 */
export default function Pagination({
    currentPage,
    totalPages,
    totalItems,
    pageSize = 20,
    onPrev,
    onNext,
}) {
    if (totalPages <= 1) return null;

    const from = currentPage * pageSize + 1;
    const to = Math.min((currentPage + 1) * pageSize, totalItems);

    return (
        <div className="flex items-center justify-between px-4 py-3 border-t border-zinc-800 bg-zinc-950/40">
            <span className="text-[11px] text-zinc-500">
                Mostrando{' '}
                <span className="text-zinc-300 font-semibold">{from}–{to}</span>
                {' '}de{' '}
                <span className="text-zinc-300 font-semibold">{totalItems}</span>
            </span>

            <div className="flex items-center gap-2">
                <button
                    onClick={onPrev}
                    disabled={currentPage === 0}
                    className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-[11px] font-bold border transition-all disabled:opacity-30 disabled:cursor-not-allowed border-zinc-800 bg-zinc-900 text-zinc-400 hover:text-white hover:border-zinc-700 active:scale-95"
                    aria-label="Página anterior"
                >
                    <ChevronLeft size={13} />
                    Anterior
                </button>

                <span className="text-[11px] font-bold text-zinc-400 min-w-[60px] text-center">
                    {currentPage + 1} / {totalPages}
                </span>

                <button
                    onClick={onNext}
                    disabled={currentPage >= totalPages - 1}
                    className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-[11px] font-bold border transition-all disabled:opacity-30 disabled:cursor-not-allowed border-zinc-800 bg-zinc-900 text-zinc-400 hover:text-white hover:border-zinc-700 active:scale-95"
                    aria-label="Página siguiente"
                >
                    Siguiente
                    <ChevronRight size={13} />
                </button>
            </div>
        </div>
    );
}
