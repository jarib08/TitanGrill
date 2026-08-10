import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabaseClient';
import { ShoppingBag, Search, Plus, Minus, Trash2, ArrowLeft, CheckCircle2, Flame, MapPin, Phone, User, MessageSquare, Utensils } from 'lucide-react';

const DEFAULT_MENU_PRODUCTS = [
    { id: '5d362b34-199b-4650-a323-b4c84a6d65e3', nombre: 'Burger Classic', categoria: 'Hamburguesas', precio: 14000, descripcion: '120g carne premium, pan artesanal de papa, tocineta, lechuga, cebolla caramelizada.', activo: true, imagen: '/menu/Hamburguesa.png' },
    { id: '4afe15e1-f6e0-49cf-9b93-140fc0a4722c', nombre: 'Perro Caliente', categoria: 'Perros', precio: 8000, descripcion: 'Pan artesanal, salchicha jumbo, papa ripia, salsa especial.', activo: true, imagen: '/menu/Perro-caliente.png' },
    { id: 'c44a88a3-41d2-4805-bf95-f30a52ead075', nombre: 'Salchipapa Sencilla', categoria: 'Salchipapas', precio: 13000, descripcion: 'Papas crujientes con salchicha premium y salsas de la casa.', activo: true, imagen: '/menu/salchipapa_sencilla.png' },
    { id: 'bfb5484b-e653-4f5d-afe3-74c82690114a', nombre: 'Salchipapa Especial', categoria: 'Salchipapas', precio: 18000, descripcion: 'Papas crujientes, doble salchicha, queso fundido, tocineta y maiz.', activo: true, imagen: '/menu/salchipapa_especial.png' },
    { id: '9a0c464c-b41b-44ee-a8b7-eab249a37ecb', nombre: 'Postobón Manzana', categoria: 'Bebidas', precio: 3000, descripcion: 'Gaseosa refrescante 400ml.', activo: true, imagen: '/menu/postobon_manzana.jpg' },
    { id: 'e3427c88-2818-4cfe-b74e-be1a1d950e87', nombre: 'Coca-Cola', categoria: 'Bebidas', precio: 3000, descripcion: 'Gaseosa original 400ml.', activo: true, imagen: '/menu/Cocacola.png' },
    { id: '96876900-ca5b-457a-9ade-bb8a5e998840', nombre: 'Cerezada', categoria: 'Bebidas', precio: 6000, descripcion: 'Limonada natural de cereza helada.', activo: true, imagen: '/menu/Cerezada.png' },
    { id: 'ee1f155f-a6bf-444c-81ee-5bd124d80506', nombre: 'Limonada', categoria: 'Bebidas', precio: 6000, descripcion: 'Limonada natural recién exprimida.', activo: true, imagen: '/menu/Limonada.png' }
];

