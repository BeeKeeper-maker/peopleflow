"use client";

/**
 * Locale Provider
 * 
 * Provides i18n context for the entire application
 * Supports English and Bengali (বাংলা)
 */

import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
import { Locale, Translations, getTranslations, t as translate } from "@/lib/i18n";

interface LocaleContextType {
    locale: Locale;
    translations: Translations;
    setLocale: (locale: Locale) => void;
    t: (key: string, params?: Record<string, string | number>) => string;
}

const LocaleContext = createContext<LocaleContextType | undefined>(undefined);

const STORAGE_KEY = "peopleflow-locale";

export function LocaleProvider({ children }: { children: React.ReactNode }) {
    const [locale, setLocaleState] = useState<Locale>("en");
    const [translations, setTranslations] = useState<Translations>(getTranslations("en"));

    // Load saved locale on mount
    useEffect(() => {
        if (typeof window !== "undefined") {
            const saved = localStorage.getItem(STORAGE_KEY) as Locale | null;
            if (saved && (saved === "en" || saved === "bn")) {
                setLocaleState(saved);
                setTranslations(getTranslations(saved));
            }
        }
    }, []);

    // Update locale
    const setLocale = useCallback((newLocale: Locale) => {
        setLocaleState(newLocale);
        setTranslations(getTranslations(newLocale));
        if (typeof window !== "undefined") {
            localStorage.setItem(STORAGE_KEY, newLocale);
            // Update HTML lang attribute
            document.documentElement.lang = newLocale === "bn" ? "bn-BD" : "en";
        }
    }, []);

    // Translation function
    const t = useCallback((key: string, params?: Record<string, string | number>) => {
        return translate(locale, key, params);
    }, [locale]);

    return (
        <LocaleContext.Provider value={{ locale, translations, setLocale, t }}>
            {children}
        </LocaleContext.Provider>
    );
}

export function useLocale() {
    const context = useContext(LocaleContext);
    if (!context) {
        throw new Error("useLocale must be used within a LocaleProvider");
    }
    return context;
}

// Hook for translation only
export function useTranslation() {
    const { t, locale } = useLocale();
    return { t, locale };
}
