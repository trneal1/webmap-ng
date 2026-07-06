// ===== HISTORY MAP PANEL =====
function clampHistoryMapPanel(){
    historyMapPanelDragController.clamp();
}

const historyMapPanelDragController=makeDraggablePanel({
    panel:historyMapPanel,
    handle:historyMapHeader,
    resetStyles:["bottom","transform"],
    extraStyles:{ bottom:"auto" },
    onStart:()=>{ isDraggingHistoryMapPanel=true; },
    onEnd:()=>{ isDraggingHistoryMapPanel=false; }
});

const historyMapPanelController=Webmap.services.panels.createPanelController({
    panel:historyMapPanel,
    minimizedKey:"historyMap",
    dragController:historyMapPanelDragController,
    updateRestoreDock:updatePanelRestoreDock,
    onClose:()=>{
        historyMapLoadToken++;
        historyMapLoading=false;
        exitHistoryMapMode();
    }
});

function updatePlotCursorFromClientX(clientX){
    if(!plotLastGeometry) return;

    const rect=eventPlotCanvas.getBoundingClientRect();
    const x=(clientX - rect.left) * plotLastGeometry.dpr;
    const clampedX=Math.min(
        Math.max(x,plotLastGeometry.margin.left),
        plotLastGeometry.width - plotLastGeometry.margin.right
    );
    const timestamp=plotLastGeometry.timeFromX(clampedX);
    const nearest=getNearestPlotFrameTimestamp(timestamp,plotLastGeometry.seriesByTitle);
    if(!nearest) return;

    plotCursorTimestamp=nearest;
    drawEventPlot();
}

Webmap.services.dom.listen(eventPlotCanvas,'mousedown',(e)=>{
    if(e.button !== 0) return;
    isDraggingPlotCursor=true;
    updatePlotCursorFromClientX(e.clientX);
    e.preventDefault();
});

Webmap.services.dom.listenDocument('mousemove',(e)=>{
    if(!isDraggingPlotCursor) return;
    updatePlotCursorFromClientX(e.clientX);
});

Webmap.services.dom.listenDocument('mouseup',()=>{
    isDraggingPlotCursor=false;
});

if(window.ResizeObserver){
    const plotResizeObserver=new ResizeObserver(()=>{
        if(plotPanel.classList.contains('open')){
            drawEventPlot();
        }
    });
    plotResizeObserver.observe(plotPanel);
}

