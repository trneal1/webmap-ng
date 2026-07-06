// ===== INIT =====
setStartupStatus("counties","Counties: loading");
Webmap.services.api.fetchCountyGeoJson()
.then(g=>{
    geojsonData=g;
    countyFeatureByFips={};
    geojsonData.features.forEach(feature=>{
        countyFeatureByFips[getFips(feature)]=feature;
    });
    startWeatherRefreshTimer();
    setStartupStatus("counties","Counties: loading alerts");
    refresh()
        .then(()=>{
            setStartupStatus("counties","Counties: colorized","done");
            startHistoryBackgroundCachesAfterFirstMapPaint();
        })
        .catch(error=>{
            setStartupStatus("counties","Alerts: unavailable","error");
            console.warn("Unable to load initial alerts",error);
            startHistoryBackgroundCachesAfterFirstMapPaint();
        });
})
.catch(error=>{
    setStartupStatus("counties","Counties: unavailable","error");
    console.warn("Unable to load county geography",error);
});

setStartupStatus("states","States: loading");
Webmap.services.api.fetchStateGeoJson()
.then(states=>{
    stateLayer = L.geoJson(states, {
        style: { color:"#000", weight:2.5, fill:false },
        interactive:false
    }).addTo(map);

    buildStateLabelLayer(states);
    if(stateLabelsVisible){
        stateLabelLayer.addTo(map);
        startCurrentLocationCross();
    }
    updateStateBorderWeight();
    setStartupStatus("states","States: loaded","done");
})
.catch(error=>{
    setStartupStatus("states","States: unavailable","error");
    console.warn("Unable to load state geography",error);
});

startRadarRefreshTimer();

// Prevent map keyboard shortcuts when typing in sidebar
// Allow actual text input fields to receive characters.
Webmap.services.dom.listenById('sidebar','keydown',(e) => {
    if (isFormControl(e.target)) return;
    if (['c', 'C', 'r', 'R', 'm', 'M', 'i', 'o'].includes(e.key)) {
        e.preventDefault();
        e.stopPropagation();
    }
}, true);

Webmap.services.dom.listenById('sidebar','keyup',(e) => {
    if (isFormControl(e.target)) return;
    if (['c', 'C', 'r', 'R', 'm', 'M', 'i', 'o'].includes(e.key)) {
        e.preventDefault();
        e.stopPropagation();
    }
}, true);

