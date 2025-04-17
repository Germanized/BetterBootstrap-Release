// --- START OF FILE logic/debug.js ---
// Refactored for main process logging and IPC

// Use refactored log util
const { log } = require("./utils/log");

/**
 * Debug function to test IPC updates.
 * @param {object} config - Config object (used for logging paths).
 * @param {object} dependencies - Injected dependencies.
 * @param {string} actionName - Action name ('debug').
 */
module.exports = async function(config, dependencies, actionName) {
    const discordPaths = config ? Object.values(config).filter(p => p) : [];

    log(dependencies, `\n===== Starting ${actionName} =====`);
    discordPaths.forEach(v => log(dependencies, `  Debug Path: ${v}`));

    await new Promise(r => setTimeout(r, 200)); dependencies.ipc.updateProgress(10); log(dependencies, "Debug Step 1 (10%)");
    await new Promise(r => setTimeout(r, 300)); dependencies.ipc.updateProgress(25); log(dependencies, "Debug Step 2 (25%)");
    await new Promise(r => setTimeout(r, 1000)); dependencies.ipc.updateProgress(50); log(dependencies, "Debug Step 3 (50%)");
    await new Promise(r => setTimeout(r, 1000)); dependencies.ipc.updateStatus("error"); log(dependencies, "Debug Status: error");
    await new Promise(r => setTimeout(r, 1500)); dependencies.ipc.updateStatus(""); log(dependencies, "Debug Status: cleared");
    await new Promise(r => setTimeout(r, 500)); dependencies.ipc.updateProgress(75); log(dependencies, "Debug Step 4 (75%)");
    await new Promise(r => setTimeout(r, 500)); dependencies.ipc.updateProgress(100); log(dependencies, "Debug Step 5 (100%)");
    await new Promise(r => setTimeout(r, 200)); dependencies.ipc.updateStatus("success"); log(dependencies, "Debug Status: success");

    log(dependencies, `===== ${actionName} Finished =====`);
    // No explicit succeed/fail call needed for debug usually
};
// --- END OF FILE logic/debug.js ---