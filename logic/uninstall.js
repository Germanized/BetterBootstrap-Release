// --- START OF FILE logic/uninstall.js ---
// Refactored: Kill First + DELETE ASAR + Console Logs

// Utils - Use refactored versions
const { log, lognewline } = require("./utils/log"); // Uses logBoth internally now
const succeed = require("./utils/succeed");
const fail = require("./utils/fail");
const exists = require("./utils/exists");
const reset = require("./utils/reset");
const kill = require("./utils/kill");
const { showRestartNotice, showKillNotice } = require("./utils/notices");
const doSanityCheck = require("./utils/sanity");

// Progress Constants - Adjusted
const KILL_DISCORD_PROGRESS = 15;
const DELETE_SHIM_PROGRESS = 70 + KILL_DISCORD_PROGRESS; // Make space for ASAR delete
const DELETE_ASAR_PROGRESS = 85 + KILL_DISCORD_PROGRESS; // New step for deleting ASAR
const FINAL_RESTART_DISCORD_PROGRESS = 100; // Final step

// Helper for dual logging (already defined in log.js, but keep here for clarity if needed)
function logBoth(dependencies, message) { console.log(message); dependencies.ipc.addLog(message); }
function logErrorBoth(dependencies, message, error = null) { console.error(message, error || ''); dependencies.ipc.addLog(`❌ ${message}${error ? `: ${error.message || error}` : ''}`); }


/**
 * Restores Discord's original index.js by removing the shim. Based on original.
 */
async function deleteShims(discordResourcePaths, dependencies, startProgress, targetProgress) {
    const fs = dependencies.modules.fs; const path = dependencies.modules.path;
    const progressPerLoop = discordResourcePaths.length > 0 ? (targetProgress - startProgress) / discordResourcePaths.length : 0;
    const originalContent = `module.exports = require("./core.asar");`; let overallSuccess = true;

    logBoth(dependencies, "Uninstall: Starting deleteShims sub-step...");
    for (const [index, discordPath] of discordResourcePaths.entries()) {
        const indexFile = path.join(discordPath, "index.js"); const coreAsarFile = path.join(discordPath, "core.asar");
        logBoth(dependencies, "Removing shim from: " + indexFile);
        try {
            if (!dependencies.modules.fsSync.existsSync(coreAsarFile)) { logBoth(dependencies, `  -> Skipping shim removal: Discord's core.asar not found.`); dependencies.ipc.updateProgress(startProgress + progressPerLoop * (index + 1)); continue; }
            if (await exists(indexFile, dependencies)) {
                 const currentContent = await fs.readFile(indexFile, 'utf8');
                 if (currentContent.includes('betterdiscord.asar') || currentContent.includes('require("')) { logBoth(dependencies, "  -> Shim found. Writing original content..."); await fs.writeFile(indexFile, originalContent); logBoth(dependencies, "✅ Deletion successful"); }
                 else { logBoth(dependencies, "  -> ✅ Shim removal skipped (index.js doesn't contain BD require)."); }
            } else { logBoth(dependencies, `  -> ✅ Shim removal skipped (${indexFile} does not exist).`); }
            dependencies.ipc.updateProgress(startProgress + progressPerLoop * (index + 1));
        } catch (err) { logErrorBoth(dependencies, `Could not delete file ${indexFile}`, err); overallSuccess = false; return err; }
    }
    logBoth(dependencies, "Uninstall: deleteShims sub-step finished.");
    if (!overallSuccess) return new Error("One or more shim removals failed or were skipped.");
    return null;
}

/**
 * *** Deletes the betterdiscord.asar file ***
 */
async function deleteAsarFile(bdAsarStoragePath, dependencies) {
    logBoth(dependencies, `Attempting to delete ASAR file: ${bdAsarStoragePath}`);
    try {
        // Use original-fs unlink to match the install write method
        await dependencies.modules.originalFs.unlink(bdAsarStoragePath);
        logBoth(dependencies, `✅ Successfully deleted ${path.basename(bdAsarStoragePath)}.`);
        return null; // Success
    } catch (error) {
        // If file doesn't exist (ENOENT), that's considered success for uninstall
        if (error.code === 'ENOENT') {
            logBoth(dependencies, `✅ ASAR file already deleted or does not exist (ENOENT).`);
            return null; // Not an error in this context
        }
        // Log other errors as failures but don't necessarily stop the whole uninstall
        logErrorBoth(dependencies, `Failed to delete ASAR file`, error);
        return error; // Propagate other errors (could potentially make uninstall fail)
    }
}


