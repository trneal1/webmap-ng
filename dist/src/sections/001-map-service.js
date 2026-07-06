// ===== MAP SERVICE =====
const map = L.map('map', {
    wheelPxPerZoomLevel: 150,
    keyboard: false
}).setView([37.8,-96],4);

const baseLayers = {
    'Street': L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; OpenStreetMap contributors'
    }),
    'Topological': L.tileLayer('https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; OpenStreetMap contributors &copy; OpenTopoMap (CC-BY-SA)',
        subdomains: 'abc',
        maxZoom: 17
    })
};

let currentBaseLayer = baseLayers['Street'].addTo(map);

// Explicitly disable keyboard handling.
if(map.keyboard){
    map.keyboard.disable();
}

function createMapPane(name,zIndex,pointerEvents=null){
    map.createPane(name);
    map.getPane(name).style.zIndex = zIndex;
    if(pointerEvents !== null) map.getPane(name).style.pointerEvents = pointerEvents;
}

createMapPane('precipPane',450,'none');
createMapPane('cloudPane',350,'none');
createMapPane('lightningPane',460,'none');
createMapPane('alertPolygonPane',425);

function createWmsTileLayer(url,options){
    const {
        layers,
        styles="",
        format="image/png",
        transparent=true,
        version="1.3.0",
        pane,
        opacity,
        tileSize=512,
        keepBuffer=4,
        updateWhenIdle=true,
        updateWhenZooming=false,
        detectRetina=false,
        crossOrigin=true,
        attribution,
        extraOptions={}
    }=options;

    return L.tileLayer.wms(url,{
        layers,
        styles,
        format,
        transparent,
        version,
        pane,
        opacity,
        tileSize,
        keepBuffer,
        updateWhenIdle,
        updateWhenZooming,
        detectRetina,
        crossOrigin,
        attribution,
        ...extraOptions
    });
}

const WebmapMapService = Object.freeze({
    map,
    baseLayers,
    createMapPane,
    createWmsTileLayer
});
