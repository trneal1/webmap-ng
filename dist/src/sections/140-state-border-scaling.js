// ===== STATE BORDER SCALING =====
function updateStateBorderWeight(){
    if(!stateLayer) return;
    const zoom = map.getZoom();
    const weight = Math.max(1.5, zoom * 0.5);
    stateLayer.setStyle({ weight: weight });
    updateStateLabelScale();
}

map.on("zoomend", updateStateBorderWeight);

