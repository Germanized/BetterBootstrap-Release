// --- START OF FILE logic/paths.js ---
// Refactored based on original, using dependencies

// Note: Original used 'remote', which is deprecated. Using 'app' directly.
// Also using injected fsSync and path.

const platforms = {stable: "Discord", ptb: "Discord PTB", canary: "Discord Canary"};

// Helper function from original
const safeIsDir = (fsSync, fullpath) => {
    try {
        return fsSync.lstatSync(fullpath).isDirectory();
    } catch {
        return false;
    }
};

// Refactored getDiscordPath from original
const getDiscordPath = function(releaseChannel, dependencies) {
    const fsSync = dependencies.modules.fsSync;
    const path = dependencies.modules.path;
    const app = dependencies.electron.app; // Get app from electron dependencies
    const os = dependencies.modules.os; // Get os module

    console.log(`[Paths] Finding path for: ${releaseChannel} on platform ${process.platform}`);

    try {
        let desktopCorePath = "";
        const channelId = releaseChannel.replace(/ /g, ""); // Discord, DiscordPTB, DiscordCanary

        if (process.platform === "win32") {
            const localAppData = process.env.LOCALAPPDATA;
            const programData = process.env.PROGRAMDATA;
            const userName = process.env.USERNAME;

            if (!localAppData) {
                 console.error("[Paths] LOCALAPPDATA environment variable not found.");
                 return "";
            }

            let basedir = path.join(localAppData, channelId); // Normal path
            console.log(`[Paths] Checking primary Windows path: ${basedir}`);
            if (!fsSync.existsSync(basedir)) {
                 console.log(`[Paths] Primary path not found.`);
                 // Atypical location check from original (ProgramData\%username%)
                 if (programData && userName) {
                     const atypicalPath = path.join(programData, userName, channelId);
                     console.log(`[Paths] Checking atypical Windows path: ${atypicalPath}`);
                     if (fsSync.existsSync(atypicalPath)) {
                          basedir = atypicalPath;
                     } else {
                          console.log(`[Paths] Atypical path not found.`);
                          return ""; // Not found in known locations
                     }
                 } else {
                      console.warn("[Paths] Cannot check atypical path: PROGRAMDATA or USERNAME missing.");
                      return "";
                 }
            }
            console.log(`[Paths] Using base directory: ${basedir}`);

            // Find latest app-* directory (original logic)
            const appDirs = fsSync.readdirSync(basedir)
                                  .filter(f => f.startsWith('app-') && safeIsDir(fsSync, path.join(basedir, f)))
                                  .sort() // Simple sort might be okay for app- versions
                                  .reverse();
            if (appDirs.length === 0) {
                 console.error(`[Paths] No 'app-*' directories found in ${basedir}.`);
                 return "";
            }
            const latestAppVersion = appDirs[0];
            const versionPath = path.join(basedir, latestAppVersion);
            console.log(`[Paths] Latest version directory: ${versionPath}`);

            // Find discord_desktop_core module directory (original logic)
            const modulePath = path.join(versionPath, "modules");
            if (!fsSync.existsSync(modulePath)) {
                 console.error(`[Paths] 'modules' directory not found in ${versionPath}.`);
                 return "";
            }

            const coreWrapDirs = fsSync.readdirSync(modulePath)
                                       .filter(e => e.startsWith("discord_desktop_core-") && safeIsDir(fsSync, path.join(modulePath, e)))
                                       .sort()
                                       .reverse(); // Find the highest numbered discord_desktop_core-X

             if (coreWrapDirs.length === 0) {
                 console.error(`[Paths] No 'discord_desktop_core-*' directories found in ${modulePath}.`);
                 return "";
             }
             const latestCoreWrap = coreWrapDirs[0];
             desktopCorePath = path.join(modulePath, latestCoreWrap, "discord_desktop_core");
             console.log(`[Paths] Found core module path: ${desktopCorePath}`);

        } else if (process.platform === 'darwin') { // macOS
             // Original logic used userData which seems less standard for finding the *install*
             // Let's try Application Support path first
             const appSupportPath = app.getPath("appSupport");
             let basedir = path.join(appSupportPath, channelId); // e.g., /Users/User/Library/Application Support/DiscordCanary
             console.log(`[Paths] Checking macOS Application Support path: ${basedir}`);

             if (!fsSync.existsSync(basedir)) {
                  console.log(`[Paths] macOS Application Support path not found.`);
                  // Fallback to original logic's userData parent concept (might be needed on some setups)
                  const userDataPath = app.getPath("userData"); // e.g., /Users/User/Library/Application Support/discord/
                  // Go up one level from userData? Original logic was path.join(..., "..", channelId.toLowerCase())
                   basedir = path.join(userDataPath, "..", channelId.toLowerCase());
                   console.log(`[Paths] Checking macOS alternative path: ${basedir}`);
                    if (!fsSync.existsSync(basedir)) {
                         console.log(`[Paths] macOS alternative path not found.`);
                         return "";
                    }
             }
              console.log(`[Paths] Using base directory: ${basedir}`);

             // Find latest version dir (e.g., 0.0.270) - original logic
              const versionDirs = fsSync.readdirSync(basedir)
                                        .filter(f => /^\d+\.\d+\.\d+$/.test(f) && safeIsDir(fsSync, path.join(basedir, f)))
                                        .sort() // Simple string sort works for versions
                                        .reverse();
             if (versionDirs.length === 0) {
                  console.error(`[Paths] No version directories (e.g., 0.0.xxx) found in ${basedir}.`);
                  return "";
             }
             const latestVersion = versionDirs[0];
             desktopCorePath = path.join(basedir, latestVersion, "modules", "discord_desktop_core");
             console.log(`[Paths] Found core module path: ${desktopCorePath}`);

        } else { // Linux (Assume non-snap/flatpak for default logic)
             // Original logic used userData parent, let's try ~/.config first as it's common
             const configPath = path.join(os.homedir(), ".config");
             let basedir = path.join(configPath, channelId.toLowerCase()); // e.g., /home/user/.config/discordcanary
             console.log(`[Paths] Checking Linux config path: ${basedir}`);

             if (!fsSync.existsSync(basedir)) {
                  console.log(`[Paths] Linux config path not found.`);
                  // Fallback to original logic's userData parent concept
                   const userDataPath = app.getPath("userData");
                   basedir = path.join(userDataPath, "..", channelId.toLowerCase());
                   console.log(`[Paths] Checking Linux alternative path: ${basedir}`);
                    if (!fsSync.existsSync(basedir)) {
                         console.log(`[Paths] Linux alternative path not found.`);
                         return "";
                    }
             }
             console.log(`[Paths] Using base directory: ${basedir}`);

             // Find latest version dir (e.g., 0.0.19) - original logic
             const versionDirs = fsSync.readdirSync(basedir)
                                        .filter(f => /^\d+\.\d+\.\d+$/.test(f) && safeIsDir(fsSync, path.join(basedir, f)))
                                        .sort()
                                        .reverse();
             if (versionDirs.length === 0) {
                  console.error(`[Paths] No version directories (e.g., 0.0.xx) found in ${basedir}.`);
                  return "";
             }
             const latestVersion = versionDirs[0];
             desktopCorePath = path.join(basedir, latestVersion, "modules", "discord_desktop_core");
             console.log(`[Paths] Found core module path: ${desktopCorePath}`);
        }

        // Final check from original logic
        if (fsSync.existsSync(desktopCorePath)) {
             console.log(`[Paths] Verified path exists: ${desktopCorePath}`);
            return desktopCorePath;
        } else {
             console.error(`[Paths] Final path check failed for ${desktopCorePath}`);
             return "";
        }
    } catch (err) {
        console.error(`[Paths] Error during getDiscordPath for ${releaseChannel}:`, err);
        return "";
    }
};