const DigitalMenu = () => {
    const [products, setProducts] = useState(DEFAULT_MENU_PRODUCTS);
    const [loading, setLoading] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedCategory, setSelectedCategory] = useState('Todos');
    const [cart, setCart] = useState([]);
    const [showCartModal, setShowCartModal] = useState(false);

    // Checkout Form
    const [deliveryType, setDeliveryType] = useState('Domicilio'); // Domicilio, Para Llevar, En Mesa
    const [customerName, setCustomerName] = useState('');
    const [customerPhone, setCustomerPhone] = useState('');
    const [deliveryAddress, setDeliveryAddress] = useState('');
    const [orderNotes, setOrderNotes] = useState('');
    const [formError, setFormError] = useState('');

    // Business WhatsApp Phone Number (Colombia +57)
    const BUSINESS_WHATSAPP = '573012000092';

    useEffect(() => {
        fetchProducts();
    }, []);

    const fetchProducts = async () => {
        try {
            const { data, error } = await supabase
                .from('productos')
                .select('*');

            if (!error && data && data.length > 0) {
                const activeOnly = data
                    .filter(p => p.activo !== false)
                    .map(prod => {
                        if (!prod.imagen) {
                            const defaultMatch = DEFAULT_MENU_PRODUCTS.find(
                                d => d.nombre?.toLowerCase().trim() === prod.nombre?.toLowerCase().trim()
                            );
                            return { ...prod, imagen: defaultMatch?.imagen || null };
                        }
                        return prod;
                    });
                setProducts(activeOnly.length > 0 ? activeOnly : DEFAULT_MENU_PRODUCTS);
            } else {
                console.warn('Supabase query returned empty or error, using default menu catalog:', error);
                setProducts(DEFAULT_MENU_PRODUCTS);
            }
        } catch (err) {
            console.error('Error fetching menu products, using fallback catalog:', err);
            setProducts(DEFAULT_MENU_PRODUCTS);
        } finally {
            setLoading(false);
        }
    };

    // Categories (Dynamic from database)
    const rawCategories = Array.from(new Set(products.map(p => p.categoria).filter(Boolean)));
    const categories = ['Todos', ...rawCategories];

    // Filtered Products
    const filteredProducts = products.filter(p => {
        const matchesCategory = selectedCategory === 'Todos' ||
            (p.categoria && p.categoria.trim().toLowerCase() === selectedCategory.trim().toLowerCase());
        const matchesSearch = p.nombre.toLowerCase().includes(searchQuery.toLowerCase()) ||
            (p.descripcion && p.descripcion.toLowerCase().includes(searchQuery.toLowerCase()));
        return matchesCategory && matchesSearch;
    });

    // Cart Handlers
    const addToCart = (product) => {
        setCart(prev => {
            const existing = prev.find(item => item.id === product.id);
            if (existing) {
                return prev.map(item =>
                    item.id === product.id ? { ...item, quantity: item.quantity + 1 } : item
                );
            }
            return [...prev, { ...product, quantity: 1 }];
        });
    };

    const updateQuantity = (productId, delta) => {
        setCart(prev => {
            return prev.map(item => {
                if (item.id === productId) {
                    const newQty = item.quantity + delta;
                    return newQty > 0 ? { ...item, quantity: newQty } : null;
                }
                return item;
            }).filter(Boolean);
        });
    };

    const removeFromCart = (productId) => {
        setCart(prev => prev.filter(item => item.id !== productId));
    };

    const totalItemsCount = cart.reduce((sum, item) => sum + item.quantity, 0);
    const cartTotal = cart.reduce((sum, item) => sum + (Number(item.precio) * item.quantity), 0);

    // Send Order to WhatsApp
    const handleSendWhatsAppOrder = (e) => {
        e.preventDefault();
        setFormError('');

        if (!customerName.trim()) {
            setFormError('Por favor ingresa tu nombre completo.');
            return;
        }
        if (!customerPhone.trim()) {
            setFormError('Por favor ingresa tu número de teléfono / WhatsApp.');
            return;
        }
        if (!deliveryAddress.trim()) {
            setFormError(deliveryType === 'En Mesa' ? 'Por favor especifica el número de mesa.' : 'Por favor ingresa tu dirección de entrega.');
            return;
        }

        // Build WhatsApp Message
        let message = `🔥 *NUEVO PEDIDO - TITAN GRILL* 🔥\n`;
        message += `----------------------------------\n`;
        message += `👤 *Cliente:* ${customerName.trim()}\n`;
        message += `📞 *Teléfono:* ${customerPhone.trim()}\n`;
        message += `📍 *Modalidad:* ${deliveryType}\n`;
        message += `📌 *Ubicación/Mesa:* ${deliveryAddress.trim()}\n`;

        if (orderNotes.trim()) {
            message += `📝 *Notas:* ${orderNotes.trim()}\n`;
        }

        message += `----------------------------------\n`;
        message += `🛒 *DETALLE DEL PEDIDO:*\n`;

        cart.forEach((item, index) => {
            const itemTotal = Number(item.precio) * item.quantity;
            message += `${index + 1}. *${item.nombre}* x${item.quantity} -> $${itemTotal.toLocaleString()}\n`;
        });

        message += `----------------------------------\n`;
        message += `💰 *TOTAL A PAGAR:* $${cartTotal.toLocaleString()}\n`;
        message += `----------------------------------\n`;
        message += `¡Gracias por elegir Titan Grill! Por favor confirma la recepción de mi pedido.`;

        const encodedMessage = encodeURIComponent(message);
        const whatsappUrl = `https://wa.me/${BUSINESS_WHATSAPP}?text=${encodedMessage}`;

        window.open(whatsappUrl, '_blank');
    };

    return (
        <div className="min-h-screen bg-zinc-950 text-white font-sans pb-28">
            {/* Header / Banner */}
            <header className="bg-zinc-900 border-b border-zinc-800 sticky top-0 z-40 shadow-xl">
                <div className="max-w-md mx-auto px-4 py-3 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-fire rounded-2xl flex items-center justify-center text-white shadow-lg shadow-fire/20 font-bold">
                            <Flame size={22} />
                        </div>
                        <div>
                            <h1 className="text-base font-bold font-serif tracking-wider text-white">TITAN GRILL</h1>
                            <p className="text-[10px] text-zinc-400 font-bold uppercase tracking-widest flex items-center gap-1">
                                <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse"></span>
                                Menú Digital & Pedidos
                            </p>
                        </div>
                    </div>

                    <a
                        href="/"
                        className="text-xs font-bold text-zinc-400 hover:text-white bg-zinc-800 px-3 py-1.5 rounded-lg border border-zinc-700 transition-colors flex items-center gap-1"
                    >
                        <ArrowLeft size={14} />
                        Inicio
                    </a>
                </div>

                {/* Search Bar */}
                <div className="max-w-md mx-auto px-4 pb-3">
                    <div className="relative">
                        <input
                            type="text"
                            placeholder="Buscar en el menú (ej. Burger, Salchipapa)..."
                            className="w-full bg-zinc-950 border border-zinc-800 rounded-xl pl-10 pr-4 py-2.5 text-xs text-white placeholder-zinc-500 focus:border-fire outline-none transition-all"
                            value={searchQuery}
                            onChange={e => setSearchQuery(e.target.value)}
                        />
                        <Search size={16} className="absolute left-3.5 top-3 text-zinc-500" />
                    </div>
                </div>

                {/* Categories Horizontal Scroll */}
                <div className="max-w-md mx-auto px-4 pb-3 flex gap-2 overflow-x-auto no-scrollbar">
                    {categories.map(cat => (
                        <button
                            key={cat}
                            onClick={() => setSelectedCategory(cat)}
                            className={`px-4 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all ${selectedCategory === cat
                                    ? 'bg-fire text-white shadow-lg shadow-fire/20'
                                    : 'bg-zinc-950 border border-zinc-800 text-zinc-400 hover:text-white'
                                }`}
                        >
                            {cat}
                        </button>
                    ))}
                </div>
            </header>

            {/* Menu List Container */}
            <main className="max-w-md mx-auto px-4 pt-4 space-y-6">
                {loading ? (
                    <div className="py-20 text-center text-zinc-500 font-serif animate-pulse">
                        Cargando productos deliciosos...
                    </div>
                ) : filteredProducts.length === 0 ? (
                    <div className="py-16 text-center text-zinc-500 text-xs space-y-2">
                        <Utensils size={32} className="mx-auto text-zinc-700 mb-2" />
                        <p>No se encontraron productos en esta categoría.</p>
                    </div>
                ) : (
                    <div className="space-y-4">
                        {filteredProducts.map(prod => {
                            const cartItem = cart.find(i => i.id === prod.id);
                            return (
                                <div
                                    key={prod.id}
                                    className="bg-zinc-900 border border-zinc-800/80 rounded-2xl p-4 flex gap-4 items-center shadow-lg hover:border-zinc-700 transition-all"
                                >
                                    {/* Product Image / Icon */}
                                    <div className="w-20 h-20 bg-zinc-950 border border-zinc-800 rounded-xl shrink-0 flex items-center justify-center overflow-hidden relative">
                                        {prod.imagen ? (
                                            <img
                                                src={prod.imagen}
                                                alt={prod.nombre}
                                                className="w-full h-full object-cover"
                                                onError={(e) => {
                                                    const defaultMatch = DEFAULT_MENU_PRODUCTS.find(
                                                        d => d.nombre?.toLowerCase().trim() === prod.nombre?.toLowerCase().trim()
                                                    );
                                                    if (defaultMatch?.imagen && e.target.src !== window.location.origin + defaultMatch.imagen) {
                                                        e.target.src = defaultMatch.imagen;
                                                    } else {
                                                        e.target.onerror = null;
                                                        e.target.style.display = 'none';
                                                    }
                                                }}
                                            />
                                        ) : (
                                            <Flame size={28} className="text-fire/40" />
                                        )}
                                    </div>

                                    {/* Details */}
                                    <div className="flex-1 min-w-0 space-y-1">
                                        <div className="flex justify-between items-start">
                                            <h3 className="font-bold text-sm text-white truncate pr-2">{prod.nombre}</h3>
                                            <span className="text-xs font-extrabold text-fire shrink-0">${Number(prod.precio).toLocaleString()}</span>
                                        </div>
                                        <p className="text-[11px] text-zinc-400 line-clamp-2 leading-tight">
                                            {prod.descripcion || 'Especialidad Titan Grill con ingredientes seleccionados de alta calidad.'}
                                        </p>

                                        {/* Action Button / Counter */}
                                        <div className="pt-1 flex justify-end">
                                            {cartItem ? (
                                                <div className="flex items-center gap-2 bg-zinc-950 border border-fire/40 px-2 py-1 rounded-xl">
                                                    <button
                                                        onClick={() => updateQuantity(prod.id, -1)}
                                                        className="w-6 h-6 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-white flex items-center justify-center font-bold text-xs"
                                                    >
                                                        -
                                                    </button>
                                                    <span className="text-xs font-bold text-fire min-w-[16px] text-center">{cartItem.quantity}</span>
                                                    <button
                                                        onClick={() => updateQuantity(prod.id, 1)}
                                                        className="w-6 h-6 rounded-lg bg-fire hover:bg-orange-700 text-white flex items-center justify-center font-bold text-xs"
                                                    >
                                                        +
                                                    </button>
                                                </div>
                                            ) : (
                                                <button
                                                    onClick={() => addToCart(prod)}
                                                    className="bg-fire hover:bg-orange-700 text-white text-xs font-bold px-3 py-1.5 rounded-xl transition-all flex items-center gap-1 shadow-md shadow-fire/10 active:scale-95"
                                                >
                                                    <Plus size={14} />
                                                    Agregar
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </main>

            {/* Floating Cart Action Bar (FAB) */}
            {cart.length > 0 && (
                <div className="fixed bottom-0 left-0 right-0 p-4 z-50 bg-gradient-to-t from-zinc-950 via-zinc-950/90 to-transparent">
                    <div className="max-w-md mx-auto">
                        <button
                            onClick={() => setShowCartModal(true)}
                            className="w-full bg-gradient-to-r from-orange-600 to-fire text-white py-3.5 px-5 rounded-2xl font-bold flex items-center justify-between shadow-2xl shadow-fire/30 active:scale-[0.99] transition-all border border-fire/30"
                        >
                            <div className="flex items-center gap-3">
                                <div className="w-8 h-8 rounded-xl bg-black/20 flex items-center justify-center font-bold text-xs border border-white/20">
                                    {totalItemsCount}
                                </div>
                                <span className="text-sm uppercase tracking-wider">Ver Mi Pedido</span>
                            </div>
                            <span className="text-base font-extrabold">${cartTotal.toLocaleString()}</span>
                        </button>
                    </div>
                </div>
            )}

            {/* Cart & Checkout Modal / Drawer */}
            {showCartModal && (
                <div className="fixed inset-0 bg-black/85 flex items-end sm:items-center justify-center p-0 sm:p-4 z-[999] animate-fadeIn">
                    <div className="w-full max-w-md bg-zinc-900 border border-zinc-800 rounded-t-3xl sm:rounded-3xl p-6 shadow-2xl space-y-5 max-h-[90vh] flex flex-col">
                        {/* Header */}
                        <div className="flex justify-between items-center border-b border-zinc-800 pb-3">
                            <h2 className="text-lg font-bold font-serif text-white flex items-center gap-2">
                                <ShoppingBag className="text-fire" size={20} />
                                Tu Pedido ({totalItemsCount})
                            </h2>
                            <button onClick={() => setShowCartModal(false)} className="text-zinc-500 hover:text-white font-bold p-1">✕</button>
                        </div>

                        {/* Itemized List */}
                        <div className="flex-1 overflow-y-auto space-y-3 pr-1 max-h-[220px]">
                            {cart.map(item => (
                                <div key={item.id} className="bg-zinc-950 p-3 rounded-xl border border-zinc-850 flex justify-between items-center text-xs">
                                    <div className="space-y-0.5">
                                        <p className="font-bold text-zinc-200">{item.nombre}</p>
                                        <p className="text-zinc-500">${Number(item.precio).toLocaleString()} c/u</p>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <div className="flex items-center gap-1.5 bg-zinc-900 border border-zinc-800 px-2 py-1 rounded-lg">
                                            <button onClick={() => updateQuantity(item.id, -1)} className="w-5 h-5 bg-zinc-800 text-zinc-300 font-bold rounded flex items-center justify-center">-</button>
                                            <span className="font-bold text-white min-w-[14px] text-center">{item.quantity}</span>
                                            <button onClick={() => updateQuantity(item.id, 1)} className="w-5 h-5 bg-fire text-white font-bold rounded flex items-center justify-center">+</button>
                                        </div>
                                        <button onClick={() => removeFromCart(item.id)} className="text-zinc-600 hover:text-red-400 p-1">
                                            <Trash2 size={16} />
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>

                        {/* Form & Delivery Selection */}
                        <form onSubmit={handleSendWhatsAppOrder} className="space-y-3 border-t border-zinc-800 pt-3 text-xs">
                            <div>
                                <label className="text-[10px] font-bold uppercase text-zinc-400 block mb-1">Tipo de Entrega *</label>
                                <div className="grid grid-cols-3 gap-2">
                                    {[
                                        { id: 'Domicilio', icon: MapPin },
                                        { id: 'Para Llevar', icon: ShoppingBag },
                                        { id: 'En Mesa', icon: Utensils }
                                    ].map(type => {
                                        const IconComp = type.icon;
                                        return (
                                            <button
                                                key={type.id}
                                                type="button"
                                                onClick={() => setDeliveryType(type.id)}
                                                className={`py-2 rounded-xl border text-[11px] font-bold flex flex-col items-center gap-1 transition-all ${deliveryType === type.id
                                                        ? 'border-fire bg-fire/15 text-white shadow-md'
                                                        : 'border-zinc-800 bg-zinc-950 text-zinc-400 hover:text-white'
                                                    }`}
                                            >
                                                <IconComp size={14} />
                                                {type.id}
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-2">
                                <div>
                                    <label className="text-[10px] font-bold uppercase text-zinc-400 block mb-1">Tu Nombre *</label>
                                    <input
                                        type="text"
                                        className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-white outline-none focus:border-fire"
                                        placeholder="Ej. Juan Pérez"
                                        value={customerName}
                                        onChange={e => setCustomerName(e.target.value)}
                                    />
                                </div>
                                <div>
                                    <label className="text-[10px] font-bold uppercase text-zinc-400 block mb-1">Teléfono *</label>
                                    <input
                                        type="tel"
                                        className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-white outline-none focus:border-fire"
                                        placeholder="Ej. 3001234567"
                                        value={customerPhone}
                                        onChange={e => setCustomerPhone(e.target.value)}
                                    />
                                </div>
                            </div>

                            <div>
                                <label className="text-[10px] font-bold uppercase text-zinc-400 block mb-1">
                                    {deliveryType === 'En Mesa' ? 'Número de Mesa *' : 'Dirección de Entrega *'}
                                </label>
                                <input
                                    type="text"
                                    className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-white outline-none focus:border-fire"
                                    placeholder={deliveryType === 'En Mesa' ? 'Ej. Mesa 4' : 'Ej. Calle 10 # 5-20, Apto 301'}
                                    value={deliveryAddress}
                                    onChange={e => setDeliveryAddress(e.target.value)}
                                />
                            </div>

                            <div>
                                <label className="text-[10px] font-bold uppercase text-zinc-400 block mb-1">Notas Especiales</label>
                                <input
                                    type="text"
                                    className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-white outline-none focus:border-fire"
                                    placeholder="Ej. Sin cebolla, salsas aparte..."
                                    value={orderNotes}
                                    onChange={e => setOrderNotes(e.target.value)}
                                />
                            </div>

                            {formError && (
                                <div className="p-2 bg-red-500/10 border border-red-500/20 text-red-400 text-[11px] rounded text-center">
                                    {formError}
                                </div>
                            )}

                            <div className="pt-2 border-t border-zinc-800 flex justify-between items-center">
                                <div>
                                    <span className="text-[10px] text-zinc-500 block">Total a pagar:</span>
                                    <span className="text-lg font-extrabold text-fire">${cartTotal.toLocaleString()}</span>
                                </div>

                                <button
                                    type="submit"
                                    className="bg-gradient-to-r from-emerald-600 to-green-600 hover:from-emerald-500 hover:to-green-500 text-white font-bold px-5 py-3 rounded-xl text-xs uppercase tracking-wider shadow-lg shadow-green-950/40 transition-all flex items-center gap-2 active:scale-95"
                                >
                                    📲 Enviar por WhatsApp
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default DigitalMenu;
