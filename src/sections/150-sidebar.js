// ===== SIDEBAR =====
function resizeMapAfterSidebarChange(){
    requestAnimationFrame(() => {
        map.invalidateSize();
        setTimeout(() => map.invalidateSize(), 100);
    });
}

function closeSidebar(){
    document.body.classList.add('sidebar-closed');
    resizeMapAfterSidebarChange();
}

function openSidebar(){
    document.body.classList.remove('sidebar-closed');
    resizeMapAfterSidebarChange();
}

function showSidebar(fips,name,f,shouldOpen=true,focusAlertId=null){
    if(shouldOpen) openSidebar();
    currentSidebarSelection={ fips, name, feature:f, focusAlertId };
    const alerts=rawData[fips]||[];
    const stateFips = String(f.properties.STATE).padStart(2,'0');
    const countyFips = String(f.properties.COUNTY).padStart(3,'0');
    const sameCode = stateFips + countyFips;
    const stateAbbr = stateAbbreviations[stateFips] || stateFips;
    let html = `<h3>${name}, ${stateAbbr} (${sameCode})</h3>`;
    if(historyMapActive){
        const count=historyMapCountyCounts[fips] || 0;
        html += `<div class="alert"><b>History map:</b> ${historyMapRangeLabel || "selected period"}<br><b>Alerts:</b> ${count}</div>`;
        html += `<div class="alert" id="historyMapCountyAlertList">Loading associated alerts...</div>`;
        content.innerHTML=html;
        loadHistoryMapCountyAlertsIntoSidebar(fips);
        return;
    }

    if(historyModeActive && historyFrameTimestamp){
        html += `<div class="alert"><b>History:</b> ${new Date(historyFrameTimestamp).toLocaleString()}</div>`;
    }

    if(!alerts.length){
        content.innerHTML=html+"No alerts";
        return;
    }

    const displayAlerts=[...alerts].sort((a,b)=>{
        if(focusAlertId){
            const aFocused=getAlertCountId(a) === focusAlertId;
            const bFocused=getAlertCountId(b) === focusAlertId;
            if(aFocused !== bFocused) return aFocused ? -1 : 1;
        }
        return new Date(a.expires) - new Date(b.expires);
    });

    displayAlerts.forEach(a=>{
        const isFocused=focusAlertId && getAlertCountId(a) === focusAlertId;
        html+=`
        <div class="alert" ${isFocused ? 'style="background:#fff7cc;border-left:4px solid #d99a00;padding-left:8px;"' : ""}>
        <b>${a.event}</b><br>
        <span>${a.messageType || "Alert"}</span><br>
        ${renderAlertMessageHashLine(a)}
        <b>References:</b> ${renderAlertReferenceHashLinks(a)}<br>
        <i>${a.severity}</i><br><br>

        <b>Start:</b> ${a.sent ? new Date(a.sent).toLocaleString() : "N/A"}<br>
        <b>Expires:</b> ${a.expires ? new Date(a.expires).toLocaleString() : "N/A"}<br>

        <b>Expires in:</b>
        <span class="timer" data-exp="${a.expires}" data-ref="${historyModeActive && historyFrameTimestamp ? historyFrameTimestamp : ""}"></span><br><br>

        <b>Description:</b><br>
        ${a.description || "No description provided."}<br>
        ${renderAlertDescriptionHashLine(a)}<br>

        <b>ID:</b> ${renderAlertIdHashLink(a)}
        </div>`;
    });

    content.innerHTML=html;
}

async function loadHistoryMapCountyAlertsIntoSidebar(fips){
    const token=++historyMapSidebarLoadToken;
    const list=Webmap.services.dom.maybeById('historyMapCountyAlertList');
    if(!list) return;

    try{
        const selection=getHistoryMapSelectionState();
        const cacheKey=getHistoryMapSidebarCacheKey(fips,selection);
        if(historyMapSidebarCache.has(cacheKey)){
            const cachedHtml=historyMapSidebarCache.get(cacheKey);
            historyMapSidebarCache.delete(cacheKey);
            historyMapSidebarCache.set(cacheKey,cachedHtml);
            list.outerHTML=cachedHtml;
            return;
        }

        const candidates=getHistoryMapCountyFrameCandidates(fips,selection);
        if(!candidates.length){
            list.innerHTML="No matching history alerts";
            return;
        }

        list.innerHTML="Loading associated alerts from " + candidates.length + (candidates.length === 1 ? " history frame..." : " history frames...");
        const seenIds=new Set();
        const mappedAlerts=[];

        for(const candidate of candidates){
            const frame=await loadHistoryFrame(candidate.timestamp);
            if(token !== historyMapSidebarLoadToken || !historyMapActive) return;
            const alerts=frame?.alerts?.[fips] || [];
            if(!Array.isArray(alerts)) continue;
            alerts.forEach(alert=>{
                const id=getHistoryMapAlertId(alert);
                if(!candidate.ids.has(id)) return;
                if(seenIds.has(id)) return;
                seenIds.add(id);
                mappedAlerts.push(alert);
            });
        }

        if(token !== historyMapSidebarLoadToken || !historyMapActive) return;
        if(!mappedAlerts.length){
            list.innerHTML="No matching history alerts";
            return;
        }

        mappedAlerts.sort((a,b)=>{
            const sentDelta=(new Date(a.sent || 0)) - (new Date(b.sent || 0));
            if(sentDelta) return sentDelta;
            return (a.event || "").localeCompare(b.event || "");
        });

        const html=mappedAlerts.map(a=>`
            <div class="alert">
            <b>${escapeHtml(a.event || "Untitled")}</b><br>
            <span>${escapeHtml(a.messageType || "Alert")}</span><br>
            ${renderAlertMessageHashLine(a)}
            <b>References:</b> ${renderAlertReferenceHashLinks(a)}<br>
            <i>${escapeHtml(a.severity || "N/A")}</i><br><br>

            <b>Start:</b> ${a.sent ? new Date(a.sent).toLocaleString() : "N/A"}<br>
            <b>Expires:</b> ${a.expires ? new Date(a.expires).toLocaleString() : "N/A"}<br><br>

            <b>Headline:</b><br>
            ${escapeHtml(a.headline || "No headline provided.")}<br><br>

            <b>Description:</b><br>
            ${escapeHtml(a.description || "No description provided.")}<br>
            ${renderAlertDescriptionHashLine(a)}<br>

            <b>ID:</b> ${renderAlertIdHashLink(a)}
            </div>
        `).join("");
        cacheHistoryMapSidebarHtml(cacheKey,html);
        list.outerHTML=html;
    }catch(error){
        console.warn("Unable to load history map county alerts",error);
        if(token === historyMapSidebarLoadToken){
            const currentList=Webmap.services.dom.maybeById('historyMapCountyAlertList');
            if(currentList) currentList.innerHTML="Unable to load associated alerts.";
        }
    }
}

