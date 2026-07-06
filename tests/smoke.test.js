const assert = require("assert");
const { spawn } = require("child_process");
const path = require("path");
const { chromium } = require("playwright");

const rootArg = process.argv.find(arg=>arg.startsWith("--root="));
const rootDir = path.resolve(__dirname, "..", rootArg ? rootArg.slice("--root=".length) : ".");
const port = Number(process.env.WEBMAP_SMOKE_PORT || 8091);
const baseUrl = `http://127.0.0.1:${port}`;

function startServer(){
    return new Promise((resolve,reject)=>{
        const server = spawn("python3", ["-m", "http.server", String(port), "--bind", "127.0.0.1"], {
            cwd: rootDir,
            stdio: ["ignore", "pipe", "pipe"]
        });

        let stderr = "";
        server.stderr.on("data", chunk=>{ stderr += chunk.toString(); });
        server.on("error", reject);
        server.on("exit", code=>{
            if(code !== null && code !== 0){
                reject(new Error(`Smoke test server exited with ${code}: ${stderr}`));
            }
        });

        const deadline = Date.now() + 5000;
        async function probe(){
            try{
                const response = await fetch(baseUrl + "/webmap.html");
                if(response.ok){
                    resolve(server);
                    return;
                }
            }catch(error){
                // Keep probing until the server is ready.
            }

            if(Date.now() > deadline){
                server.kill();
                reject(new Error("Smoke test server did not start"));
                return;
            }
            setTimeout(probe,100);
        }
        probe();
    });
}

async function waitForApp(page){
    await page.goto(baseUrl + "/webmap.html",{ waitUntil:"domcontentloaded" });
    await page.waitForFunction(()=>
        window.Webmap &&
        window.Webmap.services &&
        window.Webmap.actions &&
        Object.keys(window.Webmap.actions).length > 10
    );
    await page.waitForSelector("#map");
}

async function expectPanelOpen(page,panelSelector){
    await page.waitForFunction(selector=>{
        const panel = document.querySelector(selector);
        return panel && panel.classList.contains("open");
    },panelSelector);
}

async function run(){
    const server = await startServer();
    const browser = await chromium.launch();
    const page = await browser.newPage();
    const consoleErrors = [];
    const pageErrors = [];

    page.on("console", message=>{
        if(message.type() === "error") consoleErrors.push(message.text());
    });
    page.on("pageerror", error=>pageErrors.push(error.message));

    try{
        await waitForApp(page);

        const namespaceShape = await page.evaluate(()=>({
            hasConfig:Boolean(window.Webmap.config),
            hasState:Boolean(window.Webmap.state),
            hasApi:Boolean(window.Webmap.services.api),
            hasDom:Boolean(window.Webmap.services.dom),
            actionCount:Object.keys(window.Webmap.actions).length
        }));
        assert.strictEqual(namespaceShape.hasConfig,true);
        assert.strictEqual(namespaceShape.hasState,true);
        assert.strictEqual(namespaceShape.hasApi,true);
        assert.strictEqual(namespaceShape.hasDom,true);
        assert(namespaceShape.actionCount > 10,"expected delegated actions to be registered");

        await page.evaluate(()=>toggleShortcutHelpPanel());
        await expectPanelOpen(page,"#shortcutHelpPanel");
        await page.click("#closeShortcutHelp");

        await page.evaluate(()=>togglePriorityPanel());
        await expectPanelOpen(page,"#priorityPanel");
        await page.click("#closePriority");

        await page.evaluate(()=>togglePlotPanel());
        await expectPanelOpen(page,"#plotPanel");
        await page.click("#closePlot");

        const eventTitleCountScope = await page.evaluate(()=>{
            const originalRawData = Webmap.state.rawData;
            const originalCountyFeatureByFips = Webmap.state.countyFeatureByFips;
            const title = "Test Warning";
            const displayableAlert = {
                id:"urn:oid:displayable",
                event:title,
                headline:"Displayable county alert",
                expires:"2026-07-04T12:00:00Z"
            };
            const hiddenAlert = {
                id:"urn:oid:hidden",
                event:title,
                headline:"Hidden county alert",
                expires:"2026-07-04T12:00:00Z"
            };

            try{
                Webmap.state.rawData = {
                    "01001":[displayableAlert],
                    "99999":[hiddenAlert]
                };
                Webmap.state.countyFeatureByFips = {
                    "01001":{
                        properties:{
                            STATE:"01",
                            NAME:"Autauga"
                        }
                    }
                };

                const panelCount = getEventTitleCounts()
                    .find(([eventTitle])=>eventTitle === title)?.[1]?.alertCount;
                const popupCount = getEventTitleAlertDetails(title).length;
                return { panelCount, popupCount };
            }finally{
                Webmap.state.rawData = originalRawData;
                Webmap.state.countyFeatureByFips = originalCountyFeatureByFips;
            }
        });
        assert.deepStrictEqual(eventTitleCountScope,{ panelCount:1, popupCount:1 });

        assert.strictEqual(pageErrors.length,0,"page errors: " + pageErrors.join("\n"));
        assert.strictEqual(consoleErrors.length,0,"console errors: " + consoleErrors.join("\n"));
    }finally{
        await browser.close();
        server.kill();
    }
}

run().then(()=>{
    console.log("browser smoke tests passed");
}).catch(error=>{
    console.error(error);
    process.exit(1);
});