// Function to get all locations - Export this
const getLocations = function(dependencies) {
    const locations = {stable: "", ptb: "", canary: ""};
    console.log("[Paths] Getting locations for all channels...");
    for (const channel in platforms) {
        locations[channel] = getDiscordPath(platforms[channel], dependencies);
    }
    console.log("[Paths] Finished getting locations:", locations);
    return locations;
};


// Refactored getBrowsePath from original
const getBrowsePath = function(channel, dependencies) {
    const path = dependencies.modules.path;
    const app = dependencies.electron.app;
    const os = dependencies.modules.os;

    try {
        if (process.platform === "win32") {
            // Original logic pointed inside the channel dir, let's point to parent (LocalAppData)
            return process.env.LOCALAPPDATA || os.homedir(); // Fallback to home if no LocalAppData
        } else if (process.platform === "darwin") {
            // Original logic pointed inside channel dir in userData parent, let's point to App Support
            return app.getPath("appSupport") || os.homedir(); // Fallback to home
        } else { // Linux
            // Original logic pointed inside channel dir in userData parent, let's point to ~/.config
            return path.join(os.homedir(), ".config") || os.homedir(); // Fallback to home
        }
    } catch (err) {
         console.error("[Paths] Error in getBrowsePath:", err);
         return os.homedir(); // Safest fallback
    }
};

// --- Validation Logic (Refactored from Original) ---

