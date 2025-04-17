// --- START OF FILE logic/utils/notices.js ---
// Refactored for main process

/**
 * Shows a dialog asking the user to manually restart Discord.
 * @param {object} dependencies - The dependencies object.
 */
function showRestartNotice(dependencies) {
    console.warn("[Notice] Showing restart notice dialog.");
    dependencies.electron.dialog.showMessageBox(dependencies.window || null, { // Use async version
        type: "info",
        title: "Restart Discord",
        message: "BetterDiscord could not restart Discord automatically. Please restart Discord manually to apply changes."
    }).catch(err => console.error("Error showing restart notice dialog:", err)); // Catch potential dialog errors
}

/**
 * Shows an error dialog asking the user to manually shut down Discord.
 * @param {object} dependencies - The dependencies object.
 */
function showKillNotice(dependencies) {
    console.error("[Notice] Showing kill notice dialog.");
     dependencies.electron.dialog.showMessageBox(dependencies.window || null, { // Use async version
        type: "error",
        title: "Shutdown Discord Failed",
        message: "BetterDiscord could not shut down Discord automatically. Please ensure Discord is fully closed (check system tray or task manager), then run the installer again."
    }).catch(err => console.error("Error showing kill notice dialog:", err)); // Catch potential dialog errors
}

module.exports = {
    showRestartNotice,
    showKillNotice
};
// --- END OF FILE logic/utils/notices.js ---