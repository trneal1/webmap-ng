// ===== EVENT PLOT =====
function getSelectedPlotEventTitles(){
    return [...plotEventTitles.selectedOptions].map(option=>option.value);
}

function setPlotStatus(message){
    plotStatus.textContent=message;
}

function clearEventPlot(message="No data"){
    plotLastGeometry=null;
    updatePlotCursorTooltip([]);
    const context=eventPlotCanvas.getContext('2d');
    context.clearRect(0,0,eventPlotCanvas.width,eventPlotCanvas.height);
    context.fillStyle="#fff";
    context.fillRect(0,0,eventPlotCanvas.width,eventPlotCanvas.height);
    context.fillStyle="#555";
    context.font="24px Arial";
    context.textAlign="center";
    context.textBaseline="middle";
    context.fillText(message,eventPlotCanvas.width / 2,eventPlotCanvas.height / 2);
}

function getPlotRange(){
    const start=parseDateTimeLocal(plotStart.value);
    const stop=parseDateTimeLocal(plotStop.value);
    const lo=Number.isFinite(start) ? start : -Infinity;
    const hi=Number.isFinite(stop) ? stop : Infinity;
    return lo <= hi ? { start:lo, stop:hi } : { start:hi, stop:lo };
}

function buildPlotSeriesByTitle(){
    const titles=getSelectedPlotEventTitles();
    const range=getPlotRange();
    const mode=getPlotCountMode();

    return titles.map(title=>{
        return {
            title,
            points:plotFrames
                .filter(frame=>frame.timestamp >= range.start && frame.timestamp <= range.stop)
                .map(frame=>({
                    timestamp:frame.timestamp,
                    value:getPlotFrameTitleCounts(frame,mode)[title] || 0
                }))
        };
    });
}

function getPlotColor(index){
    const colors=[
        "#1769aa",
        "#c62828",
        "#2e7d32",
        "#6a1b9a",
        "#ef6c00",
        "#00838f",
        "#ad1457",
        "#5d4037"
    ];
    return colors[index % colors.length];
}

function truncateCanvasText(context,text,maxWidth){
    const value=String(text);
    if(context.measureText(value).width <= maxWidth) return value;
    let truncated=value;
    while(truncated.length > 1 && context.measureText(truncated + "...").width > maxWidth){
        truncated=truncated.slice(0,-1);
    }
    return truncated + "...";
}

function drawPlotLegend(context,seriesByTitle,width,dpr){
    const rowHeight=18 * dpr;
    const swatchSize=10 * dpr;
    const x=70 * dpr;
    let y=14 * dpr;
    context.font=(11 * dpr)+"px Arial";
    context.textAlign="left";
    context.textBaseline="middle";

    seriesByTitle.slice(0,8).forEach((series,index)=>{
        context.fillStyle=getPlotColor(index);
        context.fillRect(x,y - swatchSize / 2,swatchSize,swatchSize);
        context.fillStyle="#333";
        context.fillText(
            truncateCanvasText(context,series.title,width - x - 90 * dpr),
            x + 16 * dpr,
            y
        );
        y+=rowHeight;
    });

    if(seriesByTitle.length > 8){
        context.fillStyle="#555";
        context.fillText("+" + (seriesByTitle.length - 8) + " more",x,y);
    }
}

function getVisiblePlotSeries(seriesByTitle){
    return seriesByTitle.filter(series=>series.points.some(point=>point.value > 0));
}

function getAllPlotPoints(seriesByTitle){
    return seriesByTitle.flatMap(series=>series.points);
}

function getPlotFrameCount(seriesByTitle){
    return seriesByTitle[0]?.points.length || 0;
}

function getLatestPlotTotal(seriesByTitle){
    return seriesByTitle.reduce((total,series)=>{
        const latest=series.points[series.points.length - 1];
        return total + (latest?.value || 0);
    },0);
}

function getNearestPlotFrameTimestamp(timestamp,seriesByTitle){
    const points=seriesByTitle[0]?.points || [];
    if(!points.length) return null;
    let best=points[0].timestamp;
    let bestDelta=Math.abs(best - timestamp);
    points.forEach(point=>{
        const delta=Math.abs(point.timestamp - timestamp);
        if(delta < bestDelta){
            best=point.timestamp;
            bestDelta=delta;
        }
    });
    return best;
}