const validateWindows = function(channel, proposedPath, dependencies) {
    const fsSync = dependencies.modules.fsSync;
    const path = dependencies.modules.path;
    const channelName = platforms[channel].replace(" ", "");
    console.log(`[Paths ValidateWin] Validating '${proposedPath}' for channel '${channel}' (${channelName})`);

    try {
        // Check if user selected parent dir (e.g., LocalAppData) containing channel dir
        let checkPath = proposedPath;
        const possibleChannelPath = path.join(proposedPath, channelName);
        if (fsSync.existsSync(possibleChannelPath) && safeIsDir(fsSync, possibleChannelPath)) {
            console.log(`[Paths ValidateWin] Detected parent selection, checking inside: ${possibleChannelPath}`);
            checkPath = possibleChannelPath;
        }

        // Now checkPath should be the potential base dir (e.g., .../Discord)
        if (path.basename(checkPath) === channelName) {
            console.log(`[Paths ValidateWin] Path is base channel directory.`);
             const appDirs = fsSync.readdirSync(checkPath).filter(f => f.startsWith('app-') && safeIsDir(fsSync, path.join(checkPath, f))).sort().reverse();
             if (appDirs.length === 0) { console.log(`[Paths ValidateWin] No app-* dirs found.`); return ""; }
             const versionPath = path.join(checkPath, appDirs[0]);
             const modulePath = path.join(versionPath, "modules");
             if (!fsSync.existsSync(modulePath)) { console.log(`[Paths ValidateWin] No modules dir in ${versionPath}.`); return ""; }
             const coreWrapDirs = fsSync.readdirSync(modulePath).filter(e => e.startsWith("discord_desktop_core-") && safeIsDir(fsSync, path.join(modulePath, e))).sort().reverse();
             if (coreWrapDirs.length === 0) { console.log(`[Paths ValidateWin] No discord_desktop_core-* dirs in ${modulePath}.`); return ""; }
             const corePath = path.join(modulePath, coreWrapDirs[0], "discord_desktop_core");
             if (fsSync.existsSync(path.join(corePath, "core.asar"))) { console.log(`[Paths ValidateWin] Found valid core via base dir: ${corePath}`); return corePath; }
        }

        // Check if user selected an app-X.Y.Z directory (original logic adjusted path)
        if (path.basename(checkPath).startsWith('app-')) { // Check original proposedPath here? Original logic was confusing. Let's check proposedPath directly.
            console.log(`[Paths ValidateWin] Path appears to be an app-* directory.`);
             const modulePath = path.join(proposedPath, "modules"); // Use proposedPath directly
             if (!fsSync.existsSync(modulePath)) { console.log(`[Paths ValidateWin] No modules dir in app-* path.`); return ""; }
             const coreWrapDirs = fsSync.readdirSync(modulePath).filter(e => e.startsWith("discord_desktop_core-") && safeIsDir(fsSync, path.join(modulePath, e))).sort().reverse();
             if (coreWrapDirs.length === 0) { console.log(`[Paths ValidateWin] No discord_desktop_core-* dirs in app-* modules path.`); return ""; }
             const corePath = path.join(modulePath, coreWrapDirs[0], "discord_desktop_core");
              if (fsSync.existsSync(path.join(corePath, "core.asar"))) { console.log(`[Paths ValidateWin] Found valid core via app-* dir: ${corePath}`); return corePath; }
        }

        // Check if user selected discord_desktop_core-XYZ directory (unlikely selection)
         if (path.basename(proposedPath).startsWith('discord_desktop_core-')) {
             console.log(`[Paths ValidateWin] Path appears to be discord_desktop_core-* directory.`);
             const corePath = path.join(proposedPath, "discord_desktop_core");
              if (fsSync.existsSync(path.join(corePath, "core.asar"))) { console.log(`[Paths ValidateWin] Found valid core via discord_desktop_core-* dir: ${corePath}`); return corePath; }
         }


        // Check if user selected the final discord_desktop_core directory itself
        if (path.basename(proposedPath) === "discord_desktop_core") {
            console.log(`[Paths ValidateWin] Path appears to be discord_desktop_core directory.`);
            if (fsSync.existsSync(path.join(proposedPath, "core.asar"))) { console.log(`[Paths ValidateWin] Found valid core via direct selection: ${proposedPath}`); return proposedPath; }
        }

        console.log(`[Paths ValidateWin] No valid structure found starting from ${proposedPath}`);
        return ""; // No valid structure found
     } catch (err) {
         console.error(`[Paths ValidateWin] Error validating path ${proposedPath}:`, err);
         return "";
     }
};

