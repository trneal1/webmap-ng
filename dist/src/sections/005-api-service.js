// ===== API SERVICE =====
const COUNTY_GEOJSON_URL = "https://raw.githubusercontent.com/plotly/datasets/master/geojson-counties-fips.json";
const STATE_GEOJSON_URL = "https://raw.githubusercontent.com/PublicaMundi/MappingAPI/master/data/geojson/us-states.json";
const ELEVATION_QUERY_URL = "https://epqs.nationalmap.gov/v1/json";

async function fetchJson(url,options){
    const response=await fetch(url,options);
    if(!response.ok) throw new Error("Unable to fetch JSON: " + url);
    return response.json();
}

async function fetchBlob(url,options){
    const response=await fetch(url,options);
    if(!response.ok) throw new Error("Unable to fetch blob: " + url);
    return response.blob();
}

function fetchActiveAlerts(){
    return fetchJson(ALERTS_URL);
}

function fetchCountyGeoJson(){
    return fetchJson(COUNTY_GEOJSON_URL);
}

function fetchStateGeoJson(){
    return fetchJson(STATE_GEOJSON_URL);
}

function getRadarTileUrl(coords,timestamp){
    return RADAR_TILE_URL
        .replace("{z}",coords.z)
        .replace("{x}",coords.x)
        .replace("{y}",coords.y) + "?_t=" + timestamp;
}

function createLiveRadarLayer(opacity,timestamp=Date.now()){
    return L.tileLayer(
        RADAR_TILE_URL + "?_t=" + timestamp,
        { opacity }
    );
}

function createHistoryRadarWmsLayer(wmsTime,opacity){
    return L.tileLayer.wms(HISTORY_RADAR_WMS_URL,{
        layers:HISTORY_RADAR_WMS_LAYER,
        format:"image/png",
        transparent:true,
        version:"1.1.1",
        time:wmsTime,
        opacity,
        attribution:"IEM NEXRAD WMS-T"
    });
}

function getPrecipLayerName(range){
    return PRECIP_WMS_LAYERS[range] || PRECIP_WMS_LAYERS["1h"];
}

function createPrecipWmsLayer(range,opacity){
    return createWmsTileLayer(PRECIP_WMS_URL,{
        layers:getPrecipLayerName(range),
        pane:"precipPane",
        opacity,
        attribution:"NOAA/NWS MRMS QPE"
    });
}

function getWmsLegendUrl(url,layer,style=""){
    const params=new URLSearchParams({
        SERVICE:"WMS",
        VERSION:"1.3.0",
        REQUEST:"GetLegendGraphic",
        FORMAT:"image/png",
        LAYER:layer,
        STYLE:style
    });
    return url + "?" + params.toString();
}

function getPrecipLegendUrl(range){
    return getWmsLegendUrl(PRECIP_WMS_URL,getPrecipLayerName(range),"");
}

function getPrecipRasterFunctionName(range){
    return "rft_" + String(range || "1h").replace("h","hr");
}

function getPrecipMosaicRule(range){
    const hours=String(parseInt(range || "1h",10)).padStart(2,"0");
    return {
        mosaicMethod:"esriMosaicAttribute",
        sortField:"name",
        sortValue:"QPE_" + hours + "H",
        ascending:true,
        where:"idp_subset LIKE '%_QPE_" + hours + "H'"
    };
}

function getPrecipSampleUrl(latlng,range){
    const params=new URLSearchParams({
        geometry:JSON.stringify({
            x:latlng.lng,
            y:latlng.lat,
            spatialReference:{wkid:4326}
        }),
        geometryType:"esriGeometryPoint",
        sampleDistance:"1",
        sampleCount:"1",
        returnFirstValueOnly:"true",
        renderingRule:JSON.stringify({rasterFunction:getPrecipRasterFunctionName(range)}),
        mosaicRule:JSON.stringify(getPrecipMosaicRule(range)),
        f:"json"
    });
    return PRECIP_REST_URL + "/getSamples?" + params.toString();
}

function parsePrecipSampleInches(data){
    const millimeters=Number(data?.samples?.[0]?.value);
    if(!Number.isFinite(millimeters) || millimeters < 0) return null;
    return millimeters / PRECIP_MM_PER_INCH;
}

function fetchPrecipSample(latlng,range){
    return fetchJson(getPrecipSampleUrl(latlng,range)).then(parsePrecipSampleInches);
}

function getElevationSampleUrl(latlng){
    const params=new URLSearchParams({
        x:String(latlng.lng),
        y:String(latlng.lat),
        units:"Feet",
        wkid:"4326"
    });
    return ELEVATION_QUERY_URL + "?" + params.toString();
}

function parseElevationFeet(data){
    const feet=Number(data?.value);
    if(!Number.isFinite(feet) || feet <= -100000) return null;
    return feet;
}

function fetchElevationFeet(latlng){
    return fetchJson(getElevationSampleUrl(latlng)).then(parseElevationFeet);
}

function createLightningWmsLayer(opacity,timestamp=Date.now()){
    return createWmsTileLayer(LIGHTNING_WMS_URL,{
        layers:LIGHTNING_WMS_LAYER,
        styles:LIGHTNING_WMS_STYLE,
        pane:"lightningPane",
        opacity,
        attribution:"NOAA nowCOAST lightning density",
        extraOptions:{ _t:timestamp }
    });
}

function getLightningLegendUrl(){
    return getWmsLegendUrl(LIGHTNING_WMS_URL,LIGHTNING_WMS_LAYER,LIGHTNING_WMS_STYLE);
}

function createCloudWmsLayer(opacity,timestamp=Date.now()){
    return createWmsTileLayer(CLOUD_WMS_URL,{
        layers:CLOUD_WMS_LAYER,
        pane:"cloudPane",
        opacity,
        attribution:"NOAA nowCOAST satellite cloud imagery",
        extraOptions:{ _t:timestamp }
    });
}

const WebmapApiService = Object.freeze({
    fetchJson,
    fetchBlob,
    fetchActiveAlerts,
    fetchCountyGeoJson,
    fetchStateGeoJson,
    getRadarTileUrl,
    createLiveRadarLayer,
    createHistoryRadarWmsLayer,
    getPrecipLayerName,
    createPrecipWmsLayer,
    getPrecipLegendUrl,
    getPrecipRasterFunctionName,
    getPrecipMosaicRule,
    getPrecipSampleUrl,
    parsePrecipSampleInches,
    fetchPrecipSample,
    getElevationSampleUrl,
    parseElevationFeet,
    fetchElevationFeet,
    createLightningWmsLayer,
    getLightningLegendUrl,
    createCloudWmsLayer
});
