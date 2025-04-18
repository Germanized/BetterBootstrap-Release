// G:\Downloads\betterbootstrap-app\main.js - FINAL V3.7 (Auto-Install & Fixed not Compiling)

const { app, BrowserWindow, ipcMain, Tray, Menu, shell, net, dialog, nativeTheme } = require('electron');
const path = require('path');
const fsPromises = require('fs').promises;
const fsSync = require('fs');
const os = require('os');
const originalFsPromises = require('original-fs').promises;
const originalFsSync = require('original-fs');
const Store = require('electron-store').default;
const util = require('util');

// External Dependencies
const findProcess = require('find-process');
const treeKillCallback = require('tree-kill');
const phin = require('phin');

const treeKill = util.promisify(treeKillCallback);

let store;
try { store = new Store(); console.log("Electron-store initialized."); }
catch (e) { console.error("FATAL: Failed to initialize electron-store:", e); store = { get: (key, def) => def, set: () => {}, store: {}, clear: () => {}, onDidChange: () => {} }; }

// App Constants & Global State
const TRAY_ICON_FILENAME = process.platform === 'win32' ? 'icon.ico' : 'icon.png';
const TRAY_ICON_PATH = path.join(__dirname, 'assets', 'images', TRAY_ICON_FILENAME);
const PRELOAD_SCRIPT_PATH = path.join(__dirname, 'preload.js');
const RENDERER_HTML_PATH = path.join(__dirname, 'index.html');
const LOGIC_PATH = path.join(__dirname, 'logic');
let mainWindow = null; let appTray = null; let isQuitting = false;
let isAutoInstalling = false; // Flag to prevent multiple auto-installs

// Single Instance Lock
if (!app.requestSingleInstanceLock()) { app.quit(); } else { app.on('second-instance', () => { if (mainWindow) { if (mainWindow.isMinimized()) mainWindow.restore(); if (!mainWindow.isVisible()) mainWindow.show(); mainWindow.focus(); } }); }

// App Configuration
function getSetting(key, defaultValue = null) { try { const d = { startOnLogin: false, runInSystemTray: true, autoCheckUpdates: false, enableNotifications: true, autoInstallOnLaunch: true }; return store.get(key, defaultValue ?? d[key]); } catch (e) { console.error(`Get Setting Err "${key}":`, e); return defaultValue; } }
function setSetting(key, value) { try { store.set(key, value); mainWindow?.webContents.send('setting-changed', { key, value }); } catch (e) { console.error(`Set Setting Err "${key}":`, e); } }

// Helper Functions
const getAppDataPath = () => app.getPath('appData');
const getBdPath = () => path.join(getAppDataPath(), 'BetterDiscord');
const checkBdBasicInstall = async () => { /* ... hyper-verbose check from V3.5 ... */ const bdPath = getBdPath(); const asarPath = path.join(bdPath, 'data', 'betterdiscord.asar'); console.log(`\n[Check BD Status] Starting check for ASAR at: ${asarPath}`); let fileExists = false; let stats = null; try { console.log(`[Check BD Status] Attempting originalFsPromises.access...`); await originalFsPromises.access(asarPath, fsSync.constants.F_OK); fileExists = true; console.log(`[Check BD Status] originalFsPromises.access SUCCEEDED.`); } catch (accessError) { if (accessError.code !== 'ENOENT') { console.error(`[Check BD Status] !! ERROR during originalFsPromises.access !!`, accessError); } else { console.log(`[Check BD Status] originalFsPromises.access failed with ENOENT.`); } fileExists = false; console.log(`[Check BD Status] Final Result: false (access failed)`); return false; } if (fileExists) { try { console.log(`[Check BD Status] Attempting originalFsPromises.stat...`); stats = await originalFsPromises.stat(asarPath); console.log(`[Check BD Status] originalFsPromises.stat SUCCEEDED. Size: ${stats.size} bytes.`); if (stats.size > 100000) { console.log(`[Check BD Status] Final Result: true (exists and size > 100KB)`); return true; } else { console.warn(`[Check BD Status] !! ASAR exists but size (${stats.size}) is suspiciously small (< 100KB).`); console.log(`[Check BD Status] Final Result: false (size too small)`); return false; } } catch (statError) { console.error(`[Check BD Status] !! ERROR during originalFsPromises.stat !!`, statError); console.log(`[Check BD Status] Final Result: false (stat failed)`); return false; } } console.log(`[Check BD Status] Reached end unexpectedly. Final Result: false`); return false; };

