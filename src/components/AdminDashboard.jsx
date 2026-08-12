import React, { useEffect, useState } from 'react';
import { supabase } from '../lib/supabaseClient';
import { Users, Flame, Trophy, LogOut, ArrowRight, Award, Gift, DollarSign, Settings, ShoppingBag, Menu, X, Check, ShieldAlert, UtensilsCrossed, Plus, Pencil, PackageCheck, PackageX, Archive, ClipboardList, Trash2, Truck, FileText, Calendar, Filter, ShoppingCart, Package, AlertTriangle, Clock, TrendingUp, PiggyBank, Star, BarChart3, Search, Receipt } from 'lucide-react';
import { useNavigate, Link } from 'react-router-dom';
import { ComposedChart, Area, Scatter, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar, PieChart, Pie, Cell, LineChart, Line, Legend } from 'recharts';
import { BottomSheet } from './ui/BottomSheet.jsx';
import { SectionHeader } from './ui/SectionHeader.jsx';
import { ErrorBanner } from './ui/ErrorBanner.jsx';
import Pagination from './ui/Pagination.jsx';

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

    // Navigation and Role-based states
    const [activeTab, setActiveTab] = useState('dashboard');
    const [currentUserProfile, setCurrentUserProfile] = useState(null);
    const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

    // List states
    const [salesList, setSalesList] = useState([]);
    const [movementsList, setMovementsList] = useState([]);
    const [staffList, setStaffList] = useState([]);

    // Productos / Menu states
    const [productosList, setProductosList] = useState([]);
    const [productosLoading, setProductosLoading] = useState(false);
    const [editingProducto, setEditingProducto] = useState(null); // null = form hidden
    const [productoForm, setProductoForm] = useState({ nombre: '', descripcion: '', precio: '', categoria: '', activo: true, orden: 0, imagen: '' });
    const [productoSaving, setProductoSaving] = useState(false);

    // Action loading states
    const [actionLoading, setActionLoading] = useState(false);

    // Date range filter for reports
    const [dateRange, setDateRange] = useState('7d');
    const [customStartDate, setCustomStartDate] = useState('');
    const [customEndDate, setCustomEndDate] = useState('');
    const [metricsLoading, setMetricsLoading] = useState(false);

    // Report data states
    const [salesKPIs, setSalesKPIs] = useState(null);
    const [salesByDayData, setSalesByDayData] = useState([]);
    const [paymentMethodData, setPaymentMethodData] = useState([]);
    const [topProductsData, setTopProductsData] = useState([]);
    const [staffSalesData, setStaffSalesData] = useState([]);
    const [ticketByDayData, setTicketByDayData] = useState([]);
    const [inventoryStats, setInventoryStats] = useState(null);
    const [lowStockList, setLowStockList] = useState([]);
    const [outOfStockList, setOutOfStockList] = useState([]);
    const [consumptionData, setConsumptionData] = useState([]);
    const [loyaltyPeriodStats, setLoyaltyPeriodStats] = useState(null);
    const [cashStats, setCashStats] = useState(null);
    const [sessionsStats, setSessionsStats] = useState(null);
    const [sessionsList, setSessionsList] = useState([]);
    const [purchaseStats, setPurchaseStats] = useState(null);

    // Inventario / Insumos / Recetas states
    const [insumosList, setInsumosList] = useState([]);
    const [recetasList, setRecetasList] = useState([]);
    const [inventarioLoading, setInventarioLoading] = useState(false);
    const [editingInsumo, setEditingInsumo] = useState(null); // null, 'new', or id
    const [insumoForm, setInsumoForm] = useState({ nombre: '', unidad_medida: 'unidad', stock_actual: 0, stock_minimo: 0, activo: true, costo_unitario: 0 });
    const [_editingReceta, setEditingReceta] = useState(null); // null, 'new', or id
    const [recetaForm, setRecetaForm] = useState({ producto_id: '', insumo_id: '', cantidad_por_unidad: 1 });
    const [insumoSaving, setInsumoSaving] = useState(false);
    const [recetaSaving, setRecetaSaving] = useState(false);
    const [showAjusteModal, setShowAjusteModal] = useState(null); // insumo object
    const [ajusteForm, setAjusteForm] = useState({ tipo: 'AJUSTE', cantidad: 0, motivo: '' });
    const [showCargaMasivaModal, setShowCargaMasivaModal] = useState(false);
    const [cargaMasivaForm, setCargaMasivaForm] = useState({});
    const [cargaMasivaMotivo, setCargaMasivaMotivo] = useState('Toma Física / Carga de Stock Inicial');
    const [cargaMasivaSaving, setCargaMasivaSaving] = useState(false);

    // Merma directa (trabajador y admin)
    const [showMermaModal, setShowMermaModal] = useState(null); // insumo object
    const [mermaForm, setMermaForm] = useState({ cantidad: '', motivo: '', advertencia: false });
    const [mermaSaving, setMermaSaving] = useState(false);

    // Inventario UX — búsqueda, filtros, detalle
    const [insumoSearch, setInsumoSearch] = useState('');
    const [insumoFilter, setInsumoFilter] = useState('todos'); // 'todos' | 'bajos' | 'agotados'
    const [showInsumoDetalle, setShowInsumoDetalle] = useState(null); // insumo object
    const [insumoDetalleMovs, setInsumoDetalleMovs] = useState([]);
    const [insumoDetalleLoading, setInsumoDetalleLoading] = useState(false);

    // Compras / Proveedores states
    const [proveedoresList, setProveedoresList] = useState([]);
    const [comprasList, setComprasList] = useState([]);
    const [comprasLoading, setComprasLoading] = useState(false);
    const [editingProveedor, setEditingProveedor] = useState(null); // null, 'new', or id
    const [proveedorForm, setProveedorForm] = useState({ nombre: '', telefono: '', contacto: '', activo: true });
    const [editingCompra, setEditingCompra] = useState(null); // null or 'new'
    const [compraForm, setCompraForm] = useState({ proveedor_id: '', observaciones: '', details: [], metodo_pago: 'EFECTIVO' });
    const [selectedDetail, setSelectedDetail] = useState({ insumo_id: '', cantidad: 1, costo_unitario: 0 });
    const [compraInsumoSearch, setCompraInsumoSearch] = useState(''); // P0: búsqueda de insumo en compras
    const [showAnularModal, setShowAnularModal] = useState(null); // compra object
    const [anularMotivo, setAnularMotivo] = useState('');
    // F6-05: modal de recepción con selector de método de pago
    const [showRecibirModal, setShowRecibirModal] = useState(null); // compra object or null
    const [recibirMetodoPago, setRecibirMetodoPago] = useState('EFECTIVO');
    const [topStampClients, setTopStampClients] = useState([]);

    // Liquidaciones & Rentabilidad states
    const [liquidacionesList, setLiquidacionesList] = useState([]);
    const [cogsTotal, setCogsTotal] = useState(0);
    const [showGenerarLiqModal, setShowGenerarLiqModal] = useState(false);
    const [selectedWorkerForLiq, setSelectedWorkerForLiq] = useState(null);
    const [liqMontoForm, setLiqMontoForm] = useState(0);
    const [liqModalidadForm, setLiqModalidadForm] = useState('POR_TURNO');
    const [liqObsForm, setLiqObsForm] = useState('');
    const [showAnularLiqModal, setShowAnularLiqModal] = useState(null); // Liquidacion object or null
    const [anularLiqMotivo, setAnularLiqMotivo] = useState('');

    // Error states
    const [fetchError, setFetchError] = useState(null);

    // ── Fase 6.3: Paginación ─────────────────────────────────────────────────
    const PAGE_SIZE = 20;

    // Ventas — estado paginado independiente
    const [ventasPage, setVentasPage]       = useState(0);
    const [ventasPageData, setVentasPageData] = useState([]);
    const [ventasTotal, setVentasTotal]     = useState(0);
    const [ventasLoading, setVentasLoading] = useState(false);
    const [ventasError, setVentasError]     = useState(null);

    // Caja — estado paginado independiente (movementsList sigue siendo global para KPIs)
    const [movementsPage, setMovementsPage]       = useState(0);
    const [movementsPageData, setMovementsPageData] = useState([]);
    const [movementsTotal, setMovementsTotal]     = useState(0);
    const [movementsLoading, setMovementsLoading] = useState(false);
    const [movementsError, setMovementsError]     = useState(null);

    // Liquidaciones — estado paginado independiente (liquidacionesList sigue siendo global para KPIs)
    const [liqPage, setLiqPage]         = useState(0);
    const [liqPageData, setLiqPageData] = useState([]);
    const [liqTotal, setLiqTotal]       = useState(0);
    const [liqLoading, setLiqLoading]   = useState(false);
    const [liqError, setLiqError]       = useState(null);

    // Gastos — estado paginado independiente y variables del formulario
    const [gastosPage, setGastosPage] = useState(0);
    const [gastosPageData, setGastosPageData] = useState([]);
    const [gastosTotal, setGastosTotal] = useState(0);
    const [gastosLoading, setGastosLoading] = useState(false);
    const [gastosError, setGastosError] = useState(null);
    const [gastosList, setGastosList] = useState([]); // global for KPIs
    const [categoriasGastosList, setCategoriasGastosList] = useState([]);
    const [showNewGastoModal, setShowNewGastoModal] = useState(false);
    const [gastoForm, setGastoForm] = useState({ categoria_id: '', descripcion: '', monto: '', metodo_pago: 'EFECTIVO' });
    const [showNewCategoriaModal, setShowNewCategoriaModal] = useState(false);
    const [categoriaForm, setCategoriaForm] = useState({ nombre: '', activo: true });
    const [showAnularGastoModal, setShowAnularGastoModal] = useState(null); // Gasto object or null
    const [anularGastoMotivo, setAnularGastoMotivo] = useState('');
    // ─────────────────────────────────────────────────────────────────────────

    const fetchDashboardData = async () => {
        try {
            const { data: { session } } = await supabase.auth.getSession();
            if (session?.user) {
                // Fetch logged-in user profile details
                const { data: profile } = await supabase
                    .from('perfiles_trabajadores')
                    .select('*')
                    .eq('id', session.user.id)
                    .single();
                setCurrentUserProfile(profile);
            }

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
                .limit(10);

            setRecentClients(recent || []);

            // 4b. Get Top Clients by Stamps
            const { data: topClients } = await supabase
                .from('clientes')
                .select('id, nombre, celular, stamps_count')
                .order('stamps_count', { ascending: false })
                .limit(10);

            setTopStampClients(topClients || []);

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

            const dailyData = processChartData(stampLogs || [], redemptionLogs || []);
            setChartData(dailyData);

            // 6. Fetch Sales list
            const { data: sales } = await supabase
                .from('ventas')
                .select('*, perfiles_trabajadores(nombre), clientes(nombre)')
                .order('fecha', { ascending: false });
            setSalesList(sales || []);

            // 7. Fetch Cash Movements list
            const { data: movements } = await supabase
                .from('movimientos_caja')
                .select('*, perfiles_trabajadores(nombre)')
                .order('fecha', { ascending: false });
            setMovementsList(movements || []);

            // 8. Fetch Staff list
            const { data: staff } = await supabase
                .from('perfiles_trabajadores')
                .select('*')
                .order('created_at', { ascending: false });
            setStaffList(staff || []);

            // 9. Fetch Liquidaciones
            const { data: liqs } = await supabase
                .from('liquidaciones')
                .select('*, perfiles_trabajadores(nombre, email, rol, modalidad_pago, tarifa_pago)')
                .order('fecha', { ascending: false });
            setLiquidacionesList(liqs || []);

            // 11. Fetch Gastos List (global for KPIs)
            const { data: expenses } = await supabase
                .from('gastos')
                .select('*, categorias_gastos(nombre)')
                .order('fecha', { ascending: false });
            setGastosList(expenses || []);

            // 10. Fetch COGS (Cost of Sales)
            const { data: saleMovements } = await supabase
                .from('movimientos_inventario')
                .select('cantidad, insumos(costo_unitario)')
                .eq('tipo', 'VENTA');

            const totalCogs = saleMovements?.reduce((sum, m) => {
                const qty = Math.abs(Number(m.cantidad || 0));
                const unitCost = Number(m.insumos?.costo_unitario || 0);
                return sum + (qty * unitCost);
            }, 0) || 0;
            setCogsTotal(totalCogs);

        } catch (error) {
            console.error("Dashboard Error:", error);
            setFetchError(error?.message || 'No se pudo conectar con el servidor.');
        } finally {
            setLoading(false);
        }
    };

    // ── Fase 6.3: Fetch paginado independiente ──────────────────────────────

    const fetchVentas = async (page = 0) => {
        setVentasLoading(true);
        setVentasError(null);
        try {
            const from = page * PAGE_SIZE;
            const to = from + PAGE_SIZE - 1;
            const { data, count, error } = await supabase
                .from('ventas')
                .select('id, fecha, total, metodo_pago, perfiles_trabajadores(nombre), clientes(nombre)', { count: 'exact' })
                .order('fecha', { ascending: false })
                .range(from, to);
            if (error) throw error;
            setVentasPageData(data || []);
            setVentasTotal(count || 0);
            setVentasPage(page);
        } catch (err) {
            setVentasError(err.message || 'Error al cargar ventas.');
        } finally {
            setVentasLoading(false);
        }
    };

    const fetchMovementsPage = async (page = 0) => {
        setMovementsLoading(true);
        setMovementsError(null);
        try {
            const from = page * PAGE_SIZE;
            const to = from + PAGE_SIZE - 1;
            const { data, count, error } = await supabase
                .from('movimientos_caja')
                .select('id, fecha, tipo, metodo_pago, descripcion, monto, perfiles_trabajadores(nombre)', { count: 'exact' })
                .order('fecha', { ascending: false })
                .range(from, to);
            if (error) throw error;
            setMovementsPageData(data || []);
            setMovementsTotal(count || 0);
            setMovementsPage(page);
        } catch (err) {
            setMovementsError(err.message || 'Error al cargar movimientos.');
        } finally {
            setMovementsLoading(false);
        }
    };

    const fetchCategoriasGastos = async () => {
        try {
            const { data, error } = await supabase
                .from('categorias_gastos')
                .select('*')
                .order('nombre', { ascending: true });
            if (error) throw error;
            setCategoriasGastosList(data || []);
        } catch (err) {
            console.error('Error fetching categories:', err);
        }
    };

    const fetchGastosPage = async (page = 0) => {
        setGastosLoading(true);
        setGastosError(null);
        try {
            const from = page * PAGE_SIZE;
            const to = from + PAGE_SIZE - 1;
            const { data, count, error } = await supabase
                .from('gastos')
                .select('id, fecha, descripcion, monto, metodo_pago, estado, created_by, categorias_gastos(nombre), perfiles_trabajadores(nombre)', { count: 'exact' })
                .order('fecha', { ascending: false })
                .range(from, to);
            if (error) throw error;
            setGastosPageData(data || []);
            setGastosTotal(count || 0);
            setGastosPage(page);
        } catch (err) {
            setGastosError(err.message || 'Error al cargar gastos.');
        } finally {
            setGastosLoading(false);
        }
    };

    const fetchLiqPage = async (page = 0) => {
        setLiqLoading(true);
        setLiqError(null);
        try {
            const from = page * PAGE_SIZE;
            const to = from + PAGE_SIZE - 1;
            const { data, count, error } = await supabase
                .from('liquidaciones')
                .select('id, fecha, modalidad, monto_calculado, estado, cuenta_pago, perfiles_trabajadores(nombre)', { count: 'exact' })
                .order('fecha', { ascending: false })
                .range(from, to);
            if (error) throw error;
            setLiqPageData(data || []);
            setLiqTotal(count || 0);
            setLiqPage(page);
        } catch (err) {
            setLiqError(err.message || 'Error al cargar liquidaciones.');
        } finally {
            setLiqLoading(false);
        }
    };
    // ────────────────────────────────────────────────────────────────────────

    useEffect(() => {
        fetchDashboardData();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    useEffect(() => {
        fetchDashboardMetrics();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [dateRange, customStartDate, customEndDate]);

    useEffect(() => {
        if (activeTab === 'productos') {
            fetchProductos();
        } else if (activeTab === 'inventario') {
            fetchInventario();
            fetchProductos();
        } else if (activeTab === 'compras') {
            fetchProveedores();
            fetchCompras();
            fetchInventario(); // to load insumos list
        } else if (activeTab === 'ventas') {
            fetchVentas(0); // Fase 6.3 — carga página 0 al entrar al tab
        } else if (activeTab === 'caja') {
            fetchMovementsPage(0); // Fase 6.3 — carga página 0 al entrar al tab
        } else if (activeTab === 'liquidaciones') {
            fetchLiqPage(0); // Fase 6.3 — carga página 0 al entrar al tab
        } else if (activeTab === 'gastos') {
            fetchCategoriasGastos();
            fetchGastosPage(0);
        }
    }, [activeTab]);

    const processChartData = (stampLogs, redemptionLogs) => {
        const days = {};
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
                    <div className="space-y-1">
                        {payload.map((entry, index) => {
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

    const handleRedeem = async (clientId, _currentStamps) => {
        if (!window.confirm(`¿Confirmar canje de premio ? Se descontarán 10 sellos.`)) return;

        try {
            const { data, error } = await supabase.rpc('redeem_reward', { client_id: clientId });

            if (error) throw error;

            if (data.success) {
                alert("¡Premio canjeado exitosamente! 🏆");
                fetchDashboardData();
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

    // Toggle staff active/inactive state (socio only)
    const handleToggleStaffStatus = async (staffMember) => {
        if (!currentUserProfile?.es_socio) {
            alert('Acceso restringido: Solo los socios administradores pueden modificar perfiles.');
            return;
        }

        const newStatus = staffMember.estado === 'ACTIVO' ? 'INACTIVO' : 'ACTIVO';
        if (!window.confirm(`¿Confirmar cambio de estado de ${staffMember.nombre} a ${newStatus}?`)) return;

        setActionLoading(true);
        try {
            const { error } = await supabase
                .from('perfiles_trabajadores')
                .update({ estado: newStatus, updated_at: new Date().toISOString() })
                .eq('id', staffMember.id);

            if (error) throw error;
            alert(`Estado actualizado con éxito.`);
            fetchDashboardData();
        } catch (err) {
            console.error(err);
            alert('Error al actualizar el perfil.');
        } finally {
            setActionLoading(false);
        }
    };

    // Toggle staff role (socio only)
    const handleToggleStaffRole = async (staffMember) => {
        if (!currentUserProfile?.es_socio) {
            alert('Acceso restringido: Solo los socios administradores pueden modificar perfiles.');
            return;
        }

        const newRole = staffMember.rol === 'ADMINISTRADOR' ? 'TRABAJADOR' : 'ADMINISTRADOR';
        if (!window.confirm(`¿Confirmar cambio de rol de ${staffMember.nombre} a ${newRole}?`)) return;

        setActionLoading(true);
        try {
            const { error } = await supabase
                .from('perfiles_trabajadores')
                .update({ rol: newRole, updated_at: new Date().toISOString() })
                .eq('id', staffMember.id);

            if (error) throw error;
            alert(`Rol actualizado con éxito.`);
            fetchDashboardData();
        } catch (err) {
            console.error(err);
            alert('Error al actualizar el perfil.');
        } finally {
            setActionLoading(false);
        }
    };

    const handleLogout = () => {
        sessionStorage.clear();
        navigate('/login');
    };

    // ---- Dashboard Reports helpers ----

    const CHART_COLORS = ['#ff4500', '#d4af37', '#fbbf24', '#f59e0b', '#10b981', '#3b82f6', '#8b5cf6', '#ec4899'];

    const getDateRange = () => {
        const now = new Date();
        const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        let start, end;

        switch (dateRange) {
            case 'today':
                start = todayStart;
                end = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
                break;
            case 'yesterday':
                start = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1);
                end = todayStart;
                break;
            case '7d':
                start = new Date(now.getTime() - 6 * 24 * 60 * 60 * 1000);
                end = now;
                break;
            case '30d':
                start = new Date(now.getTime() - 29 * 24 * 60 * 60 * 1000);
                end = now;
                break;
            case 'month':
                start = new Date(now.getFullYear(), now.getMonth(), 1);
                end = now;
                break;
            case 'custom':
                start = customStartDate ? new Date(customStartDate) : new Date(now.getTime() - 6 * 24 * 60 * 60 * 1000);
                end = customEndDate ? new Date(customEndDate + 'T23:59:59') : now;
                break;
            default:
                start = new Date(now.getTime() - 6 * 24 * 60 * 60 * 1000);
                end = now;
        }

        return { start: start.toISOString(), end: end.toISOString() };
    };

    const fetchDashboardMetrics = async () => {
        setMetricsLoading(true);
        const { start, end } = getDateRange();

        try {
            const results = await Promise.allSettled([
                supabase.from('ventas')
                    .select('*, perfiles_trabajadores(nombre), clientes(nombre)')
                    .gte('fecha', start)
                    .lte('fecha', end)
                    .order('fecha', { ascending: true }),

                supabase.from('insumos').select('*').order('nombre', { ascending: true }),

                supabase.from('compra_detalles')
                    .select('insumo_id, costo_unitario, cantidad, insumos(nombre)'),

                supabase.from('stamp_logs')
                    .select('created_at, clientes(nombre)')
                    .gte('created_at', start)
                    .lte('created_at', end),

                supabase.from('redemptions')
                    .select('redeemed_at, clientes(nombre)')
                    .gte('redeemed_at', start)
                    .lte('redeemed_at', end),

                supabase.from('movimientos_caja')
                    .select('*, perfiles_trabajadores(nombre)')
                    .gte('fecha', start)
                    .lte('fecha', end)
                    .order('fecha', { ascending: false }),

                supabase.from('compras')
                    .select('total, fecha, estado')
                    .gte('fecha', start)
                    .lte('fecha', end),

                supabase.from('sesiones_caja')
                    .select('*, perfiles_trabajadores(nombre)')
                    .gte('fecha_apertura', start)
                    .lte('fecha_apertura', end)
                    .order('fecha_apertura', { ascending: false })
            ]);

            const getResData = (r) => r.status === 'rejected' || r.value?.error ? [] : (r.value?.data || []);

            // --- Sales processing ---
            const ventasData = getResData(results[0]);
            const totalVentas = ventasData.reduce((sum, v) => sum + Number(v.total || 0), 0);
            const numVentas = ventasData.length;
            const ticketPromedio = numVentas > 0 ? totalVentas / numVentas : 0;
            const clientesAtendidos = ventasData.filter(v => v.cliente_id).length;

            const paymentBreakdown = {};
            const salesByDayMap = {};
            const staffSalesMap = {};
            const ticketByDayMap = {};
            const countByDayMap = {};
            const productSalesMap = {};

            ventasData.forEach(v => {
                const day = new Date(v.fecha).toLocaleDateString('es-ES', { day: '2-digit', month: 'short' });
                const total = Number(v.total || 0);
                const method = v.metodo_pago || 'DESCONOCIDO';
                const staff = v.perfiles_trabajadores?.nombre || 'Desconocido';

                paymentBreakdown[method] = (paymentBreakdown[method] || 0) + total;
                salesByDayMap[day] = (salesByDayMap[day] || 0) + total;
                staffSalesMap[staff] = (staffSalesMap[staff] || 0) + total;
                ticketByDayMap[day] = (ticketByDayMap[day] || 0) + total;
                countByDayMap[day] = (countByDayMap[day] || 0) + 1;

                const detalles = v.detalles;
                if (detalles && detalles.items) {
                    detalles.items.forEach(item => {
                        const productName = item.nombre || item.name || 'Desconocido';
                        productSalesMap[productName] = (productSalesMap[productName] || 0) + Number(item.quantity || 1);
                    });
                }
            });

            setSalesKPIs({ totalVentas, numVentas, ticketPromedio, clientesAtendidos });
            setSalesByDayData(Object.entries(salesByDayMap).map(([name, value]) => ({ name, value })));
            setPaymentMethodData(Object.entries(paymentBreakdown).map(([name, value]) => ({ name, value })));
            setTopProductsData(Object.entries(productSalesMap).map(([name, quantity]) => ({ name, quantity })).sort((a, b) => b.quantity - a.quantity).slice(0, 8));
            setStaffSalesData(Object.entries(staffSalesMap).map(([name, total]) => ({ name, total })).sort((a, b) => b.total - a.total));
            setTicketByDayData(Object.keys(ticketByDayMap).map(day => ({ name: day, value: Math.round(ticketByDayMap[day] / countByDayMap[day]) })));

            // --- Inventory processing ---
            const insumos = getResData(results[1]);
            const lowStock = insumos.filter(i => Number(i.stock_actual) <= Number(i.stock_minimo) && Number(i.stock_actual) > 0);
            const outOfStock = insumos.filter(i => Number(i.stock_actual) === 0);
            setLowStockList(lowStock);
            setOutOfStockList(outOfStock);

            const purchaseDetails = getResData(results[2]);
            const latestCostByInsumo = {};
            purchaseDetails.forEach(d => {
                if (!latestCostByInsumo[d.insumo_id]) {
                    latestCostByInsumo[d.insumo_id] = Number(d.costo_unitario || 0);
                }
            });
            const inventoryValue = insumos.reduce((total, ins) => {
                const cost = latestCostByInsumo[ins.id] || 0;
                return total + (Number(ins.stock_actual) || 0) * cost;
            }, 0);
            setInventoryStats({ lowStock: lowStock.length, outOfStock: outOfStock.length, totalValue: inventoryValue, totalInsumos: insumos.length });

            const consumptionMap = {};
            purchaseDetails.forEach(d => {
                const name = d.insumos?.nombre || 'Desconocido';
                consumptionMap[name] = (consumptionMap[name] || 0) + Number(d.cantidad || 0);
            });
            setConsumptionData(Object.entries(consumptionMap).map(([name, cantidad]) => ({ name, cantidad })).sort((a, b) => b.cantidad - a.cantidad).slice(0, 8));

            // --- Loyalty processing ---
            setLoyaltyPeriodStats({
                stampsIssued: getResData(results[3]).length || 0,
                redemptions: getResData(results[4]).length || 0
            });

            // --- Cash processing ---
            const movimientos = getResData(results[5]);
            const totalIngresos = movimientos.filter(m => m.tipo === 'INGRESO').reduce((sum, m) => sum + Number(m.monto || 0), 0);
            const totalEgresos = movimientos.filter(m => m.tipo === 'EGRESO').reduce((sum, m) => sum + Number(m.monto || 0), 0);
            const efectivoIngresos = movimientos.filter(m => m.tipo === 'INGRESO' && m.metodo_pago === 'EFECTIVO').reduce((sum, m) => sum + Number(m.monto || 0), 0);
            const efectivoEgresos = movimientos.filter(m => m.tipo === 'EGRESO' && m.metodo_pago === 'EFECTIVO').reduce((sum, m) => sum + Number(m.monto || 0), 0);
            const nequiIngresos = movimientos.filter(m => m.tipo === 'INGRESO' && m.metodo_pago === 'NEQUI').reduce((sum, m) => sum + Number(m.monto || 0), 0);
            const bancolombiaIngresos = movimientos.filter(m => m.tipo === 'INGRESO' && m.metodo_pago === 'BANCOLOMBIA').reduce((sum, m) => sum + Number(m.monto || 0), 0);
            const otrosIngresos = movimientos.filter(m => m.tipo === 'INGRESO' && m.metodo_pago !== 'EFECTIVO').reduce((sum, m) => sum + Number(m.monto || 0), 0);
            const otrosEgresos = movimientos.filter(m => m.tipo === 'EGRESO' && m.metodo_pago !== 'EFECTIVO').reduce((sum, m) => sum + Number(m.monto || 0), 0);

            setCashStats({
                totalIngresos,
                totalEgresos,
                netCash: totalIngresos - totalEgresos,
                efectivoIngresos,
                efectivoEgresos,
                efectivoNeto: efectivoIngresos - efectivoEgresos,
                nequiIngresos,
                bancolombiaIngresos,
                otrosIngresos,
                otrosEgresos,
                otrosNeto: otrosIngresos - otrosEgresos,
                totalMovements: movimientos.length,
                efectivoBruto: efectivoIngresos,
                egresoBruto: efectivoEgresos
            });

            // --- Purchases processing ---
            const compras = getResData(results[6]);
            setPurchaseStats({
                totalCompras: compras.length,
                totalAmount: compras.reduce((sum, c) => sum + Number(c.total || 0), 0),
                received: compras.filter(c => c.estado === 'RECIBIDA').length,
                draft: compras.filter(c => c.estado === 'BORRADOR').length
            });

            // --- Sessions processing ---
            const sesiones = getResData(results[7]);
            const openCount = sesiones.filter(s => s.estado === 'ABIERTA').length;
            const closedSessions = sesiones.filter(s => s.estado === 'CERRADA');
            setSessionsList(sesiones);
            setSessionsStats({
                openCount,
                closedCount: closedSessions.length,
                totalSessions: sesiones.length,
                totalApertura: sesiones.reduce((sum, s) => sum + Number(s.monto_apertura || 0), 0),
                arqueoDiferencias: closedSessions.reduce((sum, s) => sum + Number(s.diferencia || 0), 0)
            });

        } catch (error) {
            console.error("Dashboard Metrics Error:", error);
        } finally {
            setMetricsLoading(false);
        }
    };

    // ---- Productos helpers ----
    const fetchProductos = async () => {
        setProductosLoading(true);
        try {
            const { data, error } = await supabase
                .from('productos')
                .select('*')
                .order('orden', { ascending: true });
            if (!error && data) setProductosList(data);
        } catch (err) {
            console.error(err);
        } finally {
            setProductosLoading(false);
        }
    };

    const handleSaveProducto = async () => {
        if (!productoForm.nombre || !productoForm.precio || !productoForm.categoria) {
            alert('Nombre, precio y categoría son obligatorios.');
            return;
        }
        setProductoSaving(true);
        try {
            const payload = {
                nombre: productoForm.nombre,
                descripcion: productoForm.descripcion || null,
                precio: Number(productoForm.precio),
                categoria: productoForm.categoria,
                activo: productoForm.activo,
                orden: Number(productoForm.orden) || 0,
                imagen: productoForm.imagen || null,
                updated_at: new Date().toISOString()
            };

            let error;
            if (editingProducto === 'new') {
                ({ error } = await supabase.from('productos').insert([payload]));
            } else {
                ({ error } = await supabase.from('productos').update(payload).eq('id', editingProducto));
            }

            if (error) throw error;
            setEditingProducto(null);
            setProductoForm({ nombre: '', descripcion: '', precio: '', categoria: '', activo: true, orden: 0, imagen: '' });
            await fetchProductos();
        } catch (err) {
            console.error(err);
            alert('Error al guardar el producto: ' + err.message);
        } finally {
            setProductoSaving(false);
        }
    };

    const handleToggleProductoActivo = async (producto) => {
        try {
            const { error } = await supabase
                .from('productos')
                .update({ activo: !producto.activo, updated_at: new Date().toISOString() })
                .eq('id', producto.id);
            if (error) throw error;
            await fetchProductos();
        } catch (err) {
            console.error(err);
            alert('Error al actualizar el producto.');
        }
    };

    // ---- Inventario helpers ----
    const fetchInventario = async () => {
        setInventarioLoading(true);
        try {
            const { data: ins, error: insErr } = await supabase
                .from('insumos')
                .select('*')
                .order('nombre', { ascending: true });
            if (insErr) throw insErr;
            setInsumosList(ins || []);

            const { data: rec, error: recErr } = await supabase
                .from('producto_insumos')
                .select('*, productos(nombre), insumos(nombre)');
            if (recErr) throw recErr;
            setRecetasList(rec || []);
        } catch (err) {
            console.error(err);
        } finally {
            setInventarioLoading(false);
        }
    };

    const handleSaveInsumo = async () => {
        if (!insumoForm.nombre || !insumoForm.unidad_medida) {
            alert('Nombre y unidad de medida son obligatorios.');
            return;
        }
        setInsumoSaving(true);
        try {
            const payload = {
                nombre: insumoForm.nombre,
                unidad_medida: insumoForm.unidad_medida,
                stock_actual: Number(insumoForm.stock_actual) || 0,
                stock_minimo: Number(insumoForm.stock_minimo) || 0,
                costo_unitario: Number(insumoForm.costo_unitario) || 0,
                activo: insumoForm.activo,
                updated_at: new Date().toISOString()
            };

            let error;
            if (editingInsumo === 'new') {
                ({ error } = await supabase.from('insumos').insert([payload]));
            } else {
                ({ error } = await supabase.from('insumos').update(payload).eq('id', editingInsumo));
            }

            if (error) throw error;
            setEditingInsumo(null);
            setInsumoForm({ nombre: '', unidad_medida: 'unidad', stock_actual: 0, stock_minimo: 0, activo: true, costo_unitario: 0 });
            await fetchInventario();
        } catch (err) {
            console.error(err);
            alert('Error al guardar el insumo: ' + err.message);
        } finally {
            setInsumoSaving(false);
        }
    };

    const handleToggleInsumoActivo = async (insumo) => {
        try {
            const { error } = await supabase
                .from('insumos')
                .update({ activo: !insumo.activo, updated_at: new Date().toISOString() })
                .eq('id', insumo.id);
            if (error) throw error;
            await fetchInventario();
        } catch (err) {
            console.error(err);
            alert('Error al actualizar el insumo.');
        }
    };

    const handleAjustarStock = async () => {
        if (!showAjusteModal || !ajusteForm.cantidad) {
            alert('Ingrese una cantidad válida.');
            return;
        }
        setInsumoSaving(true);
        try {
            const insumo = showAjusteModal;
            const delta = Number(ajusteForm.cantidad);

            // Adjust calculation based on type
            const sign = (ajusteForm.tipo === 'ENTRADA' || ajusteForm.tipo === 'AJUSTE') ? 1 : -1;
            const finalDelta = delta * sign;
            const newStock = Math.max(0, Number(insumo.stock_actual) + finalDelta);

            // 1. Update stock in insumos table
            const { error: insErr } = await supabase
                .from('insumos')
                .update({ stock_actual: newStock, updated_at: new Date().toISOString() })
                .eq('id', insumo.id);
            if (insErr) throw insErr;

            // 2. Insert trace row to movimientos_inventario
            const { error: trcErr } = await supabase
                .from('movimientos_inventario')
                .insert([{
                    insumo_id: insumo.id,
                    tipo: ajusteForm.tipo,
                    cantidad: finalDelta,
                    motivo: ajusteForm.motivo || 'Ajuste manual del socio',
                    usuario_id: currentUserProfile?.id
                }]);
            if (trcErr) throw trcErr;

            setShowAjusteModal(null);
            setAjusteForm({ tipo: 'AJUSTE', cantidad: 0, motivo: '' });
            await fetchInventario();
        } catch (err) {
            console.error(err);
            alert('Error al ajustar el inventario.');
        } finally {
            setInsumoSaving(false);
        }
    };

    // ── Merma directa ──────────────────────────────────────────────────────
    const handleRegistrarMerma = async () => {
        const insumo = showMermaModal;
        const cantidad = Number(mermaForm.cantidad);
        if (!insumo || !mermaForm.cantidad || cantidad <= 0) return;
        if (cantidad > Number(insumo.stock_actual)) return;

        // Motivo recomendado pero no bloqueante:
        // Si el motivo está vacío y el usuario no ha visto el aviso todavía, mostrar aviso
        if (!mermaForm.motivo.trim() && !mermaForm.advertencia) {
            setMermaForm(p => ({ ...p, advertencia: true }));
            return;
        }

        setMermaSaving(true);
        try {
            const { data, error } = await supabase.rpc('registrar_merma_trabajador', {
                p_insumo_id: insumo.id,
                p_cantidad: cantidad,
                p_motivo: mermaForm.motivo.trim() || null,
            });
            if (error) throw error;
            if (data && !data.success) throw new Error(data.message);
            setShowMermaModal(null);
            setMermaForm({ cantidad: '', motivo: '', advertencia: false });
            await fetchInventario();
        } catch (err) {
            console.error(err);
            alert('Error al registrar merma: ' + err.message);
        } finally {
            setMermaSaving(false);
        }
    };

    const handleOpenCargaMasiva = () => {
        const initialMap = {};
        insumosList.forEach(ins => {
            initialMap[ins.id] = Number(ins.stock_actual) || 0;
        });
        setCargaMasivaForm(initialMap);
        setCargaMasivaMotivo('Toma Física / Carga de Stock Inicial');
        setShowCargaMasivaModal(true);
    };

    const handleAutoFillStockRecomendado = () => {
        const filledMap = {};
        insumosList.forEach(ins => {
            const unit = (ins.unidad_medida || '').toLowerCase();
            let qty = 50;
            if (unit.includes('gramo') || unit.includes('g') || unit.includes('gr')) {
                qty = 2500;
            } else if (unit.includes('mililitro') || unit.includes('ml')) {
                qty = 3000;
            } else if (unit.includes('porción') || unit.includes('porcion')) {
                qty = 100;
            } else if (unit.includes('unidad') || unit.includes('ud')) {
                qty = 50;
            }
            filledMap[ins.id] = qty;
        });
        setCargaMasivaForm(filledMap);
    };

    const handleSaveCargaMasiva = async () => {
        setCargaMasivaSaving(true);
        try {
            const items = insumosList.map(ins => ({
                insumo_id: ins.id,
                nuevo_stock: Number(cargaMasivaForm[ins.id]) || 0
            }));

            const { data, error } = await supabase.rpc('registrar_carga_masiva_inventario', {
                p_items: items,
                p_motivo: cargaMasivaMotivo || 'Toma Física / Carga de Stock Inicial',
                p_tipo: 'AJUSTE'
            });

            if (error) throw error;

            if (data?.success) {
                alert(`¡Carga de inventario procesada exitosamente! ${data.items_procesados || 0} insumos actualizados.`);
                setShowCargaMasivaModal(false);
                await fetchInventario();
                await fetchDashboardData();
            } else {
                alert(data?.message || 'Error al procesar la carga de inventario.');
            }
        } catch (err) {
            console.error(err);
            alert('Error al guardar la carga de inventario: ' + err.message);
        } finally {
            setCargaMasivaSaving(false);
        }
    };

    const handleSaveReceta = async () => {
        if (!recetaForm.producto_id || !recetaForm.insumo_id || !recetaForm.cantidad_por_unidad) {
            alert('Todos los campos son obligatorios.');
            return;
        }
        setRecetaSaving(true);
        try {
            const payload = {
                producto_id: recetaForm.producto_id,
                insumo_id: recetaForm.insumo_id,
                cantidad_por_unidad: Number(recetaForm.cantidad_por_unidad)
            };

            const { error } = await supabase.from('producto_insumos').insert([payload]);
            if (error) throw error;

            setEditingReceta(null);
            setRecetaForm({ producto_id: '', insumo_id: '', cantidad_por_unidad: 1 });
            await fetchInventario();
        } catch (err) {
            console.error(err);
            alert('Error al crear la receta: ' + err.message);
        } finally {
            setRecetaSaving(false);
        }
    };

    const handleDeleteReceta = async (id) => {
        if (!window.confirm('¿Confirmar que desea eliminar este ingrediente de la receta?')) return;
        try {
            const { error } = await supabase.from('producto_insumos').delete().eq('id', id);
            if (error) throw error;
            await fetchInventario();
        } catch (err) {
            console.error(err);
            alert('Error al eliminar la receta.');
        }
    };

    // ---- Compras / Proveedores helpers ----
    const fetchProveedores = async () => {
        try {
            const { data, error } = await supabase
                .from('proveedores')
                .select('*')
                .order('nombre', { ascending: true });
            if (!error && data) setProveedoresList(data);
        } catch (err) {
            console.error(err);
        }
    };

    const fetchCompras = async () => {
        setComprasLoading(true);
        try {
            const { data, error } = await supabase
                .from('compras')
                .select('*, proveedores(nombre), perfiles_trabajadores(nombre), compra_detalles(*, insumos(nombre))')
                .order('fecha', { ascending: false });
            if (!error && data) setComprasList(data);
        } catch (err) {
            console.error(err);
        } finally {
            setComprasLoading(false);
        }
    };

    const handleSaveProveedor = async () => {
        if (!proveedorForm.nombre) {
            alert('El nombre del proveedor es obligatorio.');
            return;
        }
        setActionLoading(true);
        try {
            const payload = {
                nombre: proveedorForm.nombre,
                telefono: proveedorForm.telefono || null,
                contacto: proveedorForm.contacto || null,
                activo: proveedorForm.activo,
                updated_at: new Date().toISOString()
            };

            let error;
            if (editingProveedor === 'new') {
                ({ error } = await supabase.from('proveedores').insert([payload]));
            } else {
                ({ error } = await supabase.from('proveedores').update(payload).eq('id', editingProveedor));
            }

            if (error) throw error;
            setEditingProveedor(null);
            setProveedorForm({ nombre: '', telefono: '', contacto: '', activo: true });
            await fetchProveedores();
        } catch (err) {
            console.error(err);
            alert('Error al guardar el proveedor.');
        } finally {
            setActionLoading(false);
        }
    };

    const handleToggleProveedorActivo = async (prov) => {
        try {
            const { error } = await supabase
                .from('proveedores')
                .update({ activo: !prov.activo, updated_at: new Date().toISOString() })
                .eq('id', prov.id);
            if (error) throw error;
            await fetchProveedores();
        } catch (err) {
            console.error(err);
            alert('Error al actualizar el proveedor.');
        }
    };

    const handleAddCompraDetail = () => {
        if (!selectedDetail.insumo_id || !selectedDetail.cantidad || selectedDetail.costo_unitario < 0) {
            alert('Seleccione un insumo y proporcione cantidad y costo unitario válidos.');
            return;
        }
        const insumoObj = insumosList.find(i => i.id === selectedDetail.insumo_id);
        const subtotal = Number(selectedDetail.cantidad) * Number(selectedDetail.costo_unitario);

        setCompraForm(p => ({
            ...p,
            details: [
                ...p.details,
                {
                    insumo_id: selectedDetail.insumo_id,
                    nombre: insumoObj?.nombre || 'Desconocido',
                    cantidad: Number(selectedDetail.cantidad),
                    costo_unitario: Number(selectedDetail.costo_unitario),
                    subtotal
                }
            ]
        }));
        setSelectedDetail({ insumo_id: '', cantidad: 1, costo_unitario: 0 });
    };

    const handleRemoveCompraDetail = (index) => {
        setCompraForm(p => ({
            ...p,
            details: p.details.filter((_, i) => i !== index)
        }));
    };

    const handleSaveCompra = async (shouldReceiveImmediate) => {
        if (!compraForm.proveedor_id) {
            alert('Debe seleccionar un proveedor.');
            return;
        }
        if (compraForm.details.length === 0) {
            alert('Debe agregar al menos un insumo al detalle de compra.');
            return;
        }
        setActionLoading(true);
        try {
            const total = compraForm.details.reduce((sum, item) => sum + item.subtotal, 0);

            // 1. Insert row to compras (F6-05: incluye metodo_pago)
            const { data: cmpData, error: cmpErr } = await supabase
                .from('compras')
                .insert([{
                    proveedor_id: compraForm.proveedor_id,
                    usuario_id: currentUserProfile?.id,
                    total,
                    estado: 'BORRADOR',
                    observaciones: compraForm.observaciones || null,
                    metodo_pago: shouldReceiveImmediate ? compraForm.metodo_pago : null
                }])
                .select()
                .single();

            if (cmpErr) throw cmpErr;

            // 2. Insert detail rows to compra_detalles
            const detailsPayload = compraForm.details.map(item => ({
                compra_id: cmpData.id,
                insumo_id: item.insumo_id,
                cantidad: item.cantidad,
                costo_unitario: item.costo_unitario,
                subtotal: item.subtotal
            }));

            const { error: detErr } = await supabase
                .from('compra_detalles')
                .insert(detailsPayload);

            if (detErr) throw detErr;

            // 3. F6-05: Recibir inmediatamente con egreso financiero
            if (shouldReceiveImmediate) {
                const { data: recData, error: recErr } = await supabase
                    .rpc('recibir_compra', {
                        p_compra_id: cmpData.id,
                        p_metodo_pago: compraForm.metodo_pago
                    });
                if (recErr) throw recErr;
                if (recData && !recData.success) throw new Error(recData.message);
            }

            setEditingCompra(null);
            setCompraForm({ proveedor_id: '', observaciones: '', details: [], metodo_pago: 'EFECTIVO' });
            setSelectedDetail({ insumo_id: '', cantidad: 1, costo_unitario: 0 });
            setCompraInsumoSearch('');
            await fetchCompras();
            await fetchInventario();
            alert('Compra registrada con éxito.');
        } catch (err) {
            console.error(err);
            alert('Error al guardar la compra: ' + err.message);
        } finally {
            setActionLoading(false);
        }
    };

    // F6-05: Abrir modal de recepción con selector de método de pago
    const handleRecibirCompra = (compra) => {
        setRecibirMetodoPago('EFECTIVO');
        setShowRecibirModal(compra);
    };

    // F6-05: Confirmar recepción con egreso financiero
    const handleConfirmarRecibir = async () => {
        if (!showRecibirModal) return;
        setActionLoading(true);
        try {
            const { data, error } = await supabase.rpc('recibir_compra', {
                p_compra_id: showRecibirModal.id,
                p_metodo_pago: recibirMetodoPago
            });
            if (error) throw error;
            if (data && !data.success) throw new Error(data.message);

            setShowRecibirModal(null);
            await fetchCompras();
            await fetchInventario();
            alert(`Compra recibida. Inventario actualizado. Egreso de $${showRecibirModal.total?.toLocaleString() || 0} registrado en caja (${recibirMetodoPago}).`);
        } catch (err) {
            console.error(err);
            alert('Error al recibir compra: ' + err.message);
        } finally {
            setActionLoading(false);
        }
    };

    const handleAnularCompra = async () => {
        if (!anularMotivo) {
            alert('Debe especificar un motivo para la anulación.');
            return;
        }
        setActionLoading(true);
        try {
            const { data, error } = await supabase.rpc('anular_compra', {
                p_compra_id: showAnularModal.id,
                p_motivo: anularMotivo
            });

            if (error) throw error;
            if (data && !data.success) throw new Error(data.message);

            setShowAnularModal(null);
            setAnularMotivo('');
            await fetchCompras();
            await fetchInventario();
            alert('Compra anulada y stock ajustado.');
        } catch (err) {
            console.error(err);
            alert('Error al anular la compra: ' + err.message);
        } finally {
            setActionLoading(false);
        }
    };

    const handlePagarLiquidacion = async (liquidacionId, cuentaOrigen) => {
        if (!window.confirm(`¿Confirmar pago de liquidación desde la cuenta ${cuentaOrigen}?`)) return;
        setActionLoading(true);
        try {
            const { data, error } = await supabase.rpc('pagar_liquidacion', {
                p_liquidacion_id: liquidacionId,
                p_cuenta_origen: cuentaOrigen
            });

            if (error) throw error;
            if (data && !data.success) throw new Error(data.message);

            alert('¡Liquidación pagada exitosamente! Se ha registrado el egreso en caja.');
            await fetchDashboardData();              // KPIs globales (liquidacionesList, movementsList)
            await fetchLiqPage(liqPage);            // Fase 6.3 — recarga la página actual de la tabla
        } catch (err) {
            console.error(err);
            alert('Error al pagar la liquidación: ' + err.message);
        } finally {
            setActionLoading(false);
        }
    };

    const handleGenerarLiquidacion = async () => {
        if (!selectedWorkerForLiq || !liqMontoForm || liqMontoForm <= 0) {
            alert('Seleccione un trabajador e ingrese un monto válido mayor a 0.');
            return;
        }
        setActionLoading(true);
        try {
            const { data, error } = await supabase.rpc('generar_liquidacion', {
                p_trabajador_id: selectedWorkerForLiq.id,
                p_modalidad: liqModalidadForm || selectedWorkerForLiq.modalidad_pago || 'POR_TURNO',
                p_monto: Number(liqMontoForm),
                p_observaciones: liqObsForm || 'Liquidación de servicios'
            });

            if (error) throw error;
            if (data && !data.success) throw new Error(data.message);

            alert('¡Liquidación generada con éxito en estado PENDIENTE!');
            setShowGenerarLiqModal(false);
            setSelectedWorkerForLiq(null);
            setLiqMontoForm(0);
            setLiqObsForm('');
            await fetchDashboardData();
        } catch (err) {
            console.error(err);
            alert('Error al generar liquidación: ' + err.message);
        } finally {
            setActionLoading(false);
        }
    };

    const handleAnularLiquidacion = async () => {
        if (!showAnularLiqModal?.id) return;
        setActionLoading(true);
        try {
            const { data, error } = await supabase.rpc('anular_liquidacion', {
                p_liquidacion_id: showAnularLiqModal.id,
                p_motivo: anularLiqMotivo || 'Anulación por administrador'
            });

            if (error) throw error;
            if (data && !data.success) throw new Error(data.message);

            alert(data?.message || '¡Liquidación anulada exitosamente!');
            setShowAnularLiqModal(null);
            setAnularLiqMotivo('');
            await fetchDashboardData();
            await fetchLiqPage(liqPage);
        } catch (err) {
            console.error(err);
            alert('Error al anular la liquidación: ' + err.message);
        } finally {
            setActionLoading(false);
        }
    };

    const handleRegistrarGasto = async () => {
        if (!gastoForm.categoria_id) {
            alert('Debe seleccionar una categoría.');
            return;
        }
        if (!gastoForm.monto || Number(gastoForm.monto) <= 0) {
            alert('El monto debe ser mayor a cero.');
            return;
        }
        setActionLoading(true);
        try {
            const { data, error } = await supabase.rpc('crear_gasto', {
                p_categoria_id: gastoForm.categoria_id,
                p_descripcion: gastoForm.descripcion,
                p_monto: Number(gastoForm.monto),
                p_metodo_pago: gastoForm.metodo_pago
            });

            if (error) throw error;
            if (data && !data.success) {
                throw new Error(data.message || 'Error desconocido del servidor');
            }

            alert('Gasto registrado exitosamente.');
            setShowNewGastoModal(false);
            setGastoForm({ categoria_id: '', descripcion: '', monto: '', metodo_pago: 'EFECTIVO' });
            await fetchGastosPage(0);
            await fetchDashboardData();
        } catch (err) {
            console.error(err);
            alert('Error al registrar gasto: ' + err.message);
        } finally {
            setActionLoading(false);
        }
    };

    const handleAnularGasto = async () => {
        if (!showAnularGastoModal) return;
        if (!anularGastoMotivo.trim()) {
            alert('Debe especificar un motivo para la anulación.');
            return;
        }
        setActionLoading(true);
        try {
            const { data, error } = await supabase.rpc('anular_gasto', {
                p_gasto_id: showAnularGastoModal.id,
                p_motivo: anularGastoMotivo
            });

            if (error) throw error;
            if (data && !data.success) {
                throw new Error(data.message || 'Error al anular gasto');
            }

            alert('Gasto anulado correctamente.');
            setShowAnularGastoModal(null);
            setAnularGastoMotivo('');
            await fetchGastosPage(gastosPage);
            await fetchDashboardData();
        } catch (err) {
            console.error(err);
            alert('Error al anular gasto: ' + err.message);
        } finally {
            setActionLoading(false);
        }
    };

    const handleCrearCategoria = async () => {
        if (!categoriaForm.nombre.trim()) {
            alert('El nombre de la categoría es obligatorio.');
            return;
        }
        setActionLoading(true);
        try {
            const { error } = await supabase
                .from('categorias_gastos')
                .insert({
                    nombre: categoriaForm.nombre.trim(),
                    activo: true
                });

            if (error) throw error;

            alert('Categoría creada exitosamente.');
            setShowNewCategoriaModal(false);
            setCategoriaForm({ nombre: '', activo: true });
            await fetchCategoriasGastos();
        } catch (err) {
            console.error(err);
            alert('Error al crear categoría: ' + err.message);
        } finally {
            setActionLoading(false);
        }
    };

    if (loading) {
        return <div className="min-h-screen bg-black flex items-center justify-center text-fire animate-pulse font-serif text-xl">Cargando Tablero...</div>;
    }

    // Fase 6.2: ordenado por prioridad de rol.
    // Trabajador frecuente: Dashboard → Inventario → Caja → Ventas primero.
    // Socio/Admin: Dashboard → Ventas → Caja → Inventario → Compras → resto.
    // mobileLabel = etiqueta corta para la barra horizontal mobile (NO cambia activeTab ni lógica interna).
    const navigationItems = [
        { id: 'dashboard',     label: 'Dashboard',               mobileLabel: 'Dashboard',  icon: Flame },
        { id: 'inventario',    label: 'Inventario',              mobileLabel: 'Inventario', icon: Archive },
        { id: 'caja',          label: 'Caja y Arqueo',           mobileLabel: 'Caja',       icon: PiggyBank },
        { id: 'ventas',        label: 'Ventas',                  mobileLabel: 'Ventas',     icon: ShoppingBag },
        { id: 'clientes',      label: 'Clientes / Fidelización', mobileLabel: 'Clientes',   icon: Users },
        { id: 'trabajadores',  label: 'Trabajadores',            mobileLabel: 'Staff',      icon: Award },
        { id: 'rentabilidad',  label: 'Rentabilidad / Finanzas', mobileLabel: 'Finanzas',   icon: TrendingUp },
        { id: 'gastos',        label: 'Gastos Operativos',       mobileLabel: 'Gastos',     icon: Receipt },
        { id: 'analitica',     label: 'Analítica (Pareto 80/20)',mobileLabel: 'Analítica',  icon: BarChart3 },
        { id: 'liquidaciones', label: 'Liquidaciones Staff',     mobileLabel: 'Nómina',     icon: DollarSign },
        { id: 'productos',     label: 'Productos / Menú',        mobileLabel: 'Productos',  icon: UtensilsCrossed },
        { id: 'compras',       label: 'Compras',                 mobileLabel: 'Compras',    icon: Truck },
        { id: 'configuracion', label: 'Configuración',           mobileLabel: 'Config',     icon: Settings, restrictToSocio: true },
    ];

    return (
        <div className="min-h-screen bg-zinc-950 text-white flex flex-col md:flex-row font-sans">
            {/* Mobile Header (Sticky Top with Direct POS Button) */}
            <div className="md:hidden sticky top-0 bg-zinc-900/95 backdrop-blur-md border-b border-zinc-800 p-3 flex justify-between items-center z-50 shadow-xl">
                <div className="flex items-center gap-2">
                    <div className="w-8 h-8 bg-fire rounded-xl flex items-center justify-center font-bold text-white shadow-lg shadow-fire/30 border border-fire/40">T</div>
                    <span className="font-bold tracking-wider font-serif text-sm">Titan Admin</span>
                </div>

                <div className="flex items-center gap-2">
                    {/* Direct 1-Tap POS Launch Button on Mobile Header */}
                    <Link
                        to="/pos"
                        className="bg-gradient-to-r from-orange-600 to-fire text-white px-3 py-1.5 rounded-xl text-xs font-black uppercase tracking-wider flex items-center gap-1.5 shadow-lg shadow-fire/25 border border-fire/40 active:scale-95 transition-all"
                    >
                        <ShoppingBag size={14} />
                        🔥 POS
                    </Link>

                    <button
                        onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                        className="bg-zinc-800 hover:bg-zinc-700 p-2 rounded-xl text-zinc-300 hover:text-white transition-all border border-zinc-700 active:scale-95"
                        aria-label="Abrir menú"
                    >
                        {mobileMenuOpen ? <X size={20} /> : <Menu size={20} />}
                    </button>
                </div>
            </div>

            {/* Mobile Horizontal Quick-Tab Scroll Bar — Fase 6.2:
                 - usa mobileLabel (corto) en lugar de split('/')[0]
                 - contenedor relativo con fade-right como indicador de scroll adicional
            */}
            <div className="md:hidden sticky top-[57px] z-40 bg-zinc-950/90 backdrop-blur-md border-b border-zinc-850 shadow-inner">
                {/* Fade gradient al borde derecho — indica que hay más contenido */}
                <div className="relative">
                    <div className="flex items-center gap-2 p-2 overflow-x-auto scrollbar-none">
                        {navigationItems.map(item => {
                            if (item.restrictToSocio && !currentUserProfile?.es_socio) return null;
                            const IconComponent = item.icon;
                            const isActive = activeTab === item.id;
                            return (
                                <button
                                    key={item.id}
                                    onClick={() => {
                                        setActiveTab(item.id);
                                        setMobileMenuOpen(false);
                                    }}
                                    className={`px-3 py-1.5 rounded-xl text-[11px] font-bold whitespace-nowrap flex items-center gap-1.5 transition-all shrink-0 active:scale-95 ${
                                        isActive
                                            ? 'bg-fire text-white shadow-md shadow-fire/20 border border-fire/40'
                                            : 'bg-zinc-900 text-zinc-400 border border-zinc-800 hover:text-zinc-200'
                                    }`}
                                >
                                    <IconComponent size={13} />
                                    {item.mobileLabel}
                                </button>
                            );
                        })}
                        {/* Spacer al final para que el último tab no quede pegado al fade */}
                        <div className="shrink-0 w-6" aria-hidden="true" />
                    </div>
                    {/* Fade derecho — indicador visual de scroll */}
                    <div
                        className="pointer-events-none absolute right-0 top-0 h-full w-10 bg-gradient-to-l from-zinc-950/90 to-transparent"
                        aria-hidden="true"
                    />
                </div>
            </div>

            {/* Sidebar / Navigation (Responsive Drawer Panel) */}
            <aside className={`w-full md:w-64 bg-zinc-900 border-r border-zinc-800 flex flex-col justify-between transition-all duration-300 md:translate-x-0 ${mobileMenuOpen ? 'fixed inset-y-0 left-0 translate-x-0 z-50 h-full overflow-y-auto' : 'fixed md:relative -translate-x-full md:translate-x-0'
                }`}>
                <div className="p-5 overflow-y-auto">
                    {/* Mobile Menu Close Header */}
                    <div className="md:hidden flex justify-between items-center pb-4 mb-4 border-b border-zinc-800">
                        <span className="text-xs font-bold text-zinc-400 uppercase tracking-widest">Menú Principal</span>
                        <button onClick={() => setMobileMenuOpen(false)} className="text-zinc-400 hover:text-white p-1">
                            <X size={20} />
                        </button>
                    </div>

                    {/* Desktop Brand */}
                    <div className="hidden md:flex items-center gap-3 mb-6 pb-5 border-b border-zinc-800">
                        <div className="w-10 h-10 bg-fire rounded-2xl flex items-center justify-center font-bold text-white shadow-lg shadow-fire/30 border border-fire/40">T</div>
                        <div>
                            <h2 className="font-bold tracking-wider font-serif leading-none text-base">Titan Grill</h2>
                            <span className="text-[10px] text-zinc-500 uppercase tracking-widest font-bold mt-1 block">Panel Operativo</span>
                        </div>
                    </div>

                    {/* Top Direct POS Launch Button inside Drawer */}
                    <div className="mb-4">
                        <Link
                            to="/pos"
                            onClick={() => setMobileMenuOpen(false)}
                            className="w-full flex items-center justify-center gap-2.5 px-4 py-3 rounded-2xl text-xs font-black text-white bg-gradient-to-r from-orange-600 to-fire hover:from-orange-500 hover:to-fire transition-all border border-fire/40 shadow-xl shadow-fire/25 uppercase tracking-wider active:scale-95"
                        >
                            <ShoppingBag size={18} />
                            Abrir Caja / POS
                        </Link>
                    </div>

                    {/* Nav Items */}
                    <nav className="space-y-1">
                        {navigationItems.map(item => {
                            if (item.restrictToSocio && !currentUserProfile?.es_socio) return null;
                            const IconComponent = item.icon;
                            const isActive = activeTab === item.id;
                            return (
                                <button
                                    key={item.id}
                                    onClick={() => {
                                        setActiveTab(item.id);
                                        setMobileMenuOpen(false);
                                    }}
                                    className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-xl text-xs font-bold transition-all ${isActive
                                            ? 'bg-fire text-white shadow-lg shadow-fire/20 border border-fire/30'
                                            : 'text-zinc-400 hover:bg-zinc-850 hover:text-white'
                                        }`}
                                >
                                    <IconComponent size={17} />
                                    {item.label}
                                </button>
                            );
                        })}
                    </nav>
                </div>

                {/* Profile / Logout */}
                <div className="p-5 border-t border-zinc-800 space-y-3 bg-zinc-950/40">
                    {currentUserProfile && (
                        <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-xl bg-fire/20 text-fire flex items-center justify-center text-xs font-black border border-fire/40 shrink-0">
                                {currentUserProfile.nombre.charAt(0).toUpperCase()}
                            </div>
                            <div className="text-left overflow-hidden">
                                <p className="text-xs font-bold text-zinc-200 truncate leading-none">{currentUserProfile.nombre}</p>
                                <span className="text-[9px] text-zinc-500 uppercase tracking-wider font-bold mt-1 block">
                                    {currentUserProfile.rol} {currentUserProfile.es_socio ? '• Socio' : ''}
                                </span>
                            </div>
                        </div>
                    )}
                    <button
                        onClick={handleLogout}
                        className="w-full flex items-center justify-center gap-2 bg-zinc-900 hover:bg-red-950/30 text-zinc-400 hover:text-red-400 border border-zinc-800 hover:border-red-950/40 py-2 rounded-xl transition-all text-[11px] font-bold uppercase tracking-wider"
                    >
                        <LogOut size={14} />
                        Cerrar Sesión
                    </button>
                </div>
            </aside>

            {/* Main Content Area */}
            <main className="flex-1 p-6 md:p-10 overflow-y-auto max-w-7xl mx-auto w-full">
                {activeTab === 'dashboard' && (
                    <div className="space-y-10">
                        {/* Title */}
                        <SectionHeader
                            title="Tablero Administrativo"
                            subtitle="Resumen general de métricas e indicadores en tiempo real"
                            icon={Flame}
                        />

                        {/* Error banner — solo visible cuando fetchDashboardData falla */}
                        {fetchError && (
                            <ErrorBanner
                                message={fetchError}
                                onRetry={() => { setFetchError(null); fetchDashboardData(); }}
                            />
                        )}

                        {/* Date Filter Bar */}
                        <div className="flex items-center justify-between mb-2">
                            <h2 className="text-xl font-serif text-white">Filtro Temporal</h2>
                            {dateRange === 'custom' && (customStartDate || customEndDate) && (
                                <span className="text-xs text-zinc-400">Rango: {customStartDate || '...'} → {customEndDate || '...'}</span>
                            )}
                        </div>
                        <div className="flex gap-2 overflow-x-auto pb-2 -mx-6 md:mx-0">
                            {[
                                { key: 'today', label: 'Hoy' },
                                { key: 'yesterday', label: 'Ayer' },
                                { key: '7d', label: 'Últimos 7 días' },
                                { key: '30d', label: 'Últimos 30 días' },
                                { key: 'month', label: 'Este mes' },
                            ].map(opt => (
                                <button
                                    key={opt.key}
                                    onClick={() => { setDateRange(opt.key); setCustomStartDate(''); setCustomEndDate(''); }}
                                    className={`px-4 py-2 rounded-lg text-sm font-bold whitespace-nowrap transition-all ${dateRange === opt.key
                                            ? 'bg-fire text-white shadow-lg shadow-fire/15'
                                            : 'bg-zinc-900 border border-zinc-800 text-zinc-400 hover:text-white hover:border-fire/30'
                                        }`}
                                >
                                    {opt.label}
                                </button>
                            ))}
                            <div className="flex items-center gap-1 bg-zinc-900 border border-zinc-800 rounded-lg px-2.5 py-1">
                                <Calendar size={14} className="text-zinc-500" />
                                <input
                                    type="date"
                                    className="bg-transparent border-none text-xs text-white outline-none w-24"
                                    value={customStartDate}
                                    onChange={e => { setCustomStartDate(e.target.value); setDateRange('custom'); }}
                                />
                                <span className="text-zinc-600">→</span>
                                <input
                                    type="date"
                                    className="bg-transparent border-none text-xs text-white outline-none w-24"
                                    value={customEndDate}
                                    onChange={e => { setCustomEndDate(e.target.value); setDateRange('custom'); }}
                                />
                            </div>
                        </div>

                        {metricsLoading && (
                            <div className="flex items-center gap-2 text-zinc-400 text-xs">
                                <div className="w-3 h-3 border border-fire border-t-transparent rounded-full animate-spin"></div>
                                Actualizando métricas del período...
                            </div>
                        )}

                        {/* Sales KPIs (Period-specific) */}
                        <div className="grid grid-cols-2 lg:grid-cols-4 gap-6">
                            <div className="bg-zinc-900 border border-zinc-800/60 p-6 rounded-2xl relative overflow-hidden group hover:border-fire/40 transition-colors">
                                <div className="absolute top-0 right-0 p-6 opacity-5 group-hover:opacity-10 transition-opacity">
                                    <TrendingUp size={64} className="text-fire" />
                                </div>
                                <p className="text-fire text-[10px] uppercase tracking-widest font-bold mb-2">Ventas del Período</p>
                                <h3 className="text-3xl font-bold text-white">${(salesKPIs?.totalVentas || 0).toLocaleString()}</h3>
                                <span className="text-[10px] text-zinc-400 bg-zinc-950/50 inline-block px-2 py-0.5 rounded mt-3">{salesKPIs?.numVentas || 0} ventas</span>
                            </div>

                            <div className="bg-zinc-900 border border-zinc-800/60 p-6 rounded-2xl relative overflow-hidden group hover:border-blue-500/40 transition-colors">
                                <div className="absolute top-0 right-0 p-6 opacity-5 group-hover:opacity-10 transition-opacity">
                                    <ShoppingCart size={64} className="text-blue-500" />
                                </div>
                                <p className="text-blue-500 text-[10px] uppercase tracking-widest font-bold mb-2">Ticket Promedio</p>
                                <h3 className="text-3xl font-bold text-white">${Math.round(salesKPIs?.ticketPromedio || 0).toLocaleString()}</h3>
                                <span className="text-[10px] text-blue-200/40 bg-blue-500/5 inline-block px-2 py-0.5 rounded mt-3">{salesKPIs?.numVentas || 0} transacciones</span>
                            </div>

                            <div className="bg-zinc-900 border border-zinc-800/60 p-6 rounded-2xl relative overflow-hidden group hover:border-gold/40 transition-colors">
                                <div className="absolute top-0 right-0 p-6 opacity-5 group-hover:opacity-10 transition-opacity">
                                    <Users size={64} className="text-gold" />
                                </div>
                                <p className="text-gold text-[10px] uppercase tracking-widest font-bold mb-2">Clientes Atendidos</p>
                                <h3 className="text-3xl font-bold text-white">{salesKPIs?.clientesAtendidos || 0}</h3>
                                <span className="text-[10px] text-yellow-200/40 bg-gold/5 inline-block px-2 py-0.5 rounded mt-3">Clientes únicos</span>
                            </div>

                            <div className="bg-zinc-900 border border-zinc-800/60 p-6 rounded-2xl relative overflow-hidden group hover:border-purple-500/40 transition-colors">
                                <div className="absolute top-0 right-0 p-6 opacity-5 group-hover:opacity-10 transition-opacity">
                                    <Award size={64} className="text-purple-500" />
                                </div>
                                <p className="text-purple-500 text-[10px] uppercase tracking-widest font-bold mb-2">Fiel. en Período</p>
                                <h3 className="text-3xl font-bold text-white">{(loyaltyPeriodStats?.stampsIssued || 0) + (loyaltyPeriodStats?.redemptions || 0)}</h3>
                                <span className="text-[10px] text-purple-200/40 bg-purple-500/5 inline-block px-2 py-0.5 rounded mt-3">{(loyaltyPeriodStats?.stampsIssued || 0)} sellos / {(loyaltyPeriodStats?.redemptions || 0)} canjes</span>
                            </div>
                        </div>

                        {/* KPI Grid (Existing - Cumulative) */}
                        <div className="grid grid-cols-2 lg:grid-cols-4 gap-6">
                            <div className="bg-zinc-900 border border-zinc-800/60 p-6 rounded-2xl relative overflow-hidden group hover:border-zinc-700 transition-colors">
                                <div className="absolute top-0 right-0 p-6 opacity-5 group-hover:opacity-10 transition-opacity">
                                    <Users size={64} className="text-white" />
                                </div>
                                <p className="text-zinc-500 text-[10px] uppercase tracking-widest font-bold mb-2">Clientes</p>
                                <h3 className="text-3xl font-bold text-white">{stats.totalClients}</h3>
                                <span className="text-[10px] text-zinc-400 bg-zinc-950/50 inline-block px-2 py-0.5 rounded mt-3">Registrados</span>
                            </div>

                            <div className="bg-zinc-900 border border-zinc-800/60 p-6 rounded-2xl relative overflow-hidden group hover:border-fire/40 transition-colors">
                                <div className="absolute top-0 right-0 p-6 opacity-5 group-hover:opacity-10 transition-opacity">
                                    <Flame size={64} className="text-fire" />
                                </div>
                                <p className="text-fire text-[10px] uppercase tracking-widest font-bold mb-2">Fuego Generado</p>
                                <h3 className="text-3xl font-bold text-white">{stats.totalStamps}</h3>
                                <span className="text-[10px] text-orange-200/40 bg-fire/5 inline-block px-2 py-0.5 rounded mt-3">Sellos totales</span>
                            </div>

                            <div className="bg-zinc-900 border border-zinc-800/60 p-6 rounded-2xl relative overflow-hidden group hover:border-gold/40 transition-colors">
                                <div className="absolute top-0 right-0 p-6 opacity-5 group-hover:opacity-10 transition-opacity">
                                    <Trophy size={64} className="text-gold" />
                                </div>
                                <p className="text-gold text-[10px] uppercase tracking-widest font-bold mb-2">Premios Listos</p>
                                <h3 className="text-3xl font-bold text-white">{stats.pendingRewards}</h3>
                                <span className="text-[10px] text-yellow-200/40 bg-gold/5 inline-block px-2 py-0.5 rounded mt-3">Clientes 10+</span>
                            </div>

                            <div className="bg-zinc-900 border border-zinc-800/60 p-6 rounded-2xl relative overflow-hidden group hover:border-blue-500/40 transition-colors">
                                <div className="absolute top-0 right-0 p-6 opacity-5 group-hover:opacity-10 transition-opacity">
                                    <Gift size={64} className="text-blue-500" />
                                </div>
                                <p className="text-blue-500 text-[10px] uppercase tracking-widest font-bold mb-2">Canjes</p>
                                <h3 className="text-3xl font-bold text-white">{stats.totalRedemptions}</h3>
                                <span className="text-[10px] text-blue-200/40 bg-blue-500/5 inline-block px-2 py-0.5 rounded mt-3">Entregados</span>
                            </div>
                        </div>

                        {/* Chart */}
                        <div className="bg-zinc-900 border border-zinc-800/60 rounded-2xl p-6">
                            <h2 className="text-md font-serif text-white mb-6 flex items-center gap-2">
                                <Flame size={16} className="text-fire" />
                                Actividad de Fidelización (Últimos 7 días)
                            </h2>
                            <div className="h-[280px] w-full">
                                <ResponsiveContainer width="100%" height="100%">
                                    <ComposedChart data={chartData}>
                                        <defs>
                                            <linearGradient id="colorFire" x1="0" y1="0" x2="0" y2="1">
                                                <stop offset="5%" stopColor="#ff4500" stopOpacity={0.2} />
                                                <stop offset="95%" stopColor="#ff4500" stopOpacity={0} />
                                            </linearGradient>
                                        </defs>
                                        <CartesianGrid strokeDasharray="3 3" stroke="#222" vertical={false} />
                                        <XAxis dataKey="name" stroke="#555" fontSize={11} tickLine={false} axisLine={false} />
                                        <YAxis stroke="#555" fontSize={11} tickLine={false} axisLine={false} />
                                        <Tooltip content={<CustomTooltip />} />
                                        <Area type="monotone" dataKey="stamps" stroke="#ff4500" fillOpacity={1} fill="url(#colorFire)" name="Sellos" />
                                        <Scatter name="Premios Canjeados" dataKey="redemptions" fill="#FFD700" shape="circle" r={5} />
                                    </ComposedChart>
                                </ResponsiveContainer>
                            </div>
                        </div>

                        {/* ===== Sales Analytics Section ===== */}
                        <div className="space-y-6">
                            <h2 className="text-xl font-serif text-white flex items-center gap-2">
                                <TrendingUp size={18} className="text-fire" />
                                Análisis de Ventas
                            </h2>

                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                                {/* Sales by Day */}
                                <div className="bg-zinc-900 border border-zinc-800/60 rounded-2xl p-6">
                                    <h3 className="text-sm font-semibold text-zinc-300 mb-4 flex items-center gap-2">
                                        <ShoppingCart size={16} className="text-fire" />
                                        Ventas por Día
                                    </h3>
                                    <div className="h-[220px] w-full">
                                        {salesByDayData.length > 0 ? (
                                            <ResponsiveContainer width="100%" height="100%">
                                                <BarChart data={salesByDayData}>
                                                    <CartesianGrid strokeDasharray="3 3" stroke="#222" vertical={false} />
                                                    <XAxis dataKey="name" stroke="#555" fontSize={10} tickLine={false} axisLine={false} />
                                                    <YAxis stroke="#555" fontSize={10} tickLine={false} axisLine={false} />
                                                    <Tooltip contentStyle={{ backgroundColor: '#1a1a1a', border: '1px solid #333', fontSize: '11px' }}
                                                        formatter={(value) => [`$${value.toLocaleString()}`, 'Ventas']} />
                                                    <Bar dataKey="value" fill="#ff4500" radius={[4, 4, 0, 0]} />
                                                </BarChart>
                                            </ResponsiveContainer>
                                        ) : (
                                            <div className="h-full flex items-center justify-center text-zinc-500 text-xs">Sin datos en el período</div>
                                        )}
                                    </div>
                                </div>

                                {/* Payment Method Breakdown */}
                                <div className="bg-zinc-900 border border-zinc-800/60 rounded-2xl p-6">
                                    <h3 className="text-sm font-semibold text-zinc-300 mb-4 flex items-center gap-2">
                                        <PiggyBank size={16} className="text-fire" />
                                        Ingresos por Método de Pago
                                    </h3>
                                    <div className="h-[220px] w-full">
                                        {paymentMethodData.length > 0 ? (
                                            <ResponsiveContainer width="100%" height="100%">
                                                <PieChart>
                                                    <Pie data={paymentMethodData} dataKey="value" nameKey="name" cx="50%" cy="45%" innerRadius={40} outerRadius={70} paddingAngle={2} label={false}>
                                                        {paymentMethodData.map((_, i) => <Cell key={`cell-${i}`} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}
                                                    </Pie>
                                                    <Tooltip contentStyle={{ backgroundColor: '#1a1a1a', border: '1px solid #333', fontSize: '11px' }}
                                                        formatter={(value) => [`$${value.toLocaleString()}`, 'Ingresos']} />
                                                    <Legend layout="horizontal" verticalAlign="bottom" height={20} wrapperStyle={{ fontSize: '9px', color: '#666' }} />
                                                </PieChart>
                                            </ResponsiveContainer>
                                        ) : (
                                            <div className="flex items-center justify-center text-zinc-500 text-xs">Sin datos de pagos en el período</div>
                                        )}
                                    </div>
                                </div>
                            </div>

                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                                {/* Top Products */}
                                <div className="bg-zinc-900 border border-zinc-800/60 rounded-2xl p-6">
                                    <h3 className="text-sm font-semibold text-zinc-300 mb-4 flex items-center gap-2">
                                        <Package size={16} className="text-fire" />
                                        Productos Más Vendidos
                                    </h3>
                                    <div className="h-[260px] w-full">
                                        {topProductsData.length > 0 ? (
                                            <ResponsiveContainer width="100%" height="100%">
                                                <BarChart layout="vertical" data={topProductsData} margin={{ top: 5, right: 20, left: 100, bottom: 5 }}>
                                                    <CartesianGrid strokeDasharray="3 3" stroke="#222" vertical={false} horizontal={true} />
                                                    <XAxis type="number" stroke="#555" fontSize={10} tickLine={false} axisLine={false} />
                                                    <YAxis dataKey="name" type="category" stroke="#555" fontSize={10} tickLine={false} axisLine={false} width={120} />
                                                    <Tooltip contentStyle={{ backgroundColor: '#1a1a1a', border: '1px solid #333', fontSize: '11px' }}
                                                        formatter={(value) => [value, 'Unidades']} />
                                                    <Bar dataKey="quantity" fill="#ff4500" radius={[0, 4, 4, 0]} />
                                                </BarChart>
                                            </ResponsiveContainer>
                                        ) : (
                                            <div className="h-full flex items-center justify-center text-zinc-500 text-xs">Sin ventas registradas</div>
                                        )}
                                    </div>
                                </div>

                                {/* Sales by Staff */}
                                <div className="bg-zinc-900 border border-zinc-800/60 rounded-2xl p-6">
                                    <h3 className="text-sm font-semibold text-zinc-300 mb-4 flex items-center gap-2">
                                        <Users size={16} className="text-fire" />
                                        Ventas por Trabajador
                                    </h3>
                                    <div className="h-[260px] w-full">
                                        {staffSalesData.length > 0 ? (
                                            <ResponsiveContainer width="100%" height="100%">
                                                <BarChart data={staffSalesData} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
                                                    <CartesianGrid strokeDasharray="3 3" stroke="#222" vertical={false} />
                                                    <XAxis dataKey="name" stroke="#555" fontSize={10} tickLine={false} axisLine={false} />
                                                    <YAxis stroke="#555" fontSize={10} tickLine={false} axisLine={false} />
                                                    <Tooltip contentStyle={{ backgroundColor: '#1a1a1a', border: '1px solid #333', fontSize: '11px' }}
                                                        formatter={(value) => [`$${value.toLocaleString()}`, 'Ventas']} />
                                                    <Bar dataKey="total" fill="#ff4500" radius={[4, 4, 0, 0]} />
                                                </BarChart>
                                            </ResponsiveContainer>
                                        ) : (
                                            <div className="h-full flex items-center justify-center text-zinc-500 text-xs">Sin datos de ventas</div>
                                        )}
                                    </div>
                                </div>
                            </div>

                            {/* Ticket Average by Day */}
                            <div className="bg-zinc-900 border border-zinc-800/60 rounded-2xl p-6">
                                <h3 className="text-sm font-semibold text-zinc-300 mb-4 flex items-center gap-2">
                                    <TrendingUp size={16} className="text-fire" />
                                    Ticket Promedio por Día
                                </h3>
                                <div className="h-[220px] w-full">
                                    {ticketByDayData.length > 0 ? (
                                        <ResponsiveContainer width="100%" height="100%">
                                            <LineChart data={ticketByDayData}>
                                                <CartesianGrid strokeDasharray="3 3" stroke="#222" vertical={false} />
                                                <XAxis dataKey="name" stroke="#555" fontSize={10} tickLine={false} axisLine={false} />
                                                <YAxis stroke="#555" fontSize={10} tickLine={false} axisLine={false} />
                                                <Tooltip contentStyle={{ backgroundColor: '#1a1a1a', border: '1px solid #333', fontSize: '11px' }}
                                                    formatter={(value) => [`$${value.toLocaleString()}`, 'Ticket Prom.']} />
                                                <Line type="monotone" dataKey="value" stroke="#ff4500" strokeWidth={2} dot={{ r: 4, fill: '#d4af37' }} />
                                            </LineChart>
                                        </ResponsiveContainer>
                                    ) : (
                                        <div className="h-full flex items-center justify-center text-zinc-500 text-xs">Sin datos de ticket en el período</div>
                                    )}
                                </div>
                            </div>
                        </div>

                        {/* ===== Inventory Indicators Section ===== */}
                        <div className="space-y-6">
                            <div className="flex flex-wrap justify-between items-center gap-3">
                                <h2 className="text-xl font-serif text-white flex items-center gap-2">
                                    <Package size={18} className="text-fire" />
                                    Indicadores de Inventario
                                </h2>
                                <div className="flex gap-2">
                                    <button
                                        onClick={() => setActiveTab('inventario')}
                                        className="flex items-center gap-1.5 bg-fire text-white px-3.5 py-2 rounded-lg text-xs font-bold hover:bg-orange-700 transition-all"
                                    >
                                        <Archive size={14} />
                                        Ir a Inventario
                                    </button>
                                    <button
                                        onClick={() => setActiveTab('compras')}
                                        className="flex items-center gap-1.5 bg-zinc-800 text-zinc-200 px-3.5 py-2 rounded-lg text-xs font-bold hover:bg-zinc-700 transition-all"
                                    >
                                        <Truck size={14} />
                                        Ir a Compras
                                    </button>
                                </div>
                            </div>

                            <div className="grid grid-cols-2 lg:grid-cols-4 gap-6">
                                <div className="bg-zinc-900 border border-zinc-800/60 p-6 rounded-2xl">
                                    <p className="text-zinc-400 text-[10px] uppercase tracking-widest font-bold mb-2">Total Insumos</p>
                                    <h3 className="text-3xl font-bold text-white">{inventoryStats?.totalInsumos || 0}</h3>
                                    <span className="text-[10px] text-zinc-500 bg-zinc-950/50 inline-block px-2 py-0.5 rounded mt-3">Registrados</span>
                                </div>

                                <div className="bg-zinc-900 border border-orange-500/30 p-6 rounded-2xl">
                                    <div className="flex items-center gap-1 mb-2">
                                        <AlertTriangle size={14} className="text-orange-400" />
                                        <p className="text-orange-400 text-[10px] uppercase tracking-widest font-bold">Stock Bajo</p>
                                    </div>
                                    <h3 className="text-3xl font-bold text-orange-400">{inventoryStats?.lowStock || 0}</h3>
                                    <span className="text-[10px] text-zinc-500 bg-zinc-950/50 inline-block px-2 py-0.5 rounded mt-3">Revisar pronto</span>
                                </div>

                                <div className="bg-zinc-900 border border-red-500/30 p-6 rounded-2xl">
                                    <div className="flex items-center gap-1 mb-2">
                                        <PackageX size={14} className="text-red-400" />
                                        <p className="text-red-400 text-[10px] uppercase tracking-widest font-bold">Agotados</p>
                                    </div>
                                    <h3 className="text-3xl font-bold text-red-400">{inventoryStats?.outOfStock || 0}</h3>
                                    <span className="text-[10px] text-zinc-500 bg-zinc-950/50 inline-block px-2 py-0.5 rounded mt-3">Sin stock</span>
                                </div>

                                <div className="bg-zinc-900 border border-gold/30 p-6 rounded-2xl">
                                    <p className="text-gold text-[10px] uppercase tracking-widest font-bold mb-2">Valor Inventario</p>
                                    <h3 className="text-3xl font-bold text-white">${(inventoryStats?.totalValue || 0).toLocaleString()}</h3>
                                    <span className="text-[10px] text-zinc-500 bg-zinc-950/50 inline-block px-2 py-0.5 rounded mt-3">Costo estimado</span>
                                </div>
                            </div>

                            {/* Low Stock Table */}
                            <div className="bg-zinc-900 border border-zinc-800/60 rounded-2xl overflow-hidden">
                                <div className="p-4 border-b border-zinc-850 bg-zinc-950/20 flex items-center gap-2">
                                    <AlertTriangle size={16} className="text-fire" />
                                    <h3 className="text-sm font-semibold text-white">Insumos con Stock Bajo</h3>
                                </div>
                                <div className="overflow-x-auto">
                                    <table className="w-full text-left border-collapse">
                                        <thead>
                                            <tr className="bg-zinc-950/40 border-b border-zinc-800 text-[9px] uppercase font-bold text-zinc-400">
                                                <th className="p-3">Insumo</th>
                                                <th className="p-3 text-center">Stock Mínimo</th>
                                                <th className="p-3 text-center">Stock Actual</th>
                                                <th className="p-3">Unidad</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-zinc-850 text-xs">
                                            {lowStockList.length === 0 ? (
                                                <tr>
                                                    <td colSpan="4" className="p-6 text-center text-zinc-500">No hay insumos con stock bajo</td>
                                                </tr>
                                            ) : (
                                                lowStockList.map(ins => (
                                                    <tr key={ins.id} className="hover:bg-zinc-850/10">
                                                        <td className="p-3 font-medium text-zinc-200">{ins.nombre}</td>
                                                        <td className="p-3 text-center text-zinc-400">{ins.stock_minimo}</td>
                                                        <td className="p-3 text-center font-bold text-fire">{ins.stock_actual}</td>
                                                        <td className="p-3 text-zinc-400">{ins.unidad_medida}</td>
                                                    </tr>
                                                ))
                                            )}
                                        </tbody>
                                    </table>
                                </div>
                            </div>

                            {/* Out of Stock Table */}
                            <div className="bg-zinc-900 border border-red-500/20 rounded-2xl overflow-hidden">
                                <div className="p-4 border-b border-red-500/20 bg-red-500/5 flex items-center gap-2">
                                    <PackageX size={16} className="text-red-400" />
                                    <h3 className="text-sm font-semibold text-red-400">Insumos Agotados</h3>
                                </div>
                                <div className="overflow-x-auto">
                                    <table className="w-full text-left border-collapse">
                                        <thead>
                                            <tr className="bg-zinc-950/40 border-b border-zinc-800 text-[9px] uppercase font-bold text-zinc-400">
                                                <th className="p-3">Insumo</th>
                                                <th className="p-3">Unidad</th>
                                                <th className="p-3">Estado</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-zinc-850 text-xs">
                                            {outOfStockList.length === 0 ? (
                                                <tr>
                                                    <td colSpan="3" className="p-6 text-center text-zinc-500">No hay insumos agotados</td>
                                                </tr>
                                            ) : (
                                                outOfStockList.map(ins => (
                                                    <tr key={ins.id} className="hover:bg-zinc-850/10">
                                                        <td className="p-3 font-medium text-zinc-200">{ins.nombre}</td>
                                                        <td className="p-3 text-zinc-400">{ins.unidad_medida}</td>
                                                        <td className="p-3">
                                                            <span className="text-[9px] font-bold px-2 py-0.5 rounded bg-red-500/10 text-red-400">AGOTADO</span>
                                                        </td>
                                                    </tr>
                                                ))
                                            )}
                                        </tbody>
                                    </table>
                                </div>
                            </div>

                            {/* Top Consumption */}
                            {consumptionData.length > 0 && (
                                <div className="bg-zinc-900 border border-zinc-800/60 rounded-2xl overflow-hidden">
                                    <div className="p-4 border-b border-zinc-850 bg-zinc-950/20">
                                        <h3 className="text-sm font-semibold text-zinc-300">Insumos con Mayor Consumo</h3>
                                    </div>
                                    <div className="overflow-x-auto">
                                        <table className="w-full text-left border-collapse">
                                            <thead>
                                                <tr className="bg-zinc-950/40 border-b border-zinc-800 text-[9px] uppercase font-bold text-zinc-400">
                                                    <th className="p-3">Insumo</th>
                                                    <th className="p-3 text-right">Total Comprado</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-zinc-850 text-xs">
                                                {consumptionData.map((item, i) => (
                                                    <tr key={i} className="hover:bg-zinc-850/10">
                                                        <td className="p-3 font-medium text-zinc-200">{item.name}</td>
                                                        <td className="p-3 text-right font-mono">{item.cantidad}</td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* ===== Fidelity Analytics Section ===== */}
                        <div className="space-y-6">
                            <h2 className="text-xl font-serif text-white flex items-center gap-2">
                                <Flame size={18} className="text-fire" />
                                Analítica de Fidelización
                            </h2>

                            <div className="grid grid-cols-2 lg:grid-cols-4 gap-6">
                                <div className="bg-zinc-900 border border-zinc-800/60 p-6 rounded-2xl">
                                    <p className="text-fire text-[10px] uppercase tracking-widest font-bold mb-2">Sellos Otorgados</p>
                                    <h3 className="text-3xl font-bold text-white">{loyaltyPeriodStats?.stampsIssued || 0}</h3>
                                    <span className="text-[10px] text-zinc-400 bg-zinc-950/50 inline-block px-2 py-0.5 rounded mt-3">En el período</span>
                                </div>

                                <div className="bg-zinc-900 border border-zinc-800/60 p-6 rounded-2xl">
                                    <p className="text-gold text-[10px] uppercase tracking-widest font-bold mb-2">Premios Canjeados</p>
                                    <h3 className="text-3xl font-bold text-white">{loyaltyPeriodStats?.redemptions || 0}</h3>
                                    <span className="text-[10px] text-zinc-400 bg-zinc-950/50 inline-block px-2 py-0.5 rounded mt-3">En el período</span>
                                </div>

                                <div className="bg-zinc-900 border border-zinc-800/60 p-6 rounded-2xl">
                                    <p className="text-zinc-400 text-[10px] uppercase tracking-widest font-bold mb-2">Clientes con 10+ Fuegos</p>
                                    <h3 className="text-3xl font-bold text-white">{stats.pendingRewards}</h3>
                                    <span className="text-[10px] text-zinc-500 bg-zinc-950/50 inline-block px-2 py-0.5 rounded mt-3">Premios listos</span>
                                </div>

                                <div className="bg-zinc-900 border border-zinc-800/60 p-6 rounded-2xl">
                                    <p className="text-blue-500 text-[10px] uppercase tracking-widest font-bold mb-2">Clientes Activos</p>
                                    <h3 className="text-3xl font-bold text-white">{stats.totalClients}</h3>
                                    <span className="text-[10px] text-zinc-400 bg-zinc-950/50 inline-block px-2 py-0.5 rounded mt-3">Registrados</span>
                                </div>
                            </div>
                        </div>

                        {/* ===== Cash Flow Summary Section ===== */}
                        <div className="space-y-6">
                            <div className="flex flex-wrap justify-between items-center gap-3">
                                <h2 className="text-xl font-serif text-white flex items-center gap-2">
                                    <PiggyBank size={18} className="text-fire" />
                                    Resumen de Caja
                                </h2>
                                <div className="flex gap-2">
                                    <button
                                        onClick={() => { setActiveTab('caja'); fetchDashboardData(); }}
                                        className="flex items-center gap-1.5 bg-fire text-white px-3.5 py-2 rounded-lg text-xs font-bold hover:bg-orange-700 transition-all"
                                    >
                                        <DollarSign size={14} />
                                        Ver Movimientos
                                    </button>
                                    <button
                                        onClick={() => navigate('/pos')}
                                        className="flex items-center gap-1.5 bg-zinc-800 text-zinc-200 px-3.5 py-2 rounded-lg text-xs font-bold hover:bg-zinc-700 transition-all"
                                    >
                                        <ShoppingCart size={14} />
                                        Ir al POS
                                    </button>
                                </div>
                            </div>

                            <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
                                <div className="bg-zinc-900 border border-green-500/20 p-5 rounded-2xl">
                                    <p className="text-green-400 text-[10px] uppercase tracking-widest font-bold mb-2">Total Ingresado</p>
                                    <h3 className="text-2xl font-bold text-green-400">${(cashStats?.totalIngresos || 0).toLocaleString()}</h3>
                                    <span className="text-[10px] text-zinc-500 bg-zinc-950/50 inline-block px-2 py-0.5 rounded mt-2">{cashStats?.totalMovements || 0} movs</span>
                                </div>

                                <div className="bg-zinc-900 border border-fire/30 p-5 rounded-2xl">
                                    <p className="text-fire text-[10px] uppercase tracking-widest font-bold mb-2">💵 Efectivo Neto</p>
                                    <h3 className="text-2xl font-bold text-white">${(cashStats?.efectivoNeto || 0).toLocaleString()}</h3>
                                    <span className="text-[10px] text-zinc-500 bg-zinc-950/50 inline-block px-2 py-0.5 rounded mt-2">Caja física</span>
                                </div>

                                <div className="bg-zinc-900 border border-pink-500/30 p-5 rounded-2xl">
                                    <p className="text-pink-400 text-[10px] uppercase tracking-widest font-bold mb-2">📱 Nequi</p>
                                    <h3 className="text-2xl font-bold text-pink-400">${(cashStats?.nequiIngresos || 0).toLocaleString()}</h3>
                                    <span className="text-[10px] text-zinc-500 bg-zinc-950/50 inline-block px-2 py-0.5 rounded mt-2">Transferencias</span>
                                </div>

                                <div className="bg-zinc-900 border border-yellow-500/30 p-5 rounded-2xl">
                                    <p className="text-yellow-400 text-[10px] uppercase tracking-widest font-bold mb-2">🏦 Bancolombia</p>
                                    <h3 className="text-2xl font-bold text-yellow-400">${(cashStats?.bancolombiaIngresos || 0).toLocaleString()}</h3>
                                    <span className="text-[10px] text-zinc-500 bg-zinc-950/50 inline-block px-2 py-0.5 rounded mt-2">QR / Transf.</span>
                                </div>

                                <div className="bg-zinc-900 border border-red-500/20 p-5 rounded-2xl">
                                    <p className="text-red-400 text-[10px] uppercase tracking-widest font-bold mb-2">Total Egresado</p>
                                    <h3 className="text-2xl font-bold text-red-400">${(cashStats?.totalEgresos || 0).toLocaleString()}</h3>
                                    <span className="text-[10px] text-zinc-500 bg-zinc-950/50 inline-block px-2 py-0.5 rounded mt-2">Salidas</span>
                                </div>
                            </div>

                            {/* Purchase Metrics */}
                            {purchaseStats && (
                                <div className="bg-zinc-900 border border-zinc-800/60 rounded-2xl p-6">
                                    <div className="grid grid-cols-2 md:grid-cols-4 gap-6 text-center">
                                        <div>
                                            <p className="text-zinc-400 text-[10px] uppercase tracking-wider font-bold mb-1">Compras Reg.</p>
                                            <p className="text-2xl font-bold text-white">{purchaseStats.totalCompras}</p>
                                        </div>
                                        <div>
                                            <p className="text-zinc-400 text-[10px] uppercase tracking-wider font-bold mb-1">Total Compras</p>
                                            <p className="text-2xl font-bold text-fire">${purchaseStats.totalAmount.toLocaleString()}</p>
                                        </div>
                                        <div>
                                            <p className="text-green-400 text-[10px] uppercase tracking-wider font-bold mb-1">Recibidas</p>
                                            <p className="text-2xl font-bold text-green-400">{purchaseStats.received}</p>
                                        </div>
                                        <div>
                                            <p className="text-yellow-400 text-[10px] uppercase tracking-wider font-bold mb-1">Borradores</p>
                                            <p className="text-2xl font-bold text-yellow-400">{purchaseStats.draft}</p>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* Sessions Summary */}
                            {sessionsStats && (
                                <div className="bg-zinc-900 border border-zinc-800/60 rounded-2xl overflow-hidden">
                                    <div className="p-4 border-b border-zinc-850 bg-zinc-950/20">
                                        <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                                            <Clock size={16} className="text-fire" />
                                            Sesiones de Caja ({sessionsStats.totalSessions})
                                        </h3>
                                    </div>
                                    <div className="overflow-x-auto">
                                        <table className="w-full text-left border-collapse">
                                            <thead>
                                                <tr className="bg-zinc-950/40 border-b border-zinc-800 text-[9px] uppercase font-bold text-zinc-400">
                                                    <th className="p-3">Trabajador</th>
                                                    <th className="p-3">Apertura</th>
                                                    <th className="p-3">Estado</th>
                                                    <th className="p-3 text-right">Diferencia</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-zinc-850 text-xs">
                                                {sessionsList.length === 0 ? (
                                                    <tr>
                                                        <td colSpan="4" className="p-6 text-center text-zinc-500">No hay sesiones en el período</td>
                                                    </tr>
                                                ) : (
                                                    sessionsList.slice(0, 10).map(sesion => (
                                                        <tr key={sesion.id} className="hover:bg-zinc-850/10">
                                                            <td className="p-3 font-medium text-zinc-200">{sesion.perfiles_trabajadores?.nombre || 'Desconocido'}</td>
                                                            <td className="p-3 text-zinc-400 font-mono">${Number(sesion.monto_apertura || 0).toLocaleString()}</td>
                                                            <td className="p-3">
                                                                <span className={`text-[9px] font-bold px-2 py-0.5 rounded ${sesion.estado === 'ABIERTA'
                                                                        ? 'bg-green-500/10 text-green-400'
                                                                        : 'bg-zinc-800 text-zinc-500'
                                                                    }`}>
                                                                    {sesion.estado}
                                                                </span>
                                                            </td>
                                                            <td className="p-3 text-right font-mono">
                                                                {sesion.diferencia !== undefined && sesion.estado === 'CERRADA'
                                                                    ? <span className={Number(sesion.diferencia) > 0 ? 'text-red-400' : Number(sesion.diferencia) < 0 ? 'text-green-400' : 'text-zinc-400'}>${Number(sesion.diferencia || 0).toLocaleString()}</span>
                                                                    : <span className="text-zinc-600">—</span>
                                                                }
                                                            </td>
                                                        </tr>
                                                    ))
                                                )}
                                            </tbody>
                                        </table>
                                    </div>
                                    <div className="p-4 border-t border-zinc-850 bg-zinc-950/10 flex justify-between items-center text-xs">
                                        <span className="text-zinc-400">Abiertas: <span className="text-green-400 font-bold">{sessionsStats.openCount}</span></span>
                                        <span className="text-zinc-400">Cerradas: <span className="text-zinc-300 font-bold">{sessionsStats.closedCount}</span></span>
                                        <span className="text-zinc-400">Total Aperturas: <span className="text-fire font-bold">${sessionsStats.totalApertura.toLocaleString()}</span></span>
                                        {sessionsStats.arqueoDiferencias !== undefined && (
                                            <span className="text-zinc-400">Diferencias Arqueo: <span className={`font-bold ${Number(sessionsStats.arqueoDiferencias) > 0 ? 'text-red-400' : Number(sessionsStats.arqueoDiferencias) < 0 ? 'text-green-400' : 'text-zinc-400'}`}>${Math.abs(Number(sessionsStats.arqueoDiferencias)).toLocaleString()}</span></span>
                                        )}
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {activeTab === 'clientes' && (
                    <div className="space-y-8 font-sans">
                        {/* Title Header */}
                        <div>
                            <h1 className="text-3xl font-serif text-white flex items-center gap-3">
                                <Users size={28} className="text-fire" />
                                Clientes y Fidelización
                            </h1>
                            <p className="text-zinc-500 text-sm mt-1">Gestión integral de la base de clientes, ranking de fuegos acumulados y registro de canjes</p>
                        </div>

                        {/* Top Fidelity Metrics KPI Cards */}
                        <div className="grid grid-cols-2 lg:grid-cols-4 gap-6">
                            <div className="bg-zinc-900 border border-zinc-800/60 p-6 rounded-2xl relative overflow-hidden group hover:border-zinc-700 transition-colors">
                                <div className="absolute top-0 right-0 p-6 opacity-5 group-hover:opacity-10 transition-opacity">
                                    <Users size={64} className="text-white" />
                                </div>
                                <p className="text-zinc-500 text-[10px] uppercase tracking-widest font-bold mb-2">Total Clientes</p>
                                <h3 className="text-3xl font-bold text-white">{stats.totalClients}</h3>
                                <span className="text-[10px] text-zinc-400 bg-zinc-950/50 inline-block px-2 py-0.5 rounded mt-3">Registrados en base</span>
                            </div>

                            <div className="bg-zinc-900 border border-zinc-800/60 p-6 rounded-2xl relative overflow-hidden group hover:border-fire/40 transition-colors">
                                <div className="absolute top-0 right-0 p-6 opacity-5 group-hover:opacity-10 transition-opacity">
                                    <Flame size={64} className="text-fire" />
                                </div>
                                <p className="text-fire text-[10px] uppercase tracking-widest font-bold mb-2">Fuego Generado</p>
                                <h3 className="text-3xl font-bold text-white">{stats.totalStamps}</h3>
                                <span className="text-[10px] text-orange-200/40 bg-fire/5 inline-block px-2 py-0.5 rounded mt-3">Sellos asignados</span>
                            </div>

                            <div className="bg-zinc-900 border border-zinc-800/60 p-6 rounded-2xl relative overflow-hidden group hover:border-gold/40 transition-colors">
                                <div className="absolute top-0 right-0 p-6 opacity-5 group-hover:opacity-10 transition-opacity">
                                    <Trophy size={64} className="text-gold" />
                                </div>
                                <p className="text-gold text-[10px] uppercase tracking-widest font-bold mb-2">Premios Listos</p>
                                <h3 className="text-3xl font-bold text-white">{stats.pendingRewards}</h3>
                                <span className="text-[10px] text-yellow-200/40 bg-gold/5 inline-block px-2 py-0.5 rounded mt-3">Clientes con 10+ fuegos</span>
                            </div>

                            <div className="bg-zinc-900 border border-zinc-800/60 p-6 rounded-2xl relative overflow-hidden group hover:border-blue-500/40 transition-colors">
                                <div className="absolute top-0 right-0 p-6 opacity-5 group-hover:opacity-10 transition-opacity">
                                    <Gift size={64} className="text-blue-500" />
                                </div>
                                <p className="text-blue-500 text-[10px] uppercase tracking-widest font-bold mb-2">Premios Canjeados</p>
                                <h3 className="text-3xl font-bold text-white">{stats.totalRedemptions}</h3>
                                <span className="text-[10px] text-blue-200/40 bg-blue-500/5 inline-block px-2 py-0.5 rounded mt-3">Entregados históricamente</span>
                            </div>
                        </div>

                        {/* Side-by-Side Grid: Top 10 Stamp Clients & Recent Clients */}
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">

                            {/* Top 10 Clientes con Más Sellos */}
                            <div className="bg-zinc-900 border border-zinc-800/60 rounded-2xl overflow-hidden shadow-xl">
                                <div className="p-4 border-b border-zinc-850 bg-zinc-950/40 flex items-center justify-between">
                                    <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                                        <Trophy size={16} className="text-gold" />
                                        Top 10 Clientes con Más Sellos
                                    </h3>
                                    <span className="text-[10px] text-gold font-bold bg-gold/10 px-2 py-0.5 rounded border border-gold/20">Fidelización Alta</span>
                                </div>
                                <div className="overflow-x-auto">
                                    <table className="w-full text-left border-collapse">
                                        <thead>
                                            <tr className="bg-zinc-950/60 border-b border-zinc-800 text-[9px] uppercase font-bold text-zinc-400">
                                                <th className="p-3">#</th>
                                                <th className="p-3">Cliente</th>
                                                <th className="p-3 text-center">Fuegos</th>
                                                <th className="p-3 text-right">Celular</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-zinc-850 text-xs">
                                            {topStampClients.length === 0 ? (
                                                <tr>
                                                    <td colSpan="4" className="p-6 text-center text-zinc-500">No hay clientes con sellos registrados</td>
                                                </tr>
                                            ) : (
                                                topStampClients.map((client, idx) => (
                                                    <tr key={client.id} className="hover:bg-zinc-850/20 transition-colors">
                                                        <td className="p-3 text-zinc-500 font-mono text-[10px]">{idx + 1}</td>
                                                        <td className="p-3 font-medium text-zinc-200">{client.nombre || 'Sin Nombre'}</td>
                                                        <td className="p-3 text-center">
                                                            <span className={`font-bold font-mono ${client.stamps_count >= 10 ? 'text-gold' : 'text-fire'}`}>
                                                                🔥 {client.stamps_count}
                                                            </span>
                                                        </td>
                                                        <td className="p-3 text-right text-zinc-400 font-mono text-[11px]">{client.celular || '-'}</td>
                                                    </tr>
                                                ))
                                            )}
                                        </tbody>
                                    </table>
                                </div>
                            </div>

                            {/* Clientes Recientes */}
                            <div className="bg-zinc-900 border border-zinc-800/60 rounded-2xl overflow-hidden shadow-xl">
                                <div className="p-4 border-b border-zinc-850 bg-zinc-950/40 flex items-center justify-between">
                                    <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                                        <Users size={16} className="text-fire" />
                                        Clientes Recientes Registrados
                                    </h3>
                                    <span className="text-[10px] text-zinc-400 font-bold bg-zinc-800 px-2 py-0.5 rounded">Últimos 10</span>
                                </div>
                                <div className="divide-y divide-zinc-850 max-h-[380px] overflow-y-auto">
                                    {recentClients.length === 0 ? (
                                        <div className="p-6 text-center text-zinc-500 text-xs">No hay registros recientes</div>
                                    ) : (
                                        recentClients.map(client => (
                                            <div key={client.id} className="p-3.5 flex items-center justify-between hover:bg-zinc-850/30 transition-colors">
                                                <div className="flex items-center gap-3">
                                                    <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs ${client.stamps_count >= 10 ? 'bg-gold text-black' : 'bg-zinc-800 text-zinc-400'}`}>
                                                        {client.nombre ? client.nombre.charAt(0).toUpperCase() : '?'}
                                                    </div>
                                                    <div>
                                                        <p className="text-xs font-semibold text-zinc-200">{client.nombre || 'Sin Nombre'}</p>
                                                        <p className="text-[11px] text-zinc-500 font-mono">{client.celular || 'Sin Celular'}</p>
                                                    </div>
                                                </div>
                                                <div className="flex items-center gap-4">
                                                    {client.stamps_count >= 10 && (
                                                        <button
                                                            onClick={() => handleRedeem(client.id, client.stamps_count)}
                                                            className="flex items-center gap-1 bg-gold text-black px-2 py-1 rounded text-[11px] font-bold hover:bg-yellow-400 transition-colors shadow"
                                                        >
                                                            <Award size={12} />
                                                            Canjear
                                                        </button>
                                                    )}
                                                    <span className={`text-xs font-bold font-mono ${client.stamps_count >= 10 ? 'text-gold' : 'text-fire'}`}>
                                                        {client.stamps_count} <span className="text-zinc-500 font-normal">Fuegos</span>
                                                    </span>
                                                    <Link to={`/admin/client/${client.id}`} className="text-zinc-500 hover:text-white transition-colors">
                                                        <ArrowRight size={15} />
                                                    </Link>
                                                </div>
                                            </div>
                                        ))
                                    )}
                                </div>
                            </div>
                        </div>

                        {/* Search Client Interactive Section */}
                        <div className="bg-zinc-900 border border-zinc-800/60 rounded-2xl overflow-hidden shadow-xl space-y-4 p-6">
                            <h2 className="text-md font-serif text-white flex items-center gap-2">
                                <Search size={18} className="text-fire" />
                                Buscador Global de Clientes
                            </h2>
                            <div className="relative w-full max-w-md">
                                <input
                                    type="text"
                                    placeholder="Buscar por teléfono o nombre..."
                                    className="w-full bg-black border border-zinc-800 rounded-xl px-4 py-2.5 text-sm text-white focus:border-fire outline-none transition-all pl-10"
                                    value={searchQuery}
                                    onChange={(e) => handleSearch(e.target.value)}
                                />
                                <div className="absolute left-3 top-3 text-zinc-500">
                                    <Users size={16} />
                                </div>
                                {isSearching && (
                                    <div className="absolute right-3 top-3.5">
                                        <div className="w-4 h-4 border-2 border-fire border-t-transparent rounded-full animate-spin"></div>
                                    </div>
                                )}
                            </div>

                            <div className="divide-y divide-zinc-850 bg-zinc-950/40 rounded-xl border border-zinc-850 overflow-hidden">
                                {searchQuery.length >= 3 ? (
                                    searchResults.length > 0 ? (
                                        searchResults.map(client => (
                                            <div key={client.id} className="p-4 flex items-center justify-between hover:bg-zinc-850/20 transition-colors">
                                                <div className="flex items-center gap-3">
                                                    <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm ${client.stamps_count >= 10 ? 'bg-gold text-black' : 'bg-zinc-800 text-zinc-400'}`}>
                                                        {client.nombre ? client.nombre.charAt(0).toUpperCase() : '?'}
                                                    </div>
                                                    <div>
                                                        <p className="text-sm font-semibold text-zinc-200">{client.nombre}</p>
                                                        <p className="text-xs text-zinc-500 font-mono">{client.celular}</p>
                                                    </div>
                                                </div>
                                                <div className="flex items-center gap-4">
                                                    {client.stamps_count >= 10 && (
                                                        <button
                                                            onClick={() => handleRedeem(client.id, client.stamps_count)}
                                                            className="flex items-center gap-1 bg-gold text-black px-2.5 py-1 rounded text-xs font-bold hover:bg-yellow-400 transition-colors"
                                                        >
                                                            <Award size={12} />
                                                            Canjear
                                                        </button>
                                                    )}
                                                    <span className={`text-xs font-bold font-mono ${client.stamps_count >= 10 ? 'text-gold' : 'text-fire'}`}>
                                                        {client.stamps_count} Fuegos
                                                    </span>
                                                    <Link to={`/admin/client/${client.id}`} className="text-zinc-500 hover:text-white transition-colors">
                                                        <ArrowRight size={16} />
                                                    </Link>
                                                </div>
                                            </div>
                                        ))
                                    ) : (
                                        <div className="p-8 text-center text-zinc-500 text-sm">No se encontraron clientes con "{searchQuery}"</div>
                                    )
                                ) : (
                                    <div className="p-8 text-center text-zinc-500 text-sm">Escribe al menos 3 caracteres para iniciar la búsqueda</div>
                                )}
                            </div>
                        </div>
                    </div>
                )}

                {activeTab === 'ventas' && (
                    <div className="space-y-6">
                        <SectionHeader
                            title="Ventas"
                            subtitle="Historial general de ventas realizadas en el POS"
                            icon={ShoppingBag}
                            actions={
                                <Link to="/pos" className="bg-fire text-white px-4 py-2 rounded-xl text-sm font-bold shadow-lg shadow-fire/10 hover:bg-orange-700 transition-all uppercase tracking-wider">
                                    Nueva Venta (POS)
                                </Link>
                            }
                        />

                        {/* Sales List */}
                        <div className="bg-zinc-900 border border-zinc-800/60 rounded-2xl overflow-hidden">

                            {/* Loading */}
                            {ventasLoading && (
                                <div className="flex items-center justify-center py-16 gap-3 text-zinc-500">
                                    <svg className="animate-spin w-5 h-5 text-fire" viewBox="0 0 24 24" fill="none">
                                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                                    </svg>
                                    <span className="text-sm">Cargando ventas…</span>
                                </div>
                            )}

                            {/* Error */}
                            {!ventasLoading && ventasError && (
                                <div className="p-6">
                                    <ErrorBanner message={ventasError} onRetry={() => fetchVentas(ventasPage)} />
                                </div>
                            )}

                            {/* Empty */}
                            {!ventasLoading && !ventasError && ventasPageData.length === 0 && (
                                <div className="py-16 text-center text-zinc-500 text-sm">
                                    No se han registrado ventas aún
                                </div>
                            )}

                            {/* Desktop table — oculta en mobile */}
                            {!ventasLoading && !ventasError && ventasPageData.length > 0 && (
                                <div className="hidden md:block overflow-x-auto">
                                    <table className="w-full text-left border-collapse">
                                        <thead>
                                            <tr className="bg-zinc-950/40 border-b border-zinc-800 text-[10px] uppercase font-bold text-zinc-400 tracking-wider">
                                                <th className="p-4">Fecha</th>
                                                <th className="p-4">Cliente</th>
                                                <th className="p-4">Registrado por</th>
                                                <th className="p-4">Pago</th>
                                                <th className="p-4 text-right">Total</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-zinc-800 text-sm">
                                            {ventasPageData.map(sale => (
                                                <tr key={sale.id} className="hover:bg-zinc-800/20 transition-colors">
                                                    <td className="p-4 text-xs text-zinc-400">
                                                        {new Date(sale.fecha).toLocaleString('es-ES')}
                                                    </td>
                                                    <td className="p-4 font-medium text-zinc-200">
                                                        {sale.clientes?.nombre || <span className="text-zinc-600 italic text-xs">Venta Anónima</span>}
                                                    </td>
                                                    <td className="p-4 text-xs text-zinc-400">
                                                        {sale.perfiles_trabajadores?.nombre || 'Desconocido'}
                                                    </td>
                                                    <td className="p-4">
                                                        <span className="text-[10px] font-bold uppercase bg-zinc-800 text-zinc-300 px-2 py-0.5 rounded">
                                                            {sale.metodo_pago}
                                                        </span>
                                                    </td>
                                                    <td className="p-4 text-right font-bold text-zinc-100">
                                                        ${Number(sale.total).toLocaleString()}
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            )}

                            {/* Mobile cards — visibles solo en mobile */}
                            {!ventasLoading && !ventasError && ventasPageData.length > 0 && (
                                <div className="md:hidden divide-y divide-zinc-800">
                                    {ventasPageData.map(sale => (
                                        <div key={sale.id} className="p-4 space-y-1.5">
                                            {/* Nivel 1 — primario */}
                                            <div className="flex items-center justify-between gap-2">
                                                <span className="text-xs text-zinc-400">
                                                    {new Date(sale.fecha).toLocaleString('es-ES', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                                                </span>
                                                <span className="font-bold text-zinc-100 text-base">
                                                    ${Number(sale.total).toLocaleString()}
                                                </span>
                                            </div>
                                            {/* Nivel 2 — secundario */}
                                            <div className="flex items-center gap-2 flex-wrap">
                                                <span className="text-[10px] font-bold uppercase bg-zinc-800 text-zinc-300 px-2 py-0.5 rounded">
                                                    {sale.metodo_pago}
                                                </span>
                                                <span className="text-xs text-zinc-400">
                                                    {sale.clientes?.nombre || <span className="italic text-zinc-600">Anónimo</span>}
                                                </span>
                                                <span className="text-[10px] text-zinc-600">
                                                    · {sale.perfiles_trabajadores?.nombre || 'Desconocido'}
                                                </span>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}

                            {/* Pagination */}
                            {!ventasLoading && !ventasError && (
                                <Pagination
                                    currentPage={ventasPage}
                                    totalPages={Math.ceil(ventasTotal / PAGE_SIZE)}
                                    totalItems={ventasTotal}
                                    pageSize={PAGE_SIZE}
                                    onPrev={() => fetchVentas(ventasPage - 1)}
                                    onNext={() => fetchVentas(ventasPage + 1)}
                                />
                            )}
                        </div>
                    </div>
                )}


                {activeTab === 'caja' && (
                    <div className="space-y-6">
                        <SectionHeader
                            title="Arqueo y Caja"
                            subtitle="Seguimiento de movimientos financieros y balance de caja por cuenta oficial"
                            icon={PiggyBank}
                        />

                        {/* Financial Accounts Breakdown (Tesorería) */}
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                            <div className="bg-zinc-900 border border-green-500/30 p-5 rounded-2xl flex items-center justify-between shadow-lg">
                                <div>
                                    <p className="text-green-400 text-[10px] uppercase tracking-widest font-bold">💵 Cuenta Efectivo</p>
                                    <h3 className="text-2xl font-bold text-white mt-1">
                                        ${(movementsList.filter(m => m.metodo_pago === 'EFECTIVO' && m.tipo === 'INGRESO').reduce((sum, m) => sum + Number(m.monto || 0), 0) - movementsList.filter(m => m.metodo_pago === 'EFECTIVO' && m.tipo === 'EGRESO').reduce((sum, m) => sum + Number(m.monto || 0), 0)).toLocaleString()}
                                    </h3>
                                    <span className="text-[10px] text-zinc-500 mt-1 block">Fondo de caja físico</span>
                                </div>
                                <div className="w-10 h-10 bg-green-500/10 text-green-400 rounded-xl flex items-center justify-center font-bold">
                                    EF
                                </div>
                            </div>

                            <div className="bg-zinc-900 border border-pink-500/30 p-5 rounded-2xl flex items-center justify-between shadow-lg">
                                <div>
                                    <p className="text-pink-400 text-[10px] uppercase tracking-widest font-bold">📱 Cuenta Nequi</p>
                                    <h3 className="text-2xl font-bold text-white mt-1">
                                        ${movementsList.filter(m => m.metodo_pago === 'NEQUI' && m.tipo === 'INGRESO').reduce((sum, m) => sum + Number(m.monto || 0), 0).toLocaleString()}
                                    </h3>
                                    <span className="text-[10px] text-zinc-500 mt-1 block">Transferencias bancarias Nequi</span>
                                </div>
                                <div className="w-10 h-10 bg-pink-500/10 text-pink-400 rounded-xl flex items-center justify-center font-bold">
                                    NQ
                                </div>
                            </div>

                            <div className="bg-zinc-900 border border-yellow-500/30 p-5 rounded-2xl flex items-center justify-between shadow-lg">
                                <div>
                                    <p className="text-yellow-400 text-[10px] uppercase tracking-widest font-bold">🏦 Cuenta Bancolombia</p>
                                    <h3 className="text-2xl font-bold text-white mt-1">
                                        ${movementsList.filter(m => m.metodo_pago === 'BANCOLOMBIA' && m.tipo === 'INGRESO').reduce((sum, m) => sum + Number(m.monto || 0), 0).toLocaleString()}
                                    </h3>
                                    <span className="text-[10px] text-zinc-500 mt-1 block">Transferencias QR Bancolombia</span>
                                </div>
                                <div className="w-10 h-10 bg-yellow-500/10 text-yellow-400 rounded-xl flex items-center justify-center font-bold">
                                    BC
                                </div>
                            </div>
                        </div>

                        {/* Movements List — paginado Fase 6.3 */}
                        <div className="bg-zinc-900 border border-zinc-800/60 rounded-2xl overflow-hidden">

                            {/* Loading */}
                            {movementsLoading && (
                                <div className="flex items-center justify-center py-16 gap-3 text-zinc-500">
                                    <svg className="animate-spin w-5 h-5 text-fire" viewBox="0 0 24 24" fill="none">
                                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                                    </svg>
                                    <span className="text-sm">Cargando movimientos…</span>
                                </div>
                            )}

                            {/* Error */}
                            {!movementsLoading && movementsError && (
                                <div className="p-6">
                                    <ErrorBanner message={movementsError} onRetry={() => fetchMovementsPage(movementsPage)} />
                                </div>
                            )}

                            {/* Empty */}
                            {!movementsLoading && !movementsError && movementsPageData.length === 0 && (
                                <div className="py-16 text-center text-zinc-500 text-sm">
                                    No se registran movimientos de caja
                                </div>
                            )}

                            {/* Desktop table */}
                            {!movementsLoading && !movementsError && movementsPageData.length > 0 && (
                                <div className="hidden md:block overflow-x-auto">
                                    <table className="w-full text-left border-collapse">
                                        <thead>
                                            <tr className="bg-zinc-950/40 border-b border-zinc-800 text-[10px] uppercase font-bold text-zinc-400 tracking-wider">
                                                <th className="p-4">Fecha</th>
                                                <th className="p-4">Tipo</th>
                                                <th className="p-4">Cuenta / Método</th>
                                                <th className="p-4">Descripción</th>
                                                <th className="p-4">Registrado por</th>
                                                <th className="p-4 text-right">Monto</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-zinc-800 text-sm">
                                            {movementsPageData.map(move => (
                                                <tr key={move.id} className="hover:bg-zinc-800/20 transition-colors">
                                                    <td className="p-4 text-xs text-zinc-400">
                                                        {new Date(move.fecha).toLocaleString('es-ES')}
                                                    </td>
                                                    <td className="p-4">
                                                        <span className={`text-[9px] font-bold px-2 py-0.5 rounded ${move.tipo === 'INGRESO' ? 'bg-green-500/10 text-green-400' : 'bg-red-500/10 text-red-400'}`}>
                                                            {move.tipo}
                                                        </span>
                                                    </td>
                                                    <td className="p-4 text-xs font-bold text-zinc-300">
                                                        {move.metodo_pago}
                                                    </td>
                                                    <td className="p-4 text-zinc-300 text-xs">
                                                        {move.descripcion}
                                                    </td>
                                                    <td className="p-4 text-xs text-zinc-400">
                                                        {move.perfiles_trabajadores?.nombre || 'Desconocido'}
                                                    </td>
                                                    <td className={`p-4 text-right font-bold ${move.tipo === 'INGRESO' ? 'text-green-400' : 'text-red-400'}`}>
                                                        ${Number(move.monto).toLocaleString()}
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            )}

                            {/* Mobile cards */}
                            {!movementsLoading && !movementsError && movementsPageData.length > 0 && (
                                <div className="md:hidden divide-y divide-zinc-800">
                                    {movementsPageData.map(move => (
                                        <div key={move.id} className="p-4 space-y-1.5">
                                            {/* Nivel 1 */}
                                            <div className="flex items-center justify-between gap-2">
                                                <div className="flex items-center gap-2">
                                                    <span className={`text-[9px] font-bold px-2 py-0.5 rounded ${move.tipo === 'INGRESO' ? 'bg-green-500/10 text-green-400' : 'bg-red-500/10 text-red-400'}`}>
                                                        {move.tipo}
                                                    </span>
                                                    <span className="text-xs text-zinc-400">
                                                        {new Date(move.fecha).toLocaleString('es-ES', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                                                    </span>
                                                </div>
                                                <span className={`font-bold text-base ${move.tipo === 'INGRESO' ? 'text-green-400' : 'text-red-400'}`}>
                                                    {move.tipo === 'INGRESO' ? '+' : '-'}${Number(move.monto).toLocaleString()}
                                                </span>
                                            </div>
                                            {/* Nivel 2 */}
                                            <div className="flex items-center gap-2 flex-wrap">
                                                <span className="text-xs font-bold text-zinc-300">{move.metodo_pago}</span>
                                                {move.descripcion && (
                                                    <span className="text-xs text-zinc-500">{move.descripcion}</span>
                                                )}
                                                <span className="text-[10px] text-zinc-600">· {move.perfiles_trabajadores?.nombre || 'Desconocido'}</span>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}

                            {/* Pagination */}
                            {!movementsLoading && !movementsError && (
                                <Pagination
                                    currentPage={movementsPage}
                                    totalPages={Math.ceil(movementsTotal / PAGE_SIZE)}
                                    totalItems={movementsTotal}
                                    pageSize={PAGE_SIZE}
                                    onPrev={() => fetchMovementsPage(movementsPage - 1)}
                                    onNext={() => fetchMovementsPage(movementsPage + 1)}
                                />
                            )}
                        </div>
                    </div>
                )}


                {activeTab === 'rentabilidad' && (
                    <div className="space-y-8">
                        <div>
                            <h1 className="text-3xl font-serif text-white flex items-center gap-2">
                                <TrendingUp className="text-fire" size={28} />
                                Rentabilidad y Resultado Operativo
                            </h1>
                            <p className="text-zinc-500 text-sm mt-1">Análisis financiero de Ingresos, Costo de Recetas (COGS), Gastos y Utilidad Neta</p>
                        </div>

                        {/* 5 Big Financial KPI Cards */}
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
                            <div className="bg-zinc-900 border border-green-500/30 p-5 rounded-2xl shadow-lg">
                                <p className="text-green-400 text-[10px] uppercase tracking-widest font-bold mb-1">Ingresos Totales (Ventas)</p>
                                <h3 className="text-2xl font-bold text-white">${(salesKPIs?.totalVentas || 0).toLocaleString()}</h3>
                                <span className="text-[10px] text-zinc-400 bg-zinc-950/50 inline-block px-2 py-0.5 rounded mt-2">Ventas netas cobradas</span>
                            </div>

                            <div className="bg-zinc-900 border border-gold/40 p-5 rounded-2xl shadow-lg">
                                <p className="text-gold text-[10px] uppercase tracking-widest font-bold mb-1">Utilidad Bruta</p>
                                <h3 className="text-2xl font-bold text-gold">${Math.round((salesKPIs?.totalVentas || 0) - (cogsTotal || 0)).toLocaleString()}</h3>
                                <span className="text-[10px] text-yellow-300/60 bg-gold/10 inline-block px-2 py-0.5 rounded mt-2">
                                    Margen Bruto: {((salesKPIs?.totalVentas || 0) > 0 ? (((salesKPIs?.totalVentas || 0) - (cogsTotal || 0)) / (salesKPIs?.totalVentas || 1) * 100).toFixed(1) : '0')}%
                                </span>
                            </div>

                            {/* F6-05: Gastos Operativos excluye egresos de compras para evitar doble conteo con COGS */}
                            <div className="bg-zinc-900 border border-red-500/30 p-5 rounded-2xl shadow-lg">
                                <p className="text-red-400 text-[10px] uppercase tracking-widest font-bold mb-1">Total Gastos Operativos</p>
                                {(() => {
                                    const nominaPagada = liquidacionesList.filter(l => l.estado === 'PAGADO').reduce((sum, l) => sum + Number(l.monto_calculado || 0), 0);
                                    const gastosRegistrados = gastosList.filter(g => g.estado !== 'ANULADO').reduce((sum, g) => sum + Number(g.monto || 0), 0);
                                    const otrosEgresos = movementsList.filter(m => m.tipo === 'EGRESO' && !m.compra_id && !m.gasto_id && !m.liquidacion_id).reduce((sum, m) => sum + Number(m.monto || 0), 0);
                                    return (
                                        <>
                                            <h3 className="text-2xl font-bold text-red-400">
                                                ${(nominaPagada + gastosRegistrados + otrosEgresos).toLocaleString()}
                                            </h3>
                                            <span className="text-[10px] text-zinc-400 bg-zinc-950/50 inline-block px-2 py-0.5 rounded mt-2">Nómina + Gastos + Otros Egresos (excl. Compras)</span>
                                        </>
                                    );
                                })()}
                            </div>

                            <div className="bg-zinc-900 border border-blue-500/40 p-5 rounded-2xl shadow-lg">
                                <p className="text-blue-400 text-[10px] uppercase tracking-widest font-bold mb-1">Utilidad Neta Operativa</p>
                                {/* F6-07: gastos = nómina pagada + gastos activos + otros egresos (no compras/gastos/liquidaciones) */}
                                {(() => {
                                    const nominaPagada = liquidacionesList.filter(l => l.estado === 'PAGADO').reduce((sum, l) => sum + Number(l.monto_calculado || 0), 0);
                                    const gastosRegistrados = gastosList.filter(g => g.estado !== 'ANULADO').reduce((sum, g) => sum + Number(g.monto || 0), 0);
                                    const otrosEgresos = movementsList.filter(m => m.tipo === 'EGRESO' && !m.compra_id && !m.gasto_id && !m.liquidacion_id).reduce((sum, m) => sum + Number(m.monto || 0), 0);
                                    const gastosOp = nominaPagada + gastosRegistrados + otrosEgresos;
                                    const utilidad = (salesKPIs?.totalVentas || 0) - (cogsTotal || 0) - gastosOp;
                                    return (
                                        <>
                                            <h3 className={`text-2xl font-bold ${utilidad >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                                                ${Math.round(utilidad).toLocaleString()}
                                            </h3>
                                            <span className="text-[10px] text-blue-300/60 bg-blue-500/10 inline-block px-2 py-0.5 rounded mt-2">
                                                Margen Neto: {((salesKPIs?.totalVentas || 0) > 0 ? (utilidad / (salesKPIs?.totalVentas || 1) * 100).toFixed(1) : '0')}%
                                            </span>
                                        </>
                                    );
                                })()}
                            </div>

                        </div>

                        {/* Detailed Financial Income Statement Table */}
                        <div className="bg-zinc-900 border border-zinc-800/60 rounded-2xl overflow-hidden shadow-2xl">
                            <div className="p-5 border-b border-zinc-800 bg-zinc-950/40 flex justify-between items-center">
                                <h3 className="font-serif font-bold text-white text-lg">Estado de Resultados Consolidado</h3>
                                <span className="text-xs text-zinc-500">Base de Cálculo: Ventas, Consumo de Recetas e Egresos</span>
                            </div>
                            <div className="p-6 space-y-4">
                                <div className="flex justify-between items-center py-2.5 border-b border-zinc-800 text-sm">
                                    <span className="font-semibold text-zinc-200">(+) Ingresos Brutos por Ventas</span>
                                    <span className="font-bold text-green-400">${(salesKPIs?.totalVentas || 0).toLocaleString()}</span>
                                </div>
                                <div className="flex justify-between items-center py-2.5 border-b border-zinc-800 text-sm">
                                    <span className="font-semibold text-zinc-300">(-) Costo de Recetas e Insumos (COGS)</span>
                                    <span className="font-bold text-fire">-${Math.round(cogsTotal || 0).toLocaleString()}</span>
                                </div>
                                <div className="flex justify-between items-center py-3 bg-zinc-950/60 px-4 rounded-xl text-base font-bold">
                                    <span className="text-gold">(=) UTILIDAD BRUTA</span>
                                    <span className="text-gold">${Math.round((salesKPIs?.totalVentas || 0) - (cogsTotal || 0)).toLocaleString()}</span>
                                </div>
                                <div className="flex justify-between items-center py-2.5 border-b border-zinc-800 text-sm">
                                    <span className="font-semibold text-zinc-300">(-) Nómina y Liquidaciones Pagadas</span>
                                    <span className="font-bold text-red-400">-${liquidacionesList.filter(l => l.estado === 'PAGADO').reduce((sum, l) => sum + Number(l.monto_calculado || 0), 0).toLocaleString()}</span>
                                </div>
                                <div className="flex justify-between items-center py-2.5 border-b border-zinc-800 text-sm">
                                    <span className="font-semibold text-zinc-300">(-) Gastos Operativos Registrados</span>
                                    <span className="font-bold text-red-400">-${gastosList.filter(g => g.estado !== 'ANULADO').reduce((sum, g) => sum + Number(g.monto || 0), 0).toLocaleString()}</span>
                                </div>
                                <div className="flex justify-between items-center py-2.5 border-b border-zinc-800 text-sm">
                                    <span className="font-semibold text-zinc-300">(-) Otros Egresos de Caja</span>
                                    <span className="font-bold text-red-400">-${movementsList.filter(m => m.tipo === 'EGRESO' && !m.compra_id && !m.gasto_id && !m.liquidacion_id).reduce((sum, m) => sum + Number(m.monto || 0), 0).toLocaleString()}</span>
                                </div>
                                {(() => {
                                    const nominaPagada = liquidacionesList.filter(l => l.estado === 'PAGADO').reduce((sum, l) => sum + Number(l.monto_calculado || 0), 0);
                                    const gastosRegistrados = gastosList.filter(g => g.estado !== 'ANULADO').reduce((sum, g) => sum + Number(g.monto || 0), 0);
                                    const otrosEgresos = movementsList.filter(m => m.tipo === 'EGRESO' && !m.compra_id && !m.gasto_id && !m.liquidacion_id).reduce((sum, m) => sum + Number(m.monto || 0), 0);
                                    const totalGastos = nominaPagada + gastosRegistrados + otrosEgresos;
                                    const resultado = (salesKPIs?.totalVentas || 0) - (cogsTotal || 0) - totalGastos;
                                    return (
                                        <div className="flex justify-between items-center py-4 bg-zinc-950 px-4 rounded-xl text-lg font-bold border border-zinc-800">
                                            <span className="text-white">(=) RESULTADO OPERATIVO NETO</span>
                                            <span className={resultado >= 0 ? 'text-green-400' : 'text-red-400'}>
                                                ${Math.round(resultado).toLocaleString()}
                                            </span>
                                        </div>
                                    );
                                })()}
                            </div>
                        </div>
                    </div>
                )}

                {activeTab === 'analitica' && (
                    <div className="space-y-8">
                        <div>
                            <h1 className="text-3xl font-serif text-white flex items-center gap-2">
                                <BarChart3 className="text-fire" size={28} />
                                Analítica de Negocios, Pareto 80/20 y Pronósticos
                            </h1>
                            <p className="text-zinc-500 text-sm mt-1">Identifica tus productos estrella y proyecta la demanda de unidades a 7 días para compras</p>
                        </div>

                        {(() => {
                            const productStats = {};
                            let grandTotalRevenue = 0;

                            const dates = salesList.map(s => new Date(s.fecha).getTime()).filter(t => !isNaN(t));
                            const minDate = dates.length > 0 ? Math.min(...dates) : Date.now();
                            const maxDate = dates.length > 0 ? Math.max(...dates) : Date.now();
                            const totalDays = Math.max(1, Math.ceil((maxDate - minDate) / (1000 * 60 * 60 * 24)) || 1);

                            salesList.forEach(sale => {
                                const items = sale.detalles?.items || [];
                                items.forEach(item => {
                                    const name = item.nombre || item.name || 'Producto Sin Nombre';
                                    const qty = Number(item.cantidad || item.quantity || 1);
                                    const price = Number(item.precio || item.price || 0);
                                    const lineTotal = qty * price;

                                    if (!productStats[name]) {
                                        productStats[name] = { name, quantity: 0, revenue: 0 };
                                    }
                                    productStats[name].quantity += qty;
                                    productStats[name].revenue += lineTotal;
                                    grandTotalRevenue += lineTotal;
                                });
                            });

                            const sorted = Object.values(productStats).sort((a, b) => b.revenue - a.revenue);

                            let runningCumulative = 0;
                            const paretoItems = sorted.map(item => {
                                const pct = grandTotalRevenue > 0 ? (item.revenue / grandTotalRevenue) * 100 : 0;
                                const isStar = runningCumulative < 80;
                                runningCumulative += pct;
                                const dailyAvg = item.quantity / totalDays;
                                const forecast7Days = Math.ceil(dailyAvg * 7);

                                return {
                                    ...item,
                                    pct: Number(pct.toFixed(1)),
                                    cumulativePct: Number(runningCumulative.toFixed(1)),
                                    dailyAvg: Number(dailyAvg.toFixed(1)),
                                    forecast7Days,
                                    isStar
                                };
                            });

                            const starProducts = paretoItems.filter(i => i.isStar);
                            const totalUnitsSold = paretoItems.reduce((sum, i) => sum + i.quantity, 0);
                            const totalForecast7Days = paretoItems.reduce((sum, i) => sum + i.forecast7Days, 0);

                            return (
                                <div className="space-y-8">
                                    {/* Top KPI Metric Cards */}
                                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
                                        <div className="bg-zinc-900 border border-gold/40 p-5 rounded-2xl shadow-lg flex items-center justify-between">
                                            <div>
                                                <p className="text-gold text-[10px] uppercase tracking-widest font-bold">⭐ Productos Estrella</p>
                                                <h3 className="text-3xl font-bold text-white mt-1">{starProducts.length}</h3>
                                                <span className="text-[10px] text-yellow-300/70 block mt-1">Generan el 80% de los ingresos</span>
                                            </div>
                                            <div className="w-12 h-12 bg-gold/10 text-gold rounded-2xl flex items-center justify-center font-bold">
                                                <Star size={24} />
                                            </div>
                                        </div>

                                        <div className="bg-zinc-900 border border-green-500/30 p-5 rounded-2xl shadow-lg flex items-center justify-between">
                                            <div>
                                                <p className="text-green-400 text-[10px] uppercase tracking-widest font-bold">Ingresos Analizados</p>
                                                <h3 className="text-3xl font-bold text-white mt-1">${grandTotalRevenue.toLocaleString()}</h3>
                                                <span className="text-[10px] text-zinc-400 block mt-1">Total histórico de ventas</span>
                                            </div>
                                            <div className="w-12 h-12 bg-green-500/10 text-green-400 rounded-2xl flex items-center justify-center font-bold">
                                                <DollarSign size={24} />
                                            </div>
                                        </div>

                                        <div className="bg-zinc-900 border border-fire/40 p-5 rounded-2xl shadow-lg flex items-center justify-between">
                                            <div>
                                                <p className="text-fire text-[10px] uppercase tracking-widest font-bold">Unidades Vendidas</p>
                                                <h3 className="text-3xl font-bold text-white mt-1">{totalUnitsSold.toLocaleString()}</h3>
                                                <span className="text-[10px] text-zinc-400 block mt-1">Volumen total despachado</span>
                                            </div>
                                            <div className="w-12 h-12 bg-fire/10 text-fire rounded-2xl flex items-center justify-center font-bold">
                                                <ShoppingBag size={24} />
                                            </div>
                                        </div>

                                        <div className="bg-zinc-900 border border-blue-500/30 p-5 rounded-2xl shadow-lg flex items-center justify-between">
                                            <div>
                                                <p className="text-blue-400 text-[10px] uppercase tracking-widest font-bold">Pronóstico 7 Días</p>
                                                <h3 className="text-3xl font-bold text-white mt-1">{totalForecast7Days} unids</h3>
                                                <span className="text-[10px] text-blue-300/70 block mt-1">Proyección estimación semanal</span>
                                            </div>
                                            <div className="w-12 h-12 bg-blue-500/10 text-blue-400 rounded-2xl flex items-center justify-center font-bold">
                                                <TrendingUp size={24} />
                                            </div>
                                        </div>
                                    </div>

                                    {/* Chart: Bar Chart for Top Products Revenue */}
                                    <div className="bg-zinc-900 border border-zinc-800/60 p-6 rounded-2xl shadow-2xl space-y-4">
                                        <div className="flex justify-between items-center border-b border-zinc-800 pb-3">
                                            <div>
                                                <h3 className="font-serif font-bold text-white text-lg flex items-center gap-2">
                                                    <BarChart3 className="text-fire" size={20} />
                                                    Distribución de Ingresos por Producto
                                                </h3>
                                                <p className="text-xs text-zinc-500">Comparativa de volumen de facturación por menú</p>
                                            </div>
                                        </div>

                                        {paretoItems.length === 0 ? (
                                            <div className="py-12 text-center text-zinc-500 text-xs">No hay datos suficientes de ventas para graficar</div>
                                        ) : (
                                            <div className="h-72 w-full pt-4">
                                                <ResponsiveContainer width="100%" height="100%">
                                                    <BarChart data={paretoItems.slice(0, 10)}>
                                                        <CartesianGrid strokeDasharray="3 3" stroke="#27272a" vertical={false} />
                                                        <XAxis dataKey="name" stroke="#71717a" fontSize={11} tickLine={false} />
                                                        <YAxis stroke="#71717a" fontSize={11} tickLine={false} tickFormatter={val => `$${val / 1000}k`} />
                                                        <Tooltip
                                                            contentStyle={{ backgroundColor: '#18181b', borderColor: '#3f3f46', borderRadius: '12px', color: '#fff' }}
                                                            formatter={(value) => [`$${value.toLocaleString()}`, 'Ingresos']}
                                                        />
                                                        <Bar dataKey="revenue" radius={[6, 6, 0, 0]}>
                                                            {paretoItems.slice(0, 10).map((entry, index) => (
                                                                <Cell key={`cell-${index}`} fill={entry.isStar ? '#ff4500' : '#52525b'} />
                                                            ))}
                                                        </Bar>
                                                    </BarChart>
                                                </ResponsiveContainer>
                                            </div>
                                        )}
                                    </div>

                                    {/* Table: Pareto Analysis 80/20 */}
                                    <div className="bg-zinc-900 border border-zinc-800/60 rounded-2xl overflow-hidden shadow-2xl">
                                        <div className="p-5 border-b border-zinc-800 bg-zinc-950/40 flex justify-between items-center">
                                            <div>
                                                <h3 className="font-serif font-bold text-white text-lg">Matriz de Pareto (Regla 80 / 20)</h3>
                                                <p className="text-xs text-zinc-500">Productos ordenados por porcentaje de contribución acumulada</p>
                                            </div>
                                            <span className="bg-gold/10 border border-gold/30 text-gold text-xs px-3 py-1 rounded-full font-bold">
                                                80% Ingresos = {starProducts.length} Productos
                                            </span>
                                        </div>

                                        <div className="overflow-x-auto">
                                            <table className="w-full text-left border-collapse">
                                                <thead>
                                                    <tr className="bg-zinc-950/40 border-b border-zinc-800 text-[10px] uppercase font-bold text-zinc-400 tracking-wider">
                                                        <th className="p-4">Clasificación Pareto</th>
                                                        <th className="p-4">Producto</th>
                                                        <th className="p-4 text-center">Unids Vendidas</th>
                                                        <th className="p-4 text-right">Ingresos Totales</th>
                                                        <th className="p-4 text-center">% Contribución</th>
                                                        <th className="p-4 text-center">% Acumulado</th>
                                                        <th className="p-4 text-right">Pronóstico (7 Días)</th>
                                                    </tr>
                                                </thead>
                                                <tbody className="divide-y divide-zinc-850 text-sm">
                                                    {paretoItems.length === 0 ? (
                                                        <tr>
                                                            <td colSpan="7" className="p-8 text-center text-zinc-500">No hay registradas ventas para procesar el análisis de Pareto</td>
                                                        </tr>
                                                    ) : (
                                                        paretoItems.map((item, idx) => (
                                                            <tr key={idx} className={`hover:bg-zinc-850/20 transition-colors ${item.isStar ? 'bg-fire/5' : ''}`}>
                                                                <td className="p-4">
                                                                    {item.isStar ? (
                                                                        <span className="bg-gold/15 text-gold border border-gold/40 text-[10px] font-extrabold px-2.5 py-1 rounded-lg inline-flex items-center gap-1 uppercase tracking-wider">
                                                                            <Star size={12} fill="#d4af37" />
                                                                            ⭐ Estrella (80%)
                                                                        </span>
                                                                    ) : (
                                                                        <span className="bg-zinc-800 text-zinc-400 text-[10px] font-bold px-2.5 py-1 rounded-lg inline-block uppercase">
                                                                            📦 Secundario (20%)
                                                                        </span>
                                                                    )}
                                                                </td>
                                                                <td className="p-4 font-bold text-white">
                                                                    {item.name}
                                                                </td>
                                                                <td className="p-4 text-center font-bold text-zinc-300">
                                                                    {item.quantity} unids
                                                                </td>
                                                                <td className="p-4 text-right font-extrabold text-green-400">
                                                                    ${item.revenue.toLocaleString()}
                                                                </td>
                                                                <td className="p-4 text-center">
                                                                    <span className="text-xs font-bold text-fire">{item.pct}%</span>
                                                                </td>
                                                                <td className="p-4 text-center">
                                                                    <div className="w-28 mx-auto space-y-1">
                                                                        <span className="text-[11px] font-bold text-zinc-300 block">{item.cumulativePct}%</span>
                                                                        <div className="w-full h-1.5 bg-zinc-800 rounded-full overflow-hidden">
                                                                            <div
                                                                                className={`h-full ${item.cumulativePct <= 80 ? 'bg-gold' : 'bg-zinc-600'}`}
                                                                                style={{ width: `${Math.min(100, item.cumulativePct)}%` }}
                                                                            />
                                                                        </div>
                                                                    </div>
                                                                </td>
                                                                <td className="p-4 text-right">
                                                                    <span className="bg-blue-500/10 border border-blue-500/30 text-blue-400 font-extrabold px-3 py-1 rounded-lg text-xs">
                                                                        🔮 ~{item.forecast7Days} unids
                                                                    </span>
                                                                </td>
                                                            </tr>
                                                        ))
                                                    )}
                                                </tbody>
                                            </table>
                                        </div>
                                    </div>

                                    {/* Section: 7-Day Demand Forecast & Purchase Recommendations */}
                                    <div className="bg-zinc-900 border border-blue-500/30 rounded-2xl overflow-hidden shadow-2xl space-y-4">
                                        <div className="p-5 border-b border-zinc-800 bg-zinc-950/40 flex justify-between items-center">
                                            <div>
                                                <h3 className="font-serif font-bold text-white text-lg flex items-center gap-2">
                                                    <TrendingUp className="text-blue-400" size={20} />
                                                    Planificación de Abastecimiento a 7 Días (Pronóstico)
                                                </h3>
                                                <p className="text-xs text-zinc-500">Estimación de insumos necesarios para cubrir la demanda proyectada de la próxima semana</p>
                                            </div>
                                        </div>

                                        <div className="p-6 grid grid-cols-1 md:grid-cols-3 gap-5">
                                            {starProducts.length === 0 ? (
                                                <p className="text-zinc-500 text-xs">No hay productos estrella calificados para pronóstico.</p>
                                            ) : (
                                                starProducts.map((prod, idx) => (
                                                    <div key={idx} className="bg-zinc-950 border border-zinc-800 p-4 rounded-xl space-y-3">
                                                        <div className="flex justify-between items-start">
                                                            <h4 className="font-bold text-white text-sm">{prod.name}</h4>
                                                            <span className="text-[10px] font-bold bg-gold/10 text-gold px-2 py-0.5 rounded border border-gold/30">Estrella</span>
                                                        </div>
                                                        <div className="space-y-1 text-xs text-zinc-400">
                                                            <p className="flex justify-between">
                                                                <span>Promedio Diario:</span>
                                                                <strong className="text-white">{prod.dailyAvg} unids/día</strong>
                                                            </p>
                                                            <p className="flex justify-between">
                                                                <span>Requerido Proxs. 7 Días:</span>
                                                                <strong className="text-blue-400 text-sm">{prod.forecast7Days} unidades</strong>
                                                            </p>
                                                        </div>
                                                        <div className="pt-2 border-t border-zinc-850">
                                                            <span className="text-[10px] text-zinc-500 block mb-1">Recomendación de Compra:</span>
                                                            <p className="text-xs text-zinc-300 bg-zinc-900 p-2 rounded border border-zinc-800">
                                                                Revisar stock de insumos para ensamblar mín. <strong>{prod.forecast7Days} unidades</strong>.
                                                            </p>
                                                        </div>
                                                    </div>
                                                ))
                                            )}
                                        </div>
                                    </div>
                                </div>
                            );
                        })()}
                    </div>
                )}

                {activeTab === 'liquidaciones' && (
                    <div className="space-y-6">
                        <div className="flex flex-wrap justify-between items-center gap-4">
                            <div>
                                <h1 className="text-3xl font-serif text-white">Liquidaciones de Trabajadores</h1>
                                <p className="text-zinc-500 text-sm mt-1">Obligaciones laborales por Turno, Hora o Venta y pagos en caja</p>
                            </div>
                            <button
                                onClick={() => {
                                    setSelectedWorkerForLiq(staffList[0] || null);
                                    setLiqMontoForm(staffList[0]?.tarifa_pago || 0);
                                    setLiqModalidadForm(staffList[0]?.modalidad_pago || 'POR_TURNO');
                                    setShowGenerarLiqModal(true);
                                }}
                                className="bg-fire hover:bg-orange-700 text-white px-4 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center gap-2 shadow-lg uppercase tracking-wider"
                            >
                                <Plus size={16} />
                                Generar Liquidación
                            </button>
                        </div>

                        {/* Liquidaciones Summary Cards */}
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                            <div className="bg-zinc-900 border border-yellow-500/30 p-5 rounded-2xl flex items-center justify-between">
                                <div>
                                    <p className="text-yellow-400 text-[10px] uppercase tracking-widest font-bold">Por Pagar (Pendientes)</p>
                                    <h3 className="text-2xl font-bold text-white mt-1">
                                        ${liquidacionesList.filter(l => l.estado === 'PENDIENTE').reduce((sum, l) => sum + Number(l.monto_calculado || 0), 0).toLocaleString()}
                                    </h3>
                                    <span className="text-[10px] text-zinc-500 mt-1 block">
                                        {liquidacionesList.filter(l => l.estado === 'PENDIENTE').length} liquidaciones pendientes
                                    </span>
                                </div>
                                <div className="w-10 h-10 bg-yellow-500/10 text-yellow-400 rounded-xl flex items-center justify-center font-bold text-xs">
                                    PEN
                                </div>
                            </div>

                            <div className="bg-zinc-900 border border-green-500/30 p-5 rounded-2xl flex items-center justify-between">
                                <div>
                                    <p className="text-green-400 text-[10px] uppercase tracking-widest font-bold">Total Pagado</p>
                                    <h3 className="text-2xl font-bold text-white mt-1">
                                        ${liquidacionesList.filter(l => l.estado === 'PAGADO').reduce((sum, l) => sum + Number(l.monto_calculado || 0), 0).toLocaleString()}
                                    </h3>
                                    <span className="text-[10px] text-zinc-500 mt-1 block">
                                        {liquidacionesList.filter(l => l.estado === 'PAGADO').length} liquidaciones pagadas
                                    </span>
                                </div>
                                <div className="w-10 h-10 bg-green-500/10 text-green-400 rounded-xl flex items-center justify-center font-bold text-xs">
                                    PAG
                                </div>
                            </div>

                            <div className="bg-zinc-900 border border-zinc-800 p-5 rounded-2xl flex items-center justify-between">
                                <div>
                                    <p className="text-zinc-400 text-[10px] uppercase tracking-widest font-bold">Trabajadores Activos</p>
                                    <h3 className="text-2xl font-bold text-white mt-1">
                                        {staffList.filter(s => s.estado === 'ACTIVO').length}
                                    </h3>
                                    <span className="text-[10px] text-zinc-500 mt-1 block">Personal registrado</span>
                                </div>
                                <div className="w-10 h-10 bg-zinc-800 text-zinc-400 rounded-xl flex items-center justify-center font-bold text-xs">
                                    STAFF
                                </div>
                            </div>
                        </div>

                        {/* Liquidaciones Table — paginado Fase 6.3 */}
                        <div className="bg-zinc-900 border border-zinc-800/60 rounded-2xl overflow-hidden">

                            {/* Loading */}
                            {liqLoading && (
                                <div className="flex items-center justify-center py-16 gap-3 text-zinc-500">
                                    <svg className="animate-spin w-5 h-5 text-fire" viewBox="0 0 24 24" fill="none">
                                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                                    </svg>
                                    <span className="text-sm">Cargando liquidaciones…</span>
                                </div>
                            )}

                            {/* Error */}
                            {!liqLoading && liqError && (
                                <div className="p-6">
                                    <ErrorBanner message={liqError} onRetry={() => fetchLiqPage(liqPage)} />
                                </div>
                            )}

                            {/* Empty */}
                            {!liqLoading && !liqError && liqPageData.length === 0 && (
                                <div className="py-16 text-center text-zinc-500 text-sm">
                                    No hay liquidaciones registradas
                                </div>
                            )}

                            {/* Desktop table */}
                            {!liqLoading && !liqError && liqPageData.length > 0 && (
                                <div className="hidden md:block overflow-x-auto">
                                    <table className="w-full text-left border-collapse">
                                        <thead>
                                            <tr className="bg-zinc-950/40 border-b border-zinc-800 text-[10px] uppercase font-bold text-zinc-400 tracking-wider">
                                                <th className="p-4">Fecha</th>
                                                <th className="p-4">Trabajador</th>
                                                <th className="p-4">Modalidad</th>
                                                <th className="p-4 text-right">Monto Calculado</th>
                                                <th className="p-4 text-center">Estado</th>
                                                <th className="p-4 text-center">Acción de Pago</th>
                                                <th className="p-4 text-center">Gestión</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-zinc-800 text-sm">
                                            {liqPageData.map(liq => (
                                                <tr key={liq.id} className="hover:bg-zinc-800/20 transition-colors">
                                                    <td className="p-4 text-xs text-zinc-400">
                                                        {new Date(liq.fecha).toLocaleString('es-ES')}
                                                    </td>
                                                    <td className="p-4 font-medium text-zinc-200">
                                                        {liq.perfiles_trabajadores?.nombre || 'Desconocido'}
                                                    </td>
                                                    <td className="p-4">
                                                        <span className="text-[10px] font-bold bg-zinc-800 text-zinc-300 px-2 py-0.5 rounded uppercase">
                                                            {liq.modalidad}
                                                        </span>
                                                    </td>
                                                    <td className="p-4 text-right font-bold text-white">
                                                        ${Number(liq.monto_calculado).toLocaleString()}
                                                    </td>
                                                    <td className="p-4 text-center">
                                                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded uppercase ${
                                                            liq.estado === 'PAGADO' ? 'bg-green-500/10 text-green-400' :
                                                            liq.estado === 'ANULADO' ? 'bg-red-500/10 text-red-400' :
                                                            'bg-yellow-500/10 text-yellow-400'
                                                        }`}>
                                                            {liq.estado}
                                                        </span>
                                                    </td>
                                                    <td className="p-4 text-center">
                                                        {liq.estado === 'PENDIENTE' ? (
                                                            <div className="flex justify-center gap-1.5">
                                                                <button onClick={() => handlePagarLiquidacion(liq.id, 'EFECTIVO')} disabled={actionLoading} className="bg-green-600 hover:bg-green-700 text-white text-[10px] font-bold px-2.5 py-1 rounded transition-all">
                                                                    💵 Efectivo
                                                                </button>
                                                                <button onClick={() => handlePagarLiquidacion(liq.id, 'NEQUI')} disabled={actionLoading} className="bg-pink-600 hover:bg-pink-700 text-white text-[10px] font-bold px-2.5 py-1 rounded transition-all">
                                                                    📱 Nequi
                                                                </button>
                                                                <button onClick={() => handlePagarLiquidacion(liq.id, 'BANCOLOMBIA')} disabled={actionLoading} className="bg-yellow-600 hover:bg-yellow-700 text-white text-[10px] font-bold px-2.5 py-1 rounded transition-all">
                                                                    🏦 Bancolombia
                                                                </button>
                                                            </div>
                                                        ) : liq.estado === 'PAGADO' ? (
                                                            <span className="text-xs text-zinc-500 italic">Pagado ({liq.cuenta_pago || 'Caja'})</span>
                                                        ) : (
                                                            <span className="text-xs text-red-400/60 italic">Anulado</span>
                                                        )}
                                                    </td>
                                                    <td className="p-4 text-center">
                                                        {liq.estado !== 'ANULADO' && currentUserProfile?.es_socio && (
                                                            <button
                                                                onClick={() => { setShowAnularLiqModal(liq); setAnularLiqMotivo(''); }}
                                                                disabled={actionLoading}
                                                                className="bg-red-600/80 hover:bg-red-700 text-white text-[10px] font-bold px-2.5 py-1 rounded transition-all"
                                                            >
                                                                ✕ Anular
                                                            </button>
                                                        )}
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            )}

                            {/* Mobile cards — botones de pago con área táctil ≥44px */}
                            {!liqLoading && !liqError && liqPageData.length > 0 && (
                                <div className="md:hidden divide-y divide-zinc-800">
                                    {liqPageData.map(liq => (
                                        <div key={liq.id} className="p-4 space-y-3">
                                            {/* Nivel 1 — primario */}
                                            <div className="flex items-start justify-between gap-2">
                                                <div>
                                                    <p className="font-semibold text-zinc-200 text-sm">
                                                        {liq.perfiles_trabajadores?.nombre || 'Desconocido'}
                                                    </p>
                                                    <p className="text-xs text-zinc-500 mt-0.5">
                                                        {new Date(liq.fecha).toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' })}
                                                        {' · '}
                                                        <span className="text-[10px] font-bold bg-zinc-800 text-zinc-300 px-1.5 py-0.5 rounded uppercase">
                                                            {liq.modalidad}
                                                        </span>
                                                    </p>
                                                </div>
                                                <span className="font-bold text-white text-base">
                                                    ${Number(liq.monto_calculado).toLocaleString()}
                                                </span>
                                            </div>
                                            {/* Nivel 2 — estado */}
                                            <div>
                                                <span className={`text-[10px] font-bold px-2 py-0.5 rounded uppercase ${
                                                    liq.estado === 'PAGADO' ? 'bg-green-500/10 text-green-400' :
                                                    liq.estado === 'ANULADO' ? 'bg-red-500/10 text-red-400' :
                                                    'bg-yellow-500/10 text-yellow-400'
                                                }`}>
                                                    {liq.estado === 'PAGADO' ? '✓ Pagado' : liq.estado === 'ANULADO' ? '✕ Anulado' : '⏳ Pendiente'}
                                                </span>
                                                {liq.estado === 'PAGADO' && liq.cuenta_pago && (
                                                    <span className="text-[10px] text-zinc-600 ml-2">({liq.cuenta_pago})</span>
                                                )}
                                            </div>
                                            {/* Nivel 3 — acciones táctiles ≥44px */}
                                            {liq.estado === 'PENDIENTE' && (
                                                <div className="flex gap-2">
                                                    <button
                                                        onClick={() => handlePagarLiquidacion(liq.id, 'EFECTIVO')}
                                                        disabled={actionLoading}
                                                        className="flex-1 min-h-[44px] bg-green-600 hover:bg-green-700 active:scale-95 text-white text-xs font-bold rounded-xl transition-all disabled:opacity-50"
                                                    >
                                                        💵 Efectivo
                                                    </button>
                                                    <button
                                                        onClick={() => handlePagarLiquidacion(liq.id, 'NEQUI')}
                                                        disabled={actionLoading}
                                                        className="flex-1 min-h-[44px] bg-pink-600 hover:bg-pink-700 active:scale-95 text-white text-xs font-bold rounded-xl transition-all disabled:opacity-50"
                                                    >
                                                        📱 Nequi
                                                    </button>
                                                    <button
                                                        onClick={() => handlePagarLiquidacion(liq.id, 'BANCOLOMBIA')}
                                                        disabled={actionLoading}
                                                        className="flex-1 min-h-[44px] bg-yellow-600 hover:bg-yellow-700 active:scale-95 text-white text-xs font-bold rounded-xl transition-all disabled:opacity-50"
                                                    >
                                                        🏦 BC
                                                    </button>
                                                </div>
                                            )}
                                            {/* Botón anular (solo socios, solo estados no-anulados) */}
                                            {liq.estado !== 'ANULADO' && currentUserProfile?.es_socio && (
                                                <button
                                                    onClick={() => { setShowAnularLiqModal(liq); setAnularLiqMotivo(''); }}
                                                    disabled={actionLoading}
                                                    className="w-full min-h-[44px] bg-red-600/80 hover:bg-red-700 active:scale-95 text-white text-xs font-bold rounded-xl transition-all disabled:opacity-50 mt-1"
                                                >
                                                    ✕ Anular Liquidación
                                                </button>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            )}

                            {/* Pagination */}
                            {!liqLoading && !liqError && (
                                <Pagination
                                    currentPage={liqPage}
                                    totalPages={Math.ceil(liqTotal / PAGE_SIZE)}
                                    totalItems={liqTotal}
                                    pageSize={PAGE_SIZE}
                                    onPrev={() => fetchLiqPage(liqPage - 1)}
                                    onNext={() => fetchLiqPage(liqPage + 1)}
                                />
                            )}
                        </div>
                    </div>
                )}


                {activeTab === 'gastos' && (
                    <div className="space-y-6">
                        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                            <SectionHeader
                                title="Gastos Operativos"
                                subtitle="Registro de egresos operacionales, categorías y trazabilidad de caja"
                                icon={Receipt}
                            />
                            {currentUserProfile?.es_socio && (
                                <div className="flex gap-2">
                                    <button
                                        onClick={() => {
                                            setGastoForm({ categoria_id: categoriasGastosList[0]?.id || '', descripcion: '', monto: '', metodo_pago: 'EFECTIVO' });
                                            setShowNewGastoModal(true);
                                        }}
                                        className="bg-fire hover:bg-orange-700 text-white px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 shadow-lg active:scale-95 transition-all"
                                    >
                                        <Plus size={16} /> 💸 Registrar Gasto
                                    </button>
                                    <button
                                        onClick={() => {
                                            setCategoriaForm({ nombre: '', activo: true });
                                            setShowNewCategoriaModal(true);
                                        }}
                                        className="bg-zinc-800 hover:bg-zinc-700 text-white px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 border border-zinc-700 active:scale-95 transition-all"
                                    >
                                        <Plus size={16} /> 📁 Nueva Categoría
                                    </button>
                                </div>
                            )}
                        </div>

                        {/* Gastos stats */}
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
                            <div className="bg-zinc-900 border border-zinc-800 p-5 rounded-2xl shadow-lg">
                                <p className="text-zinc-400 text-[10px] uppercase tracking-widest font-bold mb-1">Total Gastos Registrados</p>
                                <h3 className="text-2xl font-bold text-white">${gastosList.filter(g => g.estado === 'REGISTRADO').reduce((sum, g) => sum + Number(g.monto || 0), 0).toLocaleString()}</h3>
                                <span className="text-[10px] text-zinc-500 block mt-1">Excluye gastos anulados</span>
                            </div>
                            <div className="bg-zinc-900 border border-zinc-800 p-5 rounded-2xl shadow-lg">
                                <p className="text-zinc-400 text-[10px] uppercase tracking-widest font-bold mb-1">Transacciones Activas</p>
                                <h3 className="text-2xl font-bold text-gold">{gastosList.filter(g => g.estado === 'REGISTRADO').length}</h3>
                                <span className="text-[10px] text-zinc-500 block mt-1">Gastos vigentes en caja</span>
                            </div>
                            <div className="bg-zinc-900 border border-zinc-800 p-5 rounded-2xl shadow-lg">
                                <p className="text-zinc-400 text-[10px] uppercase tracking-widest font-bold mb-1">Gastos Anulados</p>
                                <h3 className="text-2xl font-bold text-red-500">${gastosList.filter(g => g.estado === 'ANULADO').reduce((sum, g) => sum + Number(g.monto || 0), 0).toLocaleString()}</h3>
                                <span className="text-[10px] text-zinc-500 block mt-1">Historial de anulaciones revertidas</span>
                            </div>
                        </div>

                        {/* Gastos Table */}
                        <div className="bg-zinc-900 border border-zinc-800/60 rounded-2xl overflow-hidden shadow-2xl">
                            <div className="p-4 border-b border-zinc-800 bg-zinc-950/40 flex justify-between items-center">
                                <span className="text-xs font-bold text-zinc-400">Listado de Gastos</span>
                                <span className="text-xs text-zinc-500">Página {gastosPage + 1} • {gastosTotal} registros</span>
                            </div>

                            {gastosLoading ? (
                                <div className="flex items-center justify-center py-16 gap-3 text-zinc-500">
                                    <svg className="animate-spin w-5 h-5 text-fire" viewBox="0 0 24 24" fill="none">
                                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                                    </svg>
                                    <span className="text-sm">Cargando gastos…</span>
                                </div>
                            ) : gastosError ? (
                                <div className="p-10 text-center text-red-400 text-sm">
                                    ❌ Error al cargar gastos: {gastosError}
                                </div>
                            ) : gastosPageData.length === 0 ? (
                                <div className="p-10 text-center text-zinc-500 text-sm">
                                    Sin gastos registrados.
                                </div>
                            ) : (
                                <div className="overflow-x-auto">
                                    <table className="w-full text-left text-xs border-collapse">
                                        <thead>
                                            <tr className="border-b border-zinc-800 bg-zinc-950/20 text-zinc-400 uppercase font-bold tracking-wider text-[10px]">
                                                <th className="p-4">Fecha</th>
                                                <th className="p-4">Categoría</th>
                                                <th className="p-4">Descripción</th>
                                                <th className="p-4">Monto</th>
                                                <th className="p-4">Método Pago</th>
                                                <th className="p-4">Creado Por</th>
                                                <th className="p-4">Estado</th>
                                                {currentUserProfile?.es_socio && <th className="p-4 text-right">Acciones</th>}
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-zinc-850">
                                            {gastosPageData.map(g => (
                                                <tr key={g.id} className="hover:bg-zinc-950/40 transition-colors">
                                                    <td className="p-4 text-zinc-350 whitespace-nowrap">
                                                        {new Date(g.fecha).toLocaleString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                                                    </td>
                                                    <td className="p-4 font-bold text-zinc-200">
                                                        {g.categorias_gastos?.nombre || 'General'}
                                                    </td>
                                                    <td className="p-4 text-zinc-350 max-w-xs truncate">
                                                        {g.descripcion || '-'}
                                                    </td>
                                                    <td className="p-4 font-bold text-white text-sm">
                                                        ${Number(g.monto || 0).toLocaleString()}
                                                    </td>
                                                    <td className="p-4 text-zinc-400 font-mono">
                                                        {g.metodo_pago}
                                                    </td>
                                                    <td className="p-4 text-zinc-400">
                                                        {g.perfiles_trabajadores?.nombre || 'Sistema'}
                                                    </td>
                                                    <td className="p-4">
                                                        <span className={`inline-block px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                                                            g.estado === 'REGISTRADO' 
                                                                ? 'bg-green-500/10 text-green-400 border border-green-500/25' 
                                                                : 'bg-zinc-800 text-zinc-500 border border-zinc-700/50'
                                                        }`}>
                                                            {g.estado}
                                                        </span>
                                                    </td>
                                                    {currentUserProfile?.es_socio && (
                                                        <td className="p-4 text-right">
                                                            {g.estado === 'REGISTRADO' ? (
                                                                <button
                                                                    onClick={() => {
                                                                        setAnularGastoMotivo('');
                                                                        setShowAnularGastoModal(g);
                                                                    }}
                                                                    className="bg-red-500/10 hover:bg-red-500 text-red-400 hover:text-white px-3 py-1.5 rounded-xl border border-red-500/20 text-[10px] font-bold transition-all"
                                                                >
                                                                    Anular
                                                                </button>
                                                            ) : (
                                                                <span className="text-[10px] text-zinc-650 font-bold italic">N/A</span>
                                                            )}
                                                        </td>
                                                    )}
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            )}

                            {!gastosLoading && !gastosError && (
                                <Pagination
                                    currentPage={gastosPage}
                                    totalPages={Math.ceil(gastosTotal / PAGE_SIZE)}
                                    totalItems={gastosTotal}
                                    pageSize={PAGE_SIZE}
                                    onPrev={() => fetchGastosPage(gastosPage - 1)}
                                    onNext={() => fetchGastosPage(gastosPage + 1)}
                                />
                            )}
                        </div>
                    </div>
                )}

                {activeTab === 'trabajadores' && (
                    <div className="space-y-6">
                        <SectionHeader
                            title="Trabajadores y Perfiles"
                            subtitle="Gestión de usuarios autorizados, roles y estados"
                            icon={Award}
                        />

                        {/* Admin Socio notification */}
                        {!currentUserProfile?.es_socio && (
                            <div className="bg-zinc-900 border border-zinc-800 p-4 rounded-xl flex items-center gap-3 text-zinc-400 text-xs">
                                <ShieldAlert className="text-yellow-500 shrink-0" size={16} />
                                <span>Estás visualizando perfiles en modo de lectura. Modificar roles o estados requiere cuenta de **Socio Administrador**.</span>
                            </div>
                        )}

                        {/* Staff list cards/table */}
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                            {staffList.map(member => (
                                <div key={member.id} className="bg-zinc-900 border border-zinc-800/80 p-5 rounded-2xl space-y-4">
                                    <div className="flex justify-between items-start">
                                        <div>
                                            <h3 className="font-bold text-md text-white">{member.nombre}</h3>
                                            <p className="text-xs text-zinc-500">{member.email}</p>
                                        </div>
                                        <span className={`text-[9px] font-bold px-2 py-0.5 rounded ${member.estado === 'ACTIVO' ? 'bg-green-500/10 text-green-400' : 'bg-zinc-800 text-zinc-500'
                                            }`}>
                                            {member.estado}
                                        </span>
                                    </div>

                                    <div className="space-y-2 border-t border-zinc-800 pt-3 text-xs">
                                        <div className="flex justify-between">
                                            <span className="text-zinc-500">Rol asignado:</span>
                                            <span className="font-bold uppercase text-zinc-200">{member.rol}</span>
                                        </div>
                                        <div className="flex justify-between">
                                            <span className="text-zinc-500">Socio de negocio:</span>
                                            <span className="font-bold text-zinc-200">{member.es_socio ? 'SÍ' : 'NO'}</span>
                                        </div>
                                    </div>

                                    {/* Actions */}
                                    {currentUserProfile?.es_socio && (
                                        <div className="flex gap-2 border-t border-zinc-800 pt-3">
                                            <button
                                                onClick={() => handleToggleStaffRole(member)}
                                                disabled={actionLoading}
                                                className="flex-1 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 py-1.5 rounded text-[11px] font-bold transition-all disabled:opacity-50"
                                            >
                                                Cambiar Rol
                                            </button>
                                            <button
                                                onClick={() => handleToggleStaffStatus(member)}
                                                disabled={actionLoading}
                                                className="flex-1 bg-red-950/20 hover:bg-red-950/45 text-red-400 py-1.5 rounded text-[11px] font-bold transition-all disabled:opacity-50"
                                            >
                                                {member.estado === 'ACTIVO' ? 'Desactivar' : 'Activar'}
                                            </button>
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {activeTab === 'configuracion' && currentUserProfile?.es_socio && (
                    <div className="space-y-6">
                        <SectionHeader
                            title="Configuración del Negocio"
                            subtitle="Parámetros del programa de fidelización y reglas globales (Socio Administrador)"
                            icon={Settings}
                        />

                        <div className="bg-zinc-900 border border-zinc-800 p-6 rounded-2xl space-y-6 max-w-xl">
                            <div className="space-y-2">
                                <h3 className="font-bold text-sm text-zinc-200">Reglas de Fidelización</h3>
                                <div className="p-4 bg-zinc-950 rounded-lg border border-zinc-850 flex justify-between items-center text-xs">
                                    <span className="text-zinc-400">Fuegos necesarios para premio</span>
                                    <span className="font-bold text-fire text-sm">10 Fuegos</span>
                                </div>
                                <div className="p-4 bg-zinc-950 rounded-lg border border-zinc-850 flex justify-between items-center text-xs">
                                    <span className="text-zinc-400">Equivalencia estándar por venta elegible</span>
                                    <span className="font-bold text-zinc-200 text-sm">1 Venta = 1 Fuego</span>
                                </div>
                            </div>

                            <div className="p-4 bg-yellow-500/5 border border-yellow-500/10 rounded-xl flex gap-3 text-zinc-400 text-xs">
                                <ShieldAlert className="text-yellow-500 shrink-0" size={16} />
                                <span>Las configuraciones críticas están vinculadas a la inmutabilidad de la base de datos de producción y no deben cambiarse sin re-calcular el delta matemático histórico.</span>
                            </div>
                        </div>
                    </div>
                )}

                {activeTab === 'productos' && (
                    <div className="space-y-6">
                        <div className="flex flex-wrap justify-between items-center gap-4">
                            <div>
                                <h1 className="text-3xl font-serif text-white">Productos / Menú</h1>
                                <p className="text-zinc-500 text-sm mt-1">Catálogo dinámico de productos disponibles en el POS</p>
                            </div>
                            {currentUserProfile?.es_socio && (
                                <button
                                    onClick={() => {
                                        setEditingProducto('new');
                                        setProductoForm({ nombre: '', descripcion: '', precio: '', categoria: '', activo: true, orden: 0, imagen: '' });
                                        fetchProductos();
                                    }}
                                    className="flex items-center gap-2 bg-fire text-white px-4 py-2 rounded-lg text-sm font-bold shadow-lg shadow-fire/10 hover:bg-orange-700 transition-all uppercase tracking-wider"
                                >
                                    <Plus size={16} />
                                    Nuevo Producto
                                </button>
                            )}
                        </div>

                        {!currentUserProfile?.es_socio && (
                            <div className="bg-zinc-900 border border-zinc-800 p-4 rounded-xl flex items-center gap-3 text-zinc-400 text-xs">
                                <ShieldAlert className="text-yellow-500 shrink-0" size={16} />
                                <span>Vista de solo lectura. La creación y modificación de productos requiere cuenta de <strong>Socio Administrador</strong>.</span>
                            </div>
                        )}

                        {/* Create / Edit Form (Socio only) */}
                        {editingProducto && (
                            <div className="bg-zinc-900 border border-fire/30 rounded-2xl p-6 space-y-4 max-w-2xl">
                                <h3 className="font-bold font-serif text-md text-white">
                                    {editingProducto === 'new' ? 'Crear Producto' : 'Editar Producto'}
                                </h3>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                    <div>
                                        <label className="text-[10px] uppercase tracking-wider font-bold text-zinc-400 block mb-1">Nombre *</label>
                                        <input
                                            type="text"
                                            className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-sm text-white focus:border-fire outline-none"
                                            value={productoForm.nombre}
                                            onChange={e => setProductoForm(p => ({ ...p, nombre: e.target.value }))}
                                        />
                                    </div>
                                    <div>
                                        <label className="text-[10px] uppercase tracking-wider font-bold text-zinc-400 block mb-1">Categoría *</label>
                                        <input
                                            type="text"
                                            className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-sm text-white focus:border-fire outline-none"
                                            placeholder="Hamburguesas, Bebidas..."
                                            value={productoForm.categoria}
                                            onChange={e => setProductoForm(p => ({ ...p, categoria: e.target.value }))}
                                        />
                                    </div>
                                    <div>
                                        <label className="text-[10px] uppercase tracking-wider font-bold text-zinc-400 block mb-1">Precio ($) *</label>
                                        <input
                                            type="number"
                                            className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-sm text-white focus:border-fire outline-none"
                                            value={productoForm.precio}
                                            onChange={e => setProductoForm(p => ({ ...p, precio: e.target.value }))}
                                        />
                                    </div>
                                    <div>
                                        <label className="text-[10px] uppercase tracking-wider font-bold text-zinc-400 block mb-1">Orden (número)</label>
                                        <input
                                            type="number"
                                            className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-sm text-white focus:border-fire outline-none"
                                            value={productoForm.orden}
                                            onChange={e => setProductoForm(p => ({ ...p, orden: e.target.value }))}
                                        />
                                    </div>
                                    <div className="sm:col-span-2">
                                        <label className="text-[10px] uppercase tracking-wider font-bold text-zinc-400 block mb-1">Descripción</label>
                                        <input
                                            type="text"
                                            className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-sm text-white focus:border-fire outline-none"
                                            value={productoForm.descripcion}
                                            onChange={e => setProductoForm(p => ({ ...p, descripcion: e.target.value }))}
                                        />
                                    </div>
                                    <div className="sm:col-span-2">
                                        <label className="text-[10px] uppercase tracking-wider font-bold text-zinc-400 block mb-1">Ruta o URL de Imagen (ej. /menu/Hamburguesa.png)</label>
                                        <input
                                            type="text"
                                            className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-sm text-white focus:border-fire outline-none"
                                            placeholder="Ej. /menu/Hamburguesa.png"
                                            value={productoForm.imagen}
                                            onChange={e => setProductoForm(p => ({ ...p, imagen: e.target.value }))}
                                        />
                                    </div>
                                    <div className="flex items-center gap-3">
                                        <input
                                            id="activo-check"
                                            type="checkbox"
                                            className="w-4 h-4 accent-fire"
                                            checked={productoForm.activo}
                                            onChange={e => setProductoForm(p => ({ ...p, activo: e.target.checked }))}
                                        />
                                        <label htmlFor="activo-check" className="text-sm text-zinc-300 font-semibold cursor-pointer">Activo (visible en POS)</label>
                                    </div>
                                </div>
                                <div className="flex gap-3 pt-2">
                                    <button
                                        onClick={handleSaveProducto}
                                        disabled={productoSaving}
                                        className="bg-fire text-white px-5 py-2 rounded-lg text-sm font-bold hover:bg-orange-700 transition-all disabled:opacity-50"
                                    >
                                        {productoSaving ? 'Guardando...' : 'Guardar'}
                                    </button>
                                    <button
                                        onClick={() => setEditingProducto(null)}
                                        className="bg-zinc-800 text-zinc-300 px-5 py-2 rounded-lg text-sm font-bold hover:bg-zinc-700 transition-all"
                                    >
                                        Cancelar
                                    </button>
                                </div>
                            </div>
                        )}

                        {/* Product List */}
                        {productosList.length === 0 && !productosLoading ? (
                            <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-8 text-center text-zinc-500">
                                <UtensilsCrossed size={32} className="mx-auto opacity-20 mb-3" />
                                <p className="text-sm">No hay productos en el catálogo todavía.</p>
                                {currentUserProfile?.es_socio && (
                                    <button
                                        className="mt-4 text-xs font-bold text-fire underline hover:text-orange-400"
                                        onClick={() => { setEditingProducto('new'); fetchProductos(); }}
                                    >Crear el primero</button>
                                )}
                            </div>
                        ) : (
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                                {productosLoading ? (
                                    [...Array(8)].map((_, i) => (
                                        <div key={i} className="bg-zinc-900 border border-zinc-800 rounded-xl p-5 animate-pulse h-32" />
                                    ))
                                ) : (
                                    productosList.map(prod => (
                                        <div
                                            key={prod.id}
                                            className={`bg-zinc-900 border rounded-xl p-5 space-y-3 transition-colors ${prod.activo ? 'border-zinc-800' : 'border-zinc-800/30 opacity-50'}`}
                                        >
                                            <div className="flex justify-between items-start">
                                                <span className="text-[10px] font-bold text-fire uppercase tracking-widest bg-fire/10 px-2 py-0.5 rounded">
                                                    {prod.categoria}
                                                </span>
                                                <span className={`text-[9px] font-bold px-2 py-0.5 rounded ${prod.activo ? 'bg-green-500/10 text-green-400' : 'bg-zinc-800 text-zinc-500'}`}>
                                                    {prod.activo ? 'ACTIVO' : 'INACTIVO'}
                                                </span>
                                            </div>
                                            <h4 className="font-bold text-zinc-200 text-sm">{prod.nombre}</h4>
                                            {prod.descripcion && <p className="text-zinc-500 text-xs">{prod.descripcion}</p>}
                                            <p className="text-fire font-bold text-lg">${Number(prod.precio).toLocaleString()}</p>

                                            {currentUserProfile?.es_socio && (
                                                <div className="flex gap-2 border-t border-zinc-800 pt-3">
                                                    <button
                                                        onClick={() => {
                                                            setEditingProducto(prod.id);
                                                            setProductoForm({
                                                                nombre: prod.nombre,
                                                                descripcion: prod.descripcion || '',
                                                                precio: prod.precio,
                                                                categoria: prod.categoria,
                                                                activo: prod.activo,
                                                                orden: prod.orden || 0,
                                                                imagen: prod.imagen || ''
                                                            });
                                                        }}
                                                        className="flex-1 flex items-center justify-center gap-1 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 py-1.5 rounded text-[11px] font-bold transition-all"
                                                    >
                                                        <Pencil size={12} />
                                                        Editar
                                                    </button>
                                                    <button
                                                        onClick={() => handleToggleProductoActivo(prod)}
                                                        className={`flex-1 flex items-center justify-center gap-1 py-1.5 rounded text-[11px] font-bold transition-all ${prod.activo
                                                                ? 'bg-red-950/20 hover:bg-red-950/40 text-red-400'
                                                                : 'bg-green-950/20 hover:bg-green-950/40 text-green-400'
                                                            }`}
                                                    >
                                                        {prod.activo ? <PackageX size={12} /> : <PackageCheck size={12} />}
                                                        {prod.activo ? 'Desactivar' : 'Activar'}
                                                    </button>
                                                </div>
                                            )}
                                        </div>
                                    ))
                                )}
                            </div>
                        )}
                    </div>
                )}

                {activeTab === 'inventario' && (
                    <div className="space-y-10">
                        {/* Title */}
                        <div className="flex flex-wrap justify-between items-center gap-4">
                            <div>
                                <h1 className="text-3xl font-serif text-white">Inventario de Insumos</h1>
                                <p className="text-zinc-500 text-sm mt-1">Control de materias primas, mermas y recetas de productos</p>
                            </div>
                            {currentUserProfile?.es_socio && (
                                <div className="flex flex-wrap gap-2">
                                    <button
                                        onClick={handleOpenCargaMasiva}
                                        className="flex items-center gap-2 bg-gradient-to-r from-emerald-600 to-green-600 text-white px-4 py-2 rounded-lg text-sm font-bold shadow-lg shadow-green-900/20 hover:from-emerald-500 hover:to-green-500 transition-all uppercase tracking-wider"
                                    >
                                        <PackageCheck size={16} />
                                        Carga Rápida (Toma Física)
                                    </button>
                                    <button
                                        onClick={() => {
                                            setEditingInsumo('new');
                                            setInsumoForm({ nombre: '', unidad_medida: 'unidad', stock_actual: 0, stock_minimo: 0, activo: true, costo_unitario: 0 });
                                        }}
                                        className="flex items-center gap-2 bg-fire text-white px-4 py-2 rounded-lg text-sm font-bold shadow-lg shadow-fire/10 hover:bg-orange-700 transition-all uppercase tracking-wider"
                                    >
                                        <Plus size={16} />
                                        Nuevo Insumo
                                    </button>
                                </div>
                            )}
                        </div>

                        {/* Worker notice — merma habilitada */}
                        {!currentUserProfile?.es_socio && (
                            <div className="bg-zinc-900 border border-zinc-800 p-4 rounded-xl flex items-center gap-3 text-zinc-400 text-xs">
                                <ShieldAlert className="text-yellow-500 shrink-0" size={16} />
                                <span>Puedes registrar <strong>mermas</strong> directamente. Para entradas, correcciones o cambios de inventario contacta al administrador.</span>
                            </div>
                        )}

                        {/* Insumo Form */}
                        {editingInsumo && (
                            <div className="bg-zinc-900 border border-fire/35 rounded-2xl p-6 space-y-4 max-w-2xl">
                                <h3 className="font-bold font-serif text-md text-white">
                                    {editingInsumo === 'new' ? 'Crear Insumo' : 'Editar Insumo'}
                                </h3>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                    <div>
                                        <label className="text-[10px] uppercase tracking-wider font-bold text-zinc-400 block mb-1">Nombre *</label>
                                        <input
                                            type="text"
                                            className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-sm text-white focus:border-fire outline-none"
                                            value={insumoForm.nombre}
                                            onChange={e => setInsumoForm(p => ({ ...p, nombre: e.target.value }))}
                                        />
                                    </div>
                                    <div>
                                        <label className="text-[10px] uppercase tracking-wider font-bold text-zinc-400 block mb-1">Unidad de Medida *</label>
                                        <input
                                            type="text"
                                            className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-sm text-white focus:border-fire outline-none"
                                            placeholder="unidad, gr, oz, ltr..."
                                            value={insumoForm.unidad_medida}
                                            onChange={e => setInsumoForm(p => ({ ...p, unidad_medida: e.target.value }))}
                                        />
                                    </div>
                                    <div>
                                        <label className="text-[10px] uppercase tracking-wider font-bold text-zinc-400 block mb-1">Costo Unitario ($)</label>
                                        <input
                                            type="number"
                                            className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-sm text-white focus:border-fire outline-none"
                                            value={insumoForm.costo_unitario}
                                            onChange={e => setInsumoForm(p => ({ ...p, costo_unitario: e.target.value }))}
                                        />
                                    </div>
                                    <div>
                                        <label className="text-[10px] uppercase tracking-wider font-bold text-zinc-400 block mb-1">Stock Actual</label>
                                        <input
                                            type="number"
                                            className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-sm text-white focus:border-fire outline-none"
                                            disabled={editingInsumo !== 'new'}
                                            value={insumoForm.stock_actual}
                                            onChange={e => setInsumoForm(p => ({ ...p, stock_actual: e.target.value }))}
                                        />
                                    </div>
                                    <div>
                                        <label className="text-[10px] uppercase tracking-wider font-bold text-zinc-400 block mb-1">Alerta Stock Mínimo</label>
                                        <input
                                            type="number"
                                            className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-sm text-white focus:border-fire outline-none"
                                            value={insumoForm.stock_minimo}
                                            onChange={e => setInsumoForm(p => ({ ...p, stock_minimo: e.target.value }))}
                                        />
                                    </div>
                                    <div className="flex items-center gap-3 sm:col-span-2">
                                        <input
                                            id="ins-activo"
                                            type="checkbox"
                                            className="w-4 h-4 accent-fire"
                                            checked={insumoForm.activo}
                                            onChange={e => setInsumoForm(p => ({ ...p, activo: e.target.checked }))}
                                        />
                                        <label htmlFor="ins-activo" className="text-sm text-zinc-300 font-semibold cursor-pointer">Activo (habilitado para descontar)</label>
                                    </div>
                                </div>
                                <div className="flex gap-3 pt-2">
                                    <button
                                        onClick={handleSaveInsumo}
                                        disabled={insumoSaving}
                                        className="bg-fire text-white px-5 py-2 rounded-lg text-sm font-bold hover:bg-orange-700 transition-all disabled:opacity-50"
                                    >
                                        {insumoSaving ? 'Guardando...' : 'Guardar'}
                                    </button>
                                    <button
                                        onClick={() => setEditingInsumo(null)}
                                        className="bg-zinc-800 text-zinc-300 px-5 py-2 rounded-lg text-sm font-bold hover:bg-zinc-700 transition-all"
                                    >
                                        Cancelar
                                    </button>
                                </div>
                            </div>
                        )}

                        {/* ── Summary badges ─────────────────────────────────────────── */}
                        {!inventarioLoading && insumosList.length > 0 && (() => {
                            const agotados = insumosList.filter(i => Number(i.stock_actual) === 0 && i.activo).length;
                            const bajos = insumosList.filter(i => Number(i.stock_actual) > 0 && Number(i.stock_actual) <= Number(i.stock_minimo) && i.activo).length;
                            return (
                                <div className="flex flex-wrap items-center gap-3">
                                    <span className="text-xs text-zinc-500 font-mono">{insumosList.length} insumos</span>
                                    {agotados > 0 && (
                                        <span className="flex items-center gap-1.5 bg-red-950/30 border border-red-900/40 text-red-400 text-xs font-bold px-3 py-1 rounded-full">
                                            <span className="w-1.5 h-1.5 rounded-full bg-red-400 inline-block" />
                                            {agotados} agotado{agotados !== 1 ? 's' : ''}
                                        </span>
                                    )}
                                    {bajos > 0 && (
                                        <span className="flex items-center gap-1.5 bg-orange-950/30 border border-orange-900/40 text-orange-400 text-xs font-bold px-3 py-1 rounded-full">
                                            <span className="w-1.5 h-1.5 rounded-full bg-orange-400 inline-block" />
                                            {bajos} bajo{bajos !== 1 ? 's' : ''}
                                        </span>
                                    )}
                                    {agotados === 0 && bajos === 0 && (
                                        <span className="flex items-center gap-1.5 bg-green-950/20 border border-green-900/30 text-green-400 text-xs font-bold px-3 py-1 rounded-full">
                                            <span className="w-1.5 h-1.5 rounded-full bg-green-400 inline-block" />
                                            Todo en orden
                                        </span>
                                    )}
                                </div>
                            );
                        })()}

                        {/* ── Búsqueda + filtros ──────────────────────────────────────── */}
                        <div className="flex flex-col sm:flex-row gap-3">
                            <div className="relative flex-1">
                                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500 pointer-events-none" />
                                <input
                                    type="text"
                                    placeholder="Buscar insumo..."
                                    className="w-full bg-zinc-900 border border-zinc-800 rounded-xl pl-9 pr-4 py-2.5 text-sm text-white placeholder:text-zinc-600 focus:border-zinc-600 outline-none"
                                    value={insumoSearch}
                                    onChange={e => setInsumoSearch(e.target.value)}
                                />
                            </div>
                            <div className="flex gap-2">
                                {[['todos', 'Todos'], ['bajos', 'Bajos'], ['agotados', 'Agotados']].map(([val, label]) => (
                                    <button
                                        key={val}
                                        onClick={() => setInsumoFilter(val)}
                                        className={`px-3 py-2 rounded-xl text-xs font-bold transition-colors ${
                                            insumoFilter === val
                                                ? 'bg-zinc-700 text-white'
                                                : 'bg-zinc-900 text-zinc-500 hover:text-zinc-300 border border-zinc-800'
                                        }`}
                                    >
                                        {label}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* ── Lista de insumos (tarjetas) ──────────────────────────────── */}
                        <div className="space-y-2">
                            {inventarioLoading ? (
                                <div className="p-10 text-center text-zinc-500 animate-pulse">Cargando inventario...</div>
                            ) : (() => {
                                const agotados = insumosList.filter(i => Number(i.stock_actual) === 0 && i.activo);
                                const bajos = insumosList.filter(i => Number(i.stock_actual) > 0 && Number(i.stock_actual) <= Number(i.stock_minimo) && i.activo);
                                const ok = insumosList.filter(i => Number(i.stock_actual) > Number(i.stock_minimo) || !i.activo);

                                let lista = insumoFilter === 'agotados' ? agotados
                                    : insumoFilter === 'bajos' ? bajos
                                    : [...agotados, ...bajos, ...ok];

                                if (insumoSearch.trim()) {
                                    const q = insumoSearch.toLowerCase();
                                    lista = lista.filter(i => i.nombre.toLowerCase().includes(q));
                                }

                                if (lista.length === 0) {
                                    return <div className="p-10 text-center text-zinc-500 text-sm">Sin resultados</div>;
                                }

                                return lista.map(ins => {
                                    const stockNum = Number(ins.stock_actual);
                                    const minNum = Number(ins.stock_minimo);
                                    const isAgotado = stockNum === 0 && ins.activo;
                                    const isBajo = stockNum > 0 && stockNum <= minNum && ins.activo;
                                    const dotColor = isAgotado ? 'bg-red-500' : isBajo ? 'bg-orange-400' : ins.activo ? 'bg-green-500' : 'bg-zinc-600';
                                    const stockColor = isAgotado ? 'text-red-400' : isBajo ? 'text-orange-400' : 'text-green-400';

                                    return (
                                        <div key={ins.id} className="bg-zinc-900 border border-zinc-800/60 rounded-2xl p-4 hover:border-zinc-700 transition-colors">
                                            <div className="flex items-start justify-between gap-3">
                                                {/* Info */}
                                                <div className="flex items-start gap-3 min-w-0">
                                                    <span className={`mt-1.5 w-2 h-2 rounded-full shrink-0 ${dotColor}`} />
                                                    <div className="min-w-0">
                                                        <p className="font-semibold text-zinc-100 text-sm leading-tight truncate">{ins.nombre}</p>
                                                        <div className="flex items-baseline gap-2 mt-0.5">
                                                            <span className={`font-mono font-bold text-lg leading-none ${stockColor}`}>{Number(ins.stock_actual).toLocaleString()}</span>
                                                            <span className="text-xs text-zinc-500">{ins.unidad_medida}</span>
                                                            {isBajo && <span className="text-[10px] text-orange-500 font-bold">· mín. {ins.stock_minimo}</span>}
                                                            {isAgotado && <span className="text-[10px] text-red-500 font-bold">AGOTADO</span>}
                                                            {!ins.activo && <span className="text-[10px] text-zinc-600 font-bold">INACTIVO</span>}
                                                        </div>
                                                    </div>
                                                </div>
                                                {/* Acciones */}
                                                <div className="flex items-center flex-wrap gap-2 shrink-0 justify-end max-w-[200px] sm:max-w-none">
                                                    {/* Merma — todos */}
                                                    <button
                                                        onClick={() => { setShowMermaModal(ins); setMermaForm({ cantidad: '', motivo: '', advertencia: false }); }}
                                                        className="h-9 px-3 bg-red-950/30 hover:bg-red-950/50 text-red-400 rounded-xl text-xs font-bold transition-colors"
                                                    >
                                                        − Merma
                                                    </button>
                                                    {/* Ajuste/Entrada — solo socio */}
                                                    {currentUserProfile?.es_socio && (
                                                        <button
                                                            onClick={() => { setShowAjusteModal(ins); setAjusteForm({ tipo: 'AJUSTE', cantidad: 0, motivo: '' }); }}
                                                            className="h-9 px-3 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 rounded-xl text-xs font-bold transition-colors"
                                                        >
                                                            + Stock
                                                        </button>
                                                    )}
                                                    {/* Detalle — todos */}
                                                    <button
                                                        onClick={async () => {
                                                            setShowInsumoDetalle(ins);
                                                            setInsumoDetalleMovs([]);
                                                            setInsumoDetalleLoading(true);
                                                            let cancelled = false;
                                                            const { data } = await supabase
                                                                .from('movimientos_inventario')
                                                                .select('tipo, cantidad, motivo, created_at')
                                                                .eq('insumo_id', ins.id)
                                                                .order('created_at', { ascending: false })
                                                                .limit(10);
                                                            if (!cancelled) {
                                                                setInsumoDetalleMovs(data || []);
                                                                setInsumoDetalleLoading(false);
                                                            }
                                                        }}
                                                        className="h-9 w-9 flex items-center justify-center bg-zinc-800 hover:bg-zinc-700 text-zinc-400 hover:text-white rounded-xl text-sm font-bold transition-colors"
                                                        title="Ver detalle"
                                                    >
                                                        ›
                                                    </button>
                                                    {/* Admin extra: editar, activar */}
                                                    {currentUserProfile?.es_socio && (
                                                        <>
                                                            <button
                                                                onClick={() => { setEditingInsumo(ins.id); setInsumoForm({ nombre: ins.nombre, unidad_medida: ins.unidad_medida, stock_actual: ins.stock_actual, stock_minimo: ins.stock_minimo, activo: ins.activo, costo_unitario: ins.costo_unitario || 0 }); }}
                                                                className="h-9 px-2.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded-xl text-xs font-bold transition-colors"
                                                            >
                                                                Editar
                                                            </button>
                                                            <button
                                                                onClick={() => handleToggleInsumoActivo(ins)}
                                                                className={`h-9 px-2.5 rounded-xl text-xs font-bold transition-colors ${
                                                                    ins.activo ? 'bg-red-950/20 text-red-400 hover:bg-red-950/40' : 'bg-green-950/20 text-green-400 hover:bg-green-950/40'
                                                                }`}
                                                            >
                                                                {ins.activo ? 'Apagar' : 'Prender'}
                                                            </button>
                                                        </>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    );
                                });
                            })()}
                        </div>

                        {/* Recetas (Recipes) Panel */}
                        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                            {/* Left: Recipe Form (Socio only) */}
                            {currentUserProfile?.es_socio && (
                                <div className="lg:col-span-1 bg-zinc-900 border border-zinc-800/80 p-6 rounded-2xl space-y-4">
                                    <h2 className="text-md font-serif text-white flex items-center gap-2">
                                        <ClipboardList size={18} className="text-fire" />
                                        Asociar Insumo a Producto (Receta)
                                    </h2>
                                    <div className="space-y-3">
                                        <div>
                                            <label className="text-[10px] uppercase tracking-wider font-bold text-zinc-400 block mb-1">Producto</label>
                                            <select
                                                className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-xs text-white focus:border-fire outline-none"
                                                value={recetaForm.producto_id}
                                                onChange={e => setRecetaForm(p => ({ ...p, producto_id: e.target.value }))}
                                            >
                                                <option value="">Seleccionar producto...</option>
                                                {productosList.map(prod => (
                                                    <option key={prod.id} value={prod.id}>{prod.nombre}</option>
                                                ))}
                                            </select>
                                        </div>
                                        <div>
                                            <label className="text-[10px] uppercase tracking-wider font-bold text-zinc-400 block mb-1">Insumo</label>
                                            <select
                                                className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-xs text-white focus:border-fire outline-none"
                                                value={recetaForm.insumo_id}
                                                onChange={e => setRecetaForm(p => ({ ...p, insumo_id: e.target.value }))}
                                            >
                                                <option value="">Seleccionar insumo...</option>
                                                {insumosList.map(ins => (
                                                    <option key={ins.id} value={ins.id}>{ins.nombre}</option>
                                                ))}
                                            </select>
                                        </div>
                                        <div>
                                            <label className="text-[10px] uppercase tracking-wider font-bold text-zinc-400 block mb-1">Cantidad por Unidad Vendida</label>
                                            <input
                                                type="number"
                                                step="any"
                                                className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-xs text-white focus:border-fire outline-none"
                                                value={recetaForm.cantidad_por_unidad}
                                                onChange={e => setRecetaForm(p => ({ ...p, cantidad_por_unidad: e.target.value }))}
                                            />
                                        </div>
                                        <button
                                            onClick={handleSaveReceta}
                                            disabled={recetaSaving}
                                            className="w-full bg-fire text-white py-2 rounded-lg text-xs font-bold hover:bg-orange-700 transition-all disabled:opacity-50 uppercase tracking-wider mt-2"
                                        >
                                            {recetaSaving ? 'Creando...' : 'Crear Receta / Vínculo'}
                                        </button>
                                    </div>
                                </div>
                            )}

                            {/* Right: Recipes List Table */}
                            <div className="lg:col-span-2 bg-zinc-900 border border-zinc-800/60 rounded-2xl overflow-hidden">
                                <div className="p-5 border-b border-zinc-850 bg-zinc-950/20">
                                    <h2 className="text-md font-serif text-white">Vínculos de Receta Activos</h2>
                                </div>
                                <div className="overflow-x-auto">
                                    <table className="w-full text-left border-collapse">
                                        <thead>
                                            <tr className="bg-zinc-950/40 border-b border-zinc-800 text-[10px] uppercase font-bold text-zinc-400 tracking-wider">
                                                <th className="p-4">Producto</th>
                                                <th className="p-4">Insumo Utilizado</th>
                                                <th className="p-4 text-center">Consumo por Unidad</th>
                                                {currentUserProfile?.es_socio && <th className="p-4 text-right">Acciones</th>}
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-zinc-850 text-sm">
                                            {recetasList.length === 0 ? (
                                                <tr>
                                                    <td colSpan="4" className="p-8 text-center text-zinc-500">No hay recetas configuradas</td>
                                                </tr>
                                            ) : (
                                                recetasList.map(rec => (
                                                    <tr key={rec.id} className="hover:bg-zinc-850/10 transition-colors">
                                                        <td className="p-4 font-semibold text-zinc-200">{rec.productos?.nombre}</td>
                                                        <td className="p-4 text-zinc-300">{rec.insumos?.nombre}</td>
                                                        <td className="p-4 text-center font-mono text-zinc-300">{rec.cantidad_por_unidad}</td>
                                                        {currentUserProfile?.es_socio && (
                                                            <td className="p-4 text-right">
                                                                <button
                                                                    onClick={() => handleDeleteReceta(rec.id)}
                                                                    className="text-red-400 hover:text-red-300 p-1.5"
                                                                >
                                                                    <Trash2 size={15} />
                                                                </button>
                                                            </td>
                                                        )}
                                                    </tr>
                                                ))
                                            )}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* ── Modal Merma Directa (trabajador y admin) ─────────────────── */}
                {showMermaModal && (() => {
                    const ins = showMermaModal;
                    const cantidadNum = Number(mermaForm.cantidad);
                    const stockActual = Number(ins.stock_actual);
                    const nuevoStock = cantidadNum > 0 ? stockActual - cantidadNum : null;
                    const cantidadValida = cantidadNum > 0 && cantidadNum <= stockActual;
                    return (
                        <div className="fixed inset-0 bg-black/80 flex items-end sm:items-center justify-center p-0 sm:p-6 z-[999]">
                            <div className="w-full sm:max-w-sm bg-zinc-900 border border-zinc-800 rounded-t-3xl sm:rounded-3xl p-6 shadow-2xl space-y-5">
                                {/* Header */}
                                <div className="flex justify-between items-start">
                                    <div>
                                        <p className="text-[10px] uppercase tracking-widest font-bold text-red-400 mb-0.5">Registrar merma</p>
                                        <h3 className="text-lg font-bold font-serif text-white leading-tight">{ins.nombre}</h3>
                                        <p className="text-sm text-zinc-400 mt-0.5">
                                            Stock actual: <span className="font-mono font-bold text-zinc-200">{ins.stock_actual} {ins.unidad_medida}</span>
                                        </p>
                                    </div>
                                    <button
                                        onClick={() => { setShowMermaModal(null); setMermaForm({ cantidad: '', motivo: '', advertencia: false }); }}
                                        className="text-zinc-500 hover:text-white transition-colors mt-1"
                                        aria-label="Cerrar"
                                    >
                                        ✕
                                    </button>
                                </div>

                                {/* Campo cantidad */}
                                <div>
                                    <label className="text-[10px] uppercase tracking-wider font-bold text-zinc-400 block mb-1.5">
                                        ¿Cuánto se perdió? ({ins.unidad_medida})
                                    </label>
                                    <input
                                        type="number"
                                        inputMode="decimal"
                                        min="0.01"
                                        step="any"
                                        autoFocus
                                        className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-3 text-xl text-white font-mono focus:border-red-500 outline-none placeholder:text-zinc-700"
                                        placeholder="0"
                                        value={mermaForm.cantidad}
                                        onChange={e => setMermaForm(p => ({ ...p, cantidad: e.target.value }))}
                                    />
                                    {mermaForm.cantidad !== '' && cantidadNum > stockActual && (
                                        <p className="text-xs text-red-400 mt-1.5">⚠ La cantidad supera el stock disponible ({ins.stock_actual} {ins.unidad_medida})</p>
                                    )}
                                    {mermaForm.cantidad !== '' && cantidadNum <= 0 && (
                                        <p className="text-xs text-red-400 mt-1.5">⚠ La cantidad debe ser mayor a cero</p>
                                    )}
                                </div>

                                {/* Preview impacto */}
                                {cantidadValida && (
                                    <div className="bg-zinc-950 border border-zinc-800 rounded-xl p-4 space-y-1.5 text-sm font-mono">
                                        <div className="flex justify-between text-zinc-400">
                                            <span>Antes</span>
                                            <span>{ins.stock_actual} {ins.unidad_medida}</span>
                                        </div>
                                        <div className="flex justify-between text-red-400">
                                            <span>Merma</span>
                                            <span>− {cantidadNum} {ins.unidad_medida}</span>
                                        </div>
                                        <div className="border-t border-zinc-800 my-1" />
                                        <div className="flex justify-between text-white font-bold">
                                            <span>Nuevo stock</span>
                                            <span className={nuevoStock === 0 ? 'text-red-400' : 'text-green-400'}>
                                                {nuevoStock} {ins.unidad_medida}
                                            </span>
                                        </div>
                                    </div>
                                )}

                                {/* Campo motivo */}
                                <div>
                                    <label className="text-[10px] uppercase tracking-wider font-bold text-zinc-400 block mb-1.5">Motivo <span className="text-zinc-600 normal-case font-normal">(recomendado)</span></label>
                                    <input
                                        type="text"
                                        className={`w-full bg-zinc-950 border rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none placeholder:text-zinc-700 transition-colors ${
                                            mermaForm.advertencia && !mermaForm.motivo.trim()
                                                ? 'border-yellow-500 focus:border-yellow-400'
                                                : 'border-zinc-800 focus:border-zinc-600'
                                        }`}
                                        placeholder="Ej. Se quemó en la freidora"
                                        value={mermaForm.motivo}
                                        onChange={e => setMermaForm(p => ({ ...p, motivo: e.target.value, advertencia: false }))}
                                    />
                                    {/* Aviso no bloqueante cuando el usuario intentó confirmar sin motivo */}
                                    {mermaForm.advertencia && !mermaForm.motivo.trim() && (
                                        <p className="text-xs text-yellow-400 mt-1.5">
                                            ⚠ Se recomienda indicar el motivo para poder auditar la merma.
                                            Puedes agregar uno arriba o confirmar de todas formas.
                                        </p>
                                    )}
                                </div>

                                {/* Botones */}
                                <div className="flex gap-3 pt-1">
                                    <button
                                        onClick={() => { setShowMermaModal(null); setMermaForm({ cantidad: '', motivo: '', advertencia: false }); }}
                                        className="flex-1 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 py-3 rounded-xl text-sm font-bold transition-colors"
                                    >
                                        Cancelar
                                    </button>
                                    <button
                                        onClick={handleRegistrarMerma}
                                        disabled={!cantidadValida || mermaSaving}
                                        className={`flex-1 py-3 rounded-xl text-sm font-bold transition-colors disabled:bg-zinc-800 disabled:text-zinc-600 ${
                                            mermaForm.advertencia && !mermaForm.motivo.trim()
                                                ? 'bg-yellow-700 hover:bg-yellow-600 text-white'
                                                : 'bg-red-700 hover:bg-red-600 text-white'
                                        }`}
                                    >
                                        {mermaSaving
                                            ? 'Registrando...'
                                            : (mermaForm.advertencia && !mermaForm.motivo.trim())
                                                ? 'Confirmar sin motivo'
                                                : 'Registrar merma'
                                        }
                                    </button>
                                </div>
                            </div>
                        </div>
                    );
                })()}

                {/* ── Modal Detalle de Insumo — usa BottomSheet (scroll interno si desborda) ── */}
                {showInsumoDetalle && (() => {
                    const ins = showInsumoDetalle;
                    const stockNum = Number(ins.stock_actual);
                    const isAgotado = stockNum === 0 && ins.activo;
                    const isBajo = stockNum > 0 && stockNum <= Number(ins.stock_minimo) && ins.activo;
                    const stockColor = isAgotado ? 'text-red-400' : isBajo ? 'text-orange-400' : 'text-green-400';
                    return (
                        <BottomSheet
                            open={true}
                            onClose={() => setShowInsumoDetalle(null)}
                            subtitle="Detalle de insumo"
                            title={ins.nombre}
                        >
                            {/* Stats */}
                            <div className="grid grid-cols-2 gap-px bg-zinc-800 border-b border-zinc-800">
                                <div className="bg-zinc-900 p-4">
                                    <p className="text-[10px] uppercase tracking-wider text-zinc-500 font-bold mb-1">Stock actual</p>
                                    <p className={`text-2xl font-mono font-bold ${stockColor}`}>{Number(ins.stock_actual).toLocaleString()}</p>
                                    <p className="text-xs text-zinc-500 mt-0.5">{ins.unidad_medida}</p>
                                </div>
                                <div className="bg-zinc-900 p-4">
                                    <p className="text-[10px] uppercase tracking-wider text-zinc-500 font-bold mb-1">Stock mínimo</p>
                                    <p className="text-2xl font-mono font-bold text-zinc-300">{ins.stock_minimo}</p>
                                    <p className="text-xs text-zinc-500 mt-0.5">{ins.unidad_medida}</p>
                                </div>
                                {currentUserProfile?.es_socio && (
                                    <div className="bg-zinc-900 p-4">
                                        <p className="text-[10px] uppercase tracking-wider text-zinc-500 font-bold mb-1">Costo unitario</p>
                                        <p className="text-xl font-mono font-bold text-zinc-200">${Number(ins.costo_unitario || 0).toLocaleString()}</p>
                                    </div>
                                )}
                                <div className="bg-zinc-900 p-4">
                                    <p className="text-[10px] uppercase tracking-wider text-zinc-500 font-bold mb-1">Estado</p>
                                    <span className={`text-xs font-bold px-2 py-0.5 rounded ${ins.activo ? 'bg-green-500/10 text-green-400' : 'bg-zinc-800 text-zinc-500'}`}>
                                        {ins.activo ? 'ACTIVO' : 'INACTIVO'}
                                    </span>
                                </div>
                            </div>
                            {/* Historial */}
                            <div className="p-5">
                                <p className="text-[10px] uppercase tracking-wider text-zinc-500 font-bold mb-3">Últimos movimientos</p>
                                {insumoDetalleLoading ? (
                                    <p className="text-sm text-zinc-600 animate-pulse">Cargando historial...</p>
                                ) : insumoDetalleMovs.length === 0 ? (
                                    <p className="text-sm text-zinc-600">Sin movimientos registrados.</p>
                                ) : (
                                    <div className="space-y-2">
                                        {insumoDetalleMovs.map((mov, i) => (
                                            <div key={i} className="flex items-center justify-between gap-3 text-sm">
                                                <div className="flex items-center gap-2">
                                                    <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${
                                                        mov.tipo === 'VENTA' ? 'bg-zinc-800 text-zinc-400'
                                                        : mov.tipo === 'MERMA' ? 'bg-red-950/40 text-red-400'
                                                        : mov.tipo === 'ENTRADA' ? 'bg-blue-950/40 text-blue-400'
                                                        : 'bg-orange-950/30 text-orange-400'
                                                    }`}>{mov.tipo}</span>
                                                    <span className="text-zinc-500 text-xs truncate max-w-[120px]">{mov.motivo || '—'}</span>
                                                </div>
                                                <div className="flex items-center gap-2 shrink-0">
                                                    <span className={`font-mono font-bold text-xs ${Number(mov.cantidad) >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                                                        {Number(mov.cantidad) >= 0 ? '+' : ''}{Number(mov.cantidad).toLocaleString()}
                                                    </span>
                                                    <span className="text-zinc-600 text-[10px]">
                                                        {new Date(mov.created_at).toLocaleDateString('es-CO', { day: '2-digit', month: 'short' })}
                                                    </span>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                            {/* Acciones rápidas dentro del detalle */}
                            <div className="p-4 pt-0 flex gap-3">
                                <button
                                    onClick={() => { setShowInsumoDetalle(null); setShowMermaModal(ins); setMermaForm({ cantidad: '', motivo: '', advertencia: false }); }}
                                    className="flex-1 h-11 bg-red-950/30 hover:bg-red-950/50 text-red-400 rounded-xl text-sm font-bold transition-colors"
                                >
                                    − Merma
                                </button>
                                {currentUserProfile?.es_socio && (
                                    <button
                                        onClick={() => { setShowInsumoDetalle(null); setShowAjusteModal(ins); setAjusteForm({ tipo: 'AJUSTE', cantidad: 0, motivo: '' }); }}
                                        className="flex-1 h-11 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 rounded-xl text-sm font-bold transition-colors"
                                    >
                                        + Stock
                                    </button>
                                )}
                            </div>
                        </BottomSheet>
                    );
                })()}

                {/* ── Modal Ajuste Stock (Socio only) — bottom sheet ───────────── */}
                {showAjusteModal && (() => {
                    const ins = showAjusteModal;
                    const delta = Number(ajusteForm.cantidad);
                    const isNegative = ajusteForm.tipo === 'MERMA';
                    const sign = isNegative ? -1 : 1;
                    const nuevoStock = delta > 0 ? Math.max(0, Number(ins.stock_actual) + sign * delta) : null;
                    return (
                        <div className="fixed inset-0 bg-black/80 flex items-end sm:items-center justify-center p-0 sm:p-6 z-[999]">
                            <div className="w-full sm:max-w-sm bg-zinc-900 border border-zinc-800 rounded-t-3xl sm:rounded-3xl p-6 shadow-2xl space-y-5">
                                {/* Header */}
                                <div className="flex justify-between items-start">
                                    <div>
                                        <p className="text-[10px] uppercase tracking-widest font-bold text-zinc-500 mb-0.5">Movimiento de stock</p>
                                        <h3 className="text-lg font-bold font-serif text-white leading-tight">{ins.nombre}</h3>
                                        <p className="text-sm text-zinc-400 mt-0.5">
                                            Stock actual: <span className="font-mono font-bold text-zinc-200">{ins.stock_actual} {ins.unidad_medida}</span>
                                        </p>
                                    </div>
                                    <button onClick={() => setShowAjusteModal(null)} className="text-zinc-500 hover:text-white transition-colors mt-1">✕</button>
                                </div>
                                {/* Tipo */}
                                <div>
                                    <label className="text-[10px] uppercase tracking-wider font-bold text-zinc-400 block mb-1.5">Tipo de movimiento</label>
                                    <select
                                        className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-3 text-sm text-white focus:border-zinc-600 outline-none"
                                        value={ajusteForm.tipo}
                                        onChange={e => setAjusteForm(p => ({ ...p, tipo: e.target.value }))}
                                    >
                                        <option value="ENTRADA">Entrada (Compra / Carga)</option>
                                        <option value="AJUSTE">Ajuste (Corrección +)</option>
                                        <option value="MERMA">Merma (Desecho / Pérdida −)</option>
                                    </select>
                                </div>
                                {/* Cantidad */}
                                <div>
                                    <label className="text-[10px] uppercase tracking-wider font-bold text-zinc-400 block mb-1.5">Cantidad ({ins.unidad_medida})</label>
                                    <input
                                        type="number"
                                        inputMode="decimal"
                                        min="0.01"
                                        step="any"
                                        autoFocus
                                        className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-3 text-xl text-white font-mono focus:border-zinc-600 outline-none placeholder:text-zinc-700"
                                        placeholder="0"
                                        value={ajusteForm.cantidad || ''}
                                        onChange={e => setAjusteForm(p => ({ ...p, cantidad: e.target.value }))}
                                    />
                                </div>
                                {/* Preview */}
                                {nuevoStock !== null && (
                                    <div className="bg-zinc-950 border border-zinc-800 rounded-xl p-4 space-y-1.5 text-sm font-mono">
                                        <div className="flex justify-between text-zinc-400">
                                            <span>Antes</span>
                                            <span>{ins.stock_actual} {ins.unidad_medida}</span>
                                        </div>
                                        <div className={`flex justify-between ${isNegative ? 'text-red-400' : 'text-blue-400'}`}>
                                            <span>{ajusteForm.tipo}</span>
                                            <span>{isNegative ? '−' : '+'} {delta} {ins.unidad_medida}</span>
                                        </div>
                                        <div className="border-t border-zinc-800 my-1" />
                                        <div className="flex justify-between text-white font-bold">
                                            <span>Nuevo stock</span>
                                            <span className={nuevoStock === 0 ? 'text-red-400' : 'text-green-400'}>{nuevoStock} {ins.unidad_medida}</span>
                                        </div>
                                    </div>
                                )}
                                {/* Motivo */}
                                <div>
                                    <label className="text-[10px] uppercase tracking-wider font-bold text-zinc-400 block mb-1.5">Motivo / Justificación</label>
                                    <input
                                        type="text"
                                        className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-2.5 text-sm text-white focus:border-zinc-600 outline-none placeholder:text-zinc-700"
                                        placeholder="Motivo del ajuste..."
                                        value={ajusteForm.motivo}
                                        onChange={e => setAjusteForm(p => ({ ...p, motivo: e.target.value }))}
                                    />
                                </div>
                                {/* Botones */}
                                <div className="flex gap-3 pt-1">
                                    <button
                                        onClick={() => setShowAjusteModal(null)}
                                        className="flex-1 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 py-3 rounded-xl text-sm font-bold transition-colors"
                                    >
                                        Cancelar
                                    </button>
                                    <button
                                        onClick={handleAjustarStock}
                                        disabled={insumoSaving || !ajusteForm.cantidad || Number(ajusteForm.cantidad) <= 0}
                                        className="flex-1 bg-fire hover:bg-orange-700 disabled:bg-zinc-800 disabled:text-zinc-600 text-white py-3 rounded-xl text-sm font-bold transition-colors uppercase tracking-wider"
                                    >
                                        {insumoSaving ? 'Aplicando...' : 'Aplicar'}
                                    </button>
                                </div>
                            </div>
                        </div>
                    );
                })()}

                {activeTab === 'compras' && (
                    <div className="space-y-10 font-sans">
                        <SectionHeader
                            title="Compras y Proveedores"
                            subtitle="Gestión de abastecimiento, órdenes de compra y facturación de proveedores"
                            icon={Truck}
                            actions={
                                currentUserProfile?.es_socio && !editingCompra ? (
                                    <button
                                        onClick={() => {
                                            setEditingCompra('new');
                                            setCompraForm({ proveedor_id: '', observaciones: '', details: [] });
                                        }}
                                        className="flex items-center gap-2 bg-fire text-white px-4 py-2 rounded-xl text-sm font-bold shadow-lg shadow-fire/10 hover:bg-orange-700 transition-all uppercase tracking-wider"
                                    >
                                        <Plus size={16} />
                                        Registrar Compra
                                    </button>
                                ) : null
                            }
                        />

                        {!currentUserProfile?.es_socio && (
                            <div className="bg-zinc-900 border border-zinc-800 p-4 rounded-xl flex items-center gap-3 text-zinc-400 text-xs">
                                <ShieldAlert className="text-yellow-500 shrink-0" size={16} />
                                <span>Vista de solo lectura. La gestión de proveedores y compras es de acceso exclusivo para el <strong>Socio Administrador</strong>.</span>
                            </div>
                        )}

                        {/* Register Purchase Form */}
                        {editingCompra && (
                            <div className="bg-zinc-900 border border-fire/30 rounded-2xl p-6 space-y-6 max-w-4xl">
                                <h3 className="font-bold font-serif text-md text-white">Nueva Orden / Compra de Insumos</h3>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                    <div>
                                        <label className="text-[10px] uppercase tracking-wider font-bold text-zinc-400 block mb-1">Proveedor *</label>
                                        <select
                                            className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-sm text-white focus:border-fire outline-none"
                                            value={compraForm.proveedor_id}
                                            onChange={e => setCompraForm(p => ({ ...p, proveedor_id: e.target.value }))}
                                        >
                                            <option value="">Seleccione proveedor...</option>
                                            {proveedoresList.filter(p => p.activo).map(p => (
                                                <option key={p.id} value={p.id}>{p.nombre}</option>
                                            ))}
                                        </select>
                                    </div>
                                    <div>
                                        <label className="text-[10px] uppercase tracking-wider font-bold text-zinc-400 block mb-1">Observaciones</label>
                                        <input
                                            type="text"
                                            className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-sm text-white focus:border-fire outline-none"
                                            placeholder="Detalle o número de factura..."
                                            value={compraForm.observaciones}
                                            onChange={e => setCompraForm(p => ({ ...p, observaciones: e.target.value }))}
                                        />
                                    </div>
                                </div>

                                {/* Form Add Items Details */}
                                <div className="border-t border-zinc-800 pt-4 space-y-4">
                                    <h4 className="font-bold text-xs uppercase tracking-wider text-zinc-300">Detalle de Insumos Comprados</h4>
                                    <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 bg-zinc-950 p-4 rounded-xl border border-zinc-850">
                                        <div className="sm:col-span-2 relative">
                                            <label className="text-[9px] uppercase tracking-wider font-bold text-zinc-500 block mb-1">Seleccionar Insumo</label>
                                            {/* Input de búsqueda — P0 fix */}
                                            <div className="relative">
                                                <input
                                                    type="text"
                                                    className="w-full bg-zinc-900 border border-zinc-800 rounded px-2.5 py-1.5 text-xs text-white focus:border-fire outline-none pr-8"
                                                    placeholder="Buscar insumo..."
                                                    value={compraInsumoSearch}
                                                    onChange={e => {
                                                        setCompraInsumoSearch(e.target.value);
                                                        // Si borra el texto, deselecciona
                                                        if (!e.target.value) setSelectedDetail(p => ({ ...p, insumo_id: '' }));
                                                    }}
                                                />
                                                {compraInsumoSearch && (
                                                    <button
                                                        onClick={() => { setCompraInsumoSearch(''); setSelectedDetail(p => ({ ...p, insumo_id: '' })); }}
                                                        className="absolute right-2 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-white text-xs"
                                                    >×</button>
                                                )}
                                            </div>
                                            {/* Dropdown filtrado */}
                                            {compraInsumoSearch && !selectedDetail.insumo_id && (() => {
                                                const filtered = insumosList.filter(i =>
                                                    i.activo && i.nombre.toLowerCase().includes(compraInsumoSearch.toLowerCase())
                                                );
                                                return filtered.length > 0 ? (
                                                    <div className="absolute z-10 mt-1 w-full bg-zinc-900 border border-zinc-700 rounded-lg shadow-xl max-h-48 overflow-y-auto">
                                                        {filtered.map(i => (
                                                            <button
                                                                key={i.id}
                                                                type="button"
                                                                onClick={() => {
                                                                    setSelectedDetail(p => ({ ...p, insumo_id: i.id }));
                                                                    setCompraInsumoSearch(`${i.nombre} (${i.unidad_medida})`);
                                                                }}
                                                                className="w-full text-left px-3 py-2 text-xs text-zinc-200 hover:bg-zinc-800 transition-colors"
                                                            >
                                                                <span className="font-semibold">{i.nombre}</span>
                                                                <span className="text-zinc-500 ml-1">({i.unidad_medida})</span>
                                                            </button>
                                                        ))}
                                                    </div>
                                                ) : (
                                                    <div className="absolute z-10 mt-1 w-full bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-2 text-xs text-zinc-500">
                                                        Sin resultados para "{compraInsumoSearch}"
                                                    </div>
                                                );
                                            })()}
                                            {/* Indicador de insumo seleccionado */}
                                            {selectedDetail.insumo_id && (
                                                <p className="text-[9px] text-green-400 mt-1">✓ Insumo seleccionado</p>
                                            )}
                                        </div>
                                        <div>
                                            <label className="text-[9px] uppercase tracking-wider font-bold text-zinc-500 block mb-1">Cantidad</label>
                                            <input
                                                type="number"
                                                className="w-full bg-zinc-900 border border-zinc-800 rounded px-2.5 py-1.5 text-xs text-white focus:border-fire outline-none font-mono"
                                                value={selectedDetail.cantidad}
                                                onChange={e => setSelectedDetail(p => ({ ...p, cantidad: e.target.value }))}
                                            />
                                        </div>
                                        <div>
                                            <label className="text-[9px] uppercase tracking-wider font-bold text-zinc-500 block mb-1">Costo Unitario ($)</label>
                                            <div className="flex gap-2">
                                                <input
                                                    type="number"
                                                    className="w-full bg-zinc-900 border border-zinc-800 rounded px-2.5 py-1.5 text-xs text-white focus:border-fire outline-none font-mono"
                                                    value={selectedDetail.costo_unitario}
                                                    onChange={e => setSelectedDetail(p => ({ ...p, costo_unitario: e.target.value }))}
                                                />
                                                <button
                                                    onClick={handleAddCompraDetail}
                                                    className="bg-fire text-white px-3 rounded text-xs font-bold hover:bg-orange-700 transition-colors"
                                                >
                                                    Agregar
                                                </button>
                                            </div>
                                        </div>
                                    </div>

                                    {/* List added details */}
                                    <div className="overflow-x-auto border border-zinc-800 rounded-lg">
                                        <table className="w-full text-left text-xs border-collapse">
                                            <thead>
                                                <tr className="bg-zinc-950 text-zinc-400 font-bold border-b border-zinc-850">
                                                    <th className="p-3">Insumo</th>
                                                    <th className="p-3 text-center">Cantidad</th>
                                                    <th className="p-3 text-right">Costo Unitario</th>
                                                    <th className="p-3 text-right">Subtotal</th>
                                                    <th className="p-3 text-right">Acciones</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-zinc-850">
                                                {compraForm.details.length === 0 ? (
                                                    <tr>
                                                        <td colSpan="5" className="p-4 text-center text-zinc-600">No se han agregado insumos al detalle</td>
                                                    </tr>
                                                ) : (
                                                    compraForm.details.map((item, index) => (
                                                        <tr key={index} className="hover:bg-zinc-850/10">
                                                            <td className="p-3 font-semibold text-zinc-200">{item.nombre}</td>
                                                            <td className="p-3 text-center font-mono">{item.cantidad}</td>
                                                            <td className="p-3 text-right font-mono">${item.costo_unitario.toLocaleString()}</td>
                                                            <td className="p-3 text-right font-mono text-green-400 font-bold">${item.subtotal.toLocaleString()}</td>
                                                            <td className="p-3 text-right">
                                                                <button
                                                                    onClick={() => handleRemoveCompraDetail(index)}
                                                                    className="text-red-500 hover:text-red-300 font-bold"
                                                                >
                                                                    Quitar
                                                                </button>
                                                            </td>
                                                        </tr>
                                                    ))
                                                )}
                                            </tbody>
                                        </table>
                                    </div>
                                    <div className="text-right text-sm font-bold text-white pr-4">
                                        Total Compra: <span className="text-fire font-serif text-lg">${compraForm.details.reduce((sum, item) => sum + item.subtotal, 0).toLocaleString()}</span>
                                    </div>
                                </div>

                                {/* F6-05: Selector de método de pago — solo visible cuando se va a recibir */}
                                <div className="border border-zinc-800 rounded-xl p-4 bg-zinc-950/40">
                                    <p className="text-xs text-zinc-400 mb-2 font-semibold uppercase tracking-wider">Método de pago (requerido al recibir)</p>
                                    <div className="flex gap-2">
                                        {['EFECTIVO', 'NEQUI', 'BANCOLOMBIA'].map(m => (
                                            <button
                                                key={m}
                                                type="button"
                                                onClick={() => setCompraForm(f => ({ ...f, metodo_pago: m }))}
                                                className={`px-4 py-2 rounded-lg text-xs font-bold border transition-all ${
                                                    compraForm.metodo_pago === m
                                                        ? 'bg-fire text-white border-fire'
                                                        : 'bg-zinc-900 text-zinc-400 border-zinc-700 hover:border-fire/50'
                                                }`}
                                            >
                                                {m}
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                <div className="flex flex-wrap gap-3 border-t border-zinc-800 pt-4">
                                    <button
                                        onClick={() => handleSaveCompra(false)}
                                        disabled={actionLoading}
                                        className="bg-zinc-800 hover:bg-zinc-700 text-zinc-200 px-5 py-2.5 rounded-lg text-xs font-bold transition-all disabled:opacity-50"
                                    >
                                        Guardar Borrador
                                    </button>
                                    <button
                                        onClick={() => handleSaveCompra(true)}
                                        disabled={actionLoading}
                                        className="bg-fire hover:bg-orange-700 text-white px-5 py-2.5 rounded-lg text-xs font-bold transition-all disabled:opacity-50"
                                    >
                                        Guardar y Recibir (egreso {compraForm.metodo_pago})
                                    </button>
                                    <button
                                        onClick={() => { setEditingCompra(null); setCompraInsumoSearch(''); setSelectedDetail({ insumo_id: '', cantidad: 1, costo_unitario: 0 }); }}
                                        className="bg-zinc-950 text-zinc-400 border border-zinc-850 px-5 py-2.5 rounded-lg text-xs font-bold hover:text-white transition-all ml-auto"
                                    >
                                        Cancelar
                                    </button>
                                </div>
                            </div>
                        )}

                        {/* Split views: Providers and Purchases History */}
                        <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">

                            {/* Left: Providers management (Socio only CRUD, Admin Read) */}
                            <div className="xl:col-span-1 space-y-6">
                                <div className="bg-zinc-900 border border-zinc-800/60 rounded-2xl p-5 space-y-4">
                                    <div className="flex justify-between items-center border-b border-zinc-850 pb-2">
                                        <h2 className="text-md font-serif text-white flex items-center gap-2">
                                            <Truck size={16} className="text-fire" />
                                            Proveedores
                                        </h2>
                                        {currentUserProfile?.es_socio && !editingProveedor && (
                                            <button
                                                onClick={() => {
                                                    setEditingProveedor('new');
                                                    setProveedorForm({ nombre: '', telefono: '', contacto: '', activo: true });
                                                }}
                                                className="text-xs text-fire font-bold underline hover:text-orange-400"
                                            >
                                                Nuevo
                                            </button>
                                        )}
                                    </div>

                                    {/* Provider Form inline */}
                                    {editingProveedor && (
                                        <div className="bg-zinc-950 p-4 rounded-xl border border-zinc-850 space-y-3">
                                            <h4 className="text-xs font-bold text-white">{editingProveedor === 'new' ? 'Agregar Proveedor' : 'Editar Proveedor'}</h4>
                                            <div>
                                                <label className="text-[9px] font-bold text-zinc-500 uppercase block mb-1">Nombre *</label>
                                                <input
                                                    type="text"
                                                    className="w-full bg-zinc-900 border border-zinc-800 rounded px-2 py-1 text-xs text-white"
                                                    value={proveedorForm.nombre}
                                                    onChange={e => setProveedorForm(p => ({ ...p, nombre: e.target.value }))}
                                                />
                                            </div>
                                            <div>
                                                <label className="text-[9px] font-bold text-zinc-500 uppercase block mb-1">Teléfono</label>
                                                <input
                                                    type="text"
                                                    className="w-full bg-zinc-900 border border-zinc-800 rounded px-2 py-1 text-xs text-white"
                                                    value={proveedorForm.telefono}
                                                    onChange={e => setProveedorForm(p => ({ ...p, telefono: e.target.value }))}
                                                />
                                            </div>
                                            <div>
                                                <label className="text-[9px] font-bold text-zinc-500 uppercase block mb-1">Contacto / Nombre</label>
                                                <input
                                                    type="text"
                                                    className="w-full bg-zinc-900 border border-zinc-800 rounded px-2 py-1 text-xs text-white"
                                                    value={proveedorForm.contacto}
                                                    onChange={e => setProveedorForm(p => ({ ...p, contacto: e.target.value }))}
                                                />
                                            </div>
                                            <div className="flex gap-2 pt-2">
                                                <button
                                                    onClick={handleSaveProveedor}
                                                    className="bg-fire text-white px-3 py-1 rounded text-xs font-bold hover:bg-orange-700"
                                                >
                                                    Guardar
                                                </button>
                                                <button
                                                    onClick={() => setEditingProveedor(null)}
                                                    className="bg-zinc-800 text-zinc-400 px-3 py-1 rounded text-xs hover:text-white"
                                                >
                                                    Cancelar
                                                </button>
                                            </div>
                                        </div>
                                    )}

                                    {/* Providers List list */}
                                    <div className="divide-y divide-zinc-850 max-h-[400px] overflow-y-auto pr-1">
                                        {proveedoresList.length === 0 ? (
                                            <p className="text-xs text-zinc-500 text-center py-6">No hay proveedores registrados</p>
                                        ) : (
                                            proveedoresList.map(prov => (
                                                <div key={prov.id} className="py-3 flex justify-between items-center text-xs">
                                                    <div>
                                                        <h4 className="font-semibold text-zinc-200">{prov.nombre}</h4>
                                                        <p className="text-[10px] text-zinc-500">{prov.contacto || 'Sin contacto'} • {prov.telefono || 'Sin tlf'}</p>
                                                    </div>
                                                    <div className="flex items-center gap-2">
                                                        {currentUserProfile?.es_socio && (
                                                            <>
                                                                <button
                                                                    onClick={() => {
                                                                        setEditingProveedor(prov.id);
                                                                        setProveedorForm({
                                                                            nombre: prov.nombre,
                                                                            telefono: prov.telefono || '',
                                                                            contacto: prov.contacto || '',
                                                                            activo: prov.activo
                                                                        });
                                                                    }}
                                                                    className="text-zinc-500 hover:text-white font-bold"
                                                                >
                                                                    Editar
                                                                </button>
                                                                <button
                                                                    onClick={() => handleToggleProveedorActivo(prov)}
                                                                    className={`px-2 py-0.5 rounded font-bold text-[9px] ${prov.activo ? 'bg-red-950/20 text-red-400' : 'bg-green-950/20 text-green-400'
                                                                        }`}
                                                                >
                                                                    {prov.activo ? 'Apagar' : 'Prender'}
                                                                </button>
                                                            </>
                                                        )}
                                                    </div>
                                                </div>
                                            ))
                                        )}
                                    </div>
                                </div>
                            </div>

                            {/* Right: Purchases History List */}
                            <div className="xl:col-span-2 bg-zinc-900 border border-zinc-800/60 rounded-2xl overflow-hidden">
                                <div className="p-5 border-b border-zinc-850 bg-zinc-950/20">
                                    <h2 className="text-md font-serif text-white flex items-center gap-2">
                                        <FileText size={16} className="text-fire" />
                                        Historial de Compras y Carga
                                    </h2>
                                </div>
                                <div className="overflow-x-auto">
                                    <table className="w-full text-left text-xs border-collapse">
                                        <thead>
                                            <tr className="bg-zinc-950/40 text-zinc-400 font-bold border-b border-zinc-800 uppercase tracking-wider">
                                                <th className="p-4">Fecha</th>
                                                <th className="p-4">Proveedor</th>
                                                <th className="p-4">Registrado por</th>
                                                <th className="p-4">Estado</th>
                                                <th className="p-4 text-right">Total</th>
                                                {currentUserProfile?.es_socio && <th className="p-4 text-right">Acciones</th>}
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-zinc-850">
                                            {comprasLoading ? (
                                                <tr>
                                                    <td colSpan="6" className="p-8 text-center text-zinc-500 animate-pulse">Cargando compras...</td>
                                                </tr>
                                            ) : comprasList.length === 0 ? (
                                                <tr>
                                                    <td colSpan="6" className="p-8 text-center text-zinc-500">No se registran compras registradas</td>
                                                </tr>
                                            ) : (
                                                comprasList.map(cmp => (
                                                    <tr key={cmp.id} className="hover:bg-zinc-850/10">
                                                        <td className="p-4 text-zinc-400 font-mono text-[10px]">
                                                            {new Date(cmp.fecha).toLocaleString('es-ES')}
                                                        </td>
                                                        <td className="p-4 font-semibold text-zinc-200">{cmp.proveedores?.nombre}</td>
                                                        <td className="p-4 text-zinc-400">{cmp.perfiles_trabajadores?.nombre || 'Desconocido'}</td>
                                                        <td className="p-4">
                                                            <span className={`text-[9px] font-bold px-2 py-0.5 rounded ${cmp.estado === 'RECIBIDA'
                                                                    ? 'bg-green-500/10 text-green-400'
                                                                    : cmp.estado === 'BORRADOR'
                                                                        ? 'bg-yellow-500/10 text-yellow-400'
                                                                        : 'bg-red-500/10 text-red-400'
                                                                }`}>
                                                                {cmp.estado}
                                                            </span>
                                                        </td>
                                                        <td className="p-4 text-right font-bold text-zinc-100 font-mono">
                                                            ${cmp.total.toLocaleString()}
                                                        </td>
                                                        {currentUserProfile?.es_socio && (
                                                            <td className="p-4 text-right space-x-2">
                                                                {cmp.estado === 'BORRADOR' && (
                                                                    <>
                                                                        <button
                                                                            onClick={() => handleRecibirCompra(cmp)}
                                                                            disabled={actionLoading}
                                                                            className="bg-green-950/20 text-green-400 px-2 py-1 rounded font-bold text-[10px] hover:bg-green-950/40 disabled:opacity-50 disabled:cursor-not-allowed"
                                                                        >
                                                                            {actionLoading ? 'Procesando...' : 'Recibir'}
                                                                        </button>
                                                                        <button
                                                                            onClick={() => setShowAnularModal(cmp)}
                                                                            disabled={actionLoading}
                                                                            className="bg-red-950/20 text-red-400 px-2 py-1 rounded font-bold text-[10px] hover:bg-red-950/40 disabled:opacity-50 disabled:cursor-not-allowed"
                                                                        >
                                                                            Anular
                                                                        </button>
                                                                    </>
                                                                )}
                                                                {cmp.estado === 'RECIBIDA' && (
                                                                    <button
                                                                        onClick={() => setShowAnularModal(cmp)}
                                                                        disabled={actionLoading}
                                                                        className="bg-red-950/20 text-red-400 px-2 py-1 rounded font-bold text-[10px] hover:bg-red-950/40 disabled:opacity-50 disabled:cursor-not-allowed"
                                                                    >
                                                                        Anular
                                                                    </button>
                                                                )}
                                                            </td>
                                                        )}
                                                    </tr>
                                                ))
                                            )}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* Modal Anular Compra (Socio only) */}
                {showAnularModal && (
                    <div className="fixed inset-0 bg-black/80 flex items-center justify-center p-6 z-[999]">
                        <div className="w-full max-w-sm bg-zinc-900 border border-zinc-800 rounded-3xl p-5 shadow-2xl relative space-y-4 font-sans">
                            <div className="flex justify-between items-center border-b border-zinc-850 pb-2">
                                <h3 className="text-sm font-bold font-serif text-white">Anular Compra</h3>
                                <button onClick={() => { setShowAnularModal(null); setAnularMotivo(''); }} className="text-zinc-500 hover:text-white">✕</button>
                            </div>
                            <div className="space-y-3">
                                <p className="text-xs text-zinc-400">
                                    ¿Confirmar anulación de la compra seleccionada? {showAnularModal.estado === 'RECIBIDA' && 'Se revertirá el stock de los insumos relacionados (siempre que no quede stock negativo).'}
                                </p>
                                <div>
                                    <label className="text-[10px] uppercase tracking-wider font-bold text-zinc-400 block mb-1">Motivo / Justificación *</label>
                                    <textarea
                                        rows="3"
                                        className="w-full bg-zinc-950 border border-zinc-800 rounded-lg p-2.5 text-xs text-white focus:border-fire outline-none resize-none"
                                        placeholder="Describa el motivo detallado de la anulación..."
                                        value={anularMotivo}
                                        onChange={e => setAnularMotivo(e.target.value)}
                                    />
                                </div>
                            </div>
                            <button
                                onClick={handleAnularCompra}
                                disabled={actionLoading}
                                className="w-full bg-fire text-white py-2 rounded-lg text-xs font-bold hover:bg-orange-700 transition-all disabled:opacity-50 uppercase tracking-wider"
                            >
                                {actionLoading ? 'Procesando...' : 'Confirmar Anulación'}
                            </button>
                        </div>
                    </div>
                )}

                {/* F6-05: Modal de recepción de compra con selector de método de pago */}
                {showRecibirModal && (
                    <div className="fixed inset-0 bg-black/85 flex items-center justify-center p-4 z-[999]">
                        <div className="w-full max-w-md bg-zinc-900 border border-zinc-800 rounded-3xl p-6 shadow-2xl relative space-y-5">
                            <div className="flex justify-between items-center border-b border-zinc-800 pb-3">
                                <h3 className="text-lg font-bold font-serif text-white">Recibir Compra</h3>
                                <button onClick={() => setShowRecibirModal(null)} className="text-zinc-500 hover:text-white text-xl">×</button>
                            </div>
                            <div className="space-y-4">
                                <p className="text-sm text-zinc-300">
                                    Confirmar recepción de compra por&nbsp;
                                    <span className="text-fire font-bold">${Number(showRecibirModal.total || 0).toLocaleString()}</span>
                                </p>
                                <div>
                                    <label className="text-[10px] uppercase tracking-wider font-bold text-zinc-400 block mb-2">Método de pago *</label>
                                    <div className="flex gap-2">
                                        {['EFECTIVO', 'NEQUI', 'BANCOLOMBIA'].map(m => (
                                            <button
                                                key={m}
                                                type="button"
                                                onClick={() => setRecibirMetodoPago(m)}
                                                className={`flex-1 py-2.5 rounded-lg text-xs font-bold border transition-all ${
                                                    recibirMetodoPago === m
                                                        ? 'bg-fire text-white border-fire'
                                                        : 'bg-zinc-950 text-zinc-400 border-zinc-700 hover:border-fire/50'
                                                }`}
                                            >
                                                {m}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                                <p className="text-[10px] text-zinc-500">
                                    Se registrará un egreso en caja por ${Number(showRecibirModal.total || 0).toLocaleString()} ({recibirMetodoPago}) y se actualizará el inventario.
                                </p>
                            </div>
                            <button
                                onClick={handleConfirmarRecibir}
                                disabled={actionLoading}
                                className="w-full bg-green-700 hover:bg-green-600 text-white py-2.5 rounded-lg text-xs font-bold transition-all disabled:opacity-50 uppercase tracking-wider"
                            >
                                {actionLoading ? 'Procesando...' : `Confirmar Recepción (${recibirMetodoPago})`}
                            </button>
                        </div>
                    </div>
                )}

                {/* Modal Carga Rápida de Inventario / Toma Física (Socio only) */}
                {showCargaMasivaModal && (
                    <div className="fixed inset-0 bg-black/85 flex items-center justify-center p-4 z-[999]">
                        <div className="w-full max-w-4xl bg-zinc-900 border border-zinc-800 rounded-3xl p-6 shadow-2xl relative space-y-5 font-sans max-h-[90vh] flex flex-col">
                            <div className="flex justify-between items-center border-b border-zinc-850 pb-3">
                                <div>
                                    <h3 className="text-lg font-bold font-serif text-white flex items-center gap-2">
                                        <PackageCheck className="text-green-500" size={22} />
                                        Carga Rápida de Stock Inicial / Toma Física
                                    </h3>
                                    <p className="text-xs text-zinc-400 mt-0.5">
                                        Actualiza el stock físico de todos los insumos de una sola vez. Se registrarán los movimientos correspondientes.
                                    </p>
                                </div>
                                <button
                                    onClick={() => setShowCargaMasivaModal(false)}
                                    className="text-zinc-500 hover:text-white text-lg font-bold"
                                >
                                    ✕
                                </button>
                            </div>

                            <div className="flex flex-wrap justify-between items-center gap-3 bg-zinc-950 p-3 rounded-xl border border-zinc-850">
                                <div className="flex items-center gap-2">
                                    <label className="text-xs font-bold text-zinc-300">Motivo de Carga:</label>
                                    <input
                                        type="text"
                                        className="bg-zinc-900 border border-zinc-800 rounded px-3 py-1 text-xs text-white focus:border-fire outline-none w-64"
                                        value={cargaMasivaMotivo}
                                        onChange={e => setCargaMasivaMotivo(e.target.value)}
                                    />
                                </div>
                                <button
                                    type="button"
                                    onClick={handleAutoFillStockRecomendado}
                                    className="bg-zinc-800 hover:bg-zinc-700 text-gold border border-gold/30 px-3 py-1 rounded text-xs font-bold transition-all flex items-center gap-1.5"
                                >
                                    ⚡ Cargar Stock Recomendado
                                </button>
                            </div>

                            <div className="overflow-y-auto flex-1 pr-1 border border-zinc-800 rounded-xl bg-zinc-950">
                                <table className="w-full text-left text-xs border-collapse">
                                    <thead className="sticky top-0 bg-zinc-900 border-b border-zinc-800 text-zinc-400 uppercase font-bold text-[10px]">
                                        <tr>
                                            <th className="p-3">#</th>
                                            <th className="p-3">Insumo</th>
                                            <th className="p-3">Unidad</th>
                                            <th className="p-3 text-right">Costo Unit.</th>
                                            <th className="p-3 text-center">Stock Actual</th>
                                            <th className="p-3 text-right">Nuevo Stock Físico</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-zinc-850">
                                        {insumosList.map((ins, index) => (
                                            <tr key={ins.id} className="hover:bg-zinc-850/20">
                                                <td className="p-3 text-zinc-500 font-mono text-[10px]">{index + 1}</td>
                                                <td className="p-3 font-semibold text-zinc-200">{ins.nombre}</td>
                                                <td className="p-3 text-zinc-400">{ins.unidad_medida}</td>
                                                <td className="p-3 text-right font-mono text-zinc-400">${Number(ins.costo_unitario || 0).toLocaleString()}</td>
                                                <td className="p-3 text-center font-mono font-bold text-zinc-400">{ins.stock_actual}</td>
                                                <td className="p-3 text-right">
                                                    <input
                                                        type="number"
                                                        step="any"
                                                        min="0"
                                                        className="bg-zinc-900 border border-zinc-700 focus:border-green-500 rounded px-2.5 py-1 text-xs text-white text-right font-mono font-bold w-28 outline-none"
                                                        value={cargaMasivaForm[ins.id] !== undefined ? cargaMasivaForm[ins.id] : ins.stock_actual}
                                                        onChange={e => {
                                                            const val = e.target.value;
                                                            setCargaMasivaForm(prev => ({ ...prev, [ins.id]: val }));
                                                        }}
                                                    />
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>

                            <div className="flex justify-end gap-3 border-t border-zinc-850 pt-3">
                                <button
                                    onClick={() => setShowCargaMasivaModal(false)}
                                    className="bg-zinc-800 text-zinc-300 px-4 py-2 rounded-lg text-xs font-bold hover:bg-zinc-700 transition-all"
                                >
                                    Cancelar
                                </button>
                                <button
                                    onClick={handleSaveCargaMasiva}
                                    disabled={cargaMasivaSaving}
                                    className="bg-gradient-to-r from-emerald-600 to-green-600 hover:from-emerald-500 hover:to-green-500 text-white px-6 py-2 rounded-lg text-xs font-bold uppercase tracking-wider shadow-lg shadow-green-900/30 transition-all disabled:opacity-50"
                                >
                                    {cargaMasivaSaving ? 'Guardando Inventario...' : '💾 Guardar Carga Inicial de Inventario'}
                                </button>
                            </div>
                        </div>
                    </div>
                )}



                {showGenerarLiqModal && (
                    <div className="fixed inset-0 bg-black/85 flex items-center justify-center p-4 z-[999]">
                        <div className="w-full max-w-md bg-zinc-900 border border-zinc-800 rounded-3xl p-6 shadow-2xl relative space-y-4 font-sans">
                            <div className="flex justify-between items-center border-b border-zinc-800 pb-3">
                                <h3 className="text-lg font-bold font-serif text-white flex items-center gap-2">
                                    <DollarSign className="text-fire" size={20} />
                                    Generar Liquidación de Trabajo
                                </h3>
                                <button onClick={() => setShowGenerarLiqModal(false)} className="text-zinc-500 hover:text-white">✕</button>
                            </div>

                            <div className="space-y-3 text-xs">
                                <div>
                                    <label className="text-[10px] font-bold uppercase text-zinc-400 block mb-1">Trabajador *</label>
                                    <select
                                        className="w-full bg-zinc-950 border border-zinc-800 rounded-lg p-2.5 text-white outline-none focus:border-fire"
                                        value={selectedWorkerForLiq?.id || ''}
                                        onChange={(e) => {
                                            const w = staffList.find(s => s.id === e.target.value);
                                            setSelectedWorkerForLiq(w);
                                            if (w) {
                                                setLiqModalidadForm(w.modalidad_pago || 'POR_TURNO');
                                                setLiqMontoForm(w.tarifa_pago || 0);
                                            }
                                        }}
                                    >
                                        {staffList.map(s => (
                                            <option key={s.id} value={s.id}>{s.nombre} ({s.rol})</option>
                                        ))}
                                    </select>
                                </div>

                                <div>
                                    <label className="text-[10px] font-bold uppercase text-zinc-400 block mb-1">Modalidad de Pago *</label>
                                    <select
                                        className="w-full bg-zinc-950 border border-zinc-800 rounded-lg p-2.5 text-white outline-none focus:border-fire"
                                        value={liqModalidadForm}
                                        onChange={(e) => setLiqModalidadForm(e.target.value)}
                                    >
                                        <option value="POR_TURNO">POR_TURNO (Pago fijo por turno)</option>
                                        <option value="POR_HORA">POR_HORA (Pago por horas laboradas)</option>
                                        <option value="POR_VENTA">POR_VENTA (Comisión por ventas)</option>
                                    </select>
                                </div>

                                <div>
                                    <label className="text-[10px] font-bold uppercase text-zinc-400 block mb-1">Monto a Liquidar ($) *</label>
                                    <input
                                        type="number"
                                        className="w-full bg-zinc-950 border border-zinc-800 rounded-lg p-2.5 text-white outline-none focus:border-fire font-bold text-sm"
                                        value={liqMontoForm}
                                        onChange={(e) => setLiqMontoForm(Number(e.target.value))}
                                    />
                                </div>

                                <div>
                                    <label className="text-[10px] font-bold uppercase text-zinc-400 block mb-1">Observaciones / Justificación</label>
                                    <textarea
                                        rows="2"
                                        className="w-full bg-zinc-950 border border-zinc-800 rounded-lg p-2 text-white outline-none focus:border-fire resize-none"
                                        placeholder="Turno noche, comisiones del día, horas extra..."
                                        value={liqObsForm}
                                        onChange={(e) => setLiqObsForm(e.target.value)}
                                    />
                                </div>
                            </div>

                            <button
                                onClick={handleGenerarLiquidacion}
                                disabled={actionLoading}
                                className="w-full bg-fire hover:bg-orange-700 text-white py-3 rounded-lg font-bold transition-all uppercase tracking-wider text-xs shadow-lg disabled:opacity-50"
                            >
                                {actionLoading ? 'Procesando...' : '💾 Confirmar Liquidación'}
                            </button>
                        </div>
                    </div>
                )}

                {/* Modal Registrar Gasto */}
                {showNewGastoModal && (
                    <div className="fixed inset-0 bg-black/85 flex items-center justify-center p-4 z-[999]">
                        <div className="w-full max-w-md bg-zinc-900 border border-zinc-800 rounded-3xl p-6 shadow-2xl relative space-y-4 font-sans">
                            <div className="flex justify-between items-center border-b border-zinc-800 pb-3">
                                <h3 className="text-lg font-bold font-serif text-white flex items-center gap-2">
                                    <Receipt className="text-fire" size={20} />
                                    Registrar Gasto Operativo
                                </h3>
                                <button onClick={() => setShowNewGastoModal(false)} className="text-zinc-500 hover:text-white">✕</button>
                            </div>

                            <div className="space-y-3 text-xs">
                                <div>
                                    <label className="text-[10px] font-bold uppercase text-zinc-400 block mb-1">Categoría *</label>
                                    <select
                                        className="w-full bg-zinc-950 border border-zinc-800 rounded-lg p-2.5 text-white outline-none focus:border-fire"
                                        value={gastoForm.categoria_id}
                                        onChange={(e) => setGastoForm({ ...gastoForm, categoria_id: e.target.value })}
                                    >
                                        <option value="">Seleccione una categoría</option>
                                        {categoriasGastosList.filter(c => c.activo).map(c => (
                                            <option key={c.id} value={c.id}>{c.nombre}</option>
                                        ))}
                                    </select>
                                </div>

                                <div>
                                    <label className="text-[10px] font-bold uppercase text-zinc-400 block mb-1">Descripción / Justificación</label>
                                    <input
                                        type="text"
                                        placeholder="Ej. Compra de bombillos, reparación de parrilla..."
                                        className="w-full bg-zinc-950 border border-zinc-800 rounded-lg p-2.5 text-white outline-none focus:border-fire text-sm"
                                        value={gastoForm.descripcion}
                                        onChange={(e) => setGastoForm({ ...gastoForm, descripcion: e.target.value })}
                                    />
                                </div>

                                <div>
                                    <label className="text-[10px] font-bold uppercase text-zinc-400 block mb-1">Monto ($) *</label>
                                    <input
                                        type="number"
                                        className="w-full bg-zinc-950 border border-zinc-800 rounded-lg p-2.5 text-white outline-none focus:border-fire font-bold text-sm"
                                        value={gastoForm.monto}
                                        onChange={(e) => setGastoForm({ ...gastoForm, monto: e.target.value })}
                                    />
                                </div>

                                <div>
                                    <label className="text-[10px] font-bold uppercase text-zinc-400 block mb-1">Método de Pago *</label>
                                    <select
                                        className="w-full bg-zinc-950 border border-zinc-800 rounded-lg p-2.5 text-white outline-none focus:border-fire"
                                        value={gastoForm.metodo_pago}
                                        onChange={(e) => setGastoForm({ ...gastoForm, metodo_pago: e.target.value })}
                                    >
                                        <option value="EFECTIVO">EFECTIVO</option>
                                        <option value="NEQUI">NEQUI</option>
                                        <option value="BANCOLOMBIA">BANCOLOMBIA</option>
                                    </select>
                                </div>
                            </div>

                            <button
                                onClick={handleRegistrarGasto}
                                disabled={actionLoading}
                                className="w-full bg-fire hover:bg-orange-700 text-white py-3 rounded-lg font-bold transition-all uppercase tracking-wider text-xs shadow-lg disabled:opacity-50"
                            >
                                {actionLoading ? 'Procesando...' : '💾 Registrar Gasto'}
                            </button>
                        </div>
                    </div>
                )}

                {/* Modal Nueva Categoría */}
                {showNewCategoriaModal && (
                    <div className="fixed inset-0 bg-black/85 flex items-center justify-center p-4 z-[999]">
                        <div className="w-full max-w-sm bg-zinc-900 border border-zinc-800 rounded-3xl p-6 shadow-2xl relative space-y-4 font-sans">
                            <div className="flex justify-between items-center border-b border-zinc-800 pb-3">
                                <h3 className="text-base font-bold font-serif text-white flex items-center gap-2">
                                    📁 Nueva Categoría de Gasto
                                </h3>
                                <button onClick={() => setShowNewCategoriaModal(false)} className="text-zinc-500 hover:text-white">✕</button>
                            </div>

                            <div className="space-y-3 text-xs">
                                <div>
                                    <label className="text-[10px] font-bold uppercase text-zinc-400 block mb-1">Nombre *</label>
                                    <input
                                        type="text"
                                        placeholder="Ej. Publicidad, Gas, Electricidad..."
                                        className="w-full bg-zinc-950 border border-zinc-800 rounded-lg p-2.5 text-white outline-none focus:border-fire text-sm"
                                        value={categoriaForm.nombre}
                                        onChange={(e) => setCategoriaForm({ ...categoriaForm, nombre: e.target.value })}
                                    />
                                </div>
                            </div>

                            <button
                                onClick={handleCrearCategoria}
                                disabled={actionLoading}
                                className="w-full bg-fire hover:bg-orange-700 text-white py-2.5 rounded-lg font-bold transition-all uppercase tracking-wider text-xs shadow-lg disabled:opacity-50"
                            >
                                {actionLoading ? 'Guardando...' : '💾 Guardar Categoría'}
                            </button>
                        </div>
                    </div>
                )}

                {/* Modal Anular Gasto */}
                {showAnularGastoModal && (
                    <div className="fixed inset-0 bg-black/85 flex items-center justify-center p-4 z-[999]">
                        <div className="w-full max-w-md bg-zinc-900 border border-zinc-800 rounded-3xl p-6 shadow-2xl relative space-y-4 font-sans">
                            <div className="flex justify-between items-center border-b border-zinc-800 pb-3">
                                <h3 className="text-base font-bold font-serif text-red-400 flex items-center gap-2">
                                    ⚠️ Confirmar Anulación de Gasto
                                </h3>
                                <button onClick={() => setShowAnularGastoModal(null)} className="text-zinc-500 hover:text-white">✕</button>
                            </div>

                            <div className="space-y-3 text-xs">
                                <p className="text-zinc-400">
                                    ¿Está seguro que desea anular el gasto registrado por <span className="font-bold text-white">${Number(showAnularGastoModal.monto || 0).toLocaleString()}</span>?
                                </p>
                                <p className="text-zinc-500 text-[10px]">
                                    Esta acción preservará el registro de egreso original y creará un ingreso compensatorio automático del mismo valor en caja para corregir el saldo financiero.
                                </p>

                                <div>
                                    <label className="text-[10px] font-bold uppercase text-zinc-400 block mb-1">Motivo de Anulación *</label>
                                    <input
                                        type="text"
                                        placeholder="Ej. Registro duplicado, error en monto..."
                                        className="w-full bg-zinc-950 border border-zinc-800 rounded-lg p-2.5 text-white outline-none focus:border-fire text-sm"
                                        value={anularGastoMotivo}
                                        onChange={(e) => setAnularGastoMotivo(e.target.value)}
                                    />
                                </div>
                            </div>

                            <button
                                onClick={handleAnularGasto}
                                disabled={actionLoading}
                                className="w-full bg-red-600 hover:bg-red-700 text-white py-3 rounded-lg font-bold transition-all uppercase tracking-wider text-xs shadow-lg disabled:opacity-50"
                            >
                                {actionLoading ? 'Procesando...' : '⚠️ Confirmar Anulación'}
                            </button>
                        </div>
                    </div>
                )}

                {/* Modal Anular Liquidación */}
                {showAnularLiqModal && (
                    <div className="fixed inset-0 bg-black/85 flex items-center justify-center p-4 z-[999]">
                        <div className="w-full max-w-md bg-zinc-900 border border-zinc-800 rounded-3xl p-6 shadow-2xl relative space-y-4 font-sans">
                            <div className="flex justify-between items-center border-b border-zinc-800 pb-3">
                                <h3 className="text-base font-bold font-serif text-red-400 flex items-center gap-2">
                                    ⚠️ Confirmar Anulación de Liquidación
                                </h3>
                                <button onClick={() => setShowAnularLiqModal(null)} className="text-zinc-500 hover:text-white">✕</button>
                            </div>

                            <div className="space-y-3 text-xs">
                                <p className="text-zinc-400">
                                    Trabajador: <span className="font-bold text-white">{showAnularLiqModal.perfiles_trabajadores?.nombre || 'Desconocido'}</span>
                                </p>
                                <p className="text-zinc-400">
                                    Monto: <span className="font-bold text-white">${Number(showAnularLiqModal.monto_calculado || 0).toLocaleString()}</span>
                                    {' · '}Estado: <span className={`font-bold ${showAnularLiqModal.estado === 'PAGADO' ? 'text-green-400' : 'text-yellow-400'}`}>{showAnularLiqModal.estado}</span>
                                </p>
                                {showAnularLiqModal.estado === 'PAGADO' && (
                                    <p className="text-amber-400 text-[10px] bg-amber-500/10 px-2 py-1 rounded">
                                        ⚠️ Esta liquidación ya fue pagada. Se preservará el egreso original y se creará un INGRESO compensatorio automático en caja.
                                    </p>
                                )}
                                {showAnularLiqModal.estado === 'PENDIENTE' && (
                                    <p className="text-zinc-500 text-[10px]">
                                        Esta liquidación aún no fue pagada. No se generará ningún movimiento financiero.
                                    </p>
                                )}

                                <div>
                                    <label className="text-[10px] font-bold uppercase text-zinc-400 block mb-1">Motivo de Anulación</label>
                                    <input
                                        type="text"
                                        placeholder="Ej. Error en monto, cambio de modalidad..."
                                        className="w-full bg-zinc-950 border border-zinc-800 rounded-lg p-2.5 text-white outline-none focus:border-fire text-sm"
                                        value={anularLiqMotivo}
                                        onChange={(e) => setAnularLiqMotivo(e.target.value)}
                                    />
                                </div>
                            </div>

                            <button
                                onClick={handleAnularLiquidacion}
                                disabled={actionLoading}
                                className="w-full bg-red-600 hover:bg-red-700 text-white py-3 rounded-lg font-bold transition-all uppercase tracking-wider text-xs shadow-lg disabled:opacity-50"
                            >
                                {actionLoading ? 'Procesando...' : '⚠️ Confirmar Anulación de Liquidación'}
                            </button>
                        </div>
                    </div>
                )}

            </main>
        </div>
    );
};

export default AdminDashboard;
