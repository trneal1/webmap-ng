// ===== HISTORY PANEL =====
function updateHistoryClearProgress(percent,message,visible=true){
    const progress=Webmap.services.dom.maybeById('historyClearProgress');
    const bar=Webmap.services.dom.maybeById('historyClearProgressBar');
    const text=Webmap.services.dom.maybeById('historyClearProgressText');
    if(!progress || !bar || !text) return;

    progress.classList.toggle('visible',visible);
    bar.style.width=Math.min(Math.max(Math.round(percent),0),100) + "%";
    text.textContent=message;
}

async function clearHistorySnapshots(){
    stopHistoryPlayback();
    const clearButton=Webmap.services.dom.maybeById('clearHistoryButton');
    try{
        historyClearGeneration++;
        if(clearButton) clearButton.disabled=true;
        updateHistoryClearProgress(5,"Starting clear...");
        Webmap.services.dom.maybeById('historyStatus').textContent="Clearing...";
        historyTime.textContent="Clearing saved history...";
        await nextPaint();
        await withHistoryStores([HISTORY_STORE_NAME,RADAR_TILE_STORE_NAME,HISTORY_ALERT_HASH_STORE_NAME,COUNTY_HISTORY_STORE_NAME],"readwrite",(stores)=>{
            stores[HISTORY_STORE_NAME].clear();
            stores[RADAR_TILE_STORE_NAME].clear();
            stores[HISTORY_ALERT_HASH_STORE_NAME].clear();
            stores[COUNTY_HISTORY_STORE_NAME].clear();
        });
        updateHistoryClearProgress(45,"Saved history deleted");
        await nextPaint();
        historyFrames=[];
        historyFrameCache.clear();
        historyAlertHashIndex=null;
        historyAlertHashIndexLoadPromise=null;
        historyIndexCache=[];
        historyIndexReady=true;
        historyIndexLoading=false;
        historyIndexLoadPromise=null;
        plotHistoryCache={ frames:[], titleCounts:new Map() };
        plotHistoryReady=true;
        plotHistoryLoading=false;
        plotHistoryLoadPromise=null;
        historyMapCache={ frames:[], titleCounts:new Map() };
        historyMapReady=true;
        historyMapCacheLoading=false;
        historyMapCacheLoadPromise=null;
        countyHistoryBackfillReady=true;
        countyHistoryBackfillLoading=false;
        countyHistoryBackfillLoadPromise=null;
        historyFrameLoadToken++;
        historyFrameTimestamp=null;
        restoreLiveAlertDisplayAfterHistoryMap();
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
        historyStart.value="";
        historyStop.value="";
        updateHistoryClearProgress(75,"Memory caches reset");
        await nextPaint();
        updateHistoryPanelState();
        populateHistoryMapEventTypeOptions(new Map());
        setStartupTaskProgress("history",100);
        setStartupStatus("history","History: 0 frames","done");
        setStartupStatus("alertRefs","Alert refs: 0 hashes","done");
        setStartupTaskProgress("plot",100);
        setStartupStatus("plot","Plot cache: 0 frames","done");
        setStartupTaskProgress("historyMap",100);
        setStartupStatus("historyMap","History map: 0 frames","done");
        setHistoryMapStatus("History cleared.");
        if(historyModeActive){
            rawData=liveRawData;
            refreshEventFilterListIfOpen();
            reloadRadar();
            redrawMap();
        }
        updateHistoryClearProgress(100,"History cleared");
        setTimeout(()=>updateHistoryClearProgress(0,"Ready",false),1200);
    }catch(error){
        updateHistoryClearProgress(100,"Unable to clear history");
        console.warn("Unable to clear history snapshots",error);
    }finally{
        if(clearButton) clearButton.disabled=false;
    }
}

function getHistoryFrameRange(){
    const start=parseDateTimeLocal(historyStart.value);
    const stop=parseDateTimeLocal(historyStop.value);
    const lo=Number.isFinite(start) ? start : -Infinity;
    const hi=Number.isFinite(stop) ? stop : Infinity;
    return lo <= hi ? { start:lo, stop:hi } : { start:hi, stop:lo };
}

function findNearestHistoryIndex(timestamp,preferEnd=false){
    if(!historyFrames.length) return 0;
    let best=preferEnd ? historyFrames.length - 1 : 0;
    let bestDelta=Infinity;
    historyFrames.forEach((frame,index)=>{
        const delta=Math.abs(frame.timestamp - timestamp);
        if(delta < bestDelta){
            best=index;
            bestDelta=delta;
        }
    });
    return best;
}

