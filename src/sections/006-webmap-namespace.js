// ===== WEBMAP NAMESPACE =====
const WebmapActions = Object.create(null);

function registerWebmapAction(name,handler){
    if(typeof name !== "string" || !name) throw new Error("Action name is required");
    if(typeof handler !== "function") throw new Error("Action handler is required");
    WebmapActions[name]=handler;
    return handler;
}

window.Webmap = Object.freeze({
    config:WebmapConfig,
    state:WebmapState,
    services:Object.freeze({
        api:WebmapApiService,
        dom:WebmapDomService,
        map:WebmapMapService,
        panels:WebmapPanelService,
        pure:WebmapPure
    }),
    actions:WebmapActions,
    registerAction:registerWebmapAction
});

const Webmap = window.Webmap;
