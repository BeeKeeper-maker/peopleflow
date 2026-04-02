#!/usr/bin/env node

/**
 * ╔══════════════════════════════════════════════════════════════════╗
 * ║           PeopleFlow Sync Agent v1.0.0                          ║
 * ║   Bridge your local ZKTeco device to PeopleFlow HRMS Cloud      ║
 * ║                                                                  ║
 * ║   Usage:                                                         ║
 * ║     node peopleflow-sync.js                     (interactive)    ║
 * ║     node peopleflow-sync.js --url=X --key=Y --device-ip=Z       ║
 * ╚══════════════════════════════════════════════════════════════════╝
 *
 * Zero dependencies — uses only Node.js built-in modules.
 * Compatible with Node.js 16+ (LTS).
 */

const net = require("net");
const https = require("https");
const http = require("http");
const fs = require("fs");
const path = require("path");
const readline = require("readline");
const os = require("os");
const crypto = require("crypto");

// ── Constants ────────────────────────────────────────────────────────

const VERSION = "1.0.0";
const CONFIG_FILE = path.join(os.homedir(), ".peopleflow-sync.json");
const SYNC_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes
const HEARTBEAT_INTERVAL_MS = 3 * 60 * 1000; // 3 minutes
const ZKTECO_PORT = 4370;
const CONNECT_TIMEOUT = 8000;

// ZKTeco protocol constants
const USHRT_MAX = 65535;
const CMD_CONNECT = 1000;
const CMD_EXIT = 1001;
const CMD_ATTLOG_RRQ = 13;
const CMD_ACK_OK = 2000;

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
    bgGreen: "\x1b[42m",
    bgRed: "\x1b[41m",
    bgBlue: "\x1b[44m",
    bgYellow: "\x1b[43m",
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

function banner() {
    console.log(`
${c.cyan}${c.bold}╔══════════════════════════════════════════════════════╗
║           PeopleFlow Sync Agent v${VERSION}              ║
║      Local Biometric → Cloud HRMS Bridge             ║
╚══════════════════════════════════════════════════════╝${c.reset}
`);
}

// ── Configuration ────────────────────────────────────────────────────

function loadConfig() {
    try {
        if (fs.existsSync(CONFIG_FILE)) {
            return JSON.parse(fs.readFileSync(CONFIG_FILE, "utf8"));
        }
    } catch { }
    return null;
}

function saveConfig(config) {
    fs.writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2));
    logSuccess(`Config saved to ${CONFIG_FILE}`);
}

function parseArgs() {
    const args = {};
    process.argv.slice(2).forEach((arg) => {
        const match = arg.match(/^--(\w[\w-]*)=(.+)$/);
        if (match) {
            const key = match[1].replace(/-([a-z])/g, (_, l) => l.toUpperCase());
            args[key] = match[2].replace(/^["']|["']$/g, "");
        }
    });
    return args;
}

async function prompt(question) {
    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout,
    });
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

    // If CLI args provided, use them
    if (args.url && args.key && args.deviceIp) {
        config = {
            cloudUrl: args.url.replace(/\/$/, ""),
            apiKey: args.key,
            deviceIp: args.deviceIp,
            devicePort: parseInt(args.devicePort) || ZKTECO_PORT,
            syncInterval: parseInt(args.syncInterval) || SYNC_INTERVAL_MS / 60000,
        };
        saveConfig(config);
        return config;
    }

    // If config file exists, ask to reuse
    if (config && config.cloudUrl && config.apiKey && config.deviceIp) {
        logInfo(`Found existing config: ${config.cloudUrl} → ${config.deviceIp}`);
        const reuse = await prompt("Use existing config? (Y/n):");
        if (reuse.toLowerCase() !== "n") {
            return config;
        }
    }

    // Interactive setup
    console.log(`\n${c.yellow}${c.bold}─── First-Time Setup ───${c.reset}\n`);

    const cloudUrl = await prompt("Enter your PeopleFlow URL (e.g., https://drdf.ailearnersbd.com):");
    const apiKey = await prompt("Paste your API Key (from Dashboard → Devices → Sync Agent):");
    const deviceIp = await prompt("Enter ZKTeco device IP address (e.g., 192.168.1.201):");
    const devicePortInput = await prompt(`Enter device port (default ${ZKTECO_PORT}):`);
    const intervalInput = await prompt("Sync interval in minutes (default 5):");

    config = {
        cloudUrl: cloudUrl.replace(/\/$/, ""),
        apiKey,
        deviceIp,
        devicePort: parseInt(devicePortInput) || ZKTECO_PORT,
        syncInterval: parseInt(intervalInput) || 5,
    };

    saveConfig(config);
    return config;
}

