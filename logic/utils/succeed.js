// --- START OF FILE logic/utils/succeed.js ---
// Refactored for main process

// Use refactored log util for IPC logging
const { log } = require("./log");

// Helper for console logging within utils
function logUtilConsole(message) { console.log(`[Util Succeed] ${message}`); }

/**
 * Handles success: logs message, sets progress to 100, status to 'success' via IPC.
 * @param {object} dependencies - The dependencies object.
 * @param {string} actionName - The name of the action being performed.
 */
module.exports = function succeed(dependencies, actionName) {
    log(dependencies, ""); // Send "" to renderer log
    log(dependencies, `✅ ${actionName.charAt(0).toUpperCase() + actionName.slice(1)} completed!`); // Send success message to renderer log
    dependencies.ipc.updateProgress(100);

    // *** ADD Console log before sending status ***
    logUtilConsole(`Sending 'success' status via IPC for action: ${actionName}`);
    dependencies.ipc.updateStatus("success"); // *** CRITICAL: Send status to renderer ***
};
// --- END OF FILE logic/utils/succeed.js ---