// ===== SEARCH =====
function evaluateSearch(query,text){
    return WebmapPure.evaluateSearch(query,text);
}

function buildText(a){
    let p=[];
    if(filters.fields.includes("event")) p.push(a.event);
    if(filters.fields.includes("headline")) p.push(a.headline);
    if(filters.fields.includes("description")) p.push(a.description);
    if(filters.fields.includes("areaDesc")) p.push(a.areaDesc);
    if(filters.fields.includes("id")) p.push(hashAlertId(a.id));
    return p.join(" ").toLowerCase();
}

function getFiltered(fips){
    return (rawData[fips]||[]).filter(a=>{
        if(filters.severity && a.severity!==filters.severity) return false;
        if(filters.expiredOnly && !isExpired(a)) return false;
        if(filters.eventTitleMode === "selected" && !filters.eventTitles.includes(a.event)) return false;
        if(filters.search && !evaluateSearch(filters.search,buildText(a))) return false;
        return true;
    });
}

function getEventTitleCounts(){
    const summary=getAlertTitleSummary(rawData,{ displayableCountiesOnly:true });
    return Object.keys(summary.alertTitleCounts)
        .map(title=>[
            title,
            {
                countyCount:summary.countyTitleCounts[title] || 0,
                alertCount:summary.alertTitleCounts[title] || 0
            }
        ])
        .filter(([,count])=>count.countyCount)
        .sort((a,b)=>a[0].localeCompare(b[0]));
}

function renderEventFilterList(){
    const list=Webmap.services.dom.maybeById('eventFilterList');
    const rows=getEventTitleCounts();

    if(!rows.length){
        list.innerHTML='<div class="alert">No event titles found</div>';
        return;
    }

    list.innerHTML=rows.map(([title,count])=>{
        const checked=filters.eventTitleMode === "all" || filters.eventTitles.includes(title);
        return `
        <label>
            <span class="event-row-main">
                <button class="event-cycle" type="button" data-title="${escapeHtml(title)}" data-direction="-1" aria-label="Previous county for ${escapeHtml(title)}" title="Previous county">&#9664;</button>
                <span class="event-title">
                    <input type="checkbox" value="${escapeHtml(title)}" ${checked ? "checked" : ""} data-change="updateEventTitleFilter">
                    <span>${escapeHtml(title)}</span>
                </span>
            </span>
            <span class="event-row-tools">
                <span class="event-count" title="Included counties / associated alerts">${count.countyCount}c/${count.alertCount}a</span>
                <button class="event-counties" type="button" data-title="${escapeHtml(title)}" aria-label="Show included counties for ${escapeHtml(title)}" title="Included counties">#</button>
                <button class="event-alerts" type="button" data-title="${escapeHtml(title)}" aria-label="Show active alert hashes for ${escapeHtml(title)}" title="Active alert hashes">ID</button>
                <button class="event-cycle" type="button" data-title="${escapeHtml(title)}" data-direction="1" aria-label="Next county for ${escapeHtml(title)}" title="Next county">&#9654;</button>
            </span>
        </label>`;
    }).join("");

    list.querySelectorAll('.event-cycle').forEach(button=>{
        Webmap.services.dom.listen(button,'click',()=>{
            cycleEventTitleCounty(button.dataset.title, Number(button.dataset.direction));
        });
    });
    list.querySelectorAll('.event-counties').forEach(button=>{
        Webmap.services.dom.listen(button,'click',()=>{
            openEventCountyPanel(button.dataset.title);
        });
    });
    list.querySelectorAll('.event-alerts').forEach(button=>{
        Webmap.services.dom.listen(button,'click',()=>{
            openEventAlertPanel(button.dataset.title);
        });
    });
}

function escapeHtml(value){
    return WebmapPure.escapeHtml(value);
}

function compareSameCode(a,b){
    return a.sameCode.localeCompare(b.sameCode);
}

function getAlertExpirationTime(alert){
    return WebmapPure.getAlertExpirationTime(alert);
}

function getAlertIssuedTime(alert){
    return WebmapPure.getAlertIssuedTime(alert);
}

function formatCountyExpirationTime(timestamp){
    if(!Number.isFinite(timestamp)) return "N/A";
    return new Date(timestamp).toLocaleString([],{
        month:"numeric",
        day:"numeric",
        hour:"numeric",
        minute:"2-digit"
    });
}

