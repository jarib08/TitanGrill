import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../lib/supabaseClient';
import { useNavigate } from 'react-router-dom';
import { ShoppingCart, User, Search, Plus, Minus, Trash2, LogOut, CheckCircle, RefreshCw, Key, ShieldAlert, Award, QrCode, UserPlus, Camera, X, Check, AlertCircle, ChevronDown } from 'lucide-react';
import { Html5Qrcode } from 'html5-qrcode';
import NumericInput from './ui/NumericInput';

// Products loaded dynamically from Supabase
const PENDING_SALE_KEY = 'titan_grill_pending_sale';
const SALE_TIMEOUT_MS = 20000; // 20 seconds

const POS = () => {
    const navigate = useNavigate();
    const isSubmittingRef = useRef(false); // B18: double-click guard
    const [worker, setWorker] = useState(null);
    const [cart, setCart] = useState([]);
    const [categoryFilter, setCategoryFilter] = useState('Todos');
    const [discount, setDiscount] = useState(0);
    const [discountType, setDiscountType] = useState('pesos'); // 'pesos' | 'porcentaje'
    const [discountInput, setDiscountInput] = useState(0); // raw input value
    const [paymentMethod, setPaymentMethod] = useState('EFECTIVO');

    // Dynamic product catalog
    const [products, setProducts] = useState([]);
    const [productsLoading, setProductsLoading] = useState(true);
    const [productSearch, setProductSearch] = useState('');
    
    // Mixed payments
    const [cashAmount, setCashAmount] = useState(0);
    const [nequiAmount, setNequiAmount] = useState(0);
    const [bancolombiaAmount, setBancolombiaAmount] = useState(0);
    
    // Client selection
    const [searchQuery, setSearchQuery] = useState('');
    const [clients, setClients] = useState([]);
    const [selectedClient, setSelectedClient] = useState(null);
    const [extraClients, setExtraClients] = useState([]); // Multi-stamp: additional clients for this sale
    const [isSearchingClient, setIsSearchingClient] = useState(false);

    // Mobile floating cart visibility state
    const [isCartDetailsVisible, setIsCartDetailsVisible] = useState(false);

    // QR Scanner & New Client Modal states
    const [showQrModal, setShowQrModal] = useState(false);
    const [showNewClientModal, setShowNewClientModal] = useState(false);
    const [newClientForm, setNewClientForm] = useState({ nombre: '', celular: '', email: '' });
    const [newClientError, setNewClientError] = useState('');
    const [isRegisteringClient, setIsRegisteringClient] = useState(false);
    
    // Cash session states
    const [activeSession, setActiveSession] = useState(null);
    const [sessionLoading, setSessionLoading] = useState(true);
    const [openCashAmount, setOpenCashAmount] = useState(50000);
    const [openNequiAmount, setOpenNequiAmount] = useState(0);
    const [openBancoAmount, setOpenBancoAmount] = useState(0);
    const [closeCashCounted, setCloseCashCounted] = useState(0);
    const [closeNequiCounted, setCloseNequiCounted] = useState(0);
    const [closeBancoCounted, setCloseBancoCounted] = useState(0);
    const [closeObservations, setCloseObservations] = useState('');
    const [expectedCashAtClose, setExpectedCashAtClose] = useState(0);
    const [expectedNequiAtClose, setExpectedNequiAtClose] = useState(0);
    const [expectedBancoAtClose, setExpectedBancoAtClose] = useState(0);

    // Modal view states
    const [showCloseModal, setShowCloseModal] = useState(false);

    // Bloque 10: Worker recent sales + cancellation request
    const [showRecentSalesModal, setShowRecentSalesModal] = useState(false);
    const [recentSales, setRecentSales] = useState([]);
    const [recentSalesLoading, setRecentSalesLoading] = useState(false);
    const [showAnulacionModal, setShowAnulacionModal] = useState(null); // venta object
    const [anulacionMotivo, setAnulacionMotivo] = useState('');
    const [anulacionSubmitting, setAnulacionSubmitting] = useState(false);

    // UI state
    const [loading, setLoading] = useState(false);
    const [successMessage, setSuccessMessage] = useState('');
    const [errorMessage, setErrorMessage] = useState('');
    const [saleStatus, setSaleStatus] = useState('READY'); // READY | REGISTERING | INDETERMINATE | RECOVERING | SUCCESS | ERROR

    const fetchProducts = async () => {
        setProductsLoading(true);
        try {
            const { data, error } = await supabase
                .from('productos')
                .select('id, nombre, descripcion, precio, categoria, imagen, orden')
                .eq('activo', true)
                .order('orden', { ascending: true });
            if (!error && data) setProducts(data);
        } catch (err) {
            console.error('Error loading products:', err);
        } finally {
            setProductsLoading(false);
        }
    };

    const fetchSession = async (userId) => {
        setSessionLoading(true);
        try {
            const { data, error } = await supabase
                .from('sesiones_caja')
                .select('*')
                .eq('trabajador_id', userId)
                .eq('estado', 'ABIERTA')
                .maybeSingle();

            if (!error && data) {
                setActiveSession(data);
                // Calculate expected cash dynamically
                await fetchExpectedCash(data.id);
            } else {
                setActiveSession(null);
            }
        } catch (err) {
            console.error(err);
        } finally {
            setSessionLoading(false);
        }
    };

    const fetchExpectedCash = async (sessionId) => {
        try {
            // Fetch session opening amounts (declaracion de custodia)
            const { data: session } = await supabase
                .from('sesiones_caja')
                .select('monto_apertura, apertura_nequi, apertura_bancolombia')
                .eq('id', sessionId)
                .single();

            const openEf = Number(session?.monto_apertura || 0);
            const openNq = Number(session?.apertura_nequi || 0);
            const openBc = Number(session?.apertura_bancolombia || 0);

            // Fetch financial movements for this session (no apertura movements exist anymore)
            const { data: allMovs } = await supabase
                .from('movimientos_caja')
                .select('monto, tipo, metodo_pago')
                .eq('sesion_id', sessionId);

            const calcMovs = (method) => {
                const ing = (allMovs || []).filter(m => m.tipo === 'INGRESO' && m.metodo_pago === method).reduce((s, m) => s + Number(m.monto), 0);
                const egr = (allMovs || []).filter(m => m.tipo === 'EGRESO' && m.metodo_pago === method).reduce((s, m) => s + Number(m.monto), 0);
                return ing - egr;
            };

            // Esperado = apertura declarada + movimientos financieros de sesion
            setExpectedCashAtClose(openEf + calcMovs('EFECTIVO'));
            setExpectedNequiAtClose(openNq + calcMovs('NEQUI'));
            setExpectedBancoAtClose(openBc + calcMovs('BANCOLOMBIA'));
        } catch (err) {
            console.error(err);
        }
    };

    useEffect(() => {
        const getWorkerProfile = async () => {
            const { data: { session } } = await supabase.auth.getSession();
            if (session?.user) {
                const { data: profile } = await supabase
                    .from('perfiles_trabajadores')
                    .select('*')
                    .eq('id', session.user.id)
                    .single();
                setWorker(profile);
                if (profile) {
                    await fetchSession(profile.id);
                }
            }
        };
        getWorkerProfile();
        fetchProducts();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // Pending sale recovery on mount/reload
    useEffect(() => {
        const pendingRaw = localStorage.getItem(PENDING_SALE_KEY);
        if (!pendingRaw) return;

        let pending;
        try {
            pending = JSON.parse(pendingRaw);
        } catch {
            localStorage.removeItem(PENDING_SALE_KEY);
            return;
        }

        // Discard if older than 10 minutes
        if (Date.now() - pending.timestamp > 600000) {
            localStorage.removeItem(PENDING_SALE_KEY);
            return;
        }

        // There's a pending sale — show INDETERMINATE state
        setSaleStatus('INDETERMINATE');
        setErrorMessage('⚠️ Se detectó una venta pendiente de confirmar. Presiona "Reintentar verificación" para verificar su estado.');
    }, []);

    // Observer to hide mobile floating cart when #detalle-pedido is in viewport
    useEffect(() => {
        const target = document.getElementById('detalle-pedido');
        if (!target) return;

        const observer = new IntersectionObserver(
            ([entry]) => {
                setIsCartDetailsVisible(entry.isIntersecting);
            },
            { threshold: 0.05 }
        );

        observer.observe(target);
        return () => observer.disconnect();
    }, [cart.length]);

    // Derive categories from loaded products
    const categories = ['Todos', ...new Set(products.map(p => p.categoria))];
    const filteredProducts = products
        .filter(p => categoryFilter === 'Todos' || p.categoria === categoryFilter)
        .filter(p => !productSearch || p.nombre.toLowerCase().includes(productSearch.toLowerCase()));

    // Cart logic
    const addToCart = (product) => {
        setCart(prev => {
            const existing = prev.find(item => item.id === product.id);
            if (existing) {
                return prev.map(item => item.id === product.id ? { ...item, quantity: item.quantity + 1 } : item);
            }
            return [...prev, { ...product, quantity: 1 }];
        });
    };

    const updateQuantity = (productId, change) => {
        setCart(prev => {
            return prev.map(item => {
                if (item.id === productId) {
                    const newQty = item.quantity + change;
                    return { ...item, quantity: newQty };
                }
                return item;
            }).filter(item => item.quantity > 0);
        });
    };

    const removeFromCart = (productId) => {
        setCart(prev => prev.filter(item => item.id !== productId));
    };

    const subtotal = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    // Calculate effective discount based on type
    const effectiveDiscount = (() => {
        if (discountType === 'porcentaje') {
            const pct = Math.min(100, Math.max(0, discountInput));
            return Math.round(subtotal * pct / 100);
        }
        return Math.min(subtotal, Math.max(0, discountInput));
    })();
    const finalTotal = Math.max(0, subtotal - effectiveDiscount);

    // Sync effectiveDiscount → discount state (used by RPC)
    useEffect(() => {
        setDiscount(effectiveDiscount);
    }, [effectiveDiscount]);

    // Search clients
    const handleSearchClient = async (e) => {
        const query = e.target.value;
        setSearchQuery(query);
        if (query.trim().length < 2) {
            setClients([]);
            return;
        }

        setIsSearchingClient(true);
        const { data, error } = await supabase
            .from('clientes')
            .select('id, nombre, celular, stamps_count')
            .or(`nombre.ilike.%${query}%,celular.ilike.%${query}%`)
            .limit(5);

        if (!error && data) {
            setClients(data);
        }
        setIsSearchingClient(false);
    };

    // QR Scanner Camera Lifecycle
    const [qrCameraStatus, setQrCameraStatus] = useState('idle'); // 'idle' | 'requesting' | 'active' | 'error'
    const [qrCameraError, setQrCameraError] = useState('');

    useEffect(() => {
        let html5QrCode = null;
        let isMounted = true;
        let cameraTimeout = null;

        if (showQrModal) {
            setQrCameraStatus('requesting');
            setQrCameraError('');

            const timer = setTimeout(async () => {
                const qrRegionId = "pos-qr-reader-region";
                const element = document.getElementById(qrRegionId);
                if (!element) return;

                // Pre-check camera availability
                if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
                    if (isMounted) {
                        setQrCameraStatus('error');
                        setQrCameraError('Tu navegador no soporta acceso a la cámara. Usa Chrome o Safari actualizados.');
                    }
                    return;
                }

                // Check HTTPS requirement (camera requires secure context)
                if (location.protocol !== 'https:' && location.hostname !== 'localhost' && location.hostname !== '127.0.0.1') {
                    if (isMounted) {
                        setQrCameraStatus('error');
                        setQrCameraError('Se requiere conexión HTTPS para acceder a la cámara. Usa un tunnel seguro.');
                    }
                    return;
                }

                html5QrCode = new Html5Qrcode(qrRegionId);
                
                const qrboxFunction = (viewfinderWidth, viewfinderHeight) => {
                    const minEdgeSize = Math.min(viewfinderWidth, viewfinderHeight);
                    const size = Math.floor(minEdgeSize * 0.85);
                    return { width: size, height: size };
                };

                const config = { 
                    fps: 15, 
                    qrbox: qrboxFunction,
                    aspectRatio: 1.0
                };

                // Set a timeout for camera initialization
                cameraTimeout = setTimeout(() => {
                    if (isMounted && qrCameraStatus === 'requesting') {
                        setQrCameraStatus('error');
                        setQrCameraError('La cámara tardó demasiado en responder. Verifica los permisos del navegador e intenta de nuevo.');
                    }
                }, 8000);

                html5QrCode.start(
                    { facingMode: "environment" },
                    config,
                    async (decodedText) => {
                        if (isMounted) {
                            console.log("🔥 QR Code Scanned:", decodedText);
                            await handleScannedQr(decodedText, html5QrCode);
                        }
                    },
                    () => {}
                ).then(() => {
                    if (isMounted) {
                        clearTimeout(cameraTimeout);
                        setQrCameraStatus('active');
                    }
                }).catch(err => {
                    console.error("Camera access error:", err);
                    clearTimeout(cameraTimeout);
                    if (isMounted) {
                        setQrCameraStatus('error');
                        const msg = String(err?.message || err || '');
                        if (msg.includes('Permission') || msg.includes('NotAllowed')) {
                            setQrCameraError('Permiso de cámara denegado. Ve a la configuración del navegador y permite el acceso a la cámara.');
                        } else if (msg.includes('NotFound') || msg.includes('DevicesNotFound')) {
                            setQrCameraError('No se encontró una cámara en este dispositivo.');
                        } else {
                            setQrCameraError('No se pudo acceder a la cámara. Verifica los permisos del navegador.');
                        }
                    }
                });
            }, 300);

            return () => {
                isMounted = false;
                clearTimeout(timer);
                clearTimeout(cameraTimeout);
                if (html5QrCode) {
                    if (html5QrCode.isScanning) {
                        html5QrCode.stop().then(() => html5QrCode.clear()).catch(console.error);
                    } else {
                        try { html5QrCode.clear(); } catch { /* ignore */ }
                    }
                }
            };
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [showQrModal]);

    const handleScannedQr = async (decodedText, scanner) => {
        try {
            if (scanner && scanner.isScanning) {
                await scanner.stop();
                scanner.clear();
            }
            setShowQrModal(false);

            let rawText = decodedText.trim();
            let searchId = rawText;

            // Extract UUID if present in decoded string
            const uuidMatch = rawText.match(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i);
            if (uuidMatch) {
                searchId = uuidMatch[0];
            } else if (rawText.includes('clientId=')) {
                const match = rawText.match(/clientId=([^&]+)/);
                if (match && match[1]) searchId = match[1];
            } else {
                try {
                    const parsed = JSON.parse(rawText);
                    searchId = parsed.id || parsed.cliente_id || parsed.celular || searchId;
                } catch {
                    // Raw string
                }
            }

            console.log("🔥 Searching client for searchId:", searchId);

            // Query Supabase safely
            let query = supabase.from('clientes').select('*');
            const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i.test(searchId);

            if (isUuid) {
                query = query.eq('id', searchId);
            } else {
                query = query.or(`celular.eq.${searchId},referral_code.eq.${searchId}`);
            }

            const { data: client, error } = await query.maybeSingle();

            if (!error && client) {
                // Multi-stamp: if primary client exists, add to extras
                if (selectedClient) {
                    if (client.id === selectedClient.id || extraClients.some(ec => ec.id === client.id)) {
                        setSuccessMessage(`⚠️ ${client.nombre} ya tiene sello asignado en esta venta.`);
                    } else {
                        setExtraClients(prev => [...prev, client]);
                        setSuccessMessage(`🔥 Sello adicional para: ${client.nombre}`);
                    }
                } else {
                    setSelectedClient(client);
                    setSuccessMessage(`🔥 ¡Cliente asociado con éxito: ${client.nombre}!`);
                }
            } else {
                setErrorMessage(`Cliente no encontrado para el código: "${searchId}". Puedes crearlo a continuación.`);
                setNewClientForm({ nombre: '', celular: /^\d+$/.test(searchId) ? searchId : '', email: '' });
                setShowNewClientModal(true);
            }
        } catch (err) {
            console.error("Error processing QR scan:", err);
            setErrorMessage("Error al procesar el código QR.");
            setShowQrModal(false);
        }
    };

    const handleRegisterNewClient = async (e) => {
        e.preventDefault();
        if (!newClientForm.nombre.trim() || !newClientForm.celular.trim()) {
            setNewClientError('Por favor completa Nombre y Celular.');
            return;
        }

        setIsRegisteringClient(true);
        setNewClientError('');

        try {
            const referralCode = 'TITAN-' + Math.random().toString(36).substring(2, 7).toUpperCase();
            const { data: newClient, error } = await supabase
                .from('clientes')
                .insert([{
                    nombre: newClientForm.nombre.trim(),
                    celular: newClientForm.celular.trim(),
                    email: newClientForm.email.trim() || null,
                    referral_code: referralCode,
                    stamps_count: 0
                }])
                .select()
                .single();

            if (error) throw error;

            setSelectedClient(newClient);
            setShowNewClientModal(false);
            setNewClientForm({ nombre: '', celular: '', email: '' });
            setSuccessMessage(`🔥 ¡Nuevo cliente registrado y asociado: ${newClient.nombre}!`);
        } catch (err) {
            console.error('Error registering new client:', err);
            setNewClientError(err.message || 'Error al registrar el nuevo cliente.');
        } finally {
            setIsRegisteringClient(false);
        }
    };

    const handleLogout = async () => {
        await supabase.auth.signOut();
        sessionStorage.clear();
        navigate('/login');
    };

    // Open cash drawer handler
    // Bloque 10: Fetch recent sales for this worker
    const fetchRecentSales = async () => {
        setRecentSalesLoading(true);
        try {
            const { data, error } = await supabase
                .from('ventas')
                .select('id, fecha, total, metodo_pago, estado, detalles, clientes(nombre)')
                .eq('trabajador_id', worker?.id)
                .order('fecha', { ascending: false })
                .limit(15);
            if (!error && data) setRecentSales(data);
        } catch (err) {
            console.error('Error fetching recent sales:', err);
        } finally {
            setRecentSalesLoading(false);
        }
    };

    const handleSolicitarAnulacion = async () => {
        if (!showAnulacionModal || !anulacionMotivo.trim()) return;
        setAnulacionSubmitting(true);
        try {
            const { data, error } = await supabase.rpc('solicitar_anulacion_venta', {
                p_venta_id: showAnulacionModal.id,
                p_motivo: anulacionMotivo.trim()
            });
            if (error) throw error;
            if (data && !data.success) throw new Error(data.message);
            setSuccessMessage(data.message || 'Solicitud de anulación enviada.');
            setShowAnulacionModal(null);
            setAnulacionMotivo('');
            await fetchRecentSales();
        } catch (err) {
            setErrorMessage('Error: ' + err.message);
        } finally {
            setAnulacionSubmitting(false);
        }
    };

    const handleOpenSession = async () => {
        setLoading(true);
        setErrorMessage('');
        try {
            const { data, error } = await supabase.rpc('abrir_caja', {
                p_monto_apertura: Number(openCashAmount),
                p_apertura_nequi: Number(openNequiAmount),
                p_apertura_bancolombia: Number(openBancoAmount)
            });

            if (error) throw new Error(error.message);
            if (data && !data.success) throw new Error(data.message);

            if (worker) {
                await fetchSession(worker.id);
            }
        } catch (err) {
            setErrorMessage(err.message || 'Error al abrir la caja.');
        } finally {
            setLoading(false);
        }
    };

    // Close cash drawer handler
    const handleCloseSession = async () => {
        setLoading(true);
        setErrorMessage('');
        try {
            const { data, error } = await supabase.rpc('cerrar_caja', {
                p_monto_cierre_contado: Number(closeCashCounted),
                p_observaciones: closeObservations,
                p_contado_nequi: Number(closeNequiCounted),
                p_contado_bancolombia: Number(closeBancoCounted)
            });

            if (error) throw new Error(error.message);
            if (data && !data.success) throw new Error(data.message);

            setShowCloseModal(false);
            setActiveSession(null);
            setCloseObservations('');
            setCloseCashCounted(0);
            setCloseNequiCounted(0);
            setCloseBancoCounted(0);

            const difTotal = data.total?.diferencia ?? data.diferencia ?? 0;
            alert(`Caja cerrada. Diferencia total: $${Number(difTotal).toLocaleString()}`);
            
            if (worker) {
                await fetchSession(worker.id);
            }
        } catch (err) {
            setErrorMessage(err.message || 'Error al cerrar la caja.');
        } finally {
            setLoading(false);
        }
    };

    // Helper: execute RPC with timeout
    const rpcWithTimeout = (params, timeoutMs) => {
        return Promise.race([
            supabase.rpc('registrar_venta', params),
            new Promise((_, reject) =>
                setTimeout(() => reject(new Error('TIMEOUT')), timeoutMs)
            )
        ]);
    };

    // Helper: clear cart and UI after confirmed sale
    const clearSaleUI = () => {
        setCart([]);
        setDiscount(0);
        setDiscountInput(0);
        setDiscountType('pesos');
        setSelectedClient(null);
        setExtraClients([]);
        setSearchQuery('');
        setClients([]);
        setPaymentMethod('EFECTIVO');
        setCashAmount(0);
        setNequiAmount(0);
        setBancolombiaAmount(0);
    };

    // Core sale execution — used by both initial attempt and recovery
    const executeSale = async (rpcParams) => {
        try {
            const { data, error } = await rpcWithTimeout(rpcParams, SALE_TIMEOUT_MS);

            if (error) throw new Error(error.message);
            if (data && !data.success) throw new Error(data.message);

            // SUCCESS — sale confirmed (either new or recovered)
            localStorage.removeItem(PENDING_SALE_KEY);
            const recoveryNote = data.recovered ? ' (confirmada tras verificación)' : '';
            setSuccessMessage(
                `Venta registrada con éxito${recoveryNote}. ${data.earned_stamps > 0 ? `🔥 ¡${data.earned_stamps} sello${data.earned_stamps > 1 ? 's' : ''} de fidelización asignado${data.earned_stamps > 1 ? 's' : ''}!` : ''}`
            );
            setSaleStatus('SUCCESS');
            clearSaleUI();

            // Fire-and-forget: update expected cash (decoupled from sale result)
            if (activeSession) {
                fetchExpectedCash(activeSession.id).catch(e =>
                    console.warn('Error actualizando saldo esperado:', e)
                );
            }
            return true;
        } catch (err) {
            if (err.message === 'TIMEOUT') {
                // INDETERMINATE — we don't know if the sale was committed
                setSaleStatus('INDETERMINATE');
                setErrorMessage('⚠️ La operación tardó más de lo esperado. Verificando...');
                setSuccessMessage('');

                // Automatic retry with SAME key (idempotent)
                try {
                    setSaleStatus('RECOVERING');
                    const { data: retryData, error: retryError } = await rpcWithTimeout(rpcParams, SALE_TIMEOUT_MS);

                    if (retryError) throw new Error(retryError.message);
                    if (retryData && !retryData.success) throw new Error(retryData.message);

                    // RECOVERED
                    localStorage.removeItem(PENDING_SALE_KEY);
                    const recNote = retryData.recovered ? ' (confirmada tras verificación)' : '';
                    setSuccessMessage(`✅ Venta registrada con éxito${recNote}.`);
                    setErrorMessage('');
                    setSaleStatus('SUCCESS');
                    clearSaleUI();

                    if (activeSession) {
                        fetchExpectedCash(activeSession.id).catch(e =>
                            console.warn('Error actualizando saldo esperado:', e)
                        );
                    }
                    return true;
                } catch (retryErr) {
                    if (retryErr.message === 'TIMEOUT') {
                        setSaleStatus('INDETERMINATE');
                        setErrorMessage('⚠️ No se pudo confirmar la venta. Presiona "Reintentar verificación" o contacta al administrador. NO registres la venta nuevamente.');
                    } else {
                        setSaleStatus('ERROR');
                        setErrorMessage(retryErr.message || 'Error al verificar la venta.');
                        localStorage.removeItem(PENDING_SALE_KEY);
                    }
                    return false;
                }
            } else {
                // CONFIRMED ERROR — sale did NOT happen (business logic error or RPC rejection)
                setSaleStatus('ERROR');
                setErrorMessage(err.message || 'Error al registrar la venta.');
                localStorage.removeItem(PENDING_SALE_KEY);
                return false;
            }
        }
    };

    // Retry handler for INDETERMINATE state
    const handleRetryVerification = async () => {
        const pendingRaw = localStorage.getItem(PENDING_SALE_KEY);
        if (!pendingRaw) {
            setErrorMessage('No hay operación pendiente para verificar.');
            setSaleStatus('READY');
            return;
        }

        let pending;
        try {
            pending = JSON.parse(pendingRaw);
        } catch {
            localStorage.removeItem(PENDING_SALE_KEY);
            setErrorMessage('Datos de operación pendiente corruptos. Operación cancelada.');
            setSaleStatus('READY');
            return;
        }

        // Check age — discard if older than 10 minutes
        if (Date.now() - pending.timestamp > 600000) {
            localStorage.removeItem(PENDING_SALE_KEY);
            setErrorMessage('La operación pendiente expiró (más de 10 minutos). Verifica manualmente en ventas recientes.');
            setSaleStatus('READY');
            return;
        }

        setLoading(true);
        isSubmittingRef.current = true;
        setSaleStatus('RECOVERING');
        setErrorMessage('🔄 Verificando estado de la venta...');
        setSuccessMessage('');

        await executeSale(pending.rpcParams);

        setLoading(false);
        isSubmittingRef.current = false;
    };

    const handleRegisterSale = async () => {
        // B18: Prevent double-click
        if (isSubmittingRef.current) return;

        // Block if there's an unresolved INDETERMINATE operation
        if (saleStatus === 'INDETERMINATE' || saleStatus === 'RECOVERING') {
            setErrorMessage('⚠️ Existe una operación pendiente. Usa "Reintentar verificación" antes de registrar una nueva venta.');
            return;
        }

        if (!activeSession) {
            setErrorMessage('Se requiere abrir caja antes de registrar ventas.');
            return;
        }

        if (cart.length === 0) {
            setErrorMessage('El carrito está vacío.');
            return;
        }

        if (paymentMethod === 'MIXTO') {
            const totalMixed = Number(cashAmount) + Number(nequiAmount) + Number(bancolombiaAmount);
            if (totalMixed !== finalTotal) {
                setErrorMessage(`El total de los montos mixtos ($${totalMixed.toLocaleString()}) debe ser exactamente igual al total de la venta ($${finalTotal.toLocaleString()}).`);
                return;
            }
        }

        // Generate idempotency key ONCE for this operation
        const operationKey = crypto.randomUUID();

        const rpcParams = {
            p_cliente_id: selectedClient ? selectedClient.id : null,
            p_total: finalTotal,
            p_metodo_pago: paymentMethod,
            p_detalles: { items: cart, subtotal, discount },
            p_monto_efectivo: paymentMethod === 'MIXTO' ? Number(cashAmount) : 0,
            p_monto_nequi: paymentMethod === 'MIXTO' ? Number(nequiAmount) : 0,
            p_monto_bancolombia: paymentMethod === 'MIXTO' ? Number(bancolombiaAmount) : 0,
            p_clientes_extra: extraClients.map(c => c.id),
            p_idempotency_key: operationKey
        };

        // Persist pending sale BEFORE sending RPC
        localStorage.setItem(PENDING_SALE_KEY, JSON.stringify({
            key: operationKey,
            rpcParams,
            timestamp: Date.now()
        }));

        setLoading(true);
        isSubmittingRef.current = true;
        setErrorMessage('');
        setSuccessMessage('');
        setSaleStatus('REGISTERING');

        await executeSale(rpcParams);

        setLoading(false);
        isSubmittingRef.current = false;
    };


    if (sessionLoading) {
        return (
            <div className="min-h-screen bg-zinc-950 text-white flex items-center justify-center font-serif text-xl animate-pulse">
                Cargando caja...
            </div>
        );
    }

    // Cash Drawer Closed screen (Block workspace)
    if (!activeSession) {
        return (
            <div className="min-h-screen bg-zinc-950 text-white flex items-center justify-center p-6 relative font-sans">
                <div className="w-full max-w-md bg-zinc-900 border border-zinc-800 rounded-3xl p-8 shadow-2xl relative">
                    <div className="text-center mb-6">
                        <div className="w-12 h-12 bg-fire/10 border border-fire/30 text-fire rounded-full flex items-center justify-center mx-auto mb-4">
                            <Key size={24} />
                        </div>
                        <h2 className="text-2xl font-bold font-serif text-white">Caja Cerrada</h2>
                        <p className="text-zinc-500 text-xs mt-2">Ingresa el dinero físico en efectivo con el que comienzas la jornada para dar vueltas</p>
                    </div>

                    <div className="space-y-4">
                        <div>
                            <label className="text-xs font-bold uppercase tracking-wider text-zinc-400 block mb-2">💵 Fondo Inicial de Efectivo ($)</label>
                            <NumericInput
                                className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-3 text-white focus:border-fire outline-none text-center font-bold text-lg"
                                value={openCashAmount}
                                onChange={setOpenCashAmount}
                                min={0}
                            />
                        </div>

                        {/* Otros medios de pago — opcionales */}
                        <details className="group">
                            <summary className="text-[10px] font-bold uppercase tracking-wider text-zinc-600 cursor-pointer hover:text-zinc-400 transition-colors select-none list-none flex items-center gap-1">
                                <ChevronDown size={12} className="group-open:rotate-180 transition-transform" />
                                Incluir saldos de otros medios (opcional)
                            </summary>
                            <div className="space-y-3 mt-3">
                                <div>
                                    <label className="text-xs font-bold uppercase tracking-wider text-pink-400/70 block mb-1">📱 Nequi ($)</label>
                                    <NumericInput
                                        className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-2.5 text-white focus:border-pink-500 outline-none text-center font-bold"
                                        value={openNequiAmount}
                                        onChange={setOpenNequiAmount}
                                        min={0}
                                    />
                                </div>
                                <div>
                                    <label className="text-xs font-bold uppercase tracking-wider text-yellow-400/70 block mb-1">🏦 Bancolombia ($)</label>
                                    <NumericInput
                                        className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-2.5 text-white focus:border-yellow-500 outline-none text-center font-bold"
                                        value={openBancoAmount}
                                        onChange={setOpenBancoAmount}
                                        min={0}
                                    />
                                </div>
                            </div>
                        </details>

                        {errorMessage && (
                            <div className="p-2.5 bg-red-500/10 border border-red-500/20 text-red-500 text-xs rounded text-center">
                                {errorMessage}
                            </div>
                        )}

                        <button
                            onClick={handleOpenSession}
                            disabled={loading}
                            className="w-full bg-fire hover:bg-orange-700 text-white py-3.5 rounded-xl font-bold transition-all shadow-lg shadow-fire/10 active:scale-[0.99] uppercase text-sm tracking-wider"
                        >
                            {loading ? 'Abriendo Caja...' : 'Abrir Caja'}
                        </button>
                    </div>

                    <div className="border-t border-zinc-800 mt-6 pt-4 flex justify-between items-center text-xs text-zinc-500">
                        <span>Operador: {worker?.nombre}</span>
                        <button onClick={handleLogout} className="text-red-400 hover:underline">Salir</button>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-zinc-950 text-white flex flex-col font-sans">
            {/* Header */}
            <header className="bg-zinc-900 border-b border-zinc-800 py-4 px-6 flex justify-between items-center shadow-lg">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-fire rounded-full flex items-center justify-center font-bold text-white shadow-lg">T</div>
                    <div>
                        <h1 className="text-xl font-bold tracking-wider font-serif">TITAN GRILL POS</h1>
                        <p className="text-xs text-zinc-500">Caja Abierta · Fondo Inicial: ${activeSession.monto_apertura.toLocaleString()}</p>
                    </div>
                </div>

                <div className="flex items-center gap-3 lg:gap-6">
                    {/* Expected Cash Drawer Indicator */}
                    <div className="hidden lg:flex flex-col text-right">
                        <span className="text-[10px] text-zinc-500 uppercase tracking-widest font-bold">Efectivo en Caja</span>
                        <span className="text-sm font-bold text-green-400">${expectedCashAtClose.toLocaleString()}</span>
                    </div>

                    {/* Back to Admin (Admins only) */}
                    {worker?.rol === 'ADMINISTRADOR' && (
                        <button
                            onClick={() => navigate('/admin')}
                            className="text-xs font-bold text-zinc-400 hover:text-white bg-zinc-800 px-3.5 py-2 rounded-lg transition-colors border border-zinc-700"
                        >
                            Ir al Admin
                        </button>
                    )}

                    <button
                        onClick={() => { setShowRecentSalesModal(true); fetchRecentSales(); }}
                        className="bg-zinc-800 hover:bg-zinc-700 text-zinc-300 hover:text-white text-xs font-bold px-3 py-2 rounded-lg transition-all border border-zinc-700 whitespace-nowrap"
                    >
                        <span className="hidden sm:inline">Mis Ventas</span>
                        <span className="sm:hidden">Ventas</span>
                    </button>

                    <button
                        onClick={() => setShowCloseModal(true)}
                        className="bg-zinc-800 hover:bg-zinc-700 text-zinc-300 hover:text-white text-xs font-bold px-3 lg:px-4 py-2 rounded-lg transition-all border border-zinc-700 whitespace-nowrap"
                    >
                        <span className="hidden sm:inline">Cerrar Turno (Arqueo)</span>
                        <span className="sm:hidden">Arqueo</span>
                    </button>

                    <button
                        onClick={handleLogout}
                        className="bg-red-500/10 hover:bg-red-500/20 text-red-400 text-xs font-bold p-2 rounded-lg transition-all border border-red-500/20"
                        title="Cerrar sesión"
                    >
                        <LogOut size={16} />
                    </button>

                    {worker && (
                        <div className="hidden md:flex items-center gap-3 bg-zinc-850 px-4 py-2 rounded-lg border border-zinc-800">
                            <User size={18} className="text-fire" />
                            <div className="text-left">
                                <p className="text-sm font-semibold leading-none">{worker.nombre}</p>
                                <p className="text-[10px] text-zinc-400 capitalize mt-1">{worker.rol.toLowerCase()}</p>
                            </div>
                        </div>
                    )}
                </div>
            </header>

            {/* Main Workspace Area */}
            <div className="flex-1 flex flex-col lg:flex-row overflow-hidden">
                {/* Left Side: Products Grid */}
                <main className="flex-1 p-4 lg:p-6 flex flex-col gap-4 lg:gap-6 overflow-y-auto">
                    {/* Search + Category Filter */}
                    <div className="flex flex-col gap-3">
                        {/* Product search */}
                        <div className="relative">
                            <input
                                type="text"
                                placeholder="Buscar producto..."
                                className="w-full bg-zinc-900 border border-zinc-800 rounded-lg pl-9 pr-4 py-2 text-sm text-white focus:border-fire outline-none transition-colors"
                                value={productSearch}
                                onChange={(e) => setProductSearch(e.target.value)}
                            />
                            <Search size={15} className="absolute left-3 top-2.5 text-zinc-500" />
                        </div>
                        {/* Category pills */}
                        <div className="flex gap-2 pb-1 overflow-x-auto">
                            {categories.map(cat => (
                                <button
                                    key={cat}
                                    onClick={() => setCategoryFilter(cat)}
                                    className={`px-5 py-2 rounded-lg text-sm font-semibold tracking-wide border transition-all whitespace-nowrap ${
                                        categoryFilter === cat
                                            ? 'bg-fire border-fire text-white shadow-lg shadow-fire/20'
                                            : 'bg-zinc-900 border-zinc-800 text-zinc-400 hover:border-zinc-700 hover:text-white'
                                    }`}
                                >
                                    {cat}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Products Grid */}
                    {productsLoading ? (
                        <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-6">
                            {[...Array(8)].map((_, i) => (
                                <div key={i} className="bg-zinc-900 border border-zinc-800 rounded-xl p-5 animate-pulse h-32" />
                            ))}
                        </div>
                    ) : filteredProducts.length === 0 ? (
                        <div className="text-center py-16 text-zinc-500 text-sm">No hay productos disponibles.</div>
                    ) : (
                        <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-6">
                            {filteredProducts.map(product => {
                                const cartItem = cart.find(item => item.id === product.id);
                                const inCartCount = cartItem ? cartItem.quantity : 0;

                                return (
                                    <div 
                                        key={product.id}
                                        onClick={() => addToCart({ ...product, name: product.nombre, price: Number(product.precio), category: product.categoria })}
                                        className={`bg-zinc-900 border rounded-xl p-5 cursor-pointer flex flex-col justify-between transition-all group relative active:scale-[0.98] ${
                                            inCartCount > 0 
                                                ? 'border-fire ring-1 ring-fire/50 shadow-lg shadow-fire/10 bg-zinc-900/90' 
                                                : 'border-zinc-800 hover:border-fire/50 hover:shadow-xl hover:shadow-fire/5'
                                        }`}
                                    >
                                        {/* Insignia cuando el producto está en el carrito */}
                                        {inCartCount > 0 && (
                                            <div className="absolute -top-2.5 -right-2.5 bg-fire text-white text-xs font-black px-2.5 py-0.5 rounded-full shadow-lg border border-orange-400 flex items-center gap-1">
                                                <span>x{inCartCount}</span>
                                            </div>
                                        )}

                                        <div>
                                            <span className="text-[10px] text-fire uppercase tracking-widest font-bold bg-fire/10 px-2 py-1 rounded">
                                                {product.categoria}
                                            </span>
                                            <h3 className="font-bold text-lg mt-3 text-zinc-100 group-hover:text-white transition-colors">{product.nombre}</h3>
                                        </div>

                                        <div className="flex justify-between items-center mt-6">
                                            <span className="text-xl font-bold text-white">${Number(product.precio).toLocaleString()}</span>
                                            
                                            {inCartCount > 0 ? (
                                                <div 
                                                    className="flex items-center gap-1.5 bg-zinc-950 border border-fire/40 p-1 rounded-lg shadow-inner"
                                                    onClick={(e) => e.stopPropagation()}
                                                >
                                                    <button 
                                                        type="button"
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            updateQuantity(product.id, -1);
                                                        }}
                                                        className="w-7 h-7 rounded bg-zinc-800 hover:bg-fire/80 text-white flex items-center justify-center font-bold transition-colors"
                                                    >
                                                        <Minus size={14} />
                                                    </button>
                                                    <span className="text-sm font-black text-fire w-5 text-center">{inCartCount}</span>
                                                    <button 
                                                        type="button"
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            updateQuantity(product.id, 1);
                                                        }}
                                                        className="w-7 h-7 rounded bg-fire hover:bg-orange-700 text-white flex items-center justify-center font-bold transition-colors"
                                                    >
                                                        <Plus size={14} />
                                                    </button>
                                                </div>
                                            ) : (
                                                <div className="w-8 h-8 bg-zinc-800 group-hover:bg-fire rounded-lg flex items-center justify-center transition-colors">
                                                    <Plus size={18} className="text-zinc-400 group-hover:text-white transition-colors" />
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </main>

                {/* Right Side: Cart Checkout */}
                <aside id="detalle-pedido" className="w-full lg:w-[420px] bg-zinc-900 border-t lg:border-t-0 lg:border-l border-zinc-800 flex flex-col justify-between shadow-2xl relative z-10 scroll-mt-4">
                    <div className="p-6 flex-1 flex flex-col gap-6 overflow-y-auto font-sans">
                        <div className="flex items-center gap-2 border-b border-zinc-800 pb-4">
                            <ShoppingCart className="text-fire" />
                            <h2 className="text-lg font-bold font-serif tracking-wide">Detalle del Pedido</h2>
                            <span className="ml-auto bg-zinc-850 px-2.5 py-0.5 rounded-full text-xs font-bold text-zinc-400">
                                {cart.reduce((sum, item) => sum + item.quantity, 0)}
                            </span>
                        </div>

                        {/* Cart items */}
                        <div className="flex-1 space-y-4 max-h-[200px] lg:max-h-[280px] overflow-y-auto pr-1">
                            {cart.length === 0 ? (
                                <div className="text-center py-12 text-zinc-500">
                                    <ShoppingCart size={40} className="mx-auto opacity-20 mb-3" />
                                    <p className="text-sm">El carrito está vacío</p>
                                </div>
                            ) : (
                                cart.map(item => (
                                    <div key={item.id} className="flex justify-between items-center bg-zinc-950 p-3 rounded-lg border border-zinc-850">
                                        <div>
                                            <h4 className="font-semibold text-sm text-zinc-200">{item.name}</h4>
                                            <span className="text-xs text-zinc-500">${item.price.toLocaleString()}</span>
                                        </div>
                                        <div className="flex items-center gap-3">
                                            <button 
                                                onClick={() => updateQuantity(item.id, -1)}
                                                className="w-6 h-6 rounded bg-zinc-850 hover:bg-zinc-850 flex items-center justify-center text-zinc-400 hover:text-white transition-colors"
                                            >
                                                <Minus size={14} />
                                            </button>
                                            <span className="text-sm font-bold w-4 text-center">{item.quantity}</span>
                                            <button 
                                                onClick={() => updateQuantity(item.id, 1)}
                                                className="w-6 h-6 rounded bg-zinc-850 hover:bg-zinc-850 flex items-center justify-center text-zinc-400 hover:text-white transition-colors"
                                            >
                                                <Plus size={14} />
                                            </button>
                                            <button 
                                                onClick={() => removeFromCart(item.id)}
                                                className="text-zinc-600 hover:text-red-500 transition-colors ml-1"
                                            >
                                                <Trash2 size={16} />
                                            </button>
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>

                        {/* Client Search (Fidelización) */}
                        <div className="border-t border-zinc-800 pt-4 space-y-3">
                            <div className="flex justify-between items-center mb-1">
                                <label className="text-xs font-bold uppercase tracking-wider text-zinc-400">
                                    {selectedClient ? "Asociar Más Clientes" : "Asociar Cliente"}
                                </label>
                                <div className="flex gap-1.5">
                                    <button
                                        type="button"
                                        onClick={() => setShowQrModal(true)}
                                        className="bg-fire hover:bg-orange-700 text-white px-2.5 py-1 rounded-lg text-[11px] font-bold flex items-center gap-1 shadow transition-all active:scale-95"
                                    >
                                        <QrCode size={13} />
                                        📷 QR
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setShowNewClientModal(true)}
                                        className="bg-zinc-800 hover:bg-zinc-700 text-zinc-200 px-2.5 py-1 rounded-lg text-[11px] font-bold flex items-center gap-1 border border-zinc-700 transition-all active:scale-95"
                                    >
                                        <UserPlus size={13} />
                                        ➕ Nuevo
                                    </button>
                                </div>
                            </div>

                            {/* Search Bar Always at the Top */}
                            <div className="relative">
                                <input
                                    id="client-search-input"
                                    type="text"
                                    placeholder={selectedClient ? "Buscar otro cliente para agregar (celular/nombre)..." : "Buscar por Nombre o Celular..."}
                                    className="w-full bg-zinc-950 border border-zinc-800 rounded-lg pl-9 pr-4 py-2 text-sm text-white focus:border-fire outline-none transition-colors"
                                    value={searchQuery}
                                    onChange={handleSearchClient}
                                />
                                <Search size={16} className="absolute left-3 top-2.5 text-zinc-600" />
                                {isSearchingClient && (
                                    <RefreshCw size={14} className="absolute right-3 top-3 text-fire animate-spin" />
                                )}
                                {clients.length > 0 && (
                                    <div className="absolute left-0 right-0 top-full mt-1 bg-zinc-950 border border-zinc-850 rounded-lg shadow-2xl z-55 max-h-[160px] overflow-y-auto">
                                        {clients.map(c => (
                                            <div
                                                key={c.id}
                                                onClick={() => {
                                                    if (!selectedClient) {
                                                        setSelectedClient(c);
                                                    } else {
                                                        if (c.id === selectedClient.id || extraClients.some(ec => ec.id === c.id)) {
                                                            setErrorMessage(`⚠️ ${c.nombre} ya tiene sello asignado en esta venta.`);
                                                        } else {
                                                            setExtraClients(prev => [...prev, c]);
                                                            setSuccessMessage(`🔥 Sello adicional para: ${c.nombre}`);
                                                        }
                                                    }
                                                    setClients([]);
                                                    setSearchQuery('');
                                                }}
                                                className="p-3 hover:bg-zinc-900 border-b border-zinc-900 cursor-pointer text-left transition-colors"
                                            >
                                                <p className="text-xs font-bold text-zinc-200">{c.nombre}</p>
                                                <p className="text-[10px] text-zinc-500">{c.celular} • {c.stamps_count} Fuegos</p>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>

                            {/* Selected Clients Area */}
                            {selectedClient && (
                                <div className="space-y-2 mt-4">
                                    <div className="flex items-center gap-2 mb-1">
                                        <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">Cliente Principal</p>
                                        {(extraClients.length > 0) && (
                                            <span className="bg-fire/20 text-fire text-[10px] font-black px-2 py-0.5 rounded-full">
                                                +{extraClients.length} extras
                                            </span>
                                        )}
                                    </div>

                                    <div className="flex justify-between items-center bg-fire/10 border border-fire/30 p-3 rounded-lg animate-fadeIn">
                                        <div>
                                            <p className="text-sm font-bold text-fire">{selectedClient.nombre}</p>
                                            <p className="text-xs text-zinc-400">{selectedClient.celular} • {selectedClient.stamps_count} Fuegos</p>
                                        </div>
                                        <button 
                                            onClick={() => {
                                                setSelectedClient(null);
                                                setExtraClients([]); // Limpiar extras si se quita el principal
                                            }}
                                            className="text-xs bg-fire/20 hover:bg-fire/35 text-fire px-2.5 py-1 rounded font-bold"
                                        >
                                            Quitar
                                        </button>
                                    </div>

                                    {selectedClient.stamps_count >= 10 && (
                                        <div className="bg-amber-500/15 border border-amber-500/40 p-3 rounded-xl flex items-center justify-between shadow-lg shadow-amber-500/10">
                                            <div>
                                                <p className="text-xs font-black text-amber-400 flex items-center gap-1">
                                                    🎁 ¡PREMIO DE FIDELIZACIÓN!
                                                </p>
                                                <p className="text-[10px] text-zinc-300">10 Fuegos acumulados. ¡Hamburguesa Gratis!</p>
                                            </div>
                                            <button
                                                type="button"
                                                onClick={async () => {
                                                    try {
                                                        const newStamps = Math.max(0, selectedClient.stamps_count - 10);
                                                        const { data, error } = await supabase
                                                            .from('clientes')
                                                            .update({ stamps_count: newStamps })
                                                            .eq('id', selectedClient.id)
                                                            .select()
                                                            .single();
                                                        if (!error && data) {
                                                            setSelectedClient(data);
                                                            setSuccessMessage('🎉 ¡Premio canjeado con éxito! Se descontaron 10 Fuegos del cliente.');
                                                        }
                                                    } catch (err) {
                                                        console.error('Error redeeming prize:', err);
                                                    }
                                                }}
                                                className="bg-amber-500 hover:bg-amber-600 text-zinc-950 font-black text-[11px] px-3 py-1.5 rounded-lg transition-all shadow-md active:scale-95"
                                            >
                                                🎉 Canjear
                                            </button>
                                        </div>
                                    )}

                                    {/* Multi-stamp: extra clients for this sale */}
                                    {extraClients.length > 0 && (
                                        <div className="space-y-1 mt-3">
                                            <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">Sellos adicionales</p>
                                            {extraClients.map(ec => (
                                                <div key={ec.id} className="flex justify-between items-center bg-zinc-800/50 border border-zinc-700 p-2 rounded-lg text-xs">
                                                    <span className="text-zinc-300">🔥 {ec.nombre}</span>
                                                    <button onClick={() => setExtraClients(prev => prev.filter(x => x.id !== ec.id))} className="text-red-400 hover:text-red-300 text-[10px] font-bold">✕</button>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>

                        {/* Payment Method */}
                        <div className="border-t border-zinc-800 pt-4 space-y-3">
                            <label className="text-xs font-bold uppercase tracking-wider text-zinc-400 block">Método de Pago</label>
                            
                            {/* Fast-touch payment buttons */}
                            <div className="grid grid-cols-2 gap-2">
                                {[
                                    { id: 'EFECTIVO', label: '💵 Efectivo', color: 'border-green-500/30 text-green-400 bg-green-500/10' },
                                    { id: 'NEQUI', label: '📱 Nequi', color: 'border-pink-500/30 text-pink-400 bg-pink-500/10' },
                                    { id: 'BANCOLOMBIA', label: '🏦 Bancolombia', color: 'border-yellow-500/30 text-yellow-400 bg-yellow-500/10' },
                                    { id: 'MIXTO', label: '🔀 Pago Mixto', color: 'border-fire/30 text-fire bg-fire/10' },
                                ].map((method) => (
                                    <button
                                        key={method.id}
                                        type="button"
                                        onClick={() => {
                                            setPaymentMethod(method.id);
                                            if (method.id !== 'MIXTO') {
                                                setCashAmount(0);
                                                setNequiAmount(0);
                                                setBancolombiaAmount(0);
                                            }
                                        }}
                                        className={`py-2.5 px-3 rounded-xl border text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
                                            paymentMethod === method.id
                                                ? `${method.color} ring-2 ring-fire/50 shadow-md scale-[1.02]`
                                                : 'border-zinc-800 bg-zinc-950 text-zinc-400 hover:text-white hover:border-zinc-700'
                                        }`}
                                    >
                                        {method.label}
                                    </button>
                                ))}
                            </div>

                            {paymentMethod === 'MIXTO' && (
                                <div className="bg-zinc-950 p-3.5 rounded-xl border border-zinc-800 space-y-3 mt-2 animate-fadeIn shadow-inner">
                                    <div className="flex items-center justify-between gap-2">
                                        <span className="text-xs text-zinc-300 font-medium">💵 Efectivo ($)</span>
                                        <NumericInput
                                            className="w-32 bg-zinc-900 border border-zinc-700 rounded-lg px-2.5 py-1.5 text-right text-xs font-bold text-white outline-none focus:border-fire"
                                            value={cashAmount}
                                            placeholder="0"
                                            onChange={setCashAmount}
                                            min={0}
                                        />
                                    </div>
                                    <div className="flex items-center justify-between gap-2">
                                        <div className="flex items-center gap-1.5">
                                            <span className="text-xs text-zinc-300 font-medium">📱 Nequi ($)</span>
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    const rem = finalTotal - Number(cashAmount) - Number(bancolombiaAmount);
                                                    setNequiAmount(rem > 0 ? rem : 0);
                                                }}
                                                className="text-[9px] bg-pink-500/20 text-pink-400 px-1.5 py-0.5 rounded font-bold hover:bg-pink-500/30"
                                            >
                                                ⚡ Restante
                                            </button>
                                        </div>
                                        <NumericInput
                                            className="w-32 bg-zinc-900 border border-zinc-700 rounded-lg px-2.5 py-1.5 text-right text-xs font-bold text-white outline-none focus:border-fire"
                                            value={nequiAmount}
                                            placeholder="0"
                                            onChange={setNequiAmount}
                                            min={0}
                                        />
                                    </div>
                                    <div className="flex items-center justify-between gap-2">
                                        <div className="flex items-center gap-1.5">
                                            <span className="text-xs text-zinc-300 font-medium">🏦 Bancolombia ($)</span>
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    const rem = finalTotal - Number(cashAmount) - Number(nequiAmount);
                                                    setBancolombiaAmount(rem > 0 ? rem : 0);
                                                }}
                                                className="text-[9px] bg-yellow-500/20 text-yellow-400 px-1.5 py-0.5 rounded font-bold hover:bg-yellow-500/30"
                                            >
                                                ⚡ Restante
                                            </button>
                                        </div>
                                        <NumericInput
                                            className="w-32 bg-zinc-900 border border-zinc-700 rounded-lg px-2.5 py-1.5 text-right text-xs font-bold text-white outline-none focus:border-fire"
                                            value={bancolombiaAmount}
                                            placeholder="0"
                                            onChange={setBancolombiaAmount}
                                            min={0}
                                        />
                                    </div>

                                    <div className="flex justify-between border-t border-zinc-800 pt-2 text-xs">
                                        <span className="text-zinc-400">Total Distribuido:</span>
                                        <span className={Number(cashAmount) + Number(nequiAmount) + Number(bancolombiaAmount) === finalTotal ? 'text-green-400 font-bold' : 'text-fire font-bold'}>
                                            ${(Number(cashAmount) + Number(nequiAmount) + Number(bancolombiaAmount)).toLocaleString()} / ${finalTotal.toLocaleString()}
                                        </span>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Summary & Action Button */}
                    <div className="p-6 bg-zinc-950 border-t border-zinc-800 space-y-4">
                        <div className="space-y-1.5 text-sm text-zinc-400">
                            <div className="flex justify-between">
                                <span>Subtotal</span>
                                <span className="text-zinc-200">${subtotal.toLocaleString()}</span>
                            </div>
                            <div className="space-y-2">
                                <div className="flex justify-between items-center">
                                    <span>Descuento</span>
                                    <div className="flex bg-zinc-800 rounded-lg p-0.5 gap-0.5">
                                        <button
                                            type="button"
                                            onClick={() => { setDiscountType('pesos'); setDiscountInput(0); }}
                                            className={`px-2.5 py-1 rounded-md text-[10px] font-bold transition-all ${
                                                discountType === 'pesos'
                                                    ? 'bg-fire text-white shadow'
                                                    : 'text-zinc-400 hover:text-white'
                                            }`}
                                        >
                                            $ Pesos
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => { setDiscountType('porcentaje'); setDiscountInput(0); }}
                                            className={`px-2.5 py-1 rounded-md text-[10px] font-bold transition-all ${
                                                discountType === 'porcentaje'
                                                    ? 'bg-fire text-white shadow'
                                                    : 'text-zinc-400 hover:text-white'
                                            }`}
                                        >
                                            % Porcentaje
                                        </button>
                                    </div>
                                </div>
                                <div className="flex justify-between items-center gap-2">
                                    <span className="text-[11px] text-zinc-500">
                                        {discountType === 'porcentaje' ? `= $${effectiveDiscount.toLocaleString()}` : ''}
                                    </span>
                                    <div className="flex items-center gap-1">
                                        <span className="text-[10px] text-zinc-500 font-bold">
                                            {discountType === 'pesos' ? '$' : '%'}
                                        </span>
                                        <NumericInput
                                            className="w-20 bg-zinc-900 border border-zinc-800 rounded px-2 py-0.5 text-right text-xs text-zinc-200"
                                            value={discountInput}
                                            onChange={setDiscountInput}
                                            min={0}
                                            max={discountType === 'porcentaje' ? 100 : subtotal}
                                        />
                                    </div>
                                </div>
                            </div>
                            <div className="flex justify-between border-t border-zinc-800 pt-3 text-lg font-bold text-white">
                                <span>Total</span>
                                <span className="text-fire">${finalTotal.toLocaleString()}</span>
                            </div>
                        </div>

                        {errorMessage && (
                            <div className={`p-2.5 border text-xs rounded text-center ${
                                saleStatus === 'INDETERMINATE' || saleStatus === 'RECOVERING'
                                    ? 'bg-amber-500/10 border-amber-500/20 text-amber-400'
                                    : 'bg-red-500/10 border-red-500/20 text-red-500'
                            }`}>
                                {errorMessage}
                            </div>
                        )}

                        {successMessage && (
                            <div className="p-2.5 bg-green-500/10 border border-green-500/20 text-green-400 text-xs rounded text-center flex items-center justify-center gap-1.5">
                                <CheckCircle size={14} />
                                {successMessage}
                            </div>
                        )}

                        {saleStatus === 'INDETERMINATE' && (
                            <button
                                onClick={handleRetryVerification}
                                className="w-full bg-amber-600 text-white hover:bg-amber-700 py-3 rounded-lg text-sm font-bold transition-all uppercase tracking-wider"
                            >
                                🔄 Reintentar Verificación
                            </button>
                        )}

                        <button
                            onClick={handleRegisterSale}
                            disabled={loading || saleStatus === 'INDETERMINATE' || saleStatus === 'RECOVERING' || (paymentMethod === 'MIXTO' && (Number(cashAmount) + Number(nequiAmount) + Number(bancolombiaAmount)) !== finalTotal)}
                            className="w-full bg-fire text-white hover:bg-orange-700 py-3.5 rounded-lg text-sm font-bold transition-all shadow-lg shadow-fire/10 active:scale-[0.99] uppercase tracking-wider disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {saleStatus === 'REGISTERING' ? 'Registrando Venta...' :
                             saleStatus === 'RECOVERING' ? '🔄 Verificando...' :
                             saleStatus === 'INDETERMINATE' ? '⚠️ Venta Pendiente' :
                             'Registrar Venta'}
                        </button>
                    </div>
                </aside>
            </div>

            {/* Sticky Floating Mobile Order Bar (Hides when #detalle-pedido is visible) */}
            {cart.length > 0 && !isCartDetailsVisible && (
                <div className="fixed bottom-4 left-4 right-4 z-40 lg:hidden">
                    <button
                        onClick={() => document.getElementById('detalle-pedido')?.scrollIntoView({ behavior: 'smooth' })}
                        className="w-full bg-gradient-to-r from-fire via-orange-600 to-fire hover:brightness-110 text-white p-3.5 px-5 rounded-2xl shadow-2xl shadow-fire/40 flex items-center justify-between border border-fire/30 backdrop-blur-md active:scale-[0.98] transition-all"
                    >
                        <div className="flex items-center gap-3">
                            <div className="relative bg-white/20 p-2 rounded-xl">
                                <ShoppingCart size={20} className="text-white" />
                                <span className="absolute -top-1.5 -right-1.5 bg-zinc-950 text-fire text-[11px] font-black w-5 h-5 rounded-full flex items-center justify-center border border-fire shadow">
                                    {cart.reduce((sum, item) => sum + item.quantity, 0)}
                                </span>
                            </div>
                            <div className="text-left">
                                <p className="text-[11px] text-orange-100 font-medium leading-none mb-1">Ver Detalle del Pedido 👇</p>
                                <p className="text-base font-black tracking-wide text-white leading-none">
                                    ${subtotal.toLocaleString()}
                                </p>
                            </div>
                        </div>
                        <span className="bg-white/20 hover:bg-white/30 text-white text-xs font-bold px-3 py-2 rounded-xl flex items-center gap-1 shadow-sm transition-all">
                            Ir al Pedido →
                        </span>
                    </button>
                </div>
            )}

            {/* Modal: Close Drawer / Arqueo — Multi-method */}
            {showCloseModal && (
                <div className="fixed inset-0 bg-black/85 flex items-start sm:items-center justify-center p-2 sm:p-4 z-[999] overflow-y-auto">
                    <div className="w-full max-w-lg bg-zinc-900 border border-zinc-800 rounded-2xl sm:rounded-3xl p-4 sm:p-6 shadow-2xl relative space-y-4 sm:space-y-5 my-2 sm:my-4 max-h-[95dvh] overflow-y-auto">
                        <div className="flex justify-between items-center border-b border-zinc-800 pb-3">
                            <h3 className="text-lg font-bold font-serif text-white">Cierre de Caja y Arqueo</h3>
                            <button onClick={() => setShowCloseModal(false)} className="text-zinc-500 hover:text-white">✕</button>
                        </div>

                        <div className="space-y-4">
                            {/* EFECTIVO */}
                            <div className="bg-zinc-950 rounded-xl p-4 border border-zinc-800 space-y-3">
                                <p className="text-[10px] font-bold uppercase tracking-widest text-green-400">💵 Efectivo</p>
                                <div className="flex justify-between items-center text-xs">
                                    <span className="text-zinc-400">Esperado</span>
                                    <span className="font-bold text-green-400">${expectedCashAtClose.toLocaleString()}</span>
                                </div>
                                <NumericInput className="w-full bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-2.5 sm:py-2 text-white focus:border-fire outline-none text-center font-bold text-base sm:text-sm" placeholder="Contado" value={closeCashCounted} onChange={setCloseCashCounted} min={0} />
                                <div className="flex justify-between items-center text-xs">
                                    <span className="text-zinc-500">Diferencia</span>
                                    <span className={`font-bold ${closeCashCounted - expectedCashAtClose === 0 ? 'text-green-500' : 'text-fire'}`}>${(closeCashCounted - expectedCashAtClose).toLocaleString()}</span>
                                </div>
                            </div>

                            {/* NEQUI */}
                            <div className="bg-zinc-950 rounded-xl p-4 border border-zinc-800 space-y-3">
                                <p className="text-[10px] font-bold uppercase tracking-widest text-purple-400">📱 Nequi</p>
                                <div className="flex justify-between items-center text-xs">
                                    <span className="text-zinc-400">Esperado</span>
                                    <span className="font-bold text-purple-400">${expectedNequiAtClose.toLocaleString()}</span>
                                </div>
                                <NumericInput className="w-full bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-2.5 sm:py-2 text-white focus:border-fire outline-none text-center font-bold text-base sm:text-sm" placeholder="Contado" value={closeNequiCounted} onChange={setCloseNequiCounted} min={0} />
                                <div className="flex justify-between items-center text-xs">
                                    <span className="text-zinc-500">Diferencia</span>
                                    <span className={`font-bold ${closeNequiCounted - expectedNequiAtClose === 0 ? 'text-green-500' : 'text-fire'}`}>${(closeNequiCounted - expectedNequiAtClose).toLocaleString()}</span>
                                </div>
                            </div>

                            {/* BANCOLOMBIA */}
                            <div className="bg-zinc-950 rounded-xl p-4 border border-zinc-800 space-y-3">
                                <p className="text-[10px] font-bold uppercase tracking-widest text-yellow-400">🏦 Bancolombia</p>
                                <div className="flex justify-between items-center text-xs">
                                    <span className="text-zinc-400">Esperado</span>
                                    <span className="font-bold text-yellow-400">${expectedBancoAtClose.toLocaleString()}</span>
                                </div>
                                <NumericInput className="w-full bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-2.5 sm:py-2 text-white focus:border-fire outline-none text-center font-bold text-base sm:text-sm" placeholder="Contado" value={closeBancoCounted} onChange={setCloseBancoCounted} min={0} />
                                <div className="flex justify-between items-center text-xs">
                                    <span className="text-zinc-500">Diferencia</span>
                                    <span className={`font-bold ${closeBancoCounted - expectedBancoAtClose === 0 ? 'text-green-500' : 'text-fire'}`}>${(closeBancoCounted - expectedBancoAtClose).toLocaleString()}</span>
                                </div>
                            </div>

                            {/* TOTAL */}
                            <div className="bg-zinc-950 rounded-xl p-4 border border-fire/30 space-y-2">
                                <p className="text-[10px] font-bold uppercase tracking-widest text-fire">Total Consolidado</p>
                                <div className="flex justify-between items-center text-xs">
                                    <span className="text-zinc-400">Esperado Total</span>
                                    <span className="font-bold text-white">${(expectedCashAtClose + expectedNequiAtClose + expectedBancoAtClose).toLocaleString()}</span>
                                </div>
                                <div className="flex justify-between items-center text-xs">
                                    <span className="text-zinc-400">Contado Total</span>
                                    <span className="font-bold text-white">${(closeCashCounted + closeNequiCounted + closeBancoCounted).toLocaleString()}</span>
                                </div>
                                <div className="flex justify-between items-center text-sm font-bold">
                                    <span className="text-zinc-300">Diferencia Total</span>
                                    {(() => {
                                        const diff = (closeCashCounted + closeNequiCounted + closeBancoCounted) - (expectedCashAtClose + expectedNequiAtClose + expectedBancoAtClose);
                                        return <span className={diff === 0 ? 'text-green-500' : diff > 0 ? 'text-yellow-400' : 'text-red-400'}>${diff.toLocaleString()} {diff > 0 ? '(SOBRANTE)' : diff < 0 ? '(FALTANTE)' : '(CUADRADO)'}</span>;
                                    })()}
                                </div>
                            </div>

                            <div>
                                <label className="text-xs font-bold uppercase tracking-wider text-zinc-400 block mb-2">Observaciones / Justificación</label>
                                <textarea rows="3" className="w-full bg-zinc-950 border border-zinc-800 rounded-xl p-3 text-xs text-white focus:border-fire outline-none resize-none" placeholder="Detallar motivos de descuadre o incidencias en el turno..." value={closeObservations} onChange={(e) => setCloseObservations(e.target.value)} />
                            </div>
                        </div>

                        {errorMessage && (
                            <div className="p-2.5 bg-red-500/10 border border-red-500/20 text-red-500 text-xs rounded text-center">
                                {errorMessage}
                            </div>
                        )}

                        <button onClick={handleCloseSession} disabled={loading} className="w-full bg-fire hover:bg-orange-700 text-white py-3 rounded-lg font-bold transition-all shadow-lg active:scale-[0.99] uppercase text-xs tracking-wider">
                            {loading ? 'Confirmando Cierre...' : 'Confirmar Cierre y Arqueo'}
                        </button>
                    </div>
                </div>
            )}

            {/* QR Scanner Modal */}
            {showQrModal && (
                <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-[999] flex items-center justify-center p-4">
                    <div className="bg-zinc-900 border border-zinc-800 rounded-3xl p-6 w-full max-w-md shadow-2xl relative space-y-4">
                        <div className="flex justify-between items-center border-b border-zinc-800 pb-3">
                            <div className="flex items-center gap-2 text-fire font-bold text-base">
                                <Camera size={20} />
                                <span>Escanear Tarjeta QR Cliente</span>
                            </div>
                            <button
                                type="button"
                                onClick={() => setShowQrModal(false)}
                                className="text-zinc-400 hover:text-white p-1 rounded-lg hover:bg-zinc-800 transition-colors"
                            >
                                <X size={20} />
                            </button>
                        </div>

                        <p className="text-xs text-zinc-400 text-center">
                            Enfoca el código QR de la tarjeta de fidelización del cliente frente a la cámara.
                        </p>

                        {/* QR Video Container with Custom High-Tech Viewfinder Overlay */}
                        <div className="w-full h-64 bg-zinc-950 rounded-2xl overflow-hidden border border-zinc-800 relative shadow-inner">
                            {qrCameraStatus === 'error' ? (
                                <div className="w-full h-full flex flex-col items-center justify-center gap-3 p-4">
                                    <AlertCircle size={32} className="text-red-400" />
                                    <p className="text-xs text-red-400 text-center font-medium">{qrCameraError}</p>
                                    <button
                                        type="button"
                                        onClick={() => { setShowQrModal(false); setTimeout(() => setShowQrModal(true), 100); }}
                                        className="text-[10px] font-bold bg-fire/20 text-fire px-3 py-1.5 rounded-lg hover:bg-fire/30 transition-colors"
                                    >
                                        🔄 Reintentar
                                    </button>
                                </div>
                            ) : (
                                <>
                                    <div id="pos-qr-reader-region" className="w-full h-full" />
                                    
                                    {qrCameraStatus === 'requesting' && (
                                        <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-zinc-950/80 z-20">
                                            <RefreshCw size={24} className="text-fire animate-spin" />
                                            <p className="text-xs text-zinc-400">Solicitando acceso a la cámara...</p>
                                        </div>
                                    )}

                                    {/* Custom Sleek Dark Viewfinder Overlay */}
                                    <div className="absolute inset-0 pointer-events-none flex items-center justify-center z-10">
                                        <div className="w-48 h-48 relative border-2 border-fire/60 rounded-2xl shadow-[0_0_20px_rgba(255,69,0,0.3)]">
                                            {/* Glowing Corners */}
                                            <div className="absolute -top-1 -left-1 w-5 h-5 border-t-4 border-l-4 border-fire rounded-tl" />
                                            <div className="absolute -top-1 -right-1 w-5 h-5 border-t-4 border-r-4 border-fire rounded-tr" />
                                            <div className="absolute -bottom-1 -left-1 w-5 h-5 border-b-4 border-l-4 border-fire rounded-bl" />
                                            <div className="absolute -bottom-1 -right-1 w-5 h-5 border-b-4 border-r-4 border-fire rounded-br" />
                                            
                                            {/* Animated Scanning Laser */}
                                            <div className="w-full h-0.5 bg-gradient-to-r from-transparent via-fire to-transparent shadow-[0_0_8px_#ff4500] animate-pulse relative top-1/2 -translate-y-1/2" />
                                        </div>
                                    </div>
                                </>
                            )}
                        </div>

                        {/* Manual code fallback */}
                        {qrCameraStatus === 'error' && (
                            <div className="bg-zinc-950 border border-zinc-800 rounded-xl p-3 space-y-2">
                                <p className="text-[10px] font-bold uppercase tracking-wider text-zinc-500">Ingreso Manual de Código</p>
                                <div className="flex gap-2">
                                    <input
                                        type="text"
                                        placeholder="ID o código del cliente..."
                                        className="flex-1 bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-2 text-xs text-white focus:border-fire outline-none"
                                        onKeyDown={async (e) => {
                                            if (e.key === 'Enter' && e.target.value.trim()) {
                                                await handleScannedQr(e.target.value.trim(), null);
                                            }
                                        }}
                                    />
                                    <button
                                        type="button"
                                        onClick={async (e) => {
                                            const input = e.target.closest('.space-y-2')?.querySelector('input');
                                            if (input?.value.trim()) await handleScannedQr(input.value.trim(), null);
                                        }}
                                        className="bg-fire hover:bg-orange-700 text-white px-3 py-2 rounded-lg text-xs font-bold transition-colors"
                                    >
                                        Buscar
                                    </button>
                                </div>
                            </div>
                        )}

                        <div className="flex gap-2 pt-2">
                            <button
                                type="button"
                                onClick={() => {
                                    setShowQrModal(false);
                                    setShowNewClientModal(true);
                                }}
                                className="flex-1 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 py-2.5 rounded-xl font-bold text-xs border border-zinc-700 transition-all"
                            >
                                ➕ Crear Nuevo Cliente
                            </button>
                            <button
                                type="button"
                                onClick={() => setShowQrModal(false)}
                                className="px-4 bg-zinc-900 hover:bg-zinc-850 text-zinc-400 py-2.5 rounded-xl font-bold text-xs border border-zinc-800"
                            >
                                Cancelar
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Quick New Client Modal */}
            {showNewClientModal && (
                <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-[999] flex items-center justify-center p-4">
                    <form onSubmit={handleRegisterNewClient} className="bg-zinc-900 border border-zinc-800 rounded-3xl p-6 w-full max-w-md shadow-2xl space-y-4">
                        <div className="flex justify-between items-center border-b border-zinc-800 pb-3">
                            <div className="flex items-center gap-2 text-fire font-bold text-base">
                                <UserPlus size={20} />
                                <span>Registro Rápido de Cliente</span>
                            </div>
                            <button
                                type="button"
                                onClick={() => setShowNewClientModal(false)}
                                className="text-zinc-400 hover:text-white p-1 rounded-lg hover:bg-zinc-800 transition-colors"
                            >
                                <X size={20} />
                            </button>
                        </div>

                        <div className="space-y-3 text-left">
                            <div>
                                <label className="text-xs font-bold uppercase tracking-wider text-zinc-400 block mb-1">Nombre Completo *</label>
                                <input
                                    type="text"
                                    required
                                    placeholder="Ej. Juan Pérez"
                                    className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3.5 py-2.5 text-xs text-white outline-none focus:border-fire"
                                    value={newClientForm.nombre}
                                    onChange={(e) => setNewClientForm(prev => ({ ...prev, nombre: e.target.value }))}
                                />
                            </div>

                            <div>
                                <label className="text-xs font-bold uppercase tracking-wider text-zinc-400 block mb-1">Teléfono / Celular *</label>
                                <input
                                    type="tel"
                                    required
                                    placeholder="Ej. 3001234567"
                                    className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3.5 py-2.5 text-xs text-white outline-none focus:border-fire"
                                    value={newClientForm.celular}
                                    onChange={(e) => setNewClientForm(prev => ({ ...prev, celular: e.target.value }))}
                                />
                            </div>

                            <div>
                                <label className="text-xs font-bold uppercase tracking-wider text-zinc-400 block mb-1">Correo Electrónico (Opcional)</label>
                                <input
                                    type="email"
                                    placeholder="Ej. cliente@gmail.com"
                                    className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3.5 py-2.5 text-xs text-white outline-none focus:border-fire"
                                    value={newClientForm.email}
                                    onChange={(e) => setNewClientForm(prev => ({ ...prev, email: e.target.value }))}
                                />
                            </div>
                        </div>

                        {newClientError && (
                            <div className="p-2.5 bg-red-500/10 border border-red-500/20 text-red-500 text-xs rounded text-center">
                                {newClientError}
                            </div>
                        )}

                        <div className="flex gap-2 pt-2">
                            <button
                                type="submit"
                                disabled={isRegisteringClient}
                                className="flex-1 bg-fire hover:bg-orange-700 text-white py-3 rounded-xl font-bold text-xs uppercase tracking-wider transition-all shadow-lg shadow-fire/20"
                            >
                                {isRegisteringClient ? 'Guardando...' : '💾 Registrar y Asociar'}
                            </button>
                            <button
                                type="button"
                                onClick={() => setShowNewClientModal(false)}
                                className="px-4 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 py-3 rounded-xl font-bold text-xs transition-all border border-zinc-700"
                            >
                                Cancelar
                            </button>
                        </div>
                    </form>
                </div>
            )}

            {/* Modal: Recent Sales (Bloque 10 — Worker can view and request cancellation) */}
            {showRecentSalesModal && (
                <div className="fixed inset-0 bg-black/85 flex items-start sm:items-center justify-center p-2 sm:p-4 z-[999] overflow-y-auto">
                    <div className="w-full max-w-lg bg-zinc-900 border border-zinc-800 rounded-2xl sm:rounded-3xl p-4 sm:p-6 shadow-2xl relative space-y-4 my-2 sm:my-4 max-h-[95dvh] overflow-y-auto">
                        <div className="flex justify-between items-center border-b border-zinc-800 pb-3">
                            <h3 className="text-lg font-bold font-serif text-white">Mis Ventas Recientes</h3>
                            <button onClick={() => setShowRecentSalesModal(false)} className="text-zinc-500 hover:text-white p-1 rounded-lg hover:bg-zinc-800 transition-colors"><X size={20} /></button>
                        </div>

                        {recentSalesLoading ? (
                            <div className="flex justify-center py-12">
                                <div className="w-7 h-7 border-2 border-fire border-t-transparent rounded-full animate-spin" />
                            </div>
                        ) : recentSales.length === 0 ? (
                            <p className="text-zinc-500 text-sm text-center py-8">No hay ventas registradas.</p>
                        ) : (
                            <div className="space-y-2">
                                {recentSales.map(v => {
                                    const itemCount = Array.isArray(v.detalles?.items) ? v.detalles.items.reduce((s, i) => s + (i.quantity || 1), 0) : 0;
                                    const isAnulada = v.estado === 'ANULADA';
                                    return (
                                        <div key={v.id} className={`p-3 rounded-xl border ${isAnulada ? 'bg-red-500/5 border-red-500/20' : 'bg-zinc-950 border-zinc-800'}`}>
                                            <div className="flex justify-between items-start">
                                                <div>
                                                    <p className="text-xs font-bold text-zinc-200">
                                                        ${Number(v.total).toLocaleString()}
                                                        <span className="ml-2 text-[10px] text-zinc-500 font-medium">{v.metodo_pago}</span>
                                                    </p>
                                                    <p className="text-[10px] text-zinc-500 mt-0.5">
                                                        {new Date(v.fecha).toLocaleString('es-CO', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                                                        {v.clientes?.nombre && <span> · {v.clientes.nombre}</span>}
                                                        {itemCount > 0 && <span> · {itemCount} productos</span>}
                                                    </p>
                                                </div>
                                                <div className="flex items-center gap-2">
                                                    <span className={`text-[9px] font-bold uppercase px-2 py-0.5 rounded-full ${isAnulada ? 'bg-red-500/20 text-red-400' : 'bg-green-500/20 text-green-400'}`}>
                                                        {v.estado}
                                                    </span>
                                                    {v.estado === 'COMPLETADA' && (
                                                        <button
                                                            onClick={() => { setShowAnulacionModal(v); setAnulacionMotivo(''); }}
                                                            className="text-[9px] font-bold text-red-400 hover:text-red-300 bg-red-500/10 hover:bg-red-500/20 px-2 py-0.5 rounded-full border border-red-500/20 transition-all"
                                                        >
                                                            Anular
                                                        </button>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        )}

                        <button
                            onClick={() => setShowRecentSalesModal(false)}
                            className="w-full bg-zinc-800 hover:bg-zinc-700 text-zinc-300 py-2.5 rounded-xl font-bold text-xs transition-all border border-zinc-700"
                        >
                            Cerrar
                        </button>
                    </div>
                </div>
            )}

            {/* Modal: Solicitar Anulación (Bloque 10) */}
            {showAnulacionModal && (
                <div className="fixed inset-0 bg-black/90 flex items-center justify-center p-4 z-[1050]">
                    <div className="w-full max-w-sm bg-zinc-900 border border-zinc-800 rounded-2xl p-5 shadow-2xl space-y-4">
                        <h4 className="text-base font-bold text-white text-center">Solicitar Anulación</h4>
                        <div className="bg-zinc-950 p-3 rounded-xl border border-zinc-800 text-xs space-y-1">
                            <p className="text-zinc-400">Venta: <span className="text-white font-bold">${Number(showAnulacionModal.total).toLocaleString()}</span></p>
                            <p className="text-zinc-400">Fecha: <span className="text-zinc-300">{new Date(showAnulacionModal.fecha).toLocaleString('es-CO')}</span></p>
                            {showAnulacionModal.clientes?.nombre && (
                                <p className="text-zinc-400">Cliente: <span className="text-zinc-300">{showAnulacionModal.clientes.nombre}</span></p>
                            )}
                        </div>

                        <div>
                            <label className="text-xs font-bold uppercase tracking-wider text-zinc-400 block mb-1.5">Motivo de Anulación *</label>
                            <textarea
                                rows={3}
                                placeholder="Describe el motivo de la anulación..."
                                className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3.5 py-2.5 text-xs text-white outline-none focus:border-fire resize-none"
                                value={anulacionMotivo}
                                onChange={(e) => setAnulacionMotivo(e.target.value)}
                            />
                        </div>

                        {errorMessage && (
                            <div className="p-2 bg-red-500/10 border border-red-500/20 text-red-500 text-xs rounded text-center">{errorMessage}</div>
                        )}

                        <div className="flex gap-2">
                            <button
                                onClick={handleSolicitarAnulacion}
                                disabled={anulacionSubmitting || !anulacionMotivo.trim()}
                                className="flex-1 bg-red-600 hover:bg-red-700 text-white py-2.5 rounded-xl font-bold text-xs uppercase tracking-wider transition-all disabled:opacity-50"
                            >
                                {anulacionSubmitting ? 'Enviando...' : 'Solicitar Anulación'}
                            </button>
                            <button
                                onClick={() => { setShowAnulacionModal(null); setAnulacionMotivo(''); }}
                                className="px-4 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 py-2.5 rounded-xl font-bold text-xs transition-all border border-zinc-700"
                            >
                                Cancelar
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default POS;

