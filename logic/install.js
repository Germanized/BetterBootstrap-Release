// --- START OF FILE logic/install.js ---
// Refactored based on original logic + Kill First Step

// Utils - Use refactored versions
const { log, lognewline } = require("./utils/log");
const succeed = require("./utils/succeed");
const fail = require("./utils/fail");
const exists = require("./utils/exists");
const reset = require("./utils/reset");
const kill = require("./utils/kill"); // Kill utility
const { showRestartNotice, showKillNotice } = require("./utils/notices"); // Notices utility
const doSanityCheck = require("./utils/sanity");

// Progress Constants - Adjusted slightly to accommodate initial kill step
const KILL_DISCORD_PROGRESS = 15; // New Step 1
const MAKE_DIR_PROGRESS = 30 + KILL_DISCORD_PROGRESS; // Shifted
const DOWNLOAD_PACKAGE_PROGRESS = 60 + KILL_DISCORD_PROGRESS; // Shifted
const INJECT_SHIM_PROGRESS = 90 + KILL_DISCORD_PROGRESS; // Shifted
const FINAL_RESTART_DISCORD_PROGRESS = 100; // Final step always 100

const RELEASE_API = "https://api.github.com/repos/BetterDiscord/BetterDiscord/releases";

// Helper for dual logging
function logBoth(dependencies, message) {
    console.log(message);
    dependencies.ipc.addLog(message);
}
function logErrorBoth(dependencies, message, error = null) {
    console.error(message, error || '');
    dependencies.ipc.addLog(`❌ ${message}${error ? `: ${error.message || error}` : ''}`);
}

