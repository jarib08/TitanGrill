import React from 'react';
import { MapPin, Clock, Instagram } from 'lucide-react';

export const LocationMap = () => {
    return (
        <div id="location" className="bg-zinc-950 py-20 px-4">
            <div className="max-w-6xl mx-auto grid md:grid-cols-2 gap-12 items-center">
                <div>
                    <h2 className="text-4xl font-serif font-bold text-white mb-6 flex items-center gap-3">
                        <span className="text-fire"><MapPin size={36} /></span> Ubicación
                    </h2>
                    <p className="text-zinc-400 text-lg mb-2">
                        Zona de Emprendimiento, Universidad del Magdalena, Santa Marta<br />
                    </p>
                    <a
                        href="https://instagram.com/titangrill_burger"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-2 text-fire hover:text-orange-400 transition-colors mb-6"
                    >
                        <Instagram size={20} />
                        <span className="font-medium">@titangrill_burger</span>
                    </a>
                    <div className="aspect-video w-full rounded-xl overflow-hidden shadow-2xl border border-zinc-800 hover:border-fire/30 transition-colors">
                        <iframe
                            src="https://www.google.com/maps?q=11.22452920058084,-74.18687076981672&z=17&output=embed"
                            width="100%"
                            height="100%"
                            style={{ border: "0" }}
                            loading="lazy"
                            allowfullscreen
                        ></iframe>
                    </div>

                </div>

                <div id="hours" className="bg-zinc-900/50 p-8 rounded-xl border border-zinc-800 shadow-xl backdrop-blur-sm">
                    <h2 className="text-3xl font-serif font-bold text-white mb-6 flex items-center gap-3">
                        <span className="text-fire"><Clock size={32} /></span> Horarios
                    </h2>
                    <div className="space-y-4">
                        <div className="flex justify-between items-center border-b border-zinc-800 pb-2">
                            <span className="text-zinc-500">Lunes</span>
                            <span className="text-zinc-200 font-semibold">4:00 PM - 9:30 PM</span>
                        </div>
                        <div className="flex justify-between items-center pb-2">
                            <span className="text-zinc-500">Miercoles - Viernes</span>
                            <span className="text-zinc-200 font-semibold">4:00 PM - 9:30 PM</span>
                        </div>

                    </div>
                    <div className="mt-8 pt-4 border-t border-zinc-800 text-center">
                        <p className="text-fire font-medium animate-pulse">¡Hapy Hour Miercoles 6 PM - 9 PM!</p>
                    </div>
                </div>
            </div>
        </div>
    );
};