function getPlotCursorSummary(seriesByTitle){
    if(!plotCursorTimestamp) return "";
    const rows=seriesByTitle.map(series=>{
        const point=series.points.find(candidate=>candidate.timestamp === plotCursorTimestamp);
        return {
            title:series.title,
            value:point?.value || 0
        };
    });
    const nonZero=rows.filter(row=>row.value > 0);
    const shown=(nonZero.length ? nonZero : rows).slice(0,3);
    const details=shown.map(row=>row.title + ": " + row.value).join(", ");
    const more=rows.length > shown.length ? ", +" + (rows.length - shown.length) + " more" : "";
    return new Date(plotCursorTimestamp).toLocaleString() + (details ? " | " + details + more : "");
}

function getPlotCursorRows(seriesByTitle){
    if(!plotCursorTimestamp) return [];
    return seriesByTitle.map((series,index)=>{
        const point=series.points.find(candidate=>candidate.timestamp === plotCursorTimestamp);
        return {
            title:series.title,
            value:point?.value || 0,
            color:getPlotColor(index)
        };
    });
}

function updatePlotCursorTooltip(seriesByTitle){
    if(!plotCursorTimestamp || !seriesByTitle.length || !plotLastGeometry){
        plotCursorTooltip.classList.remove('visible');
        plotCursorTooltip.innerHTML="";
        return;
    }

    const rows=getPlotCursorRows(seriesByTitle);
    const nonZero=rows.filter(row=>row.value > 0);
    const shown=(nonZero.length ? nonZero : rows).slice(0,8);
    const hiddenCount=rows.length - shown.length;

    plotCursorTooltip.innerHTML=`
        <div class="plot-tooltip-time">${escapeHtml(new Date(plotCursorTimestamp).toLocaleString())}</div>
        ${shown.map(row=>`
            <div class="plot-tooltip-row">
                <span class="plot-tooltip-swatch" style="background:${escapeHtml(row.color)}"></span>
                <span class="plot-tooltip-title">${escapeHtml(row.title)}</span>
                <b>${row.value}</b>
            </div>
        `).join("")}
        ${hiddenCount > 0 ? `<div class="plot-tooltip-row">+${hiddenCount} more</div>` : ""}
    `;
    plotCursorTooltip.classList.add('visible');

    requestAnimationFrame(()=>{
        if(!plotLastGeometry || !plotCursorTimestamp) return;
        const canvasRect=eventPlotCanvas.getBoundingClientRect();
        const wrapRect=eventPlotCanvas.parentElement.getBoundingClientRect();
        const tooltipRect=plotCursorTooltip.getBoundingClientRect();
        const cursorX=plotLastGeometry.xScale(plotCursorTimestamp) / plotLastGeometry.dpr;
        const preferredLeft=(canvasRect.left - wrapRect.left) + cursorX + 12;
        const preferredTop=(canvasRect.top - wrapRect.top) + 12;
        const maxLeft=Math.max(0,wrapRect.width - tooltipRect.width - 8);
        const left=preferredLeft > maxLeft ? Math.max(8,preferredLeft - tooltipRect.width - 24) : preferredLeft;

        plotCursorTooltip.style.left=Math.min(Math.max(left,8),maxLeft)+"px";
        plotCursorTooltip.style.top=Math.min(Math.max(preferredTop,8),Math.max(8,wrapRect.height - tooltipRect.height - 8))+"px";
    });
}

function drawPlotCursor(context,seriesByTitle,xScale,margin,height,dpr){
    const points=seriesByTitle[0]?.points || [];
    if(!points.length) return;

    if(!plotCursorTimestamp || !points.some(point=>point.timestamp === plotCursorTimestamp)){
        plotCursorTimestamp=points[points.length - 1].timestamp;
    }

    const x=xScale(plotCursorTimestamp);
    context.save();
    context.strokeStyle="#111";
    context.lineWidth=1.5 * dpr;
    context.setLineDash([5 * dpr,4 * dpr]);
    context.beginPath();
    context.moveTo(x,margin.top);
    context.lineTo(x,height - margin.bottom);
    context.stroke();
    context.setLineDash([]);

    context.fillStyle="#111";
    context.beginPath();
    context.arc(x,height - margin.bottom,5 * dpr,0,Math.PI * 2);
    context.fill();
    context.restore();
    updatePlotCursorTooltip(seriesByTitle);
}

