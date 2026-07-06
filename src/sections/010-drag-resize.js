// ===== DRAG RESIZE =====
const resizer = Webmap.services.dom.byId('resizer');
const resizeSidebar = Webmap.services.dom.byId('sidebar');
const resizeMapElement = Webmap.services.dom.byId('map');
let isResizing = false;

Webmap.services.dom.listen(resizer,'mousedown',() => { isResizing = true; });

Webmap.services.dom.listenDocument('mousemove',(e) => {
    if (!isResizing) return;

    const totalWidth = window.innerWidth;
    const sidebarWidth = totalWidth - e.clientX;

    const min = 200;
    const max = totalWidth * 0.6;

    if (sidebarWidth < min || sidebarWidth > max) return;

    resizeSidebar.style.width = sidebarWidth + 'px';
    resizeMapElement.style.width = (totalWidth - sidebarWidth - 6) + 'px';

    // NEW: fix map rendering while resizing
    map.invalidateSize();
});

Webmap.services.dom.listenDocument('mouseup',() => { isResizing = false; });

