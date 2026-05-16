#!/usr/bin/env node

/**
 * PeopleFlow Sync Agent v1.1.1
 *
 * Production-grade local bridge for LAN-only ZKTeco biometric devices.
 * The cloud app cannot directly reach private office IPs (192.168.x.x), so this
 * agent runs inside the office network and securely pushes attendance punches to
 * PeopleFlow Cloud using a scoped Sync API key.
 *
 * Usage:
 *   node peopleflow-sync.js
 *   node peopleflow-sync.js --url=https://peopleflowbd.online --key=pf_sync_x --device-ip=192.168.1.201
 *   node peopleflow-sync.js --sync-all-history=true
 *   node peopleflow-sync.js --dry-run=true --once=true
 */

const https = require("https");
const http = require("http");
const net = require("net");
const fs = require("fs");
const path = require("path");
const readline = require("readline");
const os = require("os");
const childProcess = require("child_process");
const { createRequire } = require("module");

// ── Constants ────────────────────────────────────────────────────────

const VERSION = "1.1.1";
const CONFIG_FILE = path.join(os.homedir(), ".peopleflow-sync.json");
const STATE_FILE = path.join(os.homedir(), ".peopleflow-sync-state.json");
const LOCK_FILE = path.join(os.homedir(), ".peopleflow-sync.lock");
const RUNTIME_DIR = path.join(os.homedir(), ".peopleflow-sync-agent");
const RUNTIME_PACKAGE_DIR = path.join(RUNTIME_DIR, "runtime");
const SYNC_INTERVAL_MS = 5 * 60 * 1000;
const HEARTBEAT_INTERVAL_MS = 3 * 60 * 1000;
const ZKTECO_PORT = 4370;
const ZKTECO_PACKAGE = "zkteco-js";
const ZKTECO_PACKAGE_VERSION = "1.7.1";
const DEFAULT_INITIAL_LOOKBACK_DAYS = 7;
const DEFAULT_BATCH_SIZE = 500;
const DEVICE_TIMEOUT_MS = 15000;
const DEVICE_INPORT = 4000;

// ── Colorful Terminal Output ─────────────────────────────────────────

const c = {
    reset: "\x1b[0m",
    bold: "\x1b[1m",
    dim: "\x1b[2m",
    green: "\x1b[32m",
    yellow: "\x1b[33m",
    blue: "\x1b[34m",
    magenta: "\x1b[35m",
    cyan: "\x1b[36m",
    red: "\x1b[31m",
    white: "\x1b[37m",
};

function log(icon, msg, color = c.white) {
    const time = new Date().toLocaleTimeString();
    console.log(`${c.dim}[${time}]${c.reset} ${icon}  ${color}${msg}${c.reset}`);
}
function logSuccess(msg) { log("✅", msg, c.green); }
function logError(msg) { log("❌", msg, c.red); }
function logInfo(msg) { log("ℹ️ ", msg, c.cyan); }
function logWarn(msg) { log("⚠️ ", msg, c.yellow); }
function logSync(msg) { log("🔄", msg, c.blue); }
function logHeart(msg) { log("💓", msg, c.magenta); }

function errorMessage(err) {
    if (!err) return "Unknown error";
    if (err.message) return err.message;
    if (typeof err === "string") return err;
    try { return JSON.stringify(err); } catch { return String(err); }
}

function withTimeout(promise, ms, label) {
    let timer;
    const timeout = new Promise((_, reject) => {
        timer = setTimeout(() => reject(new Error(`${label} timed out after ${ms}ms`)), ms);
    });
    return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}

function tcpProbe(host, port, timeoutMs = 5000) {
    return new Promise((resolve, reject) => {
        const socket = new net.Socket();
        let settled = false;
        const done = (err) => {
            if (settled) return;
            settled = true;
            socket.destroy();
            if (err) reject(err);
            else resolve(true);
        };
        socket.setTimeout(timeoutMs);
        socket.once("connect", () => done());
        socket.once("timeout", () => done(new Error(`TCP probe timed out after ${timeoutMs}ms`)));
        socket.once("error", done);
        socket.connect(port, host);
    });
}


function banner() {
    console.log(`
${c.cyan}${c.bold}╔══════════════════════════════════════════════════════╗
║           PeopleFlow Sync Agent v${VERSION}              ║
║      Local Biometric → Cloud HRMS Bridge             ║
╚══════════════════════════════════════════════════════╝${c.reset}
`);
}


