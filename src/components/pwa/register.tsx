"use client";

import { useEffect } from "react";

export function PWARegister() {
    useEffect(() => {
        if (typeof window !== "undefined" && "serviceWorker" in navigator) {
            // Register service worker
            navigator.serviceWorker
                .register("/sw.js")
                .then((registration) => {
                    console.log("PeopleFlow SW registered:", registration.scope);

                    // Check for updates
                    registration.update();
                })
                .catch((error) => {
                    console.error("PeopleFlow SW registration failed:", error);
                });

            // Handle app install prompt
            let deferredPrompt: any = null;

            window.addEventListener("beforeinstallprompt", (e: any) => {
                e.preventDefault();
                deferredPrompt = e;

                // You can show a custom install button here
                console.log("PeopleFlow: App can be installed");
            });

            // Detect successful install
            window.addEventListener("appinstalled", () => {
                console.log("PeopleFlow: App was installed");
                deferredPrompt = null;
            });
        }
    }, []);

    return null;
}

// Hook to trigger install prompt
export function useInstallPrompt() {
    const promptInstall = async () => {
        const deferredPrompt = (window as any).deferredPrompt;
        if (deferredPrompt) {
            deferredPrompt.prompt();
            const { outcome } = await deferredPrompt.userChoice;
            console.log(`User ${outcome === "accepted" ? "accepted" : "dismissed"} install`);
            (window as any).deferredPrompt = null;
        }
    };

    return { promptInstall };
}
