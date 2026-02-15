"use client";

import { useEffect } from "react";

export function PWARegister() {
    useEffect(() => {
        if (typeof window !== "undefined" && "serviceWorker" in navigator) {
            // Register service worker
            navigator.serviceWorker
                .register("/sw.js")
                .then((registration) => {
                    if (process.env.NODE_ENV === "development") {
                        // eslint-disable-next-line no-console
                        console.log("PeopleFlow SW registered:", registration.scope);
                    }

                    // Check for updates
                    registration.update();
                })
                .catch((error) => {
                    console.error("PeopleFlow SW registration failed:", error);
                });

            // Handle app install prompt
            let deferredPrompt: BeforeInstallPromptEvent | null = null;

            window.addEventListener("beforeinstallprompt", (e: Event) => {
                e.preventDefault();
                deferredPrompt = e as BeforeInstallPromptEvent;
            });

            // Detect successful install
            window.addEventListener("appinstalled", () => {
                deferredPrompt = null;
            });
        }
    }, []);

    return null;
}

// Type for the beforeinstallprompt event
interface BeforeInstallPromptEvent extends Event {
    prompt(): Promise<void>;
    userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

// Extend Window to include deferredPrompt
declare global {
    interface Window {
        deferredPrompt?: BeforeInstallPromptEvent;
    }
}

// Hook to trigger install prompt
export function useInstallPrompt() {
    const promptInstall = async () => {
        const deferredPrompt = window.deferredPrompt;
        if (deferredPrompt) {
            deferredPrompt.prompt();
            const { outcome } = await deferredPrompt.userChoice;
            if (process.env.NODE_ENV === "development") {
                // eslint-disable-next-line no-console
                console.log(`User ${outcome === "accepted" ? "accepted" : "dismissed"} install`);
            }
            window.deferredPrompt = undefined;
        }
    };

    return { promptInstall };
}
