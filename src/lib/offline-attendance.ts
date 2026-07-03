"use client";

/**
 * PeopleFlow Offline Attendance Helper
 *
 * Enables employees to check in/out even when offline.
 * The action is queued in the service worker's IndexedDB
 * and synced automatically when connectivity returns.
 *
 * Usage in ESS dashboard:
 *   import { offlineCheckIn, offlineCheckOut, isOnline, onOnlineStatusChange } from "@/lib/offline-attendance"
 *
 *   const handleCheckIn = async () => {
 *       if (!navigator.onLine) {
 *           await offlineCheckIn(location)
 *           addToast({ title: "চেক-ইন সারি করা হয়েছে — সংযোগ ফিরলে সিঙ্ক হবে", type: "info" })
 *       } else {
 *           // Normal online check-in
 *       }
 *   }
 */

interface QueuedAttendance {
    url: string;
    method: string;
    headers: Record<string, string>;
    body: string;
    timestamp: number;
}

/**
 * Queue an attendance check-in for background sync.
 * The service worker will replay this when connectivity returns.
 */
export async function offlineCheckIn(location?: { lat: number; lng: number }): Promise<void> {
    const payload = {
        url: "/api/attendance/check-in",
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ location, source: "mobile" }),
        timestamp: Date.now(),
    };

    if ("serviceWorker" in navigator) {
        const reg = await navigator.serviceWorker.ready;
        reg.active?.postMessage({
            type: "QUEUE_ATTENDANCE",
            payload,
        });
    }

    // Also store in localStorage as backup
    const queue = JSON.parse(localStorage.getItem("pendingAttendance") || "[]");
    queue.push(payload);
    localStorage.setItem("pendingAttendance", JSON.stringify(queue));
}

/**
 * Queue an attendance check-out for background sync.
 */
export async function offlineCheckOut(location?: { lat: number; lng: number }): Promise<void> {
    const payload = {
        url: "/api/attendance/check-out",
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ location, source: "mobile" }),
        timestamp: Date.now(),
    };

    if ("serviceWorker" in navigator) {
        const reg = await navigator.serviceWorker.ready;
        reg.active?.postMessage({
            type: "QUEUE_ATTENDANCE",
            payload,
        });
    }

    const queue = JSON.parse(localStorage.getItem("pendingAttendance") || "[]");
    queue.push(payload);
    localStorage.setItem("pendingAttendance", JSON.stringify(queue));
}

/**
 * Check if the device is currently online.
 */
export function isOnline(): boolean {
    return typeof navigator !== "undefined" ? navigator.onLine : true;
}

/**
 * Listen for online/offline status changes.
 * Returns an unsubscribe function.
 *
 * Usage:
 *   useEffect(() => {
 *       const unsub = onOnlineStatusChange((online) => {
 *           if (online) addToast({ title: "সংযোগ ফিরেছে — সিঙ্ক করা হচ্ছে", type: "success" })
 *       })
 *       return unsub
 *   }, [])
 */
export function onOnlineStatusChange(callback: (online: boolean) => void): () => void {
    const handleOnline = () => callback(true);
    const handleOffline = () => callback(false);

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    return () => {
        window.removeEventListener("online", handleOnline);
        window.removeEventListener("offline", handleOffline);
    };
}

/**
 * Get the count of pending offline attendance actions.
 */
export function getPendingCount(): number {
    if (typeof window === "undefined") return 0;
    const queue = JSON.parse(localStorage.getItem("pendingAttendance") || "[]");
    return queue.length;
}

/**
 * Clear the pending queue (called after successful sync).
 */
export function clearPendingQueue(): void {
    localStorage.removeItem("pendingAttendance");
}
