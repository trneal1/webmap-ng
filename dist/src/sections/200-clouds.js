// ===== CLOUDS =====
const cloudButton=Webmap.services.dom.byId('cloudButton');

function createCloudLayer(opacity=CLOUD_LAYER_OPACITY){
    return Webmap.services.api.createCloudWmsLayer(opacity);
}

function setCloudButtonState(active,statusText){
    cloudButton.classList.toggle('active',active);
    cloudButton.textContent=active ? "Clouds on" : "Clouds";
    cloudButton.title=statusText ? "Cloud layer (K): " + statusText : "Cloud layer (K)";
}

function refreshCloudLayer(){
    if(!cloudLayer && !cloudButton.classList.contains('active')) return;
    if(historyModeActive){
        disableCloudLayer("Disabled in history mode");
        return;
    }

    const token=++cloudRefreshToken;
    const previousLayer=cloudLayer;
    setCloudButtonState(true,"Loading latest");
    const nextLayer=createCloudLayer(previousLayer ? 0 : CLOUD_LAYER_OPACITY);
    let tileErrors=0;

    nextLayer.once("load",()=>{
        if(token !== cloudRefreshToken || !cloudButton.classList.contains('active')){
            map.removeLayer(nextLayer);
            return;
        }
        if(previousLayer && map.hasLayer(previousLayer)) map.removeLayer(previousLayer);
        nextLayer.setOpacity(CLOUD_LAYER_OPACITY);
        cloudLayer=nextLayer;
        setCloudButtonState(true,tileErrors ? "Loaded, some tiles retrying" : "Loaded " + new Date().toLocaleTimeString());
    });

    nextLayer.on("tileerror",(event)=>{
        const tile=event.tile;
        const retries=Number(tile.dataset.cloudRetries || 0);
        if(retries < CLOUD_TILE_RETRY_LIMIT){
            tile.dataset.cloudRetries=String(retries + 1);
            const retryUrl=tile.src.replace(/([?&])_retry=\d+(&|$)/,"$1").replace(/[?&]$/,"");
            const separator=retryUrl.includes("?") ? "&" : "?";
            setTimeout(()=>{
                if(token === cloudRefreshToken && cloudButton.classList.contains('active')){
                    tile.src=retryUrl + separator + "_retry=" + (retries + 1) + "_" + Date.now();
                }
            },600 * (retries + 1));
            return;
        }

        tileErrors++;
        if(token === cloudRefreshToken){
            setCloudButtonState(true,previousLayer ? "NOAA nowCOAST slow, keeping previous layer" : "NOAA nowCOAST tiles loading slowly");
            console.warn("Unable to load NOAA nowCOAST cloud tile");
        }
    });

    nextLayer.addTo(map);
    if(!previousLayer) cloudLayer=nextLayer;
}

function startCloudRefreshTimer(){
    if(cloudRefreshTimer) clearInterval(cloudRefreshTimer);
    cloudRefreshTimer=setInterval(()=>{
        if(cloudButton.classList.contains('active') && !historyModeActive) refreshCloudLayer();
    },CLOUD_REFRESH_INTERVAL);
}

function toggleCloudLayer(){
    cloudRefreshToken++;
    if(cloudButton.classList.contains('active')){
        disableCloudLayer("Off");
        return;
    }
    if(historyModeActive){
        disableCloudLayer("Disabled in history mode");
        return;
    }

    setCloudButtonState(true,"Loading latest");
    refreshCloudLayer();
    startCloudRefreshTimer();
}

function disableCloudLayer(statusText="Off"){
    cloudRefreshToken++;
    setCloudButtonState(false,statusText);
    if(cloudLayer){
        map.removeLayer(cloudLayer);
        cloudLayer=null;
    }
}

function disableLiveOnlyOverlays(statusText="Disabled in history mode"){
    if(precipToggle.checked || precipLayer) disablePrecipLayer(statusText);
    if(lightningToggle.checked || lightningLayer) disableLightningLayer(statusText);
    if(cloudButton.classList.contains('active') || cloudLayer) disableCloudLayer(statusText);
}

if(lightningLegendImage) lightningLegendImage.src=getLightningLegendUrl();
updateMapScalePanelVisibility();
startLightningRefreshTimer();
setCloudButtonState(false,"Off");

function updateMapOpacity(){
    const val=Webmap.services.dom.maybeById("mapOpacity").value;
    const opacity=val/100;
    if(currentBaseLayer && typeof currentBaseLayer.setOpacity === 'function'){
        currentBaseLayer.setOpacity(opacity);
    }
}

function updateCountyOpacity(){
    const val=Webmap.services.dom.maybeById("countyOpacity").value;
    countyOpacityValue=val/100;
    redrawMap();
}

function switchMapType(){
    const mapType = Webmap.services.dom.maybeById("mapTypeSelector").value;
    map.removeLayer(currentBaseLayer);
    currentBaseLayer = baseLayers[mapType].addTo(map);
    updateMapOpacity();
    if(cloudLayer) cloudLayer.bringToFront();
    if(radarLayer) radarLayer.bringToFront();
    if(stateLayer) stateLayer.bringToFront();
}

