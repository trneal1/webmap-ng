// ===== HISTORY STORE =====
function openHistoryDb(){
    return new Promise((resolve,reject)=>{
        const request=indexedDB.open(HISTORY_DB_NAME,HISTORY_DB_VERSION);
        request.onupgradeneeded=(event)=>{
            const db=request.result;
            if(!db.objectStoreNames.contains(HISTORY_STORE_NAME)){
                db.createObjectStore(HISTORY_STORE_NAME,{ keyPath:"timestamp" });
            }
            let radarTileStore;
            if(!db.objectStoreNames.contains(RADAR_TILE_STORE_NAME)){
                radarTileStore=db.createObjectStore(RADAR_TILE_STORE_NAME,{ keyPath:"id" });
            } else {
                radarTileStore=request.transaction.objectStore(RADAR_TILE_STORE_NAME);
            }
            if(!radarTileStore.indexNames.contains("timestamp")){
                radarTileStore.createIndex("timestamp","timestamp");
            }
            let alertHashStore;
            if(!db.objectStoreNames.contains(HISTORY_ALERT_HASH_STORE_NAME)){
                alertHashStore=db.createObjectStore(HISTORY_ALERT_HASH_STORE_NAME,{ keyPath:"hash" });
            } else {
                alertHashStore=request.transaction.objectStore(HISTORY_ALERT_HASH_STORE_NAME);
            }
            if(!alertHashStore.indexNames.contains("latestTimestamp")){
                alertHashStore.createIndex("latestTimestamp","latestTimestamp");
            }
            if(event.oldVersion && event.oldVersion < 5){
                alertHashStore.clear();
            }
        };
        request.onsuccess=()=>resolve(request.result);
        request.onerror=()=>reject(request.error);
    });
}

async function withHistoryStore(mode,callback,storeName=HISTORY_STORE_NAME){
    const db=await openHistoryDb();
    return new Promise((resolve,reject)=>{
        const tx=db.transaction(storeName,mode);
        const store=tx.objectStore(storeName);
        const result=callback(store);
        tx.oncomplete=()=>{
            db.close();
            resolve(result);
        };
        tx.onerror=()=>{
            db.close();
            reject(tx.error);
        };
    });
}

async function withHistoryStores(storeNames,mode,callback){
    const db=await openHistoryDb();
    return new Promise((resolve,reject)=>{
        const tx=db.transaction(storeNames,mode);
        const stores={};
        storeNames.forEach(name=>{ stores[name]=tx.objectStore(name); });
        const result=callback(stores);
        tx.oncomplete=()=>{
            db.close();
            resolve(result);
        };
        tx.onerror=()=>{
            db.close();
            reject(tx.error);
        };
    });
}

function getRadarTileUrl(coords,timestamp){
    return Webmap.services.api.getRadarTileUrl(coords,timestamp);
}

function getRadarTileId(frameId,coords){
    return frameId + ":" + coords.z + ":" + coords.x + ":" + coords.y;
}

function getCurrentRadarTileCoords(){
    const zoom=Math.round(map.getZoom());
    const tileSize=256;
    const pixelBounds=map.getPixelBounds();
    const tileBounds=L.bounds(
        pixelBounds.min.divideBy(tileSize).floor(),
        pixelBounds.max.divideBy(tileSize).floor()
    );
    const coords=[];
    for(let x=tileBounds.min.x;x<=tileBounds.max.x;x++){
        for(let y=tileBounds.min.y;y<=tileBounds.max.y;y++){
            coords.push({ x, y, z:zoom });
        }
    }
    return coords;
}

async function storeRadarTilesForFrame(frameId,timestamp){
    if(!radarToggle.checked) return [];

    const coords=getCurrentRadarTileCoords();
    const tiles=[];
    await Promise.all(coords.map(async coord=>{
        try{
            const blob=await Webmap.services.api.fetchBlob(getRadarTileUrl(coord,timestamp),{ cache:"reload" });
            tiles.push({
                id:getRadarTileId(frameId,coord),
                frameId,
                timestamp,
                coord,
                blob,
                contentType:blob.type || "image/png"
            });
        }catch(error){
            console.warn("Unable to store radar tile",coord,error);
        }
    }));

    if(tiles.length){
        await withHistoryStore("readwrite",(store)=>{
            tiles.forEach(tile=>store.put(tile));
        },RADAR_TILE_STORE_NAME);
    }
    return coords;
}

async function pruneOldRadarTiles(cutoff){
    try{
        await withHistoryStore("readwrite",(store)=>{
            const request=store.index("timestamp").openCursor(IDBKeyRange.upperBound(cutoff));
            request.onsuccess=()=>{
                const cursor=request.result;
                if(!cursor) return;
                cursor.delete();
                cursor.continue();
            };
        },RADAR_TILE_STORE_NAME);
    }catch(error){
        console.warn("Unable to prune old radar tiles",error);
    }
}

async function pruneOldHistorySnapshots(){
    const cutoff=Date.now() - getHistoryRetentionMs();
    await withHistoryStore("readwrite",(store)=>{
        store.delete(IDBKeyRange.upperBound(cutoff));
    });
    await pruneOldRadarTiles(cutoff);
    await pruneStoredHistoryAlertHashIndex(cutoff);
    pruneHistoryAlertHashMemoryIndex(cutoff);
}