function getBoundedHistoryIndex(direction){
    if(!historyFrames.length) return 0;
    const range=getHistoryFrameRange();
    const sliderIndex=Number(historySlider.value) || 0;
    let index=sliderIndex;

    if(historyFrames[index]?.timestamp < range.start){
        index=findNearestHistoryIndex(range.start);
    }
    if(historyFrames[index]?.timestamp > range.stop){
        index=findNearestHistoryIndex(range.stop,true);
    }

    while(historyFrames[index] && (historyFrames[index].timestamp < range.start || historyFrames[index].timestamp > range.stop)){
        index+=direction;
        if(index < 0 || index >= historyFrames.length) break;
    }
    return Math.min(Math.max(index,0),historyFrames.length - 1);
}

function updateHistoryPanelState(){
    const slider=Webmap.services.dom.maybeById('historySlider');
    const status=Webmap.services.dom.maybeById('historyStatus');
    slider.max=Math.max(0,historyFrames.length - 1);
    status.textContent=historyPanelLoading ? "Loading..." : historyFrames.length + (historyFrames.length === 1 ? " frame" : " frames");

    if(!historyFrames.length){
        slider.value=0;
        historyTimeBadge.textContent="No history loaded";
        historyTime.textContent=historyPanelLoading ? "Loading history..." : "No history loaded";
        return;
    }

    const first=historyFrames[0].timestamp;
    const last=historyFrames[historyFrames.length - 1].timestamp;
    if(!historyStart.value) historyStart.value=formatDateTimeLocal(first);
    if(!historyStop.value) historyStop.value=formatDateTimeLocal(last);
}

function applyHistoryRadar(frame){
    try{
        if(radarLayer) map.removeLayer(radarLayer);
        radarLayer=null;
        if(!radarToggle.checked || !frame?.radar?.enabled) return;

        radarLayer=createHistoryRadarLayer(frame.radar.wmsTime || formatWmsTime(frame.radar.timestamp || frame.timestamp));
        radarLayer.setOpacity(frame.radar.opacity ?? Number(radarOpacity.value) / 100);
        radarLayer.addTo(map);
        radarLayer.bringToFront();
    }catch(error){
        console.warn("Unable to apply history radar",error);
        radarLayer=null;
    }
}

function getCurrentHistoryFrameMetadata(){
    if(!historyFrames.length) return null;
    return historyFrames[Number(historySlider.value) || 0] || null;
}

function getHistoryFramesPerStep(){
    return Math.min(Math.max(Number(historyFramesPerStep.value) || 1,1),1440);
}

function getHistoryStepsPerMinute(){
    return Math.min(Math.max(Number(historyStepsPerMinute.value) || 60,1),600);
}

function isHistoryPlaybackRunning(){
    return historyPlaybackActive;
}

function refreshEventFilterListIfOpen(){
    if(Webmap.services.dom.maybeById('eventFilterOverlay').classList.contains('open')){
        renderEventFilterList();
        refreshEventCountyPanelIfOpen();
        refreshEventAlertPanelIfOpen();
    }
}

async function showHistoryFrame(index,options={}){
    if(!historyFrames.length) return;
    try{
        const { stopPlayback=true, updateRadar=true }=options;
        if(stopPlayback) stopHistoryPlayback(false,false);
        disableLiveOnlyOverlays();

        index=Math.min(Math.max(index,0),historyFrames.length - 1);
        const metadata=historyFrames[index];
        if(!metadata) return;
        const loadToken=++historyFrameLoadToken;

        historySlider.value=index;
        historyModeBadge.textContent="History";
        historyTimeBadge.textContent=new Date(metadata.timestamp).toLocaleString();
        historyTime.textContent=(metadata.alertCount ?? 0) + " alerts in the U.S. archive";

        const frame=await loadHistoryFrame(metadata.timestamp);
        if(loadToken !== historyFrameLoadToken || !frame || !frame.alerts) return;

        if(historyMapActive){
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
            restoreLiveAlertDisplayAfterHistoryMap();
        }
        historyModeActive=true;
        historyFrameTimestamp=frame.timestamp;
        rawData=cloneJson(frame.alerts || {});
        if(updateRadar) applyHistoryRadar(frame);
        if(!isHistoryPlaybackRunning()) refreshEventFilterListIfOpen();
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
    }catch(error){
        console.warn("Unable to show history frame",error);
    }
}

