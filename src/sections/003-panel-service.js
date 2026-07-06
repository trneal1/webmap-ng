// ===== PANEL SERVICE =====
function clampElementToViewport(element,options={}){
    if(!element || !element.isConnected) return;
    if(options.requireClass && !element.classList.contains(options.requireClass)) return;

    const rect=element.getBoundingClientRect();
    const maxLeft=Math.max(0,window.innerWidth-rect.width);
    const maxTop=Math.max(0,window.innerHeight-rect.height);
    const left=Math.min(Math.max(rect.left,0),maxLeft);
    const top=Math.min(Math.max(rect.top,0),maxTop);

    element.style.left=left+"px";
    element.style.top=top+"px";
    (options.resetStyles || []).forEach(property=>{
        element.style[property]=options.resetValue ?? "none";
    });
    Object.entries(options.extraStyles || {}).forEach(([property,value])=>{
        element.style[property]=value;
    });
}

function anchorElementForDrag(element,options={}){
    const rect=element.getBoundingClientRect();
    element.style.left=rect.left+"px";
    element.style.top=rect.top+"px";
    (options.resetStyles || []).forEach(property=>{
        element.style[property]=options.resetValue ?? "none";
    });
    Object.entries(options.extraStyles || {}).forEach(([property,value])=>{
        element.style[property]=value;
    });
    return rect;
}

function moveElementWithinViewport(element,clientX,clientY,offset){
    const rect=element.getBoundingClientRect();
    const maxLeft=Math.max(0,window.innerWidth-rect.width);
    const maxTop=Math.max(0,window.innerHeight-rect.height);
    const left=Math.min(Math.max(clientX-offset.x,0),maxLeft);
    const top=Math.min(Math.max(clientY-offset.y,0),maxTop);

    element.style.left=left+"px";
    element.style.top=top+"px";
}

function makeDraggablePanel({panel,handle,ignoreSelector="button",resetStyles=[],extraStyles={},onStart,onEnd}){
    let isDragging=false;
    let dragOffset={ x:0, y:0 };

    const clamp=()=>clampElementToViewport(panel,{ resetStyles, extraStyles });

    handle.addEventListener('mousedown',(e)=>{
        if(e.button !== 0 || (ignoreSelector && e.target.closest(ignoreSelector))) return;

        const rect=anchorElementForDrag(panel,{ resetStyles, extraStyles });
        isDragging=true;
        dragOffset={
            x:e.clientX-rect.left,
            y:e.clientY-rect.top
        };
        if(onStart) onStart(panel,e);
        e.preventDefault();
    });

    document.addEventListener('mousemove',(e)=>{
        if(!isDragging) return;
        moveElementWithinViewport(panel,e.clientX,e.clientY,dragOffset);
    });

    document.addEventListener('mouseup',()=>{
        if(!isDragging) return;
        isDragging=false;
        if(onEnd) onEnd(panel);
    });

    return {
        clamp,
        isDragging:()=>isDragging
    };
}

function createPanelController({
    panel,
    minimizedKey=null,
    dragController=null,
    updateRestoreDock=null,
    onOpen=null,
    onClose=null,
    onMinimize=null,
    onRestore=null
}){
    function setMinimized(value){
        if(minimizedKey && minimizedPanels){
            minimizedPanels[minimizedKey]=value;
        }
    }

    function updateDock(){
        if(updateRestoreDock) updateRestoreDock();
    }

    function clamp(){
        if(dragController) dragController.clamp();
    }

    function open(){
        panel.classList.add('open');
        panel.classList.remove('minimized');
        setMinimized(false);
        if(onOpen) onOpen(panel);
        updateDock();
        clamp();
    }

    function close(){
        panel.classList.remove('open','minimized');
        setMinimized(false);
        if(onClose) onClose(panel);
        updateDock();
    }

    function minimize(){
        if(!panel.classList.contains('open')) return;
        panel.classList.add('minimized');
        setMinimized(true);
        if(onMinimize) onMinimize(panel);
        updateDock();
    }

    function restore(){
        panel.classList.add('open');
        panel.classList.remove('minimized');
        setMinimized(false);
        if(onRestore) onRestore(panel);
        updateDock();
        clamp();
    }

    function toggle(){
        if(panel.classList.contains('open') && panel.classList.contains('minimized')){
            restore();
        } else if(panel.classList.contains('open')){
            close();
        } else {
            open();
        }
    }

    return {
        open,
        close,
        minimize,
        restore,
        toggle,
        clamp,
        isOpen:()=>panel.classList.contains('open'),
        isMinimized:()=>panel.classList.contains('minimized')
    };
}

const WebmapPanelService = Object.freeze({
    clampElementToViewport,
    anchorElementForDrag,
    moveElementWithinViewport,
    makeDraggablePanel,
    createPanelController
});
