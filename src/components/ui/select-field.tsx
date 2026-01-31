"use client"

import * as React from "react"
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"
import { cn } from "@/lib/utils"

interface SelectFieldOption {
    label: string
    value: string
}

interface SelectFieldProps {
    label?: string
    placeholder?: string
    options: SelectFieldOption[]
    value?: string
    onChange?: (value: string) => void
    onValueChange?: (value: string) => void
    error?: string
    required?: boolean
    disabled?: boolean
    className?: string
    name?: string
}

export const SelectField = React.forwardRef<HTMLButtonElement, SelectFieldProps>(
    ({ label, placeholder, options, value, onChange, onValueChange, error, required, disabled, className, name }, ref) => {
        const handleChange = (newValue: string) => {
            if (onValueChange) {
                onValueChange(newValue)
            }
            if (onChange) {
                onChange(newValue)
            }
        }

        return (
            <div className={cn("space-y-2", className)}>
                {label && (
                    <label className="text-sm font-medium text-white/80">
                        {label}
                        {required && <span className="text-red-400 ml-1">*</span>}
                    </label>
                )}
                <Select
                    value={value}
                    onValueChange={handleChange}
                    disabled={disabled}
                    name={name}
                >
                    <SelectTrigger
                        ref={ref}
                        className={cn(
                            "h-10 w-full rounded-lg border bg-white/5 px-3 text-white transition-colors",
                            error
                                ? "border-red-500/50 focus:border-red-500"
                                : "border-white/10 focus:border-blue-500/50"
                        )}
                    >
                        <SelectValue placeholder={placeholder || "Select..."} />
                    </SelectTrigger>
                    <SelectContent className="bg-[#1C1C24] border-white/10">
                        {options.map((option) => (
                            <SelectItem
                                key={option.value}
                                value={option.value}
                                className="text-white hover:bg-white/10 focus:bg-white/10 cursor-pointer"
                            >
                                {option.label}
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>
                {error && (
                    <p className="text-xs text-red-400">{error}</p>
                )}
            </div>
        )
    }
)

SelectField.displayName = "SelectField"