// Dependency Object
const mainProcessDependencies = { /* ... same as V3.5 ... */ electron: { app, shell, dialog }, modules: { fs: fsPromises, fsSync: fsSync, originalFs: originalFsPromises, originalFsSync: originalFsSync, path: path, phin: phin, findProcess: findProcess, treeKill: treeKill, os: os }, ipc: { updateProgress: (v) => mainWindow?.webContents.send('update-progress', Math.min(100, Math.max(0, Math.round(v)))), updateStatus: (type) => mainWindow?.webContents.send('update-status', type), addLog: (entry) => mainWindow?.webContents.send('add-log', String(entry)) }, logConsole: console.log, logConsoleError: console.error, window: mainWindow };

// Load Logic Scripts
let adaptedLogic = {}; let logicLoaded = false; try { /* ... same loading logic ... */ const installFunc = require(path.join(LOGIC_PATH, 'install.js')); const uninstallFunc = require(path.join(LOGIC_PATH, 'uninstall.js')); const repairFunc = require(path.join(LOGIC_PATH, 'repair.js')); const pathLogic = require(path.join(LOGIC_PATH, 'paths.js')); const quitLogic = require(path.join(LOGIC_PATH, 'quit.js')); adaptedLogic = { install: (config) => installFunc(config, mainProcessDependencies, 'install'), uninstall: (config) => uninstallFunc(config, mainProcessDependencies, 'uninstall'), repair: (config) => repairFunc(config, mainProcessDependencies, 'repair'), pathLogic: pathLogic, quit: () => quitLogic(mainProcessDependencies) }; console.log("Adapted installer logic loaded successfully."); logicLoaded = true; } catch (err) { /* ... error handling ... */ console.error("FATAL ERROR: Could not load adapted installer logic:", err); adaptedLogic = { install: null, uninstall: null, repair: null, pathLogic: null, quit: null }; app.on('ready', () => { dialog.showErrorBox("Core Logic Error", `Failed loading install scripts: ${err.message}\n\nPlease check application integrity and console logs.`); }); }