async function getStoredRadarTileBlob(frameId,coords){
    let blob=null;
    await withHistoryStore("readonly",(store)=>{
        const request=store.get(getRadarTileId(frameId,coords));
        request.onsuccess=()=>{
            blob=request.result?.blob || null;
        };
    },RADAR_TILE_STORE_NAME);
    return blob;
}

async function saveHistorySnapshot(alerts,timestamp=Date.now()){
    try{
        const clearGeneration=historyClearGeneration;
        const snapshot={
            timestamp,
            kind:"weather",
            scope:"US",
            alerts:cloneJson(alerts),
            view:{
                lat:map.getCenter().lat,
                lng:map.getCenter().lng,
                zoom:map.getZoom()
            },
            radar:{
                enabled:radarToggle.checked,
                opacity:Number(radarOpacity.value) / 100,
                timestamp:currentRadarTimestamp,
                wmsTime:formatWmsTime(currentRadarTimestamp),
                source:"IEM WMS-T"
            },
            mapType:mapTypeSelector.value
        };

        await withHistoryStore("readwrite",(store)=>{
            store.put(snapshot);
            store.delete(IDBKeyRange.upperBound(timestamp - getHistoryRetentionMs()));
        });
        if(clearGeneration !== historyClearGeneration){
            await withHistoryStore("readwrite",(store)=>{
                store.delete(timestamp);
            });
            return;
        }
        const cutoff=timestamp - getHistoryRetentionMs();
        try{
            await pruneStoredHistoryAlertHashIndex(cutoff);
            pruneHistoryAlertHashMemoryIndex(cutoff);
            await saveHistoryAlertHashFrameEntries(snapshot);
        }catch(indexError){
            console.warn("Unable to update alert hash index",indexError);
        }
        updateHistoryCachesWithSnapshot(snapshot);
    }catch(error){
        console.warn("Unable to save history snapshot",error);
    }
}

function createHistoryFrameMetadata(frame){
    const tornadoWarningCounties=[];
    Object.entries(frame.alerts || {}).forEach(([fips,alerts])=>{
        if(alerts.some(alert=>getPriorityCategory(alert.event) === "tornado-warning")){
            tornadoWarningCounties.push(fips);
        }
    });

    return {
        timestamp:frame.timestamp,
        kind:frame.kind || "weather",
        scope:frame.scope || "US",
        radar:frame.radar || null,
        mapType:frame.mapType || "",
        alertCount:getUniqueAlertCount(frame.alerts || {}),
        tornadoWarningCounties
    };
}

function cacheHistoryFrame(frame){
    historyFrameCache.set(frame.timestamp,frame);
    if(historyFrameCache.size > HISTORY_FRAME_CACHE_LIMIT){
        const oldestKey=historyFrameCache.keys().next().value;
        historyFrameCache.delete(oldestKey);
    }
}

function addHistoryFrameToAlertHashIndex(frame){
    if(!historyAlertHashIndex || !frame || !Number.isFinite(frame.timestamp)) return;

    Object.entries(frame.alerts || {}).forEach(([fips,alerts])=>{
        if(!Array.isArray(alerts)) return;
        alerts.forEach(alert=>{
            const id=alert?.id || getAlertCountId(alert);
            const hash=hashAlertId(id).toLowerCase();
            const existing=historyAlertHashIndex.get(hash);
            if(existing && existing.timestamp >= frame.timestamp) return;
            historyAlertHashIndex.set(hash,{ timestamp:frame.timestamp, fips, id });
        });
    });
}

function pruneHistoryAlertHashMemoryIndex(cutoff){
    if(!historyAlertHashIndex) return;
    for(const [hash,entry] of historyAlertHashIndex.entries()){
        if(!entry || !Number.isFinite(entry.timestamp) || entry.timestamp <= cutoff){
            historyAlertHashIndex.delete(hash);
        }
    }
}

function collectHistoryAlertHashEntries(frame){
    const entriesByHash=new Map();
    if(!frame || !Number.isFinite(frame.timestamp)) return entriesByHash;

    Object.entries(frame.alerts || {}).forEach(([fips,alerts])=>{
        if(!Array.isArray(alerts)) return;
        alerts.forEach(alert=>{
            const id=alert?.id || getAlertCountId(alert);
            const hash=hashAlertId(id).toLowerCase();
            if(!entriesByHash.has(hash)) entriesByHash.set(hash,[]);
            entriesByHash.get(hash).push({ timestamp:frame.timestamp, fips, id });
        });
    });

    return entriesByHash;
}

function getNewestHistoryAlertHashEntry(entries){
    return (Array.isArray(entries) ? entries : [])
        .filter(entry=>entry && Number.isFinite(entry.timestamp))
        .sort((a,b)=>b.timestamp-a.timestamp)[0] || null;
}

function normalizeHistoryAlertHashRecord(hash,entries,cutoff=Date.now() - getHistoryRetentionMs()){
    const seen=new Set();
    const normalized=(Array.isArray(entries) ? entries : [])
        .filter(entry=>entry && Number.isFinite(entry.timestamp) && entry.timestamp > cutoff)
        .filter(entry=>{
            const key=[entry.timestamp,entry.fips || "",entry.id || ""].join("|");
            if(seen.has(key)) return false;
            seen.add(key);
            return true;
        })
        .sort((a,b)=>b.timestamp-a.timestamp);
    const latest=getNewestHistoryAlertHashEntry(normalized);
    return {
        hash,
        entries:normalized,
        latestTimestamp:latest?.timestamp || 0
    };
}