function updateEventTitleFilter(){
    const boxes=[...document.querySelectorAll('#eventFilterList input[type="checkbox"]')];
    const checked=boxes.filter(box=>box.checked).map(box=>box.value);
    filters.eventTitleMode=checked.length===boxes.length ? "all" : "selected";
    filters.eventTitles=filters.eventTitleMode === "all" ? [] : checked;
    redrawMap();
}

function selectAllEventTitles(){
    document.querySelectorAll('#eventFilterList input[type="checkbox"]').forEach(box=>box.checked=true);
    updateEventTitleFilter();
}

function selectNoEventTitles(){
    document.querySelectorAll('#eventFilterList input[type="checkbox"]').forEach(box=>box.checked=false);
    updateEventTitleFilter();
}

function clearEventTitles(){
    const snapshot=new Set(eventTitleFilterSnapshot.titles);
    document.querySelectorAll('#eventFilterList input[type="checkbox"]').forEach(box=>{
        box.checked=eventTitleFilterSnapshot.mode === "all" || snapshot.has(box.value);
    });
    updateEventTitleFilter();
}

function openEventFilterPopup(){
    eventTitleFilterSnapshot={
        mode:filters.eventTitleMode,
        titles:[...filters.eventTitles]
    };
    renderEventFilterList();
    eventFilterPanelController.open();
}

function closeEventFilterPopup(){
    eventFilterPanelController.close();
    closeAllEventDetailPanels();
    focusedEventTitle="";
    focusedEventCountyFips="";
    clearFocusedEventCountyHighlight();
}

function minimizeEventFilterPopup(){
    eventFilterPanelController.minimize();
}

function restoreEventFilterPopup(){
    eventFilterPanelController.restore();
}

function getEventTitleCountyDetails(title){
    return Object.entries(rawData)
        .map(([fips,alerts])=>{
            const matches=(alerts || []).filter(a=>(a.event || "Untitled") === title);
            if(!matches.length) return null;
            const feature=countyFeatureByFips[fips];
            if(!isEventTitleDisplayableCounty(fips) || !feature) return null;
            const stateFips=String(feature.properties.STATE).padStart(2,'0');
            return {
                fips,
                sameCode:String(fips).padStart(5,'0'),
                feature,
                name:feature.properties.NAME || fips,
                state:stateAbbreviations[stateFips] || stateFips,
                count:matches.length,
                expiresAt:Math.max(...matches.map(getAlertExpirationTime).filter(Number.isFinite))
            };
        })
        .filter(Boolean)
        .sort(compareSameCode);
}

function getEventTitleAlertDetails(title){
    const byId=new Map();
    Object.entries(rawData).forEach(([fips,alerts])=>{
        (alerts || []).forEach(alert=>{
            if((alert.event || "Untitled") !== title) return;
            const id=getAlertCountId(alert);
            if(!byId.has(id)){
                const feature=countyFeatureByFips[fips];
                byId.set(id,{
                    id,
                    hash:hashAlertId(alert.id || id),
                    alert,
                    fips,
                    feature,
                    headline:alert.headline || alert.description || title,
                    expiresAt:getAlertExpirationTime(alert)
                });
            }
        });
    });
    return [...byId.values()].sort((a,b)=>
        a.hash.localeCompare(b.hash) ||
        (a.headline || "").localeCompare(b.headline || "")
    );
}

function countyHasAlertId(fips,alertId){
    if(!alertId) return false;
    return (rawData[fips] || []).some(alert=>getAlertCountId(alert) === alertId);
}

function getCountyEventAlertIds(title,fips){
    const ids=new Set();
    (rawData[fips] || []).forEach(alert=>{
        if((alert.event || "Untitled") === title){
            ids.add(getAlertCountId(alert));
        }
    });
    return ids;
}

function getMostRecentlyIssuedCountyEventAlert(title,fips){
    return (rawData[fips] || [])
        .filter(alert=>(alert.event || "Untitled") === title)
        .sort((a,b)=>{
            const issuedDelta=(getAlertIssuedTime(b) || 0) - (getAlertIssuedTime(a) || 0);
            if(issuedDelta) return issuedDelta;
            return (getAlertExpirationTime(b) || 0) - (getAlertExpirationTime(a) || 0);
        })[0] || null;
}

function openEventCountyPanel(title){
    let panel=eventCountyPanels.get(title);
    if(!panel){
        panel=createEventDetailPanel('county',title);
        eventCountyPanels.set(title,panel);
    }
    renderEventCountyPanelContent(panel,title);
    bringEventDetailPanelToFront(panel);
}

