// ===== DOM BINDINGS =====
const domClickHandlers={
    minimizeEventFilterPopup,
    closeEventFilterPopup,
    selectAllEventTitles,
    selectNoEventTitles,
    clearEventTitles,
    closeSetupPanel,
    applyFilters,
    clearSearch,
    resetSetupSettings,
    toggleShortcutHelpPanel,
    minimizePriorityPanel,
    closePriorityPanel,
    resetPrioritySettings,
    closeShortcutHelpPanel,
    minimizePlotPanel,
    closePlotPanel,
    openCountyHistoryFromCountyLink,
    minimizeCountyHistoryPanel,
    closeCountyHistoryPanel,
    restoreCountyHistoryPanel,
    selectAllCountyHistoryEventTitles,
    selectNoCountyHistoryEventTitles,
    reloadCountyHistoryFromControls,
    drawCountyHistoryPlot,
    selectAllPlotEventTitles,
    selectNoPlotEventTitles,
    reloadPlotHistory,
    refreshEventPlot,
    gotoPlotCursorHistoryFrame,
    minimizeHistoryPanel,
    closeHistoryPanel,
    rewindHistory,
    playHistoryReverse:()=>playHistory(-1),
    playHistoryForward:()=>playHistory(1),
    stopHistoryPlayback,
    fastForwardHistory,
    reloadHistoryPanel,
    searchNextTornadoWarningFrame,
    clearHistorySnapshots,
    minimizeHistoryMapPanel,
    closeHistoryMapPanel,
    selectAllHistoryMapEventTypes,
    clearHistoryMapEventTypes,
    applyHistoryMapFromControls,
    togglePrecipPanel,
    closePrecipPanel,
    toggleLightningPanel,
    toggleCloudLayer,
    closeLightningPanel,
    restoreEventFilterPopup,
    restorePriorityPanel,
    restorePlotPanel,
    restoreHistoryMapPanel,
    restoreHistoryPanel,
    movePriorityCategory:event=>movePriorityCategory(
        event.target.dataset.category,
        Number(event.target.dataset.direction)
    ),
    openSidebar,
    closeSidebar
};

const domChangeHandlers={
    applySetupSettings,
    applyFilters,
    redrawMap,
    toggleRadar,
    switchMapType,
    refreshEventPlot,
    handlePlotStopChange,
    handleCountyHistoryStopChange,
    changePlotCountMode,
    syncHistoryRangeInputs,
    setHistoryMapQuickRangeFromValue:event=>setHistoryMapQuickRange(event.target.value),
    applyCustomHistoryMapRange:()=>{
        clearHistoryMapQuickRange();
        applyHistoryMapFromControls();
    },
    applyHistoryMapFromControls,
    togglePrecipLayer,
    changePrecipRange,
    toggleLightningLayer,
    updateEventTitleFilter,
    changePriorityColor:event=>changePriorityColor(
        event.target.dataset.category,
        event.target.value
    )
};

const domInputHandlers={
    updateMapOpacity,
    updateCountyOpacity,
    updateRadarOpacity,
    showHistoryFrameFromValue:event=>showHistoryFrame(Number(event.target.value)),
    updatePrecipOpacity,
    updateLightningOpacity
};

Object.entries(domClickHandlers).forEach(([name,handler])=>Webmap.registerAction("click:" + name,handler));
Object.entries(domChangeHandlers).forEach(([name,handler])=>Webmap.registerAction("change:" + name,handler));
Object.entries(domInputHandlers).forEach(([name,handler])=>Webmap.registerAction("input:" + name,handler));

function bindDelegatedDomHandlers(){
    Webmap.services.dom.delegate(document,'click','[data-click]',(event,target)=>{
        const handler=Webmap.actions["click:" + target.dataset.click] || domClickHandlers[target.dataset.click];
        if(!handler) return;
        handler(event);
    });

    Webmap.services.dom.delegate(document,'change','[data-change]',(event,target)=>{
        const handler=Webmap.actions["change:" + target.dataset.change] || domChangeHandlers[target.dataset.change];
        if(!handler) return;
        handler(event);
    });

    Webmap.services.dom.delegate(document,'input','[data-input]',(event,target)=>{
        const handler=Webmap.actions["input:" + target.dataset.input] || domInputHandlers[target.dataset.input];
        if(!handler) return;
        handler(event);
    });
}

bindDelegatedDomHandlers();