async function buildHistoryAlertHashIndex(){
    const cutoff=Date.now() - getHistoryRetentionMs();
    const index=new Map();
    let latestIndexedTimestamp=-Infinity;

    await withHistoryStore("readwrite",(store)=>{
        const request=store.openCursor();
        request.onsuccess=()=>{
            const cursor=request.result;
            if(!cursor) return;

            const record=cursor.value || {};
            const hash=record.hash || cursor.key;
            const normalized=normalizeHistoryAlertHashRecord(hash,record.entries,cutoff);
            const latest=getNewestHistoryAlertHashEntry(normalized.entries);
            if(latest){
                index.set(normalized.hash,latest);
                latestIndexedTimestamp=Math.max(latestIndexedTimestamp,normalized.latestTimestamp);
                if(normalized.entries.length !== (record.entries || []).length ||
                   normalized.latestTimestamp !== record.latestTimestamp){
                    cursor.update(normalized);
                }
            } else {
                cursor.delete();
            }

            cursor.continue();
        };
    },HISTORY_ALERT_HASH_STORE_NAME);

    historyAlertHashIndex=index;
    await indexHistoryAlertHashesFromSnapshots(latestIndexedTimestamp);
    return historyAlertHashIndex;
}

async function pruneStoredHistoryAlertHashIndex(cutoff=Date.now() - getHistoryRetentionMs()){
    await withHistoryStore("readwrite",(store)=>{
        const request=store.openCursor();
        request.onsuccess=()=>{
            const cursor=request.result;
            if(!cursor) return;

            const record=cursor.value || {};
            const hash=record.hash || cursor.key;
            const normalized=normalizeHistoryAlertHashRecord(hash,record.entries,cutoff);
            if(normalized.entries.length){
                if(normalized.entries.length !== (record.entries || []).length ||
                   normalized.latestTimestamp !== record.latestTimestamp){
                    cursor.update(normalized);
                }
            } else {
                cursor.delete();
            }

            cursor.continue();
        };
    },HISTORY_ALERT_HASH_STORE_NAME);
}

async function saveHistoryAlertHashFrameEntries(frame){
    const entriesByHash=collectHistoryAlertHashEntries(frame);
    await saveHistoryAlertHashEntriesByHash(entriesByHash);
}

async function saveHistoryAlertHashEntriesByHash(entriesByHash){
    if(!entriesByHash.size) return;
    const cutoff=Date.now() - getHistoryRetentionMs();

    await withHistoryStore("readwrite",(store)=>{
        entriesByHash.forEach((entries,hash)=>{
            const request=store.get(hash);
            request.onsuccess=()=>{
                const existing=request.result;
                const record=normalizeHistoryAlertHashRecord(hash,[...(existing?.entries || []),...entries],cutoff);
                if(record.entries.length){
                    store.put(record);
                } else {
                    store.delete(hash);
                }
            };
        });
    },HISTORY_ALERT_HASH_STORE_NAME);
}

async function loadHistoryAlertHashIndexChunk(afterTimestamp,limit=300){
    const entriesByHash=new Map();
    let lastTimestamp=afterTimestamp;
    let count=0;
    let hasMore=false;

    await withHistoryStore("readonly",(store)=>{
        const range=Number.isFinite(afterTimestamp) ? IDBKeyRange.lowerBound(afterTimestamp + 1) : null;
        const request=store.openCursor(range);
        request.onsuccess=()=>{
            const cursor=request.result;
            if(!cursor) return;

            if(count >= limit){
                hasMore=true;
                return;
            }

            const frame=cursor.value;
            if(frame && Number.isFinite(frame.timestamp)){
                count++;
                lastTimestamp=frame.timestamp;
                addHistoryFrameToAlertHashIndex(frame);
                collectHistoryAlertHashEntries(frame).forEach((entries,hash)=>{
                    if(!entriesByHash.has(hash)) entriesByHash.set(hash,[]);
                    entriesByHash.get(hash).push(...entries);
                });
            }

            cursor.continue();
        };
    });

    return { entriesByHash, lastTimestamp, hasMore };
}

async function indexHistoryAlertHashesFromSnapshots(sinceTimestamp){
    let afterTimestamp=Number.isFinite(sinceTimestamp) ? sinceTimestamp : -Infinity;

    while(true){
        const chunk=await loadHistoryAlertHashIndexChunk(afterTimestamp);
        await saveHistoryAlertHashEntriesByHash(chunk.entriesByHash);
        if(!chunk.hasMore) break;
        afterTimestamp=chunk.lastTimestamp;
    }
}

async function getHistoryAlertHashIndex(){
    if(historyAlertHashIndex) return historyAlertHashIndex;
    if(historyAlertHashIndexLoadPromise) return historyAlertHashIndexLoadPromise;

    const clearGeneration=historyClearGeneration;
    historyAlertHashIndexLoadPromise=buildHistoryAlertHashIndex()
        .then(index=>{
            historyAlertHashIndex=clearGeneration === historyClearGeneration ? index : new Map();
            return historyAlertHashIndex;
        })
        .finally(()=>{
            historyAlertHashIndexLoadPromise=null;
        });

    return historyAlertHashIndexLoadPromise;
}

