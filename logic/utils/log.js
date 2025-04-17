// --- START OF FILE logic/utils/log.js ---
// Refactored to use injected dependencies for logging

/**
 * Logs an entry to both console and renderer via IPC.
 * @param {object} dependencies - The dependencies object.
 * @param {string} entry - The log message.
 */
function log(dependencies, entry) {
    console.log(entry);
    dependencies.ipc.addLog(entry);
}

/**
 * Logs an entry with a preceding newline to both console and renderer.
 * @param {object} dependencies - The dependencies object.
 * @param {string} entry - The log message.
 */
function lognewline(dependencies, entry) {
    console.log(""); // Log newline to console
    dependencies.ipc.addLog(""); // Send empty string for newline to renderer
    console.log(entry);
    dependencies.ipc.addLog(entry);
}

module.exports = {
    log,
    lognewline
};
// --- END OF FILE logic/utils/log.js ---