// Discord Path Discovery
function getInstallerConfig() { /* ... same logic as V3.5 ... */ if (logicLoaded && adaptedLogic.pathLogic && typeof adaptedLogic.pathLogic.getLocations === 'function') { try { const config = adaptedLogic.pathLogic.getLocations(mainProcessDependencies); const filteredConfig = {}; let foundPath = false; for (const channel in config) { if (config[channel] && typeof config[channel] === 'string' && config[channel].length > 0) { if (fsSync.existsSync(config[channel])) { filteredConfig[channel] = config[channel]; foundPath = true; } else { console.warn(`Path logic provided path for ${channel}, but it doesn't exist: ${config[channel]}`); } } } if (foundPath) { console.log("Detected installer config via paths.js:", filteredConfig); return filteredConfig; } else { console.warn("paths.js getLocations ran but returned no valid, existing paths. Falling back..."); } } catch (pathErr) { console.error("Error executing getLocations from paths.js:", pathErr); console.warn("Falling back due to error in paths.js logic."); } } else if (!logicLoaded || !adaptedLogic.pathLogic || typeof adaptedLogic.pathLogic.getLocations !== 'function') { console.warn("Path logic script or getLocations function not available. Using basic fallback."); } console.warn("Using basic path fallback - May not find PTB/Canary or non-standard installs."); const fallbackConfig = {}; if (process.platform === 'win32') { try { const stableBase = path.join(process.env.LOCALAPPDATA, 'Discord'); if (fsSync.existsSync(stableBase)) { const appDirs = fsSync.readdirSync(stableBase, { withFileTypes: true }).filter(d => d.isDirectory() && d.name.startsWith('app-')).map(d => d.name).sort((a, b) => b.localeCompare(a, undefined, { numeric: true, sensitivity: 'base' })); if (appDirs.length > 0) { const latestAppPath = path.join(stableBase, appDirs[0]); const modulesPath = path.join(latestAppPath, 'modules'); if (fsSync.existsSync(modulesPath)) { const coreDirs = fsSync.readdirSync(modulesPath, { withFileTypes: true }).filter(d => d.isDirectory() && d.name.startsWith('discord_desktop_core-')).map(d => d.name).sort().reverse(); if (coreDirs.length > 0) { const corePath = path.join(modulesPath, coreDirs[0], 'discord_desktop_core'); if (fsSync.existsSync(path.join(corePath, 'core.asar'))) { fallbackConfig['stable'] = corePath; console.log("Found Stable Discord via basic fallback:", corePath); } } } } } } catch (fallbackErr) { console.error("Error during basic Windows path fallback:", fallbackErr); } } else { console.warn("Basic fallback currently only implemented for Windows."); } if (Object.keys(fallbackConfig).length === 0) { console.error("Failed to detect any Discord installation paths using both primary logic and fallback."); } return fallbackConfig; }

// Action Executor
async function executeBdAction(actionName, isAuto = false) { // Added isAuto flag
    console.log(`\n>>> Received request to execute action: ${actionName}${isAuto ? ' (Auto)' : ''}`);
    mainProcessDependencies.window = mainWindow; const config = getInstallerConfig();
    if (Object.keys(config).length === 0 && actionName !== 'quit') { const msg = `Cannot perform ${actionName}: No valid Discord paths found.`; console.error(msg); mainProcessDependencies.ipc.addLog(`❌ ${msg}`); if (!isAuto) dialog.showErrorBox("Path Error", msg); mainProcessDependencies.ipc.updateStatus('error'); return; }
    if (!logicLoaded || typeof adaptedLogic[actionName] !== 'function') { const msg = `Logic for action '${actionName}' unavailable.`; console.error(msg); mainProcessDependencies.ipc.addLog(`❌ ${msg}`); if (!isAuto) dialog.showErrorBox("Logic Error", msg); mainProcessDependencies.ipc.updateStatus('error'); return; }

    // Prevent automatic install if manual operation is already running
    if (isAuto && mainProcessDependencies.window?.webContents.executeJavaScript('window.operationInProgress')) {
         console.log("[Auto Install] Manual operation in progress, skipping auto-install.");
         return;
    }

    mainProcessDependencies.ipc.addLog(`--- Starting ${actionName}${isAuto ? ' (Auto)' : ''} ---`); mainProcessDependencies.ipc.updateProgress(0); mainProcessDependencies.ipc.updateStatus('');
    try { console.log(`--- Executing ${actionName} logic function... ---`); await adaptedLogic[actionName](config); console.log(`--- ${actionName} logic function finished. ---`); }
    catch (error) { console.error(`!!! UNHANDLED ERROR during ${actionName}:`, error); mainProcessDependencies.ipc.addLog(`❌ FATAL ERROR during ${actionName}. Check main console.`); mainProcessDependencies.ipc.updateStatus('error'); if (!isAuto) dialog.showErrorBox("Fatal Action Error", `Error during ${actionName}: ${error.message}`); }
    finally { if (actionName !== 'quit') { console.log(`--- Re-checking BD status after ${actionName}... ---`); const installed = await checkBdBasicInstall(); console.log(`--- BD Status Check Result: ${installed} ---`); mainWindow?.webContents.send('bd-status', { installed }); console.log(`<<< Action ${actionName} fully finished. Final BD Status: ${installed} >>>`); } else { console.log(`<<< Action ${actionName} finished. >>>`); } }
}