function mergeHistoryIndexFrames(frames){
    historyIndexCache=normalizeHistoryFrames([...historyIndexCache,...frames]);
    return historyIndexCache;
}

function getCachedHistorySnapshots(sinceTimestamp=null){
    const cutoff=Date.now() - getHistoryRetentionMs();
    return historyIndexCache.filter(frame=>{
        if(!frame || !Number.isFinite(frame.timestamp)) return false;
        if(frame.timestamp < cutoff) return false;
        if(Number.isFinite(sinceTimestamp) && frame.timestamp <= sinceTimestamp) return false;
        return true;
    });
}

function getCachedPlotHistoryFrames(sinceTimestamp=null){
    const cutoff=Date.now() - getHistoryRetentionMs();
    const frames=(plotHistoryCache.frames || []).filter(frame=>{
        if(!frame || !Number.isFinite(frame.timestamp)) return false;
        if(frame.timestamp < cutoff) return false;
        if(Number.isFinite(sinceTimestamp) && frame.timestamp <= sinceTimestamp) return false;
        return true;
    });
    return {
        frames,
        titleCounts:getPlotTitleCountsFromFrames(frames)
    };
}

function getAlertCountId(alert){
    const title=alert?.event || "Untitled";
    return alert?.id || [title,alert?.sent,alert?.expires,alert?.headline].join("|");
}

function getAlertTitleSummary(alertsByFips,options={}){
    const { displayableCountiesOnly=false }=options;
    const alertsByTitle={};
    const countiesByTitle={};

    Object.entries(alertsByFips || {}).forEach(([fips,countyAlerts])=>{
        if(displayableCountiesOnly && !isEventTitleDisplayableCounty(fips)) return;
        if(!Array.isArray(countyAlerts)) return;
        countyAlerts.forEach(alert=>{
            if(!alert || typeof alert !== "object") return;
            const title=alert.event || "Untitled";
            if(!alertsByTitle[title]) alertsByTitle[title]=new Set();
            if(!countiesByTitle[title]) countiesByTitle[title]=new Set();
            alertsByTitle[title].add(getAlertCountId(alert));
            countiesByTitle[title].add(fips);
        });
    });

    const alertTitleCounts={};
    const countyTitleCounts={};
    Object.keys(alertsByTitle).forEach(title=>{
        alertTitleCounts[title]=alertsByTitle[title].size;
        countyTitleCounts[title]=countiesByTitle[title]?.size || 0;
    });

    return { alertTitleCounts, countyTitleCounts };
}

function isEventTitleDisplayableCounty(fips){
    return !!countyFeatureByFips[fips];
}

function getEventTitleDisplayableCountyCounts(alertsByFips){
    const countiesByTitle={};

    Object.entries(alertsByFips || {}).forEach(([fips,countyAlerts])=>{
        if(!isEventTitleDisplayableCounty(fips) || !Array.isArray(countyAlerts)) return;
        countyAlerts.forEach(alert=>{
            if(!alert || typeof alert !== "object") return;
            const title=alert.event || "Untitled";
            if(!countiesByTitle[title]) countiesByTitle[title]=new Set();
            countiesByTitle[title].add(fips);
        });
    });

    return Object.fromEntries(
        Object.entries(countiesByTitle).map(([title,counties])=>[title,counties.size])
    );
}

function getUniqueAlertCount(alertsByFips){
    const ids=new Set();
    Object.values(alertsByFips || {}).forEach(countyAlerts=>{
        if(!Array.isArray(countyAlerts)) return;
        countyAlerts.forEach(alert=>{
            if(alert && typeof alert === "object") ids.add(getAlertCountId(alert));
        });
    });
    return ids.size;
}

async function refreshHistoryRetentionWindow(){
    if(historyIndexLoading || plotHistoryLoading){
        setTimeout(()=>{
            refreshHistoryRetentionWindow().catch(error=>{
                console.warn("Unable to refresh history retention window",error);
            });
        },250);
        return;
    }

    await pruneOldHistorySnapshots();
    historyFrameCache.clear();
    historyAlertHashIndex=null;
    historyAlertHashIndexLoadPromise=null;
    historyIndexCache=[];
    historyIndexReady=false;
    historyIndexLoadPromise=null;
    plotHistoryCache={ frames:[], titleCounts:new Map() };
    plotHistoryReady=false;
    plotHistoryLoadPromise=null;
    historyMapCache={ frames:[], titleCounts:new Map() };
    historyMapReady=false;
    historyMapCacheLoadPromise=null;

    const shouldRefreshOpenHistory=historyPanel.classList.contains('open');
    if(shouldRefreshOpenHistory){
        historyPanelLoading=true;
        historyFrames=[];
        historyStart.value="";
        historyStop.value="";
        updateHistoryPanelState();
        await nextPaint();
    }

    await startHistoryIndexBackgroundLoad();
    await startPlotHistoryBackgroundLoad();

    if(shouldRefreshOpenHistory){
        historyPanelLoading=false;
        historyFrames=getCachedHistorySnapshots();
        updateHistoryPanelState();
        if(historyFrames.length){
            await showHistoryFrame(historyFrames.length - 1);
        }
    }
    syncOpenPlotPanelFromCache();
}

