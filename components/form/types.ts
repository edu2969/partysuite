// types.ts

import { FieldPath, FieldValues } from "react-hook-form";

export interface BaseAutoFieldProps<T extends FieldValues> {
    name: FieldPath<T>;
    label?: string;
    rules?: any;
    disabled?: boolean;
    readOnly?: boolean;
}

export interface AutoFieldRenderProps {
    id: string;
    value: any;
    error?: string;
    required: boolean;
    onChange(value: any): void;
    onBlur(): void;
}

export interface SelectOption {
    label: string;
    value: string | number;
}

export interface AutocompleteOption {
    id: string;
    label: string;
    sublabel?: string;
}