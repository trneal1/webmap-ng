// ===== DOM SERVICE =====
function getDomElement(id){
    const element=document.getElementById(id);
    if(!element) throw new Error("Missing DOM element #" + id);
    return element;
}

function maybeGetDomElement(id){
    return document.getElementById(id);
}

function getDomElements(selector,root=document){
    return [...root.querySelectorAll(selector)];
}

function listenDom(target,type,handler,options){
    target.addEventListener(type,handler,options);
    return ()=>target.removeEventListener(type,handler,options);
}

function listenDomById(id,type,handler,options){
    return listenDom(getDomElement(id),type,handler,options);
}

function listenDocument(type,handler,options){
    return listenDom(document,type,handler,options);
}

function listenWindow(type,handler,options){
    return listenDom(window,type,handler,options);
}

function delegateDom(root,type,selector,handler,options){
    return listenDom(root,type,event=>{
        const target=event.target.closest(selector);
        if(!target || !root.contains(target)) return;
        handler(event,target);
    },options);
}

const WebmapDomService = Object.freeze({
    byId:getDomElement,
    maybeById:maybeGetDomElement,
    all:getDomElements,
    listen:listenDom,
    listenById:listenDomById,
    listenDocument,
    listenWindow,
    delegate:delegateDom
});
