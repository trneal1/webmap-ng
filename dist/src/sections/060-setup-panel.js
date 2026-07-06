// ===== SETUP PANEL =====
const setupPanel=Webmap.services.dom.byId('setupPanel');
const setupHeader=Webmap.services.dom.byId('setupHeader');
const priorityPanel=Webmap.services.dom.byId('priorityPanel');
const priorityHeader=Webmap.services.dom.byId('priorityHeader');
const priorityList=Webmap.services.dom.byId('priorityList');
const weatherUpdateMinutes=Webmap.services.dom.byId('weatherUpdateMinutes');
const radarUpdateMinutes=Webmap.services.dom.byId('radarUpdateMinutes');
const historyRecordingToggle=Webmap.services.dom.byId('historyRecordingToggle');
const historyFrameWeatherUpdatesInput=Webmap.services.dom.byId('historyFrameWeatherUpdates');
const historyRetentionDaysInput=Webmap.services.dom.byId('historyRetentionDays');
const labelLocationLatInput=Webmap.services.dom.byId('labelLocationLat');
const labelLocationLonInput=Webmap.services.dom.byId('labelLocationLon');

function loadSetupSettings(){
    try{
        const settings=JSON.parse(localStorage.getItem(SETUP_SETTINGS_KEY)) || {};
        weatherUpdateInterval=clampNumber(settings.weatherUpdateMinutes,0.1,1440,1) * 60000;
        radarUpdateInterval=clampNumber(settings.radarUpdateMinutes,0.1,1440,5) * 60000;
        historyRecordingEnabled=settings.historyRecordingEnabled !== false;
        historyFrameWeatherUpdates=Math.round(clampNumber(settings.historyFrameWeatherUpdates,1,1440,1));
        historyRetentionDays=Math.round(clampNumber(settings.historyRetentionDays,1,365,7));
        labelLocationLatLng=getValidLatLng(settings.labelLocationLat,settings.labelLocationLon);
    }catch(error){
        weatherUpdateInterval=60000;
        radarUpdateInterval=300000;
        historyRecordingEnabled=true;
        historyFrameWeatherUpdates=1;
        historyRetentionDays=7;
        labelLocationLatLng=null;
    }
}

function saveSetupSettings(){
    localStorage.setItem(SETUP_SETTINGS_KEY,JSON.stringify({
        weatherUpdateMinutes:weatherUpdateInterval / 60000,
        radarUpdateMinutes:radarUpdateInterval / 60000,
        historyRecordingEnabled,
        historyFrameWeatherUpdates,
        historyRetentionDays,
        labelLocationLat:labelLocationLatLng ? labelLocationLatLng[0] : "",
        labelLocationLon:labelLocationLatLng ? labelLocationLatLng[1] : ""
    }));
}

function syncSetupControls(){
    weatherUpdateMinutes.value=String(weatherUpdateInterval / 60000);
    radarUpdateMinutes.value=String(radarUpdateInterval / 60000);
    historyRecordingToggle.checked=historyRecordingEnabled;
    historyFrameWeatherUpdatesInput.value=String(historyFrameWeatherUpdates);
    historyRetentionDaysInput.value=String(historyRetentionDays);
    labelLocationLatInput.value=labelLocationLatLng ? String(labelLocationLatLng[0]) : "";
    labelLocationLonInput.value=labelLocationLatLng ? String(labelLocationLatLng[1]) : "";
}

function startWeatherRefreshTimer(){
    if(weatherRefreshTimer) clearInterval(weatherRefreshTimer);
    nextWeatherUpdate=Date.now() + weatherUpdateInterval;
    weatherRefreshTimer=setInterval(refresh,weatherUpdateInterval);
}

function startRadarRefreshTimer(){
    if(radarRefreshTimer) clearInterval(radarRefreshTimer);
    nextRadarUpdate=Date.now() + radarUpdateInterval;
    radarRefreshTimer=setInterval(()=>{
        if(radarToggle.checked) reloadRadar();
    },radarUpdateInterval);
}

function applySetupSettings(){
    const previousHistoryRetentionDays=historyRetentionDays;
    weatherUpdateInterval=clampNumber(weatherUpdateMinutes.value,0.1,1440,1) * 60000;
    radarUpdateInterval=clampNumber(radarUpdateMinutes.value,0.1,1440,5) * 60000;
    historyRecordingEnabled=historyRecordingToggle.checked;
    historyFrameWeatherUpdates=Math.round(clampNumber(historyFrameWeatherUpdatesInput.value,1,1440,1));
    historyRetentionDays=Math.round(clampNumber(historyRetentionDaysInput.value,1,365,7));
    labelLocationLatLng=getValidLatLng(labelLocationLatInput.value,labelLocationLonInput.value);
    weatherUpdatesSinceHistoryFrame=0;
    syncSetupControls();
    saveSetupSettings();
    startWeatherRefreshTimer();
    startRadarRefreshTimer();
    if(stateLabelsVisible) updateCurrentLocationMarker();
    if(historyRetentionDays !== previousHistoryRetentionDays){
        refreshHistoryRetentionWindow().catch(error=>{
            console.warn("Unable to refresh history retention window",error);
        });
    }
}

function resetSetupSettings(){
    weatherUpdateInterval=60000;
    radarUpdateInterval=300000;
    historyRecordingEnabled=true;
    historyFrameWeatherUpdates=1;
    historyRetentionDays=7;
    labelLocationLatLng=null;
    weatherUpdatesSinceHistoryFrame=0;
    syncSetupControls();
    saveSetupSettings();
    startWeatherRefreshTimer();
    startRadarRefreshTimer();
    if(stateLabelsVisible) updateCurrentLocationMarker();
}

function openSetupPanel(){
    setupPanelController.open();
}

function closeSetupPanel(){
    setupPanelController.close();
}

function clampSetupPanel(){
    setupPanelController.clamp();
}

const setupPanelDragController=makeDraggablePanel({
    panel:setupPanel,
    handle:setupHeader,
    resetStyles:["transform"],
    onStart:()=>{ isDraggingSetupPanel=true; },
    onEnd:()=>{ isDraggingSetupPanel=false; }
});

const setupPanelController=Webmap.services.panels.createPanelController({
    panel:setupPanel,
    dragController:setupPanelDragController,
    onOpen:syncSetupControls
});

