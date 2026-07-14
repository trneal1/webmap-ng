// ===== RUNTIME STATE =====
let geoLayer, geojsonData, rawData = {}, blinkIntervals = {};
let liveAlertFeatures = [];
let alertPolygonLayer = null;
let alertPolygonsVisible = false;
let selectedAlertPolygonIds = new Set();
let countyFeatureByFips = {};
let radarLayer = null;
let precipLayer = null;
let precipRefreshToken = 0;
let activePrecipTooltipTarget = null;
let activeCountyCursorTarget = null;
let lightningLayer = null;
let lightningRefreshToken = 0;
let cloudLayer = null;
let cloudRefreshToken = 0;
let cloudRefreshTimer = null;
let currentRadarTimestamp = Date.now();
let countyOpacityValue = 0.7;
let countyColorizationMode = 1;
let stateLayer;
let stateLabelLayer = null;
let stateLabelsVisible = false;
let stateLabelMarkers = [];
let currentLocationCrosshair = null;
let labelLocationLatLng = null;
let eventFocusLayer = null;
let liveRawData = {};
let historyFrames = [];
let historyModeActive = false;
let historyPlaybackTimer = null;
let historyPlaybackDirection = 1;
let historyPlaybackToken = 0;
let historyPlaybackActive = false;
let historyFrameTimestamp = null;
let historyPanelLoading = false;
let historyLoadToken = 0;
let historyFrameLoadToken = 0;
let historyFrameCache = new Map();
let historyAlertHashIndex = null;
let historyAlertHashIndexLoadPromise = null;
let historyIndexCache = [];
let historyIndexReady = false;
let historyIndexLoading = false;
let historyIndexLoadPromise = null;
let historyClearGeneration = 0;
let historyMapActive = false;
let historyMapLoading = false;
let historyMapLoadToken = 0;
let historyMapCountyCounts = {};
let historyMapCountyEvents = {};
let historyMapCountyAlerts = {};
let historyMapMaxCount = 0;
let historyMapFrameCount = 0;
let historyMapRangeLabel = "";
let historyMapCache = {
    frames:[],
    titleCounts:new Map()
};
let historyMapReady = false;
let historyMapCacheLoading = false;
let historyMapCacheLoadPromise = null;
let historyMapSidebarLoadToken = 0;
let historyMapSidebarCache = new Map();
let historyMapSuppressedLiveState = null;
let plotHistoryCache = {
    frames:[],
    titleCounts:new Map()
};
let plotHistoryReady = false;
let plotHistoryLoading = false;
let plotHistoryLoadPromise = null;
let plotStopAutoFollowLatest = true;
let startupBackgroundCachesStarted = false;
let currentSidebarSelection = null;

// Timer tracking.
let nextWeatherUpdate = Date.now();
let nextRadarUpdate = Date.now();
let weatherUpdateInterval = 60000; // 60 seconds
let radarUpdateInterval = 300000; // 300 seconds
let weatherRefreshTimer = null;
let radarRefreshTimer = null;
let lightningRefreshTimer = null;
let historyRecordingEnabled = true;
let historyFrameWeatherUpdates = 1;
let historyRetentionDays = 7;
let weatherUpdatesSinceHistoryFrame = 0;

const startupStatusState = {
    setup:false,
    history:false,
    alertRefs:false,
    plot:false,
    historyMap:false,
    counties:false,
    states:false
};

let filters = {
    severity:"",
    search:"",
    fields:["event","headline","description","areaDesc"],
    expiredOnly:false,
    eventTitleMode:"all",
    eventTitles:[]
};

