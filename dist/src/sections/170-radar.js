// ===== RADAR =====
function createRadarLayer(timestamp=Date.now()){
    return Webmap.services.api.createLiveRadarLayer(radarOpacity.value/100,timestamp);
}

function createHistoryRadarLayer(wmsTime){
    return Webmap.services.api.createHistoryRadarWmsLayer(wmsTime,radarOpacity.value/100);
}

function toggleRadar(){
    if(historyModeActive){
        if(isHistoryPlaybackRunning()){
            if(radarLayer) map.removeLayer(radarLayer);
            radarLayer=null;
            return;
        }
        const metadata=getCurrentHistoryFrameMetadata();
        if(metadata) applyHistoryRadar(metadata);
        return;
    }

    if(radarToggle.checked){
        reloadRadar();
    } else if(radarLayer){
        map.removeLayer(radarLayer);
    }
}

function reloadRadar(){
    nextRadarUpdate = Date.now() + radarUpdateInterval;
    currentRadarTimestamp = Date.now();
    if(radarLayer) map.removeLayer(radarLayer);
    radarLayer=createRadarLayer(currentRadarTimestamp);
    if(radarToggle.checked) radarLayer.addTo(map);
}

function updateRadarOpacity(){
    if(radarLayer) radarLayer.setOpacity(radarOpacity.value/100);
}