function refreshEventCountyPanelIfOpen(){
    eventCountyPanels.forEach((panel,title)=>renderEventCountyPanelContent(panel,title));
}

function refreshEventAlertPanelIfOpen(){
    eventAlertPanels.forEach((panel,title)=>renderEventAlertPanelContent(panel,title));
}

function createEventDetailPanel(type,title){
    const panel=document.createElement('div');
    panel.className=`event-detail-panel event-${type}-panel`;
    panel.dataset.title=title;
    panel.dataset.type=type;
    panel.setAttribute('role','dialog');
    panel.setAttribute('aria-modal','false');
    panel.innerHTML=`
        <div class="event-detail-header">
            <h3></h3>
            <button class="event-detail-close" type="button" aria-label="Close ${type} list" title="Close">&times;</button>
        </div>
        <div class="event-detail-body"></div>`;
    Webmap.services.dom.listen(panel.querySelector('.event-detail-close'),'click',()=>closeEventDetailPanel(panel));
    eventDetailPanels.appendChild(panel);

    const panelCount=eventCountyPanels.size+eventAlertPanels.size;
    const rect=panel.getBoundingClientRect();
    const offset=(panelCount % 8)*24;
    panel.style.left=Math.max(0,(window.innerWidth-rect.width)/2+offset-84)+"px";
    panel.style.top=Math.min(Math.max(12,92+offset),Math.max(12,window.innerHeight-rect.height))+"px";
    panel.style.transform="none";
    clampEventDetailPanel(panel);
    return panel;
}

function bringEventDetailPanelToFront(panel){
    panel.style.zIndex=String(++eventDetailPanelZIndex);
}

function renderEventCountyPanelContent(panel,title){
    const heading=panel.querySelector('h3');
    const body=panel.querySelector('.event-detail-body');
    const counties=getEventTitleCountyDetails(title);
    const alertCount=getAlertTitleSummary(rawData).alertTitleCounts[title] || 0;
    const selectedAlertId=eventAlertPanelSelectedIds.get(title) || "";
    const selectedCountyFips=focusedEventTitle === title ? focusedEventCountyFips : "";

    heading.textContent=`${title} (${counties.length} counties / ${alertCount} alerts)`;
    if(!counties.length){
        body.innerHTML='<div class="alert">No included counties found</div>';
    } else {
        body.innerHTML=`
            <div class="event-county-row">
                <b>SAME</b>
                <b>County</b>
                <b class="event-county-count">Alerts</b>
                <b class="event-county-expires">Expires</b>
            </div>
            ${counties.map(county=>{
                const classes=["event-county-row"];
                if(String(county.fips) === String(selectedCountyFips)) classes.push("county-selected");
                if(countyHasAlertId(county.fips,selectedAlertId)) classes.push("alert-id-match");
                return `
                <div class="${classes.join(" ")}" data-fips="${escapeHtml(county.fips)}" data-title="${escapeHtml(title)}" title="Zoom to ${escapeHtml(county.name)}, ${escapeHtml(county.state)}">
                    <span class="event-county-code">${escapeHtml(county.sameCode)}</span>
                    <span class="event-county-name" title="${escapeHtml(county.name)}, ${escapeHtml(county.state)}">${escapeHtml(county.name)}, ${escapeHtml(county.state)}</span>
                    <span class="event-county-count">${county.count}</span>
                    <span class="event-county-expires" title="${Number.isFinite(county.expiresAt) ? escapeHtml(new Date(county.expiresAt).toLocaleString()) : "N/A"}">${escapeHtml(formatCountyExpirationTime(county.expiresAt))}</span>
                </div>`;
            }).join("")}`;
    }

    body.querySelectorAll('.event-county-row[data-fips]').forEach(row=>{
        Webmap.services.dom.listen(row,'click',()=>{
            focusEventCounty(row.dataset.title, row.dataset.fips);
        });
    });
    const firstMatch=body.querySelector('.event-county-row.county-selected') ||
        body.querySelector('.event-county-row.alert-id-match');
    if(firstMatch){
        firstMatch.scrollIntoView({ block:"nearest" });
    }
}

function openEventAlertPanel(title){
    let panel=eventAlertPanels.get(title);
    if(!panel){
        panel=createEventDetailPanel('alert',title);
        eventAlertPanels.set(title,panel);
    }
    renderEventAlertPanelContent(panel,title);
    bringEventDetailPanelToFront(panel);
}