// --- Utility Functions (makeDirectories, downloadAsar, installAsar, injectShims - NO CHANGES needed from previous version) ---
// ... (Keep the functions from response #14 here - they include console logging) ...
async function makeDirectories(folders, dependencies, startProgress, targetProgress) {
    const fs = dependencies.modules.fs;
    const path = dependencies.modules.path;
    const exists = async (file) => { try { await fs.stat(file); return true; } catch { return false; } };
    const progressPerLoop = folders.length > 0 ? (targetProgress - startProgress) / folders.length : 0;

    for (const [index, folder] of folders.entries()) {
        logBoth(dependencies, `Checking directory: ${folder}`);
        try {
            if (await exists(folder)) { logBoth(dependencies, `✅ Directory exists: ${folder}`); }
            else { await fs.mkdir(folder, { recursive: true }); logBoth(dependencies, `✅ Directory created: ${folder}`); }
            dependencies.ipc.updateProgress(startProgress + progressPerLoop * (index + 1));
        } catch (err) { logErrorBoth(dependencies, `Failed to create directory: ${folder}`, err); return err; }
    } return null;
}
async function downloadAsar(dependencies) { /* ... Full function from response #14 ... */
    const phin = dependencies.modules.phin;
    const getJSON = phin.defaults({ method: "GET", parse: "json", followRedirects: true, timeout: 15000, headers: { "User-Agent": "BetterDiscord/Installer" } });
    const downloadFile = phin.defaults({ method: "GET", followRedirects: true, timeout: 45000, stream: false, headers: { "User-Agent": "BetterDiscord/Installer", "Accept": "application/octet-stream" } });
    try {
        logBoth(dependencies, "Attempting download from official website (betterdiscord.app)...");
        const response = await downloadFile("https://betterdiscord.app/Download/betterdiscord.asar");
        const bdVersion = response.headers["x-bd-version"] || "Version Header Missing";
        logBoth(dependencies, `  -> Website Status Code: ${response.statusCode}`);
        if (response.statusCode >= 200 && response.statusCode < 300) {
            if (!response.body || response.body.length === 0) { logErrorBoth(dependencies, `Downloaded from website OK but empty body!`); throw new Error("Downloaded empty file from website."); }
            logBoth(dependencies, `✅ Downloaded BetterDiscord version ${bdVersion} from website (Size: ${response.body.length} bytes)`);
            return { body: response.body, version: bdVersion };
        }
        logErrorBoth(dependencies, `Website download failed with status: ${response.statusCode}`);
        throw new Error(`Status code did not indicate success: ${response.statusCode}`);
    } catch (error) { logErrorBoth(dependencies, `Failed during website download attempt`, error); logBoth(dependencies, `Falling back to GitHub...`); }
    let assetUrl; let ghVersion;
    try {
        logBoth(dependencies, `Fetching release list from GitHub API (${RELEASE_API})...`);
        const response = await getJSON(RELEASE_API); logBoth(dependencies, `  -> GitHub API Status Code: ${response.statusCode}`);
        if (!response.body || !Array.isArray(response.body)) { logErrorBoth(dependencies, `Invalid response body from GitHub API.`); throw new Error("Invalid response body from GitHub API."); }
        const releases = response.body; logBoth(dependencies, `  -> Found ${releases.length} releases.`);
        const latestRelease = releases.find(r => !r.prerelease && !r.draft && r.assets.some(a => a.name.toLowerCase() === "betterdiscord.asar"));
        if (!latestRelease) { logErrorBoth(dependencies, `Could not find a suitable release on GitHub.`); throw new Error("Could not find a suitable release on GitHub."); }
        logBoth(dependencies, `  -> Latest suitable release found: ${latestRelease.tag_name}`);
        const asset = latestRelease.assets.find(a => a.name.toLowerCase() === "betterdiscord.asar");
        if (!asset || !asset.browser_download_url) { logErrorBoth(dependencies, `Could not find 'betterdiscord.asar' asset URL in release ${latestRelease.tag_name}.`); throw new Error("Could not find betterdiscord.asar asset URL in the latest release."); }
        assetUrl = asset.browser_download_url; ghVersion = latestRelease.tag_name;
        logBoth(dependencies, `Found asset URL on GitHub: ${assetUrl} (Version: ${ghVersion})`);
    } catch (error) { logErrorBoth(dependencies, `Failed to get asset url from GitHub`, error); throw error; }
    try {
        logBoth(dependencies, `Attempting download from GitHub asset (${assetUrl})...`);
        const response = await downloadFile(assetUrl); logBoth(dependencies, `  -> GitHub Asset Download Status Code: ${response.statusCode}`);
        if (response.statusCode >= 200 && response.statusCode < 300) {
            if (!response.body || response.body.length === 0) { logErrorBoth(dependencies, `Downloaded from GitHub asset OK but empty body!`); throw new Error("Downloaded empty file from GitHub asset."); }
            logBoth(dependencies, `✅ Downloaded BetterDiscord version ${ghVersion} from GitHub (Size: ${response.body.length} bytes)`);
            return { body: response.body, version: ghVersion };
        } logErrorBoth(dependencies, `GitHub asset download failed with status: ${response.statusCode}`); throw new Error(`Status code did not indicate success: ${response.statusCode}`);
    } catch (error) { logErrorBoth(dependencies, `Failed to download package from GitHub asset: ${assetUrl}`, error); throw error; }
}
async function installAsar(fileContent, asarPath, dependencies) { /* ... Full function from response #14 ... */
    const originalFs = dependencies.modules.originalFs; const path = dependencies.modules.path; const fs = dependencies.modules.fs;
    logBoth(dependencies, `Attempting to write ASAR (${fileContent?.length || 0} bytes) using original-fs to: ${asarPath}`);
    if (!fileContent || fileContent.length === 0) { const errMsg = `Cannot write ASAR: file content is empty. Download likely failed.`; logErrorBoth(dependencies, errMsg); throw new Error(errMsg); }
    let writeSuccess = false;
    try {
        const parentDir = path.dirname(asarPath); logBoth(dependencies, `  Ensuring parent directory exists: ${parentDir}`);
        try { await fs.mkdir(parentDir, { recursive: true }); logBoth(dependencies, `  -> Parent directory OK.`); }
        catch (mkdirError) { logErrorBoth(dependencies, `Failed to ensure parent directory exists for ASAR`, mkdirError); throw new Error(`Failed to create parent directory for ASAR: ${mkdirError.message}`); }
        logBoth(dependencies, `  Attempting originalFs.writeFile...`); await originalFs.writeFile(asarPath, fileContent); logBoth(dependencies, `  -> originalFs.writeFile call completed.`); writeSuccess = true;
        logBoth(dependencies, `  Verifying file after write...`);
        try {
            const stats = await originalFs.stat(asarPath); logBoth(dependencies, `  -> Verification: File exists.`);
            if (stats.size === fileContent.length) { logBoth(dependencies, `✅ ASAR written successfully and size verified (${stats.size} bytes).`); }
            else { writeSuccess = false; const sizeErrMsg = `CRITICAL: ASAR write size mismatch! Expected ${fileContent.length}, but file on disk is ${stats.size} bytes.`; logErrorBoth(dependencies, sizeErrMsg); throw new Error(sizeErrMsg); }
        } catch (verifyError) { writeSuccess = false; logErrorBoth(dependencies, `Failed to verify ASAR file after write attempt`, verifyError); throw new Error(`Failed to verify ASAR after write: ${verifyError.message}`); }
    } catch (error) { logErrorBoth(dependencies, `Failed during originalFs ASAR write/verify process for ${asarPath}`, error);
        if (writeSuccess === false) { logBoth(dependencies, `  Attempting to clean up potentially failed/partial ASAR file...`); try { await originalFs.unlink(asarPath); logBoth(dependencies, `  -> Cleanup successful.`); } catch (cleanupError) { logErrorBoth(dependencies, `Cleanup failed`, cleanupError); } }
        throw error;
    }
}
async function downloadAndInstallAsarWrapper(targetAsarPath, dependencies) { /* ... Full function from response #14 ... */
    try {
        logBoth(dependencies, `Starting ASAR download...`); const downloadResult = await downloadAsar(dependencies);
        if (!downloadResult || !downloadResult.body) { throw new Error("Download function did not return valid file content."); }
        logBoth(dependencies, `Download successful (Version: ${downloadResult.version || 'N/A'}, Size: ${downloadResult.body.length} bytes). Proceeding to install ASAR.`);
        await installAsar(downloadResult.body, targetAsarPath, dependencies); logBoth(dependencies, `ASAR installation step completed successfully.`); return null;
    } catch (error) { logErrorBoth(dependencies, `Error occurred during the download & install ASAR process`, error); return error; }
}
async function injectShims(discordResourcePaths, bdAsarStoredPath, dependencies, startProgress, targetProgress) { /* ... Full function from response #14 ... */
    const fs = dependencies.modules.fs; const fsSync = dependencies.modules.fsSync; const path = dependencies.modules.path;
    const progressPerLoop = discordResourcePaths.length > 0 ? (targetProgress - startProgress) / discordResourcePaths.length : 0;
    const requirePath = bdAsarStoredPath.replace(/\\/g, "\\\\").replace(/"/g, "\\\""); const injectionCode = `require("${requirePath}");\nmodule.exports = require("./core.asar");`;
    logBoth(dependencies, `Injection code prepared. Target BD ASAR path for require: ${bdAsarStoredPath}`); logBoth(dependencies, `  -> JS escaped path: ${requirePath}`);
    let overallSuccess = true;
    for (const [index, discordPath] of discordResourcePaths.entries()) {
        logBoth(dependencies, "Injecting into: " + discordPath); const indexFile = path.join(discordPath, "index.js"); const coreAsarFile = path.join(discordPath, "core.asar");
        try {
            if (!fsSync.existsSync(coreAsarFile)) { logErrorBoth(dependencies, `Skipping injection: Discord's core.asar not found at ${coreAsarFile}.`); overallSuccess = false; dependencies.ipc.updateProgress(startProgress + progressPerLoop * (index + 1)); continue; }
            logBoth(dependencies, `  -> Discord's core.asar found.`); logBoth(dependencies, `  -> Writing injection code to ${indexFile}...`); await fs.writeFile(indexFile, injectionCode); logBoth(dependencies, "✅ Injection successful for this path."); dependencies.ipc.updateProgress(startProgress + progressPerLoop * (index + 1));
        } catch (err) { logErrorBoth(dependencies, `Could not inject shims into ${discordPath}`, err); return err; }
    } if (!overallSuccess) { return new Error("One or more injections skipped due to missing core.asar."); } return null;
}