// ── Single Instance Lock ─────────────────────────────────────────────

function isProcessRunning(pid) {
    if (!pid || Number.isNaN(Number(pid))) return false;
    try {
        process.kill(Number(pid), 0);
        return true;
    } catch (err) {
        return err && err.code === "EPERM";
    }
}

function acquireLock() {
    try {
        const existing = readJson(LOCK_FILE, null);
        if (existing?.pid && isProcessRunning(existing.pid)) {
            throw new Error(`Another PeopleFlow Sync Agent is already running (PID ${existing.pid}). Stop the other Terminal window with Ctrl+C before starting a new test.`);
        }
        if (existing?.pid) logWarn("Removing stale Sync Agent lock from a previous closed session.");
    } catch (err) {
        if (err.message?.includes("already running")) throw err;
    }

    writeJson(LOCK_FILE, {
        pid: process.pid,
        startedAt: new Date().toISOString(),
        version: VERSION,
    });
}

function releaseLock() {
    try {
        const existing = readJson(LOCK_FILE, null);
        if (existing?.pid === process.pid) fs.unlinkSync(LOCK_FILE);
    } catch { }
}

// ── Configuration ────────────────────────────────────────────────────

function readJson(file, fallback = null) {
    try {
        if (fs.existsSync(file)) return JSON.parse(fs.readFileSync(file, "utf8"));
    } catch { }
    return fallback;
}

function writeJson(file, value) {
    fs.writeFileSync(file, JSON.stringify(value, null, 2));
}

function loadConfig() {
    return readJson(CONFIG_FILE, null);
}

function saveConfig(config) {
    writeJson(CONFIG_FILE, config);
    logSuccess(`Config saved to ${CONFIG_FILE}`);
}

function loadState() {
    return readJson(STATE_FILE, {
        lastSuccessfulTimestamp: null,
        syncedKeys: [],
        firstRunCompleted: false,
    });
}

function saveState(state) {
    const keys = Array.isArray(state.syncedKeys) ? state.syncedKeys.slice(-20000) : [];
    writeJson(STATE_FILE, { ...state, syncedKeys: keys });
}

