"use client";

/**
 * Theme Provider
 * 
 * Manages light/dark theme with:
 * - localStorage persistence
 * - System preference detection
 * - SSR-safe (no flash of wrong theme)
 * - HTML class toggle for CSS variable switching
 */

import React, { createContext, useContext, useState, useEffect, useCallback } from "react";

type Theme = "light" | "dark" | "system";
type ResolvedTheme = "light" | "dark";

interface ThemeContextType {
    theme: Theme;
    resolvedTheme: ResolvedTheme;
    setTheme: (theme: Theme) => void;
    toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

const STORAGE_KEY = "peopleflow-theme";

function getSystemTheme(): ResolvedTheme {
    if (typeof window === "undefined") return "dark";
    return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

function resolveTheme(theme: Theme): ResolvedTheme {
    if (theme === "system") return getSystemTheme();
    return theme;
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
    const [theme, setThemeState] = useState<Theme>("dark");
    const [resolvedTheme, setResolvedTheme] = useState<ResolvedTheme>("dark");

    // Apply theme to DOM
    const applyTheme = useCallback((resolved: ResolvedTheme) => {
        const root = document.documentElement;
        root.classList.remove("light", "dark");
        root.classList.add(resolved);
        // Update meta theme-color for mobile browsers
        const meta = document.querySelector('meta[name="theme-color"]');
        if (meta) {
            meta.setAttribute("content", resolved === "dark" ? "#0A0A0F" : "#FFFFFF");
        }
    }, []);

    // Load saved theme on mount
    useEffect(() => {
        const saved = localStorage.getItem(STORAGE_KEY) as Theme | null;
        const initial = saved || "dark";
        const resolved = resolveTheme(initial);
        setThemeState(initial);
        setResolvedTheme(resolved);
        applyTheme(resolved);
    }, [applyTheme]);

    // Listen for system theme changes
    useEffect(() => {
        if (theme !== "system") return;
        const mq = window.matchMedia("(prefers-color-scheme: dark)");
        const handler = (e: MediaQueryListEvent) => {
            const resolved = e.matches ? "dark" : "light";
            setResolvedTheme(resolved);
            applyTheme(resolved);
        };
        mq.addEventListener("change", handler);
        return () => mq.removeEventListener("change", handler);
    }, [theme, applyTheme]);

    const setTheme = useCallback((newTheme: Theme) => {
        const resolved = resolveTheme(newTheme);
        setThemeState(newTheme);
        setResolvedTheme(resolved);
        localStorage.setItem(STORAGE_KEY, newTheme);
        applyTheme(resolved);
    }, [applyTheme]);

    const toggleTheme = useCallback(() => {
        setTheme(resolvedTheme === "dark" ? "light" : "dark");
    }, [resolvedTheme, setTheme]);

    return (
        <ThemeContext.Provider value={{ theme, resolvedTheme, setTheme, toggleTheme }}>
            {children}
        </ThemeContext.Provider>
    );
}

export function useTheme() {
    const context = useContext(ThemeContext);
    if (!context) {
        throw new Error("useTheme must be used within a ThemeProvider");
    }
    return context;
}
