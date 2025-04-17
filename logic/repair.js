// --- START OF FILE logic/repair.js ---
// Refactored based on original logic, Confirmed Kill First Step

// Utils - Use refactored versions
// const { log, lognewline } = require("./utils/log"); // Use logBoth instead
const succeed = require("./utils/succeed");
const fail = require("./utils/fail");
const exists = require("./utils/exists"); // Use refactored exists
const kill = require("./utils/kill"); // Use refactored kill
const reset = require("./utils/reset");
const { showKillNotice } = require("./utils/notices");
const doSanityCheck = require("./utils/sanity");
const installLogic = require("./install.js"); // Need install logic for re-install step

// Progress Constants (from original, still valid as kill is first)
const KILL_DISCORD_PROGRESS = 20;
const DELETE_SHIM_PROGRESS = 60;
const DELETE_PLUGINS_JSON_PROGRESS = 80;

// Helper for dual logging
function logBoth(dependencies, message) {
    console.log(message);
    dependencies.ipc.addLog(message);
}
function logErrorBoth(dependencies, message, error = null) {
    console.error(message, error || '');
    dependencies.ipc.addLog(`❌ ${message}${error ? `: ${error.message || error}` : ''}`);
}

// --- Utility Functions DEFINED LOCALLY ---

/**
 * Restores Discord's original index.js. DEFINED LOCALLY.
 */
async function deleteShims(discordResourcePaths, dependencies, startProgress, targetProgress) {
    const fs = dependencies.modules.fs; const fsSync = dependencies.modules.fsSync; const path = dependencies.modules.path;
    const existsCheck = async (file) => { try { await fs.stat(file); return true; } catch { return false; } }; // Local exists check
    const progressPerLoop = discordResourcePaths.length > 0 ? (targetProgress - startProgress) / discordResourcePaths.length : 0;
    const originalContent = `module.exports = require("./core.asar");`;

    logBoth(dependencies, "Repair: Starting deleteShims sub-step...");
    for (const [index, discordPath] of discordResourcePaths.entries()) {
        const indexFile = path.join(discordPath, "index.js"); const coreAsarFile = path.join(discordPath, "core.asar");
        logBoth(dependencies, "[Repair] Removing shim from: " + indexFile);
        try {
             if (!fsSync.existsSync(coreAsarFile)) { logBoth(dependencies, `  -> Skipping shim removal: Discord's core.asar not found.`); dependencies.ipc.updateProgress(startProgress + progressPerLoop * (index + 1)); continue; }
            if (await existsCheck(indexFile)) { // Use local exists check
                 const currentContent = await fs.readFile(indexFile, 'utf8');
                 if (currentContent.includes('betterdiscord.asar')) { logBoth(dependencies, "  -> Shim found. Writing original content..."); await fs.writeFile(indexFile, originalContent); logBoth(dependencies, "  -> ✅ Shim removal successful."); }
                 else { logBoth(dependencies, "  -> ✅ Shim removal skipped (index.js doesn't contain BD require)."); }
            } else { logBoth(dependencies, `  -> ✅ Shim removal skipped (${indexFile} does not exist).`); }
            dependencies.ipc.updateProgress(startProgress + progressPerLoop * (index + 1));
        } catch (err) { logErrorBoth(dependencies, `Could not delete file ${indexFile}`, err); return err; }
    }
    logBoth(dependencies, "Repair: deleteShims sub-step finished."); return null;
}

/**
 * Disables plugins by deleting plugins.json. Based on original.
 */
async function disableAllPlugins(channels, bdDataFolder, dependencies, startProgress, targetProgress) {
    const path = dependencies.modules.path; const originalFsSync = dependencies.modules.originalFsSync; const fs = dependencies.modules.fs;
    const progressPerLoop = channels.length > 0 ? (targetProgress - startProgress) / channels.length : 0;

    logBoth(dependencies, "Repair: Starting disableAllPlugins sub-step...");
    for (const [index, channel] of channels.entries()) {
        const channelFolder = path.join(bdDataFolder, channel); const pluginsJson = path.join(channelFolder, "plugins.json");
        logBoth(dependencies, `[Repair] Checking plugins.json for channel '${channel}': ${pluginsJson}`);
        try {
            if (!originalFsSync.existsSync(channelFolder)) { logBoth(dependencies, `  -> Channel data folder does not exist, skipping.`); dependencies.ipc.updateProgress(startProgress + progressPerLoop * (index + 1)); continue; }
            if (originalFsSync.existsSync(pluginsJson)) { logBoth(dependencies, `  -> Found plugins.json. Deleting...`); await fs.unlink(pluginsJson); logBoth(dependencies, `✅ Deleted plugins.json`); }
            else { logBoth(dependencies, `✅ plugins.json does not exist`); }
            dependencies.ipc.updateProgress(startProgress + progressPerLoop * (index + 1));
        } catch (err) {
            if (err.code === 'ENOENT' && err.path === pluginsJson) { logBoth(dependencies, `✅ plugins.json does not exist (ENOENT).`); dependencies.ipc.updateProgress(startProgress + progressPerLoop * (index + 1)); }
            else { logErrorBoth(dependencies, `Failed to process plugins.json: ${pluginsJson}`, err); return err; }
        }
    }
    logBoth(dependencies, "Repair: disableAllPlugins sub-step finished."); return null;
}

