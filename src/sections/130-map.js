// ===== MAP =====
function getPriorityCategory(event) {
    return WebmapPure.getPriorityCategory(event);
}

function getColor(category) {
    return prioritySettings.colors[category] || DEFAULT_PRIORITY_COLORS[category] || DEFAULT_PRIORITY_COLORS.other;
}

function getAlertStyle(alerts, fillOpacity){
    const categories = alerts.map(a => getPriorityCategory(a.event));
    const highestCategory = prioritySettings.order.find(cat => categories.includes(cat)) || "other";
    return {
        fill:true,
        fillColor:getColor(highestCategory),
        fillOpacity,
        color:"#000",
        weight:0.4
    };
}

function getInactiveCountyStyle(fillOpacity=0.05){
    return {
        fill:true,
        fillColor:"#fff",
        fillOpacity,
        color:"#000",
        weight:0.4
    };
}

function ensureEventFocusPattern(){
    const svg=map.getPanes().overlayPane.querySelector('svg');
    if(!svg || svg.querySelector('#eventFocusHatch')) return;

    const ns='http://www.w3.org/2000/svg';
    const defs=document.createElementNS(ns,'defs');
    const pattern=document.createElementNS(ns,'pattern');
    pattern.setAttribute('id','eventFocusHatch');
    pattern.setAttribute('patternUnits','userSpaceOnUse');
    pattern.setAttribute('width','10');
    pattern.setAttribute('height','10');
    pattern.setAttribute('patternTransform','rotate(45)');

    const baseLine=document.createElementNS(ns,'line');
    baseLine.setAttribute('x1','0');
    baseLine.setAttribute('y1','0');
    baseLine.setAttribute('x2','0');
    baseLine.setAttribute('y2','10');
    baseLine.setAttribute('stroke','#fff');
    baseLine.setAttribute('stroke-width','5');
    baseLine.setAttribute('stroke-opacity','0.9');

    const topLine=document.createElementNS(ns,'line');
    topLine.setAttribute('x1','0');
    topLine.setAttribute('y1','0');
    topLine.setAttribute('x2','0');
    topLine.setAttribute('y2','10');
    topLine.setAttribute('stroke','#111');
    topLine.setAttribute('stroke-width','2');
    topLine.setAttribute('stroke-opacity','0.9');

    pattern.appendChild(baseLine);
    pattern.appendChild(topLine);
    defs.appendChild(pattern);
    svg.insertBefore(defs,svg.firstChild);
}

function clearFocusedEventCountyHighlight(){
    if(eventFocusLayer){
        map.removeLayer(eventFocusLayer);
        eventFocusLayer=null;
    }
}

function updateFocusedEventCountyHighlight(){
    clearFocusedEventCountyHighlight();
    if(!focusedEventTitle || !focusedEventCountyFips) return;

    const feature=countyFeatureByFips[focusedEventCountyFips];
    const alerts=rawData[focusedEventCountyFips] || [];
    const stillImpacted=feature && alerts.some(a=>(a.event || "Untitled") === focusedEventTitle);
    if(!stillImpacted){
        focusedEventTitle="";
        focusedEventCountyFips="";
        return;
    }

    ensureEventFocusPattern();
    eventFocusLayer=L.geoJson(feature,{
        interactive:false,
        style:{
            fill:true,
            fillColor:'url(#eventFocusHatch)',
            fillOpacity:1,
            color:'#111',
            weight:2.5,
            opacity:1
        }
    }).addTo(map);
    ensureEventFocusPattern();
    eventFocusLayer.bringToFront();
}

function getStateLabelText(feature){
    const props = feature.properties || {};
    const fips = String(props.STATE || props.STATEFP || feature.id || "").padStart(2,'0');
    if(stateAbbreviations[fips]) return stateAbbreviations[fips];

    const name = props.name || props.NAME || props.State || props.STATE_NAME;
    return stateNameToAbbreviation[name] || "";
}

function buildStateLabelLayer(states){
    stateLabelMarkers = [];
    states.features.forEach(feature => {
        const text = getStateLabelText(feature);
        if(!text) return;

        const center = L.geoJson(feature).getBounds().getCenter();
        const marker = L.marker(center, {
            interactive:false,
            keyboard:false,
            stateLabelText:text,
            icon:createStateLabelIcon(text)
        });
        stateLabelMarkers.push(marker);
    });
    stateLabelLayer = L.layerGroup(stateLabelMarkers);
}

