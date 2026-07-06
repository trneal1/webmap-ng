// ===== TIMER =====
setInterval(()=>{
    document.querySelectorAll(".timer").forEach(el=>{
        const exp = new Date(el.dataset.exp);
        const referenceTime = Number(el.dataset.ref) || getActiveTimestamp();
        let diff = (exp - referenceTime)/1000;

        if(diff <= 0){
            el.innerText = "Expired";
            return;
        }

        const h = Math.floor(diff/3600);
        const m = Math.floor((diff%3600)/60);
        const s = Math.floor(diff%60);

        el.innerText =
            String(h).padStart(2,'0') + ":" +
            String(m).padStart(2,'0') + ":" +
            String(s).padStart(2,'0');
    });
},1000);

