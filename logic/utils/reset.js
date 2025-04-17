// --- START OF FILE logic/utils/reset.js ---
// Refactored for main process

/**
 * Resets progress and status via IPC, adds delay.
 * (Note: Log clearing is handled by renderer or implicitly by new logs).
 * @param {object} dependencies - The dependencies object.
 */
module.exports = async function reset(dependencies) {
    console.log("[Reset Utility] Resetting UI state...");
    // Clear status and progress in the renderer UI
    dependencies.ipc.updateProgress(0);
    dependencies.ipc.updateStatus("");
    // Optionally send a clear logs command if the renderer implements it
    // dependencies.ipc.send('clear-logs');

    // Brief delay to allow UI to potentially update before new logs start
    await new Promise(r => setTimeout(r, 200));
    console.log("[Reset Utility] Reset complete.");
};
// --- END OF FILE logic/utils/reset.js ---