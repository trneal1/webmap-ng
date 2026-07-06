// ===== UPDATE TIMER =====
setInterval(()=>{
    const now = Date.now();
    
    // Calculate weather update countdown
    let weatherDiff = Math.max(0, Math.ceil((nextWeatherUpdate - now) / 1000));
    const weatherMins = Math.floor(weatherDiff / 60);
    const weatherSecs = weatherDiff % 60;
    Webmap.services.dom.maybeById('weatherCountdown').textContent = 
        weatherMins + ':' + String(weatherSecs).padStart(2, '0');
    
    // Calculate radar update countdown
    const radarUpdateElem = document.querySelector('#updateTimer .radar-update');
    const radarCountdownElem = Webmap.services.dom.maybeById('radarCountdown');
    
    if(radarToggle.checked){
        radarUpdateElem.classList.remove('inactive');
        let radarDiff = Math.max(0, Math.ceil((nextRadarUpdate - now) / 1000));
        const radarMins = Math.floor(radarDiff / 60);
        const radarSecs = radarDiff % 60;
        radarCountdownElem.textContent = 
            radarMins + ':' + String(radarSecs).padStart(2, '0');
    } else {
        radarUpdateElem.classList.add('inactive');
        radarCountdownElem.textContent = '--:--';
    }
}, 1000);

