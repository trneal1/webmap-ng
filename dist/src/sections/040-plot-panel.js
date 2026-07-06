// ===== PLOT PANEL =====
const plotPanel=Webmap.services.dom.byId('plotPanel');
const plotHeader=Webmap.services.dom.byId('plotHeader');
const plotStart=Webmap.services.dom.byId('plotStart');
const plotStop=Webmap.services.dom.byId('plotStop');
const plotCountMode=Webmap.services.dom.byId('plotCountMode');
const plotEventTitles=Webmap.services.dom.byId('plotEventTitles');
const eventPlotCanvas=Webmap.services.dom.byId('eventPlotCanvas');
const plotCursorTooltip=Webmap.services.dom.byId('plotCursorTooltip');
const plotStatus=Webmap.services.dom.byId('plotStatus');
const plotHint=Webmap.services.dom.byId('plotHint');
const historyMapPanel=Webmap.services.dom.byId('historyMapPanel');
const historyMapHeader=Webmap.services.dom.byId('historyMapHeader');
const historyMapQuickRange=Webmap.services.dom.byId('historyMapQuickRange');
const historyMapStart=Webmap.services.dom.byId('historyMapStart');
const historyMapStop=Webmap.services.dom.byId('historyMapStop');
const historyMapPanelStatus=Webmap.services.dom.byId('historyMapPanelStatus');
const restoreEventFilterButton=Webmap.services.dom.byId('restoreEventFilterButton');
const restorePriorityButton=Webmap.services.dom.byId('restorePriorityButton');
const restorePlotButton=Webmap.services.dom.byId('restorePlotButton');
const restoreHistoryMapButton=Webmap.services.dom.byId('restoreHistoryMapButton');
const restoreHistoryButton=Webmap.services.dom.byId('restoreHistoryButton');

function updatePanelRestoreDock(){
    restoreEventFilterButton.classList.toggle('visible',minimizedPanels.eventFilter);
    restorePriorityButton.classList.toggle('visible',minimizedPanels.priority);
    restorePlotButton.classList.toggle('visible',minimizedPanels.plot);
    restoreHistoryMapButton.classList.toggle('visible',minimizedPanels.historyMap);
    restoreHistoryButton.classList.toggle('visible',minimizedPanels.history);
}

const eventFilterPanelController=Webmap.services.panels.createPanelController({
    panel:eventFilterOverlay,
    minimizedKey:"eventFilter",
    dragController:eventFilterDragController,
    updateRestoreDock:updatePanelRestoreDock
});

const historyPanelController=Webmap.services.panels.createPanelController({
    panel:historyPanel,
    minimizedKey:"history",
    dragController:historyPanelDragController,
    updateRestoreDock:updatePanelRestoreDock,
    onClose:()=>{
        historyLoadToken++;
        historyFrameLoadToken++;
        historyPanelLoading=false;
        stopHistoryPlayback();
        historyModeActive=false;
        historyFrameTimestamp=null;
        if(!historyMapActive){
            document.body.classList.remove('history-active');
            rawData=liveRawData;
            refreshEventFilterListIfOpen();
        }
        reloadRadar();
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
});

function clampPlotPanel(){
    plotPanelDragController.clamp();
}

const plotPanelDragController=makeDraggablePanel({
    panel:plotPanel,
    handle:plotHeader,
    resetStyles:["transform"],
    onStart:()=>{ isDraggingPlotPanel=true; },
    onEnd:()=>{ isDraggingPlotPanel=false; }
});

const plotPanelController=Webmap.services.panels.createPanelController({
    panel:plotPanel,
    minimizedKey:"plot",
    dragController:plotPanelDragController,
    updateRestoreDock:updatePanelRestoreDock,
    onClose:()=>{
        plotLoadToken++;
        plotPanelLoading=false;
        plotCursorTooltip.classList.remove('visible');
    },
    onRestore:()=>drawEventPlot()
});

