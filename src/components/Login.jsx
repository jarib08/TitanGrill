import React, { useState } from 'react';
import { supabase } from '../lib/supabaseClient';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Eye, EyeOff } from 'lucide-react';

const Login = () => {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const clientId = searchParams.get('clientId');

    const handleLogin = async (e) => {
        e.preventDefault();
        setLoading(true);
        setError('');

        const cleanEmail = email.trim();
        const cleanPassword = password.trim();

        try {

            // 1. Authenticate with Supabase Auth (Native)
            const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
                email: cleanEmail,
                password: cleanPassword,
            });

            if (authError) {
                throw new Error('Credenciales inválidas.');
            }
            if (!authData?.user) {
                throw new Error('Error de autenticación.');
            }

            // 2. Verify whitelist in perfiles_trabajadores table
            const { data: profileData, error: profileError } = await supabase
                .from('perfiles_trabajadores')
                .select('*')
                .eq('id', authData.user.id)
                .maybeSingle();

            if (profileError) {
                throw new Error('Error de verificación.');
            }

            if (!profileData || profileData.estado !== 'ACTIVO') {
                await supabase.auth.signOut();
                throw new Error('Acceso denegado.');
            }

            // 3. Redirection based on role
            if (profileData.rol === 'ADMINISTRADOR') {
                // Auto-Stamp Logic if clientId is present (admin only)
                if (clientId) {
                    const { data: rpcData, error: rpcError } = await supabase
                        .rpc('increment_stamps', { client_id: clientId });

                    if (rpcError || !rpcData?.success) {
                        throw new Error("Error al registrar sello.");
                    }
                }

                sessionStorage.setItem('titan_admin', 'true');
                if (clientId) {
                    navigate(`/admin/client/${clientId}`);
                } else {
                    navigate('/admin');
                }
            } else if (profileData.rol === 'TRABAJADOR') {
                sessionStorage.setItem('titan_worker', 'true');
                navigate('/pos');
            } else {
                await supabase.auth.signOut();
                throw new Error('Rol no reconocido.');
            }

        } catch (err) {
            setError(err.message || 'Error de autenticación');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-black flex items-center justify-center px-6 relative z-9999">
            <div className="w-full max-w-sm">
                <div className="text-center mb-8">
                    <h1 className="text-3xl font-serif text-white">Titan Admin</h1>
                    <div className="w-12 h-1 bg-fire mx-auto mt-4 rounded-full"></div>
                    <p className="text-zinc-500 text-xs mt-2">Acceso Restringido</p>

                    {clientId && (
                        <div className="mt-4 bg-fire/20 border border-fire/50 rounded-lg p-2 animate-pulse">
                            <p className="text-fire text-sm font-bold uppercase tracking-wider">
                                🔥 Modo: Registro de Sello Detectado
                            </p>
                        </div>
                    )}
                </div>

                <form onSubmit={handleLogin} className="space-y-4">
                    <div>
                        <input
                            type="email"
                            placeholder="Email Administrativo"
                            className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-4 py-3 text-white focus:border-fire outline-none transition-colors"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                        />
                    </div>
                    <div className="relative">
                        <input
                            type={showPassword ? "text" : "password"}
                            placeholder="Contraseña"
                            className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-4 py-3 pr-12 text-white focus:border-fire outline-none transition-colors"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                        />
                        <button
                            type="button"
                            onClick={() => setShowPassword(!showPassword)}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300"
                        >
                            {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                        </button>
                    </div>

                    {error && <p className="text-red-500 text-sm text-center bg-red-500/10 p-2 rounded">{error}</p>}

                    <button
                        type="submit"
                        disabled={loading}
                        className="w-full bg-fire text-white font-bold py-3 rounded-lg hover:bg-orange-700 transition-colors uppercase tracking-widest text-sm"
                    >
                        {loading ? 'Procesando...' : clientId ? 'Ingresar y Sellar' : 'Ingresar'}
                    </button>
                </form>
            </div>
        </div>
    );
};

export default Login;
