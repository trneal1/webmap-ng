// ===== SHORTCUT HELP PANEL =====
const shortcutHelpPanel=Webmap.services.dom.byId('shortcutHelpPanel');
const shortcutHelpHeader=Webmap.services.dom.byId('shortcutHelpHeader');

function openShortcutHelpPanel(){
    shortcutHelpPanelController.open();
}

function closeShortcutHelpPanel(){
    shortcutHelpPanelController.close();
}

function toggleShortcutHelpPanel(){
    shortcutHelpPanelController.toggle();
}

function clampShortcutHelpPanel(){
    shortcutHelpPanelController.clamp();
}

const shortcutHelpPanelDragController=makeDraggablePanel({
    panel:shortcutHelpPanel,
    handle:shortcutHelpHeader,
    resetStyles:["right"],
    extraStyles:{ right:"auto" },
    onStart:()=>{ isDraggingShortcutHelpPanel=true; },
    onEnd:()=>{ isDraggingShortcutHelpPanel=false; }
});

const shortcutHelpPanelController=Webmap.services.panels.createPanelController({
    panel:shortcutHelpPanel,
    dragController:shortcutHelpPanelDragController
});

loadSetupSettings();
loadPrioritySettings();
syncSetupControls();
setStartupStatus("setup","Setup: loaded","done");

