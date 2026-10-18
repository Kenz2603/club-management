const {spawnSync} = require('node:child_process');
const {randomBytes} = require('node:crypto');
const path = require('node:path');
const name='club-management-grafana-test-'+randomBytes(6).toString('hex');
const password=randomBytes(24).toString('hex');
const root=path.resolve(__dirname,'..').split(path.sep).join('/');
const env={...process.env,GF_SECURITY_ADMIN_PASSWORD:password};
function docker(args){const result=spawnSync('docker',args,{env,encoding:'utf8'});if(result.status!==0)throw new Error(result.stderr||'Docker validation failed');return result.stdout.trim();}
const keepAlive=setInterval(()=>{},1000);
async function main(){let created=false;try{
 docker(['run','-d','--name',name,'--label','club-management.disposable-grafana=true','--tmpfs','/var/lib/grafana:uid=472,gid=0,size=128m','-p','127.0.0.1::3000','-e','GF_SECURITY_ADMIN_USER=club_validation','-e','GF_SECURITY_ADMIN_PASSWORD','-e','GF_ANALYTICS_REPORTING_ENABLED=false','-e','GF_ANALYTICS_CHECK_FOR_UPDATES=false','-e','GF_PLUGINS_PREINSTALL_DISABLED=true','-v',root+'/monitoring/grafana/provisioning:/etc/grafana/provisioning:ro','-v',root+'/monitoring/grafana/dashboards:/var/lib/grafana/dashboards:ro','grafana/grafana:12.2.0']);created=true;
 const port=docker(['port',name,'3000/tcp']).split(':').pop();const base='http://127.0.0.1:'+port;
 let ready=false;for(let i=0;i<60;i++){try{const result=await fetch(base+'/api/health',{signal:AbortSignal.timeout(2000)});if(result.ok){ready=true;break;}}catch{}await new Promise(resolve=>setTimeout(resolve,1000));}
 if(!ready)throw new Error('Grafana did not become healthy');
 const headers={Authorization:'Basic '+Buffer.from('club_validation:'+password).toString('base64')};
 for(const uid of ['club-prometheus','club-loki']){const result=await fetch(base+'/api/datasources/uid/'+uid,{headers});if(!result.ok)throw new Error('Datasource provisioning failed');const data=await result.json();if(data.uid!==uid)throw new Error('Datasource UID mismatch');}
 const response=await fetch(base+'/api/dashboards/uid/club-management',{headers});if(!response.ok)throw new Error('Dashboard provisioning failed');const data=await response.json();if(data.dashboard.panels.length<12)throw new Error('Dashboard panels missing');
 console.log('Grafana runtime: health, two datasource provisions and dashboard with 12 panels PASS');
}finally{if(created)docker(['rm','-f',name]);}}
main().catch(error=>{console.error(error.message);process.exitCode=1;}).finally(()=>clearInterval(keepAlive));