// ── ZKTeco Protocol (Lightweight Implementation) ─────────────────────

function createHeader(command, sessionId, replyId, data) {
    const dataLength = data ? data.length : 0;
    const buf = Buffer.alloc(8 + dataLength);
    buf.writeUInt16LE(command, 0);
    buf.writeUInt16LE(0, 2); // checksum placeholder
    buf.writeUInt16LE(sessionId, 4);
    buf.writeUInt16LE(replyId, 6);
    if (data) data.copy(buf, 8);

    // Calculate checksum
    const chksum = calcChecksum(buf);
    buf.writeUInt16LE(chksum, 2);

    return buf;
}

function calcChecksum(buf) {
    let chk = 0;
    for (let i = 0; i < buf.length; i += 2) {
        if (i === 2) continue; // skip checksum field
        chk += buf.readUInt16LE(i);
    }
    chk = chk % USHRT_MAX;
    return (USHRT_MAX - chk) % USHRT_MAX;
}

function createTCPHeader(command, sessionId, replyId, data) {
    const header = createHeader(command, sessionId, replyId, data);
    const prefix = Buffer.alloc(8);
    prefix.writeUInt32LE(0x50504B44, 0); // DKPP magic
    prefix.writeUInt16LE(header.length, 4);
    prefix.writeUInt16LE(0, 6);
    return Buffer.concat([prefix, header]);
}

class ZKDevice {
    constructor(ip, port) {
        this.ip = ip;
        this.port = port;
        this.socket = null;
        this.sessionId = 0;
        this.replyId = 0;
    }

    connect() {
        return new Promise((resolve, reject) => {
            const timeout = setTimeout(() => {
                if (this.socket) this.socket.destroy();
                reject(new Error(`Connection timeout after ${CONNECT_TIMEOUT}ms`));
            }, CONNECT_TIMEOUT);

            this.socket = new net.Socket();

            this.socket.connect(this.port, this.ip, () => {
                clearTimeout(timeout);
                // Send connect command
                const packet = createTCPHeader(CMD_CONNECT, 0, 0, null);
                this.socket.write(packet);
            });

            this.socket.once("data", (data) => {
                clearTimeout(timeout);
                if (data.length >= 16) {
                    const reply = data.readUInt16LE(8);
                    if (reply === CMD_ACK_OK) {
                        this.sessionId = data.readUInt16LE(12);
                        this.replyId = 1;
                        resolve(true);
                    } else {
                        reject(new Error(`Device rejected connection: reply=${reply}`));
                    }
                } else {
                    reject(new Error("Invalid response from device"));
                }
            });

            this.socket.on("error", (err) => {
                clearTimeout(timeout);
                reject(new Error(`TCP error: ${err.message}`));
            });
        });
    }