function drawSingleTitlePlot(context,series,index,xScale,yScale,dpr){
    context.strokeStyle=getPlotColor(index);
    context.lineWidth=2.5 * dpr;
    context.beginPath();
    series.points.forEach((point,pointIndex)=>{
        const x=xScale(point.timestamp);
        const y=yScale(point.value);
        if(pointIndex === 0) context.moveTo(x,y);
        else context.lineTo(x,y);
    });
    context.stroke();

    context.fillStyle=getPlotColor(index);
    series.points.forEach(point=>{
        const x=xScale(point.timestamp);
        const y=yScale(point.value);
        context.beginPath();
        context.arc(x,y,3 * dpr,0,Math.PI * 2);
        context.fill();
    });
}

function drawPlotDayDividers(context,points,margin,height,dpr,xScale){
    if(!points.length) return;

    const minTime=points[0].timestamp;
    const maxTime=points[points.length - 1].timestamp;
    const nextDay=new Date(minTime);
    nextDay.setHours(24,0,0,0);

    context.save();
    context.strokeStyle="#7f95ad";
    context.lineWidth=1 * dpr;
    context.setLineDash([3 * dpr,4 * dpr]);

    for(let timestamp=nextDay.getTime();timestamp<maxTime;){
        if(timestamp>minTime){
            const x=xScale(timestamp);
            context.beginPath();
            context.moveTo(x,margin.top);
            context.lineTo(x,height - margin.bottom);
            context.stroke();
        }
        nextDay.setDate(nextDay.getDate() + 1);
        timestamp=nextDay.getTime();
    }

    context.restore();
}

function drawPlotAxes(context,width,height,margin,seriesByTitle,maxValue,dpr,xScale,yScale){
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

    drawPlotDayDividers(context,seriesByTitle[0]?.points || [],margin,height,dpr,xScale);

    context.strokeStyle="#333";
    context.beginPath();
    context.moveTo(margin.left,margin.top);
    context.lineTo(margin.left,height - margin.bottom);
    context.lineTo(width - margin.right,height - margin.bottom);
    context.stroke();

    context.fillStyle="#333";
    context.font=(11 * dpr)+"px Arial";
    context.textAlign="center";
    context.textBaseline="top";
    const frameCount=getPlotFrameCount(seriesByTitle);
    const labelCount=Math.min(4,frameCount);
    const points=seriesByTitle[0]?.points || [];
    for(let i=0;i<labelCount;i++){
        const index=labelCount === 1 ? 0 : Math.round((points.length - 1) * i / (labelCount - 1));
        const point=points[index];
        context.fillText(new Date(point.timestamp).toLocaleString(),xScale(point.timestamp),height - margin.bottom + 10 * dpr);
    }
}

function updatePlotSummary(seriesByTitle){
    const selectedTitles=getSelectedPlotEventTitles();
    const frameCount=getPlotFrameCount(seriesByTitle);
    setPlotStatus(frameCount + " frames, latest " + getPlotCountModeLabel() + " " + getLatestPlotTotal(seriesByTitle));
    const cursorSummary=getPlotCursorSummary(seriesByTitle);
    plotHint.textContent=cursorSummary || (selectedTitles.length + " curve" + (selectedTitles.length === 1 ? "" : "s") + " selected");
}

function drawEventPlotLines(context,seriesByTitle,width,height,dpr){
    const visibleSeries=getVisiblePlotSeries(seriesByTitle);
    const points=getAllPlotPoints(seriesByTitle);
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
    const maxValue=Math.max(1,...points.map(point=>point.value));
    const xScale=timestamp=>margin.left + ((timestamp - minTime) / Math.max(1,maxTime - minTime)) * plotWidth;
    const yScale=value=>margin.top + plotHeight - (value / maxValue) * plotHeight;
    const timeFromX=x=>minTime + ((x - margin.left) / Math.max(1,plotWidth)) * Math.max(1,maxTime - minTime);
    plotLastGeometry={ margin, width, height, dpr, xScale, timeFromX, seriesByTitle };

    drawPlotAxes(context,width,height,margin,seriesByTitle,maxValue,dpr,xScale,yScale);

    seriesByTitle.forEach((series,index)=>{
        drawSingleTitlePlot(context,series,index,xScale,yScale,dpr);
    });

    drawPlotCursor(context,seriesByTitle,xScale,margin,height,dpr);

    if(seriesByTitle.length > 1){
        drawPlotLegend(context,seriesByTitle,width,dpr);
    }
}

