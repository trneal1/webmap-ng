// ===== COUNTY HISTORY PANEL =====
function clampCountyHistoryPanel(){
    countyHistoryPanelDragController.clamp();
}

const countyHistoryPanelDragController=makeDraggablePanel({
    panel:countyHistoryPanel,
    handle:countyHistoryHeader,
    resetStyles:["transform"],
    onStart:()=>{ isDraggingCountyHistoryPanel=true; },
    onEnd:()=>{ isDraggingCountyHistoryPanel=false; }
});

const countyHistoryPanelController=Webmap.services.panels.createPanelController({
    panel:countyHistoryPanel,
    minimizedKey:"countyHistory",
    dragController:countyHistoryPanelDragController,
    updateRestoreDock:updatePanelRestoreDock,
    onClose:()=>{
        countyHistoryLoadToken++;
        countyHistoryLoading=false;
    },
    onRestore:()=>drawCountyHistoryPlot()
});

function openCountyHistoryFromTooltip(event){
    if(event){
        event.preventDefault();
        event.stopPropagation();
    }
    const target=event?.target?.closest?.('[data-fips]');
    const fips=target?.dataset?.fips || activeCountyCursorTarget?.fips || currentSidebarSelection?.fips || "";
    const name=target?.dataset?.name || activeCountyCursorTarget?.name || currentSidebarSelection?.name || fips;
    openCountyHistoryPanel(fips,name);
}

function getCountyHistoryRange(){
    const start=parseDateTimeLocal(countyHistoryStart.value);
    const stop=parseDateTimeLocal(countyHistoryStop.value);
    const lo=Number.isFinite(start) ? start : -Infinity;
    const hi=Number.isFinite(stop) ? stop : Infinity;
    return lo <= hi ? { start:lo, stop:hi } : { start:hi, stop:lo };
}

function setCountyHistoryStatus(message){
    countyHistoryStatus.textContent=message;
}

function getSelectedCountyHistoryEventTitles(){
    return [...countyHistoryEventTitles.selectedOptions].map(option=>option.value);
}

function clearCountyHistoryPlot(message="No data"){
    const context=countyHistoryCanvas.getContext('2d');
    context.clearRect(0,0,countyHistoryCanvas.width,countyHistoryCanvas.height);
    context.fillStyle="#fff";
    context.fillRect(0,0,countyHistoryCanvas.width,countyHistoryCanvas.height);
    context.fillStyle="#555";
    context.font="24px Arial";
    context.textAlign="center";
    context.textBaseline="middle";
    context.fillText(message,countyHistoryCanvas.width / 2,countyHistoryCanvas.height / 2);
    countyHistorySummary.textContent=message;
}

async function getCountyHistoryMetadata(){
    if(!historyIndexReady){
        await startHistoryIndexBackgroundLoad();
    }
    if(!countyHistoryBackfillReady && !countyHistoryBackfillLoading){
        startCountyHistoryBackfill();
    }
    return getCachedHistorySnapshots();
}

function setCountyHistoryDefaultRange(metadata){
    if(!metadata.length) return;
    if(!countyHistoryStart.value) countyHistoryStart.value=formatDateTimeLocal(metadata[0].timestamp);
    if(!countyHistoryStop.value) countyHistoryStop.value=formatDateTimeLocal(metadata[metadata.length - 1].timestamp);
}

function getCountyHistoryTotals(frames){
    const titleTotals=new Map();
    frames.forEach(frame=>{
        Object.entries(frame.alertCounts || {}).forEach(([title,count])=>{
            titleTotals.set(title,(titleTotals.get(title) || 0) + count);
        });
    });
    return titleTotals;
}

function getCountyHistoryFramesFromRecords(candidates,records){
    const recordsByTimestamp=new Map(records.map(record=>[record.timestamp,record]));
    return candidates.map(candidate=>({
        timestamp:candidate.timestamp,
        alertCounts:recordsByTimestamp.get(candidate.timestamp)?.alertCounts || {}
    }));
}

async function loadCountyHistoryDataFromSnapshots(fips,candidates){
    const frames=[];
    const recordsToCache=[];

    for(const candidate of candidates){
        const frame=await loadHistoryFrame(candidate.timestamp);
        const alertCounts=getCountyFrameAlertCounts(frame?.alerts?.[fips] || []);
        frames.push({
            timestamp:candidate.timestamp,
            alertCounts
        });
        recordsToCache.push({
            id:getCountyHistoryRecordId(fips,candidate.timestamp),
            fips:String(fips || ""),
            timestamp:candidate.timestamp,
            alertCounts
        });
    }

    saveCountyHistoryRecords(recordsToCache).catch(error=>{
        console.warn("Unable to backfill county history records",error);
    });

    return frames;
}

