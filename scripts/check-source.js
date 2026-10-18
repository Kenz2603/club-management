const fs=require('node:fs');
const path=require('node:path');
const{spawnSync}=require('node:child_process');
let count=0;
function check(directory){for(const entry of fs.readdirSync(directory,{withFileTypes:true})){const file=path.join(directory,entry.name);if(entry.isDirectory())check(file);else if(file.endsWith('.js')){const result=spawnSync(process.execPath,['--check',file],{stdio:'inherit'});if(result.status!==0)process.exit(result.status);count++;}}}
for(const directory of ['backend','frontend/js','scripts'])check(directory);
console.log(`Syntax checked: ${count} JavaScript files`);
