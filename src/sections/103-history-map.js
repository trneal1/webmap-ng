// ===== HISTORY MAP =====
function getSelectedHistoryMapEventTitles(){
    const select=Webmap.services.dom.maybeById('historyMapEventTypes');
    if(!select) return [];
    return [...select.selectedOptions].map(option=>option.value);
}

function setHistoryMapStatus(message){
    const status=Webmap.services.dom.maybeById('historyMapStatus');
    if(status) status.textContent=message;
    if(historyMapPanelStatus) historyMapPanelStatus.textContent=message;
}

function populateHistoryMapEventTypeOptions(titleCounts=null){
    const select=Webmap.services.dom.maybeById('historyMapEventTypes');
    if(!select) return;
    if(!(titleCounts instanceof Map)){
        titleCounts=historyMapCache.titleCounts instanceof Map
            ? historyMapCache.titleCounts
            : getHistoryMapTitleCountsFromFrames(historyMapCache.frames || []);
    }

    const currentSelection=new Set(getSelectedHistoryMapEventTitles());
    const hadOptions=select.options.length;
    const allExistingSelected=hadOptions > 0 && currentSelection.size === hadOptions;
    const titles=[...titleCounts.keys()].sort((a,b)=>a.localeCompare(b));

    select.innerHTML=titles.map(title=>{
        const selected=currentSelection.size ? currentSelection.has(title) || allExistingSelected : false;
        const count=titleCounts.get(title) || 0;
        return `<option value="${escapeHtml(title)}" ${selected ? "selected" : ""}>${escapeHtml(title)} (${count})</option>`;
    }).join("");
}

function getHistoryMapColor(count){
    if(count <= 0) return "#f7f7f7";
    const ratio=historyMapMaxCount ? count / historyMapMaxCount : 0;
    if(ratio >= 0.85) return "#7f0000";
    if(ratio >= 0.65) return "#b30000";
    if(ratio >= 0.45) return "#e34a33";
    if(ratio >= 0.25) return "#fc8d59";
    if(ratio >= 0.1) return "#fdbb84";
    return "#fee8c8";
}

function getHistoryMapFeatureStyle(f){
    const fips=getFips(f);
    const count=historyMapCountyCounts[fips] || 0;
    if(!count){
        return {fillOpacity:0.05,color:"#000",weight:0.4};
    }
    return {
        fillColor:getHistoryMapColor(count),
        fillOpacity:Math.max(0.35, countyOpacityValue),
        color:"#000",
        weight:0.4
    };
}

function getHistoryMapCacheFramesInRange(){
    const range=getHistoryMapRange();
    return getCachedHistoryMapFrames().frames.filter(frame=>frame.timestamp >= range.start && frame.timestamp <= range.stop);
}

function getHistoryMapRange(){
    const start=parseDateTimeLocal(historyMapStart.value);
    const stop=parseDateTimeLocal(historyMapStop.value);
    const lo=Number.isFinite(start) ? start : -Infinity;
    const hi=Number.isFinite(stop) ? stop : Infinity;
    return lo <= hi ? { start:lo, stop:hi } : { start:hi, stop:lo };
}

function getHistoryMapSelectionState(){
    const selectedTitles=new Set(getSelectedHistoryMapEventTitles());
    const optionCount=Webmap.services.dom.maybeById('historyMapEventTypes')?.options.length || 0;
    return { selectedTitles, optionCount };
}

function historyMapAlertMatchesSelection(alert,selection=getHistoryMapSelectionState()){
    const title=alert?.event || "Untitled";
    if(selection.optionCount && !selection.selectedTitles.size) return false;
    if(selection.selectedTitles.size && !selection.selectedTitles.has(title)) return false;
    return true;
}

function getHistoryMapAlertId(alert){
    const title=alert?.event || "Untitled";
    return alert?.id || [title,alert?.sent,alert?.expires,alert?.headline].join("|");
}

function getHistoryMapSidebarCacheKey(fips,selection=getHistoryMapSelectionState()){
    const range=getHistoryMapRange();
    const titles=[...selection.selectedTitles].sort().join("|");
    return [
        fips,
        Number.isFinite(range.start) ? range.start : "start",
        Number.isFinite(range.stop) ? range.stop : "stop",
        selection.optionCount,
        titles
    ].join("::");
}

function getHistoryMapCountyFrameCandidates(fips,selection=getHistoryMapSelectionState()){
    const frames=getHistoryMapCacheFramesInRange();
    const candidates=[];
    const seenIds=new Set();
    frames.forEach(frame=>{
        const alerts=frame.countyAlerts?.[fips] || [];
        if(!Array.isArray(alerts) || !alerts.length) return;

        const ids=new Set();
        alerts.forEach(alert=>{
            if(!historyMapAlertMatchesSelection(alert,selection)) return;
            const id=getHistoryMapAlertId(alert);
            if(seenIds.has(id)) return;
            seenIds.add(id);
            ids.add(id);
        });

        if(ids.size){
            candidates.push({ timestamp:frame.timestamp, ids });
        }
    });
    return candidates;
}

