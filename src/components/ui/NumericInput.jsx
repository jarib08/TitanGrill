import React, { useState, useRef, useCallback } from 'react';

/**
 * NumericInput — Reusable numeric input that fixes the "0" problem.
 *
 * Uses string state during editing so typing replaces the initial "0".
 * Selects all text on focus. Converts to number on blur/submit.
 *
 * Props:
 *   value      — numeric value (controlled)
 *   onChange    — (numericValue: number) => void
 *   min        — minimum allowed value (default: undefined)
 *   max        — maximum allowed value (default: undefined)
 *   placeholder — placeholder text (default: "0")
 *   className  — additional CSS classes
 *   ...rest    — passed to underlying <input>
 */
const NumericInput = ({
    value,
    onChange,
    min,
    max,
    placeholder = '0',
    className = '',
    allowDecimals = false,
    ...rest
}) => {
    const [displayValue, setDisplayValue] = useState(null); // null = not editing
    const inputRef = useRef(null);

    const isEditing = displayValue !== null;

    const handleFocus = useCallback(() => {
        // When focusing, convert number to string for editing
        const strVal = value === 0 || value === null || value === undefined ? '' : String(value);
        setDisplayValue(strVal);
        // Select all text after a tick (so the browser has set the value)
        requestAnimationFrame(() => {
            inputRef.current?.select();
        });
    }, [value]);

    const handleChange = useCallback((e) => {
        const raw = e.target.value;

        // Allow empty string (will be treated as 0 on blur)
        if (raw === '') {
            setDisplayValue('');
            onChange(0);
            return;
        }

        // Allow negative sign alone while typing
        if (raw === '-') {
            setDisplayValue('-');
            return;
        }

        // Validate: only digits, optional leading minus, optional decimal point
        const pattern = allowDecimals ? /^-?\d*\.?\d*$/ : /^-?\d*$/;
        if (!pattern.test(raw)) return;

        setDisplayValue(raw);

        const numVal = allowDecimals ? parseFloat(raw) : parseInt(raw, 10);
        if (!isNaN(numVal)) {
            onChange(numVal);
        }
    }, [onChange, allowDecimals]);

    const handleBlur = useCallback(() => {
        // Commit: convert to proper number, apply min/max
        let numVal = 0;
        if (displayValue !== null && displayValue !== '' && displayValue !== '-') {
            numVal = allowDecimals ? parseFloat(displayValue) : parseInt(displayValue, 10);
            if (isNaN(numVal)) numVal = 0;
        }

        if (min !== undefined && numVal < min) numVal = min;
        if (max !== undefined && numVal > max) numVal = max;

        onChange(numVal);
        setDisplayValue(null); // Exit editing mode
    }, [displayValue, onChange, min, max, allowDecimals]);

    // Determine what to show
    const shownValue = isEditing ? displayValue : (value === 0 ? '0' : String(value ?? 0));

    return (
        <input
            ref={inputRef}
            type="text"
            inputMode={allowDecimals ? 'decimal' : 'numeric'}
            value={shownValue}
            placeholder={placeholder}
            className={className}
            onFocus={handleFocus}
            onChange={handleChange}
            onBlur={handleBlur}
            {...rest}
        />
    );
};

export default NumericInput;
