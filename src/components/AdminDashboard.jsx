import React, { useEffect, useState } from 'react';
import { supabase } from '../lib/supabaseClient';
import { Users, Flame, Trophy, LogOut, ArrowRight, Award, Gift } from 'lucide-react';
import { useNavigate, Link } from 'react-router-dom';
import { ComposedChart, Area, Scatter, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

const AdminDashboard = () => {
    const navigate = useNavigate();
    const [stats, setStats] = useState({
        totalClients: 0,
        totalStamps: 0,
        pendingRewards: 0,
        totalRedemptions: 0
    });
    const [recentClients, setRecentClients] = useState([]);
    const [chartData, setChartData] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    const [searchResults, setSearchResults] = useState([]);
    const [isSearching, setIsSearching] = useState(false);


    const fetchDashboardData = async () => {
        try {
            // 1. Get Total Clients
            const { count: clientsCount } = await supabase
                .from('clientes')
                .select('*', { count: 'exact', head: true });

            // 2. Get All Clients for Stamp Calculation
            const { data: allClients } = await supabase
                .from('clientes')
                .select('stamps_count');

            const totalStamps = allClients?.reduce((acc, curr) => acc + (curr.stamps_count || 0), 0) || 0;
            const pendingRewards = allClients?.filter(c => c.stamps_count >= 10).length || 0;

            // 3. Get Total Redemptions
            const { count: redemptionsCount } = await supabase
                .from('redemptions')
                .select('*', { count: 'exact', head: true });

            setStats({
                totalClients: clientsCount || 0,
                totalStamps,
                pendingRewards,
                totalRedemptions: redemptionsCount || 0
            });

            // 4. Get Recent Clients
            const { data: recent } = await supabase
                .from('clientes')
                .select('*')
                .order('created_at', { ascending: false })
                .limit(10); // Increased limit for better table view

            setRecentClients(recent || []);

            // 5. Get Stamp History for Chart (last 30 days)
            const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

            const { data: stampLogs } = await supabase
                .from('stamp_logs')
                .select('created_at, clientes(nombre)')
                .gte('created_at', thirtyDaysAgo)
                .order('created_at', { ascending: true });

            const { data: redemptionLogs } = await supabase
                .from('redemptions')
                .select('redeemed_at, clientes(nombre)')
                .gte('redeemed_at', thirtyDaysAgo)
                .order('redeemed_at', { ascending: true });

            // Process logs into daily counts
            const dailyData = processChartData(stampLogs || [], redemptionLogs || []);
            setChartData(dailyData);

        } catch (error) {
            console.error("Dashboard Error:", error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchDashboardData();
    }, []);

    const processChartData = (stampLogs, redemptionLogs) => {
        const days = {};
        // Initialize last 7 days with 0
        for (let i = 6; i >= 0; i--) {
            const d = new Date();
            d.setDate(d.getDate() - i);
            const key = d.toLocaleDateString('es-ES', { day: '2-digit', month: 'short' });
            days[key] = { stamps: 0, redemptions: 0, stampCounts: {}, redeemNames: [] };
        }

        stampLogs.forEach(log => {
            const date = new Date(log.created_at).toLocaleDateString('es-ES', { day: '2-digit', month: 'short' });
            if (days[date]) {
                days[date].stamps++;
                const name = log.clientes?.nombre || 'Sin Nombre';
                days[date].stampCounts[name] = (days[date].stampCounts[name] || 0) + 1;
            }
        });

        redemptionLogs.forEach(log => {
            const date = new Date(log.redeemed_at).toLocaleDateString('es-ES', { day: '2-digit', month: 'short' });
            if (days[date]) {
                days[date].redemptions++;
                if (log.clientes?.nombre) {
                    days[date].redeemNames.push(log.clientes.nombre);
                }
            }
        });

        return Object.keys(days).map(date => ({
            name: date,
            stamps: days[date].stamps,
            redemptions: days[date].redemptions > 0 ? days[date].redemptions : null,
            stampList: Object.entries(days[date].stampCounts)
                .map(([name, count]) => `${name} (x${count})`)
                .join(', '),
            redeemList: [...new Set(days[date].redeemNames)].join(', ')
        }));
    };

    const CustomTooltip = ({ active, payload, label }) => {
        if (active && payload && payload.length) {
            const data = payload[0].payload;
            return (
                <div className="bg-zinc-900 border border-zinc-800 p-3 rounded-lg shadow-xl text-sm min-w-[150px]">
                    <p className="text-zinc-400 mb-2 font-bold border-b border-zinc-800 pb-1">{label}</p>

                    {/* Render basic stats */}
                    <div className="space-y-1">
                        {payload.map((entry, index) => {
                            // Hide the redundant 'name' key and null redemption points
                            if (entry.dataKey === 'name') return null;
                            if (entry.value === null) return null;
                            return (
                                <p key={index} className="flex justify-between gap-4" style={{ color: entry.color }}>
                                    <span className="font-medium">{entry.name}:</span>
                                    <span className="font-bold">{entry.value}</span>
                                </p>
                            );
                        })}
                    </div>

                    {data.stampList && (
                        <div className="mt-2 pt-2 border-t border-zinc-800">
                            <p className="text-fire text-[10px] font-bold uppercase tracking-wider mb-1">🔥 Sellos Entregados:</p>
                            <p className="text-zinc-300 text-xs italic">{data.stampList}</p>
                        </div>
                    )}

                    {data.redeemList && (
                        <div className="mt-2 pt-2 border-t border-zinc-800">
                            <p className="text-gold text-[10px] font-bold uppercase tracking-wider mb-1">🏆 Premios Canjeados:</p>
                            <p className="text-white text-xs italic font-medium">{data.redeemList}</p>
                        </div>
                    )}
                </div>
            );
        }
        return null;
    };

    const handleRedeem = async (clientId, currentStamps) => {
        if (!window.confirm(`¿Confirmar canje de premio ? Se descontarán 10 sellos.`)) return;

        try {
            const { data, error } = await supabase.rpc('redeem_reward', { client_id: clientId });

            if (error) throw error;

            if (data.success) {
                alert("¡Premio canjeado exitosamente! 🏆");
                // Refresh data
                fetchDashboardData();
                // If the client was in search results, refresh that too
                if (searchQuery) handleSearch(searchQuery);
            } else {
                alert("Error: " + data.message);
            }
        } catch (err) {
            console.error("Redemption Error:", err);
            alert("Error al procesar el canje.");
        }
    };

    const handleSearch = async (query) => {
        setSearchQuery(query);
        if (query.length < 3) {
            setSearchResults([]);
            return;
        }

        setIsSearching(true);
        try {
            const { data, error } = await supabase
                .from('clientes')
                .select('*')
                .ilike('celular', `%${query}%`)
                .limit(5);


            if (error) throw error;
            setSearchResults(data || []);
        } catch (err) {
            console.error("Search Error:", err);
        } finally {
            setIsSearching(false);
        }
    };


    const handleLogout = () => {
        sessionStorage.removeItem('titan_admin');
        navigate('/login');
    };

    if (loading) {
        return <div className="min-h-screen bg-black flex items-center justify-center text-fire animate-pulse">Cargando Tablero...</div>;
    }

    return (
        <div className="min-h-screen bg-black text-white p-6">
            <div className="max-w-6xl mx-auto">
                {/* Header */}
                <div className="flex justify-between items-center mb-10 border-b border-zinc-800 pb-6">
                    <div>
                        <h1 className="text-3xl font-serif text-white">Titan Dashboard</h1>
                        <p className="text-zinc-500 text-sm">Resumen de actividad y métricas</p>
                    </div>
                    <div className="flex items-center gap-4">
                        <button onClick={handleLogout} className="flex items-center gap-2 text-zinc-500 hover:text-red-500 transition-colors bg-zinc-900 px-4 py-2 rounded-lg">
                            <LogOut size={16} />
                            <span className="text-xs font-bold uppercase tracking-wider">Salir</span>
                        </button>
                    </div>
                </div>

                {/* KPI Grid */}
                <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-12">
                    {/* Total Clients */}
                    <div className="bg-zinc-900 border border-zinc-800 p-6 rounded-2xl relative overflow-hidden group hover:border-zinc-700 transition-colors">
                        <div className="absolute top-0 right-0 p-6 opacity-10 group-hover:opacity-20 transition-opacity">
                            <Users size={64} className="text-white" />
                        </div>
                        <p className="text-zinc-500 text-xs uppercase tracking-widest font-bold mb-2">Clientes</p>
                        <h3 className="text-4xl font-bold text-white">{stats.totalClients}</h3>
                        <div className="mt-4 text-xs text-zinc-400 bg-zinc-950/50 inline-block px-2 py-1 rounded">
                            Registrados Total
                        </div>
                    </div>

                    {/* Total Stamps */}
                    <div className="bg-zinc-900 border border-zinc-800 p-6 rounded-2xl relative overflow-hidden group hover:border-fire/50 transition-colors">
                        <div className="absolute top-0 right-0 p-6 opacity-10 group-hover:opacity-20 transition-opacity">
                            <Flame size={64} className="text-fire" />
                        </div>
                        <p className="text-fire text-xs uppercase tracking-widest font-bold mb-2">Fuego Generado</p>
                        <h3 className="text-4xl font-bold text-white">{stats.totalStamps}</h3>
                        <div className="mt-4 text-xs text-orange-200/50 bg-fire/10 inline-block px-2 py-1 rounded">
                            Sellos Totales
                        </div>
                    </div>

                    {/* Pending Rewards */}
                    <div className="bg-zinc-900 border border-zinc-800 p-6 rounded-2xl relative overflow-hidden group hover:border-gold/50 transition-colors">
                        <div className="absolute top-0 right-0 p-6 opacity-10 group-hover:opacity-20 transition-opacity">
                            <Trophy size={64} className="text-gold" />
                        </div>
                        <p className="text-gold text-xs uppercase tracking-widest font-bold mb-2">Premios Listos</p>
                        <h3 className="text-4xl font-bold text-white">{stats.pendingRewards}</h3>
                        <div className="mt-4 text-xs text-yellow-200/50 bg-gold/10 inline-block px-2 py-1 rounded">
                            Clientes con 10+
                        </div>
                    </div>

                    {/* Total Redemptions */}
                    <div className="bg-zinc-900 border border-zinc-800 p-6 rounded-2xl relative overflow-hidden group hover:border-blue-500/50 transition-colors">
                        <div className="absolute top-0 right-0 p-6 opacity-10 group-hover:opacity-20 transition-opacity">
                            <Gift size={64} className="text-blue-500" />
                        </div>
                        <p className="text-blue-500 text-xs uppercase tracking-widest font-bold mb-2">Canjeados</p>
                        <h3 className="text-4xl font-bold text-white">{stats.totalRedemptions}</h3>
                        <div className="mt-4 text-xs text-blue-200/50 bg-blue-500/10 inline-block px-2 py-1 rounded">
                            Premios Entregados
                        </div>
                    </div>
                </div>

                {/* Main Content Grid: Chart + Table */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">

                    {/* Chart Section */}
                    <div className="lg:col-span-3 bg-zinc-900 border border-zinc-800 rounded-2xl p-6 mb-8">
                        <h2 className="text-lg font-serif text-white mb-6 flex items-center gap-2">
                            <Flame size={20} className="text-fire" />
                            Actividad de Sellos (Últimos 7 días)
                        </h2>
                        <div className="h-[300px] w-full">
                            <ResponsiveContainer width="100%" height="100%">
                                <ComposedChart data={chartData}>
                                    <defs>
                                        <linearGradient id="colorFire" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="5%" stopColor="#ff4500" stopOpacity={0.3} />
                                            <stop offset="95%" stopColor="#ff4500" stopOpacity={0} />
                                        </linearGradient>
                                    </defs>
                                    <CartesianGrid strokeDasharray="3 3" stroke="#333" vertical={false} />
                                    <XAxis dataKey="name" stroke="#666" fontSize={12} tickLine={false} axisLine={false} />
                                    <YAxis stroke="#666" fontSize={12} tickLine={false} axisLine={false} />
                                    <Tooltip content={<CustomTooltip />} />
                                    <Area type="monotone" dataKey="stamps" stroke="#ff4500" fillOpacity={1} fill="url(#colorFire)" name="Sellos" />
                                    <Scatter name="Premios Canjeados" dataKey="redemptions" fill="#FFD700" shape="circle" r={6} />
                                </ComposedChart>
                            </ResponsiveContainer>
                        </div>
                    </div>

                    {/* Search Section */}
                    <div className="lg:col-span-3 bg-zinc-900 border border-zinc-800 rounded-2xl overflow-hidden mb-8">
                        <div className="p-6 border-b border-zinc-800 bg-zinc-950/30">
                            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                                <h2 className="text-lg font-serif text-white">Buscar Cliente</h2>
                                <div className="relative max-w-md w-full">
                                    <input
                                        type="text"
                                        placeholder="Buscar por teléfono..."
                                        className="w-full bg-black border border-zinc-800 rounded-xl px-4 py-2 text-sm text-white focus:border-fire outline-none transition-all pl-10"
                                        value={searchQuery}
                                        onChange={(e) => handleSearch(e.target.value)}
                                    />

                                    <div className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500">
                                        <Users size={16} />
                                    </div>
                                    {isSearching && (
                                        <div className="absolute right-3 top-1/2 -translate-y-1/2">
                                            <div className="w-4 h-4 border-2 border-fire border-t-transparent rounded-full animate-spin"></div>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>

                        {searchQuery.length >= 3 && (
                            <div className="divide-y divide-zinc-800 bg-zinc-900/50">
                                {searchResults.length > 0 ? (
                                    searchResults.map((client) => (
                                        <div key={client.id} className="p-4 flex items-center justify-between hover:bg-zinc-800/50 transition-colors group">
                                            <div className="flex items-center gap-4">
                                                <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-lg ${client.stamps_count >= 10 ? 'bg-gold text-black' : 'bg-zinc-800 text-zinc-400'}`}>
                                                    {client.nombre ? client.nombre.charAt(0).toUpperCase() : '?'}
                                                </div>
                                                <div>
                                                    <p className="text-white font-medium">{client.nombre || 'Sin Nombre'}</p>
                                                    <p className="text-zinc-500 text-xs">{client.celular || ''}</p>
                                                </div>

                                            </div>
                                            <div className="flex items-center gap-4">
                                                {client.stamps_count >= 10 && (
                                                    <button
                                                        onClick={() => handleRedeem(client.id, client.stamps_count)}
                                                        className="flex items-center gap-1 bg-gold text-black px-3 py-1.5 rounded-lg text-xs font-bold hover:bg-yellow-400 transition-colors"
                                                    >
                                                        <Award size={14} />
                                                        Canjear
                                                    </button>
                                                )}
                                                <div className="text-right">
                                                    <p className={`text-sm font-bold ${client.stamps_count >= 10 ? 'text-gold' : 'text-fire'}`}>
                                                        {client.stamps_count} <span className="text-xs font-normal text-zinc-500">Sellos</span>
                                                    </p>
                                                </div>
                                                <Link to={`/admin/client/${client.id}`} className="p-2 text-zinc-600 hover:text-white transition-colors">
                                                    <ArrowRight size={18} />
                                                </Link>
                                            </div>
                                        </div>
                                    ))
                                ) : (
                                    <div className="p-8 text-center text-zinc-500 text-sm">
                                        No se encontraron clientes con "{searchQuery}"
                                    </div>
                                )}
                            </div>
                        )}
                    </div>


                    {/* Table Section */}
                    <div className="lg:col-span-3 bg-zinc-900 border border-zinc-800 rounded-2xl overflow-hidden">
                        <div className="p-6 border-b border-zinc-800 flex justify-between items-center bg-zinc-950/30">
                            <h2 className="text-lg font-serif text-white">Clientes Recientes</h2>
                        </div>

                        <div className="divide-y divide-zinc-800">
                            {recentClients.length > 0 ? (
                                recentClients.map((client) => (
                                    <div key={client.id} className="p-4 flex items-center justify-between hover:bg-zinc-800/50 transition-colors group">
                                        <div className="flex items-center gap-4">
                                            <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-lg ${client.stamps_count >= 10 ? 'bg-gold text-black' : 'bg-zinc-800 text-zinc-400'}`}>
                                                {client.nombre ? client.nombre.charAt(0).toUpperCase() : '?'}
                                            </div>
                                            <div>
                                                <p className="text-white font-medium">{client.nombre || 'Sin Nombre'}</p>
                                                <p className="text-zinc-500 text-xs">{client.celular || ''}</p>
                                            </div>

                                        </div>

                                        <div className="flex items-center gap-4 md:gap-8">
                                            {/* Action Buttons - Redeem First */}
                                            {client.stamps_count >= 10 && (
                                                <button
                                                    onClick={() => handleRedeem(client.id, client.stamps_count)}
                                                    className="flex items-center gap-1 bg-gold text-black px-3 py-1.5 rounded-lg text-xs font-bold hover:bg-yellow-400 transition-colors animate-pulse"
                                                >
                                                    <Award size={14} />
                                                    Canjear
                                                </button>
                                            )}

                                            {/* Stamps Count */}
                                            <div className="text-right">
                                                <p className={`text-sm font-bold ${client.stamps_count >= 10 ? 'text-gold' : 'text-fire'}`}>
                                                    {client.stamps_count} <span className="text-xs font-normal text-zinc-500">Sellos</span>
                                                </p>
                                            </div>

                                            {/* Detail Link */}
                                            <Link to={`/admin/client/${client.id}`} className="p-2 text-zinc-600 hover:text-white transition-colors" title="Ver Detalle">
                                                <ArrowRight size={18} />
                                            </Link>
                                        </div>
                                    </div>
                                ))
                            ) : (
                                <div className="p-8 text-center text-zinc-500 text-sm">
                                    No hay clientes registrados aún.
                                </div>
                            )}
                        </div>
                    </div>

                </div>

            </div>
        </div>
    );
};

export default AdminDashboard;
