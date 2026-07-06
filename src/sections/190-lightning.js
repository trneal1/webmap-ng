// ===== LIGHTNING =====
const lightningPanel=Webmap.services.dom.byId('lightningPanel');
const lightningHeader=Webmap.services.dom.byId('lightningHeader');
const lightningButton=Webmap.services.dom.byId('lightningButton');
const lightningStatus=Webmap.services.dom.byId('lightningStatus');
const lightningLegendImage=Webmap.services.dom.byId('lightningLegendImage');

function openLightningPanel(){
    lightningPanelController.open();
}

function closeLightningPanel(){
    lightningPanelController.close();
}

function toggleLightningPanel(){
    lightningPanelController.toggle();
}

function clampLightningPanel(){
    lightningPanelController.clamp();
}

const lightningPanelDragController=makeDraggablePanel({
    panel:lightningPanel,
    handle:lightningHeader,
    onStart:()=>{ isDraggingLightningPanel=true; },
    onEnd:()=>{ isDraggingLightningPanel=false; }
});

const lightningPanelController=Webmap.services.panels.createPanelController({
    panel:lightningPanel,
    dragController:lightningPanelDragController
});

function createLightningLayer(opacity=lightningOpacity.value/100){
    return Webmap.services.api.createLightningWmsLayer(opacity);
}

function getLightningLegendUrl(){
    return Webmap.services.api.getLightningLegendUrl();
}

function refreshLightningLayer(){
    if(!lightningToggle.checked) return;
    if(historyModeActive){
        disableLightningLayer("Disabled in history mode");
        return;
    }

    const token=++lightningRefreshToken;
    const previousLayer=lightningLayer;
    lightningStatus.textContent="Loading latest...";
    const nextLayer=createLightningLayer(previousLayer ? 0 : lightningOpacity.value/100);
    let tileErrors=0;

    nextLayer.once("load",()=>{
        if(token !== lightningRefreshToken || !lightningToggle.checked){
            map.removeLayer(nextLayer);
            return;
        }
        if(previousLayer && map.hasLayer(previousLayer)) map.removeLayer(previousLayer);
        nextLayer.setOpacity(lightningOpacity.value/100);
        lightningLayer=nextLayer;
        lightningStatus.textContent=tileErrors
            ? "Loaded, some tiles retrying"
            : "Loaded " + new Date().toLocaleTimeString();
    });

    nextLayer.on("tileerror",(event)=>{
        const tile=event.tile;
        const retries=Number(tile.dataset.lightningRetries || 0);
        if(retries < LIGHTNING_TILE_RETRY_LIMIT){
            tile.dataset.lightningRetries=String(retries + 1);
            const retryUrl=tile.src.replace(/([?&])_retry=\d+(&|$)/,"$1").replace(/[?&]$/,"");
            const separator=retryUrl.includes("?") ? "&" : "?";
            setTimeout(()=>{
                if(token === lightningRefreshToken && lightningToggle.checked){
                    tile.src=retryUrl + separator + "_retry=" + (retries + 1) + "_" + Date.now();
                }
            },600 * (retries + 1));
            return;
        }

        tileErrors++;
        if(token === lightningRefreshToken){
            lightningStatus.textContent=previousLayer
                ? "NOAA nowCOAST slow, keeping previous layer"
                : "NOAA nowCOAST tiles loading slowly";
            console.warn("Unable to load NOAA nowCOAST lightning tile");
        }
    });

    nextLayer.addTo(map);
    if(!previousLayer) lightningLayer=nextLayer;
}

function startLightningRefreshTimer(){
    if(lightningRefreshTimer) clearInterval(lightningRefreshTimer);
    lightningRefreshTimer=setInterval(()=>{
        if(lightningToggle.checked && !historyModeActive) refreshLightningLayer();
    },LIGHTNING_REFRESH_INTERVAL);
}

function toggleLightningLayer(){
    lightningRefreshToken++;
    if(lightningToggle.checked){
        if(historyModeActive){
            disableLightningLayer("Disabled in history mode");
            return;
        }
        lightningButton.classList.add('active');
        updateMapScalePanelVisibility();
        refreshLightningLayer();
        startLightningRefreshTimer();
    } else {
        disableLightningLayer("Off");
    }
}

function disableLightningLayer(statusText="Off"){
    lightningRefreshToken++;
    lightningToggle.checked=false;
    lightningButton.classList.remove('active');
    if(lightningLayer){
        map.removeLayer(lightningLayer);
        lightningLayer=null;
    }
    lightningStatus.textContent=statusText;
    updateMapScalePanelVisibility();
}

function updateLightningOpacity(){
    if(lightningLayer) lightningLayer.setOpacity(lightningOpacity.value/100);
}

