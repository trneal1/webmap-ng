// ===== PRECIPITATION =====
const precipPanel=Webmap.services.dom.byId('precipPanel');
const precipHeader=Webmap.services.dom.byId('precipHeader');
const precipButton=Webmap.services.dom.byId('precipButton');
const precipStatus=Webmap.services.dom.byId('precipStatus');
const precipLegendImage=Webmap.services.dom.byId('precipLegendImage');
const precipLegendFallback=Webmap.services.dom.byId('precipLegendFallback');
const precipScalePanel=Webmap.services.dom.byId('precipScalePanel');
const precipScaleHeader=Webmap.services.dom.byId('precipScaleHeader');
const lightningScalePanel=Webmap.services.dom.byId('lightningScalePanel');
const lightningScaleHeader=Webmap.services.dom.byId('lightningScaleHeader');

function isSpaceKeyEvent(e){
    return e.key === " " || e.key === "Spacebar" || e.code === "Space";
}

function handlePrecipSpaceSample(e){
    if(!isSpaceKeyEvent(e) || !isPrecipLayerEnabled()) return false;

    e.preventDefault();
    e.stopPropagation();
    if(!e.repeat) sampleActivePrecipTooltipTarget();
    return true;
}

function getElevationSampleUrl(latlng){
    return Webmap.services.api.getElevationSampleUrl(latlng);
}

function parseElevationFeet(data){
    return Webmap.services.api.parseElevationFeet(data);
}

function formatElevationLine(feet,latlng){
    if(feet === null) return "Altitude above sea level: unavailable";
    const meters=feet * 0.3048;
    return `Altitude above sea level: ${Math.round(feet).toLocaleString()} ft (${Math.round(meters).toLocaleString()} m) at ${latlng.lat.toFixed(4)}, ${latlng.lng.toFixed(4)}`;
}

function setCountyTooltipElevationLine(layer,baseTooltip,text){
    layer.setTooltipContent(baseTooltip + "<br>" + escapeHtml(text));
}

function handleCountyElevationSpaceSample(e){
    if(!isSpaceKeyEvent(e) || isPrecipLayerEnabled()) return false;
    if(!activeCountyCursorTarget || !activeCountyCursorTarget.latlng) return false;

    e.preventDefault();
    e.stopPropagation();
    if(e.repeat) return true;

    const target=activeCountyCursorTarget;
    const layer=target.layer;
    const baseTooltip=target.baseTooltip;
    const latlng=target.latlng;
    const token=(layer._elevationTooltipToken || 0) + 1;
    layer._elevationTooltipToken=token;

    setCountyTooltipElevationLine(layer,baseTooltip,"Altitude above sea level: loading...");
    layer.openTooltip(latlng);

    Webmap.services.api.fetchElevationFeet(latlng)
        .then(feet=>{
            if(layer._elevationTooltipToken !== token) return;
            setCountyTooltipElevationLine(layer,baseTooltip,formatElevationLine(feet,latlng));
            layer.openTooltip(latlng);
        })
        .catch(()=>{
            if(layer._elevationTooltipToken !== token) return;
            setCountyTooltipElevationLine(layer,baseTooltip,"Altitude above sea level: unavailable");
            layer.openTooltip(latlng);
        });

    return true;
}

Webmap.services.dom.listenDocument("keydown",handlePrecipSpaceSample,true);
Webmap.services.dom.listenDocument("keyup",(e)=>{
    if(!isSpaceKeyEvent(e) || (!isPrecipLayerEnabled() && !activeCountyCursorTarget)) return;

    e.preventDefault();
    e.stopPropagation();
},true);

function updateMapScalePanelVisibility(){
    const showPrecip=Boolean(precipToggle && precipToggle.checked);
    const showLightning=Boolean(lightningToggle && lightningToggle.checked);

    if(precipScalePanel) precipScalePanel.classList.toggle('visible',showPrecip);
    if(lightningScalePanel) lightningScalePanel.classList.toggle('visible',showLightning);
    clampScalePanels();
}

function clampScalePanel(panel){
    clampElementToViewport(panel,{ requireClass:"visible", resetStyles:["transform"] });
}

function clampScalePanels(){
    clampScalePanel(precipScalePanel);
    clampScalePanel(lightningScalePanel);
}

