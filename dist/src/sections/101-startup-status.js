// ===== STARTUP STATUS =====
function setStartupStatus(key,message,state="loading"){
    const element=Webmap.services.dom.maybeById("startupStatus" + key.charAt(0).toUpperCase() + key.slice(1));
    if(!element) return;
    const label=element.querySelector(".startup-status-label");
    if(label){
        label.textContent=message;
    } else {
        element.textContent=message;
    }
    element.classList.toggle("done",state === "done");
    element.classList.toggle("error",state === "error");
    startupStatusState[key]=state === "done" || state === "error";
    updateStartupProgress();
    maybeHideStartupStatus();
}

function maybeHideStartupStatus(){
    const status=Webmap.services.dom.maybeById("startupStatus");
    if(!status) return;
    if(Object.values(startupStatusState).every(Boolean)){
        setTimeout(()=>status.classList.add("hidden"),900);
    }
}

function updateStartupProgress(){
    const total=Object.keys(startupStatusState).length;
    const complete=Object.values(startupStatusState).filter(Boolean).length;
    const percent=Math.round((complete / Math.max(1,total)) * 100);
    const bar=Webmap.services.dom.maybeById("startupProgressBar");
    const text=Webmap.services.dom.maybeById("startupProgressText");
    if(bar) bar.style.width=percent + "%";
    if(text) text.textContent=percent + "% complete";
}

function setStartupTaskProgress(key,percent){
    const bar=Webmap.services.dom.maybeById("startupProgress" + key.charAt(0).toUpperCase() + key.slice(1));
    if(!bar) return;
    bar.style.width=Math.min(Math.max(Math.round(percent),0),100) + "%";
}
