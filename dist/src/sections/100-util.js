// ===== UTIL =====
function sameToFips(code){ return code.substring(1); }
function getFips(f){ return (f.id || (f.properties.STATE + f.properties.COUNTY)).padStart(5,"0"); }

function getActiveTimestamp(){
    return historyModeActive && historyFrameTimestamp ? historyFrameTimestamp : Date.now();
}

function getHistoryRetentionMs(){
    return historyRetentionDays * 24 * 60 * 60 * 1000;
}

function clampNumber(value,min,max,fallback){
    return WebmapPure.clampNumber(value,min,max,fallback);
}

function getValidLatLng(latValue,lonValue){
    return WebmapPure.getValidLatLng(latValue,lonValue);
}

function getAlertIdHashInput(value){
    return WebmapPure.getAlertIdHashInput(value);
}

function hashAlertId(str){
    return WebmapPure.hashAlertId(str);
}

function hashText(str){
    return WebmapPure.hashText(str);
}

function stableStringify(value){
    return WebmapPure.stableStringify(value);
}

function getAlertMessageHash(alert){
    return WebmapPure.getAlertMessageHash(alert);
}

function getAlertDescriptionHash(alert){
    return WebmapPure.getAlertDescriptionHash(alert);
}

function renderAlertMessageHashLine(alert){
    return `<b>Message hash:</b> <span class="alert-reference-tree-hash">${escapeHtml(getAlertMessageHash(alert))}</span><br>`;
}

function renderAlertDescriptionHashLine(alert){
    return `<b>Description hash:</b> <span class="alert-reference-tree-hash">${escapeHtml(getAlertDescriptionHash(alert))}</span><br>`;
}

function getAlertReferenceHashes(alert){
    return WebmapPure.getAlertReferenceHashes(alert);
}

function renderAlertReferenceHashLinks(alert){
    const hashes=getAlertReferenceHashes(alert);
    if(!hashes.length) return "None";
    return hashes.map(hash=>
        `<button class="alert-reference-link" type="button" data-alert-ref-hash="${escapeHtml(hash)}" title="Search history for alert ${escapeHtml(hash)}">${escapeHtml(hash)}</button>`
    ).join(", ");
}

function getAlertDisplayHash(alert){
    return hashAlertId(alert?.id || getAlertCountId(alert));
}

function renderAlertIdHashLink(alert){
    const hash=getAlertDisplayHash(alert);
    return `<a class="alert-id-link" href="#alert-reference-tree-${encodeURIComponent(hash)}" data-alert-id-hash="${escapeHtml(hash)}" title="Show reference tree for alert ${escapeHtml(hash)}">${escapeHtml(hash)}</a>`;
}

function renderAlertHashPopupLink(hash){
    const normalizedHash=String(hash || "").trim().toLowerCase();
    if(!normalizedHash) return "N/A";
    return `<a class="alert-reference-link alert-reference-tree-hash" href="#alert-${encodeURIComponent(normalizedHash)}" data-alert-ref-hash="${escapeHtml(normalizedHash)}" title="Show alert ${escapeHtml(normalizedHash)}">${escapeHtml(normalizedHash)}</a>`;
}

function isExpired(a){
    return WebmapPure.isExpired(a,getActiveTimestamp());
}

function cloneJson(value){
    return WebmapPure.cloneJson(value);
}

function formatDateTimeLocal(timestamp){
    return WebmapPure.formatDateTimeLocal(timestamp);
}

function parseDateTimeLocal(value){
    return WebmapPure.parseDateTimeLocal(value);
}

function formatWmsTime(timestamp){
    return WebmapPure.formatWmsTime(timestamp);
}

function nextPaint(){
    return new Promise(resolve=>requestAnimationFrame(()=>resolve()));
}

function runWhenIdle(callback,timeout=1200){
    if("requestIdleCallback" in window){
        window.requestIdleCallback(callback,{ timeout });
    } else {
        setTimeout(callback,0);
    }
}

function withTimeout(promise,timeoutMs,message="Operation timed out"){
    let settled=false;
    return new Promise((resolve,reject)=>{
        const timer=setTimeout(()=>{
            if(settled) return;
            settled=true;
            reject(new Error(message));
        },timeoutMs);

        Promise.resolve(promise).then(
            value=>{
                if(settled) return;
                settled=true;
                clearTimeout(timer);
                resolve(value);
            },
            error=>{
                if(settled) return;
                settled=true;
                clearTimeout(timer);
                reject(error);
            }
        );
    });
}