function renderEventAlertPanelContent(panel,title){
    const heading=panel.querySelector('h3');
    const body=panel.querySelector('.event-detail-body');
    const alerts=getEventTitleAlertDetails(title);
    const countyAlertIds=focusedEventTitle === title && focusedEventCountyFips
        ? getCountyEventAlertIds(title,focusedEventCountyFips)
        : new Set();

    heading.textContent=`${title} (${alerts.length} unique alerts)`;
    if(!alerts.length){
        body.innerHTML='<div class="alert">No active alert hashes found</div>';
    } else {
        body.innerHTML=`
            <div class="event-alert-row">
                <b>Hash</b>
                <b>Headline</b>
                <b class="event-alert-expires">Expires</b>
            </div>
            ${alerts.map(item=>{
                const classes=["event-alert-row"];
                if(item.id === eventAlertPanelSelectedIds.get(title)) classes.push("alert-id-selected");
                if(countyAlertIds.has(item.id)) classes.push("county-alert-match");
                return `
                <div class="${classes.join(" ")}" data-alert-id="${escapeHtml(item.id)}" title="Show alert ${escapeHtml(item.hash)}">
                    <span class="event-alert-hash">${escapeHtml(item.hash)}</span>
                    <span class="event-alert-headline" title="${escapeHtml(item.headline)}">${escapeHtml(item.headline)}</span>
                    <span class="event-alert-expires" title="${Number.isFinite(item.expiresAt) ? escapeHtml(new Date(item.expiresAt).toLocaleString()) : "N/A"}">${escapeHtml(formatCountyExpirationTime(item.expiresAt))}</span>
                </div>`;
            }).join("")}`;
    }

    body.querySelectorAll('.event-alert-row[data-alert-id]').forEach(row=>{
        Webmap.services.dom.listen(row,'click',()=>showEventAlertById(title,row.dataset.alertId));
    });
    const firstMatch=body.querySelector('.event-alert-row.alert-id-selected') ||
        body.querySelector('.event-alert-row.county-alert-match');
    if(firstMatch){
        firstMatch.scrollIntoView({ block:"nearest" });
    }
}

function closeEventDetailPanel(panel){
    if(!panel) return;
    if(panel.dataset.type === 'county') eventCountyPanels.delete(panel.dataset.title);
    if(panel.dataset.type === 'alert') eventAlertPanels.delete(panel.dataset.title);
    if(panel.dataset.type === 'alert') eventAlertPanelSelectedIds.delete(panel.dataset.title);
    if(draggedEventDetailPanel === panel) draggedEventDetailPanel=null;
    panel.remove();
}

function closeTopmostEventDetailPanel(){
    const panels=[...document.querySelectorAll('.event-detail-panel')];
    if(!panels.length) return false;
    panels.sort((a,b)=>(Number(b.style.zIndex) || 0)-(Number(a.style.zIndex) || 0));
    closeEventDetailPanel(panels[0]);
    return true;
}

function closeAllEventDetailPanels(){
    [...document.querySelectorAll('.event-detail-panel')].forEach(closeEventDetailPanel);
}

function getHistoryAlertLocationLabel(fips){
    const feature=countyFeatureByFips[fips];
    if(!feature) return fips || "Unknown county";
    const stateFips=String(feature.properties.STATE || "").padStart(2,'0');
    const state=stateAbbreviations[stateFips] || stateFips;
    return `${feature.properties.NAME || fips}, ${state} (${String(fips).padStart(5,'0')})`;
}