function getStateLabelFontSize(){
    const zoom = map.getZoom();
    return Math.round(Math.min(28, Math.max(14, 8 + zoom * 2)));
}

function getCurrentLocationCrossSize(){
    const zoom = map.getZoom();
    return Math.round(Math.min(54, Math.max(24, 12 + zoom * 4)));
}

function createStateLabelIcon(text){
    const fontSize = getStateLabelFontSize();
    const width = Math.round(fontSize * 2.6);
    const height = Math.round(fontSize * 1.5);

    return L.divIcon({
        className:"state-label-icon",
        html:`<span style="font-size:${fontSize}px;">${text}</span>`,
        iconSize:[width,height],
        iconAnchor:[width / 2,height / 2]
    });
}

function removeCurrentLocationCrosshair(){
    if(currentLocationCrosshair){
        map.removeLayer(currentLocationCrosshair);
        currentLocationCrosshair=null;
    }
}

function createCurrentLocationCrosshair(){
    const center = L.latLng(labelLocationLatLng[0],labelLocationLatLng[1]);
    const size = getCurrentLocationCrossSize();
    const point = map.latLngToLayerPoint(center);
    const horizontalStart = map.layerPointToLatLng(L.point(point.x - size / 2,point.y));
    const horizontalEnd = map.layerPointToLatLng(L.point(point.x + size / 2,point.y));
    const verticalStart = map.layerPointToLatLng(L.point(point.x,point.y - size / 2));
    const verticalEnd = map.layerPointToLatLng(L.point(point.x,point.y + size / 2));

    const redWeight=Math.max(3,Math.round(size * 0.12));
    const whiteWeight=redWeight + 4;

    return L.featureGroup([
        L.polyline([horizontalStart,horizontalEnd],{
            color:"#fff",
            weight:whiteWeight,
            opacity:1,
            interactive:false
        }),
        L.polyline([verticalStart,verticalEnd],{
            color:"#fff",
            weight:whiteWeight,
            opacity:1,
            interactive:false
        }),
        L.polyline([horizontalStart,horizontalEnd],{
            color:"#d00000",
            weight:redWeight,
            opacity:1,
            interactive:false
        }),
        L.polyline([verticalStart,verticalEnd],{
            color:"#d00000",
            weight:redWeight,
            opacity:1,
            interactive:false
        })
    ]);
}

function updateCurrentLocationMarker(){
    if(!stateLabelsVisible || !labelLocationLatLng){
        removeCurrentLocationCrosshair();
        return;
    }

    removeCurrentLocationCrosshair();
    currentLocationCrosshair=createCurrentLocationCrosshair().addTo(map);
    currentLocationCrosshair.bringToFront();
}

function startCurrentLocationCross(){
    updateCurrentLocationMarker();
}

function stopCurrentLocationCross(){
    removeCurrentLocationCrosshair();
}

function updateStateLabelScale(){
    if(!stateLabelsVisible || !stateLabelLayer) return;

    stateLabelMarkers.forEach(marker => {
        const text = marker.options.stateLabelText;
        if(!text) return;
        marker.setIcon(createStateLabelIcon(text));
    });
    updateCurrentLocationMarker();
}

function toggleStateLabels(){
    stateLabelsVisible = !stateLabelsVisible;

    if(stateLabelsVisible){
        if(stateLabelLayer) stateLabelLayer.addTo(map);
        updateStateLabelScale();
        startCurrentLocationCross();
    } else {
        if(stateLabelLayer) map.removeLayer(stateLabelLayer);
        stopCurrentLocationCross();
    }
}

