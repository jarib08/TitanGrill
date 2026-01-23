// Storage Keys
export const STORAGE_KEYS = {
    CLIENT: 'titan_client',
    POPUP_CLOSED: 'popup_closed',
    ADMIN: 'titan_admin'
};

// Timing Constants
export const TIMING = {
    POPUP_DELAY_MS: 5000,
    SHARE_STATUS_RESET_MS: 2000,
    THIRTY_DAYS_MS: 30 * 24 * 60 * 60 * 1000
};

// UI Constants
export const UI = {
    TOTAL_STAMPS: 10,
    RECENT_CLIENTS_LIMIT: 10,
    SCROLL_THRESHOLD: 50
};

// Z-Index Scale
export const Z_INDEX = {
    base: 0,
    dropdown: 10,
    sticky: 20,
    fixed: 30,
    modalBackdrop: 40,
    modal: 50,
    popover: 60,
    tooltip: 70,
    floatingButton: 99,
    overlay: 100,
    cardModal: 110
};

// Validation Patterns
export const PATTERNS = {
    PHONE: /^\d{10}$/,
    EMAIL: /^[^\s@]+@[^\s@]+\.[^\s@]+$/
};

// Error Messages
export const ERROR_MESSAGES = {
    PHONE_LENGTH: 'El n\u00famero debe tener exactamente 10 d\u00edgitos',
    PHONE_REQUIRED: 'El n\u00famero de celular debe tener exactamente 10 d\u00edgitos',
    EMAIL_INVALID: 'El formato del email no es v\u00e1lido',
    REGISTER_ERROR: 'Error al registrar. Verifica tu conexi\u00f3n.',
    CREDENTIALS_INVALID: 'Credenciales inv\u00e1lidas.',
    SUPABASE_MISSING: 'Missing required Supabase environment variables'
};

// WhatsApp Configuration
export const WHATSAPP = {
    PHONE_NUMBER: '3004126441'
};