function syncOpenHistoryPanelFromCache(){
    if(!historyPanel.classList.contains('open') || historyPanelLoading) return;
    const cachedFrames=getCachedHistorySnapshots();
    const previousLatestTimestamp=historyFrames[historyFrames.length - 1]?.timestamp;
    const shouldExtendStop=shouldAutoExtendHistoryStop(previousLatestTimestamp);
    const wasEmpty=!historyFrames.length;
    const wasAtLatest=wasEmpty || (Number(historySlider.value) || 0) === historyFrames.length - 1;

    historyFrames=cachedFrames;
    if(shouldExtendStop && historyFrames.length){
        historyStop.value=formatDateTimeLocal(historyFrames[historyFrames.length - 1].timestamp);
    }
    updateHistoryPanelState();
    if(wasAtLatest && historyFrames.length && historyFrames[historyFrames.length - 1].timestamp !== previousLatestTimestamp){
        showHistoryFrame(historyFrames.length - 1).catch(error=>{
            console.warn("Unable to show latest cached history frame",error);
        });
    }
}

function syncOpenPlotPanelFromCache(){
    if(!plotPanel.classList.contains('open') || plotPanelLoading || !plotHistoryReady) return;
    const previousLatestTimestamp=plotFrames[plotFrames.length - 1]?.timestamp;
    const shouldExtendStop=shouldAutoExtendPlotStop(previousLatestTimestamp);
    applyPlotHistory(getCachedPlotHistoryFrames(),shouldExtendStop);
    drawEventPlot();
}

function updateHistoryCachesWithSnapshot(snapshot){
    const metadata=createHistoryFrameMetadata(snapshot);
    mergeHistoryIndexFrames([metadata]);
    cacheHistoryFrame(snapshot);
    addHistoryFrameToAlertHashIndex(snapshot);

    const plotCounts=getHistoryFramePlotCounts(snapshot);
    plotHistoryCache.frames=normalizeHistoryFrames([
        ...(plotHistoryCache.frames || []),
        {
            timestamp:snapshot.timestamp,
            alertTitleCounts:plotCounts.alertTitleCounts,
            countyTitleCounts:plotCounts.countyTitleCounts
        }
    ]);
    plotHistoryCache.titleCounts=getPlotTitleCountsFromFrames(plotHistoryCache.frames);
    historyMapCache.frames=normalizeHistoryFrames([
        ...(historyMapCache.frames || []),
        getHistoryMapFrameFromSnapshot(snapshot)
    ]);
    historyMapCache.titleCounts=getHistoryMapTitleCountsFromFrames(historyMapCache.frames);
    historyMapReady=true;
    populateHistoryMapEventTypeOptions(historyMapCache.titleCounts);
    syncOpenHistoryPanelFromCache();
    syncOpenPlotPanelFromCache();
}

async function loadHistoryFrame(timestamp){
    if(historyFrameCache.has(timestamp)){
        const frame=historyFrameCache.get(timestamp);
        historyFrameCache.delete(timestamp);
        historyFrameCache.set(timestamp,frame);
        return frame;
    }

    let frame=null;
    await withHistoryStore("readonly",(store)=>{
        const request=store.get(timestamp);
        request.onsuccess=()=>{
            const result=request.result;
            if(result && result.alerts && typeof result.alerts === "object"){
                frame=result;
            }
        };
    });

    if(frame) cacheHistoryFrame(frame);
    return frame;
}

async function findHistoryAlertByHash(alertHash){
    const normalizedHash=String(alertHash || "").trim().toLowerCase();
    if(!normalizedHash) return null;

    const index=await getHistoryAlertHashIndex();
    const entry=index.get(normalizedHash);
    if(!entry) return null;

    const frame=await loadHistoryFrame(entry.timestamp);
    const primaryAlerts=frame?.alerts?.[entry.fips] || [];
    const alert=primaryAlerts.find(candidate=>{
        const id=candidate?.id || getAlertCountId(candidate);
        return id === entry.id || hashAlertId(id).toLowerCase() === normalizedHash;
    });
    if(alert) return { alert, fips:entry.fips, frame };

    for(const [fips,alerts] of Object.entries(frame?.alerts || {})){
        if(!Array.isArray(alerts)) continue;
        const fallback=alerts.find(candidate=>{
            const id=candidate?.id || getAlertCountId(candidate);
            return hashAlertId(id).toLowerCase() === normalizedHash;
        });
        if(fallback) return { alert:fallback, fips, frame };
    }

    index.delete(normalizedHash);
    return null;
}

function findActiveAlertByHash(alertHash){
    const normalizedHash=String(alertHash || "").trim().toLowerCase();
    if(!normalizedHash) return null;

    const sources=[
        { alertsByFips:rawData, timestamp:historyModeActive && historyFrameTimestamp ? historyFrameTimestamp : Date.now(), source:"current" },
        { alertsByFips:liveRawData, timestamp:Date.now(), source:"live" }
    ];

    for(const source of sources){
        for(const [fips,alerts] of Object.entries(source.alertsByFips || {})){
            if(!Array.isArray(alerts)) continue;
            for(const alert of alerts){
                if(getAlertDisplayHash(alert).toLowerCase() !== normalizedHash) continue;
                return {
                    alert,
                    fips,
                    frame:{
                        timestamp:source.timestamp,
                        source:source.source
                    }
                };
            }
        }
    }

    return null;
}

async function findAnyAlertByHash(alertHash){
    return findActiveAlertByHash(alertHash) || await findHistoryAlertByHash(alertHash);
}

