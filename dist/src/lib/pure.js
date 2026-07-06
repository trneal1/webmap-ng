(function(root,factory){
    const api=factory();
    if(typeof module === "object" && module.exports){
        module.exports=api;
    }
    root.WebmapPure=api;
})(typeof globalThis !== "undefined" ? globalThis : this,function(){
    function evaluateSearch(query,text){
        if(!query) return true;

        const searchableText=String(text || "").toLowerCase();
        const tokens=String(query).replace(/([()!&|])/g," $1 ")
            .toLowerCase().split(/\s+/).filter(token=>token.length);

        let i=0;

        function expr(){
            let value=term();
            while(tokens[i]==="|"){
                i++;
                value=value || term();
            }
            return value;
        }

        function term(){
            let value=factor();
            while(tokens[i]==="&"){
                i++;
                value=value && factor();
            }
            return value;
        }

        function factor(){
            const token=tokens[i];
            if(token==="!"){
                i++;
                return !factor();
            }
            if(token==="("){
                i++;
                const value=expr();
                i++;
                return value;
            }
            i++;
            return searchableText.includes(token);
        }

        try{
            return expr();
        }catch(error){
            return false;
        }
    }

    function escapeHtml(value){
        return String(value)
            .replace(/&/g,"&amp;")
            .replace(/</g,"&lt;")
            .replace(/>/g,"&gt;")
            .replace(/"/g,"&quot;")
            .replace(/'/g,"&#39;");
    }

    function getPriorityCategory(event){
        const normalizedEvent=String(event || "").toLowerCase();
        if(normalizedEvent.includes("tornado") && normalizedEvent.includes("warning")) return "tornado-warning";
        if(normalizedEvent.includes("warning")) return "warning";
        if(normalizedEvent.includes("watch")) return "watch";
        if(normalizedEvent.includes("advisory")) return "advisory";
        if(normalizedEvent.includes("statement")) return "statement";
        return "other";
    }

    function getAlertExpirationTime(alert){
        const timestamp=new Date(alert?.expires || alert?.ends || 0).getTime();
        return Number.isFinite(timestamp) ? timestamp : null;
    }

    function getAlertIssuedTime(alert){
        const timestamp=new Date(alert?.sent || alert?.effective || alert?.onset || 0).getTime();
        return Number.isFinite(timestamp) ? timestamp : null;
    }

    function clampNumber(value,min,max,fallback){
        const numericValue=Number(value);
        if(!Number.isFinite(numericValue)) return fallback;
        return Math.min(Math.max(numericValue,min),max);
    }

    function getValidLatLng(latValue,lonValue){
        const lat=Number(latValue);
        const lon=Number(lonValue);
        if(!Number.isFinite(lat) || !Number.isFinite(lon)) return null;
        if(lat < -90 || lat > 90 || lon < -180 || lon > 180) return null;
        return [lat,lon];
    }

    function isExpired(alert,activeTimestamp){
        const expirationTime=new Date(alert?.expires || 0).getTime();
        return Boolean(alert?.expires) && Number.isFinite(expirationTime) && expirationTime < activeTimestamp;
    }

    function cloneJson(value){
        return JSON.parse(JSON.stringify(value));
    }

    function formatDateTimeLocal(timestamp){
        const d=new Date(timestamp);
        const local=new Date(d.getTime() - d.getTimezoneOffset() * 60000);
        return local.toISOString().slice(0,16);
    }

    function parseDateTimeLocal(value){
        return value ? new Date(value).getTime() : NaN;
    }

    function formatWmsTime(timestamp){
        const rounded=Math.floor(timestamp / 300000) * 300000;
        return new Date(rounded).toISOString().replace(/\.\d{3}Z$/,"Z");
    }

    function getAlertIdHashInput(value){
        const raw=String(value || "");
        let normalized=raw;
        try{
            normalized=decodeURIComponent(raw);
        }catch(error){
            normalized=raw;
        }
        const urnIndex=normalized.toLowerCase().indexOf("urn:oid");
        return urnIndex >= 0 ? normalized.slice(urnIndex) : normalized;
    }

    function hashText(str){
        str=String(str || "");
        let hash=0;
        for(let i=0;i<str.length;i++){
            hash=(hash<<5)-hash+str.charCodeAt(i);
            hash|=0;
        }
        return (hash>>>0).toString(16);
    }

    function hashAlertId(str){
        return hashText(getAlertIdHashInput(str));
    }

    function stableStringify(value){
        if(value === null || typeof value !== "object") return JSON.stringify(value);
        if(Array.isArray(value)) return "[" + value.map(stableStringify).join(",") + "]";
        return "{" + Object.keys(value).sort().map(key=>
            JSON.stringify(key) + ":" + stableStringify(value[key])
        ).join(",") + "}";
    }

    function getAlertMessageHash(alert){
        return hashText(stableStringify(alert || {}));
    }

    function getAlertDescriptionHash(alert){
        return hashText(alert?.description || "");
    }

    function getAlertReferenceHashes(alert){
        const hashes=(Array.isArray(alert?.references) ? alert.references : [])
            .map(reference=>{
                if(typeof reference === "string") return reference;
                return reference?.identifier || reference?.["@id"] || reference?.id || "";
            })
            .filter(Boolean)
            .map(hashAlertId);
        return [...new Set(hashes)];
    }

    return {
        evaluateSearch,
        escapeHtml,
        getPriorityCategory,
        getAlertExpirationTime,
        getAlertIssuedTime,
        clampNumber,
        getValidLatLng,
        isExpired,
        cloneJson,
        formatDateTimeLocal,
        parseDateTimeLocal,
        formatWmsTime,
        getAlertIdHashInput,
        hashText,
        hashAlertId,
        stableStringify,
        getAlertMessageHash,
        getAlertDescriptionHash,
        getAlertReferenceHashes
    };
});
