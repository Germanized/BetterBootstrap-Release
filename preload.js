// G:\Downloads\betterbootstrap-app\preload.js - FINAL VERSION V3 (Verify Channels)

const { contextBridge, ipcRenderer } = require('electron');

console.log('[Preload] Script executing...'); // Check if preload runs

// Whitelist of valid IPC channels
// Ensure these match EXACTLY what main.js sends and renderer.js listens for
const validSendChannels = [
    'save-setting', 'trigger-bd-install', 'trigger-bd-uninstall',
    'trigger-bd-repair', 'open-link', 'show-notification',
    'window-minimize', 'window-maximize', 'window-close-request',
    'app-quit-request'
];
const validInvokeChannels = [
    'get-setting', 'check-bd-install', 'is-discord-running', 'get-initial-theme'
];
const validReceiveChannels = [
    'update-progress', // Main -> Renderer
    'update-status',   // Main -> Renderer (Final status)
    'add-log',         // Main -> Renderer (Log entries)
    'setting-changed', // Main -> Renderer
    'bd-status',       // Main -> Renderer
    'show-app-notification', // Main -> Renderer
    'settings-loaded', // Main -> Renderer
    'set-theme'        // Main -> Renderer
];

try {
    contextBridge.exposeInMainWorld('electronAPI', {
        // --- Renderer to Main (Send/Invoke) ---
        getSetting: (key) => ipcRenderer.invoke('get-setting', key),
        saveSetting: (key, value) => ipcRenderer.send('save-setting', { key, value }),
        checkBdInstall: () => ipcRenderer.invoke('check-bd-install'),
        triggerBdInstall: () => ipcRenderer.send('trigger-bd-install'),
        triggerBdUninstall: () => ipcRenderer.send('trigger-bd-uninstall'),
        triggerBdRepair: () => ipcRenderer.send('trigger-bd-repair'),
        isDiscordRunning: () => ipcRenderer.invoke('is-discord-running'),
        openLink: (url) => ipcRenderer.send('open-link', url),
        showNotification: (title, body) => ipcRenderer.send('show-notification', { title, body }),
        minimizeWindow: () => ipcRenderer.send('window-minimize'),
        maximizeWindow: () => ipcRenderer.send('window-maximize'),
        closeWindow: () => ipcRenderer.send('window-close-request'),
        quitApp: () => ipcRenderer.send('app-quit-request'), // Added quit trigger if needed
        getInitialTheme: () => ipcRenderer.invoke('get-initial-theme'),

        // --- Main to Renderer (Listeners) ---
        // Use functions that ADD listeners and return a REMOVER function for cleanup
        onLogEntry: (callback) => {
            const handler = (event, data) => callback(data);
            ipcRenderer.on('add-log', handler); // Channel name MUST match main.js
            console.log('[Preload] Added listener for add-log');
            return () => { ipcRenderer.removeListener('add-log', handler); console.log('[Preload] Removed listener for add-log'); };
        },
        onInstallProgress: (callback) => {
            const handler = (event, data) => callback(data);
            ipcRenderer.on('update-progress', handler); // Channel name MUST match main.js
             console.log('[Preload] Added listener for update-progress');
            return () => { ipcRenderer.removeListener('update-progress', handler); console.log('[Preload] Removed listener for update-progress'); };
        },
        onInstallStatusSimple: (callback) => {
            const handler = (event, data) => callback(data);
            ipcRenderer.on('update-status', handler); // Channel name MUST match main.js
             console.log('[Preload] Added listener for update-status');
            return () => { ipcRenderer.removeListener('update-status', handler); console.log('[Preload] Removed listener for update-status'); };
        },
        onSettingChanged: (callback) => {
            const handler = (event, data) => callback(data);
            ipcRenderer.on('setting-changed', handler);
             console.log('[Preload] Added listener for setting-changed');
            return () => { ipcRenderer.removeListener('setting-changed', handler); console.log('[Preload] Removed listener for setting-changed'); };
        },
        onBdStatus: (callback) => {
            const handler = (event, data) => callback(data);
            ipcRenderer.on('bd-status', handler);
             console.log('[Preload] Added listener for bd-status');
            return () => { ipcRenderer.removeListener('bd-status', handler); console.log('[Preload] Removed listener for bd-status'); };
        },
        onShowAppNotification: (callback) => {
            const handler = (event, data) => callback(data);
            ipcRenderer.on('show-app-notification', handler);
             console.log('[Preload] Added listener for show-app-notification');
            return () => { ipcRenderer.removeListener('show-app-notification', handler); console.log('[Preload] Removed listener for show-app-notification'); };
        },
        onSettingsLoaded: (callback) => {
             // Use once for settings loaded to avoid potential multiple loads? Or manage in renderer.
             const handler = (event, data) => callback(data);
             ipcRenderer.once('settings-loaded', handler); // Use once if it only happens at startup
             console.log('[Preload] Added listener for settings-loaded');
             // Cannot easily return a remover for 'once'
        },
        onThemeSet: (callback) => {
            const handler = (event, theme) => callback(theme);
            ipcRenderer.on('set-theme', handler);
             console.log('[Preload] Added listener for set-theme');
            return () => { ipcRenderer.removeListener('set-theme', handler); console.log('[Preload] Removed listener for set-theme'); };
        },
    });
    console.log('[Preload] contextBridge.exposeInMainWorld executed successfully.');
} catch (error) {
    console.error('[Preload] Error during contextBridge exposure:', error);
}