function getFeatureStyle(f){
    if(historyMapActive){
        return getHistoryMapFeatureStyle(f);
    }

    if(countyColorizationMode === 0){
        return getInactiveCountyStyle();
    }

    const fips = getFips(f);
    const filtered = getFiltered(fips);
    if(!filtered.length){
        if(countyColorizationMode === 2){
            return getInactiveCountyStyle();
        }
        if(filters.eventTitleMode === "selected" && !filters.eventTitles.length){
            const allAlerts = rawData[fips]||[];
            return allAlerts.length
                ? getAlertStyle(allAlerts, countyOpacityValue * 0.3)
                : getInactiveCountyStyle();
        }
        if(rawData[fips] && rawData[fips].length > 0){
            const allAlerts = rawData[fips];
            return getAlertStyle(allAlerts, countyOpacityValue * 0.3);
        } else {
            return getInactiveCountyStyle(0.05);
        }
    }
    return getAlertStyle(filtered, countyOpacityValue);
}

function redrawMap(){
    updateTornadoWarningBanner();

    Object.values(blinkIntervals).forEach(clearInterval);
    blinkIntervals={};
    clearActivePrecipTooltipTarget();

    if(geoLayer) map.removeLayer(geoLayer);
    clearFocusedEventCountyHighlight();

    geoLayer=L.geoJson(geojsonData,{
        style:getFeatureStyle,
        onEachFeature:(f,layer)=>{
            const fips=getFips(f);
            const alerts=rawData[fips]||[];
            const filteredAlerts=getFiltered(fips);
            const name=f.properties.NAME;

            let tooltip=historyMapActive
                ? name+" ("+(historyMapCountyCounts[fips] || 0)+" history alerts)"
                : name+" ("+alerts.length+")";

            if(historyMapActive && showEventsToggle.checked && historyMapCountyEvents[fips]){
                const rows=Object.entries(historyMapCountyEvents[fips])
                    .sort((a,b)=>b[1]-a[1] || a[0].localeCompare(b[0]))
                    .map(([event,count])=>`${escapeHtml(event)}: ${count}`);
                tooltip+="<br>"+rows.join("<br>");
            } else if(showEventsToggle.checked && alerts.length){
                const events=[...new Set(alerts.map(a=>a.event))];
                const colored=events.map(e =>
                    `<span style="color:${getColor(getPriorityCategory(e))};font-weight:bold;">●</span> ${e}`
                );
                tooltip+="<br>"+colored.join("<br>");
            }

            layer.bindTooltip(tooltip);
            layer.on("click",()=>showSidebar(fips,name,f));
            layer.on("mousemove",(event)=>{
                activeCountyCursorTarget={ layer, baseTooltip:tooltip, fips, name, feature:f, latlng:event.latlng };
                trackPrecipTooltipTarget(layer,tooltip,event.latlng);
            });
            layer.on("mouseover",(event)=>{
                activeCountyCursorTarget={ layer, baseTooltip:tooltip, fips, name, feature:f, latlng:event.latlng };
                trackPrecipTooltipTarget(layer,tooltip,event.latlng);
                if(historyMapActive){
                    if(!(historyMapCountyCounts[fips] || 0)) return;
                }
                layer.setStyle({ fillColor: "#999", fillOpacity: countyOpacityValue });
            });
            layer.on("mouseout",()=>{
                layer._precipTooltipToken=(layer._precipTooltipToken || 0) + 1;
                layer._elevationTooltipToken=(layer._elevationTooltipToken || 0) + 1;
                clearTimeout(layer._precipTooltipTimer);
                layer.setTooltipContent(tooltip);
                if(activePrecipTooltipTarget?.layer === layer) activePrecipTooltipTarget=null;
                if(activeCountyCursorTarget?.layer === layer) activeCountyCursorTarget=null;
                layer.setStyle(getFeatureStyle(f));
            });

            if(blinkToggle.checked &&
               !historyMapActive &&
               countyColorizationMode !== 0 &&
               filteredAlerts.some(a=>
                   String(a.messageType || "").toLowerCase() === "alert" &&
                   ((getActiveTimestamp()-new Date(a.sent).getTime())/1000)<3600
               )){
                let visible=true;
                blinkIntervals[fips]=setInterval(()=>{
                    visible=!visible;
                    layer.setStyle({
                        fillOpacity: visible
                            ? countyOpacityValue
                            : Math.max(0.1,countyOpacityValue*0.4)
                    });
                },800);
            }
        }
    }).addTo(map);

    updateFocusedEventCountyHighlight();
    redrawAlertPolygonLayer();
    if(stateLayer) stateLayer.bringToFront();
}