async function loadCountyHistoryData(fips,range){
    const metadata=await getCountyHistoryMetadata();
    setCountyHistoryDefaultRange(metadata);
    const boundedRange=range || getCountyHistoryRange();
    const candidates=metadata.filter(frame=>
        frame.timestamp >= boundedRange.start && frame.timestamp <= boundedRange.stop
    );

    if(!candidates.length){
        return {
            frames:[],
            titleTotals:new Map()
        };
    }

    const records=await loadCountyHistoryRecords(fips,boundedRange.start,boundedRange.stop);
    const recordTimestamps=new Set(records.map(record=>record.timestamp));
    const missingCandidates=candidates.filter(candidate=>!recordTimestamps.has(candidate.timestamp));
    const shouldBackfillMissing=!countyHistoryBackfillReady && missingCandidates.length;
    const backfilledFrames=shouldBackfillMissing
        ? await loadCountyHistoryDataFromSnapshots(fips,missingCandidates)
        : [];
    const mergedRecords=[
        ...records,
        ...backfilledFrames
    ];
    const frames=getCountyHistoryFramesFromRecords(candidates,mergedRecords);

    if(!records.length && !backfilledFrames.length){
        return {
            frames,
            titleTotals:new Map()
        };
    }
    const titleTotals=getCountyHistoryTotals(frames);

    return {
        frames,
        titleTotals
    };
}

function populateCountyHistoryEventTitles(titleTotals){
    const previousSelection=new Set(getSelectedCountyHistoryEventTitles());
    const titles=[...titleTotals.keys()].sort((a,b)=>a.localeCompare(b));
    countyHistoryEventTitles.innerHTML=titles.map(title=>{
        const selected=previousSelection.size ? previousSelection.has(title) : true;
        return `<option value="${escapeHtml(title)}" ${selected ? "selected" : ""}>${escapeHtml(title)} (${titleTotals.get(title)})</option>`;
    }).join("");
}

function buildCountyHistorySeries(){
    const selectedTitles=getSelectedCountyHistoryEventTitles();
    return selectedTitles.map(title=>({
        title,
        points:countyHistoryFrames.map(frame=>({
            timestamp:frame.timestamp,
            value:frame.alertCounts[title] || 0
        }))
    }));
}

function drawCountyHistoryLegend(context,series,width,dpr){
    const rowHeight=18 * dpr;
    const swatchSize=10 * dpr;
    const x=70 * dpr;
    let y=14 * dpr;
    context.font=(11 * dpr)+"px Arial";
    context.textAlign="left";
    context.textBaseline="middle";

    series.slice(0,8).forEach((item,index)=>{
        context.fillStyle=getPlotColor(index);
        context.fillRect(x,y - swatchSize / 2,swatchSize,swatchSize);
        context.fillStyle="#333";
        context.fillText(truncateCanvasText(context,item.title,width - x - 90 * dpr),x + 16 * dpr,y);
        y+=rowHeight;
    });

    if(series.length > 8){
        context.fillStyle="#555";
        context.fillText("+" + (series.length - 8) + " more",x,y);
    }
}

function drawCountyHistoryAxes(context,width,height,margin,points,maxValue,dpr,xScale,yScale){
    context.strokeStyle="#ddd";
    context.lineWidth=1 * dpr;
    context.fillStyle="#333";
    context.font=(11 * dpr)+"px Arial";
    context.textAlign="right";
    context.textBaseline="middle";

    const ySteps=Math.min(5,maxValue);
    for(let i=0;i<=ySteps;i++){
        const value=Math.round((maxValue * i) / ySteps);
        const y=yScale(value);
        context.beginPath();
        context.moveTo(margin.left,y);
        context.lineTo(width - margin.right,y);
        context.stroke();
        context.fillText(String(value),margin.left - 8 * dpr,y);
    }

    drawPlotDayDividers(context,points,margin,height,dpr,xScale);

    context.strokeStyle="#333";
    context.beginPath();
    context.moveTo(margin.left,margin.top);
    context.lineTo(margin.left,height - margin.bottom);
    context.lineTo(width - margin.right,height - margin.bottom);
    context.stroke();

    context.textAlign="center";
    context.textBaseline="top";
    const labelCount=Math.min(4,points.length);
    for(let i=0;i<labelCount;i++){
        const index=labelCount === 1 ? 0 : Math.round((points.length - 1) * i / (labelCount - 1));
        const point=points[index];
        context.fillText(new Date(point.timestamp).toLocaleString(),xScale(point.timestamp),height - margin.bottom + 10 * dpr);
    }
}

