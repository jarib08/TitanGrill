import React, { Suspense, lazy } from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { ErrorBoundary } from 'react-error-boundary';

// Eager-loaded components (critical path)
import Layout from './components/Layout';
import Hero from './components/Hero';
import MenuGrid from './components/MenuGrid';
import { LocationMap } from './components/LocationSection';
import WhatsAppButton from './components/WhatsAppButton';
import LeadPopup from './components/LeadPopup';
import JoinClubSection from './components/JoinClubSection';


// Common components
import ErrorFallback from './components/common/ErrorFallback';
import LoadingSpinner from './components/common/LoadingSpinner';
import NotFound from './components/common/NotFound';

// Lazy-loaded components (not on critical path)
const Login = lazy(() => import('./components/Login'));
const AdminDashboard = lazy(() => import('./components/AdminDashboard'));
const AdminClientView = lazy(() => import('./components/AdminClientView'));
const ProtectedRoute = lazy(() => import('./components/ProtectedRoute'));

// Landing Page Component
const LandingPage = () => {
    return (
        <Layout>
            <Hero />
            <MenuGrid />
            <LocationMap />
            <JoinClubSection />
            <WhatsAppButton />
            <LeadPopup />
        </Layout>

    );
};

// Error handler for logging
const handleError = (error, info) => {
    console.error('Application Error:', error);
    console.error('Component Stack:', info.componentStack);
};

function App() {
    return (
        <ErrorBoundary
            FallbackComponent={ErrorFallback}
            onError={handleError}
            onReset={() => window.location.href = '/'}
        >
            <Router>
                <Suspense fallback={<LoadingSpinner message="Cargando..." />}>
                    <Routes>
                        {/* Public Routes */}
                        <Route path="/" element={<LandingPage />} />
                        <Route path="/login" element={<Login />} />

                        {/* Protected Admin Routes */}
                        <Route element={<ProtectedRoute />}>
                            <Route path="/admin" element={<AdminDashboard />} />
                            <Route path="/admin/client/:clientId" element={<AdminClientView />} />
                        </Route>

                        {/* 404 Catch-all Route */}
                        <Route path="*" element={<NotFound />} />
                    </Routes>
                </Suspense>
            </Router>
        </ErrorBoundary>
    );
}

export default App;
