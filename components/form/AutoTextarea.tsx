// components/form/AutoTextarea.tsx
"use client";

import React, { useCallback, useRef, useEffect } from "react";
import { useFormContext, useWatch } from "react-hook-form";
import { useAutoSaveContext } from "./context/AutoSaveContext";

interface AutoTextareaProps {
    name: string;
    label?: string;
    placeholder?: string;
    rows?: number;
    className?: string;
    saveDelay?: number;
}

export default function AutoTextarea({
    name,
    label,
    placeholder,
    rows = 4,
    className,
    saveDelay = 500,
}: AutoTextareaProps) {
    const { setValue, getValues, control } = useFormContext();
    const { saveField, trabajoId } = useAutoSaveContext(); // ← Obtener trabajoId del contexto
    
    const timeoutRef = useRef<NodeJS.Timeout | null>(null);

    const value = useWatch({
        control,
        name: name as any,
        defaultValue: "",
    });

    const handleChange = useCallback(
        (e: React.ChangeEvent<HTMLTextAreaElement>) => {
            const val = e.target.value;
            
            // Actualizar el formulario
            setValue(name, val, {
                shouldDirty: true,
                shouldValidate: true,
            });

            // Debounce para autoguardado
            if (timeoutRef.current) {
                clearTimeout(timeoutRef.current);
            }

            timeoutRef.current = setTimeout(() => {
                // ✅ Usar el trabajoId del contexto
                if (trabajoId) {
                    saveField(name, val);
                } else {
                    console.warn(`AutoTextarea: No hay trabajoId para guardar "${name}"`);
                }
                timeoutRef.current = null;
            }, saveDelay);
        },
        [name, setValue, saveField, saveDelay, trabajoId]
    );

    const handleBlur = useCallback(() => {
        const val = getValues(name) ?? "";
        if (timeoutRef.current) {
            clearTimeout(timeoutRef.current);
            timeoutRef.current = null;
        }
        // ✅ Usar el trabajoId del contexto
        if (trabajoId) {
            saveField(name, val);
        }
    }, [name, getValues, saveField, trabajoId]);

    // Limpiar timeout al desmontar
    useEffect(() => {
        return () => {
            if (timeoutRef.current) {
                clearTimeout(timeoutRef.current);
                // Guardar cambios pendientes
                const val = getValues(name) ?? "";
                if (trabajoId && val) {
                    saveField(name, val);
                }
            }
        };
    }, [name, getValues, saveField, trabajoId]);

    return (
        <div className="w-full">
            {label && (
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                    {label}
                </label>
            )}
            <textarea
                value={value ?? ''}
                onChange={handleChange}
                onBlur={handleBlur}
                placeholder={placeholder}
                rows={rows}
                className={`w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:border-[#1C4880] focus:outline-none transition resize-none ${className || ''}`}
            />
        </div>
    );
}