/**
 * Main uninstall function. Kills first, removes shim, DELETES ASAR.
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

    // Define BD Folders needed for ASAR path
    const bdFolder = path.join(app.getPath("appData"), "BetterDiscord");
    const bdDataFolder = path.join(bdFolder, "data");
    const bdAsarStoragePath = path.join(bdDataFolder, "betterdiscord.asar"); // Path to the file to delete

    logBoth(dependencies, `Target channels: ${channels.join(', ') || 'None'}`);
    logBoth(dependencies, `Target ASAR Path to delete: ${bdAsarStoragePath}`);

    // --- Uninstallation Steps ---

    lognewline(dependencies, "--- Step 1: Killing Discord (Pre-modification) ---");
    const killProgressAmount = KILL_DISCORD_PROGRESS - 0;
    const preKillProgressPerLoop = channels.length > 0 ? killProgressAmount / channels.length : 0;
    const preKillErr = await kill(channels, preKillProgressPerLoop, dependencies, 0, false);
    if (preKillErr) { logErrorBoth(dependencies, "Failed to kill Discord.", preKillErr); showKillNotice(dependencies); return fail(dependencies, actionName, preKillErr); }
    logBoth(dependencies, "✅ Discord processes killed.");
    dependencies.ipc.updateProgress(KILL_DISCORD_PROGRESS);
    await new Promise(r => setTimeout(r, 500));


    lognewline(dependencies, "--- Step 2: Deleting shims ---");
    const deleteShimErr = await deleteShims(discordResourcePaths, dependencies, KILL_DISCORD_PROGRESS, DELETE_SHIM_PROGRESS);
    if (deleteShimErr) { logErrorBoth(dependencies,"Failed to delete shims."); return fail(dependencies, actionName, deleteShimErr); }
    logBoth(dependencies, "✅ Shims deleted");
    dependencies.ipc.updateProgress(DELETE_SHIM_PROGRESS);


    // *** THIS IS THE STEP THAT DELETES THE ASAR ***
    lognewline(dependencies, "--- Step 3: Deleting ASAR file ---");
    const deleteAsarErr = await deleteAsarFile(bdAsarStoragePath, dependencies);
    if (deleteAsarErr) {
         // Decide if failure to delete ASAR should fail the uninstall.
         // Usually, removing the shim is enough, so we just log the error.
         logErrorBoth(dependencies, "Could not delete betterdiscord.asar file (may already be gone or permission issue)", deleteAsarErr);
         // Do NOT return fail here unless deletion is absolutely critical
    } else {
         logBoth(dependencies, "✅ BetterDiscord ASAR file deleted (or did not exist).");
    }
    dependencies.ipc.updateProgress(DELETE_ASAR_PROGRESS); // Update progress


    lognewline(dependencies, "--- Step 4: Restarting Discord ---");
    const finalRestartProgressAmount = FINAL_RESTART_DISCORD_PROGRESS - DELETE_ASAR_PROGRESS;
    const finalKillProgressPerLoop = channels.length > 0 ? finalRestartProgressAmount / channels.length : 0;
    const finalKillErr = await kill(channels, finalKillProgressPerLoop, dependencies, DELETE_ASAR_PROGRESS, true); // Restart
    if (finalKillErr) { logErrorBoth(dependencies,"Discord restart problematic.", finalKillErr); showRestartNotice(dependencies); }
    else { logBoth(dependencies, "✅ Discord restarted"); }
    dependencies.ipc.updateProgress(FINAL_RESTART_DISCORD_PROGRESS);


    logBoth(dependencies, `===== ${actionName} Finished =====`);
    succeed(dependencies, actionName);
};

// Keep export just in case
exports.deleteShims = deleteShims;
// --- END OF FILE logic/uninstall.js ---