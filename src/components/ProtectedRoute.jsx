import React, { useEffect, useState } from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient';

const ProtectedRoute = () => {
    const [session, setSession] = useState(null);
    const [isAdmin, setIsAdmin] = useState(false);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const checkAuth = async () => {
            const { data: { session } } = await supabase.auth.getSession();
            setSession(session);

            if (session?.user) {
                // Verify admin status from admin_users table
                const { data: adminData, error } = await supabase
                    .from('admin_users')
                    .select('id')
                    .eq('id', session.user.id)
                    .maybeSingle();

                if (adminData && !error) {
                    setIsAdmin(true);
                } else {
                    setIsAdmin(false);
                    // Sign out if not an admin
                    await supabase.auth.signOut();
                }
            }

            setLoading(false);
        };

        checkAuth();

        const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, session) => {
            setSession(session);

            if (session?.user) {
                const { data: adminData } = await supabase
                    .from('admin_users')
                    .select('id')
                    .eq('id', session.user.id)
                    .maybeSingle();

                setIsAdmin(!!adminData);
            } else {
                setIsAdmin(false);
            }

            setLoading(false);
        });

        return () => subscription.unsubscribe();
    }, []);

    if (loading) {
        return (
            <div className="min-h-screen bg-black flex items-center justify-center">
                <p className="text-fire animate-pulse text-xl">Verificando credenciales...</p>
            </div>
        );
    }

    if (!session || !isAdmin) {
        // If not logged in or not an admin, redirect to login
        return <Navigate to="/login" replace />;
    }

    return <Outlet />;
};

export default ProtectedRoute;