    getAttendanceLogs() {
        return new Promise((resolve, reject) => {
            const timeout = setTimeout(() => {
                reject(new Error("Attendance fetch timeout"));
            }, 30000);

            const packet = createTCPHeader(
                CMD_ATTLOG_RRQ,
                this.sessionId,
                this.replyId++,
                null
            );
            this.socket.write(packet);

            const chunks = [];
            let totalExpected = 0;
            let totalReceived = 0;
            let headerParsed = false;

            const onData = (data) => {
                if (!headerParsed && data.length >= 16) {
                    // First response has the size info
                    const replyCode = data.readUInt16LE(8);

                    if (replyCode === CMD_ACK_OK && data.length >= 20) {
                        // Direct data in the reply (small datasets)
                        const payload = data.slice(16);
                        if (payload.length > 0) {
                            chunks.push(payload);
                        }
                        clearTimeout(timeout);
                        this.socket.removeListener("data", onData);
                        resolve(this._parseAttendanceLogs(Buffer.concat(chunks)));
                        return;
                    }

                    // Large dataset — expect streaming data
                    if (data.length >= 20) {
                        totalExpected = data.readUInt32LE(16);
                        headerParsed = true;
                        // Rest of this packet is data
                        if (data.length > 24) {
                            const payload = data.slice(24);
                            chunks.push(payload);
                            totalReceived += payload.length;
                        }
                    } else {
                        clearTimeout(timeout);
                        this.socket.removeListener("data", onData);
                        resolve([]);
                        return;
                    }
                } else if (headerParsed) {
                    // Streaming data chunks — skip TCP prefix if present
                    let payload = data;
                    if (data.length >= 8 && data.readUInt32LE(0) === 0x50504B44) {
                        payload = data.slice(16);
                    }
                    chunks.push(payload);
                    totalReceived += payload.length;
                }

                // Check if we've received all data
                if (headerParsed && totalReceived >= totalExpected) {
                    clearTimeout(timeout);
                    this.socket.removeListener("data", onData);
                    resolve(this._parseAttendanceLogs(Buffer.concat(chunks)));
                }
            };

            this.socket.on("data", onData);
        });
    }

    _parseAttendanceLogs(buffer) {
        const logs = [];
        const text = buffer.toString("utf8");
        const lines = text.split("\n").filter((l) => l.trim());

        for (const line of lines) {
            try {
                // ZKTeco ATTLOG format: "userId\ttimestamp\tverifyType\tinOutMode\tworkCode"
                const parts = line.split("\t");
                if (parts.length >= 2) {
                    const userId = parts[0].trim();
                    const timestamp = parts[1].trim();

                    if (userId && timestamp) {
                        const date = new Date(timestamp.replace(/ /g, "T"));
                        if (!isNaN(date.getTime())) {
                            logs.push({
                                userId,
                                timestamp: date.toISOString(),
                                type: parseInt(parts[3]) || 0,
                            });
                        }
                    }
                }
            } catch {
                // Skip malformed lines
            }
        }

        return logs;
    }

    disconnect() {
        return new Promise((resolve) => {
            try {
                if (this.socket) {
                    const packet = createTCPHeader(
                        CMD_EXIT,
                        this.sessionId,
                        this.replyId++,
                        null
                    );
                    this.socket.write(packet);
                    setTimeout(() => {
                        if (this.socket) this.socket.destroy();
                        resolve();
                    }, 500);
                } else {
                    resolve();
                }
            } catch {
                resolve();
            }
        });
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
                    const json = JSON.parse(data);
                    if (res.statusCode >= 200 && res.statusCode < 300) {
                        resolve(json);
                    } else {
                        reject(new Error(json.error || `HTTP ${res.statusCode}`));
                    }
                } catch {
                    reject(new Error(`Invalid response: ${res.statusCode}`));
                }
            });
        });

        req.on("error", (err) => reject(err));
        req.on("timeout", () => {
            req.destroy();
            reject(new Error("Request timeout"));
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
        });
        logHeart(`Heartbeat OK → ${result.organization || "Cloud"}`);
        return true;
    } catch (err) {
        logWarn(`Heartbeat failed: ${err.message}`);
        return false;
    }
}

async function pushAttendance(config, records) {
    try {
        const result = await apiRequest(config, "/api/v1/sync/push", {
            agentVersion: VERSION,
            records,
        });
        return result;
    } catch (err) {
        throw new Error(`Push failed: ${err.message}`);
    }
}

// ── Sync Cycle ───────────────────────────────────────────────────────

let lastSyncedRecords = new Set();

