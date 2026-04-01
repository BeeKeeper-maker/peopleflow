/**
 * Biometric Device Module — Public API
 *
 * Central export point for all biometric device functionality.
 * Includes device adapter interface, sync engine, and shift utilities.
 */

// Core adapter interface & registry
export {
    type BiometricDeviceAdapter,
    type DeviceInfo,
    type DeviceUser,
    type AttendanceLog,
    type ConnectionResult,
    type SyncResult,
    getAdapter,
    getAvailableBrands,
    registerAdapter,
} from "./device-adapter";

// ZKTeco adapter (auto-registers on import)
import "./zkteco-adapter";

// Sync engine (v2 — night-shift-aware)
export { syncDevice, syncAllDevices, syncDeviceById, type SyncDeviceResult } from "./sync-engine";
