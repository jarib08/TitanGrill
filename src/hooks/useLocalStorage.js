import { useState, useCallback } from 'react';

/**
 * Safe localStorage hook with error handling
 * @param {string} key - localStorage key
 * @param {any} initialValue - default value if key doesn't exist
 */
export const useLocalStorage = (key, initialValue = null) => {
    const [storedValue, setStoredValue] = useState(() => {
        try {
            const item = localStorage.getItem(key);
            if (item === null) return initialValue;
            return JSON.parse(item);
        } catch (error) {
            console.error(`Error reading localStorage key "${key}":`, error);
            return initialValue;
        }
    });

    const setValue = useCallback((value) => {
        try {
            const valueToStore = value instanceof Function ? value(storedValue) : value;
            setStoredValue(valueToStore);
            if (valueToStore === null || valueToStore === undefined) {
                localStorage.removeItem(key);
            } else {
                localStorage.setItem(key, JSON.stringify(valueToStore));
            }
        } catch (error) {
            console.error(`Error setting localStorage key "${key}":`, error);
        }
    }, [key, storedValue]);

    const removeValue = useCallback(() => {
        try {
            localStorage.removeItem(key);
            setStoredValue(initialValue);
        } catch (error) {
            console.error(`Error removing localStorage key "${key}":`, error);
        }
    }, [key, initialValue]);

    return [storedValue, setValue, removeValue];
};

/**
 * Safe function to get value from localStorage
 */
export const getFromStorage = (key, defaultValue = null) => {
    try {
        const item = localStorage.getItem(key);
        if (item === null) return defaultValue;
        return JSON.parse(item);
    } catch (error) {
        console.error(`Error reading localStorage key "${key}":`, error);
        return defaultValue;
    }
};

/**
 * Safe function to set value in localStorage
 */
export const setToStorage = (key, value) => {
    try {
        if (value === null || value === undefined) {
            localStorage.removeItem(key);
        } else {
            localStorage.setItem(key, JSON.stringify(value));
        }
        return true;
    } catch (error) {
        console.error(`Error setting localStorage key "${key}":`, error);
        return false;
    }
};

export default useLocalStorage;