function normalizeHistoryFrames(frames){
    const framesByMinute=new Map();
    frames.forEach(frame=>{
        const minute=Math.floor(frame.timestamp / HISTORY_FRAME_DEDUP_MS);
        const existing=framesByMinute.get(minute);
        if(!existing || (frame.kind === "weather" && existing.kind !== "weather")){
            framesByMinute.set(minute,frame);
        }
    });
    return [...framesByMinute.values()].sort((a,b)=>a.timestamp-b.timestamp);
}

async function loadHistorySnapshotsFromDb(sinceTimestamp=null,onProgress=null){
    try{
        let frames=[];
        const cutoff=Date.now() - getHistoryRetentionMs();
        const lowerBound=Number.isFinite(sinceTimestamp)
            ? Math.max(cutoff,sinceTimestamp + 1)
            : cutoff;
        await withHistoryStore("readonly",(store)=>{
            let total=0;
            let processed=0;
            const countRequest=store.count(IDBKeyRange.lowerBound(lowerBound));
            countRequest.onsuccess=()=>{
                total=countRequest.result || 0;
                if(typeof onProgress === "function") onProgress(total ? 1 : 100);
            };
            const request=store.openCursor(IDBKeyRange.lowerBound(lowerBound));
            request.onsuccess=()=>{
                const cursor=request.result;
                if(!cursor){
                    if(typeof onProgress === "function") onProgress(100);
                    return;
                }
                processed++;
                const frame=cursor.value;
                if(frame && Number.isFinite(frame.timestamp) && frame.alerts && typeof frame.alerts === "object"){
                    if(Number.isFinite(sinceTimestamp) && frame.timestamp <= sinceTimestamp){
                        if(typeof onProgress === "function" && total && processed % 25 === 0){
                            onProgress((processed / total) * 100);
                        }
                        cursor.continue();
                        return;
                    }
                    frames.push(createHistoryFrameMetadata(frame));
                }
                if(typeof onProgress === "function" && total && processed % 25 === 0){
                    onProgress((processed / total) * 100);
                }
                cursor.continue();
            };
        });
        return normalizeHistoryFrames(frames);
    }catch(error){
        console.warn("Unable to load history snapshots",error);
        return [];
    }
}

async function loadHistorySnapshots(sinceTimestamp=null){
    const cachedFrames=getCachedHistorySnapshots(sinceTimestamp);
    if(historyIndexReady || cachedFrames.length){
        return cachedFrames;
    }
    return loadHistorySnapshotsFromDb(sinceTimestamp);
}

function getPlotFrameTitleCounts(frame,mode=getPlotCountMode()){
    if(mode === "counties") return frame.countyTitleCounts || {};
    return frame.alertTitleCounts || frame.eventTitleCounts || {};
}

function getPlotCountMode(){
    return plotCountMode?.value === "counties" ? "counties" : "alerts";
}

function getPlotCountModeLabel(){
    return getPlotCountMode() === "counties" ? "counties" : "alerts";
}

function getPlotTitleCountsFromFrames(frames,mode=getPlotCountMode()){
    const titleCounts=new Map();
    frames.forEach(frame=>{
        Object.entries(getPlotFrameTitleCounts(frame,mode)).forEach(([title,count])=>{
            titleCounts.set(title,(titleCounts.get(title) || 0) + count);
        });
    });
    return titleCounts;
}

function cloneHistoryMapAlert(alert){
    const title=alert.event || "Untitled";
    return {
        id:alert.id || [title,alert.sent,alert.expires,alert.headline].join("|"),
        event:title
    };
}

function getHistoryMapFrameFromSnapshot(frame){
    const countyAlerts={};
    const titleCounts=new Map();
    Object.entries(frame?.alerts || {}).forEach(([fips,alerts])=>{
        if(!isEventTitleDisplayableCounty(fips)) return;
        if(!Array.isArray(alerts)) return;
        const seenIds=new Set();
        alerts.forEach(alert=>{
            if(!alert || typeof alert !== "object") return;
            const title=alert.event || "Untitled";
            const id=alert.id || [title,alert.sent,alert.expires,alert.headline].join("|");
            if(seenIds.has(id)) return;
            seenIds.add(id);
            if(!countyAlerts[fips]) countyAlerts[fips]=[];
            countyAlerts[fips].push(cloneHistoryMapAlert(alert));
            titleCounts.set(title,(titleCounts.get(title) || 0) + 1);
        });
    });
    return {
        timestamp:frame.timestamp,
        countyAlerts,
        titleCounts:Object.fromEntries(titleCounts)
    };
}

function getHistoryMapTitleCountsFromFrames(frames){
    const titleCounts=new Map();
    frames.forEach(frame=>{
        Object.entries(frame.titleCounts || {}).forEach(([title,count])=>{
            titleCounts.set(title,(titleCounts.get(title) || 0) + count);
        });
    });
    return titleCounts;
}

function getCachedHistoryMapFrames(sinceTimestamp=null){
    const cutoff=Date.now() - getHistoryRetentionMs();
    const frames=(historyMapCache.frames || []).filter(frame=>{
        if(!frame || !Number.isFinite(frame.timestamp)) return false;
        if(frame.timestamp < cutoff) return false;
        if(Number.isFinite(sinceTimestamp) && frame.timestamp <= sinceTimestamp) return false;
        return true;
    });
    return {
        frames,
        titleCounts:getHistoryMapTitleCountsFromFrames(frames)
    };
}