const precipScalePanelDragController=precipScaleHeader && precipScalePanel ? makeDraggablePanel({
    panel:precipScalePanel,
    handle:precipScaleHeader,
    resetStyles:["transform"],
    onStart:(panel)=>{
        panel.classList.add('is-dragging');
        isDraggingScalePanel=true;
        scalePanelDragTarget=panel;
    },
    onEnd:(panel)=>{
        panel.classList.remove('is-dragging');
        isDraggingScalePanel=false;
        scalePanelDragTarget=null;
    }
}) : null;

const lightningScalePanelDragController=lightningScaleHeader && lightningScalePanel ? makeDraggablePanel({
    panel:lightningScalePanel,
    handle:lightningScaleHeader,
    resetStyles:["transform"],
    onStart:(panel)=>{
        panel.classList.add('is-dragging');
        isDraggingScalePanel=true;
        scalePanelDragTarget=panel;
    },
    onEnd:(panel)=>{
        panel.classList.remove('is-dragging');
        isDraggingScalePanel=false;
        scalePanelDragTarget=null;
    }
}) : null;

function openPrecipPanel(){
    precipPanelController.open();
}

function closePrecipPanel(){
    precipPanelController.close();
}

function togglePrecipPanel(){
    precipPanelController.toggle();
}

function clampPrecipPanel(){
    precipPanelController.clamp();
}

const precipPanelDragController=makeDraggablePanel({
    panel:precipPanel,
    handle:precipHeader,
    onStart:()=>{ isDraggingPrecipPanel=true; },
    onEnd:()=>{ isDraggingPrecipPanel=false; }
});

const precipPanelController=Webmap.services.panels.createPanelController({
    panel:precipPanel,
    dragController:precipPanelDragController
});

function createPrecipLayer(opacity=precipOpacity.value/100){
    return Webmap.services.api.createPrecipWmsLayer(precipRangeSelector.value,opacity);
}

function getPrecipLayerName(){
    return Webmap.services.api.getPrecipLayerName(precipRangeSelector.value);
}

function getPrecipLegendUrl(){
    return Webmap.services.api.getPrecipLegendUrl(precipRangeSelector.value);
}

function isPrecipLayerEnabled(){
    return Boolean(precipToggle && precipToggle.checked && precipLayer && map.hasLayer(precipLayer));
}

function getPrecipRasterFunctionName(){
    return Webmap.services.api.getPrecipRasterFunctionName(precipRangeSelector.value);
}

function getPrecipMosaicRule(){
    return Webmap.services.api.getPrecipMosaicRule(precipRangeSelector.value);
}

function getPrecipSampleUrl(latlng){
    return Webmap.services.api.getPrecipSampleUrl(latlng,precipRangeSelector.value);
}

function parsePrecipSampleInches(data){
    return Webmap.services.api.parsePrecipSampleInches(data);
}

function formatPrecipEstimate(value){
    if(value === null) return "Precipitation: unavailable";
    if(value > 0 && value < 0.005) return "Estimated precipitation: <0.01 in";
    return `Estimated precipitation: ${value.toFixed(value < 1 ? 2 : 1)} in`;
}

function clearActivePrecipTooltipTarget(){
    if(!activePrecipTooltipTarget) return;

    const { layer, baseTooltip }=activePrecipTooltipTarget;
    layer._precipTooltipToken=(layer._precipTooltipToken || 0) + 1;
    clearTimeout(layer._precipTooltipTimer);
    layer.setTooltipContent(baseTooltip);
    activePrecipTooltipTarget=null;
}

function trackPrecipTooltipTarget(layer,baseTooltip,latlng){
    activePrecipTooltipTarget={ layer, baseTooltip, latlng };

    if(!isPrecipLayerEnabled() || historyMapActive) return;

    layer._precipTooltipToken=(layer._precipTooltipToken || 0) + 1;
    clearTimeout(layer._precipTooltipTimer);
    layer.setTooltipContent(baseTooltip);
}

function sampleActivePrecipTooltipTarget(){
    if(!activePrecipTooltipTarget || !isPrecipLayerEnabled() || historyMapActive) return false;

    const { layer, baseTooltip, latlng }=activePrecipTooltipTarget;
    appendPrecipEstimateToTooltip(layer,baseTooltip,latlng);
    if(!layer.isTooltipOpen?.()){
        layer.openTooltip(latlng);
    }
    return true;
}

