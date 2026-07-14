// ===== KEYBOARD ZOOM CONTROLS =====
let zoomInInterval = null;
let zoomOutInterval = null;
const storedMapViewsKey = 'nwsDashboardStoredMapViews';
let storedMapViews = loadStoredMapViews();

function isFormControl(element) {
    if (!element) return false;
    const tag = element.tagName?.toLowerCase();
    return tag === 'input' || tag === 'textarea' || tag === 'select' || element.isContentEditable;
}

function shouldIgnoreShortcutEvent(e) {
    const target = e.target;
    return isFormControl(target) ||
        (target.closest && target.closest('#sidebar')) ||
        (target.closest && target.closest('#setupPanel') && !target.closest('#shortcutHelpButton'));
}

function loadStoredMapViews() {
    try {
        return JSON.parse(localStorage.getItem(storedMapViewsKey)) || {};
    } catch (error) {
        return {};
    }
}

function saveStoredMapViews() {
    localStorage.setItem(storedMapViewsKey, JSON.stringify(storedMapViews));
}

function getStoredViewDigit(e) {
    const digitMatch = e.code?.match(/^(?:Digit|Numpad)([1-9])$/);
    if (digitMatch) return digitMatch[1];
    return /^[1-9]$/.test(e.key) ? e.key : '';
}

function storeMapView(slot) {
    const center = map.getCenter();
    storedMapViews[slot] = {
        lat: center.lat,
        lng: center.lng,
        zoom: map.getZoom()
    };
    saveStoredMapViews();
}

function restoreMapView(slot) {
    const view = storedMapViews[slot];
    if (!view) return;
    map.setView([view.lat, view.lng], view.zoom, { animate: true });
}

function togglePopupWindowsVisibility(){
    document.body.classList.toggle('popup-windows-hidden');
}

