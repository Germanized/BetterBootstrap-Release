// --- START OF FILE logic/utils/fail.js ---
// Refactored for main process

const { log } = require("./log"); // Use refactored log util for IPC logging

const discordURL = "https://betterdiscord.app/invite";

// Helper for console logging within utils
function logUtilConsoleError(message, error = null) { console.error(`[Util Fail] ${message}`, error || ''); }

/**
 * Handles failure: logs message, sets status to 'error' via IPC.
 * @param {object} dependencies - The dependencies object.
 * @param {string} actionName - The name of the action being performed.
 * @param {Error} [error=null] - Optional error object to log.
 */
module.exports = function fail(dependencies, actionName, error = null) {
    log(dependencies, ""); // Send "" to renderer log
    const baseMessage = `The ${actionName} seems to have failed.`;
    const helpMessage = `If this problem is recurring, join our Discord community for support: ${discordURL}`;

    log(dependencies, `❌ ${baseMessage}`); // Send main error to renderer log
    if (error) {
         // Log full error only to main console for details
         logUtilConsoleError(`Action '${actionName}' failed with error:`, error);
         log(dependencies, `   Error: ${error.message || error}`); // Send brief error to renderer log
    }
    log(dependencies, helpMessage); // Send help message to renderer log

    // *** ADD Console log before sending status ***
    logUtilConsoleError(`Sending 'error' status via IPC for action: ${actionName}`);
    dependencies.ipc.updateStatus("error"); // *** CRITICAL: Send status to renderer ***
};
// --- END OF FILE logic/utils/fail.js ---