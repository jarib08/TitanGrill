import React, { useEffect, useState } from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient';

const ProtectedRoute = ({ allowedRoles = ['ADMINISTRADOR'] }) => {
    const [session, setSession] = useState(null);
    const [hasAccess, setHasAccess] = useState(false);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const checkAuth = async () => {
            const { data: { session } } = await supabase.auth.getSession();
            setSession(session);

            if (session?.user) {
                // Verify status and role from perfiles_trabajadores table
                const { data: profile, error } = await supabase
                    .from('perfiles_trabajadores')
                    .select('rol, estado')
                    .eq('id', session.user.id)
                    .maybeSingle();

                if (profile && !error && profile.estado === 'ACTIVO' && allowedRoles.includes(profile.rol)) {
                    setHasAccess(true);
                } else {
                    setHasAccess(false);
                    // Only sign out if the user is completely invalid (no profile or inactive)
                    if (!profile || profile.estado !== 'ACTIVO') {
                        await supabase.auth.signOut();
                    }
                }
            }

            setLoading(false);
        };

        checkAuth();

        const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, session) => {
            setSession(session);

            if (session?.user) {
                const { data: profile } = await supabase
                    .from('perfiles_trabajadores')
                    .select('rol, estado')
                    .eq('id', session.user.id)
                    .maybeSingle();

                if (profile && profile.estado === 'ACTIVO' && allowedRoles.includes(profile.rol)) {
                    setHasAccess(true);
                } else {
                    setHasAccess(false);
                }
            } else {
                setHasAccess(false);
            }

            setLoading(false);
        });

        return () => subscription.unsubscribe();
    }, [allowedRoles]);

    if (loading) {
        return (
            <div className="min-h-screen bg-black flex items-center justify-center">
                <p className="text-fire animate-pulse text-xl">Verificando credenciales...</p>
            </div>
        );
    }

    if (!session || !hasAccess) {
        return <Navigate to="/login" replace />;
    }

    return <Outlet />;
};

export default ProtectedRoute;