function renderHistoryAlertReferencePopup(panel,alertHash,result,statusText=""){
    const heading=panel.querySelector('h3');
    const body=panel.querySelector('.event-detail-body');
    heading.textContent=`Alert ${alertHash}`;

    if(statusText){
        body.innerHTML=`<div class="alert">${escapeHtml(statusText)}</div>`;
        return;
    }

    if(!result?.alert){
        body.innerHTML=`<div class="alert">No matching alert found for ${escapeHtml(alertHash)}.</div>`;
        return;
    }

    const alert=result.alert;
    const frameTime=Number.isFinite(result.frame?.timestamp)
        ? new Date(result.frame.timestamp).toLocaleString()
        : "N/A";
    const frameLabel=getAlertReferenceTreeFrameLabel(result);
    body.innerHTML=`
        <div class="alert">
        <b>${escapeHtml(alert.event || "Untitled")}</b><br>
        <span>${escapeHtml(alert.messageType || "Alert")}</span><br>
        ${renderAlertMessageHashLine(alert)}
        <b>County:</b> ${escapeHtml(getHistoryAlertLocationLabel(result.fips))}<br>
        <b>Source:</b> ${escapeHtml(frameLabel)}<br>
        <b>Frame time:</b> ${escapeHtml(frameTime)}<br>
        <b>References:</b> ${renderAlertReferenceHashLinks(alert)}<br>
        <i>${escapeHtml(alert.severity || "N/A")}</i><br><br>

        <b>Start:</b> ${alert.sent ? escapeHtml(new Date(alert.sent).toLocaleString()) : "N/A"}<br>
        <b>Expires:</b> ${alert.expires ? escapeHtml(new Date(alert.expires).toLocaleString()) : "N/A"}<br><br>

        <b>Headline:</b><br>
        ${escapeHtml(alert.headline || "No headline provided.")}<br><br>

        <b>Description:</b><br>
        ${escapeHtml(alert.description || "No description provided.")}<br>
        ${renderAlertDescriptionHashLine(alert)}<br>

        <b>ID:</b> ${renderAlertIdHashLink(alert)}
        </div>`;
}

async function openAlertHashPopup(alertHash){
    const hash=String(alertHash || "").trim().toLowerCase();
    if(!hash) return;

    const panel=createEventDetailPanel('history-reference',hash);
    renderHistoryAlertReferencePopup(panel,hash,null,"Searching alerts...");
    bringEventDetailPanelToFront(panel);

    try{
        const result=await findAnyAlertByHash(hash);
        if(!panel.isConnected) return;
        renderHistoryAlertReferencePopup(panel,hash,result);
        clampEventDetailPanel(panel);
    }catch(error){
        console.warn("Unable to search for alert hash",error);
        if(panel.isConnected){
            renderHistoryAlertReferencePopup(panel,hash,null,"Unable to search alerts.");
        }
    }
}

function getAlertReferenceTreeIssuedLabel(result){
    const alert=result?.alert;
    const issued=getAlertIssuedTime(alert);
    if(Number.isFinite(issued)) return new Date(issued).toLocaleString();
    if(Number.isFinite(result?.frame?.timestamp)) return new Date(result.frame.timestamp).toLocaleString();
    return "N/A";
}

function getAlertReferenceTreeFrameLabel(result){
    if(result?.frame?.source === "current") return historyModeActive ? "current history frame" : "current alerts";
    if(result?.frame?.source === "live") return "live alerts";
    if(Number.isFinite(result?.frame?.timestamp)) return "saved " + new Date(result.frame.timestamp).toLocaleString();
    return "not found in retained history";
}

async function buildAlertReferenceTreeNode(alertHash,seedResult=null,visited=new Set(),depth=0){
    const hash=String(alertHash || "").trim().toLowerCase();
    const node={
        hash,
        result:null,
        children:[],
        cycle:false,
        depthLimit:false
    };
    if(!hash) return node;
    if(visited.has(hash)){
        node.cycle=true;
        return node;
    }
    if(depth > 24){
        node.depthLimit=true;
        return node;
    }

    const nextVisited=new Set(visited);
    nextVisited.add(hash);
    node.result=seedResult || await findAnyAlertByHash(hash);

    const references=getAlertReferenceHashes(node.result?.alert);
    for(const referenceHash of references){
        node.children.push(await buildAlertReferenceTreeNode(referenceHash,null,nextVisited,depth + 1));
    }

    return node;
}

function renderAlertReferenceTreeNode(node){
    const result=node.result;
    const alert=result?.alert;
    const title=alert
        ? escapeHtml(alert.event || alert.headline || "Untitled")
        : "Not found";
    const issued=alert ? escapeHtml(getAlertReferenceTreeIssuedLabel(result)) : "";
    const source=escapeHtml(getAlertReferenceTreeFrameLabel(result));
    const classes=["alert-reference-tree-node"];
    if(!alert) classes.push("missing");

    let status="";
    if(node.cycle) status="Already shown above";
    if(node.depthLimit) status="Reference depth limit reached";
    if(!alert && !status) status="No retained history match";

    return `
        <div class="${classes.join(" ")}">
            <div class="alert-reference-tree-row">
                ${renderAlertHashPopupLink(node.hash)}
                <span class="alert-reference-tree-meta">
                    <div class="alert-reference-tree-title" title="${title}">${title}</div>
                    ${issued ? `<div class="alert-reference-tree-time">Issued: ${issued}</div>` : ""}
                    <div class="alert-reference-tree-time">${source}</div>
                    ${status ? `<div>${escapeHtml(status)}</div>` : ""}
                </span>
            </div>
            ${node.children.length ? `<div class="alert-reference-tree-children">${node.children.map(renderAlertReferenceTreeNode).join("")}</div>` : ""}
        </div>`;
}

