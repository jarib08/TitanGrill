import React, { useEffect, useState } from 'react';
import { supabase } from '../lib/supabaseClient';
import { Users, Flame, Trophy, LogOut, ArrowRight, Award, Gift, DollarSign, Settings, ShoppingBag, Menu, X, Check, ShieldAlert, UtensilsCrossed, Plus, Pencil, PackageCheck, PackageX, Archive, ClipboardList, Trash2, Truck, FileText, Calendar, Filter, ShoppingCart, Package, AlertTriangle, Clock, TrendingUp, TrendingDown, PiggyBank, Star, BarChart3, Search, Receipt, ChevronDown, RefreshCw } from 'lucide-react';
import { useNavigate, Link } from 'react-router-dom';
import { ComposedChart, Area, Scatter, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar, PieChart, Pie, Cell, LineChart, Line, Legend } from 'recharts';
import { BottomSheet } from './ui/BottomSheet.jsx';
import NumericInput from './ui/NumericInput';
import { SectionHeader } from './ui/SectionHeader.jsx';
import { ErrorBanner } from './ui/ErrorBanner.jsx';
import Pagination from './ui/Pagination.jsx';

// ── Constantes de conversión de unidades ─────────────────────────────────────
const UNIT_CONVERSIONS = {
    'kilogramo': { to: 'gramo', factor: 1000 },
    'litro': { to: 'mililitro', factor: 1000 },
};

const COMPATIBLE_UNITS = {
    'gramo': ['gramo', 'kilogramo'],
    'kilogramo': ['gramo', 'kilogramo'],
    'mililitro': ['mililitro', 'litro'],
    'litro': ['mililitro', 'litro'],
    'unidad': ['unidad'],
    'porción': ['porción'],
};

const PURCHASE_UNIT_OPTIONS = {
    'gramo': [{ value: 'gramo', label: 'Gramos (g)' }, { value: 'kilogramo', label: 'Kilogramos (kg)' }],
    'kilogramo': [{ value: 'gramo', label: 'Gramos (g)' }, { value: 'kilogramo', label: 'Kilogramos (kg)' }],
    'mililitro': [{ value: 'mililitro', label: 'Mililitros (ml)' }, { value: 'litro', label: 'Litros (L)' }],
    'litro': [{ value: 'mililitro', label: 'Mililitros (ml)' }, { value: 'litro', label: 'Litros (L)' }],
    'unidad': [{ value: 'unidad', label: 'Unidades' }],
    'porción': [{ value: 'porción', label: 'Porciones' }],
};

