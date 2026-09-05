// ===== DATA =====
function processAlerts(data){
    const out={};
    data.features.forEach(alert=>{
        const p=alert.properties;
        const codes=p.geocode?.SAME||[];

        const obj={
            id:alert.id,
            event:p.event||"",
            headline:p.headline||"",
            description:p.description||"",
            areaDesc:p.areaDesc||"",
            severity:p.severity||"",
            messageType:p.messageType||"",
            references:p.references||[],
            expires:p.expires,
            sent:p.sent
        };

        codes.forEach(code=>{
            const fips=sameToFips(code);
            if(!out[fips]) out[fips]=[];
            out[fips].push(obj);
        });
    });
    return out;
}

function getAlertPolygonStyle(feature){
    const category=getPriorityCategory(feature?.properties?.event);
    const color=getColor(category);
    const alertId=feature?.id || feature?.properties?.id;
    const selected=selectedAlertPolygonIds.has(alertId);
    return {
        pane:"alertPolygonPane",
        color,
        weight:selected ? 6 : 3,
        opacity:0.95,
        fill:true,
        fillColor:color,
        fillOpacity:selected ? 0.65 : 0.4,
        interactive:true
    };
}

function getAlertFromFeature(feature){
    const p=feature?.properties || {};
    return {
        id:feature?.id || p.id || "",
        event:p.event || "Untitled",
        headline:p.headline || "",
        description:p.description || "",
        areaDesc:p.areaDesc || "",
        severity:p.severity || "",
        messageType:p.messageType || "",
        references:p.references || [],
        expires:p.expires,
        sent:p.sent
    };
}

function showAlertPolygonsInSidebar(features){
    if(!features.length) return;
    openSidebar();
    currentSidebarSelection=null;

    const alerts=features
        .map(getAlertFromFeature)
        .sort((a,b)=>{
            const aRank=prioritySettings.order.indexOf(getPriorityCategory(a.event));
            const bRank=prioritySettings.order.indexOf(getPriorityCategory(b.event));
            return aRank - bRank || new Date(a.expires) - new Date(b.expires);
        });
    let html=`<h3>NWS Alert Polygons (${alerts.length})</h3>`;
    alerts.forEach(alert=>{
        html+=`
        <div class="alert" style="background:#fff7cc;border-left:4px solid ${getColor(getPriorityCategory(alert.event))};padding-left:8px;">
        <b>${alert.event}</b><br>
        <span>${alert.messageType || "Alert"}</span><br>
        ${renderAlertMessageHashLine(alert)}
        <i>${alert.severity}</i><br><br>

        <b>Area:</b> ${alert.areaDesc || "N/A"}<br>
        <b>Start:</b> ${alert.sent ? new Date(alert.sent).toLocaleString() : "N/A"}<br>
        <b>Expires:</b> ${alert.expires ? new Date(alert.expires).toLocaleString() : "N/A"}<br>
        <b>Expires in:</b> <span class="timer" data-exp="${alert.expires || ""}"></span><br><br>

        <b>Headline:</b><br>${alert.headline || "No headline provided."}<br><br>
        <b>Description:</b><br>${alert.description || "No description provided."}<br>
        ${renderAlertDescriptionHashLine(alert)}<br>
        <b>ID:</b> ${renderAlertIdHashLink(alert)}
        </div>`;
    });
    content.innerHTML=html;
}

function getAlertPolygonLayersAt(latlng){
    if(!alertPolygonLayer) return [];
    const point=map.latLngToLayerPoint(latlng);
    const matches=[];
    alertPolygonLayer.eachLayer(layer=>{
        if(typeof layer._containsPoint === "function" && layer._containsPoint(point)){
            matches.push(layer);
        }
    });
    return matches;
}

function selectAlertPolygonsAt(latlng){
    const layers=getAlertPolygonLayersAt(latlng);
    const features=layers.map(layer=>layer.feature).filter(Boolean);
    selectedAlertPolygonIds=new Set(features.map(feature=>feature.id || feature.properties?.id).filter(Boolean));
    if(alertPolygonLayer) alertPolygonLayer.setStyle(getAlertPolygonStyle);
    showAlertPolygonsInSidebar(features);
}

function redrawAlertPolygonLayer(){
    if(alertPolygonLayer){
        map.removeLayer(alertPolygonLayer);
        alertPolygonLayer=null;
    }
    if(!alertPolygonsVisible || historyMapActive) return;

    const sourceFeatures=historyModeActive ? historyAlertFeatures : liveAlertFeatures;
    const polygonFeatures=sourceFeatures
        .filter(feature=>{
            const type=feature?.geometry?.type;
            return type === "Polygon" || type === "MultiPolygon";
        })
        .sort((a,b)=>{
            const aRank=prioritySettings.order.indexOf(getPriorityCategory(a?.properties?.event));
            const bRank=prioritySettings.order.indexOf(getPriorityCategory(b?.properties?.event));
            return bRank - aRank;
        });
    if(!polygonFeatures.length) return;

    alertPolygonLayer=L.geoJson({
        type:"FeatureCollection",
        features:polygonFeatures
    },{
        pane:"alertPolygonPane",
        style:getAlertPolygonStyle,
        interactive:true,
        onEachFeature:(feature,layer)=>{
            layer.on("click",event=>{
                if(event.originalEvent) L.DomEvent.stopPropagation(event.originalEvent);
                selectAlertPolygonsAt(event.latlng);
            });
        }
    }).addTo(map);
}

function toggleAlertPolygons(){
    alertPolygonsVisible=!alertPolygonsVisible;
    redrawAlertPolygonLayer();
}

async function refresh(){
    nextWeatherUpdate = Date.now() + weatherUpdateInterval;
    const d=await Webmap.services.api.fetchActiveAlerts();
    liveAlertFeatures=Array.isArray(d.features) ? d.features : [];
    liveRawData=processAlerts(d);
    if(historyRecordingEnabled){
        weatherUpdatesSinceHistoryFrame++;
    } else {
        weatherUpdatesSinceHistoryFrame=0;
    }
    const shouldSaveHistorySnapshot=historyRecordingEnabled && weatherUpdatesSinceHistoryFrame >= historyFrameWeatherUpdates;
    if(shouldSaveHistorySnapshot){
        weatherUpdatesSinceHistoryFrame=0;
    }

    if(!historyModeActive){
        rawData=liveRawData;
        eventTitleCyclePositions={};
        refreshEventFilterListIfOpen();
        redrawMap();
    }

    if(shouldSaveHistorySnapshot){
        saveHistorySnapshot(liveRawData).catch(error=>{
            console.warn("Unable to save history snapshot",error);
        });
    }
}

function updateTornadoWarningBanner(){
    const banner=Webmap.services.dom.maybeById('tornadoWarningBanner');
    if(!banner) return;
    if(historyMapActive){
        banner.classList.remove('active');
        return;
    }

    const hasTornadoWarning=Object.values(rawData).some(alerts =>
        alerts.some(alert => getPriorityCategory(alert.event) === "tornado-warning")
    );

    banner.classList.toggle('active', hasTornadoWarning);
}

