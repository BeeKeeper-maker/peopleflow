"use client"

import * as React from "react"
import { Command as CommandPrimitive } from "cmdk"
import { cn } from "@/lib/utils"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Check, ChevronsUpDown, Search, X } from "lucide-react"

export interface ComboboxOption {
    value: string
    label: string
    sublabel?: string
}

interface SearchableSelectProps {
    options: ComboboxOption[]
    value?: string
    onValueChange: (value: string) => void
    placeholder?: string
    searchPlaceholder?: string
    emptyText?: string
    disabled?: boolean
    className?: string
    /** When true, shows a clear button to deselect (for optional fields) */
    clearable?: boolean
}

export function SearchableSelect({
    options,
    value,
    onValueChange,
    placeholder = "Select...",
    searchPlaceholder = "Search...",
    emptyText = "No results found.",
    disabled = false,
    className,
    clearable = false,
}: SearchableSelectProps) {
    const [open, setOpen] = React.useState(false)
    const [search, setSearch] = React.useState("")

    const selectedOption = options.find(opt => opt.value === value)

    return (
        <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
                <button
                    type="button"
                    role="combobox"
                    aria-expanded={open}
                    disabled={disabled}
                    className={cn(
                        "flex h-10 w-full items-center justify-between rounded-xl border bg-hover border-card-border px-3 py-2 text-sm text-foreground transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500/50 disabled:cursor-not-allowed disabled:opacity-50",
                        !selectedOption && "text-muted-foreground",
                        className
                    )}
                >
                    <span className="truncate">
                        {selectedOption ? selectedOption.label : placeholder}
                    </span>
                    <div className="flex items-center gap-1 ml-2 shrink-0">
                        {/* Clear button for optional fields */}
                        {clearable && selectedOption && !disabled && (
                            <span
                                role="button"
                                tabIndex={0}
                                onClick={(e) => {
                                    e.stopPropagation()
                                    onValueChange("")
                                }}
                                onKeyDown={(e) => {
                                    if (e.key === "Enter" || e.key === " ") {
                                        e.stopPropagation()
                                        onValueChange("")
                                    }
                                }}
                                className="flex items-center justify-center h-5 w-5 rounded-md hover:bg-red-500/20 text-muted-foreground hover:text-red-400 transition-colors"
                            >
                                <X className="h-3 w-3" />
                            </span>
                        )}
                        <ChevronsUpDown className="h-4 w-4 opacity-50" />
                    </div>
                </button>
            </PopoverTrigger>
            <PopoverContent className="w-[--radix-popover-trigger-width] p-0 border-card-border bg-dropdown" align="start">
                <CommandPrimitive
                    className="flex h-full w-full flex-col overflow-hidden rounded-md"
                    shouldFilter={true}
                >
                    <div className="flex items-center border-b border-card-border px-3">
                        <Search className="mr-2 h-4 w-4 shrink-0 opacity-50" />
                        <CommandPrimitive.Input
                            value={search}
                            onValueChange={setSearch}
                            placeholder={searchPlaceholder}
                            className="flex h-10 w-full bg-transparent py-3 text-sm outline-none placeholder:text-muted-foreground disabled:cursor-not-allowed disabled:opacity-50"
                        />
                    </div>
                    <CommandPrimitive.List className="max-h-60 overflow-auto p-1">
                        <CommandPrimitive.Empty className="py-6 text-center text-sm text-muted-foreground">
                            {emptyText}
                        </CommandPrimitive.Empty>
                        {options.map((option) => (
                            <CommandPrimitive.Item
                                key={option.value}
                                value={option.label}
                                onSelect={() => {
                                    onValueChange(option.value)
                                    setSearch("")
                                    setOpen(false)
                                }}
                                className="relative flex cursor-pointer select-none items-center rounded-lg px-2 py-2.5 text-sm outline-none transition-colors data-[selected=true]:bg-hover data-[selected=true]:text-foreground hover:bg-hover"
                            >
                                <Check
                                    className={cn(
                                        "mr-2 h-4 w-4 text-blue-400",
                                        value === option.value ? "opacity-100" : "opacity-0"
                                    )}
                                />
                                <div className="flex flex-col">
                                    <span className="text-foreground">{option.label}</span>
                                    {option.sublabel && (
                                        <span className="text-xs text-muted-foreground">{option.sublabel}</span>
                                    )}
                                </div>
                            </CommandPrimitive.Item>
                        ))}
                    </CommandPrimitive.List>
                </CommandPrimitive>
            </PopoverContent>
        </Popover>
    )
}