Webmap.services.dom.listenDocument('keydown',(e) => {
    if (shouldIgnoreShortcutEvent(e)) return;

    const storedViewDigit = getStoredViewDigit(e);
    if (storedViewDigit && !e.ctrlKey && !e.altKey && !e.metaKey) {
        e.preventDefault();
        if (e.shiftKey) {
            if (!e.repeat) {
                storeMapView(storedViewDigit);
            }
        } else {
            restoreMapView(storedViewDigit);
        }
        return;
    }

    if (e.key === 'Escape' && Webmap.services.dom.maybeById('shortcutHelpPanel').classList.contains('open')) {
        closeShortcutHelpPanel();
        return;
    }

    if (e.key === 'Escape' && Webmap.services.dom.maybeById('historyPanel').classList.contains('open')) {
        closeHistoryPanel();
        return;
    }

    if (e.key === 'Escape' && Webmap.services.dom.maybeById('historyMapPanel').classList.contains('open')) {
        closeHistoryMapPanel();
        return;
    }

    if (e.key === 'Escape' && Webmap.services.dom.maybeById('setupPanel').classList.contains('open')) {
        closeSetupPanel();
        return;
    }

    if (e.key === 'Escape' && Webmap.services.dom.maybeById('priorityPanel').classList.contains('open')) {
        closePriorityPanel();
        return;
    }

    if (e.key === 'Escape' && Webmap.services.dom.maybeById('precipPanel').classList.contains('open')) {
        closePrecipPanel();
        return;
    }

    if (e.key === 'Escape' && Webmap.services.dom.maybeById('lightningPanel').classList.contains('open')) {
        closeLightningPanel();
        return;
    }

    if (e.key === 'Escape' && Webmap.services.dom.maybeById('plotPanel').classList.contains('open')) {
        closePlotPanel();
        return;
    }

    if (e.key === 'Escape' && Webmap.services.dom.maybeById('countyHistoryPanel').classList.contains('open')) {
        closeCountyHistoryPanel();
        return;
    }

    if (e.key === 'Escape' && closeTopmostEventDetailPanel()) {
        return;
    }

    if (e.key === 'Escape' && Webmap.services.dom.maybeById('eventFilterOverlay').classList.contains('open')) {
        closeEventFilterPopup();
        return;
    }

    if (Webmap.services.dom.maybeById('historyPanel').classList.contains('open') && !e.ctrlKey && !e.altKey && !e.metaKey) {
        if(e.key === 'n'){
            e.preventDefault();
            moveHistoryBy(getHistoryFramesPerStep());
            return;
        } else if(e.key === 'N'){
            e.preventDefault();
            moveHistoryBy(1);
            return;
        } else if(e.key === 'p'){
            e.preventDefault();
            moveHistoryBy(-getHistoryFramesPerStep());
            return;
        } else if(e.key === 'P'){
            e.preventDefault();
            moveHistoryBy(-1);
            return;
        }
    }

    if (e.key === '?') {
        e.preventDefault();
        toggleShortcutHelpPanel();
        return;
    } else if (e.key === 'w' || e.key === 'W') {
        e.preventDefault();
        togglePopupWindowsVisibility();
        return;
    } else if (handlePrecipSpaceSample(e)) {
        return;
    } else if (handleCountyElevationSpaceSample(e)) {
        return;
    } else if (e.key === 's' || e.key === 'S') {
        if(Webmap.services.dom.maybeById('setupPanel').classList.contains('open')){
            closeSetupPanel();
        } else {
            openSetupPanel();
        }
        return;
    } else if (e.key === 'h' || e.key === 'H') {
        const historyPanelElement=Webmap.services.dom.maybeById('historyPanel');
        if(historyPanelElement.classList.contains('open') && historyPanelElement.classList.contains('minimized')){
            restoreHistoryPanel();
        } else if(historyPanelElement.classList.contains('open')){
            closeHistoryPanel();
        } else {
            openHistoryPanel();
        }
        return;
    } else if (e.key === 'a' || e.key === 'A') {
        e.preventDefault();
        toggleHistoryMapMode();
        return;
    } else if (e.key === 'u' || e.key === 'U') {
        e.preventDefault();
        togglePriorityPanel();
        return;
    } else if (e.key === 'g' || e.key === 'G') {
        e.preventDefault();
        togglePlotPanel();
        return;
    } else if (e.key === 't' || e.key === 'T') {
        const eventFilterOverlayElement=Webmap.services.dom.maybeById('eventFilterOverlay');
        if(eventFilterOverlayElement.classList.contains('open') && eventFilterOverlayElement.classList.contains('minimized')){
            restoreEventFilterPopup();
        } else {
            openEventFilterPopup();
        }
        return;
    } else if (e.key === 'q' || e.key === 'Q') {
        e.preventDefault();
        togglePrecipPanel();
        return;
    } else if (e.key === 'y' || e.key === 'Y') {
        e.preventDefault();
        toggleLightningPanel();
        return;
    } else if (e.key === 'k' || e.key === 'K') {
        e.preventDefault();
        toggleCloudLayer();
        return;
    } else if (e.key === 'c' || e.key === 'C') {
        countyColorizationMode = (countyColorizationMode + 1) % 3;
        redrawMap();
        return;
    } else if (e.key === 'r' || e.key === 'R') {
        // Toggle radar on/off
        radarToggle.checked = !radarToggle.checked;
        toggleRadar();
        return;
    } else if (e.key === 'v' || e.key === 'V') {
        e.preventDefault();
        toggleAlertPolygons();
        return;
    } else if (e.key === 'm' || e.key === 'M') {
        // Toggle between Street and Topological maps
        const currentType = mapTypeSelector.value;
        const newType = currentType === 'Street' ? 'Topological' : 'Street';
        mapTypeSelector.value = newType;
        switchMapType();
        return;
    } else if (e.key === 'l' || e.key === 'L') {
        toggleStateLabels();
        return;
    } else if (e.key === 'i' || e.key === 'I') {
        if(zoomInInterval) return;
        e.preventDefault();
        // Zoom immediately on key press
        const currentZoom = map.getZoom();
        const maxZoom = map.getMaxZoom();
        if (currentZoom < maxZoom) {
            map.setZoom(currentZoom + 1.0);
        }
        
        // Then set up interval for continuous zooming
        zoomInInterval = setInterval(() => {
            const currentZoom = map.getZoom();
            const maxZoom = map.getMaxZoom();
            if (currentZoom < maxZoom) {
                map.setZoom(currentZoom + 1.0);
            }
        }, 100);
    } else if (e.key === 'o' || e.key === 'O') {
        if(zoomOutInterval) return;
        e.preventDefault();
        // Zoom immediately on key press
        const currentZoom = map.getZoom();
        const minZoom = map.getMinZoom();
        if (currentZoom > minZoom) {
            map.setZoom(currentZoom - 1.0);
        }
        
        // Then set up interval for continuous zooming
        zoomOutInterval = setInterval(() => {
            const currentZoom = map.getZoom();
            const minZoom = map.getMinZoom();
            if (currentZoom > minZoom) {
                map.setZoom(currentZoom - 1.0);
            }
        }, 100);
    }
}, true); // Use capture

Webmap.services.dom.listenDocument('keyup',(e) => {
    if (shouldIgnoreShortcutEvent(e)) return;

    if ((e.key === 'i' || e.key === 'I') && zoomInInterval) {
        clearInterval(zoomInInterval);
        zoomInInterval = null;
    } else if ((e.key === 'o' || e.key === 'O') && zoomOutInterval) {
        clearInterval(zoomOutInterval);
        zoomOutInterval = null;
    }
}, true); // Use capture