/**
 * Main install function. Refactored to kill Discord first.
 * @param {object} config - Discord path configuration.
 * @param {object} dependencies - Injected dependencies.
 * @param {string} actionName - Action name for logging ('install').
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
    const bdPluginsFolder = path.join(bdFolder, "plugins");
    const bdThemesFolder = path.join(bdFolder, "themes");
    const bdAsarStoragePath = path.join(bdDataFolder, "betterdiscord.asar");

    logBoth(dependencies, `Target Discord channels: ${channels.join(', ') || 'None'}`);
    logBoth(dependencies, `BD Data Folder: ${bdDataFolder}`);
    logBoth(dependencies, `BD ASAR Storage Path: ${bdAsarStoragePath}`);

    // --- Installation Steps ---

    lognewline(dependencies, "--- Step 1: Killing Discord (Pre-modification) ---");
    const killProgressAmount = KILL_DISCORD_PROGRESS - 0; // Progress for this step
    const preKillProgressPerLoop = channels.length > 0 ? killProgressAmount / channels.length : 0;
    const preKillErr = await kill(
        channels, preKillProgressPerLoop, dependencies,
        0, false // Should NOT restart yet
    );
    if (preKillErr) {
        logErrorBoth(dependencies, "Failed to kill Discord before installation.", preKillErr);
        showKillNotice(dependencies); // Show critical kill notice
        return fail(dependencies, actionName, preKillErr); // Abort install if kill fails
    }
    logBoth(dependencies, "✅ Discord processes killed successfully.");
    dependencies.ipc.updateProgress(KILL_DISCORD_PROGRESS); // Update progress after kill
    // Short delay after killing
    await new Promise(r => setTimeout(r, 500));


    lognewline(dependencies, "--- Step 2: Creating Directories ---");
    const dirErr = await makeDirectories(
        [bdFolder, bdDataFolder, bdThemesFolder, bdPluginsFolder],
        dependencies, KILL_DISCORD_PROGRESS, MAKE_DIR_PROGRESS // Start after kill progress
    );
    if (dirErr) { logErrorBoth(dependencies,"Directory creation failed."); return fail(dependencies, actionName, dirErr); }
    logBoth(dependencies, "✅ Directories created/verified.");
    // Progress updated inside makeDirectories


    lognewline(dependencies, "--- Step 3: Downloading ASAR ---");
    const downloadErr = await downloadAndInstallAsarWrapper(bdAsarStoragePath, dependencies);
    if (downloadErr) { logErrorBoth(dependencies,"ASAR Download/Install failed."); return fail(dependencies, actionName, downloadErr); }
    logBoth(dependencies, "✅ Package downloaded & installed.");
    dependencies.ipc.updateProgress(DOWNLOAD_PACKAGE_PROGRESS);


    lognewline(dependencies, "--- Step 4: Injecting Shims ---");
    const injectErr = await injectShims(
        discordResourcePaths, bdAsarStoragePath, dependencies,
        DOWNLOAD_PACKAGE_PROGRESS, INJECT_SHIM_PROGRESS
    );
    if (injectErr) { logErrorBoth(dependencies,"Shim injection failed."); return fail(dependencies, actionName, injectErr); }
    logBoth(dependencies, "✅ Shims injected.");
    // Progress updated inside injectShims


    lognewline(dependencies, "--- Step 5: Restarting Discord ---");
    const finalRestartProgressAmount = FINAL_RESTART_DISCORD_PROGRESS - INJECT_SHIM_PROGRESS;
    const finalKillProgressPerLoop = channels.length > 0 ? finalRestartProgressAmount / channels.length : 0;
    const finalKillErr = await kill(
        channels, finalKillProgressPerLoop, dependencies,
        INJECT_SHIM_PROGRESS, true // Should restart now
    );
    if (finalKillErr) {
        logErrorBoth(dependencies, "Discord restart after install failed or was problematic.", finalKillErr);
        showRestartNotice(dependencies); // Show non-critical notice
    } else {
        logBoth(dependencies, "✅ Discord restart initiated.");
    }
    dependencies.ipc.updateProgress(FINAL_RESTART_DISCORD_PROGRESS); // Ensure 100%


    logBoth(dependencies, `===== ${actionName} Finished =====`);
    succeed(dependencies, actionName);
};
// --- END OF FILE logic/install.js ---