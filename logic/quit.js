// --- START OF FILE logic/quit.js ---
// Refactored based on original logic for main process

/**
 * Shows confirmation dialog and quits the app if confirmed.
 * @param {object} dependencies - Injected dependencies.
 */
module.exports = async function(dependencies) {
    const dialog = dependencies.electron.dialog; // Get from dependencies
    const app = dependencies.electron.app; // Get from dependencies

    console.log("[Quit Logic] Showing quit confirmation dialog...");
    try {
        const confirmation = await dialog.showMessageBox(dependencies.window || null, { // Parent to window if possible
            type: "question",
            title: "Quit Installer?", // Title from original was "Are you sure?"
            message: "Are you sure you want to quit the BetterDiscord installer?", // Message adapted from original
            noLink: true,
            cancelId: 1, // Index of "Cancel"
            defaultId: 1, // Default selection to "Cancel"
            buttons: ["Quit", "Cancel"] // Button labels from original
        });

        console.log(`[Quit Logic] Dialog response: ${confirmation.response}`);
        if (confirmation.response === 0) { // User clicked "Quit" (index 0)
            console.log("[Quit Logic] User confirmed quit. Exiting application.");
            app.quit(); // Use app.quit() not remote.app.exit()
        } else {
             console.log("[Quit Logic] User cancelled quit.");
        }
    } catch (err) {
         console.error("[Quit Logic] Error showing quit dialog:", err);
         // Decide if app should quit anyway on dialog error, or just log it.
         // Maybe force quit? app.quit();
    }
};
// --- END OF FILE logic/quit.js ---