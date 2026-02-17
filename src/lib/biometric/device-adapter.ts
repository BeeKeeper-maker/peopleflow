/**
 * Biometric Device Adapter Interface
 *
 * Adapter pattern for multi-brand biometric device support.
 * Each brand implements this interface — adding a new brand
 * means just adding a new adapter file, no core code changes.
 */

// ── Types ────────────────────────────────────────────────────────────

export interface DeviceInfo {
    serialNumber: string;
    firmwareVersion: string;
    platform: string;
    deviceName: string;
    userCount: number;
    logCount: number;
}

export interface DeviceUser {
    uid: number;      // Internal user ID on device
    userId: string;   // The ID we map to Employee.biometricUserId
    name: string;
    role: number;     // 0=user, 14=admin
    cardNo?: string;
}

export interface AttendanceLog {
    uid: number;
    id: string;       // User ID on the device
    timestamp: Date;
    state: number;    // 0=check-in, 1=check-out, etc.
}

export interface ConnectionResult {
    success: boolean;
    message: string;
    deviceInfo?: DeviceInfo;
}

export interface SyncResult {
    success: boolean;
    logs: AttendanceLog[];
    totalRecords: number;
    error?: string;
    duration: number; // ms
}

// ── Adapter Interface ────────────────────────────────────────────────

export interface BiometricDeviceAdapter {
    /** Connect to the device */
    connect(ip: string, port: number): Promise<ConnectionResult>;

    /** Disconnect from the device */
    disconnect(): Promise<void>;

    /** Test if device is reachable */
    testConnection(ip: string, port: number): Promise<ConnectionResult>;

    /** Get device information (serial, firmware, user count, etc.) */
    getDeviceInfo(): Promise<DeviceInfo>;

    /** Get list of users registered on the device */
    getUsers(): Promise<DeviceUser[]>;

    /** Get attendance logs, optionally since a timestamp */
    getAttendanceLogs(since?: Date): Promise<SyncResult>;

    /** Get the adapter/brand name */
    getBrandName(): string;
}

// ── Adapter Registry ─────────────────────────────────────────────────

const adapterRegistry: Record<string, () => BiometricDeviceAdapter> = {};

export function registerAdapter(brand: string, factory: () => BiometricDeviceAdapter): void {
    adapterRegistry[brand.toLowerCase()] = factory;
}

export function getAdapter(brand: string): BiometricDeviceAdapter {
    const factory = adapterRegistry[brand.toLowerCase()];
    if (!factory) {
        throw new Error(`No adapter registered for brand: ${brand}. Available: ${Object.keys(adapterRegistry).join(", ")}`);
    }
    return factory();
}

export function getAvailableBrands(): string[] {
    return Object.keys(adapterRegistry);
}