function cacheHistoryMapSidebarHtml(key,html){
    historyMapSidebarCache.set(key,html);
    if(historyMapSidebarCache.size > HISTORY_MAP_SIDEBAR_CACHE_LIMIT){
        historyMapSidebarCache.delete(historyMapSidebarCache.keys().next().value);
    }
}

function suppressLiveAlertDisplayForHistoryMap(){
    if(!historyMapSuppressedLiveState){
        historyMapSuppressedLiveState={
            radarEnabled:radarToggle.checked,
            countyColorizationMode
        };
    }

    radarToggle.checked=false;
    if(radarLayer){
        map.removeLayer(radarLayer);
        radarLayer=null;
    }
    countyColorizationMode=0;
}

function restoreLiveAlertDisplayAfterHistoryMap(){
    if(!historyMapSuppressedLiveState) return;

    const previousState=historyMapSuppressedLiveState;
    historyMapSuppressedLiveState=null;
    countyColorizationMode=previousState.countyColorizationMode;
    radarToggle.checked=previousState.radarEnabled;

    if(previousState.radarEnabled && !historyModeActive){
        reloadRadar();
    } else if(radarLayer){
        map.removeLayer(radarLayer);
        radarLayer=null;
    }
}

function updateHistoryMapBadges(){
    if(!historyMapActive) return;
    historyModeBadge.textContent="History Map";
    historyTimeBadge.textContent=historyMapRangeLabel || "Alert counts";
}

function startHistoryMapBackgroundLoad(){
    if(historyMapCacheLoading) return historyMapCacheLoadPromise;
    historyMapCacheLoading=true;
    historyMapCacheLoadPromise=startPlotHistoryBackgroundLoad().then(()=>{
        historyMapReady=historyMapReady || historyMapCache.frames.length > 0;
        populateHistoryMapEventTypeOptions(historyMapCache.titleCounts);
        return historyMapCache;
    }).finally(()=>{
        historyMapCacheLoading=false;
    });
    return historyMapCacheLoadPromise;
}

function setHistoryMapRangeDefaultsFromCache(){
    const frames=getCachedHistoryMapFrames().frames;
    if(!frames.length) return;
    if(!historyMapStart.value) historyMapStart.value=formatDateTimeLocal(frames[0].timestamp);
    if(!historyMapStop.value) historyMapStop.value=formatDateTimeLocal(frames[frames.length - 1].timestamp);
}

function clearHistoryMapQuickRange(){
    if(historyMapQuickRange) historyMapQuickRange.value="";
}

async function setHistoryMapQuickRange(hoursValue,options={}){
    const { apply=true }=options;
    const hours=Number(hoursValue);
    if(!Number.isFinite(hours) || hours <= 0) return false;

    let frames=getCachedHistoryMapFrames().frames;
    if(!frames.length || historyMapCacheLoading){
        setHistoryMapStatus("Reading saved history...");
        await startHistoryMapBackgroundLoad();
        frames=getCachedHistoryMapFrames().frames;
    }
    if(!frames.length){
        setHistoryMapStatus("No saved history frames.");
        return false;
    }

    const stop=frames[frames.length - 1].timestamp;
    historyMapStop.value=formatDateTimeLocal(stop);
    historyMapStart.value=formatDateTimeLocal(stop - hours * 60 * 60 * 1000);
    if(apply) applyHistoryMapFromControls();
    return true;
}