function appendPrecipEstimateToTooltip(layer,baseTooltip,latlng){
    if(!isPrecipLayerEnabled() || historyMapActive){
        layer.setTooltipContent(baseTooltip);
        return;
    }

    const token=(layer._precipTooltipToken || 0) + 1;
    layer._precipTooltipToken=token;
    clearTimeout(layer._precipTooltipTimer);
    layer.setTooltipContent(baseTooltip + "<br>Estimated precipitation: loading...");

    layer._precipTooltipTimer=setTimeout(()=>{
        Webmap.services.api.fetchPrecipSample(latlng,precipRangeSelector.value)
            .then(value=>{
                if(layer._precipTooltipToken !== token) return;
                layer.setTooltipContent(baseTooltip + "<br>" + escapeHtml(formatPrecipEstimate(value)));
            })
            .catch(()=>{
                if(layer._precipTooltipToken !== token) return;
                layer.setTooltipContent(baseTooltip + "<br>Estimated precipitation: unavailable");
            });
    },150);
}

function updatePrecipLegend(){
    if(!precipLegendImage || !precipLegendFallback) return;
    precipLegendFallback.hidden=true;
    precipLegendImage.hidden=false;
    precipLegendImage.src=getPrecipLegendUrl();
}

if(precipLegendImage){
    Webmap.services.dom.listen(precipLegendImage,"error",()=>{
        precipLegendImage.hidden=true;
        if(precipLegendFallback) precipLegendFallback.hidden=false;
    });
}

function refreshPrecipLayer(){
    if(!precipToggle.checked) return;
    if(historyModeActive){
        disablePrecipLayer("Disabled in history mode");
        return;
    }

    const token=++precipRefreshToken;
    const previousLayer=precipLayer;
    const rangeText=precipRangeSelector.options[precipRangeSelector.selectedIndex].text;
    precipStatus.textContent="Loading " + rangeText + "...";
    const nextLayer=createPrecipLayer(previousLayer ? 0 : precipOpacity.value/100);
    let tileErrors=0;

    nextLayer.once("load",()=>{
        if(token !== precipRefreshToken || !precipToggle.checked){
            map.removeLayer(nextLayer);
            return;
        }
        if(previousLayer && map.hasLayer(previousLayer)) map.removeLayer(previousLayer);
        nextLayer.setOpacity(precipOpacity.value/100);
        precipLayer=nextLayer;
        precipStatus.textContent=tileErrors
            ? rangeText + " loaded, some tiles retrying"
            : rangeText + " loaded";
    });

    nextLayer.on("tileerror",(event)=>{
        const tile=event.tile;
        const retries=Number(tile.dataset.precipRetries || 0);
        if(retries < PRECIP_TILE_RETRY_LIMIT){
            tile.dataset.precipRetries=String(retries + 1);
            const retryUrl=tile.src.replace(/([?&])_retry=\d+(&|$)/,"$1").replace(/[?&]$/,"");
            const separator=retryUrl.includes("?") ? "&" : "?";
            setTimeout(()=>{
                if(token === precipRefreshToken && precipToggle.checked){
                    tile.src=retryUrl + separator + "_retry=" + (retries + 1) + "_" + Date.now();
                }
            },600 * (retries + 1));
            return;
        }

        tileErrors++;
        if(token === precipRefreshToken){
            precipStatus.textContent=previousLayer
                ? "NOAA/NWS slow, keeping previous layer"
                : "NOAA/NWS tiles loading slowly";
            console.warn("Unable to load NOAA/NWS precipitation tile");
        }
    });

    nextLayer.addTo(map);
    if(!previousLayer) precipLayer=nextLayer;
}

function togglePrecipLayer(){
    precipRefreshToken++;
    if(precipToggle.checked){
        if(historyModeActive){
            disablePrecipLayer("Disabled in history mode");
            return;
        }
        if(document.activeElement === precipToggle || document.activeElement === precipButton){
            document.activeElement.blur();
        }
        precipButton.classList.add('active');
        updateMapScalePanelVisibility();
        refreshPrecipLayer();
    } else {
        disablePrecipLayer("Off");
    }
}

function disablePrecipLayer(statusText="Off"){
    precipRefreshToken++;
    precipToggle.checked=false;
    precipButton.classList.remove('active');
    clearActivePrecipTooltipTarget();
    if(precipLayer){
        map.removeLayer(precipLayer);
        precipLayer=null;
    }
    precipStatus.textContent=statusText;
    updateMapScalePanelVisibility();
}

function changePrecipRange(){
    updatePrecipLegend();
    if(precipToggle.checked) refreshPrecipLayer();
}

function updatePrecipOpacity(){
    if(precipLayer) precipLayer.setOpacity(precipOpacity.value/100);
}

updatePrecipLegend();

