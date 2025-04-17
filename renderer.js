// G:\Downloads\betterbootstrap-app\renderer.js - FINAL VERSION V8 (Robust Status Handling)

document.addEventListener('DOMContentLoaded', () => {
    console.log('[Renderer] DOMContentLoaded. Script executing.');

    // --- Element References ---
    const sections = document.querySelectorAll('.app-section');
    const navLinks = document.querySelectorAll('.app-nav .nav-link');
    const statusText = document.getElementById('bd-status-text');
    const installButton = document.getElementById('install-bd-button');
    const uninstallButton = document.getElementById('uninstall-bd-button');
    const repairButton = document.getElementById('repair-bd-button');
    const appStatusArea = document.getElementById('app-status-area');
    const appStatusMessage = document.getElementById('app-status-message');
    const progressContainer = document.getElementById('progress-container');
    const progressBar = document.getElementById('progress-bar');
    const settingsCheckboxes = document.querySelectorAll('.settings-form input[type="checkbox"]');
    const externalLinks = document.querySelectorAll('.external-link');
    const minimizeBtn = document.getElementById('minimize-btn');
    const maximizeBtn = document.getElementById('maximize-btn');
    const closeBtn = document.getElementById('close-btn');
    const mainContentArea = document.querySelector('.app-main');
    const logOutputDiv = document.getElementById('log-output');
    const logContainer = document.getElementById('log-output-container');
    const logTitle = logContainer?.querySelector('h3.log-title');
    const bodyElement = document.body;

    // Verify crucial elements exist
    if (!installButton) console.error("[Renderer] Install button not found!");
    if (!uninstallButton) console.error("[Renderer] Uninstall button not found!");
    if (!repairButton) console.error("[Renderer] Repair button not found!");
    if (!logOutputDiv) console.error("[Renderer] Log output div (#log-output) not found!");
    if (!appStatusArea) console.error("[Renderer] App status area (#app-status-area) not found!");
    if (!appStatusMessage) console.error("[Renderer] App status message (#app-status-message) not found!");
    if (!statusText) console.error("[Renderer] BD Status text element (#bd-status-text) not found!");


    let cleanupFunctions = [];
    let operationInProgress = false;
    let appStatusClearTimer = null;

    // --- Check if electronAPI exists ---
     if (!window.electronAPI) {
        console.error('[Renderer] FATAL: window.electronAPI is not defined. Preload script likely failed.');
        document.body.innerHTML = `<div style="color: red; padding: 20px; font-family: sans-serif;"><h1>Critical Error</h1><p>Failed to load core application bridge (electronAPI). Check console (Ctrl+Shift+I) and preload script.</p></div>`;
        return;
    }
    console.log('[Renderer] electronAPI found.');


    // --- Helper: Add Log to UI ---
    function addLogMessageToUI(message) { /* ... same as V7 ... */ const displayMessage = String(message || '').trim(); if (logOutputDiv && displayMessage.length > 0) { try { const p = document.createElement('p'); p.textContent = displayMessage; logOutputDiv.appendChild(p); requestAnimationFrame(() => { logOutputDiv.scrollTop = logOutputDiv.scrollHeight; }); if (logContainer && !logContainer.classList.contains('visible')) { logContainer.classList.add('visible'); if (logContainer.classList.contains('reveal')) { logContainer.classList.add('visible'); } } } catch (error) { console.error("[Renderer] Error appending log message to UI:", error); } } }

    // --- UI State Management ---
    function setBusyState(busy) { /* ... same as V7 ... */ console.log(`[Renderer] >>> Setting busy state to: ${busy}`); if (operationInProgress === busy) { return; } operationInProgress = busy; [installButton, uninstallButton, repairButton].forEach(button => { if (button instanceof HTMLButtonElement) { button.disabled = busy; } }); bodyElement.classList.toggle('app-busy', busy); if (!busy) { progressContainer?.classList.remove('visible'); console.log('[Renderer] <<< Hid progress bar because busy state ended.'); } else { updateAppStatus('', 'info'); if (logOutputDiv) logOutputDiv.innerHTML = ''; if (logTitle) logTitle.textContent = 'Operation Logs'; setProgress(0); } }
    function updateAppStatus(message, statusType = 'info', hideDelay = 0) { /* ... same as V7 ... */ if (!appStatusArea || !appStatusMessage) { return; } const displayMessage = String(message || '').trim(); appStatusMessage.textContent = displayMessage; appStatusMessage.className = statusType; const shouldBeVisible = displayMessage.length > 0; appStatusArea.classList.toggle('visible', shouldBeVisible); if (appStatusClearTimer) { clearTimeout(appStatusClearTimer); appStatusClearTimer = null; } if (hideDelay > 0 && statusType !== 'error' && shouldBeVisible) { appStatusClearTimer = setTimeout(() => { if (appStatusMessage.textContent === displayMessage) { appStatusArea.classList.remove('visible'); } }, hideDelay); } if (statusType === 'success' || statusType === 'error' || !shouldBeVisible) { progressContainer?.classList.remove('visible'); } }
    function setProgress(value) { /* ... same as V7 ... */ if (!progressContainer || !progressBar) { return; } const clampedValue = Math.min(100, Math.max(0, Math.round(value))); if (!appStatusArea?.classList.contains('visible') && clampedValue > 0 && clampedValue < 100) { updateAppStatus("Operation in progress...", "info"); } progressContainer.classList.add('visible'); progressBar.style.width = `${clampedValue}%`; }

    // --- Theme Sync --- (Keep as is)
    try { const cleanupTheme = window.electronAPI.onThemeSet((theme) => { document.body.setAttribute('data-theme', theme); }); cleanupFunctions.push(cleanupTheme); window.electronAPI?.getInitialTheme().then(themeName => { document.body.setAttribute('data-theme', themeName); }).catch(err => console.error("[Renderer] Get initial theme error:", err)); } catch(e) { console.error("[Renderer] Theme setup error:", e); }

    // --- Navigation --- (Keep as is)
    function showSection(sectionId) { let targetSection = null; sections.forEach(section => { const isActive = section.id === sectionId; section.classList.toggle('active-section', isActive); if (isActive) targetSection = section; }); navLinks.forEach(link => { link.classList.toggle('active', link.hash === `#${sectionId}`); }); mainContentArea?.scrollTo({ top: 0, behavior: 'smooth' }); }
    navLinks.forEach(link => { link.addEventListener('click', (e) => { e.preventDefault(); const sectionId = link.hash.substring(1); showSection(sectionId); }); });
    requestAnimationFrame(() => showSection('dashboard'));

    // --- External Links --- (Keep as is)
    externalLinks.forEach(link => { link.addEventListener('click', (e) => { e.preventDefault(); const url = link.dataset.url; if (url && window.electronAPI?.openLink) window.electronAPI.openLink(url); }); });

    // --- Window Controls --- (Keep as is)
    minimizeBtn?.addEventListener('click', () => window.electronAPI?.minimizeWindow());
    maximizeBtn?.addEventListener('click', () => window.electronAPI?.maximizeWindow());
    closeBtn?.addEventListener('click', () => window.electronAPI?.closeWindow());

    // --- BD Status Display Update Function (More Logging) ---
    async function updateBdStatusDisplay(triggeredBy = "Unknown") {
        if (!statusText) {
            console.error("[Renderer] updateBdStatusDisplay called, but statusText element not found!");
            return;
        }
        const currentText = statusText.textContent; // Store current text before changing
        statusText.textContent = 'Checking...'; // Show checking state
        statusText.className = ''; // Clear previous class
        console.log(`[Renderer] updateBdStatusDisplay triggered by: ${triggeredBy}. Requesting status check...`);

        try {
            if (!window.electronAPI?.checkBdInstall) throw new Error("API checkBdInstall not available");

            // Request status from main process
            const installed = await window.electronAPI.checkBdInstall();

            // *** Log the received status ***
            console.log(`[Renderer] updateBdStatusDisplay: Received checkBdInstall result = ${installed}`);

            // *** Update UI based on received status ***
            if (statusText) { // Double-check element still exists
                statusText.textContent = installed ? 'Installed' : 'Not Detected';
                statusText.className = installed ? 'success' : 'error';
                console.log(`[Renderer] updateBdStatusDisplay: Set text to '${statusText.textContent}', class to '${statusText.className}'`);
            }
            if (installButton) { // Update button text
                installButton.textContent = installed ? 'Update BD' : 'Install BD';
            }

        } catch (error) {
            console.error('[Renderer] updateBdStatusDisplay Error during check:', error);
            if (statusText) { // Update UI on error
                statusText.textContent = 'Error Checking';
                statusText.className = 'error';
            }
            if (installButton) { // Reset button text on error
                installButton.textContent = 'Install BD';
            }
        }
    }
    // Initial check after a slightly longer delay
    setTimeout(() => updateBdStatusDisplay("Initial Load"), 600);


    // --- Button Listeners (Centralized Logic) --- (Keep as is)
    function handleActionButtonClick(actionName, triggerFunction) { if (operationInProgress) { console.log(`[Renderer] Operation already in progress, ignoring ${actionName} click.`); return; } console.log(`[Renderer] Button clicked: ${actionName}`); setBusyState(true); updateAppStatus(`Starting ${actionName}...`, 'info'); if (logTitle) logTitle.textContent = `${actionName} Logs`; try { if (triggerFunction && typeof triggerFunction === 'function') { triggerFunction(); } else { throw new Error(`No valid trigger function configured for ${actionName}`); } } catch (error) { console.error(`[Renderer] Error triggering ${actionName}:`, error); updateAppStatus(`Failed to start ${actionName}.`, 'error'); setBusyState(false); } }
    installButton?.addEventListener('click', () => handleActionButtonClick('Install/Update', window.electronAPI?.triggerBdInstall));
    uninstallButton?.addEventListener('click', () => handleActionButtonClick('Uninstall', window.electronAPI?.triggerBdUninstall));
    repairButton?.addEventListener('click', () => handleActionButtonClick('Repair', window.electronAPI?.triggerBdRepair));

    // --- Settings Handling --- (Keep as is)
    function updateCheckbox(id, isChecked) { const checkbox = document.getElementById(id); if (checkbox instanceof HTMLInputElement && checkbox.checked !== isChecked) checkbox.checked = isChecked; }
    (async () => { if (!window.electronAPI?.getSetting) return; try { const keys = ['startOnLogin', 'runInSystemTray', 'autoCheckUpdates', 'enableNotifications']; for (const key of keys) { const value = await window.electronAPI.getSetting(key); if (value !== undefined) updateCheckbox(key, value); } console.log('[Renderer] Initial settings loaded.');} catch (e) { console.error("[Renderer] Setting fetch error:", e); } })();
    const cleanupSettingsLoaded = window.electronAPI.onSettingsLoaded(settings => { if (!settings) return; console.log('[Renderer] Received settings-loaded event:', settings); for (const key in settings) if (Object.hasOwnProperty.call(settings, key)) updateCheckbox(key, settings[key]); }); cleanupFunctions.push(cleanupSettingsLoaded);
    const cleanupSettingChanged = window.electronAPI.onSettingChanged(({ key, value }) => { console.log(`[Renderer] Setting changed: ${key}=${value}`); updateCheckbox(key, value); }); cleanupFunctions.push(cleanupSettingChanged);
    settingsCheckboxes.forEach(checkbox => { checkbox.addEventListener('change', (event) => { if (event.target instanceof HTMLInputElement) { const key = event.target.id; const value = event.target.checked; console.log(`[Renderer] Saving setting: ${key}=${value}`); window.electronAPI?.saveSetting(key, value); } }); });

    // --- IPC Event Listeners & UI Updates ---
    try {
        console.log("[Renderer] Setting up IPC listeners...");

        const cleanupLogEntry = window.electronAPI.onLogEntry((entry) => { console.log("[Renderer] ===> IPC Received: add-log"); try { addLogMessageToUI(entry); } catch (e) { console.error("[Renderer] Error in addLogMessageToUI:", e); } }); cleanupFunctions.push(cleanupLogEntry); console.log("[Renderer] Listener 'add-log' setup OK.");
        const cleanupInstallProgress = window.electronAPI.onInstallProgress((value) => { /*console.log("[Renderer] ===> IPC Received: update-progress", value);*/ try { setProgress(value); } catch (e) { console.error("[Renderer] Error in setProgress:", e); } }); cleanupFunctions.push(cleanupInstallProgress); console.log("[Renderer] Listener 'update-progress' setup OK.");
        const cleanupInstallStatusSimple = window.electronAPI.onInstallStatusSimple((statusType) => { console.log(`[Renderer] ===> IPC Received: update-status ('${statusType}')`); try { setBusyState(false); updateBdStatusDisplay("IPC Status Update"); if (statusType === 'success') { updateAppStatus('Operation Successful!', 'success', 5000); } else if (statusType === 'error') { updateAppStatus('Operation Failed. Check main console & logs.', 'error'); } else { updateAppStatus('', 'info', 500); } } catch (e) { console.error("[Renderer] Error handling 'update-status' message:", e); setBusyState(false); } }); cleanupFunctions.push(cleanupInstallStatusSimple); console.log("[Renderer] Listener 'update-status' setup OK.");

        // BD Status refresh requested by Main ('bd-status')
        // *** ADD LOGGING HERE ***
        const cleanupBdStatus = window.electronAPI.onBdStatus(({ installed }) => {
            console.log(`[Renderer] ===> IPC Received: bd-status update from main. Installed = ${installed}`);
            updateBdStatusDisplay("IPC bd-status Event"); // Call the status update function
         });
        cleanupFunctions.push(cleanupBdStatus);
        console.log("[Renderer] Listener 'bd-status' setup OK.");

        // In-App Notification Display ('show-app-notification')
        const cleanupShowAppNotification = window.electronAPI.onShowAppNotification(({ title, body }) => { console.log(`[Renderer] IPC Received: show-app-notification: ${title} - ${body}`); updateAppStatus(`${title}: ${body}`, 'info', 8000); }); cleanupFunctions.push(cleanupShowAppNotification); console.log("[Renderer] Listener 'show-app-notification' setup OK.");

        console.log("[Renderer] All IPC listeners setup completed successfully.");

    } catch (error) { console.error("[Renderer] FATAL ERROR setting up IPC listeners:", error); alert("Critical Error: Failed to set up communication listeners. Check console (Ctrl+Shift+I)."); }


    // --- Reveal on Scroll Observer --- (Keep as is)
    const revealObserver = new IntersectionObserver((entries, observer) => { entries.forEach(entry => { if (entry.isIntersecting) { requestAnimationFrame(() => { entry.target.classList.add('visible'); }); observer.unobserve(entry.target); } }); }, { root: mainContentArea, threshold: 0.1 });
    document.querySelectorAll('.reveal').forEach(el => { if(el) revealObserver.observe(el); });

    // --- Cleanup --- (Keep as is)
    window.addEventListener('beforeunload', () => { console.log('[Renderer] Cleaning up listeners...'); cleanupFunctions.forEach(cleanup => { if(typeof cleanup === 'function') cleanup(); }); cleanupFunctions = []; revealObserver.disconnect(); console.log('[Renderer] Cleanup complete.'); });

    console.log("[Renderer] Initial setup complete.");
}); // End DOMContentLoaded