// --- Window Management ---
function createWindow() {
    const isDarkMode = nativeTheme.shouldUseDarkColors;
    mainWindow = new BrowserWindow({
        width: 850,
        height: 650,
        minWidth: 700,
        minHeight: 550,
        show: false, // Keep show: false initially
        icon: TRAY_ICON_PATH,
        frame: false,
        titleBarStyle: 'hidden',
        backgroundColor: isDarkMode ? '#141416' : '#FFFFFF',
        webPreferences: {
            preload: PRELOAD_SCRIPT_PATH,
            contextIsolation: true,
            nodeIntegration: false,
            sandbox: false,
            // Restore original DevTools setting: enable only when not packaged
            devTools: !app.isPackaged
        },
    });

    mainProcessDependencies.window = mainWindow;

    // Load the HTML file
    mainWindow.loadFile(RENDERER_HTML_PATH)
        .catch(err => {
            // Log errors if the file fails to load
            console.error("[Main Proc] Critical Error: loadFile FAILED:", err);
            dialog.showErrorBox("Load Error", `Failed to load the application interface: ${err.message}`);
            // Consider quitting if the UI can't load
            // app.quit();
        });

    // Show the window gracefully when it's ready
    mainWindow.once('ready-to-show', () => {
        mainWindow.show();
        mainWindow.webContents.send('set-theme', isDarkMode ? 'dark' : 'light');
        mainWindow.webContents.send('settings-loaded', store.store || {}); // Send initial settings

        // Check initial BD status and potentially trigger auto-install
        checkBdBasicInstall().then(inst => {
            mainWindow.webContents.send('bd-status', { installed: inst });
            handleAutoInstall(); // Trigger auto-install check after status known
        }).catch(err => {
            console.error("[Main Proc] Error during initial checkBdBasicInstall in ready-to-show:", err);
            mainWindow.webContents.send('bd-status', { installed: false, error: true }); // Send error status
            handleAutoInstall(); // Still attempt auto-install logic
        });
    });

    // Handle theme updates from the OS
    nativeTheme.on('updated', () => {
        const newIsDarkMode = nativeTheme.shouldUseDarkColors;
        mainWindow?.webContents.send('set-theme', newIsDarkMode ? 'dark' : 'light');
    });

    // Handle window close: hide to tray or quit
    mainWindow.on('close', (event) => {
        if (!isQuitting && getSetting('runInSystemTray', true)) {
            event.preventDefault(); // Prevent the window from actually closing
            mainWindow.hide();
            // Show tray notification if enabled
            if (getSetting('enableNotifications', true) && appTray && !appTray.isDestroyed()) {
                try {
                    appTray.displayBalloon({ title: 'BetterBootstrap', content: 'Minimized to tray.', icon: TRAY_ICON_PATH });
                } catch (e) { console.error("Tray balloon err:", e); }
            }
        } else {
            // Allow the window to close, which will trigger the 'closed' event
            isQuitting = true;
        }
    });

    // Handle when the window is actually closed
    mainWindow.on('closed', () => {
        console.log("[Main Proc] Event: closed"); // Keep logging for clarity
        mainWindow = null; // Dereference the window object
        mainProcessDependencies.window = null;

        // Determine if closing this window should trigger an app quit
        // This happens if the setting "runInSystemTray" is FALSE.
        const shouldQuitOnClose = !getSetting('runInSystemTray', true);

        if (shouldQuitOnClose && !isQuitting) {
            // If we ARE supposed to quit when the window closes (not running in tray),
            // AND the app hasn't already started the quitting process (e.g., via tray menu),
            // THEN we initiate the quit now.
            console.log("[Main Proc] Quitting app because last window closed and not configured to run in tray.");
            app.quit();
        } else if (isQuitting) {
             // If the app is already quitting (e.g., initiated by tray menu or Cmd+Q),
             // the 'closed' event is just part of that process. Don't call app.quit() again.
             console.log("[Main Proc] Window closed during app quit sequence. No additional action needed here.");
        } else {
            // This case means shouldQuitOnClose is false (we ARE configured to run in tray)
            // AND isQuitting is false (user just closed the window, didn't select Quit)
            console.log("[Main Proc] Window closed, but app remains running in tray.");
        }
    });
    // Optional: Handle renderer process crashes
    mainWindow.webContents.on('crashed', (event, killed) => {
        console.error(`[Main Proc] WebContents crashed! Killed: ${killed}`);
        dialog.showErrorBox("Renderer Process Crashed", "The application's display process crashed unexpectedly. Please try restarting the application.");
        // Decide if you want to quit or try reloading/recreating
        // isQuitting = true;
        // app.quit();
    });

     // Optional: Handle load failures more explicitly if needed
     mainWindow.webContents.on('did-fail-load', (event, errorCode, errorDescription, validatedURL) => {
        console.error(`[Main Proc] WebContents Event: did-fail-load - Code: ${errorCode}, Desc: ${errorDescription}, URL: ${validatedURL}`);
        // Can show an error specific to loading failure if loadFile's catch isn't sufficient
    });

} // End of createWindow function