async function moveHistoryBy(frameDelta,options={}){
    if(!historyFrames.length) return;
    const { updateRadar=true, stopPlayback=true }=options;
    if(stopPlayback) stopHistoryPlayback(false,false);

    const range=getHistoryFrameRange();
    const currentIndex=Number(historySlider.value) || 0;
    let next=currentIndex + frameDelta;

    if(next < 0 || next >= historyFrames.length){
        const direction=frameDelta >= 0 ? 1 : -1;
        next=direction > 0 ? findNearestHistoryIndex(range.stop,true) : findNearestHistoryIndex(range.start);
    } else {
        const nextFrame=historyFrames[next];
        if(nextFrame.timestamp < range.start){
            next=findNearestHistoryIndex(range.start);
        } else if(nextFrame.timestamp > range.stop){
            next=findNearestHistoryIndex(range.stop,true);
        }
    }

    await showHistoryFrame(next,{ stopPlayback:false, updateRadar });
}

function getTornadoWarningCountySet(frame){
    if(frame?.tornadoWarningCounties){
        return new Set(frame.tornadoWarningCounties);
    }

    const counties=new Set();
    Object.entries(frame?.alerts || {}).forEach(([fips,alerts])=>{
        if(alerts.some(alert=>getPriorityCategory(alert.event) === "tornado-warning")){
            counties.add(fips);
        }
    });
    return counties;
}

function hasNewTornadoWarningCounty(candidateCounties,currentCounties){
    for(const fips of candidateCounties){
        if(!currentCounties.has(fips)) return true;
    }
    return false;
}

async function searchNextTornadoWarningFrame(){
    if(!historyFrames.length) return;
    stopHistoryPlayback(false,false);

    const range=getHistoryFrameRange();
    const currentIndex=Number(historySlider.value) || 0;
    const currentFrame=historyFrames[currentIndex];
    const currentCounties=getTornadoWarningCountySet(currentFrame);
    const needsNewCounty=currentCounties.size > 0;
    let startIndex=currentIndex + 1;

    if(currentFrame?.timestamp < range.start){
        startIndex=findNearestHistoryIndex(range.start);
    }

    for(let index=startIndex;index<historyFrames.length;index++){
        const frame=historyFrames[index];
        if(frame.timestamp < range.start) continue;
        if(frame.timestamp > range.stop) break;

        const candidateCounties=getTornadoWarningCountySet(frame);
        if(!candidateCounties.size) continue;
        if(needsNewCounty && !hasNewTornadoWarningCounty(candidateCounties,currentCounties)) continue;

        await showHistoryFrame(index);
        return;
    }
}

function scheduleHistoryPlayback(playbackToken=historyPlaybackToken){
    const stepsPerMinute=getHistoryStepsPerMinute();
    historyPlaybackTimer=setTimeout(()=>{
        historyPlaybackTimer=null;
        if(playbackToken !== historyPlaybackToken) return;
        stepHistoryPlayback(playbackToken).catch(error=>{
            console.warn("Unable to step history playback",error);
            stopHistoryPlayback();
        });
    },60000 / stepsPerMinute);
}

async function stepHistoryPlayback(playbackToken=historyPlaybackToken){
    if(playbackToken !== historyPlaybackToken) return;
    if(!historyFrames.length) return;

    const range=getHistoryFrameRange();
    const framesPerStep=getHistoryFramesPerStep();
    let next=(Number(historySlider.value) || 0) + (historyPlaybackDirection * framesPerStep);
    if(next < 0 || next >= historyFrames.length){
        stopHistoryPlayback();
        return;
    }

    const nextFrame=historyFrames[next];
    if(!nextFrame || nextFrame.timestamp < range.start || nextFrame.timestamp > range.stop){
        stopHistoryPlayback();
        return;
    }

    await showHistoryFrame(next,{ stopPlayback:false, updateRadar:false });
    if(playbackToken !== historyPlaybackToken) return;
    scheduleHistoryPlayback(playbackToken);
}

async function playHistory(direction=1){
    if(!historyFrames.length) return;
    stopHistoryPlayback(false,false);
    historyPlaybackDirection=direction;
    historyPlaybackActive=true;
    const playbackToken=++historyPlaybackToken;

    const startIndex=getBoundedHistoryIndex(direction);
    await showHistoryFrame(startIndex,{ stopPlayback:false, updateRadar:false });
    if(playbackToken !== historyPlaybackToken) return;
    if(radarLayer) map.removeLayer(radarLayer);
    radarLayer=null;

    scheduleHistoryPlayback(playbackToken);
}

function stopHistoryPlayback(resetDirection=true,updateRadarOnStop=true){
    const wasPlaying=historyPlaybackActive;
    historyPlaybackActive=false;
    historyPlaybackToken++;
    if(historyPlaybackTimer){
        clearTimeout(historyPlaybackTimer);
        historyPlaybackTimer=null;
    }
    if(resetDirection) historyPlaybackDirection=1;
    if(wasPlaying && updateRadarOnStop && historyFrames.length){
        const metadata=getCurrentHistoryFrameMetadata();
        if(metadata) applyHistoryRadar(metadata);
        redrawMap();
        refreshEventFilterListIfOpen();
    }
}

