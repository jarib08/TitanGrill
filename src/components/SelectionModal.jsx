import React from 'react';
import { motion } from 'framer-motion';
import { X } from 'lucide-react';
import AppImage from './ui/AppImage';

const SelectionModal = ({ isOpen, onClose, data }) => {
    if (!isOpen || !data) return null;

    return (
        <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-100 flex items-start md:items-center justify-center p-4 pt-24 md:p-4 bg-black/80 backdrop-blur-sm overflow-hidden"
            onClick={onClose}
        >
            <motion.div
                initial={{ opacity: 0, scale: 0.9, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.9, y: 20 }}
                transition={{ type: "spring", duration: 0.5 }}
                className="bg-zinc-900/95 backdrop-blur-md w-full max-w-lg rounded-2xl relative overflow-hidden border border-zinc-800 shadow-2xl flex flex-col max-h-[85vh]"
                onClick={(e) => e.stopPropagation()}
            >
                {/* Close Button */}
                <button
                    onClick={onClose}
                    className="absolute top-5 right-5 p-2 bg-zinc-800/80 rounded-full text-zinc-400 hover:text-white hover:rotate-90 transition-all duration-300 z-20"
                >
                    <X size={24} />
                </button>

                {/* Header */}
                <div className="p-6 md:p-8 pb-4 pt-8 border-b border-zinc-800/50 text-center shrink-0">
                    <h3 className="text-2xl font-serif font-bold text-white tracking-wide mt-2">{data.title}</h3>
                    <div className="w-12 h-0.5 bg-fire mx-auto mt-2 rounded-full"></div>
                </div>

                {/* Content */}
                <div className="p-6 md:p-8 overflow-y-auto custom-scrollbar grow">
                    {data.sections.map((section, idx) => (
                        <div key={idx} className={idx < data.sections.length - 1 ? "mb-8" : ""}>
                            <div className="flex items-center gap-4 mb-6">
                                <h4 className="text-fire font-bold tracking-widest text-sm uppercase shrink-0">{section.title}</h4>
                                <div className="h-px bg-zinc-800 grow"></div>
                            </div>
                            <div className={`grid gap-4 ${data.gridCols === 1 ? 'grid-cols-1' : 'grid-cols-2'}`}>
                                {section.items.map((item, itemIdx) => (
                                    <div key={itemIdx} className="group">
                                        <div className={`overflow-hidden rounded-xl mb-3 relative ${data.gridCols === 1 ? 'aspect-video' : 'aspect-square'}`}>
                                            <AppImage
                                                src={item.image}
                                                alt={item.name}
                                                className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
                                            />
                                            <div className="absolute inset-0 bg-black/20 group-hover:bg-transparent transition-colors"></div>
                                        </div>
                                        <div className="flex justify-between items-start">
                                            <h5 className="text-zinc-200 font-medium text-sm leading-tight pr-2">{item.name}</h5>
                                            <span className="text-fire font-bold text-sm shrink-0">{item.price}</span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    ))}
                </div>
            </motion.div>
        </motion.div>
    );
};

export default SelectionModal;
