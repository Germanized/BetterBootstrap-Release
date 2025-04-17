// --- START OF FILE logic/utils/sanity.js ---
// Refactored for main process

const { log } = require("./log"); // Use the refactored log util

/**
 * Performs basic check on config paths.
 * @param {object} config - The Discord installation config object.
 * @param {object} dependencies - The dependencies object.
 * @param {string} actionName - The name of the action being performed.
 * @returns {boolean} - True if paths seem okay, false otherwise.
 */
module.exports = function doSanityCheck(config, dependencies, actionName) {
    const paths = config ? Object.values(config).filter(p => p) : []; // Filter out falsey paths

    if (paths.length > 0) {
        log(dependencies, `Starting ${actionName.charAt(0).toUpperCase() + actionName.slice(1)}...`);
        log(dependencies, `  Target paths: ${paths.join(', ')}`);
        return true;
    }

    const message = "Sanity Check Failed: No valid Discord installation paths provided in config.";
    console.error(message);
    log(dependencies, `❌ ${message}`); // Log failure to UI
    return false;
};
// --- END OF FILE logic/utils/sanity.js ---