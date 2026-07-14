// Keep classic script execution order while code lives in section files.
const webmapSectionScripts = [
    'src/lib/pure.js',
    'src/sections/000-config.js',
    'src/sections/001-map-service.js',
    'src/sections/002-runtime-state.js',
    'src/sections/003-panel-service.js',
    'src/sections/004-dom-service.js',
    'src/sections/005-api-service.js',
    'src/sections/006-webmap-namespace.js',
    'src/sections/010-drag-resize.js',
    'src/sections/020-event-filter-drag.js',
    'src/sections/030-history-panel-drag.js',
    'src/sections/040-plot-panel.js',
    'src/sections/050-history-map-panel.js',
    'src/sections/100-util.js',
    'src/sections/101-startup-status.js',
    'src/sections/060-setup-panel.js',
    'src/sections/070-weather-priority-panel.js',
    'src/sections/080-shortcut-help-panel.js',
    'src/sections/090-timer.js',
    'src/sections/102-history-store.js',
    'src/sections/103-history-map.js',
    'src/sections/104-event-plot.js',
    'src/sections/105-history-panel.js',
    'src/sections/106-county-history-panel.js',
    'src/sections/110-search.js',
    'src/sections/120-data.js',
    'src/sections/130-map.js',
    'src/sections/140-state-border-scaling.js',
    'src/sections/150-sidebar.js',
    'src/sections/160-filters.js',
    'src/sections/170-radar.js',
    'src/sections/180-precipitation.js',
    'src/sections/190-lightning.js',
    'src/sections/200-clouds.js',
    'src/sections/210-init.js',
    'src/sections/220-update-timer.js',
    'src/sections/230-right-click-pan.js',
    'src/sections/240-keyboard-zoom-controls.js',
    'src/sections/250-dom-bindings.js',
];

function loadWebmapScript(scriptPath){
    return new Promise((resolve,reject)=>{
        const script=document.createElement('script');
        script.src=scriptPath;
        script.async=false;
        script.onload=resolve;
        script.onerror=()=>reject(new Error("Unable to load " + scriptPath));
        document.head.appendChild(script);
    });
}

(async function loadWebmapSections(){
    try{
        for(const scriptPath of webmapSectionScripts){
            await loadWebmapScript(scriptPath);
        }
    }catch(error){
        console.error("Unable to start NWS dashboard",error);
        const startupStatus=document.getElementById('startupStatus');
        const startupTitle=document.getElementById('startupStatusTitle');
        if(startupStatus && startupTitle){
            startupStatus.classList.remove('hidden');
            startupTitle.textContent="Unable to start dashboard";
        }
    }
})();