const validateLinuxMac = function(channel, proposedPath, dependencies) {
    const fsSync = dependencies.modules.fsSync;
    const path = dependencies.modules.path;
    const dialog = dependencies.electron.dialog; // For Snap notice
    const channelName = platforms[channel].toLowerCase().replace(" ", ""); // discord, discordptb, discordcanary
    console.log(`[Paths ValidateLinMac] Validating '${proposedPath}' for channel '${channel}' (${channelName})`);

    // Snap check from original
    if (proposedPath.includes("/snap/")) {
        console.warn("[Paths ValidateLinMac] Snap install detected, showing incompatibility dialog.");
        dialog.showErrorBox("BetterDiscord Incompatible", "BetterDiscord is currently incompatible with Snap installs of Discord. Please use a different installation method (e.g., .deb, .tar.gz, Flatpak).");
        return "";
    }

    try {
        // Check if user selected channel base dir (e.g., ~/.config/discordptb) - original logic
        if (path.basename(proposedPath) === channelName) {
            console.log(`[Paths ValidateLinMac] Path is base channel directory.`);
             const versionDirs = fsSync.readdirSync(proposedPath).filter(f => /^\d+\.\d+\.\d+$/.test(f) && safeIsDir(fsSync, path.join(proposedPath, f))).sort().reverse();
             if (versionDirs.length === 0) { console.log(`[Paths ValidateLinMac] No version dirs found.`); return ""; }
             const resourcePath = path.join(proposedPath, versionDirs[0], "modules", "discord_desktop_core");
             if (fsSync.existsSync(path.join(resourcePath, "core.asar"))) { console.log(`[Paths ValidateLinMac] Found valid core via base dir: ${resourcePath}`); return resourcePath; }
        }

        // Check if user selected a version dir (e.g., 0.0.19) - original logic
        if (/^\d+\.\d+\.\d+$/.test(path.basename(proposedPath))) {
            console.log(`[Paths ValidateLinMac] Path appears to be a version directory.`);
             const resourcePath = path.join(proposedPath, "modules", "discord_desktop_core");
             if (fsSync.existsSync(path.join(resourcePath, "core.asar"))) { console.log(`[Paths ValidateLinMac] Found valid core via version dir: ${resourcePath}`); return resourcePath; }
        }

        // Check if user selected 'modules' directory - original logic
        if (path.basename(proposedPath) === "modules") {
            console.log(`[Paths ValidateLinMac] Path appears to be modules directory.`);
             const resourcePath = path.join(proposedPath, "discord_desktop_core");
             if (fsSync.existsSync(path.join(resourcePath, "core.asar"))) { console.log(`[Paths ValidateLinMac] Found valid core via modules dir: ${resourcePath}`); return resourcePath; }
        }

        // Check if user selected 'discord_desktop_core' directory - original logic
        if (path.basename(proposedPath) === "discord_desktop_core") {
             console.log(`[Paths ValidateLinMac] Path appears to be discord_desktop_core directory.`);
             if (fsSync.existsSync(path.join(proposedPath, "core.asar"))) { console.log(`[Paths ValidateLinMac] Found valid core via direct selection: ${proposedPath}`); return proposedPath; }
        }

        // macOS Specific: Check if user selected the .app bundle (from previous refactor attempt, useful)
        if (process.platform === 'darwin' && proposedPath.endsWith('.app')) {
            console.log(`[Paths ValidateLinMac] Path appears to be macOS .app bundle.`);
             const potentialCorePath = path.join(proposedPath, 'Contents', 'Resources', 'app', 'modules', 'discord_desktop_core');
             console.log(`[Paths ValidateLinMac] Checking standard internal .app path: ${potentialCorePath}`);
              if (fsSync.existsSync(path.join(potentialCorePath, "core.asar"))) {
                   console.log(`[Paths ValidateLinMac] Found valid core inside .app bundle: ${potentialCorePath}`);
                   return potentialCorePath;
              }
              // Add checks for other potential internal .app structures if needed
        }

        console.log(`[Paths ValidateLinMac] No valid structure found starting from ${proposedPath}`);
        return ""; // No valid structure found
    } catch (err) {
        console.error(`[Paths ValidateLinMac] Error validating path ${proposedPath}:`, err);
        return "";
    }
};

// Refactored validatePath from original - Export this
const validatePath = function(channel, proposedPath, dependencies) {
    if (!proposedPath || typeof proposedPath !== 'string') {
         console.warn("[Paths Validate] Invalid proposedPath provided.");
         return "";
    }
    console.log(`[Paths Validate] Validating proposed path: ${proposedPath} for channel ${channel}`);
    try {
        if (process.platform === "win32") {
            return validateWindows(channel, proposedPath, dependencies);
        } else {
            return validateLinuxMac(channel, proposedPath, dependencies);
        }
    } catch (error) {
         // Catch errors from validateWindows/validateLinuxMac if they don't handle them internally
         console.error(`[Paths Validate] Unexpected error during validation for ${proposedPath}:`, error);
         return "";
    }
};

// --- Exports ---
exports.platforms = platforms;
exports.getLocations = getLocations; // Export the function that calculates locations
exports.getBrowsePath = getBrowsePath;
exports.validatePath = validatePath;

console.log("[Paths] Paths module loaded and exports configured.");
// --- END OF FILE logic/paths.js ---