function drawEventPlot(){
    if(!plotPanel.classList.contains('open')) return;

    const rect=eventPlotCanvas.getBoundingClientRect();
    const dpr=window.devicePixelRatio || 1;
    const width=Math.max(320,Math.round(rect.width * dpr));
    const height=Math.max(220,Math.round(rect.height * dpr));
    if(eventPlotCanvas.width !== width || eventPlotCanvas.height !== height){
        eventPlotCanvas.width=width;
        eventPlotCanvas.height=height;
    }

    const context=eventPlotCanvas.getContext('2d');
    context.clearRect(0,0,width,height);
    context.fillStyle="#fff";
    context.fillRect(0,0,width,height);

    if(plotPanelLoading){
        clearEventPlot("Loading history...");
        return;
    }

    const seriesByTitle=buildPlotSeriesByTitle();
    const frameCount=getPlotFrameCount(seriesByTitle);
    if(!plotFrames.length){
        clearEventPlot("No saved history");
        return;
    }
    if(!getSelectedPlotEventTitles().length){
        clearEventPlot("Select one or more event titles");
        return;
    }
    if(!frameCount){
        clearEventPlot("No frames in range");
        return;
    }

    drawEventPlotLines(context,seriesByTitle,width,height,dpr);
    updatePlotSummary(seriesByTitle);
}

function refreshEventPlot(){
    drawEventPlot();
}

function handlePlotStopChange(){
    plotStopAutoFollowLatest=false;
    refreshEventPlot();
}

function changePlotCountMode(){
    plotTitleCounts=getPlotTitleCountsFromFrames(plotFrames);
    populatePlotEventTitleOptions(plotTitleCounts);
    refreshEventPlot();
}

function populatePlotEventTitleOptions(titleCounts){
    if(!(titleCounts instanceof Map)){
        titleCounts=new Map();
    }
    const titles=[...titleCounts.keys()].sort((a,b)=>a.localeCompare(b));
    const currentSelection=new Set(getSelectedPlotEventTitles());
    const hadOptions=plotEventTitles.options.length;
    const allExistingSelected=hadOptions > 0 && currentSelection.size === hadOptions;

    plotEventTitles.innerHTML=titles.map(title=>{
        const selected=currentSelection.size
            ? currentSelection.has(title) || allExistingSelected
            : false;
        return `<option value="${escapeHtml(title)}" ${selected ? "selected" : ""}>${escapeHtml(title)} (${titleCounts.get(title)})</option>`;
    }).join("");
}

function shouldAutoExtendPlotStop(previousLatestTimestamp){
    if(!plotStop.value) return true;
    if(plotStopAutoFollowLatest) return true;
    return Number.isFinite(previousLatestTimestamp) && plotStop.value === formatDateTimeLocal(previousLatestTimestamp);
}

function setPlotStopToLatest(){
    if(plotFrames.length){
        plotStop.value=formatDateTimeLocal(plotFrames[plotFrames.length - 1].timestamp);
        plotStopAutoFollowLatest=true;
    }
}

function applyPlotHistory(plotHistory,shouldExtendStop){
    plotFrames=Array.isArray(plotHistory.frames) ? plotHistory.frames : [];
    plotTitleCounts=plotHistory.titleCounts instanceof Map
        ? plotHistory.titleCounts
        : getPlotTitleCountsFromFrames(plotFrames);
    if(plotFrames.length){
        if(!plotStart.value) plotStart.value=formatDateTimeLocal(plotFrames[0].timestamp);
        if(shouldExtendStop) setPlotStopToLatest();
    }
    populatePlotEventTitleOptions(plotTitleCounts);
    populateHistoryMapEventTypeOptions(historyMapCache.titleCounts);
    setPlotStatus(plotFrames.length + (plotFrames.length === 1 ? " frame" : " frames"));
}

function mergeIncrementalPlotHistory(plotHistory,shouldExtendStop){
    const incomingFrames=Array.isArray(plotHistory.frames) ? plotHistory.frames : [];
    const previousFrameCount=plotFrames.length;
    if(incomingFrames.length){
        plotFrames=normalizeHistoryFrames([...plotFrames,...incomingFrames]);
        plotTitleCounts=getPlotTitleCountsFromFrames(plotFrames);
        if(shouldExtendStop) setPlotStopToLatest();
        populatePlotEventTitleOptions(plotTitleCounts);
    }
    setPlotStatus(plotFrames.length + (plotFrames.length === 1 ? " frame" : " frames"));
    return plotFrames.length - previousFrameCount;
}

