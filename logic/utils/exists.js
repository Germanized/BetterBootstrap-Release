// --- START OF FILE logic/utils/exists.js ---
// Refactored to use injected dependencies

/**
 * Checks if a file or directory exists using injected fs.promises.
 * @param {string} file - The path to check.
 * @param {object} dependencies - The dependencies object.
 * @returns {Promise<boolean>} - True if exists, false otherwise.
 */
module.exports = async function exists(file, dependencies) {
    try {
        // Use fs.promises passed via dependencies
        await dependencies.modules.fs.stat(file);
        return true;
    } catch (error) {
        // Only return false for ENOENT (Not Found), re-throw others
        if (error.code === 'ENOENT') {
            return false;
        }
        console.error(`[Util Exists] Error checking path ${file}:`, error);
        throw error; // Re-throw unexpected errors
    }
};
// --- END OF FILE logic/utils/exists.js ---