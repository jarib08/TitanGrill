import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowUpRight, ShoppingBag } from 'lucide-react';
import { Link } from 'react-router-dom';
import SelectionModal from './SelectionModal';

// Data for Modals
const bebidasData = {
    title: 'BEBIDAS',
    sections: [
        {
            title: 'GASEOSAS',
            items: [
                { name: 'Postobón Manzana', price: '$3k', image: '/menu/postobon_manzana.jpg' },
                { name: 'Coca-Cola', price: '$3k', image: '/menu/Cocacola.png' }
            ]
        },
        {
            title: 'NATURALES',
            items: [
                { name: 'Cerezada', price: '$6k', image: '/menu/Cerezada.png' },
                { name: 'Limonada', price: '$6k', image: '/menu/Limonada.png' }
            ]
        }
    ]
};

const entradasData = {
    title: 'ENTRADAS',
    gridCols: 1,
    sections: [
        {
            title: 'CORN DOGS COREANO',
            items: [
                { name: 'Corn Dog Clásico', price: '$12k', image: '/menu/corn_dogs_coreano_1768781993133.png' }
            ]
        },
        {
            title: 'PAPAS EN ESPIRAL',
            items: [
                { name: 'Papa en Espiral', price: '$8k', image: '/menu/papas_espiral_1768782007320.png' }
            ]
        }
    ]
};

const categories = [
    {
        id: 4,
        title: 'Entradas',
        image: '/menu/entradas_main_card_1768781980023.png',
        items: [], // Intentionally empty as details are in modal
        modalData: entradasData
    },
    {
        id: 2,
        title: 'Burger Classic',
        categoryPrice: '$14k',
        image: '/menu/Hamburguesa.png',
        description: 'Jugosa hamburguesa de 120 g de carne premium, servida en un suave pan artesanal de papa, acompañada de cebolla caramelizada, lechuga fresca, tocineta dorada al punto perfecto y salsas adicionales que realzan cada bocado.',
        items: []
    },
    {
        id: 3,
        title: 'Perros calientes',
        categoryPrice: '$8k',
        description: 'Pan artesanal de papa, salchicha jumbo, papa ripia, nuestra irresistible salsa Big Mac con un toque ligero de cebolla.',
        subtitle: 'Toppings Adicionales: "solo 2 por producto"',
        image: '/menu/Perro-caliente.png',
        items: ['Tocineta', 'Cebolla Caramelizada', 'Maiz', 'Puerro', 'Ripia', 'Doritos']
    },
    {
        id: 1,
        title: 'Bebidas',
        image: '/menu/Bebidas_main_card.png',
        items: [],
        modalData: bebidasData
    }
];

