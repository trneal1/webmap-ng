// ===== RIGHT-CLICK PAN =====
const mapElement = Webmap.services.dom.byId('map');

// Check if map element is capturing keyboard events
Webmap.services.dom.listen(mapElement,'keydown',(e) => {
    e.stopPropagation(); // Prevent bubbling
}, true);

Webmap.services.dom.listen(mapElement,'keypress',(e) => {
    e.stopPropagation(); // Prevent bubbling
}, true);

Webmap.services.dom.listen(mapElement,'mousedown',(e) => {
    if (e.button !== 2) return; // Only right mouse button
    e.preventDefault();
    
    const mapRect = mapElement.getBoundingClientRect();
    const mapPoint = L.point(e.clientX - mapRect.left, e.clientY - mapRect.top);
    const clickedLatLng = map.containerPointToLatLng(mapPoint);
    map.panTo(clickedLatLng, { animate: true });
});

// Ensure document has focus for keyboard events
Webmap.services.dom.listen(mapElement,'click',() => {
    mapElement.blur(); // Remove focus from map
    document.body.focus(); // Give focus to body
});

// Disable context menu on map
Webmap.services.dom.listen(mapElement,'contextmenu',(e) => {
    e.preventDefault();
});