let eventTitleFilterSnapshot={ mode:"all", titles:[] };
let eventTitleCyclePositions={};
let focusedEventTitle="";
let focusedEventCountyFips="";
const eventCountyPanels=new Map();
const eventAlertPanels=new Map();
const eventAlertPanelSelectedIds=new Map();
let eventDetailPanelZIndex=2500;
let isDraggingEventFilter=false;
let eventFilterDragOffset={ x:0, y:0 };
let draggedEventDetailPanel=null;
let eventDetailPanelDragOffset={ x:0, y:0 };
let isDraggingHistoryPanel=false;
let historyPanelDragOffset={ x:0, y:0 };
let isDraggingSetupPanel=false;
let setupPanelDragOffset={ x:0, y:0 };
let isDraggingPriorityPanel=false;
let priorityPanelDragOffset={ x:0, y:0 };
let isDraggingPrecipPanel=false;
let precipPanelDragOffset={ x:0, y:0 };
let isDraggingLightningPanel=false;
let lightningPanelDragOffset={ x:0, y:0 };
let isDraggingScalePanel=false;
let scalePanelDragTarget=null;
let scalePanelDragOffset={ x:0, y:0 };
let isDraggingShortcutHelpPanel=false;
let shortcutHelpPanelDragOffset={ x:0, y:0 };
let isDraggingPlotPanel=false;
let plotPanelDragOffset={ x:0, y:0 };
let isDraggingCountyHistoryPanel=false;
let countyHistoryPanelDragOffset={ x:0, y:0 };
let isDraggingHistoryMapPanel=false;
let historyMapPanelDragOffset={ x:0, y:0 };
let plotFrames=[];
let plotTitleCounts=new Map();
let plotPanelLoading=false;
let plotLoadToken=0;
let plotCursorTimestamp=null;
let isDraggingPlotCursor=false;
let plotLastGeometry=null;
let countyHistorySelection=null;
let countyHistoryFrames=[];
let countyHistorySeries=[];
let countyHistoryLoading=false;
let countyHistoryLoadToken=0;
let countyHistoryBackfillReady=false;
let countyHistoryBackfillLoading=false;
let countyHistoryBackfillLoadPromise=null;
let minimizedPanels={
    eventFilter:false,
    priority:false,
    plot:false,
    countyHistory:false,
    historyMap:false,
    history:false
};
let prioritySettings={
    order:[...DEFAULT_PRIORITY_ORDER],
    colors:{...DEFAULT_PRIORITY_COLORS}
};

const WebmapState = {};

function defineLiveStateProperty(name,getter,setter){
    Object.defineProperty(WebmapState,name,{
        enumerable:true,
        configurable:false,
        get:getter,
        set:setter
    });
}