const MenuGrid = () => {
    const [selectedCategory, setSelectedCategory] = React.useState(null);

    return (
        <section id="menu" className="py-32 px-4 bg-zinc-950 relative">
            <div className="max-w-7xl mx-auto relative z-10">
                <div className="text-center mb-20">
                    <span className="text-fire font-bold tracking-widest text-sm uppercase block mb-3">Nuestra Carta</span>
                    <h2 className="text-5xl md:text-6xl font-serif text-white mb-6">Selección Titan</h2>
                    <div className="w-24 h-1 bg-fire mx-auto rounded-full"></div>
                </div>

                <div className="grid md:grid-cols-3 gap-10">
                    {categories.map((cat, index) => (
                        <motion.div
                            key={cat.id}
                            initial={{ opacity: 0, y: 30 }}
                            whileInView={{ opacity: 1, y: 0 }}
                            viewport={{ once: true, margin: "-100px" }}
                            transition={{ delay: index * 0.1, duration: 0.6 }}
                            onClick={() => cat.modalData ? setSelectedCategory(cat.modalData) : null}
                            className={`group relative bg-zinc-900 border border-zinc-800 rounded-2xl overflow-hidden hover:border-fire/50 transition-all duration-500 ${cat.modalData ? 'cursor-pointer' : ''}`}
                        >
                            <div className="h-64 overflow-hidden relative">
                                <img
                                    src={cat.image}
                                    alt={cat.title}
                                    className="w-full h-full object-cover transform group-hover:scale-110 transition-transform duration-700 ease-in-out"
                                />
                                <div className="absolute inset-0 bg-black/40 group-hover:bg-black/20 transition-all"></div>
                            </div>

                            <div className="p-8 relative">
                                {/* Only show arrow for items with modalData (Bebidas & Entradas) */}
                                {cat.modalData && (
                                    <div className="absolute -top-6 right-6 w-12 h-12 bg-zinc-950 rounded-full flex items-center justify-center border border-zinc-800 group-hover:border-fire group-hover:text-fire transition-colors shadow-xl z-20">
                                        <ArrowUpRight size={20} />
                                    </div>
                                )}

                                <div className="flex justify-between items-baseline mb-1">
                                    <h3 className="text-2xl font-serif font-bold text-white">{cat.title}</h3>
                                    {cat.categoryPrice && (
                                        <span className="text-fire font-bold text-xl ml-2">
                                            {cat.categoryPrice}
                                        </span>
                                    )}
                                </div>

                                {/* DESCRIPCIÓN DEL PRODUCTO (si existe) */}
                                {cat.description && (
                                    <p className="text-zinc-400 text-sm leading-relaxed italic border-l-2 border-fire/30 pl-4 py-1 mb-4">
                                        {cat.description}
                                    </p>
                                )}

                                {cat.subtitle && (
                                    <span className="text-zinc-500 text-xxs uppercase tracking-super-wide font-bold block mb-4">
                                        {cat.subtitle}
                                    </span>
                                )}

                                {/* LISTA DE ITEMS (Toppings) */}
                                {cat.items && cat.items.length > 0 && (
                                    <ul className={cat.subtitle ? "grid grid-cols-2 gap-x-4 gap-y-3" : "space-y-3"}>
                                        {cat.items.map((item, i) => (
                                            <li key={i} className="text-zinc-400 text-sm tracking-wide border-b border-zinc-800/50 pb-2 last:border-0 flex items-center">
                                                <span className="w-1.5 h-1.5 bg-fire rounded-full mr-3 opacity-0 group-hover:opacity-100 transition-opacity delay-100 shrink-0"></span>
                                                <span className="truncate">{item}</span>
                                            </li>
                                        ))}
                                    </ul>
                                )}
                            </div>
                        </motion.div>
                    ))}
                </div>

                {/* CTA Banner to Digital Menu */}
                <div className="mt-16 text-center bg-gradient-to-r from-zinc-900 via-zinc-900 to-zinc-950 border border-zinc-800 p-8 rounded-3xl max-w-3xl mx-auto shadow-2xl space-y-4">
                    <h3 className="text-2xl font-serif text-white font-bold">¿Listo para probar el auténtico sabor Titan?</h3>
                    <p className="text-sm text-zinc-400 max-w-md mx-auto">Explora nuestro menú interactivo completo, arma tu pedido a tu gusto y envíalo directamente por WhatsApp.</p>
                    <div className="pt-2">
                        <Link
                            to="/menu"
                            className="inline-flex items-center gap-2 bg-gradient-to-r from-orange-600 to-fire hover:from-orange-500 hover:to-fire text-white px-8 py-4 rounded-2xl text-xs font-extrabold uppercase tracking-widest shadow-xl shadow-fire/30 transition-all hover:scale-105 active:scale-95 border border-fire/40"
                        >
                            <ShoppingBag size={18} />
                            Ver Todo el Menú y Pedir Virtualmente
                        </Link>
                    </div>
                </div>
            </div>

            <AnimatePresence>
                {selectedCategory && (
                    <SelectionModal
                        isOpen={!!selectedCategory}
                        onClose={() => setSelectedCategory(null)}
                        data={selectedCategory}
                    />
                )}
            </AnimatePresence>
        </section>
    );
};

export default MenuGrid;