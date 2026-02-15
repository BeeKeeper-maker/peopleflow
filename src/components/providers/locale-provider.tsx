"use client";

/**
 * Locale Provider
 * 
 * Manages locale state (en/bn) via localStorage + cookie.
 * The cookie is read by next-intl's server-side request config.
 * Translation function is provided by next-intl's useTranslations hook.
 */

import React, { createContext, useContext, useState, useEffect, useCallback } from "react";

export type Locale = "en" | "bn";

interface LocaleContextType {
    locale: Locale;
    setLocale: (locale: Locale) => void;
}

const LocaleContext = createContext<LocaleContextType | undefined>(undefined);

export function LocaleProvider({ children }: { children: React.ReactNode }) {
    const [locale, setLocaleState] = useState<Locale>("en");

    // Initialize from localStorage
    useEffect(() => {
        const stored = localStorage.getItem("peopleflow-locale") as Locale;
        if (stored === "bn" || stored === "en") {
            setLocaleState(stored);
        }
    }, []);

    const setLocale = useCallback((newLocale: Locale) => {
        setLocaleState(newLocale);
        localStorage.setItem("peopleflow-locale", newLocale);
        // Set cookie for server-side next-intl to read
        document.cookie = `peopleflow-locale=${newLocale};path=/;max-age=31536000;SameSite=Lax`;
        // Reload the page to let next-intl re-read the cookie server-side
        window.location.reload();
    }, []);

    return (
        <LocaleContext.Provider value={{ locale, setLocale }}>
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