[
    ["geoLayer",()=>geoLayer,value=>{ geoLayer=value; }],
    ["geojsonData",()=>geojsonData,value=>{ geojsonData=value; }],
    ["rawData",()=>rawData,value=>{ rawData=value; }],
    ["blinkIntervals",()=>blinkIntervals,value=>{ blinkIntervals=value; }],
    ["liveAlertFeatures",()=>liveAlertFeatures,value=>{ liveAlertFeatures=value; }],
    ["alertPolygonLayer",()=>alertPolygonLayer,value=>{ alertPolygonLayer=value; }],
    ["alertPolygonsVisible",()=>alertPolygonsVisible,value=>{ alertPolygonsVisible=value; }],
    ["selectedAlertPolygonIds",()=>selectedAlertPolygonIds,value=>{ selectedAlertPolygonIds=value; }],
    ["countyFeatureByFips",()=>countyFeatureByFips,value=>{ countyFeatureByFips=value; }],
    ["radarLayer",()=>radarLayer,value=>{ radarLayer=value; }],
    ["precipLayer",()=>precipLayer,value=>{ precipLayer=value; }],
    ["precipRefreshToken",()=>precipRefreshToken,value=>{ precipRefreshToken=value; }],
    ["activePrecipTooltipTarget",()=>activePrecipTooltipTarget,value=>{ activePrecipTooltipTarget=value; }],
    ["activeCountyCursorTarget",()=>activeCountyCursorTarget,value=>{ activeCountyCursorTarget=value; }],
    ["lightningLayer",()=>lightningLayer,value=>{ lightningLayer=value; }],
    ["lightningRefreshToken",()=>lightningRefreshToken,value=>{ lightningRefreshToken=value; }],
    ["cloudLayer",()=>cloudLayer,value=>{ cloudLayer=value; }],
    ["cloudRefreshToken",()=>cloudRefreshToken,value=>{ cloudRefreshToken=value; }],
    ["cloudRefreshTimer",()=>cloudRefreshTimer,value=>{ cloudRefreshTimer=value; }],
    ["currentRadarTimestamp",()=>currentRadarTimestamp,value=>{ currentRadarTimestamp=value; }],
    ["countyOpacityValue",()=>countyOpacityValue,value=>{ countyOpacityValue=value; }],
    ["countyColorizationMode",()=>countyColorizationMode,value=>{ countyColorizationMode=value; }],
    ["stateLayer",()=>stateLayer,value=>{ stateLayer=value; }],
    ["stateLabelLayer",()=>stateLabelLayer,value=>{ stateLabelLayer=value; }],
    ["stateLabelsVisible",()=>stateLabelsVisible,value=>{ stateLabelsVisible=value; }],
    ["stateLabelMarkers",()=>stateLabelMarkers,value=>{ stateLabelMarkers=value; }],
    ["currentLocationCrosshair",()=>currentLocationCrosshair,value=>{ currentLocationCrosshair=value; }],
    ["labelLocationLatLng",()=>labelLocationLatLng,value=>{ labelLocationLatLng=value; }],
    ["eventFocusLayer",()=>eventFocusLayer,value=>{ eventFocusLayer=value; }],
    ["liveRawData",()=>liveRawData,value=>{ liveRawData=value; }],
    ["historyFrames",()=>historyFrames,value=>{ historyFrames=value; }],
    ["historyModeActive",()=>historyModeActive,value=>{ historyModeActive=value; }],
    ["historyPlaybackTimer",()=>historyPlaybackTimer,value=>{ historyPlaybackTimer=value; }],
    ["historyPlaybackDirection",()=>historyPlaybackDirection,value=>{ historyPlaybackDirection=value; }],
    ["historyPlaybackToken",()=>historyPlaybackToken,value=>{ historyPlaybackToken=value; }],
    ["historyPlaybackActive",()=>historyPlaybackActive,value=>{ historyPlaybackActive=value; }],
    ["historyFrameTimestamp",()=>historyFrameTimestamp,value=>{ historyFrameTimestamp=value; }],
    ["historyPanelLoading",()=>historyPanelLoading,value=>{ historyPanelLoading=value; }],
    ["historyLoadToken",()=>historyLoadToken,value=>{ historyLoadToken=value; }],
    ["historyFrameLoadToken",()=>historyFrameLoadToken,value=>{ historyFrameLoadToken=value; }],
    ["historyFrameCache",()=>historyFrameCache,value=>{ historyFrameCache=value; }],
    ["historyAlertHashIndex",()=>historyAlertHashIndex,value=>{ historyAlertHashIndex=value; }],
    ["historyAlertHashIndexLoadPromise",()=>historyAlertHashIndexLoadPromise,value=>{ historyAlertHashIndexLoadPromise=value; }],
    ["historyIndexCache",()=>historyIndexCache,value=>{ historyIndexCache=value; }],
    ["historyIndexReady",()=>historyIndexReady,value=>{ historyIndexReady=value; }],
    ["historyIndexLoading",()=>historyIndexLoading,value=>{ historyIndexLoading=value; }],
    ["historyIndexLoadPromise",()=>historyIndexLoadPromise,value=>{ historyIndexLoadPromise=value; }],
    ["historyClearGeneration",()=>historyClearGeneration,value=>{ historyClearGeneration=value; }],
    ["historyMapActive",()=>historyMapActive,value=>{ historyMapActive=value; }],
    ["historyMapLoading",()=>historyMapLoading,value=>{ historyMapLoading=value; }],
    ["historyMapLoadToken",()=>historyMapLoadToken,value=>{ historyMapLoadToken=value; }],
    ["historyMapCountyCounts",()=>historyMapCountyCounts,value=>{ historyMapCountyCounts=value; }],
    ["historyMapCountyEvents",()=>historyMapCountyEvents,value=>{ historyMapCountyEvents=value; }],
    ["historyMapCountyAlerts",()=>historyMapCountyAlerts,value=>{ historyMapCountyAlerts=value; }],
    ["historyMapMaxCount",()=>historyMapMaxCount,value=>{ historyMapMaxCount=value; }],
    ["historyMapFrameCount",()=>historyMapFrameCount,value=>{ historyMapFrameCount=value; }],
    ["historyMapRangeLabel",()=>historyMapRangeLabel,value=>{ historyMapRangeLabel=value; }],
    ["historyMapCache",()=>historyMapCache,value=>{ historyMapCache=value; }],
    ["historyMapReady",()=>historyMapReady,value=>{ historyMapReady=value; }],
    ["historyMapCacheLoading",()=>historyMapCacheLoading,value=>{ historyMapCacheLoading=value; }],
    ["historyMapCacheLoadPromise",()=>historyMapCacheLoadPromise,value=>{ historyMapCacheLoadPromise=value; }],
    ["historyMapSidebarLoadToken",()=>historyMapSidebarLoadToken,value=>{ historyMapSidebarLoadToken=value; }],
    ["historyMapSidebarCache",()=>historyMapSidebarCache,value=>{ historyMapSidebarCache=value; }],
    ["historyMapSuppressedLiveState",()=>historyMapSuppressedLiveState,value=>{ historyMapSuppressedLiveState=value; }],
    ["plotHistoryCache",()=>plotHistoryCache,value=>{ plotHistoryCache=value; }],
    ["plotHistoryReady",()=>plotHistoryReady,value=>{ plotHistoryReady=value; }],
    ["plotHistoryLoading",()=>plotHistoryLoading,value=>{ plotHistoryLoading=value; }],
    ["plotHistoryLoadPromise",()=>plotHistoryLoadPromise,value=>{ plotHistoryLoadPromise=value; }],
    ["plotStopAutoFollowLatest",()=>plotStopAutoFollowLatest,value=>{ plotStopAutoFollowLatest=value; }],
    ["startupBackgroundCachesStarted",()=>startupBackgroundCachesStarted,value=>{ startupBackgroundCachesStarted=value; }],
    ["currentSidebarSelection",()=>currentSidebarSelection,value=>{ currentSidebarSelection=value; }],
    ["nextWeatherUpdate",()=>nextWeatherUpdate,value=>{ nextWeatherUpdate=value; }],
    ["nextRadarUpdate",()=>nextRadarUpdate,value=>{ nextRadarUpdate=value; }],
    ["weatherUpdateInterval",()=>weatherUpdateInterval,value=>{ weatherUpdateInterval=value; }],
    ["radarUpdateInterval",()=>radarUpdateInterval,value=>{ radarUpdateInterval=value; }],
    ["weatherRefreshTimer",()=>weatherRefreshTimer,value=>{ weatherRefreshTimer=value; }],
    ["radarRefreshTimer",()=>radarRefreshTimer,value=>{ radarRefreshTimer=value; }],
    ["lightningRefreshTimer",()=>lightningRefreshTimer,value=>{ lightningRefreshTimer=value; }],
    ["historyRecordingEnabled",()=>historyRecordingEnabled,value=>{ historyRecordingEnabled=value; }],
    ["historyFrameWeatherUpdates",()=>historyFrameWeatherUpdates,value=>{ historyFrameWeatherUpdates=value; }],
    ["historyRetentionDays",()=>historyRetentionDays,value=>{ historyRetentionDays=value; }],
    ["weatherUpdatesSinceHistoryFrame",()=>weatherUpdatesSinceHistoryFrame,value=>{ weatherUpdatesSinceHistoryFrame=value; }],
    ["eventTitleFilterSnapshot",()=>eventTitleFilterSnapshot,value=>{ eventTitleFilterSnapshot=value; }],
    ["eventTitleCyclePositions",()=>eventTitleCyclePositions,value=>{ eventTitleCyclePositions=value; }],
    ["focusedEventTitle",()=>focusedEventTitle,value=>{ focusedEventTitle=value; }],
    ["focusedEventCountyFips",()=>focusedEventCountyFips,value=>{ focusedEventCountyFips=value; }],
    ["eventDetailPanelZIndex",()=>eventDetailPanelZIndex,value=>{ eventDetailPanelZIndex=value; }],
    ["isDraggingEventFilter",()=>isDraggingEventFilter,value=>{ isDraggingEventFilter=value; }],
    ["eventFilterDragOffset",()=>eventFilterDragOffset,value=>{ eventFilterDragOffset=value; }],
    ["draggedEventDetailPanel",()=>draggedEventDetailPanel,value=>{ draggedEventDetailPanel=value; }],
    ["eventDetailPanelDragOffset",()=>eventDetailPanelDragOffset,value=>{ eventDetailPanelDragOffset=value; }],
    ["isDraggingHistoryPanel",()=>isDraggingHistoryPanel,value=>{ isDraggingHistoryPanel=value; }],
    ["historyPanelDragOffset",()=>historyPanelDragOffset,value=>{ historyPanelDragOffset=value; }],
    ["isDraggingSetupPanel",()=>isDraggingSetupPanel,value=>{ isDraggingSetupPanel=value; }],
    ["setupPanelDragOffset",()=>setupPanelDragOffset,value=>{ setupPanelDragOffset=value; }],
    ["isDraggingPriorityPanel",()=>isDraggingPriorityPanel,value=>{ isDraggingPriorityPanel=value; }],
    ["priorityPanelDragOffset",()=>priorityPanelDragOffset,value=>{ priorityPanelDragOffset=value; }],
    ["isDraggingPrecipPanel",()=>isDraggingPrecipPanel,value=>{ isDraggingPrecipPanel=value; }],
    ["precipPanelDragOffset",()=>precipPanelDragOffset,value=>{ precipPanelDragOffset=value; }],
    ["isDraggingLightningPanel",()=>isDraggingLightningPanel,value=>{ isDraggingLightningPanel=value; }],
    ["lightningPanelDragOffset",()=>lightningPanelDragOffset,value=>{ lightningPanelDragOffset=value; }],
    ["isDraggingScalePanel",()=>isDraggingScalePanel,value=>{ isDraggingScalePanel=value; }],
    ["scalePanelDragTarget",()=>scalePanelDragTarget,value=>{ scalePanelDragTarget=value; }],
    ["scalePanelDragOffset",()=>scalePanelDragOffset,value=>{ scalePanelDragOffset=value; }],
    ["isDraggingShortcutHelpPanel",()=>isDraggingShortcutHelpPanel,value=>{ isDraggingShortcutHelpPanel=value; }],
    ["shortcutHelpPanelDragOffset",()=>shortcutHelpPanelDragOffset,value=>{ shortcutHelpPanelDragOffset=value; }],
    ["isDraggingPlotPanel",()=>isDraggingPlotPanel,value=>{ isDraggingPlotPanel=value; }],
    ["plotPanelDragOffset",()=>plotPanelDragOffset,value=>{ plotPanelDragOffset=value; }],
    ["isDraggingCountyHistoryPanel",()=>isDraggingCountyHistoryPanel,value=>{ isDraggingCountyHistoryPanel=value; }],
    ["countyHistoryPanelDragOffset",()=>countyHistoryPanelDragOffset,value=>{ countyHistoryPanelDragOffset=value; }],
    ["isDraggingHistoryMapPanel",()=>isDraggingHistoryMapPanel,value=>{ isDraggingHistoryMapPanel=value; }],
    ["historyMapPanelDragOffset",()=>historyMapPanelDragOffset,value=>{ historyMapPanelDragOffset=value; }],
    ["plotFrames",()=>plotFrames,value=>{ plotFrames=value; }],
    ["plotTitleCounts",()=>plotTitleCounts,value=>{ plotTitleCounts=value; }],
    ["plotPanelLoading",()=>plotPanelLoading,value=>{ plotPanelLoading=value; }],
    ["plotLoadToken",()=>plotLoadToken,value=>{ plotLoadToken=value; }],
    ["plotCursorTimestamp",()=>plotCursorTimestamp,value=>{ plotCursorTimestamp=value; }],
    ["isDraggingPlotCursor",()=>isDraggingPlotCursor,value=>{ isDraggingPlotCursor=value; }],
    ["plotLastGeometry",()=>plotLastGeometry,value=>{ plotLastGeometry=value; }],
    ["countyHistorySelection",()=>countyHistorySelection,value=>{ countyHistorySelection=value; }],
    ["countyHistoryFrames",()=>countyHistoryFrames,value=>{ countyHistoryFrames=value; }],
    ["countyHistorySeries",()=>countyHistorySeries,value=>{ countyHistorySeries=value; }],
    ["countyHistoryLoading",()=>countyHistoryLoading,value=>{ countyHistoryLoading=value; }],
    ["countyHistoryLoadToken",()=>countyHistoryLoadToken,value=>{ countyHistoryLoadToken=value; }],
    ["countyHistoryBackfillReady",()=>countyHistoryBackfillReady,value=>{ countyHistoryBackfillReady=value; }],
    ["countyHistoryBackfillLoading",()=>countyHistoryBackfillLoading,value=>{ countyHistoryBackfillLoading=value; }],
    ["countyHistoryBackfillLoadPromise",()=>countyHistoryBackfillLoadPromise,value=>{ countyHistoryBackfillLoadPromise=value; }],
    ["minimizedPanels",()=>minimizedPanels,value=>{ minimizedPanels=value; }],
    ["prioritySettings",()=>prioritySettings,value=>{ prioritySettings=value; }]
].forEach(([name,getter,setter])=>defineLiveStateProperty(name,getter,setter));

Object.defineProperties(WebmapState,{
    startupStatusState:{ enumerable:true, get:()=>startupStatusState },
    filters:{ enumerable:true, get:()=>filters, set:value=>{ filters=value; } },
    eventCountyPanels:{ enumerable:true, get:()=>eventCountyPanels },
    eventAlertPanels:{ enumerable:true, get:()=>eventAlertPanels },
    eventAlertPanelSelectedIds:{ enumerable:true, get:()=>eventAlertPanelSelectedIds }
});