async function rewindHistory(){
    stopHistoryPlayback();
    if(!historyFrames.length) return;
    await showHistoryFrame(findNearestHistoryIndex(getHistoryFrameRange().start));
}

async function fastForwardHistory(){
    stopHistoryPlayback();
    if(!historyFrames.length) return;
    await showHistoryFrame(findNearestHistoryIndex(getHistoryFrameRange().stop,true));
}

function syncHistoryRangeInputs(){
    if(!historyFrames.length) return;
    const index=getBoundedHistoryIndex(historyPlaybackDirection);
    historySlider.value=index;
}

function shouldAutoExtendHistoryStop(previousLatestTimestamp){
    if(!historyStop.value) return true;
    return Number.isFinite(previousLatestTimestamp) && historyStop.value === formatDateTimeLocal(previousLatestTimestamp);
}

async function reloadHistoryPanel(){
    if(historyPanelLoading) return;
    if(!historyFrames.length){
        await openHistoryPanel();
        return;
    }

    const loadToken=++historyLoadToken;
    const previousFrameCount=historyFrames.length;
    const previousLatestTimestamp=historyFrames[historyFrames.length - 1]?.timestamp;
    const shouldExtendStop=shouldAutoExtendHistoryStop(previousLatestTimestamp);
    const wasAtLatest=(Number(historySlider.value) || 0) === historyFrames.length - 1;

    stopHistoryPlayback();
    historyPanelLoading=true;
    updateHistoryPanelState();
    Webmap.services.dom.maybeById('historyStatus').textContent="Updating...";
    await nextPaint();

    try{
        const loadedFrames=await loadHistorySnapshotsFromDb(previousLatestTimestamp);
        if(loadToken !== historyLoadToken) return;

        historyFrames=normalizeHistoryFrames([...historyFrames,...loadedFrames]);
        if(loadedFrames.length){
            mergeHistoryIndexFrames(loadedFrames);
            historyIndexReady=true;
        }
        historyPanelLoading=false;
        if(shouldExtendStop && historyFrames.length){
            historyStop.value=formatDateTimeLocal(historyFrames[historyFrames.length - 1].timestamp);
        }
        updateHistoryPanelState();

        const addedFrameCount=historyFrames.length - previousFrameCount;
        if(addedFrameCount && wasAtLatest){
            await showHistoryFrame(historyFrames.length - 1);
        } else if(!addedFrameCount){
            Webmap.services.dom.maybeById('historyStatus').textContent=historyFrames.length + (historyFrames.length === 1 ? " frame" : " frames") + ", no new";
        }
    }catch(error){
        if(loadToken !== historyLoadToken) return;
        historyPanelLoading=false;
        updateHistoryPanelState();
        console.warn("Unable to update history panel",error);
    }
}

async function openHistoryPanel(){
    if(historyPanelLoading) return;
    if(historyPanel.classList.contains('open') && historyPanel.classList.contains('minimized')){
        restoreHistoryPanel();
        return;
    }
    ++historyLoadToken;
    stopHistoryPlayback();
    disableLiveOnlyOverlays();
    historyModeActive=true;
    document.body.classList.add('history-active');
    historyPanelController.open();
    populateHistoryMapEventTypeOptions();

    const cachedFrames=getCachedHistorySnapshots();
    if(cachedFrames.length){
        historyFrames=cachedFrames;
        historyPanelLoading=false;
        updateHistoryPanelState();
        if(historyFrames.length){
            await showHistoryFrame(historyFrames.length - 1);
        }
        startHistoryIndexBackgroundLoad();
        return;
    }

    historyFrames=[];
    historyStart.value="";
    historyStop.value="";
    if(historyIndexLoading){
        historyPanelLoading=false;
        updateHistoryPanelState();
        Webmap.services.dom.maybeById('historyStatus').textContent="Indexing...";
        historyTime.textContent="History indexing in background...";
        startHistoryIndexBackgroundLoad();
        return;
    }

    historyPanelLoading=false;
    updateHistoryPanelState();
    startHistoryIndexBackgroundLoad();
}

function closeHistoryPanel(){
    historyPanelController.close();
}

function minimizeHistoryPanel(){
    historyPanelController.minimize();
}

function restoreHistoryPanel(){
    if(!historyPanel.classList.contains('open')){
        openHistoryPanel();
        return;
    }
    historyPanelController.restore();
}