function renderAlertReferenceTreePopup(panel,alertHash,tree=null,statusText=""){
    const heading=panel.querySelector('h3');
    const body=panel.querySelector('.event-detail-body');
    heading.textContent=`Reference Tree ${alertHash}`;
    if(statusText){
        body.innerHTML=`<div class="alert">${escapeHtml(statusText)}</div>`;
        return;
    }
    body.innerHTML=`
        <div class="alert-reference-tree-tools">
            <button type="button" data-reference-tree-action="expand">Expand</button>
            <button type="button" data-reference-tree-action="collapse">Collapse</button>
        </div>
        <div class="alert-reference-tree">${renderAlertReferenceTreeNode(tree)}</div>`;
}

async function openAlertReferenceTreePopup(alertHash){
    const hash=String(alertHash || "").trim().toLowerCase();
    if(!hash) return;

    const panel=createEventDetailPanel('reference-tree',hash);
    renderAlertReferenceTreePopup(panel,hash,null,"Building reference tree...");
    bringEventDetailPanelToFront(panel);

    try{
        const seedResult=await findAnyAlertByHash(hash);
        const tree=await buildAlertReferenceTreeNode(hash,seedResult);
        if(!panel.isConnected) return;
        renderAlertReferenceTreePopup(panel,hash,tree);
        clampEventDetailPanel(panel);
    }catch(error){
        console.warn("Unable to build alert reference tree",error);
        if(panel.isConnected){
            renderAlertReferenceTreePopup(panel,hash,null,"Unable to build reference tree.");
        }
    }
}

function showEventAlertById(title,alertId){
    focusedEventTitle="";
    focusedEventCountyFips="";
    clearFocusedEventCountyHighlight();
    eventAlertPanelSelectedIds.set(title,alertId);
    refreshEventAlertPanelIfOpen();
    refreshEventCountyPanelIfOpen();

    for(const [fips,alerts] of Object.entries(rawData)){
        if(!(alerts || []).some(alert=>getAlertCountId(alert) === alertId)) continue;
        const feature=countyFeatureByFips[fips];
        if(!feature) continue;
        showSidebar(fips,feature.properties.NAME || fips,feature,true,alertId);
        return;
    }
}

function focusEventCounty(title,fips){
    const feature=countyFeatureByFips[fips];
    const alerts=rawData[fips] || [];
    if(!feature || !alerts.some(a=>(a.event || "Untitled") === title)) return;

    const focusAlert=getMostRecentlyIssuedCountyEventAlert(title,fips);
    const focusAlertId=focusAlert ? getAlertCountId(focusAlert) : null;

    focusedEventTitle=title;
    focusedEventCountyFips=fips;
    eventAlertPanelSelectedIds.delete(title);
    updateFocusedEventCountyHighlight();
    refreshEventCountyPanelIfOpen();
    refreshEventAlertPanelIfOpen();

    const bounds=L.geoJson(feature).getBounds();
    if(bounds.isValid()){
        map.fitBounds(bounds,{ padding:[48,48], maxZoom:8, animate:true });
    }

    showSidebar(fips,feature.properties.NAME || fips,feature,true,focusAlertId);
}

function getEventTitleCounties(title){
    return Object.entries(rawData)
        .filter(([,alerts])=>alerts.some(a=>(a.event || "Untitled") === title))
        .map(([fips])=>{
            const feature=countyFeatureByFips[fips];
            if(!feature) return null;
            const stateFips=String(feature.properties.STATE).padStart(2,'0');
            return {
                fips,
                sameCode:String(fips).padStart(5,'0'),
                feature,
                name:feature.properties.NAME || fips,
                state:stateAbbreviations[stateFips] || stateFips
            };
        })
        .filter(Boolean)
        .sort(compareSameCode);
}

function cycleEventTitleCounty(title,direction){
    const counties=getEventTitleCounties(title);
    if(!counties.length) return;

    const current=eventTitleCyclePositions[title] ?? (direction > 0 ? -1 : 0);
    const next=(current + direction + counties.length) % counties.length;
    eventTitleCyclePositions[title]=next;

    focusEventCounty(title,counties[next].fips);
}

