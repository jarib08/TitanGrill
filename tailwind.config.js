/** @type {import('tailwindcss').Config} */
export default {
    content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
    theme: {
        extend: {
            zIndex: {
                '99': '99',
                '100': '100',
                '110': '110',
                '9999': '9999',
            },
            spacing: {
                '22': '5.5rem',
            },
            transitionDuration: {
                '250': '250ms',
            },
            fontSize: {
                'xxs': '10px',
            },
            letterSpacing: {
                'super-wide': '0.2em',
            },
            colors: {
                fire: '#ff4500',
                gold: '#d4af37',
            },
            keyframes: {
                shimmer: {
                    '0%': { backgroundPosition: '200% 0' },
                    '100%': { backgroundPosition: '-200% 0' },
                }
            },
            animation: {
                shimmer: 'shimmer 3s ease-in-out infinite',
            }
        },
    },
    plugins: [],
};
