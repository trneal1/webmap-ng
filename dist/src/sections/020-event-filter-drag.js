// ===== EVENT FILTER DRAG =====
const eventFilterDialog=Webmap.services.dom.byId('eventFilterDialog');
const eventFilterHeader=Webmap.services.dom.byId('eventFilterHeader');
const eventFilterOverlay=Webmap.services.dom.byId('eventFilterOverlay');
const eventDetailPanels=Webmap.services.dom.byId('eventDetailPanels');

function clampEventFilterDialog(){
    eventFilterDragController.clamp();
}

const eventFilterDragController=makeDraggablePanel({
    panel:eventFilterDialog,
    handle:eventFilterHeader,
    resetStyles:["transform"],
    onStart:()=>{ isDraggingEventFilter=true; },
    onEnd:()=>{ isDraggingEventFilter=false; }
});

function clampEventDetailPanel(panel){
    clampElementToViewport(panel,{ resetStyles:["transform"] });
}

Webmap.services.dom.listen(eventDetailPanels,'mousedown',(e)=>{
    const panel=e.target.closest('.event-detail-panel');
    if(panel) panel.style.zIndex=String(++eventDetailPanelZIndex);
    if(e.button !== 0 || e.target.closest('button')) return;
    if(!e.target.closest('.event-detail-header') || !panel) return;

    const rect=anchorElementForDrag(panel,{ resetStyles:["transform"] });

    draggedEventDetailPanel=panel;
    eventDetailPanelDragOffset={
        x:e.clientX-rect.left,
        y:e.clientY-rect.top
    };
    e.preventDefault();
});

Webmap.services.dom.listenDocument('mousemove',(e)=>{
    if(!draggedEventDetailPanel) return;

    moveElementWithinViewport(draggedEventDetailPanel,e.clientX,e.clientY,eventDetailPanelDragOffset);
});

Webmap.services.dom.listenDocument('mouseup',()=>{
    draggedEventDetailPanel=null;
});

Webmap.services.dom.listenDocument('click',(e)=>{
    const button=e.target.closest('.alert-reference-link[data-alert-ref-hash]');
    if(!button) return;
    e.preventDefault();
    e.stopPropagation();
    openAlertHashPopup(button.dataset.alertRefHash);
});

Webmap.services.dom.listenDocument('click',(e)=>{
    const button=e.target.closest('.alert-id-link[data-alert-id-hash]');
    if(!button) return;
    e.preventDefault();
    e.stopPropagation();
    openAlertReferenceTreePopup(button.dataset.alertIdHash);
});

Webmap.services.dom.listenDocument('click',(e)=>{
    const button=e.target.closest('[data-reference-tree-action]');
    if(!button) return;
    const tree=button.closest('.event-detail-body')?.querySelector('.alert-reference-tree');
    if(!tree) return;
    e.preventDefault();
    e.stopPropagation();
    tree.classList.toggle('collapsed',button.dataset.referenceTreeAction === 'collapse');
});

Webmap.services.dom.listenWindow('resize',()=>{
    if(eventFilterOverlay.classList.contains('open')){
        clampEventFilterDialog();
    }
    Webmap.services.dom.all('.event-detail-panel').forEach(clampEventDetailPanel);
    if(Webmap.services.dom.maybeById('historyPanel').classList.contains('open')){
        clampHistoryPanel();
    }
    if(Webmap.services.dom.maybeById('setupPanel').classList.contains('open')){
        clampSetupPanel();
    }
    if(Webmap.services.dom.maybeById('priorityPanel').classList.contains('open')){
        clampPriorityPanel();
    }
    if(Webmap.services.dom.maybeById('plotPanel').classList.contains('open')){
        clampPlotPanel();
        drawEventPlot();
    }
    if(Webmap.services.dom.maybeById('historyMapPanel').classList.contains('open')){
        clampHistoryMapPanel();
    }
    clampScalePanels();
});