async function reloadPlotHistory(){
    if(plotPanelLoading) return;
    if(!plotFrames.length){
        await openPlotPanel();
        return;
    }
    const loadToken=++plotLoadToken;
    const previousLatestTimestamp=plotFrames[plotFrames.length - 1]?.timestamp;
    const shouldExtendStop=shouldAutoExtendPlotStop(previousLatestTimestamp);

    plotPanelLoading=true;
    setPlotStatus("Updating...");
    await nextPaint();

    try{
        const plotHistory=await loadPlotHistoryFramesFromDb(previousLatestTimestamp);
        if(loadToken !== plotLoadToken) return;
        plotPanelLoading=false;
        const addedFrameCount=mergeIncrementalPlotHistory(plotHistory,shouldExtendStop);
        if(addedFrameCount){
            plotHistoryCache.frames=normalizeHistoryFrames([...plotHistoryCache.frames,...plotHistory.frames]);
            plotHistoryCache.titleCounts=getPlotTitleCountsFromFrames(plotHistoryCache.frames);
            if(plotHistory.historyMap?.frames?.length){
                historyMapCache.frames=normalizeHistoryFrames([...historyMapCache.frames,...plotHistory.historyMap.frames]);
                historyMapCache.titleCounts=getHistoryMapTitleCountsFromFrames(historyMapCache.frames);
                historyMapReady=true;
                populateHistoryMapEventTypeOptions(historyMapCache.titleCounts);
            }
            plotHistoryReady=true;
        }
        drawEventPlot();
        if(!addedFrameCount){
            plotHint.textContent="No new history frames since the plot was loaded.";
        }
    }catch(error){
        if(loadToken !== plotLoadToken) return;
        plotPanelLoading=false;
        setPlotStatus("Error");
        clearEventPlot("Unable to load history");
        console.warn("Unable to reload plot history",error);
    }
}

async function openPlotPanel(){
    if(plotPanelLoading) return;
    if(plotPanel.classList.contains('open') && plotPanel.classList.contains('minimized')){
        restorePlotPanel();
        return;
    }
    ++plotLoadToken;
    plotPanelController.open();
    [...plotEventTitles.options].forEach(option=>{ option.selected=false; });

    const cachedPlotHistory=getCachedPlotHistoryFrames();
    if(cachedPlotHistory.frames.length){
        plotPanelLoading=false;
        applyPlotHistory(cachedPlotHistory,!plotStop.value);
        selectNoPlotEventTitles();
        startPlotHistoryBackgroundLoad();
        return;
    }

    if(plotHistoryLoading || historyIndexLoading){
        plotPanelLoading=false;
        plotFrames=[];
        plotTitleCounts=new Map();
        setPlotStatus("Indexing...");
        clearEventPlot("History indexing in background...");
        startPlotHistoryBackgroundLoad();
        return;
    }

    plotPanelLoading=false;
    plotFrames=[];
    plotTitleCounts=new Map();
    setPlotStatus("No data");
    clearEventPlot("No saved history");
    startPlotHistoryBackgroundLoad();
}

function closePlotPanel(){
    plotPanelController.close();
}

function minimizePlotPanel(){
    plotPanelController.minimize();
}

function restorePlotPanel(){
    plotPanelController.restore();
}

function selectAllPlotEventTitles(){
    [...plotEventTitles.options].forEach(option=>{ option.selected=true; });
    refreshEventPlot();
}

function selectNoPlotEventTitles(){
    [...plotEventTitles.options].forEach(option=>{ option.selected=false; });
    refreshEventPlot();
}

function togglePlotPanel(){
    if(plotPanelController.isOpen() && !plotPanelController.isMinimized()){
        closePlotPanel();
    } else {
        openPlotPanel();
    }
}

async function gotoPlotCursorHistoryFrame(){
    if(!plotCursorTimestamp){
        plotHint.textContent="Select a point on the plot first.";
        return;
    }

    try{
        if(!historyFrames.length || !historyPanel.classList.contains('open')){
            await openHistoryPanel();
        }

        if(!historyFrames.length){
            plotHint.textContent="No history frames are available.";
            return;
        }

        stopHistoryPlayback();
        const index=findNearestHistoryIndex(plotCursorTimestamp);
        await showHistoryFrame(index);
        plotHint.textContent="History frame: " + new Date(historyFrames[index].timestamp).toLocaleString();
    }catch(error){
        console.warn("Unable to go to plot cursor history frame",error);
        plotHint.textContent="Unable to go to history frame.";
    }
}
