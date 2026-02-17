/**
 * Biometric Device Module — Public API
 *
 * Central export point for all biometric device functionality.
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

// Sync engine
export { syncDevice, syncAllDevices, type SyncDeviceResult } from "./sync-engine";