// --- System Tray ---
function createTray() { /* ... same as V3.5 ... */ if (!fsSync.existsSync(TRAY_ICON_PATH)) { console.error("Tray icon missing:", TRAY_ICON_PATH); return; } try { appTray = new Tray(TRAY_ICON_PATH); const contextMenu = Menu.buildFromTemplate([ { label: 'Open BetterBootstrap', click: () => { if (!mainWindow) createWindow(); else { mainWindow.show(); mainWindow.focus(); } } }, { type: 'separator' }, { label: 'Install / Update BD', click: () => { mainWindow?.show(); executeBdAction('install'); } }, { label: 'Repair BD', click: () => { mainWindow?.show(); executeBdAction('repair'); } }, { label: 'Uninstall BD', click: () => { mainWindow?.show(); executeBdAction('uninstall'); } }, { type: 'separator' }, { label: 'Quit BetterBootstrap', click: () => { isQuitting = true; app.quit(); } } ]); appTray.setToolTip('BetterBootstrap'); appTray.setContextMenu(contextMenu); appTray.on('click', () => { if (!mainWindow) { createWindow(); } else { if (mainWindow.isVisible() && mainWindow.isFocused()) mainWindow.hide(); else { mainWindow.show(); mainWindow.focus(); } } }); } catch (trayError) { console.error("Failed tray create:", trayError); appTray = null; } }

// --- Auto Install Logic ---
async function handleAutoInstall() {
    if (isAutoInstalling) return; // Prevent race condition if called multiple times

    const shouldAutoInstall = getSetting('autoInstallOnLaunch', true); // Use setting
    if (!shouldAutoInstall) {
        console.log("[Auto Install] Disabled via settings.");
        return;
    }

    console.log("[Auto Install] Checking BD status for auto-install...");
    isAutoInstalling = true; // Set flag
    try {
        const installed = await checkBdBasicInstall();
        if (!installed) {
            console.log("[Auto Install] BD not detected. Triggering automatic installation...");
            // Ensure window is visible before starting auto-install? Optional.
            // mainWindow?.show();
            await executeBdAction('install', true); // Pass true for isAuto flag
            console.log("[Auto Install] Automatic installation process finished.");
        } else {
            console.log("[Auto Install] BD already installed. No action needed.");
        }
    } catch (error) {
        console.error("[Auto Install] Error during auto-install check:", error);
    } finally {
        isAutoInstalling = false; // Reset flag
    }
}


