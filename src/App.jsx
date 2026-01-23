import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Layout from './components/Layout';
import Hero from './components/Hero';
import MenuGrid from './components/MenuGrid';
import { LocationMap } from './components/LocationSection';
import WhatsAppButton from './components/WhatsAppButton';
import LeadPopup from './components/LeadPopup';
import Login from './components/Login';
import AdminDashboard from './components/AdminDashboard';
import AdminClientView from './components/AdminClientView';
import ProtectedRoute from './components/ProtectedRoute';

const LandingPage = () => {
  return (
    <Layout>
      <Hero />
      <MenuGrid />
      <LocationMap />
      <WhatsAppButton />
      <LeadPopup />
    </Layout>
  );
};

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/login" element={<Login />} />

        {/* Protected Routes */}
        <Route element={<ProtectedRoute />}>
          <Route path="/admin" element={<AdminDashboard />} />
          <Route path="/admin/client/:clientId" element={<AdminClientView />} />
        </Route>
      </Routes>
    </Router>
  );
}

export default App;