async function syncCycle(config) {
    logSync("Starting sync cycle...");

    const device = new ZKDevice(config.deviceIp, config.devicePort);
    let logs = [];

    try {
        // 1. Connect to device
        logInfo(`Connecting to ZKTeco at ${config.deviceIp}:${config.devicePort}...`);
        await device.connect();
        logSuccess(`Connected to device (session: ${device.sessionId})`);

        // 2. Fetch attendance logs
        logInfo("Fetching attendance logs...");
        logs = await device.getAttendanceLogs();
        logInfo(`Retrieved ${logs.length} raw log entries`);

        // 3. Disconnect
        await device.disconnect();
        logSuccess("Disconnected from device");
    } catch (err) {
        logError(`Device error: ${err.message}`);
        try { await device.disconnect(); } catch { }
        return { success: false, error: err.message };
    }

    if (logs.length === 0) {
        logInfo("No attendance logs to sync");
        return { success: true, synced: 0 };
    }

    // 4. Deduplicate — only push records we haven't seen before
    const newLogs = logs.filter((l) => {
        const key = `${l.userId}::${l.timestamp}`;
        if (lastSyncedRecords.has(key)) return false;
        lastSyncedRecords.add(key);
        return true;
    });

    // Prune the dedup set to prevent memory leak (keep last 10k)
    if (lastSyncedRecords.size > 10000) {
        const arr = Array.from(lastSyncedRecords);
        lastSyncedRecords = new Set(arr.slice(-5000));
    }

    if (newLogs.length === 0) {
        logInfo("All records already synced (no new data)");
        return { success: true, synced: 0, skipped: logs.length };
    }

    // 5. Push to cloud
    logSync(`Pushing ${newLogs.length} new records to cloud...`);
    try {
        const result = await pushAttendance(config, newLogs);
        if (result.success) {
            const s = result.summary;
            logSuccess(
                `Sync complete: ${s.synced} synced, ${s.skipped} skipped, ${s.unmappedUsers} unmapped`
            );
            if (s.unmappedUserIds && s.unmappedUserIds.length > 0) {
                logWarn(`Unmapped device user IDs: ${s.unmappedUserIds.join(", ")}`);
                logWarn("→ Map these in Dashboard → Devices → View Users");
            }
            return { success: true, ...s };
        } else {
            logError(`Cloud rejected push: ${result.error || "Unknown error"}`);
            return { success: false, error: result.error };
        }
    } catch (err) {
        logError(`Cloud push failed: ${err.message}`);
        return { success: false, error: err.message };
    }
}

// ── Main Loop ────────────────────────────────────────────────────────

async function main() {
    banner();

    // Get or create config
    const config = await getConfig();

    console.log(`
${c.green}${c.bold}Configuration:${c.reset}
  ${c.cyan}Cloud URL:${c.reset}   ${config.cloudUrl}
  ${c.cyan}Device IP:${c.reset}   ${config.deviceIp}:${config.devicePort}
  ${c.cyan}Interval:${c.reset}    Every ${config.syncInterval} minutes
  ${c.cyan}Config:${c.reset}      ${CONFIG_FILE}
`);

    // Verify API key with heartbeat
    logInfo("Verifying API key with cloud...");
    const hbOk = await sendHeartbeat(config);
    if (!hbOk) {
        logError("Failed to verify API key. Please check your key and cloud URL.");
        logError("Run this script again with correct credentials.");
        process.exit(1);
    }
    logSuccess("API key verified! Cloud connection established.");

    console.log(`\n${c.green}${c.bold}═══ Agent Active — Syncing every ${config.syncInterval} minutes ═══${c.reset}\n`);

    // Initial sync
    await syncCycle(config);

    // Periodic sync loop
    const syncIntervalMs = (config.syncInterval || 5) * 60 * 1000;
    setInterval(async () => {
        await syncCycle(config);
    }, syncIntervalMs);

    // Periodic heartbeat
    setInterval(async () => {
        await sendHeartbeat(config);
    }, HEARTBEAT_INTERVAL_MS);

    // Graceful shutdown
    const shutdown = async () => {
        console.log(`\n${c.yellow}${c.bold}Shutting down gracefully...${c.reset}`);
        process.exit(0);
    };

    process.on("SIGINT", shutdown);
    process.on("SIGTERM", shutdown);

    // Keep alive
    logInfo("Press Ctrl+C to stop the agent.");
}

// ── Run ──────────────────────────────────────────────────────────────

main().catch((err) => {
    logError(`Fatal error: ${err.message}`);
    process.exit(1);
});