function calcularCostoUnitarioDesdeCompra(precioTotal, contenido, unidadCompra, unidadBase) {
    if (!precioTotal || !contenido || contenido <= 0 || precioTotal <= 0) return { costoUnitario: 0, cantidadBase: 0, error: null };
    const compatibles = COMPATIBLE_UNITS[unidadBase] || [unidadBase];
    if (!compatibles.includes(unidadCompra)) {
        return { costoUnitario: 0, cantidadBase: 0, error: `Unidad incompatible: ${unidadCompra} → ${unidadBase}` };
    }
    let cantidadBase = contenido;
    const conv = UNIT_CONVERSIONS[unidadCompra];
    if (conv && conv.to === unidadBase) {
        cantidadBase = contenido * conv.factor;
    }
    // If purchase unit IS the base unit, no conversion needed
    // If purchase unit converts TO base unit, conversion already applied above
    // If base unit converts TO purchase unit (e.g. base=kilogramo, compra=gramo) → divide
    const convReverse = UNIT_CONVERSIONS[unidadBase];
    if (convReverse && convReverse.to === unidadCompra) {
        cantidadBase = contenido / convReverse.factor;
    }
    return { costoUnitario: precioTotal / cantidadBase, cantidadBase, error: null };
}

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
    const [editingRecetaInline, setEditingRecetaInline] = useState(null); // id
    const [inlineRecetaQty, setInlineRecetaQty] = useState('');
    const [inlineRecetaSaving, setInlineRecetaSaving] = useState(false);
    const [insumoSaving, setInsumoSaving] = useState(false);
    const [recetaSaving, setRecetaSaving] = useState(false);
    const [showAjusteModal, setShowAjusteModal] = useState(null); // insumo object
    // tipo es el valor de la UI: ENTRADA | AJUSTE_MAS | AJUSTE_MENOS | MERMA.
    // Se traduce a (tipo, signo) al enviar, porque la RPC recibe un delta con signo.
    const [ajusteForm, setAjusteForm] = useState({ tipo: 'AJUSTE_MAS', cantidad: 0, motivo: '', idemKey: null });
    const [showCargaMasivaModal, setShowCargaMasivaModal] = useState(false);
    const [cargaMasivaForm, setCargaMasivaForm] = useState({});
    const [cargaMasivaMotivo, setCargaMasivaMotivo] = useState('Toma Física / Carga de Stock Inicial');
    const [cargaMasivaSaving, setCargaMasivaSaving] = useState(false);

    // Merma directa (trabajador y admin)
    const [showMermaModal, setShowMermaModal] = useState(null); // insumo object
    const [mermaForm, setMermaForm] = useState({ cantidad: '', motivo: '', advertencia: false });
    const [mermaSaving, setMermaSaving] = useState(false);

    // Caja operations — Saldo Inicial, Movimiento Manual, Resolver Diferencia
    const [showSaldoInicialModal, setShowSaldoInicialModal] = useState(false);
    const [saldoInicialForm, setSaldoInicialForm] = useState({ efectivo: 0, nequi: 0, bancolombia: 0 });
    const [showMovManualModal, setShowMovManualModal] = useState(null); // 'INGRESO_MANUAL' | 'RETIRO' | null
    const [movManualForm, setMovManualForm] = useState({ monto: 0, metodo_pago: 'EFECTIVO', descripcion: '' });
    const [showResolverDifModal, setShowResolverDifModal] = useState(null); // sesion object
    const [resolverDifForm, setResolverDifForm] = useState({ metodo_pago: 'EFECTIVO', monto: 0, tipo: 'FALTANTE', motivo: '' });
    const [saldoGlobal, setSaldoGlobal] = useState({ efectivo: 0, nequi: 0, bancolombia: 0 });

    // Inventario UX — búsqueda, filtros, detalle
    const [insumoSearch, setInsumoSearch] = useState('');
    const [insumoFilter, setInsumoFilter] = useState('todos'); // 'todos' | 'bajos' | 'agotados'
    const [showInsumoDetalle, setShowInsumoDetalle] = useState(null); // insumo object
    const [insumoDetalleMovs, setInsumoDetalleMovs] = useState([]);
    const [insumoDetalleLoading, setInsumoDetalleLoading] = useState(false);

    // Fase 2 Bloque 7: Inventario sub-tabs
    const [inventarioSubTab, setInventarioSubTab] = useState('insumos'); // 'insumos' | 'recetas'

    // Compras / Proveedores states
    const [proveedoresList, setProveedoresList] = useState([]);
    const [comprasList, setComprasList] = useState([]);
    const [comprasLoading, setComprasLoading] = useState(false);
    const [mermasList, setMermasList] = useState([]);
    const [mermasLoading, setMermasLoading] = useState(false);
    const [editingProveedor, setEditingProveedor] = useState(null); // null, 'new', or id
    const [proveedorForm, setProveedorForm] = useState({ nombre: '', telefono: '', contacto: '', activo: true });
    const [editingCompra, setEditingCompra] = useState(null); // null or 'new'
    const [compraForm, setCompraForm] = useState({ proveedor_id: '', observaciones: '', details: [], metodo_pago: 'EFECTIVO' });
    const [selectedDetail, setSelectedDetail] = useState({ insumo_id: '', precio_total_pagado: '', contenido_comprado: '', unidad_compra: '', cantidad: 0, costo_unitario: 0 });
    const [compraInsumoSearch, setCompraInsumoSearch] = useState(''); // P0: búsqueda de insumo en compras
    const [showAnularModal, setShowAnularModal] = useState(null); // compra object
    const [anularMotivo, setAnularMotivo] = useState('');
    // F6-05: modal de recepción con selector de método de pago
    const [showRecibirModal, setShowRecibirModal] = useState(null); // compra object or null
    const [recibirMetodoPago, setRecibirMetodoPago] = useState('EFECTIVO');
    const [topStampClients, setTopStampClients] = useState([]);

    // Liquidaciones & Rentabilidad states
    const [liquidacionesList, setLiquidacionesList] = useState([]);
    // A1: el Estado de Resultados ahora lo calcula el servidor en un solo
    // periodo coherente (RPC fn_estado_resultados). Antes se armaba en el
    // cliente mezclando ventas del periodo con COGS, nomina y gastos de toda
    // la historia, y costos fijos normalizados a mes.
    // Turnos: asistencia explicita y fuente oficial de la nomina.
    // NO se deriva de sesiones_caja (decision del dueno).
    const [turnosData, setTurnosData] = useState(null);
    const [turnosLoading, setTurnosLoading] = useState(false);
    const [turnosError, setTurnosError] = useState(null);
    const [turnoSubmitting, setTurnoSubmitting] = useState(false);
    const [showTarifaModal, setShowTarifaModal] = useState(null); // perfil
    const [tarifaForm, setTarifaForm] = useState(0);

    const [pnl, setPnl] = useState(null);
    const [pnlLoading, setPnlLoading] = useState(false);
    const [pnlError, setPnlError] = useState(null);
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
    const [ventasPage, setVentasPage] = useState(0);
    const [ventasPageData, setVentasPageData] = useState([]);
    const [ventasTotal, setVentasTotal] = useState(0);
    const [ventasLoading, setVentasLoading] = useState(false);
    const [ventasError, setVentasError] = useState(null);

    // Caja — estado paginado independiente (movementsList sigue siendo global para KPIs)
    const [movementsPage, setMovementsPage] = useState(0);
    const [movementsPageData, setMovementsPageData] = useState([]);
    const [movementsTotal, setMovementsTotal] = useState(0);
    const [movementsLoading, setMovementsLoading] = useState(false);
    const [movementsError, setMovementsError] = useState(null);

    // Fase 2 Bloque 3: Caja date filter + search
    const [cajaDateFilter, setCajaDateFilter] = useState('7d'); // 'today' | '7d' | '30d' | 'all'
    const [cajaSearch, setCajaSearch] = useState('');
    const [expandedMovementId, setExpandedMovementId] = useState(null);
    const [expandedMovementSale, setExpandedMovementSale] = useState(null);
    const [expandedMovementLoading, setExpandedMovementLoading] = useState(false);

    // Liquidaciones — estado paginado independiente (liquidacionesList sigue siendo global para KPIs)
    const [liqPage, setLiqPage] = useState(0);
    const [liqPageData, setLiqPageData] = useState([]);
    const [liqTotal, setLiqTotal] = useState(0);
    const [liqLoading, setLiqLoading] = useState(false);
    const [liqError, setLiqError] = useState(null);

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

    // Sale cancellation workflow states
    const [anulacionesList, setAnulacionesList] = useState([]);
    const [showAnulacionesPanel, setShowAnulacionesPanel] = useState(false);
    const [showSolicitarAnulacionModal, setShowSolicitarAnulacionModal] = useState(null); // venta object or null
    const [anulacionMotivo, setAnulacionMotivo] = useState('');

    // Costos Fijos/Variables states
    const [costosList, setCostosList] = useState([]);
    const [showCostoModal, setShowCostoModal] = useState(false);
    const [costoForm, setCostoForm] = useState({ nombre: '', descripcion: '', tipo_costo: 'FIJO', categoria: 'OTROS', monto: '', periodicidad: 'MENSUAL' });
    const [editingCosto, setEditingCosto] = useState(null);
    // ─────────────────────────────────────────────────────────────────────────

    // B9: Expandable sale detail rows
    const [expandedSaleId, setExpandedSaleId] = useState(null);
    const [expandedSaleClients, setExpandedSaleClients] = useState([]); // multi-client names from stamp_logs

    // B12: Internal transfer between payment methods
    const [showTransferModal, setShowTransferModal] = useState(false);
    const [transferForm, setTransferForm] = useState({
        origen: 'EFECTIVO',
        destino: 'NEQUI',
        monto: 0,
        observaciones: ''
    });
    const [transferIdempotencyKey, setTransferIdempotencyKey] = useState(crypto.randomUUID());

    useEffect(() => {
        setTransferIdempotencyKey(crypto.randomUUID());
    }, [transferForm.origen, transferForm.destino, transferForm.monto]);

    // B2: Expandable caja accounts
    const [expandedCajaAccount, setExpandedCajaAccount] = useState(null); // null | 'EFECTIVO' | 'NEQUI' | 'BANCOLOMBIA'

    // Fase 2: Alert badge counts (computed from loaded data)
    const pendingAnulacionesCount = anulacionesList.filter(a => a.estado === 'PENDIENTE').length;
    const arqueosConDiferencia = sessionsList.filter(s => s.estado === 'CERRADA' && Math.abs(Number(s.diferencia || 0)) > 0).length;
    const alertBadges = {
        ventas: pendingAnulacionesCount,
        caja: arqueosConDiferencia,
    };
    // ─────────────────────────────────────────────────────────────────────────

    const fetchDashboardData = async () => {
        try {
            // Step 1: Get user profile (needed for role-based logic)
            const { data: { session } } = await supabase.auth.getSession();
            if (session?.user) {
                const { data: profile } = await supabase
                    .from('perfiles_trabajadores')
                    .select('*')
                    .eq('id', session.user.id)
                    .single();
                setCurrentUserProfile(profile);
            }

            const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

            // Step 2: Run ALL independent queries in parallel
            const [
                clientsCountRes,
                allClientsRes,
                redemptionsCountRes,
                recentRes,
                topClientsRes,
                stampLogsRes,
                redemptionLogsRes,
                salesRes,
                movementsRes,
                staffRes,
                liqsRes,
                expensesRes,
                anulacionesRes,
                costosRes
            ] = await Promise.all([
                // 1. Total Clients count
                supabase.from('clientes').select('*', { count: 'exact', head: true }),
                // 2. All clients stamps
                supabase.from('clientes').select('stamps_count'),
                // 3. Total Redemptions
                supabase.from('redemptions').select('*', { count: 'exact', head: true }),
                // 4. Recent Clients
                supabase.from('clientes').select('*').order('created_at', { ascending: false }).limit(10),
                // 4b. Top Stamp Clients
                supabase.from('clientes').select('id, nombre, celular, stamps_count').order('stamps_count', { ascending: false }).limit(10),
                // 5. Stamp logs (30 days)
                supabase.from('stamp_logs').select('created_at, clientes(nombre)').gte('created_at', thirtyDaysAgo).order('created_at', { ascending: true }),
                // 5b. Redemption logs (30 days)
                supabase.from('redemptions').select('redeemed_at, clientes(nombre)').gte('redeemed_at', thirtyDaysAgo).order('redeemed_at', { ascending: true }),
                // 6. Sales (global for KPIs)
                supabase.from('ventas').select('*, perfiles_trabajadores(nombre), clientes(nombre)').order('fecha', { ascending: false }),
                // 7. Cash Movements (global for KPIs)
                supabase.from('movimientos_caja').select('*, perfiles_trabajadores(nombre), venta_id').order('fecha', { ascending: false }),
                // 8. Staff list
                supabase.from('perfiles_trabajadores').select('*').order('created_at', { ascending: false }),
                // 9. Liquidaciones
                supabase.from('liquidaciones').select('*, perfiles_trabajadores(nombre, email, rol, modalidad_pago, tarifa_pago)').order('fecha', { ascending: false }),
                // 11. Gastos
                supabase.from('gastos').select('*, categorias_gastos(nombre)').order('fecha', { ascending: false }),
                // 12. Anulaciones
                supabase.from('solicitudes_anulacion_venta').select('*, ventas(total, fecha, metodo_pago), solicitante:perfiles_trabajadores!solicitudes_anulacion_venta_solicitante_id_fkey(nombre), aprobador1:perfiles_trabajadores!solicitudes_anulacion_venta_aprobador_1_id_fkey(nombre), aprobador2:perfiles_trabajadores!solicitudes_anulacion_venta_aprobador_2_id_fkey(nombre)').order('created_at', { ascending: false }),
                // 13. Costos configuracion
                supabase.from('costos_configuracion').select('*').order('tipo_costo', { ascending: true })
            ]);

            // Step 3: Process results
            const allClients = allClientsRes.data;
            const totalStamps = allClients?.reduce((acc, curr) => acc + (curr.stamps_count || 0), 0) || 0;
            const pendingRewards = allClients?.filter(c => c.stamps_count >= 10).length || 0;

            setStats({
                totalClients: clientsCountRes.count || 0,
                totalStamps,
                pendingRewards,
                totalRedemptions: redemptionsCountRes.count || 0
            });

            setRecentClients(recentRes.data || []);
            setTopStampClients(topClientsRes.data || []);

            const dailyData = processChartData(stampLogsRes.data || [], redemptionLogsRes.data || []);
            setChartData(dailyData);

            setSalesList(salesRes.data || []);
            setMovementsList(movementsRes.data || []);
            setStaffList(staffRes.data || []);
            setLiquidacionesList(liqsRes.data || []);
            setGastosList(expensesRes.data || []);

            setAnulacionesList(anulacionesRes.data || []);
            setCostosList(costosRes.data || []);

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
                .select('id, fecha, total, metodo_pago, estado, detalles, perfiles_trabajadores(nombre), clientes(nombre)', { count: 'exact' })
                .order('fecha', { ascending: false })
                .range(from, to);
            if (error) throw error;
            
            // Reconstruct missing financial fields from the detalles JSONB for UI rendering
            const processedData = (data || []).map(sale => ({
                ...sale,
                subtotal: Number(sale.detalles?.subtotal ?? sale.total),
                descuento: Number(sale.detalles?.discount ?? 0)
            }));
            
            setVentasPageData(processedData);
            setVentasTotal(count || 0);
            setVentasPage(page);
        } catch (err) {
            setVentasError(err.message || 'Error al cargar ventas.');
        } finally {
            setVentasLoading(false);
        }
    };

    const fetchMovementsPage = async (page = 0, dateFilter = cajaDateFilter) => {
        setMovementsLoading(true);
        setMovementsError(null);
        try {
            const from = page * PAGE_SIZE;
            const to = from + PAGE_SIZE - 1;
            let query = supabase
                .from('movimientos_caja')
                .select('id, fecha, tipo, tipo_operacion, metodo_pago, descripcion, monto, venta_id, compra_id, gasto_id, liquidacion_id, perfiles_trabajadores(nombre)', { count: 'exact' })
                .order('fecha', { ascending: false });

            // Apply date filter
            const now = new Date();
            if (dateFilter === 'yesterday') {
                const yesterday = new Date(now);
                yesterday.setDate(yesterday.getDate() - 1);
                const startOfYesterday = new Date(yesterday.getFullYear(), yesterday.getMonth(), yesterday.getDate()).toISOString();
                const endOfYesterday = new Date(yesterday.getFullYear(), yesterday.getMonth(), yesterday.getDate() + 1).toISOString();
                query = query.gte('fecha', startOfYesterday).lt('fecha', endOfYesterday);
            } else if (dateFilter === 'today') {
                const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
                query = query.gte('fecha', startOfDay);
            } else if (dateFilter === '7d') {
                query = query.gte('fecha', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString());
            } else if (dateFilter === '30d') {
                query = query.gte('fecha', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString());
            }
            // 'all' = no date filter

            query = query.range(from, to);
            const { data, count, error } = await query;
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

    // Fase 2 Bloque 2: Lazy-load sale detail for a movement
    // Fase 3: Enhanced to fetch multi-client stamp_logs + mixed payment breakdown + subtotal/descuento from JSONB
    const loadMovementSaleDetail = async (moveId, ventaId) => {
        if (expandedMovementId === moveId) {
            setExpandedMovementId(null);
            setExpandedMovementSale(null);
            return;
        }
        setExpandedMovementId(moveId);
        if (!ventaId) {
            setExpandedMovementSale(null);
            return;
        }
        setExpandedMovementLoading(true);
        try {
            // Fetch venta + multi-client stamps + mixed payment movements in parallel
            const [ventaRes, stampsRes, mixedMovRes] = await Promise.all([
                supabase
                    .from('ventas')
                    .select('id, fecha, total, metodo_pago, estado, detalles, clientes(nombre, celular), perfiles_trabajadores(nombre)')
                    .eq('id', ventaId)
                    .single(),
                supabase
                    .from('stamp_logs')
                    .select('client_id, clientes(nombre, celular)')
                    .eq('venta_id', ventaId)
                    .eq('tipo', 'VENTA')
                    .eq('estado', 'ACTIVO'),
                supabase
                    .from('movimientos_caja')
                    .select('metodo_pago, monto')
                    .eq('venta_id', ventaId)
            ]);

            if (!ventaRes.error && ventaRes.data) {
                const sale = ventaRes.data;
                // Read subtotal/descuento from JSONB detalles
                sale._subtotal = Number(sale.detalles?.subtotal ?? sale.total);
                sale._descuento = Number(sale.detalles?.discount ?? 0);
                // Attach multi-client list from stamp_logs
                sale._allClients = stampsRes.data?.map(s => s.clientes?.nombre).filter(Boolean) || [];
                // Attach mixed payment breakdown
                sale._paymentBreakdown = mixedMovRes.data || [];
                setExpandedMovementSale(sale);
            } else {
                setExpandedMovementSale(null);
            }
        } catch {
            setExpandedMovementSale(null);
        } finally {
            setExpandedMovementLoading(false);
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
        fetchSaldoGlobal();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    useEffect(() => {
        fetchDashboardMetrics();
        fetchEstadoResultados();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [dateRange, customStartDate, customEndDate]);

    useEffect(() => {
        if (activeTab === 'productos') {
            fetchProductos();
        } else if (activeTab === 'inventario') {
            fetchInventario();
            fetchProductos();
            fetchProveedores();
            fetchCompras();
            fetchMermas();
        } else if (activeTab === 'ventas') {
            fetchVentas(0); // Fase 6.3 — carga página 0 al entrar al tab
        } else if (activeTab === 'caja') {
            fetchMovementsPage(0); // Fase 6.3 — carga página 0 al entrar al tab
        } else if (activeTab === 'liquidaciones') {
            fetchLiqPage(0); // Fase 6.3 — carga página 0 al entrar al tab
            fetchTurnos();
        } else if (activeTab === 'gastos') {
            fetchCategoriasGastos();
            fetchGastosPage(0);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
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
        if (!window.confirm(`¿Confirmar cambio de rol de ${staffMember.nombre} de ${staffMember.rol} a ${newRole}?`)) return;

        setActionLoading(true);
        try {
            const { error } = await supabase
                .from('perfiles_trabajadores')
                .update({ rol: newRole, updated_at: new Date().toISOString() })
                .eq('id', staffMember.id);

            if (error) throw error;

            // Update local staffList immediately instead of full dashboard reload
            setStaffList(prev => prev.map(s =>
                s.id === staffMember.id ? { ...s, rol: newRole, updated_at: new Date().toISOString() } : s
            ));

            alert(`✅ Rol de ${staffMember.nombre} actualizado: ${staffMember.rol} → ${newRole}`);
        } catch (err) {
            console.error(err);
            alert('Error al actualizar el perfil.');
        } finally {
            setActionLoading(false);
        }
    };

    // B12: Transferencia interna entre métodos de pago
    const handleTransferInterna = async () => {
        const { origen, destino, monto, observaciones } = transferForm;
        if (origen === destino) {
            alert('El método de origen y destino no pueden ser iguales.');
            return;
        }
        if (!monto || monto <= 0) {
            alert('El monto debe ser mayor a 0.');
            return;
        }

        setActionLoading(true);
        try {
            // Se utiliza transferIdempotencyKey del estado para conservar el mismo UUID ante reintentos
            const { data, error } = await supabase.rpc('realizar_transferencia_interna', {
                p_origen: origen,
                p_destino: destino,
                p_monto: monto,
                p_observaciones: observaciones,
                p_idempotency_key: transferIdempotencyKey
            });

            if (error) throw error;
            if (data && !data.success) throw new Error(data.message);

            alert(`✅ Transferencia registrada: $${monto.toLocaleString()} de ${origen} a ${destino}`);
            setShowTransferModal(false);
            setTransferForm({ origen: 'EFECTIVO', destino: 'NEQUI', monto: 0, observaciones: '' });
            setTransferIdempotencyKey(crypto.randomUUID()); // Explicit reset on absolute success
            // Refresh movements
            await fetchDashboardData();
        } catch (err) {
            console.error(err);
            alert('Error al registrar transferencia: ' + err.message);
        } finally {
            setActionLoading(false);
        }
    };

    // Caja: Registrar saldo inicial
    const handleSaldoInicial = async () => {
        setActionLoading(true);
        try {
            const { data, error } = await supabase.rpc('registrar_saldo_inicial', {
                p_efectivo: Number(saldoInicialForm.efectivo),
                p_nequi: Number(saldoInicialForm.nequi),
                p_bancolombia: Number(saldoInicialForm.bancolombia)
            });
            if (error) throw error;
            if (data && !data.success) throw new Error(data.message);
            alert('\u2705 Saldo inicial registrado exitosamente');
            setShowSaldoInicialModal(false);
            setSaldoInicialForm({ efectivo: 0, nequi: 0, bancolombia: 0 });
            await fetchDashboardData();
            await fetchSaldoGlobal();
        } catch (err) {
            console.error(err);
            alert('Error: ' + err.message);
        } finally {
            setActionLoading(false);
        }
    };

    // Caja: Movimiento manual (ingreso/retiro)
    const handleMovManual = async () => {
        const tipoOp = showMovManualModal;
        const tipo = tipoOp === 'INGRESO_MANUAL' ? 'INGRESO' : 'EGRESO';
        setActionLoading(true);
        try {
            const { data, error } = await supabase.rpc('registrar_movimiento_manual', {
                p_tipo: tipo,
                p_monto: Number(movManualForm.monto),
                p_metodo_pago: movManualForm.metodo_pago,
                p_descripcion: movManualForm.descripcion,
                p_tipo_operacion: tipoOp
            });
            if (error) throw error;
            if (data && !data.success) throw new Error(data.message);
            alert(`\u2705 ${tipoOp === 'INGRESO_MANUAL' ? 'Ingreso' : 'Retiro'} registrado exitosamente`);
            setShowMovManualModal(null);
            setMovManualForm({ monto: 0, metodo_pago: 'EFECTIVO', descripcion: '' });
            await fetchDashboardData();
            await fetchSaldoGlobal();
        } catch (err) {
            console.error(err);
            alert('Error: ' + err.message);
        } finally {
            setActionLoading(false);
        }
    };

    // Caja: Resolver diferencia
    const handleResolverDiferencia = async () => {
        if (!showResolverDifModal) return;
        setActionLoading(true);
        try {
            const { data, error } = await supabase.rpc('resolver_diferencia_caja', {
                p_sesion_id: showResolverDifModal.id,
                p_metodo_pago: resolverDifForm.metodo_pago,
                p_monto: Number(resolverDifForm.monto),
                p_tipo: resolverDifForm.tipo,
                p_motivo: resolverDifForm.motivo
            });
            if (error) throw error;
            if (data && !data.success) throw new Error(data.message);
            alert('\u2705 Diferencia resuelta y registrada');
            setShowResolverDifModal(null);
            setResolverDifForm({ metodo_pago: 'EFECTIVO', monto: 0, tipo: 'FALTANTE', motivo: '' });
            await fetchDashboardData();
            await fetchSaldoGlobal();
        } catch (err) {
            console.error(err);
            alert('Error: ' + err.message);
        } finally {
            setActionLoading(false);
        }
    };

    // Caja: Fetch saldo global (sin filtro de fecha)
    const fetchSaldoGlobal = async () => {
        try {
            const { data, error } = await supabase.rpc('calcular_saldo_global');
            if (error) throw error;
            if (data && data.success) {
                setSaldoGlobal({
                    efectivo: Number(data.efectivo || 0),
                    nequi: Number(data.nequi || 0),
                    bancolombia: Number(data.bancolombia || 0)
                });
            }
        } catch (err) {
            console.error('Error fetching saldo global:', err);
        }
    };

    const handleLogout = async () => {
        // B3: antes solo limpiaba sessionStorage, dejando el token de Supabase
        // vivo en localStorage. La siguiente persona en el dispositivo entraba
        // a /admin y seguia dentro. Ahora se cierra la sesion de verdad.
        try {
            await supabase.auth.signOut();
        } catch (err) {
            console.error('Error cerrando sesion:', err);
        }
        sessionStorage.clear();
        navigate('/login');
    };

    // ---- Dashboard Reports helpers ----

    const CHART_COLORS = ['#ff4500', '#d4af37', '#fbbf24', '#f59e0b', '#10b981', '#3b82f6', '#8b5cf6', '#ec4899'];
    const PAYMENT_METHOD_COLORS = {
        'NEQUI': '#9333ea',
        'BANCOLOMBIA': '#fbbf24',
        'EFECTIVO': '#10b981',
        'MIXTO': '#f97316'
    };

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

    // A1: una sola fuente de verdad para el Estado de Resultados. Todos los
    // rubros salen del MISMO rango de fechas, calculados en SQL.
    // "Hoy" en hora de Bogota. La jornada de 4pm a 9pm cruza la medianoche en
    // UTC (21:00Z a 02:00Z), asi que usar la fecha UTC mandaria las ultimas dos
    // horas de cada jornada al dia siguiente.
    const hoyBogota = () => {
        const f = new Intl.DateTimeFormat('en-CA', {
            timeZone: 'America/Bogota', year: 'numeric', month: '2-digit', day: '2-digit'
        });
        return f.format(new Date()); // YYYY-MM-DD
    };

    const fetchTurnos = async () => {
        setTurnosLoading(true);
        setTurnosError(null);
        try {
            const hasta = hoyBogota();
            const desde = new Date(new Date(hasta + 'T12:00:00Z').getTime() - 29 * 86400000)
                .toISOString().slice(0, 10);
            const { data, error } = await supabase.rpc('fn_turnos_periodo', { p_desde: desde, p_hasta: hasta });
            if (error) throw error;
            if (data && !data.success) throw new Error(data.message);
            setTurnosData(data);
        } catch (err) {
            console.error('Error cargando turnos:', err);
            setTurnosError(err.message || 'No se pudieron cargar los turnos.');
            setTurnosData(null);
        } finally {
            setTurnosLoading(false);
        }
    };

    const handleCerrarYPagarTurno = async (trabajador, cuenta = 'EFECTIVO') => {
        const hoy = hoyBogota();
        if (!window.confirm(
            `¿Cerrar el turno de ${trabajador.nombre} del ${hoy} y pagarle $${Number(trabajador.tarifa_pago || 0).toLocaleString()} en ${cuenta}?`
        )) return;

        setTurnoSubmitting(true);
        try {
            const { data, error } = await supabase.rpc('cerrar_y_pagar_turno', {
                p_trabajador_id: trabajador.id,
                p_fecha: hoy,
                p_cuenta_origen: cuenta
            });
            if (error) throw error;
            if (!data?.success) throw new Error(data?.message || 'No se pudo cerrar el turno.');

            alert(data.message);
            await fetchTurnos();
            await fetchLiqPage(liqPage);
            await fetchEstadoResultados();
            await fetchSaldoGlobal();
        } catch (err) {
            alert('Error: ' + err.message);
        } finally {
            setTurnoSubmitting(false);
        }
    };

    const handleAnularTurno = async (turno) => {
        const motivo = window.prompt(`Motivo para anular el turno del ${turno.fecha}:`);
        if (motivo === null) return;

        setTurnoSubmitting(true);
        try {
            const { data, error } = await supabase.rpc('anular_turno', {
                p_turno_id: turno.id, p_motivo: motivo || 'Sin motivo'
            });
            if (error) throw error;
            if (!data?.success) throw new Error(data?.message || 'No se pudo anular el turno.');
            alert(data.message);
            await fetchTurnos();
        } catch (err) {
            alert('Error: ' + err.message);
        } finally {
            setTurnoSubmitting(false);
        }
    };

    const handleGuardarTarifa = async () => {
        if (!showTarifaModal) return;
        setTurnoSubmitting(true);
        try {
            const { data, error } = await supabase.rpc('actualizar_tarifa_trabajador', {
                p_trabajador_id: showTarifaModal.id,
                p_tarifa: Number(tarifaForm)
            });
            if (error) throw error;
            if (!data?.success) throw new Error(data?.message || 'No se pudo actualizar la tarifa.');
            alert(data.message);
            setShowTarifaModal(null);
            await fetchDashboardData();
        } catch (err) {
            alert('Error: ' + err.message);
        } finally {
            setTurnoSubmitting(false);
        }
    };

    const fetchEstadoResultados = async () => {
        setPnlLoading(true);
        setPnlError(null);
        try {
            const { start, end } = getDateRange();
            const { data, error } = await supabase.rpc('fn_estado_resultados', {
                p_desde: start,
                p_hasta: end
            });
            if (error) throw error;
            if (data && !data.success) throw new Error(data.message);
            setPnl(data);
        } catch (err) {
            // A4: un fallo de consulta NO debe convertirse en ceros contables.
            // Se muestra el error en vez de un informe plausible pero falso.
            console.error('Error cargando estado de resultados:', err);
            setPnlError(err.message || 'No se pudo calcular el estado de resultados.');
            setPnl(null);
        } finally {
            setPnlLoading(false);
        }
    };

    const fetchDashboardMetrics = async () => {
        setMetricsLoading(true);
        const { start, end } = getDateRange();

        try {
            const results = await Promise.allSettled([
                supabase.from('ventas')
                    .select('*, perfiles_trabajadores(nombre), clientes(nombre)')
                    .neq('estado', 'ANULADA')
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
            const allInsumos = getResData(results[1]);
            const insumos = allInsumos.filter(i => i.activo);
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
            const totalIngresos = movimientos.filter(m => m.tipo === 'INGRESO' && m.tipo_operacion !== 'TRANSFERENCIA_INTERNA').reduce((sum, m) => sum + Number(m.monto || 0), 0);
            const totalEgresos = movimientos.filter(m => m.tipo === 'EGRESO' && m.tipo_operacion !== 'TRANSFERENCIA_INTERNA').reduce((sum, m) => sum + Number(m.monto || 0), 0);
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
                .select('*, productos(nombre, precio), insumos(nombre, unidad_medida, costo_unitario)');
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
            // stock_actual va SOLO al crear. Antes tambien iba en el UPDATE, asi
            // que editar el nombre o el costo de un insumo sobrescribia su stock
            // con el valor que tuviera cargado el formulario, SIN dejar ningun
            // registro en movimientos_inventario. Era el peor de los dos caminos
            // de escritura directa: cero trazabilidad.
            // Para cambiar el stock existe el modal de movimiento, que pasa por
            // la RPC atomica ajustar_stock_insumo.
            const base = {
                nombre: insumoForm.nombre,
                unidad_medida: insumoForm.unidad_medida,
                stock_minimo: Number(insumoForm.stock_minimo) || 0,
                costo_unitario: Number(insumoForm.costo_unitario) || 0,
                activo: insumoForm.activo,
                updated_at: new Date().toISOString()
            };

            let error;
            if (editingInsumo === 'new') {
                ({ error } = await supabase.from('insumos').insert([{
                    ...base,
                    stock_actual: Number(insumoForm.stock_actual) || 0
                }]));
            } else {
                ({ error } = await supabase.from('insumos').update(base).eq('id', editingInsumo));
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

    // Traduce la opcion de la UI al par (tipo, signo) que espera la RPC.
    // La RPC recibe un DELTA CON SIGNO y valida la coherencia: una ENTRADA no
    // puede ser negativa y una MERMA no puede aumentar el stock.
    const MOVIMIENTO_UI = {
        ENTRADA:      { tipo: 'ENTRADA', signo:  1, etiqueta: 'Entrada (Compra / Carga)' },
        AJUSTE_MAS:   { tipo: 'AJUSTE',  signo:  1, etiqueta: 'Ajuste (Corrección +)' },
        AJUSTE_MENOS: { tipo: 'AJUSTE',  signo: -1, etiqueta: 'Ajuste (Corrección −)' },
        MERMA:        { tipo: 'MERMA',   signo: -1, etiqueta: 'Merma (Desecho / Pérdida −)' },
    };

    const handleAjustarStock = async () => {
        if (!showAjusteModal || !Number(ajusteForm.cantidad)) {
            alert('Ingrese una cantidad válida.');
            return;
        }
        const mov = MOVIMIENTO_UI[ajusteForm.tipo] || MOVIMIENTO_UI.AJUSTE_MAS;

        setInsumoSaving(true);
        try {
            // Antes esto hacia DOS viajes: UPDATE insumos y luego INSERT del
            // movimiento. Si el segundo fallaba, el stock cambiaba SIN RASTRO.
            // Y calculaba el stock absoluto desde el valor cacheado en el
            // navegador, asi que una venta del POS ocurrida en el medio se
            // PISABA. Demostrado en pruebas: con stock 2656, una venta de 5 y
            // un ajuste de +10, el codigo viejo escribia 2666 en vez de 2661,
            // creando 5 unidades fantasma.
            //
            // Ahora una sola RPC atomica que bloquea la fila y aplica un DELTA
            // sobre el valor real de la base. La clave de idempotencia protege
            // del doble clic.
            const { data, error } = await supabase.rpc('ajustar_stock_insumo', {
                p_insumo_id: showAjusteModal.id,
                p_tipo: mov.tipo,
                p_cantidad: Number(ajusteForm.cantidad) * mov.signo,
                p_motivo: ajusteForm.motivo || null,
                p_idempotency_key: ajusteForm.idemKey || crypto.randomUUID()
            });

            if (error) throw error;
            if (!data?.success) throw new Error(data?.message || 'No se pudo ajustar el inventario.');

            alert(data.message);
            setShowAjusteModal(null);
            setAjusteForm({ tipo: 'AJUSTE_MAS', cantidad: 0, motivo: '', idemKey: crypto.randomUUID() });
            await fetchInventario();
        } catch (err) {
            console.error(err);
            alert('Error al ajustar el inventario: ' + err.message);
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

        // Motivo obligatorio
        if (!mermaForm.motivo.trim()) {
            alert('El motivo de la merma es obligatorio.');
            return;
        }

        setMermaSaving(true);
        try {
            const { data, error } = await supabase.rpc('registrar_merma_trabajador', {
                p_insumo_id: insumo.id,
                p_cantidad: cantidad,
                p_motivo: mermaForm.motivo.trim(),
            });
            if (error) throw error;
            if (data && !data.success) throw new Error(data.message);
            setShowMermaModal(null);
            setMermaForm({ cantidad: '', motivo: '', advertencia: false });
            await fetchInventario();
            await fetchMermas();
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

    const handleUpdateRecetaQty = async (id) => {
        const qty = Number(inlineRecetaQty);
        if (!qty || qty <= 0) {
            alert('La cantidad debe ser mayor a 0');
            return;
        }
        setInlineRecetaSaving(true);
        try {
            const { error } = await supabase.from('producto_insumos').update({ cantidad_por_unidad: qty }).eq('id', id);
            if (error) throw error;
            setEditingRecetaInline(null);
            await fetchInventario();
        } catch (err) {
            console.error(err);
            alert('Error al actualizar la cantidad: ' + err.message);
        } finally {
            setInlineRecetaSaving(false);
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

    const fetchMermas = async () => {
        setMermasLoading(true);
        try {
            const { data, error } = await supabase
                .from('movimientos_inventario')
                .select('*, insumos(nombre, unidad_medida)')
                .eq('tipo', 'MERMA')
                .order('created_at', { ascending: false })
                .limit(50);
            if (!error && data) setMermasList(data);
        } catch (err) {
            console.error(err);
        } finally {
            setMermasLoading(false);
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
        if (!selectedDetail.insumo_id) {
            alert('Seleccione un insumo.');
            return;
        }
        const insumoObj = insumosList.find(i => i.id === selectedDetail.insumo_id);
        if (!insumoObj) { alert('Insumo no encontrado.'); return; }

        const precioTotal = Number(selectedDetail.precio_total_pagado);
        const contenido = Number(selectedDetail.contenido_comprado);
        const unidadCompra = selectedDetail.unidad_compra || insumoObj.unidad_medida;
        const unidadBase = insumoObj.unidad_medida;

        if (!precioTotal || precioTotal <= 0) { alert('Ingrese un precio total válido mayor a 0.'); return; }
        if (!contenido || contenido <= 0) { alert('Ingrese un contenido comprado válido mayor a 0.'); return; }

        const { costoUnitario, cantidadBase, error } = calcularCostoUnitarioDesdeCompra(precioTotal, contenido, unidadCompra, unidadBase);
        if (error) { alert(error); return; }

        const subtotal = precioTotal; // subtotal = precio total pagado por este ítem

        setCompraForm(p => ({
            ...p,
            details: [
                ...p.details,
                {
                    insumo_id: selectedDetail.insumo_id,
                    nombre: insumoObj.nombre,
                    cantidad: cantidadBase, // cantidad en unidad base del insumo
                    costo_unitario: costoUnitario,
                    subtotal,
                    // Campos nuevos para trazabilidad
                    precio_total_pagado: precioTotal,
                    contenido_comprado: contenido,
                    unidad_compra: unidadCompra,
                    unidad_base: unidadBase
                }
            ]
        }));
        setSelectedDetail({ insumo_id: '', precio_total_pagado: '', contenido_comprado: '', unidad_compra: '', cantidad: 0, costo_unitario: 0 });
        setCompraInsumoSearch('');
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
                subtotal: item.subtotal,
                precio_total_pagado: item.precio_total_pagado || null,
                contenido_comprado: item.contenido_comprado || null,
                unidad_compra: item.unidad_compra || null
            }));

            const { error: detErr } = await supabase
                .from('compra_detalles')
                .insert(detailsPayload);

            if (detErr) throw detErr;

            // 3. F6-05: Recibir inmediatamente con egreso financiero e idempotencia
            if (shouldReceiveImmediate) {
                const operationKey = crypto.randomUUID();
                const { data: recData, error: recErr } = await supabase
                    .rpc('recibir_compra', {
                        p_compra_id: cmpData.id,
                        p_metodo_pago: compraForm.metodo_pago,
                        p_idempotency_key: operationKey
                    });
                if (recErr) throw recErr;
                if (recData && !recData.success) throw new Error(recData.message);
            }

            setEditingCompra(null);
            setCompraForm({ proveedor_id: '', observaciones: '', details: [], metodo_pago: 'EFECTIVO' });
            setSelectedDetail({ insumo_id: '', precio_total_pagado: '', contenido_comprado: '', unidad_compra: '', cantidad: 0, costo_unitario: 0 });
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

    // F6-05: Confirmar recepción con egreso financiero e idempotencia
    const handleConfirmarRecibir = async () => {
        if (!showRecibirModal) return;
        setActionLoading(true);
        try {
            const operationKey = crypto.randomUUID();
            const { data, error } = await supabase.rpc('recibir_compra', {
                p_compra_id: showRecibirModal.id,
                p_metodo_pago: recibirMetodoPago,
                p_idempotency_key: operationKey
            });
            if (error) throw error;
            if (data && !data.success) throw new Error(data.message);

            setShowRecibirModal(null);
            await fetchCompras();
            await fetchInventario();
            const recoveryMsg = data.recovered ? ' (operación verificada y recuperada)' : '';
            alert(`Compra recibida${recoveryMsg}. Inventario actualizado. Egreso de $${showRecibirModal.total?.toLocaleString() || 0} registrado en caja (${recibirMetodoPago}).`);
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
            const operationKey = crypto.randomUUID();
            const { data, error } = await supabase.rpc('anular_compra', {
                p_compra_id: showAnularModal.id,
                p_motivo: anularMotivo,
                p_idempotency_key: operationKey
            });

            if (error) throw error;
            if (data && !data.success) throw new Error(data.message);

            setShowAnularModal(null);
            setAnularMotivo('');
            await fetchCompras();
            await fetchInventario();
            const recoveryMsg = data.recovered ? ' (operación verificada y recuperada)' : '';
            alert(`Compra anulada y stock ajustado${recoveryMsg}.`);
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

    // ── Sale Cancellation Handlers ──────────────────────────────────────────
    const handleSolicitarAnulacion = async () => {
        if (!showSolicitarAnulacionModal || !anulacionMotivo.trim()) return;
        setActionLoading(true);
        try {
            // Socios/Admins anulate directly; workers create a solicitud
            const rpcName = currentUserProfile?.es_socio ? 'anular_venta_directa' : 'solicitar_anulacion_venta';
            const { data, error } = await supabase.rpc(rpcName, {
                p_venta_id: showSolicitarAnulacionModal.id,
                p_motivo: anulacionMotivo.trim()
            });
            if (error) throw error;
            if (data && !data.success) throw new Error(data.message);
            alert(data.message);
            setShowSolicitarAnulacionModal(null);
            setAnulacionMotivo('');
            await fetchDashboardData();
            // Refresh ventas if on ventas tab
            if (activeTab === 'ventas') await fetchVentas(ventasPage);
        } catch (err) {
            alert('Error: ' + err.message);
        } finally {
            setActionLoading(false);
        }
    };

    const handleAprobarAnulacion = async (solicitudId) => {
        if (!confirm('¿Confirmar aprobación de esta solicitud de anulación?')) return;
        setActionLoading(true);
        try {
            const { data, error } = await supabase.rpc('aprobar_anulacion_venta', { p_solicitud_id: solicitudId });
            if (error) throw error;
            if (data && !data.success) throw new Error(data.message);
            alert(data.message);
            await fetchDashboardData();
        } catch (err) {
            alert('Error: ' + err.message);
        } finally {
            setActionLoading(false);
        }
    };

    const handleEjecutarAnulacion = async (solicitudId) => {
        if (!confirm('⚠️ ESTA ACCIÓN ANULARÁ LA VENTA Y REVERTIRÁ CAJA, INVENTARIO Y FIDELIZACIÓN. ¿Confirmar?')) return;
        setActionLoading(true);
        try {
            const { data, error } = await supabase.rpc('ejecutar_anulacion_venta', { p_solicitud_id: solicitudId });
            if (error) throw error;
            if (data && !data.success) throw new Error(data.message);
            alert(data.message);
            await fetchDashboardData();
        } catch (err) {
            alert('Error: ' + err.message);
        } finally {
            setActionLoading(false);
        }
    };

    const handleRechazarAnulacion = async (solicitudId) => {
        if (!confirm('¿Rechazar esta solicitud de anulación?')) return;
        setActionLoading(true);
        try {
            const { data, error } = await supabase.rpc('rechazar_anulacion_venta', { p_solicitud_id: solicitudId });
            if (error) throw error;
            if (data && !data.success) throw new Error(data.message);
            alert(data.message);
            await fetchDashboardData();
        } catch (err) {
            alert('Error: ' + err.message);
        } finally {
            setActionLoading(false);
        }
    };

    // ── Cost Configuration Handlers ─────────────────────────────────────────
    const handleSaveCosto = async () => {
        if (!costoForm.nombre.trim() || !costoForm.monto) return;
        setActionLoading(true);
        try {
            const payload = {
                nombre: costoForm.nombre.trim(),
                descripcion: costoForm.descripcion.trim(),
                tipo_costo: costoForm.tipo_costo,
                categoria: costoForm.categoria,
                monto: Number(costoForm.monto),
                periodicidad: costoForm.periodicidad,
                creado_por: currentUserProfile?.id || null
            };
            if (editingCosto) {
                const { error } = await supabase.from('costos_configuracion').update({ ...payload, updated_at: new Date().toISOString() }).eq('id', editingCosto);
                if (error) throw error;
            } else {
                const { error } = await supabase.from('costos_configuracion').insert([payload]);
                if (error) throw error;
            }
            alert(editingCosto ? 'Costo actualizado.' : 'Costo creado.');
            setShowCostoModal(false);
            setCostoForm({ nombre: '', descripcion: '', tipo_costo: 'FIJO', categoria: 'OTROS', monto: '', periodicidad: 'MENSUAL' });
            setEditingCosto(null);
            await fetchDashboardData();
        } catch (err) {
            alert('Error: ' + err.message);
        } finally {
            setActionLoading(false);
        }
    };

    const handleToggleCosto = async (costo) => {
        setActionLoading(true);
        try {
            const { error } = await supabase.from('costos_configuracion')
                .update({ activo: !costo.activo, updated_at: new Date().toISOString() })
                .eq('id', costo.id);
            if (error) throw error;
            await fetchDashboardData();
        } catch (err) {
            alert('Error: ' + err.message);
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
        { id: 'dashboard', label: 'Dashboard', mobileLabel: 'Dashboard', icon: Flame },
        { id: 'inventario', label: 'Inventario', mobileLabel: 'Inventario', icon: Archive },
        { id: 'caja', label: 'Caja y Arqueo', mobileLabel: 'Caja', icon: PiggyBank },
        { id: 'ventas', label: 'Ventas', mobileLabel: 'Ventas', icon: ShoppingBag },
        { id: 'clientes', label: 'Clientes / Fidelización', mobileLabel: 'Clientes', icon: Users },
        { id: 'trabajadores', label: 'Trabajadores', mobileLabel: 'Staff', icon: Award },
        { id: 'rentabilidad', label: 'Rentabilidad / Finanzas', mobileLabel: 'Finanzas', icon: TrendingUp },
        { id: 'gastos', label: 'Gastos Operativos', mobileLabel: 'Gastos', icon: Receipt },
        { id: 'analitica', label: 'Analítica (Pareto 80/20)', mobileLabel: 'Analítica', icon: BarChart3 },
        { id: 'liquidaciones', label: 'Liquidaciones Staff', mobileLabel: 'Nómina', icon: DollarSign },
        { id: 'productos', label: 'Productos / Menú', mobileLabel: 'Productos', icon: UtensilsCrossed },
        { id: 'configuracion', label: 'Configuración', mobileLabel: 'Config', icon: Settings, restrictToSocio: true },
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
                        POS
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
                                    className={`px-3 py-1.5 rounded-xl text-[11px] font-bold whitespace-nowrap flex items-center gap-1.5 transition-all shrink-0 active:scale-95 relative ${isActive
                                            ? 'bg-fire text-white shadow-md shadow-fire/20 border border-fire/40'
                                            : 'bg-zinc-900 text-zinc-400 border border-zinc-800 hover:text-zinc-200'
                                        }`}
                                >
                                    <IconComponent size={13} />
                                    {item.mobileLabel}
                                    {alertBadges[item.id] > 0 && (
                                        <span className="absolute -top-1 -right-1 min-w-[16px] h-4 bg-red-500 text-white text-[9px] font-black rounded-full flex items-center justify-center px-1 shadow-lg shadow-red-500/30 animate-pulse">
                                            {alertBadges[item.id]}
                                        </span>
                                    )}
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
                                    className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-xl text-xs font-bold transition-all relative ${isActive
                                        ? 'bg-fire text-white shadow-lg shadow-fire/20 border border-fire/30'
                                        : 'text-zinc-400 hover:bg-zinc-850 hover:text-white'
                                        }`}
                                >
                                    <IconComponent size={17} />
                                    <span className="flex-1 text-left">{item.label}</span>
                                    {alertBadges[item.id] > 0 && (
                                        <span className="min-w-[20px] h-5 bg-red-500 text-white text-[10px] font-black rounded-full flex items-center justify-center px-1.5 shadow-lg shadow-red-500/30">
                                            {alertBadges[item.id]}
                                        </span>
                                    )}
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

                        {/* Fase 2: Alertas operativas — Bloques 6 y 9 del newpromt */}
                        {(pendingAnulacionesCount > 0 || arqueosConDiferencia > 0) && (
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                {pendingAnulacionesCount > 0 && (
                                    <button
                                        onClick={() => setActiveTab('ventas')}
                                        className="bg-red-950/30 border border-red-900/40 p-4 rounded-2xl flex items-center gap-3 hover:bg-red-950/50 transition-all text-left group"
                                    >
                                        <div className="w-10 h-10 bg-red-500/15 text-red-400 rounded-xl flex items-center justify-center shrink-0">
                                            <AlertTriangle size={20} />
                                        </div>
                                        <div>
                                            <p className="text-sm font-bold text-red-400">🚨 {pendingAnulacionesCount} solicitud{pendingAnulacionesCount !== 1 ? 'es' : ''} de anulación</p>
                                            <p className="text-[10px] text-zinc-500 mt-0.5">Requiere{pendingAnulacionesCount !== 1 ? 'n' : ''} aprobación del administrador</p>
                                        </div>
                                        <ArrowRight size={14} className="text-zinc-600 group-hover:text-red-400 transition-colors ml-auto shrink-0" />
                                    </button>
                                )}
                                {arqueosConDiferencia > 0 && (
                                    <button
                                        onClick={() => setActiveTab('caja')}
                                        className="bg-yellow-950/30 border border-yellow-900/40 p-4 rounded-2xl flex items-center gap-3 hover:bg-yellow-950/50 transition-all text-left group"
                                    >
                                        <div className="w-10 h-10 bg-yellow-500/15 text-yellow-400 rounded-xl flex items-center justify-center shrink-0">
                                            <PiggyBank size={20} />
                                        </div>
                                        <div>
                                            <p className="text-sm font-bold text-yellow-400">⚠️ {arqueosConDiferencia} arqueo{arqueosConDiferencia !== 1 ? 's' : ''} con diferencia</p>
                                            <p className="text-[10px] text-zinc-500 mt-0.5">Sesiones cerradas con faltante o sobrante</p>
                                        </div>
                                        <ArrowRight size={14} className="text-zinc-600 group-hover:text-yellow-400 transition-colors ml-auto shrink-0" />
                                    </button>
                                )}
                            </div>
                        )}

                        {/* Error banner — solo visible cuando fetchDashboardData falla */}
                        {fetchError && (
                            <ErrorBanner
                                message={fetchError}
                                onRetry={() => { setFetchError(null); fetchDashboardData(); }}
                            />
                        )}

                        {/* Fase 3 Bloque 20: Actividad Reciente — Feed de auditoría */}
                        {(() => {
                            const activityItems = [
                                ...salesList.slice(0, 8).map(s => ({
                                    type: 'venta',
                                    icon: '🧾',
                                    label: `Venta $${Number(s.total).toLocaleString()} — ${s.clientes?.nombre || 'Anónimo'}`,
                                    by: s.perfiles_trabajadores?.nombre || 'Sistema',
                                    date: new Date(s.fecha),
                                    color: s.estado === 'ANULADA' ? 'text-red-400' : 'text-green-400',
                                    badge: s.estado === 'ANULADA' ? 'ANULADA' : null,
                                })),
                                ...anulacionesList.slice(0, 5).map(a => ({
                                    type: 'anulacion',
                                    icon: '⚠️',
                                    label: `Anulación: $${Number(a.ventas?.total || 0).toLocaleString()} — ${a.motivo?.slice(0, 40) || 'Sin motivo'}`,
                                    by: a.solicitante?.nombre || 'N/A',
                                    date: new Date(a.created_at),
                                    color: a.estado === 'EJECUTADA' ? 'text-red-400' : 'text-yellow-400',
                                    badge: a.estado,
                                })),
                                ...sessionsList.filter(s => s.estado === 'CERRADA' && Math.abs(Number(s.diferencia || 0)) > 0).slice(0, 3).map(s => ({
                                    type: 'arqueo',
                                    icon: '💰',
                                    label: `Arqueo con diferencia: ${Number(s.diferencia) > 0 ? '+' : ''}$${Number(s.diferencia).toLocaleString()}`,
                                    by: s.perfiles_trabajadores?.nombre || 'N/A',
                                    date: new Date(s.cerrado_at || s.abierto_at),
                                    color: 'text-yellow-400',
                                    badge: 'DIFERENCIA',
                                })),
                            ].sort((a, b) => b.date - a.date).slice(0, 10);

                            if (activityItems.length === 0) return null;

                            return (
                                <div className="bg-zinc-900 border border-zinc-800/60 rounded-2xl overflow-hidden">
                                    <div className="p-4 border-b border-zinc-800 bg-zinc-950/40 flex items-center gap-2">
                                        <ClipboardList size={16} className="text-fire" />
                                        <h3 className="text-sm font-bold uppercase tracking-wider text-zinc-200">Actividad Reciente</h3>
                                        <span className="text-[10px] text-zinc-500 ml-auto">{activityItems.length} eventos</span>
                                    </div>
                                    <div className="divide-y divide-zinc-800/50 max-h-[350px] overflow-y-auto">
                                        {activityItems.map((item, idx) => (
                                            <div key={idx} className="px-4 py-3 flex items-start gap-3 hover:bg-zinc-800/20 transition-colors">
                                                <span className="text-base mt-0.5 shrink-0">{item.icon}</span>
                                                <div className="min-w-0 flex-1">
                                                    <p className={`text-xs font-medium ${item.color} truncate`}>{item.label}</p>
                                                    <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                                                        <span className="text-[10px] text-zinc-500">{item.by}</span>
                                                        <span className="text-[10px] text-zinc-600">·</span>
                                                        <span className="text-[10px] text-zinc-500">{item.date.toLocaleString('es-ES', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}</span>
                                                        {item.badge && (
                                                            <span className={`text-[9px] font-bold uppercase px-1.5 py-0.5 rounded ${item.badge === 'ANULADA' || item.badge === 'EJECUTADA' ? 'bg-red-500/10 text-red-400' :
                                                                    item.badge === 'PENDIENTE' ? 'bg-yellow-500/10 text-yellow-400' :
                                                                        item.badge === 'DIFERENCIA' ? 'bg-yellow-500/10 text-yellow-400' :
                                                                            'bg-zinc-700 text-zinc-300'
                                                                }`}>{item.badge}</span>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            );
                        })()}

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
                                                        {paymentMethodData.map((entry, i) => <Cell key={`cell-${i}`} fill={PAYMENT_METHOD_COLORS[entry.name] || CHART_COLORS[i % CHART_COLORS.length]} />)}
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
                                                    <th className="p-3 text-center">Acciones</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-zinc-850 text-xs">
                                                {sessionsList.length === 0 ? (
                                                    <tr>
                                                        <td colSpan="5" className="p-6 text-center text-zinc-500">No hay sesiones en el período</td>
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
                                                            <td className="p-3 text-center">
                                                                {sesion.estado === 'CERRADA' && Number(sesion.diferencia || 0) !== 0 && (
                                                                    <button
                                                                        onClick={() => {
                                                                            const dif = Number(sesion.diferencia || 0);
                                                                            setShowResolverDifModal(sesion);
                                                                            setResolverDifForm({
                                                                                metodo_pago: 'EFECTIVO',
                                                                                monto: Math.abs(dif),
                                                                                tipo: dif < 0 ? 'FALTANTE' : 'SOBRANTE',
                                                                                motivo: ''
                                                                            });
                                                                        }}
                                                                        className="bg-amber-900/40 hover:bg-amber-800/50 text-amber-300 px-2.5 py-1 rounded-lg text-[9px] font-bold border border-amber-700/30 transition-all"
                                                                    >
                                                                        ⚖️ Resolver
                                                                    </button>
                                                                )}
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
                                                                {client.stamps_count}
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

                        {/* Solicitudes de Anulación Panel */}
                        {anulacionesList.length > 0 && (
                            <div className="bg-zinc-900 border border-zinc-800/60 rounded-2xl overflow-hidden">
                                <div 
                                    className="p-4 border-b border-zinc-800 bg-zinc-950/40 flex justify-between items-center cursor-pointer hover:bg-zinc-900/80 transition-colors"
                                    onClick={() => setShowAnulacionesPanel(!showAnulacionesPanel)}
                                >
                                    <h3 className="text-sm font-bold uppercase tracking-wider text-red-400">🚨 Solicitudes de Anulación de Venta</h3>
                                    <ChevronDown size={20} className={`text-zinc-500 transition-transform ${showAnulacionesPanel ? 'rotate-180' : ''}`} />
                                </div>
                                {showAnulacionesPanel && (
                                    <div className="divide-y divide-zinc-800">
                                        {anulacionesList.map(sol => (
                                            <div key={sol.id} className="p-4 space-y-2">
                                                <div className="flex items-center justify-between gap-2 flex-wrap">
                                                    <div className="space-y-1">
                                                        <p className="text-xs text-zinc-400">Venta: ${Number(sol.ventas?.total || 0).toLocaleString()} — {sol.ventas?.fecha ? new Date(sol.ventas.fecha).toLocaleString('es-ES') : ''}</p>
                                                        <p className="text-xs text-zinc-300"><strong>Motivo:</strong> {sol.motivo}</p>
                                                        <p className="text-[10px] text-zinc-500">Solicitó: {sol.solicitante?.nombre || 'N/A'} · {new Date(sol.created_at).toLocaleString('es-ES')}</p>
                                                        {sol.aprobador1?.nombre && <p className="text-[10px] text-green-400">✓ Aprobación 1: {sol.aprobador1.nombre}</p>}
                                                        {sol.aprobador2?.nombre && <p className="text-[10px] text-green-400">✓ Aprobación 2: {sol.aprobador2.nombre}</p>}
                                                    </div>
                                                    <div className="flex items-center gap-2 flex-wrap">
                                                        <span className={`text-[10px] font-bold uppercase px-2 py-1 rounded ${sol.estado === 'PENDIENTE' ? 'bg-yellow-500/10 text-yellow-400' :
                                                                sol.estado === 'APROBACION_1' ? 'bg-blue-500/10 text-blue-400' :
                                                                    sol.estado === 'APROBACION_2' ? 'bg-purple-500/10 text-purple-400' :
                                                                        sol.estado === 'EJECUTADA' ? 'bg-green-500/10 text-green-400' :
                                                                            sol.estado === 'RECHAZADA' ? 'bg-red-500/10 text-red-400' : 'bg-zinc-700 text-zinc-300'
                                                            }`}>{sol.estado}</span>
                                                        {currentUserProfile?.es_socio && sol.estado !== 'EJECUTADA' && sol.estado !== 'RECHAZADA' && (
                                                            <>
                                                                {sol.estado === 'PENDIENTE' && (
                                                                    <>
                                                                        {sol.solicitante_id === currentUserProfile?.id ? (
                                                                            <span className="text-[10px] font-bold text-yellow-500/70 border border-yellow-500/20 px-3 py-1 rounded">
                                                                                Requiere otro aprobador
                                                                            </span>
                                                                        ) : (
                                                                            <button onClick={() => handleAprobarAnulacion(sol.id)} disabled={actionLoading} className="text-[10px] font-bold bg-green-500/10 text-green-400 hover:bg-green-500/20 px-3 py-1 rounded transition-colors">Aprobar y Ejecutar</button>
                                                                        )}
                                                                    </>
                                                                )}
                                                                {sol.estado === 'APROBACION_1' && (
                                                                    <>
                                                                        {sol.solicitante_id === currentUserProfile?.id ? (
                                                                            <span className="text-[10px] font-bold text-yellow-500/70 border border-yellow-500/20 px-3 py-1 rounded">
                                                                                Requiere otro aprobador
                                                                            </span>
                                                                        ) : (
                                                                            <button onClick={() => handleAprobarAnulacion(sol.id)} disabled={actionLoading} className="text-[10px] font-bold bg-green-500/10 text-green-400 hover:bg-green-500/20 px-3 py-1 rounded transition-colors">Aprobar y Ejecutar</button>
                                                                        )}
                                                                    </>
                                                                )}
                                                                {sol.estado === 'APROBACION_2' && (
                                                                    <>
                                                                        {sol.solicitante_id === currentUserProfile?.id ? (
                                                                            <span className="text-[10px] font-bold text-yellow-500/70 border border-yellow-500/20 px-3 py-1 rounded">
                                                                                Requiere otro aprobador
                                                                            </span>
                                                                        ) : (
                                                                            <button onClick={() => handleEjecutarAnulacion(sol.id)} disabled={actionLoading} className="text-[10px] font-bold bg-fire/20 text-fire hover:bg-fire/30 px-3 py-1 rounded transition-colors">Ejecutar Anulación</button>
                                                                        )}
                                                                    </>
                                                                )}
                                                                <button onClick={() => handleRechazarAnulacion(sol.id)} disabled={actionLoading} className="text-[10px] font-bold bg-red-500/10 text-red-400 hover:bg-red-500/20 px-3 py-1 rounded transition-colors">Rechazar</button>
                                                            </>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        )}

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
                                                <th className="p-4">Estado</th>
                                                <th className="p-4 text-right">Total</th>
                                                <th className="p-4">Acciones</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-zinc-800 text-sm">
                                            {ventasPageData.map(sale => (
                                                <React.Fragment key={sale.id}>
                                                    <tr className="hover:bg-zinc-800/20 transition-colors cursor-pointer" onClick={async () => {
                                                        const newId = expandedSaleId === sale.id ? null : sale.id;
                                                        setExpandedSaleId(newId);
                                                        if (newId) {
                                                            const { data: stamps } = await supabase.from('stamp_logs').select('clientes(nombre)').eq('venta_id', newId).eq('tipo', 'VENTA').eq('estado', 'ACTIVO');
                                                            setExpandedSaleClients(stamps?.map(s => s.clientes?.nombre).filter(Boolean) || []);
                                                        } else { setExpandedSaleClients([]); }
                                                    }}>
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
                                                        <td className="p-4">
                                                            <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded ${sale.estado === 'COMPLETADA' ? 'bg-green-500/10 text-green-400' : sale.estado === 'ANULADA' ? 'bg-red-500/10 text-red-400' : 'bg-zinc-700 text-zinc-300'}`}>{sale.estado || 'COMPLETADA'}</span>
                                                        </td>
                                                        <td className="p-4" onClick={e => e.stopPropagation()}>
                                                            {sale.estado === 'COMPLETADA' && (
                                                                <button onClick={() => setShowSolicitarAnulacionModal(sale)} className="text-[10px] font-bold uppercase bg-red-500/10 text-red-400 hover:bg-red-500/20 px-2 py-1 rounded transition-colors">{currentUserProfile?.es_socio ? 'Anular' : 'Solicitar Anulaci\u00f3n'}</button>
                                                            )}
                                                        </td>
                                                    </tr>
                                                    {expandedSaleId === sale.id && (
                                                        <tr>
                                                            <td colSpan={7} className="bg-zinc-950/60 p-4 border-l-2 border-fire/30">
                                                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                                                                    {/* Products */}
                                                                    <div className="space-y-2">
                                                                        <p className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">Productos</p>
                                                                        {(sale.detalles?.items || []).length > 0 ? (
                                                                            <div className="space-y-1">
                                                                                {(sale.detalles.items).map((item, idx) => (
                                                                                    <div key={idx} className="flex justify-between items-center py-1 border-b border-zinc-800/50 last:border-0">
                                                                                        <span className="text-zinc-300">
                                                                                            {item.nombre || item.name} × {item.cantidad || item.quantity || 1}
                                                                                        </span>
                                                                                        <span className="text-zinc-200 font-bold">
                                                                                            ${(Number(item.precio || item.price || 0) * Number(item.cantidad || item.quantity || 1)).toLocaleString()}
                                                                                        </span>
                                                                                    </div>
                                                                                ))}
                                                                            </div>
                                                                        ) : (
                                                                            <p className="text-zinc-600 italic">Sin detalles disponibles</p>
                                                                        )}
                                                                    </div>
                                                                    {/* Summary */}
                                                                    <div className="space-y-2">
                                                                        <p className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">Resumen</p>
                                                                        <div className="space-y-1">
                                                                            <div className="flex justify-between"><span className="text-zinc-500">Subtotal</span><span className="text-zinc-300">${Number(sale.subtotal || sale.total).toLocaleString()}</span></div>
                                                                            {Number(sale.descuento || 0) > 0 && (
                                                                                <div className="flex justify-between"><span className="text-zinc-500">Descuento</span><span className="text-red-400">-${Number(sale.descuento).toLocaleString()}</span></div>
                                                                            )}
                                                                            <div className="flex justify-between font-bold border-t border-zinc-800 pt-1"><span className="text-zinc-300">Total</span><span className="text-fire">${Number(sale.total).toLocaleString()}</span></div>
                                                                            <div className="flex justify-between mt-2"><span className="text-zinc-500">Método</span><span className="text-zinc-300 font-bold">{sale.metodo_pago}</span></div>
                                                                            <div className="flex justify-between items-start"><span className="text-zinc-500">Cliente(s)</span><div className="text-right"><p className="text-zinc-300">{sale.clientes?.nombre || 'No registrado'}</p>{expandedSaleClients.filter(n => n !== sale.clientes?.nombre).map((name, i) => (<p key={i} className="text-zinc-400 text-[10px]">+ {name}</p>))}</div></div>
                                                                        </div>
                                                                    </div>
                                                                </div>
                                                            </td>
                                                        </tr>
                                                    )}
                                                </React.Fragment>
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
                                            <div
                                                className="flex items-center justify-between gap-2 cursor-pointer"
                                                onClick={async () => {
                                                    const newId = expandedSaleId === sale.id ? null : sale.id;
                                                    setExpandedSaleId(newId);
                                                    if (newId) {
                                                        const { data: stamps } = await supabase.from('stamp_logs').select('clientes(nombre)').eq('venta_id', newId).eq('tipo', 'VENTA').eq('estado', 'ACTIVO');
                                                        setExpandedSaleClients(stamps?.map(s => s.clientes?.nombre).filter(Boolean) || []);
                                                    } else { setExpandedSaleClients([]); }
                                                }}
                                            >
                                                <span className="text-xs text-zinc-400">
                                                    {new Date(sale.fecha).toLocaleString('es-ES', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                                                </span>
                                                <span className="font-bold text-zinc-100 text-base">
                                                    ${Number(sale.total).toLocaleString()}
                                                </span>
                                            </div>
                                            {/* Nivel 2 — secundario */}
                                            <div className="flex items-center gap-2 flex-wrap" onClick={async () => {
                                                const newId = expandedSaleId === sale.id ? null : sale.id;
                                                setExpandedSaleId(newId);
                                                if (newId) {
                                                    const { data: stamps } = await supabase.from('stamp_logs').select('clientes(nombre)').eq('venta_id', newId).eq('tipo', 'VENTA').eq('estado', 'ACTIVO');
                                                    setExpandedSaleClients(stamps?.map(s => s.clientes?.nombre).filter(Boolean) || []);
                                                } else { setExpandedSaleClients([]); }
                                            }}>
                                                <span className="text-[10px] font-bold uppercase bg-zinc-800 text-zinc-300 px-2 py-0.5 rounded">
                                                    {sale.metodo_pago}
                                                </span>
                                                <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded ${sale.estado === 'COMPLETADA' ? 'bg-green-500/10 text-green-400' : sale.estado === 'ANULADA' ? 'bg-red-500/10 text-red-400' : 'bg-zinc-700 text-zinc-300'}`}>{sale.estado || 'COMPLETADA'}</span>
                                                <span className="text-xs text-zinc-400">
                                                    {sale.clientes?.nombre || <span className="italic text-zinc-600">Anónimo</span>}
                                                </span>
                                                <span className="text-[10px] text-zinc-600">
                                                    · {sale.perfiles_trabajadores?.nombre || 'Desconocido'}
                                                </span>
                                            </div>
                                            {/* Nivel 3 — detalle expandible + anulación (Bloque 8 + 9 mobile) */}
                                            {expandedSaleId === sale.id && (
                                                <div className="mt-2 bg-zinc-950/60 border border-zinc-800/50 rounded-xl p-3 space-y-3 animate-fadeIn">
                                                    {/* Productos */}
                                                    {(sale.detalles?.items || []).length > 0 && (
                                                        <div className="space-y-1">
                                                            <p className="text-[10px] font-bold uppercase tracking-wider text-zinc-500">Productos</p>
                                                            {sale.detalles.items.map((item, idx) => (
                                                                <div key={idx} className="flex justify-between text-xs">
                                                                    <span className="text-zinc-300">{item.nombre || item.name} × {item.cantidad || item.quantity || 1}</span>
                                                                    <span className="text-zinc-200 font-bold">${(Number(item.precio || item.price || 0) * Number(item.cantidad || item.quantity || 1)).toLocaleString()}</span>
                                                                </div>
                                                            ))}
                                                        </div>
                                                    )}
                                                    {/* Resumen */}
                                                    <div className="space-y-1 text-xs">
                                                        <div className="flex justify-between items-start"><span className="text-zinc-500">Cliente(s)</span><div className="text-right"><p className="text-zinc-300">{sale.clientes?.nombre || 'No registrado'}</p>{expandedSaleClients.filter(n => n !== sale.clientes?.nombre).map((name, i) => (<p key={i} className="text-zinc-400 text-[10px]">+ {name}</p>))}</div></div>
                                                        <div className="flex justify-between"><span className="text-zinc-500">Subtotal</span><span className="text-zinc-300">${Number(sale.subtotal || sale.total).toLocaleString()}</span></div>
                                                        {Number(sale.descuento || 0) > 0 && (
                                                            <div className="flex justify-between"><span className="text-zinc-500">Descuento</span><span className="text-red-400">-${Number(sale.descuento).toLocaleString()}</span></div>
                                                        )}
                                                        <div className="flex justify-between font-bold border-t border-zinc-800 pt-1"><span className="text-zinc-300">Total</span><span className="text-fire">${Number(sale.total).toLocaleString()}</span></div>
                                                    </div>
                                                    {/* Botón anulación mobile */}
                                                    {sale.estado === 'COMPLETADA' && (
                                                        <button
                                                            onClick={() => setShowSolicitarAnulacionModal(sale)}
                                                            className="w-full text-[11px] font-bold uppercase bg-red-500/10 text-red-400 hover:bg-red-500/20 px-3 py-2.5 rounded-xl transition-colors mt-1"
                                                        >
                                                            {currentUserProfile?.es_socio ? '🗑 Anular Venta' : '📋 Solicitar Anulación'}
                                                        </button>
                                                    )}
                                                </div>
                                            )}
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
                        <div className="flex flex-wrap items-center justify-between gap-3">
                            <SectionHeader
                                title="Arqueo y Caja"
                                subtitle="Seguimiento de movimientos financieros y balance de caja por cuenta oficial"
                                icon={PiggyBank}
                            />
                            <div className="flex flex-wrap gap-2">
                                <button
                                    onClick={() => setShowSaldoInicialModal(true)}
                                    className="bg-emerald-900/40 hover:bg-emerald-800/50 text-emerald-300 px-3 py-2 rounded-xl text-[10px] font-bold border border-emerald-700/30 transition-all flex items-center gap-1.5"
                                >
                                    🏁 Saldo Inicial
                                </button>
                                <button
                                    onClick={() => setShowMovManualModal('INGRESO_MANUAL')}
                                    className="bg-green-900/40 hover:bg-green-800/50 text-green-300 px-3 py-2 rounded-xl text-[10px] font-bold border border-green-700/30 transition-all flex items-center gap-1.5"
                                >
                                    ➕ Ingreso Manual
                                </button>
                                <button
                                    onClick={() => setShowMovManualModal('RETIRO')}
                                    className="bg-red-900/40 hover:bg-red-800/50 text-red-300 px-3 py-2 rounded-xl text-[10px] font-bold border border-red-700/30 transition-all flex items-center gap-1.5"
                                >
                                    💸 Retiro
                                </button>
                                <button
                                    onClick={() => setShowTransferModal(true)}
                                    className="bg-zinc-800 hover:bg-zinc-700 text-zinc-200 px-3 py-2 rounded-xl text-[10px] font-bold border border-zinc-700 transition-all flex items-center gap-1.5"
                                >
                                    🔀 Transferencia
                                </button>
                            </div>
                        </div>

                        {/* Saldo Global del Negocio */}
                        <div className="bg-gradient-to-r from-zinc-900 via-zinc-900 to-zinc-800 border border-zinc-700/50 rounded-2xl p-5 shadow-lg">
                            <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-500 mb-3">💰 Saldo Global del Negocio (Acumulado histórico)</p>
                            <div className="grid grid-cols-3 gap-4">
                                <div>
                                    <p className="text-[10px] text-green-400/70 font-bold uppercase">💵 Efectivo</p>
                                    <p className="text-xl font-bold text-green-400">${saldoGlobal.efectivo.toLocaleString()}</p>
                                </div>
                                <div>
                                    <p className="text-[10px] text-pink-400/70 font-bold uppercase">📱 Nequi</p>
                                    <p className="text-xl font-bold text-pink-400">${saldoGlobal.nequi.toLocaleString()}</p>
                                </div>
                                <div>
                                    <p className="text-[10px] text-yellow-400/70 font-bold uppercase">🏦 Bancolombia</p>
                                    <p className="text-xl font-bold text-yellow-400">${saldoGlobal.bancolombia.toLocaleString()}</p>
                                </div>
                            </div>
                            <div className="mt-3 pt-3 border-t border-zinc-800">
                                <p className="text-[10px] text-zinc-500 font-bold uppercase">Total</p>
                                <p className="text-2xl font-bold text-white">${(saldoGlobal.efectivo + saldoGlobal.nequi + saldoGlobal.bancolombia).toLocaleString()}</p>
                            </div>
                        </div>

                        {/* Financial Accounts Breakdown (Tesorería) */}
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                            {/* B2: Clickeable account cards with expandable movements */}
                            {[
                                { key: 'EFECTIVO', label: '💵 Cuenta Efectivo', desc: 'Fondo de caja físico', abbr: 'EF', borderColor: 'border-green-500/30', textColor: 'text-green-400', bgIcon: 'bg-green-500/10', activeBorder: 'border-green-500' },
                                { key: 'NEQUI', label: '📱 Cuenta Nequi', desc: 'Transferencias bancarias Nequi', abbr: 'NQ', borderColor: 'border-pink-500/30', textColor: 'text-pink-400', bgIcon: 'bg-pink-500/10', activeBorder: 'border-pink-500' },
                                { key: 'BANCOLOMBIA', label: '🏦 Cuenta Bancolombia', desc: 'Transferencias QR Bancolombia', abbr: 'BC', borderColor: 'border-yellow-500/30', textColor: 'text-yellow-400', bgIcon: 'bg-yellow-500/10', activeBorder: 'border-yellow-500' }
                            ].map(acct => {
                                const ingresos = movementsList.filter(m => m.metodo_pago === acct.key && m.tipo === 'INGRESO').reduce((sum, m) => sum + Number(m.monto || 0), 0);
                                const egresos = movementsList.filter(m => m.metodo_pago === acct.key && m.tipo === 'EGRESO').reduce((sum, m) => sum + Number(m.monto || 0), 0);
                                const saldo = ingresos - egresos;
                                const isExpanded = expandedCajaAccount === acct.key;
                                const accountMovements = movementsList.filter(m => m.metodo_pago === acct.key);

                                return (
                                    <div key={acct.key} className="space-y-0">
                                        <div
                                            onClick={() => setExpandedCajaAccount(isExpanded ? null : acct.key)}
                                            className={`bg-zinc-900 border ${isExpanded ? acct.activeBorder : acct.borderColor} p-5 rounded-2xl flex items-center justify-between shadow-lg cursor-pointer hover:bg-zinc-800/50 transition-all ${isExpanded ? 'rounded-b-none' : ''}`}
                                        >
                                            <div>
                                                <p className={`${acct.textColor} text-[10px] uppercase tracking-widest font-bold`}>{acct.label}</p>
                                                <h3 className="text-2xl font-bold text-white mt-1">${saldo.toLocaleString()}</h3>
                                                <span className="text-[10px] text-zinc-500 mt-1 block">{acct.desc} · {accountMovements.length} movimientos</span>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <div className={`w-10 h-10 ${acct.bgIcon} ${acct.textColor} rounded-xl flex items-center justify-center font-bold`}>
                                                    {acct.abbr}
                                                </div>
                                                <ChevronDown size={16} className={`text-zinc-500 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                                            </div>
                                        </div>

                                        {/* Expanded: filtered movements */}
                                        {isExpanded && (
                                            <div className="bg-zinc-950/60 border border-t-0 border-zinc-800/60 rounded-b-2xl divide-y divide-zinc-800/50 max-h-[400px] overflow-y-auto">
                                                {accountMovements.length === 0 ? (
                                                    <div className="py-8 text-center text-zinc-600 text-xs">Sin movimientos</div>
                                                ) : accountMovements.slice(0, 50).map(move => (
                                                    <div key={move.id} className="space-y-0">
                                                        <div
                                                            className={`p-3 flex items-center justify-between gap-3 ${move.venta_id ? 'cursor-pointer hover:bg-zinc-900/60' : ''}`}
                                                            onClick={() => { if (move.venta_id) loadMovementSaleDetail(move.id, move.venta_id); }}
                                                        >
                                                            <div className="min-w-0 flex-1">
                                                                <div className="flex items-center gap-2 flex-wrap">
                                                                    <span className={`text-[9px] font-bold px-2 py-0.5 rounded ${move.tipo === 'INGRESO' ? 'bg-green-500/10 text-green-400' : 'bg-red-500/10 text-red-400'}`}>{move.tipo}</span>
                                                                    {move.tipo_operacion === 'TRANSFERENCIA_INTERNA' && (
                                                                        <span className="text-[9px] font-bold px-2 py-0.5 rounded bg-blue-500/10 text-blue-400">TRANSF.</span>
                                                                    )}
                                                                    {move.venta_id && (
                                                                        <span className="text-[9px] font-bold px-2 py-0.5 rounded bg-purple-500/10 text-purple-400 flex items-center gap-1">
                                                                            🧾 Venta {expandedMovementId === move.id ? '▲' : '▼'}
                                                                        </span>
                                                                    )}
                                                                    <span className="text-[10px] text-zinc-500">{new Date(move.fecha).toLocaleString('es-ES', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}</span>
                                                                </div>
                                                                <p className="text-xs text-zinc-400 mt-0.5 truncate">{move.descripcion || 'Sin descripción'}</p>
                                                                <p className="text-[10px] text-zinc-600 mt-0.5">{move.perfiles_trabajadores?.nombre || 'Sistema'}</p>
                                                            </div>
                                                            <span className={`font-bold text-sm whitespace-nowrap ${move.tipo === 'INGRESO' ? 'text-green-400' : 'text-red-400'}`}>
                                                                {move.tipo === 'INGRESO' ? '+' : '-'}${Number(move.monto).toLocaleString()}
                                                            </span>
                                                        </div>
                                                        {/* Inline sale detail when this movement is expanded */}
                                                        {expandedMovementId === move.id && (
                                                            <div className="px-3 pb-3">
                                                                <div className="bg-zinc-900/80 border border-zinc-800/40 rounded-xl p-3 text-xs space-y-2">
                                                                    {expandedMovementLoading ? (
                                                                        <div className="text-zinc-500 text-xs flex items-center gap-2"><svg className="animate-spin w-4 h-4 text-fire" viewBox="0 0 24 24" fill="none"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" /></svg> Cargando detalle...</div>
                                                                    ) : expandedMovementSale ? (
                                                                        <>
                                                                            {(expandedMovementSale.detalles?.items || []).length > 0 && (
                                                                                <div className="space-y-1">
                                                                                    <p className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">Productos</p>
                                                                                    {expandedMovementSale.detalles.items.map((item, idx) => (
                                                                                        <div key={idx} className="flex justify-between py-0.5">
                                                                                            <span className="text-zinc-300">{item.nombre || item.name} × {item.cantidad || item.quantity || 1}</span>
                                                                                            <span className="text-zinc-200 font-bold">${(Number(item.precio || item.price || 0) * Number(item.cantidad || item.quantity || 1)).toLocaleString()}</span>
                                                                                        </div>
                                                                                    ))}
                                                                                </div>
                                                                            )}
                                                                            <div className="space-y-1">
                                                                                <div className="flex justify-between items-start"><span className="text-zinc-500">Cliente(s)</span><div className="text-right"><span className="text-zinc-300">{expandedMovementSale.clientes?.nombre || 'No registrado'}</span>{expandedMovementSale._allClients?.filter(n => n !== expandedMovementSale.clientes?.nombre).map((name, i) => (<p key={i} className="text-zinc-400 text-[10px]">+ {name}</p>))}</div></div>
                                                                                {Number(expandedMovementSale._descuento || 0) > 0 && (
                                                                                    <div className="flex justify-between"><span className="text-zinc-500">Descuento</span><span className="text-red-400">-${Number(expandedMovementSale._descuento).toLocaleString()}</span></div>
                                                                                )}
                                                                                <div className="flex justify-between font-bold border-t border-zinc-800 pt-1"><span className="text-zinc-300">Total</span><span className="text-fire">${Number(expandedMovementSale.total).toLocaleString()}</span></div>
                                                                                {expandedMovementSale.metodo_pago === 'MIXTO' && expandedMovementSale._paymentBreakdown?.length > 0 && (
                                                                                    <div className="mt-1 space-y-0.5">
                                                                                        {expandedMovementSale._paymentBreakdown.map((pb, i) => (
                                                                                            <div key={i} className="flex justify-between text-[10px]"><span className="text-zinc-500">{pb.metodo_pago}</span><span className="text-zinc-300">${Number(pb.monto).toLocaleString()}</span></div>
                                                                                        ))}
                                                                                    </div>
                                                                                )}
                                                                            </div>
                                                                        </>
                                                                    ) : (
                                                                        <p className="text-zinc-500">No se pudo cargar el detalle</p>
                                                                    )}
                                                                </div>
                                                            </div>
                                                        )}
                                                    </div>
                                                ))}
                                                {accountMovements.length > 50 && (
                                                    <div className="py-3 text-center text-zinc-600 text-[10px]">Mostrando los primeros 50 de {accountMovements.length} movimientos</div>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>

                        {/* Movements List — paginado Fase 6.3 + Fase 2 Bloque 3 filtros */}
                        <div className="bg-zinc-900 border border-zinc-800/60 rounded-2xl overflow-hidden">

                            {/* Fase 2: Date filter bar + search */}
                            <div className="p-4 border-b border-zinc-800 flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between">
                                <div className="flex gap-1.5 overflow-x-auto">
                                    {[
                                        { key: 'today', label: 'Hoy' },
                                        { key: 'yesterday', label: 'Ayer' },
                                        { key: '7d', label: '7 días' },
                                        { key: '30d', label: '30 días' },
                                        { key: 'all', label: 'Todos' },
                                    ].map(opt => (
                                        <button
                                            key={opt.key}
                                            onClick={() => { setCajaDateFilter(opt.key); fetchMovementsPage(0, opt.key); }}
                                            className={`px-3 py-1.5 rounded-lg text-[11px] font-bold whitespace-nowrap transition-all ${cajaDateFilter === opt.key
                                                    ? 'bg-fire text-white shadow shadow-fire/15'
                                                    : 'bg-zinc-800 text-zinc-400 hover:text-white'
                                                }`}
                                        >
                                            {opt.label}
                                        </button>
                                    ))}
                                </div>
                                <div className="relative">
                                    <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500 pointer-events-none" />
                                    <input
                                        type="text"
                                        placeholder="Buscar movimiento..."
                                        className="w-full sm:w-56 bg-zinc-950 border border-zinc-800 rounded-lg pl-8 pr-3 py-1.5 text-xs text-white placeholder:text-zinc-600 focus:border-zinc-600 outline-none"
                                        value={cajaSearch}
                                        onChange={e => setCajaSearch(e.target.value)}
                                    />
                                </div>
                            </div>

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
                                    No se registran movimientos de caja en este período
                                </div>
                            )}

                            {/* Desktop table */}
                            {!movementsLoading && !movementsError && (() => {
                                const q = cajaSearch.toLowerCase().trim();
                                const filtered = q
                                    ? movementsPageData.filter(m => (m.descripcion || '').toLowerCase().includes(q) || (m.metodo_pago || '').toLowerCase().includes(q) || (m.perfiles_trabajadores?.nombre || '').toLowerCase().includes(q))
                                    : movementsPageData;
                                if (filtered.length === 0 && movementsPageData.length > 0) {
                                    return <div className="py-8 text-center text-zinc-600 text-xs">Sin resultados para &ldquo;{cajaSearch}&rdquo;</div>;
                                }
                                if (filtered.length === 0) return null;
                                return (
                                    <>
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
                                                    {filtered.map(move => (
                                                        <React.Fragment key={move.id}>
                                                            <tr
                                                                className="hover:bg-zinc-800/20 transition-colors cursor-pointer"
                                                                onClick={() => loadMovementSaleDetail(move.id, move.venta_id)}
                                                            >
                                                                <td className="p-4 text-xs text-zinc-400">
                                                                    {new Date(move.fecha).toLocaleString('es-ES')}
                                                                </td>
                                                                <td className="p-4">
                                                                    <span className={`text-[9px] font-bold px-2 py-0.5 rounded ${move.tipo === 'INGRESO' ? 'bg-green-500/10 text-green-400' : 'bg-red-500/10 text-red-400'}`}>
                                                                        {move.tipo}
                                                                    </span>
                                                                    {move.tipo_operacion === 'TRANSFERENCIA_INTERNA' && (
                                                                        <span className="ml-1 text-[9px] font-bold px-2 py-0.5 rounded bg-blue-500/10 text-blue-400">TRANSF.</span>
                                                                    )}
                                                                </td>
                                                                <td className="p-4 text-xs font-bold text-zinc-300">
                                                                    {move.metodo_pago}
                                                                </td>
                                                                <td className="p-4 text-zinc-300 text-xs">
                                                                    {move.descripcion}
                                                                    {move.venta_id && (
                                                                        <span className="ml-2 inline-flex text-[9px] font-bold px-2 py-0.5 rounded bg-blue-500/10 text-blue-400 items-center gap-1 align-middle">
                                                                            Ver Venta ↱
                                                                        </span>
                                                                    )}
                                                                </td>
                                                                <td className="p-4 text-xs text-zinc-400">
                                                                    {move.perfiles_trabajadores?.nombre || 'Desconocido'}
                                                                </td>
                                                                <td className={`p-4 text-right font-bold ${move.tipo === 'INGRESO' ? 'text-green-400' : 'text-red-400'}`}>
                                                                    ${Number(move.monto).toLocaleString()}
                                                                </td>
                                                            </tr>
                                                            {/* Fase 2 Bloque 2: Expanded sale detail */}
                                                            {expandedMovementId === move.id && (
                                                                <tr>
                                                                    <td colSpan={6} className="bg-zinc-950/60 p-4 border-l-2 border-fire/30">
                                                                        {expandedMovementLoading ? (
                                                                            <div className="text-zinc-500 text-xs flex items-center gap-2"><svg className="animate-spin w-4 h-4 text-fire" viewBox="0 0 24 24" fill="none"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" /></svg> Cargando detalle...</div>
                                                                        ) : expandedMovementSale ? (
                                                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                                                                                <div className="space-y-2">
                                                                                    <p className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">Productos</p>
                                                                                    {(expandedMovementSale.detalles?.items || []).length > 0 ? (
                                                                                        expandedMovementSale.detalles.items.map((item, idx) => (
                                                                                            <div key={idx} className="flex justify-between py-1 border-b border-zinc-800/50 last:border-0">
                                                                                                <span className="text-zinc-300">{item.nombre || item.name} × {item.cantidad || item.quantity || 1}</span>
                                                                                                <span className="text-zinc-200 font-bold">${(Number(item.precio || item.price || 0) * Number(item.cantidad || item.quantity || 1)).toLocaleString()}</span>
                                                                                            </div>
                                                                                        ))
                                                                                    ) : <p className="text-zinc-600 italic">Sin detalles disponibles</p>}
                                                                                </div>
                                                                                <div className="space-y-2">
                                                                                    <p className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">Resumen de Venta</p>
                                                                                    <div className="space-y-1">
                                                                                        <div className="flex justify-between"><span className="text-zinc-500">Cliente</span><span className="text-zinc-300">{expandedMovementSale.clientes?.nombre || 'No registrado'}</span></div>
                                                                                        {/* Multi-client: show all associated clients from stamp_logs */}
                                                                                        {expandedMovementSale._allClients?.length > 1 && (
                                                                                            <div className="flex justify-between items-start"><span className="text-zinc-500">Clientes extra</span><span className="text-zinc-300 text-right">{expandedMovementSale._allClients.filter(n => n !== expandedMovementSale.clientes?.nombre).join(', ')}</span></div>
                                                                                        )}
                                                                                        <div className="flex justify-between"><span className="text-zinc-500">Subtotal</span><span className="text-zinc-300">${Number(expandedMovementSale._subtotal ?? expandedMovementSale.total).toLocaleString()}</span></div>
                                                                                        {Number(expandedMovementSale._descuento || 0) > 0 && (
                                                                                            <div className="flex justify-between"><span className="text-zinc-500">Descuento</span><span className="text-red-400">-${Number(expandedMovementSale._descuento).toLocaleString()}</span></div>
                                                                                        )}
                                                                                        <div className="flex justify-between font-bold border-t border-zinc-800 pt-1"><span className="text-zinc-300">Total</span><span className="text-fire">${Number(expandedMovementSale.total).toLocaleString()}</span></div>
                                                                                        <div className="flex justify-between mt-2"><span className="text-zinc-500">Método</span><span className="text-zinc-300 font-bold">{expandedMovementSale.metodo_pago}</span></div>
                                                                                        {/* Mixed payment breakdown */}
                                                                                        {expandedMovementSale.metodo_pago === 'MIXTO' && expandedMovementSale._paymentBreakdown?.length > 0 && (
                                                                                            <div className="mt-1 space-y-0.5">
                                                                                                {expandedMovementSale._paymentBreakdown.map((pb, i) => (
                                                                                                    <div key={i} className="flex justify-between text-[10px]"><span className="text-zinc-500">{pb.metodo_pago}</span><span className="text-zinc-300">${Number(pb.monto).toLocaleString()}</span></div>
                                                                                                ))}
                                                                                            </div>
                                                                                        )}
                                                                                        <div className="flex justify-between"><span className="text-zinc-500">Estado</span><span className={expandedMovementSale.estado === 'ANULADA' ? 'text-red-400 font-bold' : 'text-green-400'}>{expandedMovementSale.estado || 'COMPLETADA'}</span></div>
                                                                                    </div>
                                                                                    <button
                                                                                        onClick={() => { setActiveTab('ventas'); setExpandedSaleId(expandedMovementSale.id); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
                                                                                        className="mt-2 text-[10px] font-bold px-3 py-1.5 rounded bg-blue-500/10 text-blue-400 hover:bg-blue-500/20 cursor-pointer"
                                                                                    >
                                                                                        Ver venta completa ↱
                                                                                    </button>
                                                                                </div>
                                                                            </div>
                                                                        ) : (
                                                                            <p className="text-zinc-500 text-xs">{move.venta_id ? 'No se pudo cargar el detalle de esta venta' : 'Este movimiento no está vinculado a una venta'}</p>
                                                                        )}
                                                                    </td>
                                                                </tr>
                                                            )}
                                                        </React.Fragment>
                                                    ))}
                                                </tbody>
                                            </table>
                                        </div>

                                        {/* Mobile cards */}
                                        <div className="md:hidden divide-y divide-zinc-800">
                                            {filtered.map(move => (
                                                <div key={move.id} className="p-4 space-y-1.5">
                                                    {/* Nivel 1 */}
                                                    <div
                                                        className="flex items-center justify-between gap-2 cursor-pointer"
                                                        onClick={() => loadMovementSaleDetail(move.id, move.venta_id)}
                                                    >
                                                        <div className="flex items-center gap-2">
                                                            <span className={`text-[9px] font-bold px-2 py-0.5 rounded ${move.tipo === 'INGRESO' ? 'bg-green-500/10 text-green-400' : 'bg-red-500/10 text-red-400'}`}>
                                                                {move.tipo}
                                                            </span>
                                                            {move.tipo_operacion === 'TRANSFERENCIA_INTERNA' && (
                                                                <span className="text-[9px] font-bold px-2 py-0.5 rounded bg-blue-500/10 text-blue-400">TRANSF.</span>
                                                            )}
                                                            <span className="text-xs text-zinc-400">
                                                                {new Date(move.fecha).toLocaleString('es-ES', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                                                            </span>
                                                        </div>
                                                        <span className={`font-bold text-base ${move.tipo === 'INGRESO' ? 'text-green-400' : 'text-red-400'}`}>
                                                            {move.tipo === 'INGRESO' ? '+' : '-'}${Number(move.monto).toLocaleString()}
                                                        </span>
                                                    </div>
                                                    {/* Nivel 2 */}
                                                    <div className="flex items-center gap-2 flex-wrap" onClick={() => loadMovementSaleDetail(move.id, move.venta_id)}>
                                                        <span className="text-xs font-bold text-zinc-300">{move.metodo_pago}</span>
                                                        {move.descripcion && (
                                                            <span className="text-xs text-zinc-500 truncate max-w-[200px]">{move.descripcion}</span>
                                                        )}
                                                        <span className="text-[10px] text-zinc-600">· {move.perfiles_trabajadores?.nombre || 'Desconocido'}</span>
                                                        {move.venta_id && (
                                                            <span className="text-[9px] font-bold px-2 py-0.5 rounded bg-blue-500/10 text-blue-400">Venta ↱</span>
                                                        )}
                                                    </div>
                                                    {/* Fase 2: Expanded sale detail mobile */}
                                                    {expandedMovementId === move.id && (
                                                        <div className="mt-2 bg-zinc-950/60 border border-zinc-800/50 rounded-xl p-3 space-y-2 animate-fadeIn">
                                                            {expandedMovementLoading ? (
                                                                <div className="text-zinc-500 text-xs flex items-center gap-2"><svg className="animate-spin w-4 h-4 text-fire" viewBox="0 0 24 24" fill="none"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" /></svg> Cargando...</div>
                                                            ) : expandedMovementSale ? (
                                                                <div className="space-y-2 text-xs">
                                                                    <p className="text-zinc-400">👤 {expandedMovementSale.clientes?.nombre || 'Sin cliente'}
                                                                        {expandedMovementSale._allClients?.length > 1 && (
                                                                            <span className="text-zinc-500"> + {expandedMovementSale._allClients.length - 1} más</span>
                                                                        )}
                                                                    </p>
                                                                    {(expandedMovementSale.detalles?.items || []).map((item, idx) => (
                                                                        <div key={idx} className="flex justify-between">
                                                                            <span className="text-zinc-300">{item.nombre || item.name} × {item.cantidad || item.quantity || 1}</span>
                                                                            <span className="text-zinc-200 font-bold">${(Number(item.precio || item.price || 0) * Number(item.cantidad || item.quantity || 1)).toLocaleString()}</span>
                                                                        </div>
                                                                    ))}
                                                                    {Number(expandedMovementSale._descuento || 0) > 0 && (
                                                                        <div className="flex justify-between"><span className="text-zinc-500">Descuento</span><span className="text-red-400">-${Number(expandedMovementSale._descuento).toLocaleString()}</span></div>
                                                                    )}
                                                                    {/* Mixed payment breakdown (mobile) */}
                                                                    {expandedMovementSale.metodo_pago === 'MIXTO' && expandedMovementSale._paymentBreakdown?.length > 0 && (
                                                                        <div className="space-y-0.5 border-t border-zinc-800 pt-1">
                                                                            {expandedMovementSale._paymentBreakdown.map((pb, i) => (
                                                                                <div key={i} className="flex justify-between text-[10px]"><span className="text-zinc-500">{pb.metodo_pago}</span><span className="text-zinc-300">${Number(pb.monto).toLocaleString()}</span></div>
                                                                            ))}
                                                                        </div>
                                                                    )}
                                                                    <div className="flex justify-between font-bold border-t border-zinc-800 pt-1"><span className="text-zinc-300">Total</span><span className="text-fire">${Number(expandedMovementSale.total).toLocaleString()}</span></div>
                                                                    <button
                                                                        onClick={() => { setActiveTab('ventas'); setExpandedSaleId(expandedMovementSale.id); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
                                                                        className="w-full mt-1 text-[10px] font-bold px-3 py-2 rounded-lg bg-blue-500/10 text-blue-400 hover:bg-blue-500/20"
                                                                    >
                                                                        Ver venta completa ↱
                                                                    </button>
                                                                </div>
                                                            ) : (
                                                                <p className="text-zinc-500 text-xs">{move.venta_id ? 'No se pudo cargar' : 'Movimiento sin venta vinculada'}</p>
                                                            )}
                                                        </div>
                                                    )}
                                                </div>
                                            ))}
                                        </div>
                                    </>
                                );
                            })()}

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
                            <p className="text-zinc-500 text-sm mt-1">
                                Todos los rubros se calculan en el servidor sobre el <span className="text-zinc-300">mismo rango de fechas</span> seleccionado arriba
                            </p>
                        </div>

                        {pnlLoading && (
                            <div className="bg-zinc-900 border border-zinc-800/60 rounded-2xl p-10 text-center">
                                <RefreshCw size={22} className="animate-spin text-fire mx-auto mb-3" />
                                <p className="text-zinc-400 text-sm">Calculando estado de resultados...</p>
                            </div>
                        )}

                        {/* A4: un fallo se muestra como fallo, nunca como ceros contables */}
                        {!pnlLoading && pnlError && (
                            <div className="bg-red-500/5 border border-red-500/40 rounded-2xl p-6">
                                <div className="flex items-start gap-3">
                                    <AlertTriangle className="text-red-400 shrink-0 mt-0.5" size={20} />
                                    <div className="flex-1">
                                        <h3 className="font-bold text-red-300 text-sm">No se pudo calcular el estado de resultados</h3>
                                        <p className="text-zinc-400 text-xs mt-1">{pnlError}</p>
                                        <p className="text-zinc-500 text-[10px] mt-2">
                                            No se muestran cifras parciales a proposito: un informe incompleto es peor que ninguno.
                                        </p>
                                        <button
                                            onClick={fetchEstadoResultados}
                                            className="mt-3 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 px-4 py-2 rounded-lg text-[10px] font-bold uppercase tracking-wider border border-zinc-700"
                                        >
                                            Reintentar
                                        </button>
                                    </div>
                                </div>
                            </div>
                        )}

                        {!pnlLoading && !pnlError && pnl && (() => {
                            const fmt = (n) => `$${Math.round(Number(n || 0)).toLocaleString()}`;
                            const v = pnl.ventas || {};
                            const c = pnl.cogs || {};
                            const e = pnl.egresos || {};
                            const f = pnl.fuera_del_resultado || {};
                            const r = pnl.resultados || {};
                            const per = pnl.periodo || {};
                            const avisos = pnl.advertencias || [];
                            const detalle = pnl.detalle_costos || [];

                            return (
                                <div className="space-y-6">
                                    {/* Advertencias del motor contable */}
                                    {avisos.length > 0 && (
                                        <div className="bg-yellow-500/5 border border-yellow-500/40 rounded-2xl p-5">
                                            <div className="flex items-center gap-2 mb-3">
                                                <AlertTriangle className="text-yellow-400" size={16} />
                                                <h3 className="font-bold text-yellow-300 text-[10px] uppercase tracking-widest">
                                                    Advertencias sobre la confiabilidad de estas cifras
                                                </h3>
                                            </div>
                                            <ul className="space-y-2">
                                                {avisos.map((a, idx) => (
                                                    <li key={idx} className="text-xs text-zinc-300 leading-relaxed flex gap-2">
                                                        <span className="text-yellow-500 shrink-0">•</span>
                                                        <span>{a}</span>
                                                    </li>
                                                ))}
                                            </ul>
                                        </div>
                                    )}

                                    {/* Periodo efectivo */}
                                    <div className="flex items-center gap-2 text-[10px] text-zinc-500 uppercase tracking-widest font-bold">
                                        <Calendar size={12} />
                                        Periodo: {new Date(per.desde).toLocaleDateString('es-CO')} — {new Date(per.hasta).toLocaleDateString('es-CO')}
                                        <span className="text-zinc-600">({per.dias} {Number(per.dias) === 1 ? 'dia' : 'dias'})</span>
                                    </div>

                                    {/* KPIs */}
                                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
                                        <div className="bg-zinc-900 border border-green-500/30 p-5 rounded-2xl shadow-lg">
                                            <p className="text-green-400 text-[10px] uppercase tracking-widest font-bold mb-1">Ingresos por Ventas</p>
                                            <h3 className="text-2xl font-bold text-white">{fmt(v.neto)}</h3>
                                            <span className="text-[10px] text-zinc-400 bg-zinc-950/50 inline-block px-2 py-0.5 rounded mt-2">
                                                {v.num_ventas} ventas · ticket {fmt(v.ticket_promedio)}
                                            </span>
                                        </div>

                                        <div className={`bg-zinc-900 border p-5 rounded-2xl shadow-lg ${c.es_completo ? 'border-fire/40' : 'border-yellow-500/50'}`}>
                                            <p className="text-fire text-[10px] uppercase tracking-widest font-bold mb-1">Costo de Ventas (COGS)</p>
                                            <h3 className="text-2xl font-bold text-white">{fmt(c.snapshot)}</h3>
                                            {c.es_completo ? (
                                                <span className="text-[10px] text-zinc-400 bg-zinc-950/50 inline-block px-2 py-0.5 rounded mt-2">
                                                    Costo historico inmutable
                                                </span>
                                            ) : (
                                                <span className="text-[10px] text-yellow-300 bg-yellow-500/10 inline-block px-2 py-0.5 rounded mt-2">
                                                    Incompleto: {c.movimientos_sin_snapshot} movs. sin costo
                                                </span>
                                            )}
                                        </div>

                                        <div className="bg-zinc-900 border border-gold/40 p-5 rounded-2xl shadow-lg">
                                            <p className="text-gold text-[10px] uppercase tracking-widest font-bold mb-1">Utilidad Bruta</p>
                                            <h3 className="text-2xl font-bold text-gold">{fmt(r.utilidad_bruta)}</h3>
                                            <span className="text-[10px] text-yellow-300/60 bg-gold/10 inline-block px-2 py-0.5 rounded mt-2">
                                                Margen bruto: {r.margen_bruto_pct}%
                                            </span>
                                        </div>

                                        <div className="bg-zinc-900 border border-red-500/30 p-5 rounded-2xl shadow-lg">
                                            <p className="text-red-400 text-[10px] uppercase tracking-widest font-bold mb-1">Egresos del Periodo</p>
                                            <h3 className="text-2xl font-bold text-red-400">{fmt(e.total)}</h3>
                                            <span className="text-[10px] text-zinc-400 bg-zinc-950/50 inline-block px-2 py-0.5 rounded mt-2">
                                                Nomina + gastos + costos fijos y variables
                                            </span>
                                        </div>

                                        <div className="bg-zinc-900 border border-blue-500/40 p-5 rounded-2xl shadow-lg">
                                            <p className="text-blue-400 text-[10px] uppercase tracking-widest font-bold mb-1">Resultado Operativo</p>
                                            <h3 className={`text-2xl font-bold ${Number(r.resultado_operativo) >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                                                {fmt(r.resultado_operativo)}
                                            </h3>
                                            <span className="text-[10px] text-blue-300/60 bg-blue-500/10 inline-block px-2 py-0.5 rounded mt-2">
                                                Margen contribucion: {r.margen_contribucion_pct}%
                                            </span>
                                        </div>
                                    </div>

                                    {/* Estado de Resultados en cascada */}
                                    <div className="bg-zinc-900 border border-zinc-800/60 rounded-2xl overflow-hidden shadow-2xl">
                                        <div className="p-5 border-b border-zinc-800 bg-zinc-950/40">
                                            <h3 className="font-serif font-bold text-white text-lg">Estado de Resultados</h3>
                                            <p className="text-[10px] text-zinc-500 mt-0.5">Calculado por el servidor · un solo periodo para todos los rubros</p>
                                        </div>
                                        <div className="p-6 space-y-1">
                                            {[
                                                { l: '(+) Ingresos por ventas', val: v.neto, cls: 'text-green-400', strong: true },
                                                { l: '(-) Costo de ventas (COGS)', val: -Number(c.snapshot || 0), cls: 'text-fire' },
                                                { l: '(=) UTILIDAD BRUTA', val: r.utilidad_bruta, cls: 'text-gold', divider: true, strong: true },
                                                { l: '(-) Nomina pagada', val: -Number(e.nomina_pagada || 0), cls: 'text-red-400' },
                                                { l: '(-) Gastos operativos', val: -Number(e.gastos_operativos || 0), cls: 'text-red-400' },
                                                { l: '(-) Otros egresos de caja', val: -Number(e.otros_egresos_caja || 0), cls: 'text-red-400' },
                                                { l: `(-) Costos fijos (prorrateados a ${per.dias}d)`, val: -Number(e.costos_fijos || 0), cls: 'text-red-400' },
                                                { l: `(-) Costos variables (prorrateados a ${per.dias}d)`, val: -Number(e.costos_variables || 0), cls: 'text-red-400' },
                                            ].map((row, idx) => (
                                                <div
                                                    key={idx}
                                                    className={`flex justify-between items-center py-2.5 text-sm ${row.divider ? 'border-y border-zinc-700 my-2 bg-zinc-950/40 px-3 rounded' : 'border-b border-zinc-800/60'}`}
                                                >
                                                    <span className={row.strong ? 'font-bold text-zinc-100' : 'font-semibold text-zinc-300'}>{row.l}</span>
                                                    <span className={`font-bold font-mono ${row.cls}`}>{fmt(row.val)}</span>
                                                </div>
                                            ))}
                                            <div className="flex justify-between items-center py-4 bg-zinc-950 px-4 rounded-xl text-lg font-bold border border-zinc-800 mt-3">
                                                <span className="text-white">(=) RESULTADO OPERATIVO</span>
                                                <span className={`font-mono ${Number(r.resultado_operativo) >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                                                    {fmt(r.resultado_operativo)}
                                                </span>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Fuera del resultado */}
                                    {(Number(f.retiros_socios) > 0 || Number(f.compras_recibidas) > 0 || Number(e.nomina_pendiente) > 0) && (
                                        <div className="bg-zinc-900 border border-zinc-800/60 rounded-2xl overflow-hidden">
                                            <div className="p-5 border-b border-zinc-800 bg-zinc-950/40">
                                                <h3 className="font-serif font-bold text-white text-base">Movimientos fuera del Estado de Resultados</h3>
                                                <p className="text-[10px] text-zinc-500 mt-0.5">Salen de caja, pero no son gastos operativos del periodo</p>
                                            </div>
                                            <div className="p-5 space-y-2">
                                                {Number(f.retiros_socios) > 0 && (
                                                    <div className="flex justify-between items-start gap-4 text-xs py-2 border-b border-zinc-800/60">
                                                        <div>
                                                            <span className="text-zinc-200 font-semibold">Retiros de socios</span>
                                                            <p className="text-zinc-500 text-[10px] mt-0.5">Distribucion de utilidades, no un gasto. Antes se restaba del resultado.</p>
                                                        </div>
                                                        <span className="font-mono font-bold text-purple-400 shrink-0">{fmt(f.retiros_socios)}</span>
                                                    </div>
                                                )}
                                                {Number(f.compras_recibidas) > 0 && (
                                                    <div className="flex justify-between items-start gap-4 text-xs py-2 border-b border-zinc-800/60">
                                                        <div>
                                                            <span className="text-zinc-200 font-semibold">Compras recibidas</span>
                                                            <p className="text-zinc-500 text-[10px] mt-0.5">Se convierten en inventario; impactan el resultado como COGS al venderse.</p>
                                                        </div>
                                                        <span className="font-mono font-bold text-blue-400 shrink-0">{fmt(f.compras_recibidas)}</span>
                                                    </div>
                                                )}
                                                {Number(e.nomina_pendiente) > 0 && (
                                                    <div className="flex justify-between items-start gap-4 text-xs py-2">
                                                        <div>
                                                            <span className="text-zinc-200 font-semibold">Liquidaciones pendientes</span>
                                                            <p className="text-zinc-500 text-[10px] mt-0.5">Generadas pero aun no pagadas. No restadas del resultado.</p>
                                                        </div>
                                                        <span className="font-mono font-bold text-yellow-400 shrink-0">{fmt(e.nomina_pendiente)}</span>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    )}

                                    {/* Punto de equilibrio y detalle de costos */}
                                    <div className="bg-zinc-900 border border-zinc-800/60 rounded-2xl overflow-hidden shadow-2xl">
                                        <div className="p-5 border-b border-zinc-800 bg-zinc-950/40 flex justify-between items-center flex-wrap gap-2">
                                            <h3 className="font-serif font-bold text-white text-lg">Punto de Equilibrio</h3>
                                            <button onClick={() => setActiveTab('configuracion')} className="text-[10px] font-bold uppercase text-fire hover:text-orange-300 transition-colors">
                                                Configurar costos →
                                            </button>
                                        </div>
                                        <div className="p-6 space-y-4">
                                            {!r.punto_equilibrio_calculable ? (
                                                <p className="text-zinc-500 text-sm text-center py-4">
                                                    No calculable: se requieren ventas y un margen de contribucion positivo en el periodo.
                                                </p>
                                            ) : (
                                                <div className={`rounded-xl p-5 border ${r.supera_equilibrio ? 'border-green-500/30 bg-green-500/5' : 'border-fire/30 bg-fire/5'}`}>
                                                    <div className="flex items-center justify-between flex-wrap gap-3">
                                                        <div>
                                                            <p className="text-[10px] font-bold uppercase tracking-widest text-fire mb-1">Ventas necesarias para cubrir costos fijos</p>
                                                            <p className="text-2xl font-bold text-white font-mono">{fmt(r.punto_equilibrio)}</p>
                                                            <p className="text-[10px] text-zinc-400 mt-1">
                                                                Con margen de contribucion de {r.margen_contribucion_pct}% ({fmt(r.margen_contribucion)})
                                                            </p>
                                                        </div>
                                                        <div className="text-right">
                                                            <p className={`text-lg font-bold ${r.supera_equilibrio ? 'text-green-400' : 'text-red-400'}`}>
                                                                {r.supera_equilibrio ? 'SUPERADO' : 'POR DEBAJO'}
                                                            </p>
                                                            <p className="text-[10px] text-zinc-400">Ventas del periodo: {fmt(v.neto)}</p>
                                                        </div>
                                                    </div>
                                                </div>
                                            )}

                                            {detalle.length > 0 ? (
                                                <div className="space-y-1.5">
                                                    <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-500 mb-2">
                                                        Costos vigentes en el periodo
                                                    </p>
                                                    {detalle.map((d, idx) => (
                                                        <div key={idx} className="flex justify-between items-center gap-3 text-xs px-3 py-2 rounded-lg bg-zinc-950/50">
                                                            <span className="text-zinc-400 min-w-0">
                                                                <span className={`font-bold ${d.tipo === 'FIJO' ? 'text-blue-400' : 'text-orange-400'}`}>{d.tipo}</span>
                                                                {' · '}{d.nombre}
                                                                <span className="text-zinc-600"> ({d.periodicidad})</span>
                                                            </span>
                                                            <span className="font-mono text-zinc-300 shrink-0 text-right">
                                                                {fmt(d.monto_base)}
                                                                <span className="text-zinc-600"> × {d.dias_vigentes}d → </span>
                                                                <span className="font-bold">{fmt(d.monto_periodo)}</span>
                                                            </span>
                                                        </div>
                                                    ))}
                                                </div>
                                            ) : (
                                                <p className="text-zinc-600 text-xs text-center py-2">
                                                    No hay costos fijos ni variables vigentes en este periodo.
                                                </p>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            );
                        })()}
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
                        {/* ── TURNOS: asistencia explicita y fuente oficial de la nomina ── */}
                        <div className="bg-zinc-900 border border-fire/30 rounded-2xl overflow-hidden shadow-2xl">
                            <div className="p-5 border-b border-zinc-800 bg-zinc-950/40">
                                <h2 className="font-serif font-bold text-white text-lg flex items-center gap-2">
                                    <Clock size={18} className="text-fire" />
                                    Turnos trabajados
                                </h2>
                                <p className="text-[10px] text-zinc-500 mt-1">
                                    Un turno = un día efectivamente trabajado. Al cerrarlo se paga de inmediato y queda
                                    registrado para que no se pague dos veces el mismo día.
                                </p>
                            </div>

                            {/* Cerrar turno de hoy, por trabajador */}
                            <div className="p-5 border-b border-zinc-800/60 space-y-3">
                                {staffList.filter(m => m.rol === 'TRABAJADOR' && m.estado === 'ACTIVO').length === 0 ? (
                                    <p className="text-zinc-500 text-xs">No hay trabajadores activos. Los turnos son solo para perfiles con rol TRABAJADOR.</p>
                                ) : staffList.filter(m => m.rol === 'TRABAJADOR' && m.estado === 'ACTIVO').map(m => {
                                    const hoy = hoyBogota();
                                    const yaHoy = (turnosData?.turnos || []).find(
                                        t => t.trabajador_id === m.id && t.fecha === hoy && t.estado !== 'ANULADO'
                                    );
                                    const sinTarifa = !Number(m.tarifa_pago);
                                    return (
                                        <div key={m.id} className="flex flex-wrap items-center justify-between gap-3 bg-zinc-950/50 rounded-xl p-4">
                                            <div>
                                                <p className="font-bold text-zinc-100 text-sm">{m.nombre}</p>
                                                <p className="text-[10px] text-zinc-500 mt-0.5">
                                                    {sinTarifa
                                                        ? 'Sin tarifa por turno configurada'
                                                        : `$${Number(m.tarifa_pago).toLocaleString()} por turno · hoy ${hoy}`}
                                                </p>
                                            </div>
                                            {yaHoy ? (
                                                <span className={`text-[10px] font-bold uppercase tracking-wider px-3 py-2 rounded-lg ${
                                                    yaHoy.estado === 'PAGADO'
                                                        ? 'bg-green-500/10 text-green-400 border border-green-500/30'
                                                        : 'bg-yellow-500/10 text-yellow-400 border border-yellow-500/30'
                                                }`}>
                                                    {yaHoy.estado === 'PAGADO' ? 'Turno de hoy ya pagado' : 'Turno de hoy registrado, sin pagar'}
                                                </span>
                                            ) : (
                                                <button
                                                    onClick={() => handleCerrarYPagarTurno(m)}
                                                    disabled={turnoSubmitting || sinTarifa}
                                                    className="bg-fire hover:bg-orange-700 disabled:opacity-40 disabled:cursor-not-allowed text-white px-4 py-2.5 rounded-xl text-xs font-bold uppercase tracking-wider flex items-center gap-2 transition-colors"
                                                    title={sinTarifa ? 'Configure la tarifa por turno en la pestaña Trabajadores' : ''}
                                                >
                                                    <Check size={14} />
                                                    Cerrar turno y pagar {sinTarifa ? '' : `$${Number(m.tarifa_pago).toLocaleString()}`}
                                                </button>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>

                            {/* Historial de los ultimos 30 dias */}
                            <div className="p-5">
                                {turnosLoading ? (
                                    <p className="text-zinc-500 text-xs text-center py-3">Cargando turnos...</p>
                                ) : turnosError ? (
                                    <div className="bg-red-500/5 border border-red-500/30 rounded-xl p-4">
                                        <p className="text-red-300 text-xs font-bold">No se pudieron cargar los turnos</p>
                                        <p className="text-zinc-400 text-[10px] mt-1">{turnosError}</p>
                                        <button onClick={fetchTurnos} className="mt-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 px-3 py-1.5 rounded text-[10px] font-bold uppercase">
                                            Reintentar
                                        </button>
                                    </div>
                                ) : (
                                    <>
                                        <div className="flex flex-wrap gap-4 mb-4 text-xs">
                                            <span className="text-zinc-400">
                                                Últimos 30 días:
                                                <span className="text-green-400 font-bold ml-1">{turnosData?.turnos_pagados || 0} pagados</span>
                                                <span className="text-zinc-600 mx-1">·</span>
                                                <span className="font-mono font-bold text-zinc-200">${Number(turnosData?.total_pagado || 0).toLocaleString()}</span>
                                            </span>
                                            {Number(turnosData?.turnos_pendientes) > 0 && (
                                                <span className="text-yellow-400">
                                                    {turnosData.turnos_pendientes} sin pagar · ${Number(turnosData.total_pendiente).toLocaleString()}
                                                </span>
                                            )}
                                        </div>
                                        {(turnosData?.turnos || []).length === 0 ? (
                                            <p className="text-zinc-600 text-xs text-center py-3">
                                                Aún no hay turnos registrados en los últimos 30 días.
                                            </p>
                                        ) : (
                                            <div className="space-y-1.5 max-h-80 overflow-y-auto">
                                                {turnosData.turnos.map(t => (
                                                    <div key={t.id} className="flex flex-wrap items-center justify-between gap-2 text-xs px-3 py-2 rounded-lg bg-zinc-950/50">
                                                        <span className="text-zinc-300 font-mono">{t.fecha}</span>
                                                        <span className="text-zinc-400 flex-1 min-w-[120px]">{t.trabajador}</span>
                                                        <span className="font-mono font-bold text-zinc-200">${Number(t.tarifa_aplicada).toLocaleString()}</span>
                                                        <span className={`text-[9px] font-bold px-2 py-0.5 rounded uppercase ${
                                                            t.estado === 'PAGADO'     ? 'bg-green-500/10 text-green-400'
                                                          : t.estado === 'REGISTRADO' ? 'bg-yellow-500/10 text-yellow-400'
                                                          :                            'bg-zinc-800 text-zinc-500'
                                                        }`}>{t.estado}</span>
                                                        {t.estado === 'REGISTRADO' && (
                                                            <button
                                                                onClick={() => handleAnularTurno(t)}
                                                                disabled={turnoSubmitting}
                                                                className="text-[9px] font-bold uppercase text-red-400 hover:text-red-300 px-2"
                                                            >
                                                                Anular
                                                            </button>
                                                        )}
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </>
                                )}
                            </div>
                        </div>

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
                                                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded uppercase ${liq.estado === 'PAGADO' ? 'bg-green-500/10 text-green-400' :
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
                                                <span className={`text-[10px] font-bold px-2 py-0.5 rounded uppercase ${liq.estado === 'PAGADO' ? 'bg-green-500/10 text-green-400' :
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
                                                        <span className={`inline-block px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${g.estado === 'REGISTRADO'
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
                                        {member.rol === 'TRABAJADOR' && (
                                            <div className="flex justify-between items-center">
                                                <span className="text-zinc-500">Pago por turno:</span>
                                                <span className={`font-mono font-bold ${Number(member.tarifa_pago) > 0 ? 'text-green-400' : 'text-yellow-400'}`}>
                                                    {Number(member.tarifa_pago) > 0
                                                        ? `$${Number(member.tarifa_pago).toLocaleString()}`
                                                        : 'sin configurar'}
                                                </span>
                                            </div>
                                        )}
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
                                            {member.rol === 'TRABAJADOR' && (
                                                <button
                                                    onClick={() => { setTarifaForm(Number(member.tarifa_pago) || 0); setShowTarifaModal(member); }}
                                                    disabled={actionLoading}
                                                    className="flex-1 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 py-1.5 rounded text-[10px] font-bold uppercase tracking-wider disabled:opacity-50"
                                                >
                                                    Tarifa
                                                </button>
                                            )}
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

                        {/* Cost Configuration Section */}
                        <div className="bg-zinc-900 border border-zinc-800 p-6 rounded-2xl space-y-4">
                            <div className="flex justify-between items-center">
                                <h3 className="font-bold text-sm text-zinc-200">Configuración de Costos Fijos / Variables</h3>
                                <button onClick={() => { setEditingCosto(null); setCostoForm({ nombre: '', descripcion: '', tipo_costo: 'FIJO', categoria: 'OTROS', monto: '', periodicidad: 'MENSUAL' }); setShowCostoModal(true); }} className="text-[10px] font-bold uppercase bg-fire/20 text-fire hover:bg-fire/30 px-3 py-1.5 rounded-lg transition-colors">+ Nuevo Costo</button>
                            </div>

                            {costosList.length === 0 && (
                                <p className="text-zinc-500 text-xs text-center py-4">No hay costos configurados. Agrega costos fijos y variables para calcular rentabilidad y punto de equilibrio.</p>
                            )}

                            {/* Costos Fijos */}
                            {costosList.filter(c => c.tipo_costo === 'FIJO').length > 0 && (
                                <div className="space-y-2">
                                    <p className="text-[10px] font-bold uppercase tracking-widest text-blue-400">Costos Fijos</p>
                                    {costosList.filter(c => c.tipo_costo === 'FIJO').map(c => (
                                        <div key={c.id} className={`flex items-center justify-between p-3 rounded-lg border ${c.activo ? 'bg-zinc-950 border-zinc-800' : 'bg-zinc-950/50 border-zinc-800/50 opacity-60'}`}>
                                            <div>
                                                <p className="text-xs font-bold text-zinc-200">{c.nombre} <span className="text-[10px] text-zinc-500 font-normal">({c.categoria})</span></p>
                                                {c.descripcion && <p className="text-[10px] text-zinc-500">{c.descripcion}</p>}
                                                <p className="text-[10px] text-zinc-400">${Number(c.monto).toLocaleString()} / {c.periodicidad}</p>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <button onClick={() => { setEditingCosto(c.id); setCostoForm({ nombre: c.nombre, descripcion: c.descripcion || '', tipo_costo: c.tipo_costo, categoria: c.categoria, monto: c.monto, periodicidad: c.periodicidad }); setShowCostoModal(true); }} className="text-[10px] text-zinc-400 hover:text-white transition-colors">Editar</button>
                                                <button onClick={() => handleToggleCosto(c)} disabled={actionLoading} className={`text-[10px] font-bold px-2 py-0.5 rounded ${c.activo ? 'bg-red-500/10 text-red-400' : 'bg-green-500/10 text-green-400'}`}>{c.activo ? 'Desactivar' : 'Activar'}</button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}

                            {/* Costos Variables */}
                            {costosList.filter(c => c.tipo_costo === 'VARIABLE').length > 0 && (
                                <div className="space-y-2">
                                    <p className="text-[10px] font-bold uppercase tracking-widest text-orange-400">Costos Variables</p>
                                    {costosList.filter(c => c.tipo_costo === 'VARIABLE').map(c => (
                                        <div key={c.id} className={`flex items-center justify-between p-3 rounded-lg border ${c.activo ? 'bg-zinc-950 border-zinc-800' : 'bg-zinc-950/50 border-zinc-800/50 opacity-60'}`}>
                                            <div>
                                                <p className="text-xs font-bold text-zinc-200">{c.nombre} <span className="text-[10px] text-zinc-500 font-normal">({c.categoria})</span></p>
                                                {c.descripcion && <p className="text-[10px] text-zinc-500">{c.descripcion}</p>}
                                                <p className="text-[10px] text-zinc-400">${Number(c.monto).toLocaleString()} / {c.periodicidad}</p>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <button onClick={() => { setEditingCosto(c.id); setCostoForm({ nombre: c.nombre, descripcion: c.descripcion || '', tipo_costo: c.tipo_costo, categoria: c.categoria, monto: c.monto, periodicidad: c.periodicidad }); setShowCostoModal(true); }} className="text-[10px] text-zinc-400 hover:text-white transition-colors">Editar</button>
                                                <button onClick={() => handleToggleCosto(c)} disabled={actionLoading} className={`text-[10px] font-bold px-2 py-0.5 rounded ${c.activo ? 'bg-red-500/10 text-red-400' : 'bg-green-500/10 text-green-400'}`}>{c.activo ? 'Desactivar' : 'Activar'}</button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
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
                                        <NumericInput
                                            className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-sm text-white focus:border-fire outline-none"
                                            value={productoForm.precio}
                                            onChange={val => setProductoForm(p => ({ ...p, precio: val }))}
                                        />
                                    </div>
                                    <div>
                                        <label className="text-[10px] uppercase tracking-wider font-bold text-zinc-400 block mb-1">Orden (número)</label>
                                        <NumericInput
                                            className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-sm text-white focus:border-fire outline-none"
                                            value={productoForm.orden}
                                            onChange={val => setProductoForm(p => ({ ...p, orden: val }))}
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
                                <h1 className="text-3xl font-serif text-white">Inventario</h1>
                                <p className="text-zinc-500 text-sm mt-1">Control de insumos, stock y fichas técnicas de productos</p>
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
                                            /* selectedDetail reset handled separately */
                                        }}
                                        className="flex items-center gap-2 bg-fire text-white px-4 py-2 rounded-lg text-sm font-bold shadow-lg shadow-fire/10 hover:bg-orange-700 transition-all uppercase tracking-wider"
                                    >
                                        <Plus size={16} />
                                        Nuevo Insumo
                                    </button>
                                </div>
                            )}
                        </div>

                        {/* Fase 2 Bloque 7 & 8: Sub-tab navigation */}
                        <div className="flex gap-1 bg-zinc-900 p-1 rounded-xl w-full max-w-full overflow-x-auto border border-zinc-800 scrollbar-hide">
                            {[
                                { key: 'insumos', label: '📦 Insumos' },
                                { key: 'recetas', label: '🍔 Recetas' },
                                { key: 'compras', label: '🛒 Compras' },
                                { key: 'mermas', label: '📉 Mermas' },
                            ].map(tab => (
                                <button
                                    key={tab.key}
                                    onClick={() => setInventarioSubTab(tab.key)}
                                    className={`px-4 py-2.5 rounded-lg text-xs font-bold transition-all whitespace-nowrap flex-shrink-0 ${inventarioSubTab === tab.key
                                            ? 'bg-fire text-white shadow shadow-fire/15'
                                            : 'text-zinc-400 hover:text-white hover:bg-zinc-800'
                                        }`}
                                >
                                    {tab.label}
                                </button>
                            ))}
                        </div>

                        {/* Sub-tab: Insumos */}
                        {inventarioSubTab === 'insumos' && (<>

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
                                            <NumericInput
                                                allowDecimals
                                                className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-sm text-white focus:border-fire outline-none"
                                                value={insumoForm.costo_unitario}
                                                onChange={val => setInsumoForm(p => ({ ...p, costo_unitario: val }))}
                                            />
                                        </div>
                                        <div>
                                            <label className="text-[10px] uppercase tracking-wider font-bold text-zinc-400 block mb-1">Stock Actual</label>
                                            <NumericInput
                                                allowDecimals
                                                className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-sm text-white focus:border-fire outline-none"
                                                disabled={editingInsumo !== 'new'}
                                                value={insumoForm.stock_actual}
                                                onChange={val => setInsumoForm(p => ({ ...p, stock_actual: val }))}
                                            />
                                            {editingInsumo !== 'new' && (
                                                <p className="text-[9px] text-zinc-600 mt-1 leading-snug">
                                                    El stock no se edita aquí. Use el botón de movimiento del insumo: así queda
                                                    registrado en el historial y no se pisa una venta del POS.
                                                </p>
                                            )}
                                        </div>
                                        <div>
                                            <label className="text-[10px] uppercase tracking-wider font-bold text-zinc-400 block mb-1">Alerta Stock Mínimo</label>
                                            <NumericInput
                                                allowDecimals
                                                className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-sm text-white focus:border-fire outline-none"
                                                value={insumoForm.stock_minimo}
                                                onChange={val => setInsumoForm(p => ({ ...p, stock_minimo: val }))}
                                            />
                                        </div>
                                        {editingInsumo !== 'new' && (
                                            <div className="sm:col-span-2 bg-zinc-950/50 border border-zinc-800 rounded-lg p-3">
                                                <label className="text-[10px] uppercase tracking-wider font-bold text-zinc-400 block mb-1">Costo Total en Inventario</label>
                                                <div className="flex items-baseline gap-2">
                                                    <p className="text-lg font-mono font-bold text-amber-400">
                                                        ${Math.round(Number(insumoForm.stock_actual || 0) * Number(insumoForm.costo_unitario || 0)).toLocaleString()}
                                                    </p>
                                                    <p className="text-[10px] text-zinc-500">
                                                        ({Number(insumoForm.stock_actual || 0).toLocaleString()} × ${Number(insumoForm.costo_unitario || 0).toLocaleString()})
                                                    </p>
                                                </div>
                                            </div>
                                        )}
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
                                            className={`px-3 py-2 rounded-xl text-xs font-bold transition-colors ${insumoFilter === val
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
                                    const ok = insumosList.filter(i => Number(i.stock_actual) > Number(i.stock_minimo) && i.activo);
                                    const inactivos = insumosList.filter(i => !i.activo);

                                    let listaActivos = insumoFilter === 'agotados' ? agotados
                                        : insumoFilter === 'bajos' ? bajos
                                            : [...agotados, ...bajos, ...ok];
                                            
                                    let listaInactivos = inactivos;

                                    const isSearching = insumoSearch.trim().length > 0;
                                    if (isSearching) {
                                        const q = insumoSearch.toLowerCase();
                                        listaActivos = listaActivos.filter(i => i.nombre.toLowerCase().includes(q));
                                        listaInactivos = listaInactivos.filter(i => i.nombre.toLowerCase().includes(q));
                                    }

                                    if (listaActivos.length === 0 && listaInactivos.length === 0) {
                                        return <div className="p-10 text-center text-zinc-500 text-sm">Sin resultados</div>;
                                    }

                                    const renderCard = (ins) => {
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
                                                                onClick={() => { setShowAjusteModal(ins); setAjusteForm({ tipo: 'AJUSTE_MAS', cantidad: 0, motivo: '', idemKey: crypto.randomUUID() }); }}
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
                                                                    className={`h-9 px-2.5 rounded-xl text-xs font-bold transition-colors ${ins.activo ? 'bg-red-950/20 text-red-400 hover:bg-red-950/40' : 'bg-green-950/20 text-green-400 hover:bg-green-950/40'
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
                                    };

                                    return (
                                        <>
                                            {listaActivos.length > 0 && (
                                                <div className="space-y-2">
                                                    {listaActivos.map(renderCard)}
                                                </div>
                                            )}
                                            
                                            {listaInactivos.length > 0 && (
                                                isSearching ? (
                                                    <div className="space-y-2 mt-4">
                                                        <h3 className="text-zinc-500 font-bold text-xs uppercase tracking-wider mb-2 ml-1">Insumos Apagados / Inactivos</h3>
                                                        {listaInactivos.map(renderCard)}
                                                    </div>
                                                ) : (
                                                    <details className="mt-4 bg-zinc-900/30 border border-zinc-800/60 rounded-2xl overflow-hidden [&_summary::-webkit-details-marker]:hidden group">
                                                        <summary className="p-4 cursor-pointer flex items-center justify-between hover:bg-zinc-800/50 transition-colors list-none select-none">
                                                            <div className="flex items-center gap-2">
                                                                <span className="w-2 h-2 rounded-full shrink-0 bg-zinc-600" />
                                                                <span className="font-bold text-xs uppercase tracking-wider text-zinc-400">
                                                                    Insumos Apagados / Inactivos ({listaInactivos.length})
                                                                </span>
                                                            </div>
                                                            <ChevronDown size={16} className="text-zinc-500 transition-transform duration-200 group-open:rotate-180" />
                                                        </summary>
                                                        <div className="p-4 pt-0 space-y-2 border-t border-zinc-800/60 bg-zinc-950/20">
                                                            {listaInactivos.map(renderCard)}
                                                        </div>
                                                    </details>
                                                )
                                            )}
                                        </>
                                    );
                                })()}
                            </div>
                        </>)}

                        {/* Sub-tab: Recetas — Fase 2 Bloque 7 */}
                        {inventarioSubTab === 'recetas' && (
                            <div className="space-y-4 pt-2">
                                {/* Configuración Global de Pricing (Solo Socios) */}
                                {currentUserProfile?.es_socio && (() => {
                                    const multiConfig = costosList.find(c => c.tipo_costo === 'MULTIPLICADOR');
                                    const impConfig = costosList.find(c => c.tipo_costo === 'IMPUESTO');
                                    return (
                                        <details className="bg-zinc-900 border border-zinc-800/60 rounded-2xl overflow-hidden">
                                            <summary className="p-4 cursor-pointer flex items-center justify-between hover:bg-zinc-800/30 transition-colors list-none [&::-webkit-details-marker]:hidden">
                                                <div className="flex items-center gap-2">
                                                    <Settings size={16} className="text-fire" />
                                                    <span className="font-bold text-xs uppercase tracking-wider text-zinc-300">Configuración de Precios</span>
                                                </div>
                                                <ChevronDown size={14} className="text-zinc-500" />
                                            </summary>
                                            <div className="p-4 pt-2 border-t border-zinc-850 bg-zinc-950/40">
                                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                                    <div>
                                                        <label className="text-[10px] uppercase tracking-wider font-bold text-zinc-400 block mb-1.5">Multiplicador de Precio</label>
                                                        <NumericInput
                                                            allowDecimals
                                                            className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-2.5 text-sm text-white focus:border-fire outline-none font-mono"
                                                            value={multiConfig?.monto ?? 2}
                                                            onChange={async (val) => {
                                                                if (multiConfig) {
                                                                    await supabase.from('costos_configuracion').update({ monto: Number(val), updated_at: new Date().toISOString() }).eq('id', multiConfig.id);
                                                                    const { data } = await supabase.from('costos_configuracion').select('*').order('tipo_costo', { ascending: true });
                                                                    setCostosList(data || []);
                                                                }
                                                            }}
                                                        />
                                                        <p className="text-[9px] text-zinc-600 mt-1">Ej: 2 = precio sugerido será 2× el costo</p>
                                                    </div>
                                                    <div>
                                                        <label className="text-[10px] uppercase tracking-wider font-bold text-zinc-400 block mb-1.5">Impuesto / IPC (%)</label>
                                                        <NumericInput
                                                            allowDecimals
                                                            className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-2.5 text-sm text-white focus:border-fire outline-none font-mono"
                                                            value={impConfig?.monto ?? 8}
                                                            onChange={async (val) => {
                                                                if (impConfig) {
                                                                    await supabase.from('costos_configuracion').update({ monto: Number(val), updated_at: new Date().toISOString() }).eq('id', impConfig.id);
                                                                    const { data } = await supabase.from('costos_configuracion').select('*').order('tipo_costo', { ascending: true });
                                                                    setCostosList(data || []);
                                                                }
                                                            }}
                                                        />
                                                        <p className="text-[9px] text-zinc-600 mt-1">Ej: 8 = se aplica 8% de impuesto al precio sugerido</p>
                                                    </div>
                                                </div>
                                            </div>
                                        </details>
                                    );
                                })()}

                                {/* Recetas (Recipes) Panel — B1: Rediseño mobile-first (Tarjetas y agrupamiento por producto) */}
                                <div className="space-y-4">
                                    <div className="flex items-center justify-between">
                                        <h2 className="text-lg font-serif text-white flex items-center gap-2">
                                            <ClipboardList size={20} className="text-fire" />
                                            Fichas Técnicas (Recetas)
                                        </h2>
                                    </div>

                                    {/* Left/Top: Recipe Form (Socio only) */}
                                    {currentUserProfile?.es_socio && (
                                        <div className="bg-zinc-900 border border-zinc-800/80 p-4 sm:p-5 rounded-2xl space-y-4">
                                            <h3 className="text-xs uppercase tracking-widest font-bold text-zinc-400">
                                                Vincular Insumo a Producto
                                            </h3>
                                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                                                <div>
                                                    <select
                                                        className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2.5 text-xs text-white focus:border-fire outline-none"
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
                                                    <select
                                                        className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2.5 text-xs text-white focus:border-fire outline-none"
                                                        value={recetaForm.insumo_id}
                                                        onChange={e => setRecetaForm(p => ({ ...p, insumo_id: e.target.value }))}
                                                    >
                                                        <option value="">Seleccionar insumo...</option>
                                                        {insumosList.map(ins => (
                                                            <option key={ins.id} value={ins.id}>{ins.nombre}</option>
                                                        ))}
                                                    </select>
                                                </div>
                                                <div className="flex gap-2">
                                                    <NumericInput
                                                        allowDecimals
                                                        placeholder="Cant. x Unidad"
                                                        className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2.5 text-xs text-white focus:border-fire outline-none"
                                                        value={recetaForm.cantidad_por_unidad}
                                                        onChange={val => setRecetaForm(p => ({ ...p, cantidad_por_unidad: val }))}
                                                    />
                                                    <button
                                                        onClick={handleSaveReceta}
                                                        disabled={recetaSaving}
                                                        className="bg-fire text-white px-4 rounded-lg text-xs font-bold hover:bg-orange-700 transition-all disabled:opacity-50 flex-shrink-0"
                                                    >
                                                        {recetaSaving ? '...' : <Plus size={16} />}
                                                    </button>
                                                </div>
                                            </div>
                                        </div>
                                    )}

                                    {/* Right/Bottom: Recipes List Cards */}
                                    <div className="space-y-4">
                                        {(() => {
                                            const grouped = recetasList.reduce((acc, rec) => {
                                                const pName = rec.productos?.nombre || 'Producto Desconocido';
                                                if (!acc[pName]) acc[pName] = [];
                                                acc[pName].push(rec);
                                                return acc;
                                            }, {});

                                            const entries = Object.entries(grouped);
                                            if (entries.length === 0) {
                                                return (
                                                    <div className="bg-zinc-900 border border-zinc-800/60 rounded-2xl p-8 text-center text-zinc-500 text-sm">
                                                        No hay recetas configuradas
                                                    </div>
                                                );
                                            }

                                            // Configuración global de pricing
                                            const multiplicadorGlobal = Number(costosList.find(c => c.tipo_costo === 'MULTIPLICADOR')?.monto || 2);
                                            const impuestoGlobal = Number(costosList.find(c => c.tipo_costo === 'IMPUESTO')?.monto || 8);

                                            return entries.map(([prodName, recs]) => {
                                                // Calcular costos de la receta
                                                const costoStandardTotal = recs.reduce((sum, rec) => {
                                                    const costoUnit = Number(rec.insumos?.costo_unitario || 0);
                                                    return sum + (Number(rec.cantidad_por_unidad) * costoUnit);
                                                }, 0);
                                                const costoPorcion = costoStandardTotal; // Porciones = 1
                                                const precioSugSinImp = costoPorcion * multiplicadorGlobal;
                                                const precioSugConImp = precioSugSinImp * (1 + impuestoGlobal / 100);
                                                const precioAprobado = Number(recs[0]?.productos?.precio || 0);
                                                const margenCosto = precioAprobado > 0 ? (costoPorcion / precioAprobado) * 100 : 0;
                                                const margenRentabilidad = precioAprobado > 0 ? 100 - margenCosto : 0;

                                                return (
                                                <details key={prodName} className="bg-zinc-900 border border-zinc-800/60 rounded-2xl overflow-hidden shadow-sm group">
                                                    <summary className="p-4 bg-zinc-950/40 cursor-pointer flex items-center justify-between hover:bg-zinc-800/30 transition-colors list-none [&::-webkit-details-marker]:hidden">
                                                        <div className="flex items-center gap-2">
                                                            <span className="text-zinc-500 group-open:rotate-90 transition-transform">›</span>
                                                            <h3 className="font-bold text-zinc-100">{prodName}</h3>
                                                        </div>
                                                        <span className="text-[9px] uppercase font-bold text-zinc-500 bg-zinc-800/50 px-2 py-1 rounded-md">
                                                            {recs.length} insumo{recs.length !== 1 ? 's' : ''}
                                                        </span>
                                                    </summary>

                                                    {/* ── Bloque COSTOS Y RENTABILIDAD ── */}
                                                    <details className="border-t border-zinc-850">
                                                        <summary className="p-3 px-4 cursor-pointer flex items-center justify-between text-sm hover:bg-zinc-800/30 transition-colors list-none [&::-webkit-details-marker]:hidden">
                                                            <div className="flex items-center gap-2">
                                                                <TrendingUp size={14} className="text-fire" />
                                                                <span className="font-bold text-fire text-[10px] uppercase tracking-wider">Costos y Rentabilidad</span>
                                                            </div>
                                                            <ChevronDown size={12} className="text-zinc-500" />
                                                        </summary>
                                                        <div className="px-4 pb-4 pt-1 bg-zinc-950/40 space-y-1.5">
                                                            <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-xs">
                                                                <span className="text-zinc-400">Costo Standard Total</span>
                                                                <span className="text-right font-mono font-bold text-white">${Math.round(costoStandardTotal).toLocaleString()}</span>

                                                                <span className="text-zinc-400">Costo Standard / Porción</span>
                                                                <span className="text-right font-mono font-bold text-white">${Math.round(costoPorcion).toLocaleString()}</span>

                                                                <span className="col-span-2 border-t border-zinc-800 my-0.5" />

                                                                <span className="text-zinc-400">Precio Sug. sin Impuesto <span className="text-zinc-600">(×{multiplicadorGlobal})</span></span>
                                                                <span className="text-right font-mono text-zinc-300">${Math.round(precioSugSinImp).toLocaleString()}</span>

                                                                <span className="text-zinc-400">Precio Sug. con Impuesto <span className="text-zinc-600">(+{impuestoGlobal}%)</span></span>
                                                                <span className="text-right font-mono text-zinc-300">${Math.round(precioSugConImp).toLocaleString()}</span>

                                                                <span className="col-span-2 border-t border-zinc-800 my-0.5" />

                                                                <span className="text-zinc-400 font-semibold">Precio Aprobado</span>
                                                                {currentUserProfile?.es_socio ? (
                                                                    <div className="flex items-center justify-end gap-1.5">
                                                                        <span className="text-green-400 text-[10px]">$</span>
                                                                        <NumericInput
                                                                            className="w-24 bg-zinc-900 border border-green-900/40 rounded-lg px-2 py-1 text-xs text-green-400 font-mono font-bold text-right focus:border-green-500 outline-none"
                                                                            value={precioAprobado}
                                                                            onChange={async (val) => {
                                                                                const prodId = recs[0]?.producto_id;
                                                                                if (!prodId || Number(val) < 0) return;
                                                                                await supabase.from('productos').update({ precio: Number(val) }).eq('id', prodId);
                                                                                await fetchInventario();
                                                                                await fetchProductos();
                                                                            }}
                                                                        />
                                                                        <Pencil size={10} className="text-green-600" />
                                                                    </div>
                                                                ) : (
                                                                    <span className="text-right font-mono font-bold text-green-400">${precioAprobado.toLocaleString()}</span>
                                                                )}

                                                                <span className="col-span-2 border-t border-zinc-800 my-0.5" />

                                                                <span className="text-zinc-400">Margen de Costo</span>
                                                                <span className={`text-right font-mono font-bold ${margenCosto > 50 ? 'text-red-400' : margenCosto > 35 ? 'text-orange-400' : 'text-green-400'}`}>{margenCosto.toFixed(2)}%</span>

                                                                <span className="text-zinc-400">Margen de Rentabilidad</span>
                                                                <span className={`text-right font-mono font-bold ${margenRentabilidad < 50 ? 'text-red-400' : margenRentabilidad < 65 ? 'text-orange-400' : 'text-green-400'}`}>{margenRentabilidad.toFixed(2)}%</span>
                                                            </div>
                                                            {costoStandardTotal === 0 && (
                                                                <p className="text-[9px] text-orange-400 mt-2">⚠️ Algunos insumos tienen costo $0 — los cálculos pueden no reflejar costos reales.</p>
                                                            )}
                                                        </div>
                                                    </details>

                                                    <div className="divide-y divide-zinc-850 text-sm border-t border-zinc-850 bg-zinc-900/50">
                                                        {recs.map(rec => (
                                                            <div key={rec.id} className="p-3 px-4 flex items-center justify-between gap-3 hover:bg-zinc-850/50 transition-colors">
                                                                <div className="min-w-0">
                                                                    <p className="font-medium text-zinc-300 truncate">{rec.insumos?.nombre}</p>
                                                                    {rec.insumos?.costo_unitario > 0 && (
                                                                        <p className="text-[10px] text-zinc-500 font-mono">${Math.round(Number(rec.cantidad_por_unidad) * Number(rec.insumos.costo_unitario)).toLocaleString()}</p>
                                                                    )}
                                                                </div>
                                                                <div className="flex items-center gap-4 shrink-0">
                                                                    {editingRecetaInline === rec.id ? (
                                                                        <div className="flex items-center gap-2">
                                                                            <NumericInput
                                                                                allowDecimals
                                                                                className="w-20 bg-zinc-950 border border-zinc-700 rounded px-2 py-1 text-xs text-white focus:border-fire outline-none"
                                                                                value={inlineRecetaQty}
                                                                                onChange={setInlineRecetaQty}
                                                                            />
                                                                            <button
                                                                                onClick={() => handleUpdateRecetaQty(rec.id)}
                                                                                disabled={inlineRecetaSaving}
                                                                                className="text-green-400 hover:text-green-300 bg-green-500/10 hover:bg-green-500/20 w-8 h-8 rounded-xl flex items-center justify-center transition-colors"
                                                                            >
                                                                                <Check size={14} />
                                                                            </button>
                                                                            <button
                                                                                onClick={() => setEditingRecetaInline(null)}
                                                                                className="text-zinc-400 hover:text-zinc-300 bg-zinc-500/10 hover:bg-zinc-500/20 w-8 h-8 rounded-xl flex items-center justify-center transition-colors"
                                                                            >
                                                                                <X size={14} />
                                                                            </button>
                                                                        </div>
                                                                    ) : (
                                                                        <span className="font-mono font-bold text-zinc-400">
                                                                            {rec.cantidad_por_unidad} <span className="text-[10px] text-zinc-500 font-sans">{rec.insumos?.unidad_medida}</span>
                                                                        </span>
                                                                    )}
                                                                    {currentUserProfile?.es_socio && editingRecetaInline !== rec.id && (
                                                                        <div className="flex items-center gap-2">
                                                                            <button
                                                                                onClick={() => {
                                                                                    setEditingRecetaInline(rec.id);
                                                                                    setInlineRecetaQty(rec.cantidad_por_unidad);
                                                                                }}
                                                                                className="text-blue-400 hover:text-blue-300 bg-blue-500/10 hover:bg-blue-500/20 w-8 h-8 rounded-xl flex items-center justify-center transition-colors"
                                                                            >
                                                                                <Pencil size={14} />
                                                                            </button>
                                                                            <button
                                                                                onClick={() => handleDeleteReceta(rec.id)}
                                                                                className="text-red-400 hover:text-red-300 bg-red-500/10 hover:bg-red-500/20 w-8 h-8 rounded-xl flex items-center justify-center transition-colors"
                                                                            >
                                                                                <Trash2 size={14} />
                                                                            </button>
                                                                        </div>
                                                                    )}
                                                                </div>
                                                            </div>
                                                        ))}
                                                    </div>
                                                </details>
                                            ); });
                                        })()}
                                    </div>
                                </div>
                            </div>
                        )}
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
                                    <NumericInput
                                        allowDecimals
                                        min={0.01}
                                        autoFocus
                                        className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-3 text-xl text-white font-mono focus:border-red-500 outline-none placeholder:text-zinc-700"
                                        placeholder="0"
                                        value={mermaForm.cantidad}
                                        onChange={val => setMermaForm(p => ({ ...p, cantidad: val }))}
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
                                    <label className="text-[10px] uppercase tracking-wider font-bold text-zinc-400 block mb-1.5">Motivo <span className="text-red-500 font-bold">*</span></label>
                                    <input
                                        type="text"
                                        className="w-full bg-zinc-950 border border-zinc-800 focus:border-zinc-600 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none placeholder:text-zinc-700 transition-colors"
                                        placeholder="Ej. Se quemó en la freidora (Obligatorio)"
                                        value={mermaForm.motivo}
                                        onChange={e => setMermaForm(p => ({ ...p, motivo: e.target.value }))}
                                    />
                                    {!mermaForm.motivo.trim() && (
                                        <p className="text-xs text-red-400 mt-1.5">
                                            ⚠️ El motivo es obligatorio para auditar la merma.
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
                                        disabled={!cantidadValida || !mermaForm.motivo.trim() || mermaSaving}
                                        className="flex-1 py-3 rounded-xl text-sm font-bold transition-colors disabled:bg-zinc-800 disabled:text-zinc-600 bg-red-700 hover:bg-red-600 text-white"
                                    >
                                        {mermaSaving ? 'Registrando...' : 'Registrar merma'}
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
                                                    <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${mov.tipo === 'VENTA' ? 'bg-zinc-800 text-zinc-400'
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
                                        onClick={() => { setShowInsumoDetalle(null); setShowAjusteModal(ins); setAjusteForm({ tipo: 'AJUSTE_MAS', cantidad: 0, motivo: '', idemKey: crypto.randomUUID() }); }}
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
                    const mov = MOVIMIENTO_UI[ajusteForm.tipo] || MOVIMIENTO_UI.AJUSTE_MAS;
                    const isNegative = mov.signo < 0;
                    // Sin Math.max(0, ...): la vista previa muestra el resultado REAL,
                    // incluso si es negativo, para que se vea que el movimiento seria
                    // rechazado. Antes el clamp a 0 ocultaba el descuadre.
                    const nuevoStock = delta > 0 ? Number(ins.stock_actual) + mov.signo * delta : null;
                    const quedariaNegativo = nuevoStock !== null && nuevoStock < 0;
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
                                        <option value="AJUSTE_MAS">Ajuste (Corrección +)</option>
                                        <option value="AJUSTE_MENOS">Ajuste (Corrección −)</option>
                                        <option value="MERMA">Merma (Desecho / Pérdida −)</option>
                                    </select>
                                </div>
                                {/* Cantidad */}
                                <div>
                                    <label className="text-[10px] uppercase tracking-wider font-bold text-zinc-400 block mb-1.5">Cantidad ({ins.unidad_medida})</label>
                                    <NumericInput
                                        allowDecimals
                                        min={0.01}
                                        className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2.5 text-sm text-white font-mono focus:border-fire outline-none"
                                        placeholder="0"
                                        value={ajusteForm.cantidad}
                                        onChange={val => setAjusteForm(p => ({ ...p, cantidad: val }))}
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
                                            <span>{mov.tipo}</span>
                                            <span>{isNegative ? '−' : '+'} {delta} {ins.unidad_medida}</span>
                                        </div>
                                        <div className="border-t border-zinc-800 my-1" />
                                        <div className="flex justify-between text-white font-bold">
                                            <span>Nuevo stock</span>
                                            <span className={quedariaNegativo ? 'text-red-400' : nuevoStock === 0 ? 'text-yellow-400' : 'text-green-400'}>
                                                {nuevoStock} {ins.unidad_medida}
                                            </span>
                                        </div>
                                        {quedariaNegativo && (
                                            <p className="text-[10px] text-red-400 font-sans pt-1 border-t border-red-900/40 mt-1">
                                                El stock no puede quedar negativo: este movimiento será rechazado.
                                                Revise la cantidad o el conteo físico.
                                            </p>
                                        )}
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

                {activeTab === 'inventario' && inventarioSubTab === 'compras' && (
                    <div className="space-y-6 pt-2 font-sans">
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
                                            <label className="text-[9px] uppercase tracking-wider font-bold text-zinc-500 block mb-1">Precio Total Pagado ($)</label>
                                            <NumericInput
                                                allowDecimals
                                                className="w-full bg-zinc-900 border border-zinc-800 rounded px-2.5 py-1.5 text-xs text-white focus:border-fire outline-none font-mono"
                                                value={selectedDetail.precio_total_pagado}
                                                onChange={val => setSelectedDetail(p => ({ ...p, precio_total_pagado: val }))}
                                            />
                                        </div>
                                        <div className="grid grid-cols-2 gap-2">
                                            <div>
                                                <label className="text-[9px] uppercase tracking-wider font-bold text-zinc-500 block mb-1">Contenido Comprado</label>
                                                <NumericInput
                                                    allowDecimals
                                                    className="w-full bg-zinc-900 border border-zinc-800 rounded px-2.5 py-1.5 text-xs text-white focus:border-fire outline-none font-mono"
                                                    value={selectedDetail.contenido_comprado}
                                                    onChange={val => setSelectedDetail(p => ({ ...p, contenido_comprado: val }))}
                                                />
                                            </div>
                                            <div>
                                                <label className="text-[9px] uppercase tracking-wider font-bold text-zinc-500 block mb-1">Unidad del Contenido</label>
                                                <select
                                                    className="w-full bg-zinc-900 border border-zinc-800 rounded px-2.5 py-1.5 text-xs text-white focus:border-fire outline-none"
                                                    value={selectedDetail.unidad_compra}
                                                    onChange={e => setSelectedDetail(p => ({ ...p, unidad_compra: e.target.value }))}
                                                >
                                                    <option value="">Seleccionar...</option>
                                                    {(() => {
                                                        const insumoSel = insumosList.find(i => i.id === selectedDetail.insumo_id);
                                                        const unidadBase = insumoSel?.unidad_medida || '';
                                                        const options = PURCHASE_UNIT_OPTIONS[unidadBase] || [{ value: unidadBase, label: unidadBase }];
                                                        return options.map(o => <option key={o.value} value={o.value}>{o.label}</option>);
                                                    })()}
                                                </select>
                                            </div>
                                        </div>
                                        {/* Costo Unitario Calculado — preview */}
                                        {selectedDetail.insumo_id && Number(selectedDetail.precio_total_pagado) > 0 && Number(selectedDetail.contenido_comprado) > 0 && selectedDetail.unidad_compra && (() => {
                                            const insumoSel = insumosList.find(i => i.id === selectedDetail.insumo_id);
                                            const { costoUnitario, cantidadBase, error } = calcularCostoUnitarioDesdeCompra(
                                                Number(selectedDetail.precio_total_pagado),
                                                Number(selectedDetail.contenido_comprado),
                                                selectedDetail.unidad_compra,
                                                insumoSel?.unidad_medida || ''
                                            );
                                            if (error) return <p className="text-xs text-red-400 bg-red-950/30 border border-red-900/30 rounded-lg p-2 mt-1">❌ {error}</p>;
                                            return (
                                                <div className="bg-zinc-950 border border-green-900/30 rounded-lg p-2.5 mt-1 space-y-1">
                                                    <p className="text-[9px] text-green-400 font-bold uppercase tracking-wider">✓ Costo Unitario Calculado</p>
                                                    <p className="text-sm font-mono font-bold text-green-400">${costoUnitario.toFixed(2)} / {insumoSel?.unidad_medida}</p>
                                                    {selectedDetail.unidad_compra !== insumoSel?.unidad_medida && (
                                                        <p className="text-[9px] text-zinc-500">Conversión: {selectedDetail.contenido_comprado} {selectedDetail.unidad_compra} → {cantidadBase.toLocaleString()} {insumoSel?.unidad_medida}</p>
                                                    )}
                                                </div>
                                            );
                                        })()}
                                        <div className="flex justify-end">
                                            <button
                                                onClick={handleAddCompraDetail}
                                                className="bg-fire text-white px-4 py-2 rounded-lg text-xs font-bold hover:bg-orange-700 transition-colors flex items-center gap-1.5"
                                            >
                                                <Plus size={14} /> Agregar al Detalle
                                            </button>
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
                                                className={`px-4 py-2 rounded-lg text-xs font-bold border transition-all ${compraForm.metodo_pago === m
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
                                        onClick={() => { setEditingCompra(null); setCompraInsumoSearch(''); setSelectedDetail({ insumo_id: '', precio_total_pagado: '', contenido_comprado: '', unidad_compra: '', cantidad: 0, costo_unitario: 0 }); }}
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
                                <div className="p-4 space-y-3">
                                    {comprasLoading ? (
                                        <div className="p-8 text-center text-zinc-500 animate-pulse">Cargando compras...</div>
                                    ) : comprasList.length === 0 ? (
                                        <div className="p-8 text-center text-zinc-500">No hay compras registradas</div>
                                    ) : (
                                        comprasList.map(cmp => (
                                            <div key={cmp.id} className="bg-zinc-950/50 border border-zinc-850 rounded-xl p-4 hover:border-zinc-700 transition-colors">
                                                <div className="flex justify-between items-start mb-2">
                                                    <div>
                                                        <h4 className="font-bold text-zinc-100">{cmp.proveedores?.nombre}</h4>
                                                        <p className="text-[10px] text-zinc-500 font-mono">
                                                            {new Date(cmp.fecha).toLocaleString('es-ES')} • {cmp.perfiles_trabajadores?.nombre || 'Desconocido'}
                                                        </p>
                                                    </div>
                                                    <div className="text-right">
                                                        <div className="font-bold text-zinc-100 font-mono text-sm">${cmp.total.toLocaleString()}</div>
                                                        <span className={`inline-block mt-1 text-[9px] font-bold px-2 py-0.5 rounded ${cmp.estado === 'RECIBIDA'
                                                            ? 'bg-green-500/10 text-green-400'
                                                            : cmp.estado === 'BORRADOR'
                                                                ? 'bg-yellow-500/10 text-yellow-400'
                                                                : 'bg-red-500/10 text-red-400'
                                                            }`}>
                                                            {cmp.estado}
                                                        </span>
                                                    </div>
                                                </div>
                                                {currentUserProfile?.es_socio && (cmp.estado === 'BORRADOR' || cmp.estado === 'RECIBIDA') && (
                                                    <div className="flex gap-2 justify-end mt-3 border-t border-zinc-800 pt-3">
                                                        {cmp.estado === 'BORRADOR' && (
                                                            <button
                                                                onClick={() => handleRecibirCompra(cmp)}
                                                                disabled={actionLoading}
                                                                className="bg-green-950/20 text-green-400 px-3 py-1.5 rounded-lg font-bold text-xs hover:bg-green-950/40 disabled:opacity-50 transition-colors"
                                                            >
                                                                {actionLoading ? 'Procesando...' : 'Recibir'}
                                                            </button>
                                                        )}
                                                        <button
                                                            onClick={() => setShowAnularModal(cmp)}
                                                            disabled={actionLoading}
                                                            className="bg-red-950/20 text-red-400 px-3 py-1.5 rounded-lg font-bold text-xs hover:bg-red-950/40 disabled:opacity-50 transition-colors"
                                                        >
                                                            Anular
                                                        </button>
                                                    </div>
                                                )}
                                            </div>
                                        ))
                                    )}
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
                                                className={`flex-1 py-2.5 rounded-lg text-xs font-bold border transition-all ${recibirMetodoPago === m
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
                                                    <NumericInput
                                                        allowDecimals
                                                        className="bg-zinc-900 border border-zinc-700 focus:border-green-500 rounded px-2.5 py-1 text-xs text-white text-right font-mono font-bold w-28 outline-none"
                                                        value={cargaMasivaForm[ins.id] !== undefined ? cargaMasivaForm[ins.id] : ins.stock_actual}
                                                        onChange={val => {
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



                {/* Editor de tarifa por turno.
                    Usa estado local y guarda SOLO al presionar el boton: NumericInput
                    dispara onChange en cada tecla, asi que escribir directo a la base
                    desde ahi persistiria los valores intermedios (1, 15, 150...). */}
                {showTarifaModal && (
                    <div className="fixed inset-0 bg-black/85 flex items-center justify-center p-4 z-[999]">
                        <div className="w-full max-w-sm bg-zinc-900 border border-zinc-800 rounded-3xl p-6 shadow-2xl space-y-5">
                            <div className="flex justify-between items-center border-b border-zinc-800 pb-3">
                                <h3 className="text-lg font-bold font-serif text-white flex items-center gap-2">
                                    <Clock className="text-fire" size={18} />
                                    Pago por turno
                                </h3>
                                <button onClick={() => setShowTarifaModal(null)} className="text-zinc-500 hover:text-white">
                                    <X size={20} />
                                </button>
                            </div>

                            <div>
                                <p className="text-sm text-zinc-300 font-bold">{showTarifaModal.nombre}</p>
                                <p className="text-[10px] text-zinc-500 mt-0.5">
                                    Valor fijo que se paga por cada día trabajado.
                                </p>
                            </div>

                            <div>
                                <label className="text-[10px] font-bold uppercase tracking-wider text-zinc-400 block mb-2">
                                    Valor por turno ($)
                                </label>
                                <NumericInput
                                    className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-3 text-white focus:border-fire outline-none text-center font-bold text-lg font-mono"
                                    value={tarifaForm}
                                    onChange={setTarifaForm}
                                    min={0}
                                />
                            </div>

                            <p className="text-[10px] text-zinc-500 bg-zinc-950/60 rounded-lg p-3 border border-zinc-800">
                                Los turnos <span className="text-zinc-300">ya registrados conservan su valor</span>.
                                El cambio solo aplica a los turnos siguientes.
                            </p>

                            <div className="flex gap-2 pt-1">
                                <button
                                    onClick={() => setShowTarifaModal(null)}
                                    className="flex-1 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 py-2.5 rounded-xl text-xs font-bold uppercase tracking-wider"
                                >
                                    Cancelar
                                </button>
                                <button
                                    onClick={handleGuardarTarifa}
                                    disabled={turnoSubmitting}
                                    className="flex-1 bg-fire hover:bg-orange-700 disabled:opacity-50 text-white py-2.5 rounded-xl text-xs font-bold uppercase tracking-wider"
                                >
                                    {turnoSubmitting ? 'Guardando...' : 'Guardar'}
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
                                    <NumericInput
                                        className="w-full bg-zinc-950 border border-zinc-800 rounded-lg p-2.5 text-white outline-none focus:border-fire font-bold text-sm"
                                        value={liqMontoForm}
                                        onChange={(val) => setLiqMontoForm(Number(val))}
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
                                    <NumericInput
                                        className="w-full bg-zinc-950 border border-zinc-800 rounded-lg p-2.5 text-white outline-none focus:border-fire font-bold text-sm"
                                        value={gastoForm.monto}
                                        onChange={(val) => setGastoForm({ ...gastoForm, monto: val })}
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

                {/* B12: Modal Transferencia Interna */}
                {showTransferModal && (
                    <div className="fixed inset-0 bg-black/85 flex items-center justify-center p-4 z-[999]">
                        <div className="w-full max-w-md bg-zinc-900 border border-zinc-800 rounded-3xl p-6 shadow-2xl relative space-y-4 font-sans">
                            <div className="flex justify-between items-center border-b border-zinc-800 pb-3">
                                <h3 className="text-lg font-bold font-serif text-white">🔀 Transferencia Interna</h3>
                                <button onClick={() => setShowTransferModal(false)} className="text-zinc-500 hover:text-white text-xl">✕</button>
                            </div>
                            <p className="text-xs text-zinc-400">Mueve dinero entre cuentas internas sin afectar ingresos ni gastos.</p>
                            <div className="space-y-3">
                                <div>
                                    <label className="text-xs font-bold uppercase tracking-wider text-zinc-400 block mb-1">Cuenta Origen</label>
                                    <select
                                        className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2.5 text-sm text-white outline-none focus:border-fire"
                                        value={transferForm.origen}
                                        onChange={(e) => setTransferForm(p => ({ ...p, origen: e.target.value }))}
                                    >
                                        <option value="EFECTIVO">💵 Efectivo</option>
                                        <option value="NEQUI">📱 Nequi</option>
                                        <option value="BANCOLOMBIA">🏦 Bancolombia</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="text-xs font-bold uppercase tracking-wider text-zinc-400 block mb-1">Cuenta Destino</label>
                                    <select
                                        className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2.5 text-sm text-white outline-none focus:border-fire"
                                        value={transferForm.destino}
                                        onChange={(e) => setTransferForm(p => ({ ...p, destino: e.target.value }))}
                                    >
                                        <option value="EFECTIVO">💵 Efectivo</option>
                                        <option value="NEQUI">📱 Nequi</option>
                                        <option value="BANCOLOMBIA">🏦 Bancolombia</option>
                                    </select>
                                </div>
                                {transferForm.origen === transferForm.destino && (
                                    <p className="text-[10px] text-red-400 font-bold">⚠️ Origen y destino no pueden ser iguales</p>
                                )}
                                <div>
                                    <label className="text-xs font-bold uppercase tracking-wider text-zinc-400 block mb-1">Monto ($)</label>
                                    <NumericInput
                                        className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2.5 text-sm text-white outline-none focus:border-fire text-center font-bold"
                                        value={transferForm.monto || ''}
                                        placeholder="0"
                                        onChange={(val) => setTransferForm(p => ({ ...p, monto: val }))}
                                    />
                                </div>
                                <div>
                                    <label className="text-xs font-bold uppercase tracking-wider text-zinc-400 block mb-1">Observaciones (Opcional)</label>
                                    <textarea
                                        rows={2}
                                        className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2.5 text-xs text-white outline-none focus:border-fire resize-none"
                                        placeholder="Ej: Retiro de efectivo para consignación bancaria"
                                        value={transferForm.observaciones}
                                        onChange={(e) => setTransferForm(p => ({ ...p, observaciones: e.target.value }))}
                                    />
                                </div>
                            </div>
                            <button
                                onClick={handleTransferInterna}
                                disabled={actionLoading || transferForm.origen === transferForm.destino || !transferForm.monto || transferForm.monto <= 0}
                                className="w-full bg-fire hover:bg-orange-700 text-white py-3 rounded-xl font-bold text-xs uppercase tracking-wider transition-all shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                {actionLoading ? 'Procesando...' : '✅ Confirmar Transferencia'}
                            </button>
                        </div>
                    </div>
                )}

                {/* Modal Saldo Inicial */}
                {showSaldoInicialModal && (
                    <div className="fixed inset-0 bg-black/85 flex items-center justify-center p-4 z-[999]">
                        <div className="w-full max-w-md bg-zinc-900 border border-zinc-800 rounded-3xl p-6 shadow-2xl relative space-y-4 font-sans">
                            <div className="flex justify-between items-center border-b border-zinc-800 pb-3">
                                <h3 className="text-lg font-bold font-serif text-emerald-400">🏁 Saldo Inicial del Negocio</h3>
                                <button onClick={() => setShowSaldoInicialModal(false)} className="text-zinc-500 hover:text-white">✕</button>
                            </div>
                            <p className="text-[10px] text-zinc-500">Registra el dinero que ya existe en el negocio antes de iniciar operaciones en el sistema. Solo se puede ejecutar una vez.</p>
                            <div className="space-y-3">
                                <div>
                                    <label className="text-xs font-bold text-green-400/70 block mb-1">💵 Efectivo</label>
                                    <input type="number" min={0} value={saldoInicialForm.efectivo} onChange={e => setSaldoInicialForm(p => ({ ...p, efectivo: e.target.value }))}
                                        className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-2.5 text-white focus:border-green-500 outline-none text-center font-bold" />
                                </div>
                                <div>
                                    <label className="text-xs font-bold text-pink-400/70 block mb-1">📱 Nequi</label>
                                    <input type="number" min={0} value={saldoInicialForm.nequi} onChange={e => setSaldoInicialForm(p => ({ ...p, nequi: e.target.value }))}
                                        className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-2.5 text-white focus:border-pink-500 outline-none text-center font-bold" />
                                </div>
                                <div>
                                    <label className="text-xs font-bold text-yellow-400/70 block mb-1">🏦 Bancolombia</label>
                                    <input type="number" min={0} value={saldoInicialForm.bancolombia} onChange={e => setSaldoInicialForm(p => ({ ...p, bancolombia: e.target.value }))}
                                        className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-2.5 text-white focus:border-yellow-500 outline-none text-center font-bold" />
                                </div>
                            </div>
                            <button
                                onClick={handleSaldoInicial}
                                disabled={actionLoading}
                                className="w-full bg-emerald-600 hover:bg-emerald-700 text-white py-3 rounded-xl font-bold text-xs uppercase tracking-wider transition-all shadow-lg disabled:opacity-50"
                            >
                                {actionLoading ? 'Registrando...' : '✅ Registrar Saldo Inicial'}
                            </button>
                        </div>
                    </div>
                )}

                {/* Modal Movimiento Manual (Ingreso / Retiro) */}
                {showMovManualModal && (
                    <div className="fixed inset-0 bg-black/85 flex items-center justify-center p-4 z-[999]">
                        <div className="w-full max-w-md bg-zinc-900 border border-zinc-800 rounded-3xl p-6 shadow-2xl relative space-y-4 font-sans">
                            <div className="flex justify-between items-center border-b border-zinc-800 pb-3">
                                <h3 className={`text-lg font-bold font-serif ${showMovManualModal === 'INGRESO_MANUAL' ? 'text-green-400' : 'text-red-400'}`}>
                                    {showMovManualModal === 'INGRESO_MANUAL' ? '➕ Ingreso Manual' : '💸 Retiro de Efectivo'}
                                </h3>
                                <button onClick={() => setShowMovManualModal(null)} className="text-zinc-500 hover:text-white">✕</button>
                            </div>
                            <div className="space-y-3">
                                <div>
                                    <label className="text-xs font-bold text-zinc-400 block mb-1">Monto ($)</label>
                                    <input type="number" min={0} value={movManualForm.monto} onChange={e => setMovManualForm(p => ({ ...p, monto: e.target.value }))}
                                        className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-3 text-white focus:border-fire outline-none text-center font-bold text-lg" />
                                </div>
                                <div>
                                    <label className="text-xs font-bold text-zinc-400 block mb-1">Método de pago</label>
                                    <select value={movManualForm.metodo_pago} onChange={e => setMovManualForm(p => ({ ...p, metodo_pago: e.target.value }))}
                                        className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-2.5 text-white outline-none">
                                        <option value="EFECTIVO">💵 Efectivo</option>
                                        <option value="NEQUI">📱 Nequi</option>
                                        <option value="BANCOLOMBIA">🏦 Bancolombia</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="text-xs font-bold text-zinc-400 block mb-1">Motivo / Descripción</label>
                                    <textarea value={movManualForm.descripcion} onChange={e => setMovManualForm(p => ({ ...p, descripcion: e.target.value }))}
                                        placeholder={showMovManualModal === 'INGRESO_MANUAL' ? 'Ej: Aporte del propietario, devolución de préstamo' : 'Ej: Retiro personal, entrega a proveedor'}
                                        className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-2.5 text-white outline-none text-xs resize-none h-16" />
                                </div>
                            </div>
                            <button
                                onClick={handleMovManual}
                                disabled={actionLoading || !movManualForm.monto || Number(movManualForm.monto) <= 0}
                                className={`w-full py-3 rounded-xl font-bold text-xs uppercase tracking-wider transition-all shadow-lg disabled:opacity-50 text-white ${showMovManualModal === 'INGRESO_MANUAL' ? 'bg-green-600 hover:bg-green-700' : 'bg-red-600 hover:bg-red-700'}`}
                            >
                                {actionLoading ? 'Procesando...' : showMovManualModal === 'INGRESO_MANUAL' ? '✅ Registrar Ingreso' : '✅ Registrar Retiro'}
                            </button>
                        </div>
                    </div>
                )}

                {/* Modal Resolver Diferencia de Caja */}
                {showResolverDifModal && (
                    <div className="fixed inset-0 bg-black/85 flex items-center justify-center p-4 z-[999]">
                        <div className="w-full max-w-md bg-zinc-900 border border-zinc-800 rounded-3xl p-6 shadow-2xl relative space-y-4 font-sans">
                            <div className="flex justify-between items-center border-b border-zinc-800 pb-3">
                                <h3 className="text-lg font-bold font-serif text-amber-400">⚖️ Resolver Diferencia de Caja</h3>
                                <button onClick={() => setShowResolverDifModal(null)} className="text-zinc-500 hover:text-white">✕</button>
                            </div>
                            <div className="p-3 bg-zinc-950 rounded-lg border border-zinc-800 text-xs">
                                <p className="text-zinc-400">Sesión: <span className="text-white font-mono">{showResolverDifModal.perfiles_trabajadores?.nombre || 'Desconocido'}</span></p>
                                <p className="text-zinc-400 mt-1">Diferencia total: <span className={`font-bold ${Number(showResolverDifModal.diferencia) < 0 ? 'text-red-400' : 'text-green-400'}`}>${Number(showResolverDifModal.diferencia || 0).toLocaleString()}</span></p>
                                {Number(showResolverDifModal.diferencia_efectivo || 0) !== 0 && <p className="text-zinc-500 mt-0.5">Efectivo: ${Number(showResolverDifModal.diferencia_efectivo).toLocaleString()}</p>}
                                {Number(showResolverDifModal.diferencia_nequi || 0) !== 0 && <p className="text-zinc-500 mt-0.5">Nequi: ${Number(showResolverDifModal.diferencia_nequi).toLocaleString()}</p>}
                                {Number(showResolverDifModal.diferencia_bancolombia || 0) !== 0 && <p className="text-zinc-500 mt-0.5">Bancolombia: ${Number(showResolverDifModal.diferencia_bancolombia).toLocaleString()}</p>}
                            </div>
                            <div className="space-y-3">
                                <div>
                                    <label className="text-xs font-bold text-zinc-400 block mb-1">Tipo de diferencia</label>
                                    <select value={resolverDifForm.tipo} onChange={e => setResolverDifForm(p => ({ ...p, tipo: e.target.value }))}
                                        className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-2.5 text-white outline-none">
                                        <option value="FALTANTE">Faltante (pérdida)</option>
                                        <option value="SOBRANTE">Sobrante (excedente)</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="text-xs font-bold text-zinc-400 block mb-1">Método de pago</label>
                                    <select value={resolverDifForm.metodo_pago} onChange={e => setResolverDifForm(p => ({ ...p, metodo_pago: e.target.value }))}
                                        className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-2.5 text-white outline-none">
                                        <option value="EFECTIVO">💵 Efectivo</option>
                                        <option value="NEQUI">📱 Nequi</option>
                                        <option value="BANCOLOMBIA">🏦 Bancolombia</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="text-xs font-bold text-zinc-400 block mb-1">Monto ($)</label>
                                    <input type="number" min={0} value={resolverDifForm.monto} onChange={e => setResolverDifForm(p => ({ ...p, monto: e.target.value }))}
                                        className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-2.5 text-white focus:border-amber-500 outline-none text-center font-bold" />
                                </div>
                                <div>
                                    <label className="text-xs font-bold text-zinc-400 block mb-1">Motivo / Autorización</label>
                                    <textarea value={resolverDifForm.motivo} onChange={e => setResolverDifForm(p => ({ ...p, motivo: e.target.value }))}
                                        placeholder="Ej: Error de vuelto, faltante aceptado por el admin, sobrante por error de conteo"
                                        className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-2.5 text-white outline-none text-xs resize-none h-16" />
                                </div>
                            </div>
                            <div className="p-2.5 bg-amber-500/5 border border-amber-500/10 rounded-lg text-amber-400 text-[10px]">
                                ⚠️ Esta acción creará un movimiento de ajuste inmutable en el historial financiero. El historial original NO será modificado.
                            </div>
                            <button
                                onClick={handleResolverDiferencia}
                                disabled={actionLoading || !resolverDifForm.monto || Number(resolverDifForm.monto) <= 0 || !resolverDifForm.motivo}
                                className="w-full bg-amber-600 hover:bg-amber-700 text-white py-3 rounded-xl font-bold text-xs uppercase tracking-wider transition-all shadow-lg disabled:opacity-50"
                            >
                                {actionLoading ? 'Procesando...' : '✅ Autorizar y Registrar Ajuste'}
                            </button>
                        </div>
                    </div>
                )}

                {/* Modal Solicitar Anulación de Venta */}
                {showSolicitarAnulacionModal && (
                    <div className="fixed inset-0 bg-black/85 flex items-center justify-center p-4 z-[999]">
                        <div className="w-full max-w-md bg-zinc-900 border border-zinc-800 rounded-3xl p-6 shadow-2xl relative space-y-4 font-sans">
                            <div className="flex justify-between items-center border-b border-zinc-800 pb-3">
                                <h3 className="text-base font-bold font-serif text-red-400 flex items-center gap-2">
                                    🚨 {currentUserProfile?.es_socio ? 'Anular Venta' : 'Solicitar Anulación de Venta'}
                                </h3>
                                <button onClick={() => setShowSolicitarAnulacionModal(null)} className="text-zinc-500 hover:text-white">✕</button>
                            </div>

                            <div className="space-y-3 text-xs">
                                <div className="p-3 bg-zinc-950 rounded-lg border border-zinc-800">
                                    <p className="text-zinc-400">Venta por <span className="font-bold text-white">${Number(showSolicitarAnulacionModal.total).toLocaleString()}</span></p>
                                    <p className="text-zinc-500">{new Date(showSolicitarAnulacionModal.fecha).toLocaleString('es-ES')} · {showSolicitarAnulacionModal.metodo_pago}</p>
                                </div>
                                <div className="p-3 bg-yellow-500/5 border border-yellow-500/10 rounded-lg text-yellow-400">
                                    {currentUserProfile?.es_socio
                                        ? 'Como administrador, esta anulación se ejecutará de forma inmediata.'
                                        : 'Esta solicitud requiere la aprobación de un administrador antes de ejecutarse.'}
                                </div>
                                <label className="text-xs font-bold uppercase tracking-wider text-zinc-400 block">Motivo de anulación (obligatorio)</label>
                                <textarea
                                    rows="3"
                                    className="w-full bg-zinc-950 border border-zinc-800 rounded-xl p-3 text-white focus:border-fire outline-none resize-none text-xs"
                                    placeholder="Describir el motivo por el cual se solicita anular esta venta..."
                                    value={anulacionMotivo}
                                    onChange={(e) => setAnulacionMotivo(e.target.value)}
                                />
                            </div>

                            <button
                                onClick={handleSolicitarAnulacion}
                                disabled={actionLoading || !anulacionMotivo.trim()}
                                className="w-full bg-red-600 hover:bg-red-700 text-white py-3 rounded-lg font-bold transition-all uppercase tracking-wider text-xs shadow-lg disabled:opacity-50"
                            >
                                {actionLoading ? 'Procesando...' : currentUserProfile?.es_socio ? '⚠️ Anular Venta Ahora' : 'Enviar Solicitud de Anulación'}
                            </button>
                        </div>
                    </div>
                )}

                {/* Modal Nuevo/Editar Costo */}
                {showCostoModal && (
                    <div className="fixed inset-0 bg-black/85 flex items-center justify-center p-4 z-[999]">
                        <div className="w-full max-w-md bg-zinc-900 border border-zinc-800 rounded-3xl p-6 shadow-2xl relative space-y-4 font-sans">
                            <div className="flex justify-between items-center border-b border-zinc-800 pb-3">
                                <h3 className="text-base font-bold font-serif text-white">{editingCosto ? 'Editar Costo' : 'Nuevo Costo'}</h3>
                                <button onClick={() => setShowCostoModal(false)} className="text-zinc-500 hover:text-white">✕</button>
                            </div>

                            <div className="space-y-3">
                                <input type="text" placeholder="Nombre del costo" className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-2.5 text-white focus:border-fire outline-none text-xs" value={costoForm.nombre} onChange={(e) => setCostoForm(f => ({ ...f, nombre: e.target.value }))} />
                                <input type="text" placeholder="Descripción (opcional)" className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-2.5 text-white focus:border-fire outline-none text-xs" value={costoForm.descripcion} onChange={(e) => setCostoForm(f => ({ ...f, descripcion: e.target.value }))} />
                                <div className="grid grid-cols-2 gap-3">
                                    <select className="bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2.5 text-white text-xs focus:border-fire outline-none" value={costoForm.tipo_costo} onChange={(e) => setCostoForm(f => ({ ...f, tipo_costo: e.target.value }))}>
                                        <option value="FIJO">Fijo</option>
                                        <option value="VARIABLE">Variable</option>
                                    </select>
                                    <select className="bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2.5 text-white text-xs focus:border-fire outline-none" value={costoForm.categoria} onChange={(e) => setCostoForm(f => ({ ...f, categoria: e.target.value }))}>
                                        <option value="ARRIENDO">Arriendo</option>
                                        <option value="SERVICIOS">Servicios</option>
                                        <option value="PERSONAL">Personal</option>
                                        <option value="ADMINISTRATIVO">Administrativo</option>
                                        <option value="SOFTWARE">Software</option>
                                        <option value="COMISIONES">Comisiones</option>
                                        <option value="EMPAQUES">Empaques</option>
                                        <option value="DOMICILIOS">Domicilios</option>
                                        <option value="PASARELAS">Pasarelas</option>
                                        <option value="OTROS">Otros</option>
                                    </select>
                                </div>
                                <div className="grid grid-cols-2 gap-3">
                                    <NumericInput placeholder="Monto ($)" className="bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-2.5 text-white focus:border-fire outline-none text-xs" value={costoForm.monto} onChange={(val) => setCostoForm(f => ({ ...f, monto: val }))} />
                                    <select className="bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2.5 text-white text-xs focus:border-fire outline-none" value={costoForm.periodicidad} onChange={(e) => setCostoForm(f => ({ ...f, periodicidad: e.target.value }))}>
                                        <option value="DIARIO">Diario</option>
                                        <option value="SEMANAL">Semanal</option>
                                        <option value="QUINCENAL">Quincenal</option>
                                        <option value="MENSUAL">Mensual</option>
                                        <option value="ANUAL">Anual</option>
                                    </select>
                                </div>
                            </div>

                            <button
                                onClick={handleSaveCosto}
                                disabled={actionLoading || !costoForm.nombre.trim() || !costoForm.monto}
                                className="w-full bg-fire hover:bg-orange-700 text-white py-3 rounded-lg font-bold transition-all uppercase tracking-wider text-xs shadow-lg disabled:opacity-50"
                            >
                                {actionLoading ? 'Guardando...' : editingCosto ? 'Actualizar Costo' : 'Crear Costo'}
                            </button>
                        </div>
                    </div>
                )}

                {activeTab === 'inventario' && inventarioSubTab === 'mermas' && (
                    <div className="space-y-6 pt-2 font-sans">
                        <SectionHeader
                            title="Historial de Mermas"
                            subtitle="Registro de insumos dados de baja o perdidos"
                            icon={TrendingDown}
                        />
                        {mermasLoading ? (
                            <div className="p-10 text-center text-zinc-500 animate-pulse">Cargando mermas...</div>
                        ) : mermasList.length === 0 ? (
                            <div className="bg-zinc-900 border border-zinc-800/60 rounded-2xl p-8 text-center text-zinc-500 text-sm">
                                No se han registrado mermas
                            </div>
                        ) : (
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                {mermasList.map(merma => (
                                    <div key={merma.id} className="bg-zinc-900 border border-zinc-800/60 rounded-2xl p-4 shadow-sm hover:border-zinc-700 transition-colors">
                                        <div className="flex justify-between items-start mb-2">
                                            <h4 className="font-bold text-zinc-100">{merma.insumos?.nombre}</h4>
                                            <span className="text-xs font-mono font-bold text-red-400 bg-red-950/30 px-2 py-0.5 rounded-md border border-red-900/30">
                                                - {merma.cantidad} {merma.insumos?.unidad_medida}
                                            </span>
                                        </div>
                                        <div className="text-sm text-zinc-400">
                                            <p><span className="font-semibold">Motivo:</span> {merma.motivo || 'No especificado'}</p>
                                            <p className="text-xs mt-2 text-zinc-500">
                                                {new Date(merma.created_at).toLocaleString('es-CO')}
                                            </p>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                )}

            </main>
        </div>
    );
};

export default AdminDashboard;