// --- App Lifecycle ---
app.whenReady().then(() => {
    const startOnLogin = getSetting('startOnLogin', false); try { if (app.isPackaged || process.env.NODE_ENV === 'development') app.setLoginItemSettings({ openAtLogin: startOnLogin, path: app.getPath('exe') }); } catch (e) { console.error("Set login fail:", e); }
    createWindow(); // Window created here
    // Auto-install check is now triggered in window's 'ready-to-show' event
    if (getSetting('runInSystemTray', true)) createTray();
    app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); else mainWindow?.show(); });
});
app.on('window-all-closed', () => { if (process.platform !== 'darwin' || isQuitting || !getSetting('runInSystemTray', true)) app.quit(); else console.log("App remains running in tray."); });
app.on('before-quit', () => { isQuitting = true; console.log("Cleanup before quit..."); if (appTray && !appTray.isDestroyed()) appTray.destroy(); });

// --- IPC Handlers --- (Keep as is from V3.5)
ipcMain.handle('get-setting', (event, key) => getSetting(key)); ipcMain.on('save-setting', (event, { key, value }) => { setSetting(key, value); console.log(`Setting saved IPC: ${key}=${value}`); if (key === 'startOnLogin') { try { if (app.isPackaged || process.env.NODE_ENV === 'development') app.setLoginItemSettings({ openAtLogin: value, path: app.getPath('exe') }); } catch (e) { console.error("Update login IPC fail:", e); } } else if (key === 'runInSystemTray') { if (!value && appTray && !appTray.isDestroyed()) { appTray.destroy(); appTray = null; } else if (value && !appTray) { createTray(); } } }); ipcMain.handle('check-bd-install', () => checkBdBasicInstall()); ipcMain.on('trigger-bd-install', () => executeBdAction('install')); ipcMain.on('trigger-bd-uninstall', () => executeBdAction('uninstall')); ipcMain.on('trigger-bd-repair', () => executeBdAction('repair')); async function isDiscordRunning() { try { const p = ['Discord', 'DiscordCanary', 'DiscordPTB', 'Discord.exe', 'DiscordCanary.exe', 'DiscordPTB.exe']; for (const n of p) { const l = await mainProcessDependencies.modules.findProcess('name', n, false); if (l.length > 0) { console.log(`isDiscordRunning: Found ${n}`); return true; } } console.log(`isDiscordRunning: No matching process.`); return false; } catch (e) { console.error("isDiscordRunning Error:", e); return false; } }
ipcMain.handle('is-discord-running', isDiscordRunning); ipcMain.on('open-link', (event, url) => { if (url?.startsWith('http')) shell.openExternal(url); else console.warn("Blocked non-http URL:", url); }); ipcMain.on('show-notification', (event, { title, body }) => { if(getSetting('enableNotifications', true) && appTray && !appTray.isDestroyed()){ try { appTray.displayBalloon({ title: title || 'BetterBootstrap', content: body, icon: TRAY_ICON_PATH }); } catch(e){console.error("Balloon err:",e);} } mainWindow?.webContents.send('show-app-notification', { title, body }); }); ipcMain.on('window-minimize', () => mainWindow?.minimize()); ipcMain.on('window-maximize', () => { mainWindow?.isMaximized() ? mainWindow.unmaximize() : mainWindow?.maximize(); }); ipcMain.on('window-close-request', () => { mainWindow?.close(); }); ipcMain.handle('get-initial-theme', () => nativeTheme.shouldUseDarkColors ? 'dark' : 'light'); ipcMain.on('app-quit-request', () => { if (adaptedLogic.quit) { adaptedLogic.quit().catch(err => { console.error("Quit confirm err:", err); app.quit(); }); } else { isQuitting = true; app.quit(); } });

console.log("Main process setup complete. Ready.");