/**
 * Asks user about reinstalling. Based on original.
 */
async function showInstallNotice(config, dependencies, actionName) {
    const dialog = dependencies.electron.dialog;
    logBoth(dependencies, "[Repair] Prompting user for reinstall...");
    const confirmation = await dialog.showMessageBox(dependencies.window || null, { type: "question", title: "Reinstall BetterDiscord?", message: "Repair complete. BetterDiscord has been reset.\n\nWould you like to reinstall BetterDiscord now?", detail: "Choosing 'No' means you'll need to run the installer again later.", noLink: true, cancelId: 1, defaultId: 0, buttons: ["Yes, Reinstall", "No"] });
    if (confirmation.response !== 0) { logBoth(dependencies, "Reinstall skipped by user."); return succeed(dependencies, actionName); } // succeed 'repair'
    logBoth(dependencies, "Proceeding with reinstall after repair...");
    await installLogic(config, dependencies, 'install'); // Run install, it calls succeed/fail
    logBoth(dependencies, "[Repair] Reinstall attempt finished.");
}


/**
 * Main repair function. Confirmed Kill First.
 * @param {object} config - Discord path configuration.
 * @param {object} dependencies - Injected dependencies.
 * @param {string} actionName - Action name for logging ('repair').
 */
module.exports = async function(config, dependencies, actionName) {
    const path = dependencies.modules.path;
    const app = dependencies.electron.app;

    logBoth(dependencies, `\n===== Starting ${actionName} =====`);

    await reset(dependencies);
    const sane = doSanityCheck(config, dependencies, actionName);
    if (!sane) return fail(dependencies, actionName);

    const channels = Object.keys(config).filter(ch => config[ch]);
    const discordResourcePaths = Object.values(config).filter(p => p);
    const bdFolder = path.join(app.getPath("appData"), "BetterDiscord");
    const bdDataFolder = path.join(bdFolder, "data");
    logBoth(dependencies, `BD Data Folder: ${bdDataFolder}`);


    // --- Repair Steps (Kill is already first) ---

    logBoth(dependencies, "\n--- Step 1: Killing Discord ---");
    const killProgressAmount = KILL_DISCORD_PROGRESS - 0;
    const killProgressPerLoop = channels.length > 0 ? killProgressAmount / channels.length : 0;
    const killErr = await kill(channels, killProgressPerLoop, dependencies, 0, false); // Don't restart
    if (killErr) {
        logErrorBoth(dependencies, "Failed to kill Discord processes", killErr);
        showKillNotice(dependencies);
        return fail(dependencies, actionName, killErr);
    }
    logBoth(dependencies, "✅ Discord Killed");
    dependencies.ipc.updateProgress(KILL_DISCORD_PROGRESS); // Set progress
    await new Promise(r => setTimeout(r, 500)); // Delay


    logBoth(dependencies, "\n--- Step 2: Deleting Shims ---");
    const deleteShimErr = await deleteShims(discordResourcePaths, dependencies, KILL_DISCORD_PROGRESS, DELETE_SHIM_PROGRESS);
    if (deleteShimErr) { logErrorBoth(dependencies,"Failed to delete shims."); return fail(dependencies, actionName, deleteShimErr); }
    logBoth(dependencies, "✅ Shims deleted");
    dependencies.ipc.updateProgress(DELETE_SHIM_PROGRESS);
    await new Promise(r => setTimeout(r, 200));


    logBoth(dependencies, "\n--- Step 3: Disabling Plugins ---");
    const deleteJsonErr = await disableAllPlugins(channels, bdDataFolder, dependencies, DELETE_SHIM_PROGRESS, DELETE_PLUGINS_JSON_PROGRESS);
    if (deleteJsonErr) { logErrorBoth(dependencies,"Failed to disable plugins."); return fail(dependencies, actionName, deleteJsonErr); }
    logBoth(dependencies, "✅ Plugins disabled");
    dependencies.ipc.updateProgress(DELETE_PLUGINS_JSON_PROGRESS);


    logBoth(dependencies, "\n--- Step 4: Prompting for Reinstall ---");
    await showInstallNotice(config, dependencies, actionName); // Handles final success/fail logging
    logBoth(dependencies, `===== ${actionName} Finished (incl. prompt) =====`);
};
// --- END OF FILE logic/repair.js ---