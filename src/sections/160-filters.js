// ===== FILTERS =====
function applyFilters(){
    filters.severity=severityFilter.value;
    filters.search=searchFilter.value.toLowerCase();
    filters.expiredOnly=expiredOnlyToggle.checked;

    filters.fields=[];
    if(field_event.checked) filters.fields.push("event");
    if(field_headline.checked) filters.fields.push("headline");
    if(field_description.checked) filters.fields.push("description");
    if(field_area.checked) filters.fields.push("areaDesc");
    if(field_id.checked) filters.fields.push("id");

    redrawMap();
}

function clearSearch(){
    searchFilter.value="";
    filters.search="";
    redrawMap();
}

