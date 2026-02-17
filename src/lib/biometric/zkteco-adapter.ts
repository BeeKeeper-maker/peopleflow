/**
 * ZKTeco Device Adapter
 *
 * Implements the BiometricDeviceAdapter interface for ZKTeco devices.
 * Uses the `zkteco-js` npm package for TCP/UDP communication.
 * Supports: F18, F8, K40, K50, uFace, iClock, and ZK-protocol compatible devices.
 */

import {
    BiometricDeviceAdapter,
    ConnectionResult,
    DeviceInfo,
    DeviceUser,
    SyncResult,
    AttendanceLog,
    registerAdapter,
} from "./device-adapter";

class ZKTecoAdapter implements BiometricDeviceAdapter {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    private device: any = null;
    private connected = false;

    getBrandName(): string {
        return "ZKTeco";
    }

    async connect(ip: string, port: number): Promise<ConnectionResult> {
        const startTime = Date.now();
        try {
            const ZKLib = await this.getZKLib();
            this.device = new ZKLib(ip, port, 5000, 4000); // timeout 5s, inport 4000
            await this.device.createSocket();
            this.connected = true;

            let deviceInfo: DeviceInfo | undefined;
            try {
                deviceInfo = await this.getDeviceInfo();
            } catch {
                // Device info fetch optional — connection still valid
            }

            return {
                success: true,
                message: `Connected to ZKTeco device at ${ip}:${port} in ${Date.now() - startTime}ms`,
                deviceInfo,
            };
        } catch (error) {
            this.connected = false;
            const errMsg = error instanceof Error ? error.message : String(error);
            return {
                success: false,
                message: `Failed to connect to ${ip}:${port} — ${errMsg}`,
            };
        }
    }

    async disconnect(): Promise<void> {
        if (this.device && this.connected) {
            try {
                await this.device.disconnect();
            } catch {
                // Ignore disconnect errors
            }
            this.connected = false;
            this.device = null;
        }
    }

    async testConnection(ip: string, port: number): Promise<ConnectionResult> {
        const result = await this.connect(ip, port);
        await this.disconnect();
        return result;
    }

    async getDeviceInfo(): Promise<DeviceInfo> {
        this.ensureConnected();
        try {
            const [info, userCount, logCount] = await Promise.allSettled([
                this.device.getInfo(),
                this.device.getUsers().then((u: { data?: unknown[] } | unknown[]) => Array.isArray(u) ? u.length : (u?.data?.length ?? 0)),
                this.device
                    .getAttendances()
                    .then(
                        (result: { data?: unknown[] } | unknown[]) =>
                            Array.isArray(result) ? result.length : (result?.data?.length ?? 0)
                    ),
            ]);

            const deviceInfoRaw = info.status === "fulfilled" ? info.value : {};
            const users = userCount.status === "fulfilled" ? userCount.value : 0;
            const logs = logCount.status === "fulfilled" ? logCount.value : 0;

            return {
                serialNumber: deviceInfoRaw?.serialNumber || "Unknown",
                firmwareVersion: deviceInfoRaw?.firmwareVersion || "Unknown",
                platform: deviceInfoRaw?.platform || "ZKTeco",
                deviceName: deviceInfoRaw?.deviceName || "ZK Device",
                userCount: users,
                logCount: logs,
            };
        } catch (error) {
            return {
                serialNumber: "Unknown",
                firmwareVersion: "Unknown",
                platform: "ZKTeco",
                deviceName: "ZK Device",
                userCount: 0,
                logCount: 0,
            };
        }
    }

    async getUsers(): Promise<DeviceUser[]> {
        this.ensureConnected();
        try {
            const result = await this.device.getUsers();
            // zkteco-js returns { data: [...] } or array directly
            const rawUsers = Array.isArray(result) ? result : (result?.data || []);

            return rawUsers.map(
                (u: {
                    uid?: number;
                    userId?: string;
                    name?: string;
                    role?: number;
                    cardno?: string;
                }) => ({
                    uid: u.uid || 0,
                    userId: String(u.userId || u.uid || ""),
                    name: u.name || `User ${u.uid}`,
                    role: u.role || 0,
                    cardNo: u.cardno,
                })
            );
        } catch (error) {
            console.error("ZKTeco getUsers error:", error);
            return [];
        }
    }

    async getAttendanceLogs(since?: Date): Promise<SyncResult> {
        this.ensureConnected();
        const startTime = Date.now();

        try {
            const result = await this.device.getAttendances();
            // zkteco-js returns { data: [...] } or array directly
            const rawLogs = Array.isArray(result) ? result : (result?.data || []);

            let logs: AttendanceLog[] = rawLogs.map(
                (log: {
                    uid?: number;
                    id?: string | number;
                    userId?: string | number;
                    timestamp?: string | Date;
                    recordTime?: string | Date;
                    state?: number;
                    type?: number;
                }) => ({
                    uid: log.uid || 0,
                    id: String(log.id || log.userId || log.uid || ""),
                    timestamp: new Date(log.timestamp || log.recordTime || Date.now()),
                    state: log.state ?? log.type ?? 0,
                })
            );

            // Filter by 'since' if provided
            if (since) {
                logs = logs.filter((l) => l.timestamp >= since);
            }

            return {
                success: true,
                logs,
                totalRecords: rawLogs.length,
                duration: Date.now() - startTime,
            };
        } catch (error) {
            const errMsg = error instanceof Error ? error.message : String(error);
            return {
                success: false,
                logs: [],
                totalRecords: 0,
                error: errMsg,
                duration: Date.now() - startTime,
            };
        }
    }

    // ── Private Helpers ────────────────────────────────────────────

    private ensureConnected(): void {
        if (!this.device || !this.connected) {
            throw new Error("Not connected to ZKTeco device. Call connect() first.");
        }
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    private async getZKLib(): Promise<any> {
        try {
            const mod = await import("zkteco-js");
            return mod.default || mod.ZKLib || mod;
        } catch {
            throw new Error(
                "zkteco-js package not found. Install: npm install zkteco-js"
            );
        }
    }
}

// ── Auto-register this adapter ─────────────────────────────────────

registerAdapter("ZKTeco", () => new ZKTecoAdapter());
registerAdapter("zk", () => new ZKTecoAdapter());

export default ZKTecoAdapter;
