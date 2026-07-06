// ===== HISTORY PANEL DRAG =====
const historyPanel=Webmap.services.dom.byId('historyPanel');
const historyHeader=Webmap.services.dom.byId('historyHeader');

function clampHistoryPanel(){
    historyPanelDragController.clamp();
}

const historyPanelDragController=makeDraggablePanel({
    panel:historyPanel,
    handle:historyHeader,
    resetStyles:["bottom","transform"],
    extraStyles:{ bottom:"auto" },
    onStart:()=>{ isDraggingHistoryPanel=true; },
    onEnd:()=>{ isDraggingHistoryPanel=false; }
});


