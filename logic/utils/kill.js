// --- START OF FILE logic/utils/kill.js ---
// Refactored for main process, improved restart logging

const { log } = require("./log"); // Use refactored log

const platforms = {stable: "Discord", ptb: "Discord PTB", canary: "Discord Canary"};

// Helper for dual logging within this file
function logKill(dependencies, message) { log(dependencies, `[Kill] ${message}`); }
function logKillError(dependencies, message, error = null) { log(dependencies, `[Kill] ❌ ${message}${error ? `: ${error.message || error}`:''}`); console.error(`[Kill Error] ${message}`, error || ''); }

module.exports = async function killProcesses(channels, progressPerChannel, dependencies, startProgress, shouldRestart = true) {
    const findProcess = dependencies.modules.findProcess;
    const kill = dependencies.modules.treeKill; // Assumes promisified treeKill
    const shell = dependencies.electron.shell;
    const path = dependencies.modules.path;
    const fsSync = dependencies.modules.fsSync;

    let overallError = null;
    logKill(dependencies, `killProcesses called. Channels: [${channels.join(', ')}], Restart: ${shouldRestart}`);

    for (const [index, channel] of channels.entries()) {
        const platformName = platforms[channel];
        let processQuery = platformName;
        if (process.platform === "win32") { processQuery = platformName.replace(" ", "") + ".exe"; }
        else if (process.platform === "linux") { processQuery = platformName.replace(" ", "").toLowerCase(); }

        logKill(dependencies, `Attempting find/kill for channel: ${channel} (Query: '${processQuery}')`);

        try {
            const results = await findProcess("name", processQuery, false);
            logKill(dependencies, `  -> Found ${results.length} processes matching query.`);
            const coreName = platformName.replace(' ', '').toLowerCase();
            const relevantProcesses = results.filter(p => p.name && p.name.toLowerCase().includes(coreName));
            logKill(dependencies, `  -> Filtered to ${relevantProcesses.length} relevant processes.`);

            if (relevantProcesses.length === 0) { logKill(dependencies, `✅ ${platformName} not running.`); dependencies.ipc.updateProgress(startProgress + progressPerChannel * (index + 1)); continue; }

            const pids = relevantProcesses.map(p => p.pid); const ppids = relevantProcesses.map(p => p.ppid);
            let processToKill = relevantProcesses.find(p => ppids.includes(p.pid)) || relevantProcesses[0]; // Find parent or take first
            if (!processToKill) { logKillError(dependencies, `Could not identify process to kill for ${platformName}. Skipping.`); dependencies.ipc.updateProgress(startProgress + progressPerChannel * (index + 1)); continue; }
            logKill(dependencies, `  -> Targeting PID ${processToKill.pid} (Binary: ${processToKill.bin || 'N/A'}).`);

            const binPath = processToKill.bin;
            logKill(dependencies, `  -> Attempting treeKill on PID: ${processToKill.pid}`);
            await kill(processToKill.pid);
            logKill(dependencies, `✅ Successfully killed ${platformName} (PID: ${processToKill.pid}).`);

            // Restart Logic
            if (shouldRestart) {
                logKill(dependencies, `  -> Restart requested.`);
                if (!binPath) { logKillError(dependencies, `Cannot restart ${platformName}: Binary path unknown.`); }
                 else {
                    let restartPath = binPath;
                     // *** Log the path BEFORE adjustments ***
                    logKill(dependencies, `  -> Initial Binary Path for Restart: ${restartPath}`);
                    if (process.platform === "darwin") { /* ... macOS .app logic ... */
                        const appBundlePath = binPath.split(".app/")[0] + ".app";
                         try { dependencies.modules.fsSync.statSync(appBundlePath); restartPath = appBundlePath; logKill(dependencies, `  -> Adjusted restart path for macOS: ${restartPath}`); }
                         catch { logKillError(dependencies, `Could not find/stat .app bundle at ${appBundlePath}`); restartPath = null; }
                    } else if (process.platform === 'win32' && !restartPath.toLowerCase().endsWith('.exe')) {
                        logKillError(dependencies, `Binary path ${restartPath} doesn't end with .exe on Windows. Cannot restart.`); restartPath = null;
                    } // Linux path usually okay

                    if (restartPath) {
                        logKill(dependencies, `  -> Attempting shell.openPath on FINAL Restart Path: ${restartPath}`);
                        const openSuccess = await shell.openPath(restartPath); // Returns boolean
                        if (openSuccess) {
                            logKill(dependencies, `  -> ✅ shell.openPath command issued successfully.`);
                        } else {
                            // This indicates Electron couldn't even *try* to open it (e.g., path doesn't exist, permissions)
                            logKillError(dependencies, `shell.openPath command FAILED for ${restartPath}. Check path existence and permissions.`);
                            // This might warrant showing the restart notice
                            if (!overallError) overallError = new Error(`shell.openPath failed for ${channel}`);
                        }
                        // Add short delay AFTER attempting openPath, might help OS process it
                        await new Promise(resolve => setTimeout(resolve, 500));
                    } else { logKillError(dependencies, `Could not determine a valid path to restart ${platformName}.`); }
                }
            } // End shouldRestart

            dependencies.ipc.updateProgress(startProgress + progressPerChannel * (index + 1));

        } catch (err) {
            const symbol = shouldRestart ? "⚠️" : "❌";
            logKillError(dependencies, `${symbol} Could not kill/restart ${platformName}`, err);
            if (!overallError) overallError = err;
            dependencies.ipc.updateProgress(startProgress + progressPerChannel * (index + 1));
        }
    } // End channel loop

    logKill(dependencies, `killProcesses finished. First error: ${overallError ? overallError.message : 'None'}`);
    return overallError;
};
// --- END OF FILE logic/utils/kill.js ---