async function loadPlotHistoryFramesFromDb(sinceTimestamp=null,onProgress=null,onHistoryMapProgress=null){
    let directError=null;
    try{
        const frames=[];
        const historyMapFrames=[];
        const cutoff=Date.now() - getHistoryRetentionMs();
        const lowerBound=Number.isFinite(sinceTimestamp)
            ? Math.max(cutoff,sinceTimestamp + 1)
            : cutoff;

        await withHistoryStore("readonly",(store)=>{
            let total=0;
            let processed=0;
            const countRequest=store.count(IDBKeyRange.lowerBound(lowerBound));
            countRequest.onsuccess=()=>{
                total=countRequest.result || 0;
                if(typeof onProgress === "function") onProgress(total ? 1 : 100);
                if(typeof onHistoryMapProgress === "function") onHistoryMapProgress(total ? 1 : 100);
            };
            const request=store.openCursor(IDBKeyRange.lowerBound(lowerBound));
            request.onsuccess=()=>{
                const cursor=request.result;
                if(!cursor){
                    if(typeof onProgress === "function") onProgress(100);
                    if(typeof onHistoryMapProgress === "function") onHistoryMapProgress(100);
                    return;
                }
                processed++;
                const frame=cursor.value;
                try{
                    if(frame && Number.isFinite(frame.timestamp) && frame.alerts && typeof frame.alerts === "object"){
                        if(Number.isFinite(sinceTimestamp) && frame.timestamp <= sinceTimestamp){
                            if(typeof onProgress === "function" && total && processed % 20 === 0){
                                onProgress((processed / total) * 100);
                            }
                            if(typeof onHistoryMapProgress === "function" && total && processed % 20 === 0){
                                onHistoryMapProgress((processed / total) * 100);
                            }
                            cursor.continue();
                            return;
                        }
                        const plotCounts=getHistoryFramePlotCounts(frame);
                        frames.push({
                            timestamp:frame.timestamp,
                            alertTitleCounts:plotCounts.alertTitleCounts,
                            countyTitleCounts:plotCounts.countyTitleCounts
                        });
                        historyMapFrames.push(getHistoryMapFrameFromSnapshot(frame));
                    }
                }catch(error){
                    console.warn("Unable to process plot history frame",frame?.timestamp,error);
                }
                if(typeof onProgress === "function" && total && processed % 20 === 0){
                    onProgress((processed / total) * 100);
                }
                if(typeof onHistoryMapProgress === "function" && total && processed % 20 === 0){
                    onHistoryMapProgress((processed / total) * 100);
                }
                cursor.continue();
            };
        });

        const normalizedFrames=normalizeHistoryFrames(frames);
        const normalizedHistoryMapFrames=normalizeHistoryFrames(historyMapFrames);
        return {
            frames:normalizedFrames,
            titleCounts:getPlotTitleCountsFromFrames(normalizedFrames),
            historyMap:{
                frames:normalizedHistoryMapFrames,
                titleCounts:getHistoryMapTitleCountsFromFrames(normalizedHistoryMapFrames)
            }
        };
    }catch(error){
        directError=error;
        console.warn("Unable to load plot history directly",error);
    }

    try{
        return await loadPlotHistoryFramesFromMetadata(sinceTimestamp);
    }catch(error){
        console.warn("Unable to load plot history fallback",error);
        if(directError) console.warn("Original plot history error",directError);
        return {
            frames:[],
            titleCounts:new Map(),
            historyMap:{
                frames:[],
                titleCounts:new Map()
            }
        };
    }
}

async function loadPlotHistoryFrames(sinceTimestamp=null){
    const cachedFrames=getCachedPlotHistoryFrames(sinceTimestamp);
    if(plotHistoryReady || cachedFrames.frames.length){
        return cachedFrames;
    }
    return loadPlotHistoryFramesFromDb(sinceTimestamp);
}

async function loadPlotHistoryFramesFromMetadata(sinceTimestamp=null){
    const metadata=await loadHistorySnapshots(sinceTimestamp);
    const frames=[];

    for(const frameMetadata of metadata){
        try{
            if(Number.isFinite(sinceTimestamp) && frameMetadata.timestamp <= sinceTimestamp) continue;
            const frame=await loadHistoryFrame(frameMetadata.timestamp);
            if(!frame) continue;
            const plotCounts=getHistoryFramePlotCounts(frame);
            frames.push({
                timestamp:frame.timestamp,
                alertTitleCounts:plotCounts.alertTitleCounts,
                countyTitleCounts:plotCounts.countyTitleCounts,
                historyMapFrame:getHistoryMapFrameFromSnapshot(frame)
            });
        }catch(error){
            console.warn("Unable to load plot frame from metadata",frameMetadata?.timestamp,error);
        }
    }

    const normalizedFrames=normalizeHistoryFrames(frames);
    return {
        frames:normalizedFrames,
        titleCounts:getPlotTitleCountsFromFrames(normalizedFrames),
        historyMap:{
            frames:normalizeHistoryFrames(frames.map(frame=>frame.historyMapFrame).filter(Boolean)),
            titleCounts:getHistoryMapTitleCountsFromFrames(frames.map(frame=>frame.historyMapFrame).filter(Boolean))
        }
    };
}

