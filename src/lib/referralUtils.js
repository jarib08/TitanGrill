/**
 * 🔥 TITAN GRILL - UTILIDADES DE REFERIDOS 🔥
 * Funciones de utilidad para el sistema de referidos
 */

/**
 * Genera un código de referido único de 8 caracteres
 * Excluye caracteres confusos: 0, O, 1, I, l
 * @returns {string} Código de 8 caracteres alfanuméricos
 */
export const generateReferralCode = () => {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // Sin 0, O, 1, I
    let code = '';

    for (let i = 0; i < 8; i++) {
        const randomIndex = Math.floor(Math.random() * chars.length);
        code += chars[randomIndex];
    }

    return code;
};

/**
 * Valida el formato de un código de referido
 * @param {string} code - Código a validar
 * @returns {boolean} true si el código es válido
 */
export const validateReferralCode = (code) => {
    if (!code || typeof code !== 'string') {
        return false;
    }

    // Debe tener exactamente 8 caracteres
    if (code.length !== 8) {
        return false;
    }

    // Solo debe contener caracteres permitidos (sin 0, O, 1, I)
    const validChars = /^[A-Z2-9]+$/;
    return validChars.test(code.toUpperCase());
};

/**
 * Extrae el código de referido de una URL
 * @param {string} url - URL completa o search params
 * @returns {string|null} Código de referido o null si no existe
 */
export const extractReferralCodeFromURL = (url = window.location.search) => {
    try {
        const params = new URLSearchParams(url);
        const code = params.get('ref');

        if (code && validateReferralCode(code)) {
            return code.toUpperCase();
        }

        return null;
    } catch (error) {
        console.error('Error al extraer código de referido:', error);
        return null;
    }
};

/**
 * Genera la URL de referido completa
 * @param {string} referralCode - Código de referido del usuario
 * @param {string} baseUrl - URL base (default: window.location.origin)
 * @returns {string} URL completa con parámetro ref
 */
export const generateReferralURL = (referralCode, baseUrl = window.location.origin) => {
    if (!referralCode) {
        console.warn('No se proporcionó código de referido');
        return baseUrl;
    }

    return `${baseUrl}/?ref=${referralCode.toUpperCase()}`;
};

/**
 * Genera el mensaje de compartir para redes sociales
 * @param {string} referralCode - Código de referido del usuario
 * @param {string} userName - Nombre del usuario (opcional)
 * @returns {string} Mensaje formateado para compartir
 */
export const generateShareMessage = (referralCode, _userName = '') => {
    const url = generateReferralURL(referralCode);

    return `¡Únete al Club de Titan Grill! Regístrate con mi link y obtén tu primer sello gratis: ${url}`;
};

/**
 * Copia texto al portapapeles (fallback para Web Share API)
 * @param {string} text - Texto a copiar
 * @returns {Promise<boolean>} true si se copió exitosamente
 */
export const copyToClipboard = async (text) => {
    try {
        // Método moderno
        if (navigator.clipboard && navigator.clipboard.writeText) {
            await navigator.clipboard.writeText(text);
            return true;
        }

        // Fallback para navegadores antiguos
        const textArea = document.createElement('textarea');
        textArea.value = text;
        textArea.style.position = 'fixed';
        textArea.style.left = '-999999px';
        textArea.style.top = '-999999px';
        document.body.appendChild(textArea);
        textArea.focus();
        textArea.select();

        const successful = document.execCommand('copy');
        document.body.removeChild(textArea);

        return successful;
    } catch (error) {
        console.error('Error al copiar al portapapeles:', error);
        return false;
    }
};

/**
 * Comparte usando Web Share API con fallback a clipboard
 * @param {string} referralCode - Código de referido
 * @param {string} userName - Nombre del usuario (opcional)
 * @returns {Promise<{success: boolean, method: 'share'|'clipboard'|'error'}>}
 */
export const shareReferralLink = async (referralCode, userName = '') => {
    const message = generateShareMessage(referralCode, userName);
    const url = generateReferralURL(referralCode);

    // Intentar Web Share API (móviles)
    if (navigator.share) {
        try {
            await navigator.share({
                title: 'Únete a Titan Grill',
                text: message,
                url: url
            });

            return { success: true, method: 'share' };
        } catch (error) {
            // Usuario canceló o error
            if (error.name === 'AbortError') {
                return { success: false, method: 'share', cancelled: true };
            }
            console.error('Error al compartir:', error);
        }
    }

    // Fallback: copiar al portapapeles
    const copied = await copyToClipboard(url);

    if (copied) {
        return { success: true, method: 'clipboard' };
    }

    return { success: false, method: 'error' };
};
