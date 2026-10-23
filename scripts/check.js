'use strict';
const fs=require('node:fs');const path=require('node:path');const {spawnSync}=require('node:child_process');
let failed=false;
for(const dir of ['src','test','scripts']) for(const file of fs.readdirSync(dir).filter(f=>f.endsWith('.js'))) {
 const result=spawnSync(process.execPath,['--check',path.join(dir,file)],{encoding:'utf8'});
 if(result.status!==0){process.stderr.write(result.stderr);failed=true;}
}
if(failed) process.exitCode=1;else console.log('All JavaScript files passed syntax checks.');