function startHistoryIndexBackgroundLoad(){
    if(historyIndexLoading) return historyIndexLoadPromise;
    const clearGeneration=historyClearGeneration;
    historyIndexLoading=true;
    setStartupStatus("history","History: reading saved frames");
    setStartupTaskProgress("history",0);
    historyIndexLoadPromise=(async()=>{
        const frames=await loadHistorySnapshotsFromDb(null,percent=>setStartupTaskProgress("history",percent));
        if(clearGeneration !== historyClearGeneration) return [];
        historyIndexCache=frames;
        historyIndexReady=true;
        setStartupTaskProgress("history",100);
        setStartupStatus("history","History: " + frames.length + (frames.length === 1 ? " frame" : " frames"),"done");
        syncOpenHistoryPanelFromCache();
        return frames;
    })().catch(error=>{
        setStartupTaskProgress("history",100);
        setStartupStatus("history","History: unavailable","error");
        console.warn("Unable to build background history index",error);
        return [];
    }).finally(()=>{
        historyIndexLoading=false;
    });
    return historyIndexLoadPromise;
}

function startHistoryAlertHashIndexBackgroundLoad(){
    setStartupStatus("alertRefs","Alert refs: indexing history");
    return getHistoryAlertHashIndex()
        .then(index=>{
            setStartupStatus("alertRefs","Alert refs: " + index.size + (index.size === 1 ? " hash" : " hashes"),"done");
            return index;
        })
        .catch(error=>{
            setStartupStatus("alertRefs","Alert refs: unavailable","error");
            console.warn("Unable to build alert reference hash index",error);
            return new Map();
        });
}

function startPlotHistoryBackgroundLoad(){
    if(plotHistoryLoading) return plotHistoryLoadPromise;
    const clearGeneration=historyClearGeneration;
    plotHistoryLoading=true;
    setStartupStatus("plot","Plot cache: reading event counts");
    setStartupStatus("historyMap","History map: reading alert counts");
    setStartupTaskProgress("plot",0);
    setStartupTaskProgress("historyMap",0);
    plotHistoryLoadPromise=(async()=>{
        if(!historyIndexReady){
            await startHistoryIndexBackgroundLoad();
        }
        const plotHistory=await loadPlotHistoryFramesFromDb(
            null,
            percent=>setStartupTaskProgress("plot",percent),
            percent=>setStartupTaskProgress("historyMap",percent)
        );
        if(clearGeneration !== historyClearGeneration){
            return { frames:[], titleCounts:new Map(), historyMap:{ frames:[], titleCounts:new Map() } };
        }
        plotHistoryCache={
            frames:Array.isArray(plotHistory.frames) ? plotHistory.frames : [],
            titleCounts:plotHistory.titleCounts instanceof Map ? plotHistory.titleCounts : new Map()
        };
        historyMapCache={
            frames:Array.isArray(plotHistory.historyMap?.frames) ? plotHistory.historyMap.frames : [],
            titleCounts:plotHistory.historyMap?.titleCounts instanceof Map ? plotHistory.historyMap.titleCounts : new Map()
        };
        plotHistoryReady=true;
        historyMapReady=true;
        populateHistoryMapEventTypeOptions(historyMapCache.titleCounts);
        setStartupTaskProgress("plot",100);
        setStartupTaskProgress("historyMap",100);
        setStartupStatus("plot","Plot cache: " + plotHistoryCache.frames.length + (plotHistoryCache.frames.length === 1 ? " frame" : " frames"),"done");
        setStartupStatus("historyMap","History map: " + historyMapCache.frames.length + (historyMapCache.frames.length === 1 ? " frame" : " frames"),"done");
        syncOpenPlotPanelFromCache();
        return plotHistoryCache;
    })().catch(error=>{
        setStartupTaskProgress("plot",100);
        setStartupTaskProgress("historyMap",100);
        setStartupStatus("plot","Plot cache: unavailable","error");
        setStartupStatus("historyMap","History map: unavailable","error");
        console.warn("Unable to build background plot cache",error);
        return plotHistoryCache;
    }).finally(()=>{
        plotHistoryLoading=false;
    });
    return plotHistoryLoadPromise;
}

function startHistoryBackgroundCaches(){
    if(startupBackgroundCachesStarted) return;
    startupBackgroundCachesStarted=true;
    setStartupStatus("history","History: waiting for map");
    setStartupStatus("alertRefs","Alert refs: waiting for history");
    setStartupStatus("plot","Plot cache: waiting for history");
    setStartupStatus("historyMap","History map: waiting for plot cache");
    runWhenIdle(()=>{
        startHistoryIndexBackgroundLoad().finally(()=>{
            runWhenIdle(()=>{
                startHistoryAlertHashIndexBackgroundLoad().finally(()=>{
                    runWhenIdle(()=>startPlotHistoryBackgroundLoad(),1800);
                });
            },900);
        });
    },1800);
}

async function startHistoryBackgroundCachesAfterFirstMapPaint(){
    await nextPaint();
    await nextPaint();
    startHistoryBackgroundCaches();
}

function getHistoryFramePlotCounts(frame){
    return getAlertTitleSummary(frame?.alerts || {},{ displayableCountiesOnly:true });
}

function getHistoryFrameEventTitleCounts(frame){
    return getHistoryFramePlotCounts(frame).alertTitleCounts;
}