function drawCountyHistoryLines(context,series,width,height,dpr){
    const points=series[0]?.points || [];
    const visibleSeries=series.filter(item=>item.points.some(point=>point.value > 0));
    const margin={
        left:58 * dpr,
        right:18 * dpr,
        top:(visibleSeries.length > 1 ? 34 : 20) * dpr,
        bottom:52 * dpr
    };
    const plotWidth=width - margin.left - margin.right;
    const plotHeight=height - margin.top - margin.bottom;
    const minTime=points[0].timestamp;
    const maxTime=points[points.length - 1].timestamp;
    const maxValue=Math.max(1,...series.flatMap(item=>item.points.map(point=>point.value)));
    const xScale=timestamp=>margin.left + ((timestamp - minTime) / Math.max(1,maxTime - minTime)) * plotWidth;
    const yScale=value=>margin.top + plotHeight - (value / maxValue) * plotHeight;

    drawCountyHistoryAxes(context,width,height,margin,points,maxValue,dpr,xScale,yScale);

    series.forEach((item,index)=>{
        context.strokeStyle=getPlotColor(index);
        context.lineWidth=2.5 * dpr;
        context.beginPath();
        item.points.forEach((point,pointIndex)=>{
            const x=xScale(point.timestamp);
            const y=yScale(point.value);
            if(pointIndex === 0) context.moveTo(x,y);
            else context.lineTo(x,y);
        });
        context.stroke();

        context.fillStyle=getPlotColor(index);
        item.points.forEach(point=>{
            if(point.value <= 0) return;
            context.beginPath();
            context.arc(xScale(point.timestamp),yScale(point.value),3 * dpr,0,Math.PI * 2);
            context.fill();
        });
    });

    if(series.length > 1){
        drawCountyHistoryLegend(context,series,width,dpr);
    }
}

function drawCountyHistoryPlot(){
    if(!countyHistoryPanel.classList.contains('open')) return;

    const rect=countyHistoryCanvas.getBoundingClientRect();
    const dpr=window.devicePixelRatio || 1;
    const width=Math.max(320,Math.round(rect.width * dpr));
    const height=Math.max(220,Math.round(rect.height * dpr));
    if(countyHistoryCanvas.width !== width || countyHistoryCanvas.height !== height){
        countyHistoryCanvas.width=width;
        countyHistoryCanvas.height=height;
    }

    const context=countyHistoryCanvas.getContext('2d');
    context.clearRect(0,0,width,height);
    context.fillStyle="#fff";
    context.fillRect(0,0,width,height);

    if(countyHistoryLoading){
        clearCountyHistoryPlot("Loading county history...");
        return;
    }

    countyHistorySeries=buildCountyHistorySeries();
    if(!countyHistoryFrames.length){
        clearCountyHistoryPlot("No saved history in range");
        return;
    }
    if(!countyHistorySeries.length){
        clearCountyHistoryPlot("Select one or more alert types");
        return;
    }

    drawCountyHistoryLines(context,countyHistorySeries,width,height,dpr);
    const activeSeries=countyHistorySeries.filter(series=>series.points.some(point=>point.value > 0));
    const countyLabel=countyHistorySelection?.name || "County";
    setCountyHistoryStatus(countyLabel + ": " + countyHistoryFrames.length + (countyHistoryFrames.length === 1 ? " frame" : " frames"));
    countyHistorySummary.textContent=activeSeries.length
        ? activeSeries.length + " selected alert trace" + (activeSeries.length === 1 ? "" : "s")
        : "Selected alert types were not active in the plotted frames.";
}

async function reloadCountyHistoryFromControls(){
    if(!countyHistorySelection || countyHistoryLoading) return;
    const token=++countyHistoryLoadToken;
    countyHistoryLoading=true;
    setCountyHistoryStatus("Loading...");
    drawCountyHistoryPlot();
    await nextPaint();

    try{
        const result=await loadCountyHistoryData(countyHistorySelection.fips,getCountyHistoryRange());
        if(token !== countyHistoryLoadToken) return;
        countyHistoryFrames=result.frames;
        populateCountyHistoryEventTitles(result.titleTotals);
        countyHistoryLoading=false;
        setCountyHistoryStatus((countyHistorySelection.name || countyHistorySelection.fips) + ": " + countyHistoryFrames.length + " frames");
        drawCountyHistoryPlot();
    }catch(error){
        if(token !== countyHistoryLoadToken) return;
        countyHistoryLoading=false;
        setCountyHistoryStatus("Error");
        clearCountyHistoryPlot("Unable to load county history");
        console.warn("Unable to load county history",error);
    }
}

async function openCountyHistoryPanel(fips,name){
    if(!fips) return;
    countyHistorySelection={ fips, name:name || fips };
    countyHistoryPanelController.open();
    countyHistoryTitle.textContent="County History: " + countyHistorySelection.name;
    await reloadCountyHistoryFromControls();
}

function closeCountyHistoryPanel(){
    countyHistoryPanelController.close();
}

function minimizeCountyHistoryPanel(){
    countyHistoryPanelController.minimize();
}

function restoreCountyHistoryPanel(){
    countyHistoryPanelController.restore();
}

function selectAllCountyHistoryEventTitles(){
    [...countyHistoryEventTitles.options].forEach(option=>{ option.selected=true; });
    drawCountyHistoryPlot();
}

function selectNoCountyHistoryEventTitles(){
    [...countyHistoryEventTitles.options].forEach(option=>{ option.selected=false; });
    drawCountyHistoryPlot();
}

if(window.ResizeObserver){
    const countyHistoryResizeObserver=new ResizeObserver(()=>{
        if(countyHistoryPanel.classList.contains('open')){
            drawCountyHistoryPlot();
        }
    });
    countyHistoryResizeObserver.observe(countyHistoryPanel);
}