async function applyHistoryMapFromControls(){
    if(historyMapLoading){
        if(!historyMapPanel.classList.contains('open')){
            historyMapPanelController.open();
        }
        setHistoryMapStatus("Building history map...");
        return;
    }
    const loadToken=++historyMapLoadToken;
    historyMapLoading=true;
    setHistoryMapStatus("Building history map...");

    try{
        if(!historyMapPanel.classList.contains('open')){
            historyMapPanelController.open();
        }
        document.body.classList.add('history-active');
        suppressLiveAlertDisplayForHistoryMap();
        historyMapActive=true;
        historyModeActive=true;
        historyFrameTimestamp=null;
        disableLiveOnlyOverlays();
        historyModeBadge.textContent="History Map";
        historyTimeBadge.textContent="Preparing alert counts";
        redrawMap();

        if(!historyMapReady && !historyMapCache.frames.length){
            setHistoryMapStatus("Indexing saved history in the background...");
            startHistoryMapBackgroundLoad().then(()=>{
                if(historyMapActive) applyHistoryMapFromControls();
            });
            return;
        }

        setHistoryMapRangeDefaultsFromCache();
        populateHistoryMapEventTypeOptions(historyMapCache.titleCounts);
        const selection=getHistoryMapSelectionState();
        historyMapSidebarCache.clear();
        const frames=getHistoryMapCacheFramesInRange();
        if(!frames.length){
            setHistoryMapStatus("No frames in the selected time frame.");
            historyMapLoading=false;
            return;
        }

        const countyAlertIds={};
        const countyEvents={};
        const countyAlerts={};

        for(const frame of frames){
            if(loadToken !== historyMapLoadToken) return;
            Object.entries(frame.countyAlerts || {}).forEach(([fips,alerts])=>{
                if(!Array.isArray(alerts)) return;
                alerts.forEach(alert=>{
                    const title=alert?.event || "Untitled";
                    if(!historyMapAlertMatchesSelection(alert,selection)) return;
                    const id=alert.id || [title,alert.sent,alert.expires,alert.headline].join("|");
                    if(!countyAlertIds[fips]) countyAlertIds[fips]=new Set();
                    if(countyAlertIds[fips].has(id)) return;
                    countyAlertIds[fips].add(id);
                    if(!countyEvents[fips]) countyEvents[fips]={};
                    countyEvents[fips][title]=(countyEvents[fips][title] || 0) + 1;
                    if(!countyAlerts[fips]) countyAlerts[fips]=[];
                    countyAlerts[fips].push(alert);
                });
            });
        }

        historyMapCountyCounts={};
        Object.entries(countyAlertIds).forEach(([fips,ids])=>{
            historyMapCountyCounts[fips]=ids.size;
        });
        historyMapCountyEvents=countyEvents;
        historyMapCountyAlerts=countyAlerts;
        historyMapMaxCount=Math.max(0,...Object.values(historyMapCountyCounts));
        historyMapFrameCount=frames.length;
        historyMapActive=true;
        historyModeActive=true;
        historyFrameTimestamp=null;
        historyMapRangeLabel=new Date(frames[0].timestamp).toLocaleString() + " - " + new Date(frames[frames.length - 1].timestamp).toLocaleString();
        document.body.classList.add('history-active');
        suppressLiveAlertDisplayForHistoryMap();
        disableLiveOnlyOverlays();
        updateHistoryMapBadges();
        redrawMap();
        refreshEventFilterListIfOpen();
        if(currentSidebarSelection){
            showSidebar(
                currentSidebarSelection.fips,
                currentSidebarSelection.name,
                currentSidebarSelection.feature,
                false,
                currentSidebarSelection.focusAlertId
            );
        }

        const typeLabel=selection.selectedTitles.size
            ? selection.selectedTitles.size + " selected type" + (selection.selectedTitles.size === 1 ? "" : "s")
            : selection.optionCount
                ? "no selected types"
                : "all types";
        setHistoryMapStatus(historyMapMaxCount
            ? historyMapFrameCount + " frames, " + Object.keys(historyMapCountyCounts).length + " counties, max " + historyMapMaxCount + " alerts, " + typeLabel + "."
            : historyMapFrameCount + " frames, no matching alerts, " + typeLabel + "."
        );
    }catch(error){
        console.warn("Unable to build history map",error);
        setHistoryMapStatus("Unable to build history map.");
    }finally{
        if(loadToken === historyMapLoadToken) historyMapLoading=false;
    }
}

function selectAllHistoryMapEventTypes(){
    Webmap.services.dom.all('#historyMapEventTypes option').forEach(option=>option.selected=true);
    applyHistoryMapFromControls();
}

function clearHistoryMapEventTypes(){
    Webmap.services.dom.all('#historyMapEventTypes option').forEach(option=>option.selected=false);
    applyHistoryMapFromControls();
}

async function openHistoryMapPanel(){
    historyMapPanelController.open();
    suppressLiveAlertDisplayForHistoryMap();
    redrawMap();
    populateHistoryMapEventTypeOptions(historyMapCache.titleCounts);
    const quickRangeValue=historyMapQuickRange?.value || "";
    if(quickRangeValue){
        const updated=await setHistoryMapQuickRange(quickRangeValue,{ apply:false });
        if(updated) clearHistoryMapEventTypes();
        return;
    }
    setHistoryMapRangeDefaultsFromCache();
    clearHistoryMapEventTypes();
}

function closeHistoryMapPanel(){
    historyMapPanelController.close();
}

function minimizeHistoryMapPanel(){
    historyMapPanelController.minimize();
}

function restoreHistoryMapPanel(){
    historyMapPanelController.restore();
}

function exitHistoryMapMode(){
    if(!historyMapActive && !historyMapSuppressedLiveState) return;
    historyMapLoadToken++;
    historyMapActive=false;
    historyMapLoading=false;
    historyMapCountyCounts={};
    historyMapCountyEvents={};
    historyMapCountyAlerts={};
    historyMapSidebarCache.clear();
    historyMapMaxCount=0;
    historyMapFrameCount=0;
    historyMapRangeLabel="";
    setHistoryMapStatus("History map off.");
    document.body.classList.remove('history-active');
    historyModeActive=false;
    historyFrameTimestamp=null;
    rawData=liveRawData;
    restoreLiveAlertDisplayAfterHistoryMap();
    refreshEventFilterListIfOpen();
    redrawMap();
    if(currentSidebarSelection){
        showSidebar(
            currentSidebarSelection.fips,
            currentSidebarSelection.name,
            currentSidebarSelection.feature,
            false,
            currentSidebarSelection.focusAlertId
        );
    }
}

async function toggleHistoryMapMode(){
    if(historyMapPanel.classList.contains('open') && historyMapPanel.classList.contains('minimized')){
        restoreHistoryMapPanel();
    } else if(historyMapPanel.classList.contains('open')){
        closeHistoryMapPanel();
    } else {
        openHistoryMapPanel();
    }
}
