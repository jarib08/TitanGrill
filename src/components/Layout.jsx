import React from 'react';
import Navbar from './Navbar';

const Layout = ({ children }) => {
    return (
        <div className="min-h-screen bg-zinc-950 text-white font-sans relative selection:bg-fire selection:text-white">
            <Navbar />
            <main className="relative z-10">
                {children}
            </main>
            <footer className="bg-black py-12 text-center text-zinc-500 text-sm border-t border-zinc-900 relative z-10">
                <p>&copy; {new Date().getFullYear()} Titan Grill. Fuego & Carbon.</p>
            </footer>
        </div>
    );
};

export default Layout;