function parseArgs() {
    const args = {};
    process.argv.slice(2).forEach((arg) => {
        const match = arg.match(/^--(\w[\w-]*)(?:=(.+))?$/);
        if (match) {
            const key = match[1].replace(/-([a-z])/g, (_, l) => l.toUpperCase());
            args[key] = match[2] === undefined ? "true" : match[2].replace(/^["']|["']$/g, "");
        }
    });
    return args;
}

function toBool(value, fallback = false) {
    if (value === undefined || value === null || value === "") return fallback;
    return ["1", "true", "yes", "y"].includes(String(value).toLowerCase());
}

async function prompt(question) {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    return new Promise((resolve) => {
        rl.question(`${c.cyan}? ${c.bold}${question}${c.reset} `, (answer) => {
            rl.close();
            resolve(answer.trim());
        });
    });
}

async function getConfig() {
    const args = parseArgs();
    let config = loadConfig();

    if (args.url && args.key && args.deviceIp) {
        config = {
            cloudUrl: args.url.replace(/\/$/, ""),
            apiKey: args.key,
            deviceIp: args.deviceIp,
            devicePort: parseInt(args.devicePort, 10) || ZKTECO_PORT,
            syncInterval: parseInt(args.syncInterval, 10) || SYNC_INTERVAL_MS / 60000,
            initialLookbackDays: parseInt(args.initialLookbackDays, 10) || DEFAULT_INITIAL_LOOKBACK_DAYS,
            syncAllHistory: toBool(args.syncAllHistory, false),
            batchSize: parseInt(args.batchSize, 10) || DEFAULT_BATCH_SIZE,
        };
        saveConfig(config);
        return { ...config, dryRun: toBool(args.dryRun, false), once: toBool(args.once, false) };
    }

    if (config && config.cloudUrl && config.apiKey && config.deviceIp) {
        logInfo(`Found existing config: ${config.cloudUrl} → ${config.deviceIp}:${config.devicePort || ZKTECO_PORT}`);
        const reuse = await prompt("Use existing config? (Y/n):");
        if (reuse.toLowerCase() !== "n") {
            return {
                ...config,
                devicePort: config.devicePort || ZKTECO_PORT,
                syncInterval: config.syncInterval || 5,
                initialLookbackDays: config.initialLookbackDays || DEFAULT_INITIAL_LOOKBACK_DAYS,
                syncAllHistory: Boolean(config.syncAllHistory),
                batchSize: config.batchSize || DEFAULT_BATCH_SIZE,
                dryRun: toBool(args.dryRun, false),
                once: toBool(args.once, false),
            };
        }
    }

    console.log(`\n${c.yellow}${c.bold}─── First-Time Setup ───${c.reset}\n`);

    const defaultUrl = typeof PRE_CONFIGURED_URL !== "undefined" ? PRE_CONFIGURED_URL : "";
    const defaultKey = typeof PRE_CONFIGURED_KEY !== "undefined" ? PRE_CONFIGURED_KEY : "";

    const cloudUrl = defaultUrl || await prompt("Enter your PeopleFlow URL (e.g., https://peopleflowbd.online):");
    if (defaultUrl) logSuccess(`Cloud URL: ${defaultUrl} (pre-configured)`);

    let apiKey = defaultKey;
    if (!apiKey) apiKey = await prompt("Paste your API Key (from Dashboard → Devices → Sync Agent):");
    else logSuccess("API Key: pre-configured ✓");

    const deviceIp = await prompt("Enter ZKTeco device IP address (e.g., 192.168.1.201):");
    const devicePortInput = await prompt(`Enter device port (default ${ZKTECO_PORT}):`);
    const intervalInput = await prompt("Sync interval in minutes (default 5):");
    const lookbackInput = await prompt(`First-run lookback days (default ${DEFAULT_INITIAL_LOOKBACK_DAYS}; use 0 for all history):`);

    const lookbackDays = lookbackInput === "0" ? 0 : (parseInt(lookbackInput, 10) || DEFAULT_INITIAL_LOOKBACK_DAYS);

    config = {
        cloudUrl: cloudUrl.replace(/\/$/, ""),
        apiKey,
        deviceIp,
        devicePort: parseInt(devicePortInput, 10) || ZKTECO_PORT,
        syncInterval: parseInt(intervalInput, 10) || 5,
        initialLookbackDays: lookbackDays,
        syncAllHistory: lookbackDays === 0,
        batchSize: DEFAULT_BATCH_SIZE,
    };

    saveConfig(config);
    return { ...config, dryRun: toBool(args.dryRun, false), once: toBool(args.once, false) };
}

// ── Dependency Management ────────────────────────────────────────────

function requireFromRuntime(packageName) {
    const runtimeRequire = createRequire(path.join(RUNTIME_PACKAGE_DIR, "package.json"));
    return runtimeRequire(packageName);
}

function ensurePackageJson() {
    fs.mkdirSync(RUNTIME_PACKAGE_DIR, { recursive: true });
    const pkgPath = path.join(RUNTIME_PACKAGE_DIR, "package.json");
    if (!fs.existsSync(pkgPath)) {
        writeJson(pkgPath, {
            private: true,
            name: "peopleflow-sync-runtime",
            version: "1.0.0",
            description: "Runtime dependencies for PeopleFlow Sync Agent",
            license: "UNLICENSED",
        });
    }
}

function runNpmInstall() {
    ensurePackageJson();
    logInfo(`Installing ${ZKTECO_PACKAGE}@${ZKTECO_PACKAGE_VERSION} locally under ${RUNTIME_PACKAGE_DIR}...`);
    logWarn("This is a one-time setup. The agent keeps dependencies isolated from your system projects.");

    const npmCommand = process.platform === "win32" ? "npm.cmd" : "npm";
    const result = childProcess.spawnSync(
        npmCommand,
        ["install", `${ZKTECO_PACKAGE}@${ZKTECO_PACKAGE_VERSION}`, "--omit=dev", "--no-audit", "--no-fund"],
        { cwd: RUNTIME_PACKAGE_DIR, stdio: "inherit" }
    );

    if (result.error) {
        throw new Error(`Unable to run npm. Install Node.js LTS from https://nodejs.org and try again. ${result.error.message}`);
    }
    if (result.status !== 0) {
        throw new Error(`Dependency install failed with exit code ${result.status}`);
    }
}

async function loadZktecoLibrary() {
    try {
        return require(ZKTECO_PACKAGE);
    } catch { }

    try {
        return requireFromRuntime(ZKTECO_PACKAGE);
    } catch { }

    runNpmInstall();
    try {
        return requireFromRuntime(ZKTECO_PACKAGE);
    } catch (err) {
        throw new Error(`Installed ${ZKTECO_PACKAGE}, but failed to load it: ${err.message}`);
    }
}

// ── Device Adapter ───────────────────────────────────────────────────

function normalizeZkModule(mod) {
    return mod && (mod.default || mod.ZKLib || mod);
}

function normalizeTimestamp(value) {
    if (!value) return null;
    const date = value instanceof Date ? value : new Date(value);
    if (Number.isNaN(date.getTime())) return null;
    return date.toISOString();
}

function normalizeAttendanceRows(result) {
    const rows = Array.isArray(result) ? result : (Array.isArray(result?.data) ? result.data : []);
    return rows
        .map((row) => {
            const userId = String(row.userId ?? row.user_id ?? row.uid ?? "").trim();
            const timestamp = normalizeTimestamp(row.timestamp ?? row.recordTime ?? row.record_time ?? row.attTime);
            if (!userId || !timestamp) return null;
            return {
                userId,
                timestamp,
                type: Number.isFinite(Number(row.type)) ? Number(row.type) : 0,
                state: Number.isFinite(Number(row.state)) ? Number(row.state) : undefined,
                serialNumber: row.sn ?? row.id ?? undefined,
            };
        })
        .filter(Boolean)
        .sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
}

class ZKDevice {
    constructor(ip, port) {
        this.ip = ip;
        this.port = port;
        this.device = null;
    }

    async connect() {
        const mod = await loadZktecoLibrary();
        const ZKLib = normalizeZkModule(mod);
        await tcpProbe(this.ip, this.port, 5000);
        this.device = new ZKLib(this.ip, this.port, DEVICE_TIMEOUT_MS, DEVICE_INPORT);
        await withTimeout(this.device.createSocket(), DEVICE_TIMEOUT_MS + 5000, "Device protocol connection");
        return true;
    }

    async getInfo() {
        if (!this.device) return null;
        if (typeof this.device.getInfo !== "function") return null;
        return this.device.getInfo();
    }

    async getAttendanceLogs() {
        if (!this.device) throw new Error("Device is not connected");
        const result = await withTimeout(this.device.getAttendances(), DEVICE_TIMEOUT_MS + 30000, "Attendance download");
        return normalizeAttendanceRows(result);
    }

    async disconnect() {
        try {
            if (this.device && typeof this.device.disconnect === "function") await this.device.disconnect();
        } catch { }
        this.device = null;
    }
}

// ── Cloud API Client ─────────────────────────────────────────────────

function apiRequest(config, endpoint, body) {
    return new Promise((resolve, reject) => {
        const url = new URL(endpoint, config.cloudUrl);
        const isHttps = url.protocol === "https:";
        const lib = isHttps ? https : http;
        const payload = JSON.stringify(body);

        const options = {
            hostname: url.hostname,
            port: url.port || (isHttps ? 443 : 80),
            path: url.pathname,
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${config.apiKey}`,
                "Content-Length": Buffer.byteLength(payload),
                "User-Agent": `PeopleFlow-Sync/${VERSION}`,
            },
            timeout: 15000,
        };

        const req = lib.request(options, (res) => {
            let data = "";
            res.on("data", (chunk) => (data += chunk));
            res.on("end", () => {
                try {
                    const json = JSON.parse(data || "{}");
                    if (res.statusCode >= 200 && res.statusCode < 300) resolve(json);
                    else reject(new Error(json.error || json.message || `HTTP ${res.statusCode}`));
                } catch {
                    reject(new Error(`Invalid response from cloud: HTTP ${res.statusCode}`));
                }
            });
        });

        req.on("error", (err) => reject(err));
        req.on("timeout", () => {
            req.destroy();
            reject(new Error("Cloud request timeout"));
        });
        req.write(payload);
        req.end();
    });
}

async function sendHeartbeat(config) {
    try {
        const result = await apiRequest(config, "/api/v1/sync/heartbeat", {
            agentVersion: VERSION,
            uptime: process.uptime(),
            deviceIp: config.deviceIp,
            devicePort: config.devicePort,
        });
        logHeart(`Heartbeat OK → ${result.organization || "Cloud"}`);
        return true;
    } catch (err) {
        logWarn(`Heartbeat failed: ${err.message}`);
        return false;
    }
}

async function pushAttendance(config, records) {
    return apiRequest(config, "/api/v1/sync/push", {
        agentVersion: VERSION,
        deviceIp: config.deviceIp,
        devicePort: config.devicePort,
        records,
    });
}

// ── Sync Logic ───────────────────────────────────────────────────────

function recordKey(record) {
    return `${record.userId}::${record.timestamp}`;
}

function getFirstRunCutoff(config) {
    if (config.syncAllHistory || Number(config.initialLookbackDays) === 0) return null;
    const days = Number(config.initialLookbackDays) || DEFAULT_INITIAL_LOOKBACK_DAYS;
    return new Date(Date.now() - days * 24 * 60 * 60 * 1000);
}

function filterRecordsForSync(config, state, logs) {
    const synced = new Set(state.syncedKeys || []);
    const lastSuccessful = state.lastSuccessfulTimestamp ? new Date(state.lastSuccessfulTimestamp) : null;
    const firstRunCutoff = state.firstRunCompleted ? null : getFirstRunCutoff(config);

    return logs.filter((record) => {
        const timestamp = new Date(record.timestamp);
        if (firstRunCutoff && timestamp < firstRunCutoff) return false;
        if (lastSuccessful && timestamp < new Date(lastSuccessful.getTime() - 60 * 60 * 1000)) return false;
        if (synced.has(recordKey(record))) return false;
        return true;
    });
}

function chunk(records, size) {
    const out = [];
    for (let i = 0; i < records.length; i += size) out.push(records.slice(i, i + size));
    return out;
}

async function syncCycle(config) {
    logSync("Starting sync cycle...");
    const state = loadState();
    const device = new ZKDevice(config.deviceIp, config.devicePort);
    let logs = [];

    try {
        logInfo(`Connecting to ZKTeco at ${config.deviceIp}:${config.devicePort}...`);
        await device.connect();
        logSuccess("Connected to device");

        try {
            const info = await withTimeout(device.getInfo(), DEVICE_TIMEOUT_MS, "Device info read");
            if (info) logInfo(`Device info: users=${info.userCounts ?? "?"}, logs=${info.logCounts ?? "?"}`);
        } catch (err) {
            logWarn(`Device info unavailable: ${errorMessage(err)}`);
        }

        logInfo("Fetching attendance logs...");
        logs = await device.getAttendanceLogs();
        logInfo(`Retrieved ${logs.length} attendance entries`);
    } catch (err) {
        const message = errorMessage(err);
        logError(`Device error: ${message}`);
        if (/timeout|ECONNRESET|EHOSTUNREACH|ETIMEDOUT|ENETUNREACH/i.test(message)) {
            logWarn("Device troubleshooting: make sure only one Sync Agent terminal is running, the PC is on the same office LAN/Wi‑Fi, the device IP/port are correct, and the fingerprint device is powered on/unlocked. If it was just tested multiple times, wait 30 seconds or restart the device.");
        }
        return { success: false, error: message };
    } finally {
        await device.disconnect();
    }

    if (logs.length === 0) {
        state.firstRunCompleted = true;
        saveState(state);
        logInfo("No attendance logs to sync");
        return { success: true, synced: 0 };
    }

    const newLogs = filterRecordsForSync(config, state, logs);
    if (newLogs.length === 0) {
        state.firstRunCompleted = true;
        saveState(state);
        logInfo("No new records to sync");
        return { success: true, synced: 0, skipped: logs.length };
    }

    if (!state.firstRunCompleted && !config.syncAllHistory) {
        logWarn(`First run safety: syncing only last ${config.initialLookbackDays || DEFAULT_INITIAL_LOOKBACK_DAYS} day(s). Use --sync-all-history=true for historical import.`);
    }

    const batchSize = Number(config.batchSize) || DEFAULT_BATCH_SIZE;
    if (config.dryRun) {
        logWarn(`Dry run: ${newLogs.length} record(s) ready, but nothing was pushed to cloud.`);
        const preview = newLogs.slice(-5).map((record) => `${record.userId}@${record.timestamp}`).join(", ");
        if (preview) logInfo(`Preview latest records: ${preview}`);
        return { success: true, dryRun: true, ready: newLogs.length };
    }

    const batches = chunk(newLogs, batchSize);
    let totalSynced = 0;
    let totalSkipped = 0;
    let totalUnmapped = 0;
    const unmappedIds = new Set();
    const syncedKeys = new Set(state.syncedKeys || []);

    for (let i = 0; i < batches.length; i++) {
        const batch = batches[i];
        logSync(`Pushing batch ${i + 1}/${batches.length} (${batch.length} records)...`);
        const result = await pushAttendance(config, batch);
        if (!result.success) throw new Error(result.error || "Cloud rejected push");

        const summary = result.summary || {};
        totalSynced += Number(summary.synced || 0);
        totalSkipped += Number(summary.skipped || 0);
        totalUnmapped += Number(summary.unmappedUsers || 0);
        for (const id of summary.unmappedUserIds || []) unmappedIds.add(id);
        for (const record of batch) syncedKeys.add(recordKey(record));

        const latest = batch[batch.length - 1]?.timestamp;
        if (latest) state.lastSuccessfulTimestamp = latest;
        state.syncedKeys = Array.from(syncedKeys).slice(-20000);
        state.firstRunCompleted = true;
        saveState(state);
    }

    logSuccess(`Sync complete: ${totalSynced} synced, ${totalSkipped} skipped, ${totalUnmapped} unmapped`);
    if (unmappedIds.size > 0) {
        logWarn(`Unmapped device user IDs: ${Array.from(unmappedIds).join(", ")}`);
        logWarn("Map these in PeopleFlow employee profiles using biometric user IDs.");
    }
    return { success: true, synced: totalSynced, skipped: totalSkipped, unmappedUsers: totalUnmapped };
}

// ── Main Loop ────────────────────────────────────────────────────────

async function main() {
    banner();
    acquireLock();
    process.on("exit", releaseLock);
    const config = await getConfig();

    console.log(`
${c.green}${c.bold}Configuration:${c.reset}
  ${c.cyan}Cloud URL:${c.reset}   ${config.cloudUrl}
  ${c.cyan}Device IP:${c.reset}   ${config.deviceIp}:${config.devicePort}
  ${c.cyan}Interval:${c.reset}    Every ${config.syncInterval} minutes
  ${c.cyan}First run:${c.reset}   ${config.syncAllHistory ? "sync all history" : `last ${config.initialLookbackDays || DEFAULT_INITIAL_LOOKBACK_DAYS} day(s)`}
  ${c.cyan}Mode:${c.reset}        ${config.dryRun ? "dry-run (no cloud push)" : "live sync"}
  ${c.cyan}Config:${c.reset}      ${CONFIG_FILE}
  ${c.cyan}State:${c.reset}       ${STATE_FILE}
`);

    logInfo("Verifying API key with cloud...");
    const hbOk = await sendHeartbeat(config);
    if (!hbOk) {
        logError("Failed to verify API key. Please check your key and cloud URL.");
        process.exit(1);
    }
    logSuccess("API key verified! Cloud connection established.");

    console.log(`\n${c.green}${c.bold}═══ Agent Active — Syncing every ${config.syncInterval} minutes ═══${c.reset}\n`);

    await syncCycle(config);

    if (config.once) {
        logInfo("One-shot mode complete. Exiting.");
        process.exit(0);
    }

    const syncIntervalMs = (config.syncInterval || 5) * 60 * 1000;
    setInterval(async () => {
        try { await syncCycle(config); }
        catch (err) { logError(`Sync cycle failed: ${err.message}`); }
    }, syncIntervalMs);

    setInterval(async () => {
        await sendHeartbeat(config);
    }, HEARTBEAT_INTERVAL_MS);

    const shutdown = async () => {
        console.log(`\n${c.yellow}${c.bold}Shutting down gracefully...${c.reset}`);
        process.exit(0);
    };
    process.on("SIGINT", shutdown);
    process.on("SIGTERM", shutdown);
    logInfo("Press Ctrl+C to stop the agent.");
}

main().catch((err) => {
    logError(`Fatal error: ${errorMessage(err)}`);
    releaseLock();
    process.exit(1);
});
