// ===== WEATHER PRIORITY PANEL =====
function normalizePrioritySettings(settings){
    const incomingOrder=Array.isArray(settings?.order) ? settings.order : [];
    const order=[
        ...incomingOrder.filter(category=>DEFAULT_PRIORITY_ORDER.includes(category)),
        ...DEFAULT_PRIORITY_ORDER.filter(category=>!incomingOrder.includes(category))
    ];
    const colors={...DEFAULT_PRIORITY_COLORS};
    if(settings?.colors && typeof settings.colors === "object"){
        DEFAULT_PRIORITY_ORDER.forEach(category=>{
            const color=settings.colors[category];
            if(/^#[0-9a-f]{6}$/i.test(color || "")){
                colors[category]=color;
            }
        });
    }
    return { order, colors };
}

function loadPrioritySettings(){
    try{
        prioritySettings=normalizePrioritySettings(JSON.parse(localStorage.getItem(PRIORITY_SETTINGS_KEY)) || {});
    }catch(error){
        prioritySettings=normalizePrioritySettings({});
    }
}

function savePrioritySettings(){
    localStorage.setItem(PRIORITY_SETTINGS_KEY,JSON.stringify(prioritySettings));
}

function formatPriorityLabel(category){
    return category.replace(/-/g," ");
}

function renderPriorityList(){
    if(!priorityList) return;
    priorityList.innerHTML=prioritySettings.order.map((category,index)=>`
        <div class="priority-row" data-category="${escapeHtml(category)}">
            <span class="priority-rank">${index + 1}</span>
            <span class="priority-name">${escapeHtml(formatPriorityLabel(category))}</span>
            <input type="color" value="${escapeHtml(prioritySettings.colors[category] || DEFAULT_PRIORITY_COLORS[category])}" data-change="changePriorityColor" data-category="${escapeHtml(category)}" aria-label="${escapeHtml(formatPriorityLabel(category))} color">
            <span class="priority-move-buttons">
                <button type="button" data-click="movePriorityCategory" data-category="${escapeHtml(category)}" data-direction="-1" ${index === 0 ? "disabled" : ""} aria-label="Move ${escapeHtml(formatPriorityLabel(category))} up" title="Move up">&uarr;</button>
                <button type="button" data-click="movePriorityCategory" data-category="${escapeHtml(category)}" data-direction="1" ${index === prioritySettings.order.length - 1 ? "disabled" : ""} aria-label="Move ${escapeHtml(formatPriorityLabel(category))} down" title="Move down">&darr;</button>
            </span>
        </div>
    `).join("");
}

function applyPrioritySettings(){
    savePrioritySettings();
    renderPriorityList();
    redrawMap();
}

function changePriorityColor(category,color){
    if(!DEFAULT_PRIORITY_ORDER.includes(category) || !/^#[0-9a-f]{6}$/i.test(color || "")) return;
    prioritySettings.colors[category]=color;
    applyPrioritySettings();
}

function movePriorityCategory(category,direction){
    const index=prioritySettings.order.indexOf(category);
    const nextIndex=index + direction;
    if(index < 0 || nextIndex < 0 || nextIndex >= prioritySettings.order.length) return;
    const nextOrder=[...prioritySettings.order];
    [nextOrder[index],nextOrder[nextIndex]]=[nextOrder[nextIndex],nextOrder[index]];
    prioritySettings.order=nextOrder;
    applyPrioritySettings();
}

function resetPrioritySettings(){
    prioritySettings=normalizePrioritySettings({});
    applyPrioritySettings();
}

function openPriorityPanel(){
    priorityPanelController.open();
}

function closePriorityPanel(){
    priorityPanelController.close();
}

function minimizePriorityPanel(){
    priorityPanelController.minimize();
}

function restorePriorityPanel(){
    priorityPanelController.restore();
}

function togglePriorityPanel(){
    priorityPanelController.toggle();
}

function clampPriorityPanel(){
    priorityPanelController.clamp();
}

const priorityPanelDragController=makeDraggablePanel({
    panel:priorityPanel,
    handle:priorityHeader,
    resetStyles:["transform"],
    onStart:()=>{ isDraggingPriorityPanel=true; },
    onEnd:()=>{ isDraggingPriorityPanel=false; }
});

const priorityPanelController=Webmap.services.panels.createPanelController({
    panel:priorityPanel,
    minimizedKey:"priority",
    dragController:priorityPanelDragController,
    updateRestoreDock:updatePanelRestoreDock,
    onOpen:renderPriorityList,
    onRestore:renderPriorityList
});

