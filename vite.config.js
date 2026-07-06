const { defineConfig } = require("vite");
const fs = require("fs");
const path = require("path");

function copyClassicRuntime(){
    return {
        name:"copy-classic-runtime",
        closeBundle(){
            const outDir=path.resolve(__dirname,"dist");
            const srcOutDir=path.join(outDir,"src");
            fs.rmSync(srcOutDir,{ recursive:true, force:true });
            fs.cpSync(path.resolve(__dirname,"src"),srcOutDir,{ recursive:true });

            const stylesOutPath=path.join(outDir,"styles.css");
            if(!fs.existsSync(stylesOutPath)){
                fs.copyFileSync(path.resolve(__dirname,"styles.css"),stylesOutPath);
            }
        }
    };
}

module.exports = defineConfig({
    appType:"mpa",
    build:{
        rollupOptions:{
            input:path.resolve(__dirname,"webmap.html")
        }
    },
    plugins:[copyClassicRuntime()]
});
