const { spawnSync } = require('node:child_process');
const { randomBytes } = require('node:crypto');
const name = 'club-management-test-' + randomBytes(6).toString('hex');
const password = randomBytes(24).toString('hex');
const env = { ...process.env, MYSQL_ROOT_PASSWORD:password, MYSQL_DATABASE:'club_management_test', MYSQL_USER:'club_test', MYSQL_PASSWORD:password, NODE_ENV:'test', APP_ORIGIN:'', COOKIE_SECURE:'false', TRUST_PROXY:'false', DB_HOST:'127.0.0.1' };
function docker(args, capture = false) {
  const result = spawnSync('docker', args, { env, encoding:'utf8', stdio:capture?'pipe':'inherit' });
  if (result.error || result.status !== 0) throw new Error(capture ? (result.stderr || 'Docker command failed') : 'Docker command failed');
  return result.stdout?.trim();
}
function node(args) { const result = spawnSync(process.execPath,args,{env,stdio:'inherit'}); if(result.status!==0)throw new Error('Test command failed'); }
async function main() {
  docker(['info','--format','{{.ServerVersion}}'],true);
  let created=false, backendCreated=false, networkCreated=false;
  try {
    if(env.CLUB_TEST_BACKEND_IMAGE){docker(['network','create','--label','club-management.disposable-test=true',name],true);networkCreated=true;}
    docker(['run','-d',...(networkCreated?['--network',name]:[]),'--name',name,'--label','club-management.disposable-test=true','--tmpfs','/var/lib/mysql:rw,size=768m','-p','127.0.0.1::3306','-e','MYSQL_ROOT_PASSWORD','-e','MYSQL_DATABASE','-e','MYSQL_USER','-e','MYSQL_PASSWORD','mysql:8.4'],true);
    created=true;
    const port=docker(['port',name,'3306/tcp'],true).split(':').pop();env.DB_PORT=port;
    const mysql=require('mysql2/promise');
    let ready=false;
    for(let i=0;i<90;i++){
      try{const conn=await mysql.createConnection({host:env.DB_HOST,port:Number(port),user:env.MYSQL_USER,password,database:env.MYSQL_DATABASE});await conn.query('SELECT 1');await conn.end();ready=true;break;}catch{await new Promise(resolve=>setTimeout(resolve,1000));}
    }
    if(!ready)throw new Error('Isolated MySQL did not become ready');
    node(['backend/scripts/migrate.js','up','--confirm']);
    node(['backend/scripts/migrate.js','verify','--all']);
    node(['backend/scripts/migrate.js','up','--confirm']);
    if(env.CLUB_TEST_BACKEND_IMAGE){
      docker(['run','-d','--network',name,'--name',name+'-backend','--label','club-management.disposable-test=true','--read-only','--cap-drop=ALL','--security-opt=no-new-privileges:true','--tmpfs','/tmp:size=16m','-p','127.0.0.1::3000','-e','MYSQL_DATABASE','-e','MYSQL_USER','-e','MYSQL_PASSWORD','-e','DB_HOST='+name,'-e','DB_PORT=3306','-e','NODE_ENV=production',env.CLUB_TEST_BACKEND_IMAGE],true);
      backendCreated=true;
      const webPort=docker(['port',name+'-backend','3000/tcp'],true).split(':').pop();
      let healthy=false;
      for(let i=0;i<45;i++){const status=docker(['inspect','--format','{{.State.Health.Status}}',name+'-backend'],true);if(status==='healthy'){healthy=true;break;}await new Promise(resolve=>setTimeout(resolve,1000));}
      if(!healthy)throw new Error('Verification backend container not ready');
      const result=docker(['exec',name+'-backend','node','-e',"const fs=require('fs');if(process.getuid()===0||fs.readdirSync('/app/database/migrations').length!==7||fs.existsSync('/app/backend/tests'))process.exit(1)"],true);
      console.log('Docker backend: readiness, non-root, migration assets and hardened startup PASS');
    }
    node(['--test','backend/tests/database/mysql.integration.js']);
  } finally {
    if(backendCreated)docker(['rm','-f',name+'-backend'],true);
    if(created){const labels=JSON.parse(docker(['inspect','--format','{{json .Config.Labels}}',name],true));if(labels['club-management.disposable-test']==='true'&&/^club-management-test-[a-f0-9]{12}$/.test(name))docker(['rm','-f',name],true);}
    if(networkCreated)docker(['network','rm',name],true);
  }
}
const keepAlive = setInterval(() => {}, 1000);
main().catch(error=>{console.error(error.message);process.exitCode=1;}).finally(() => clearInterval(keepAlive));
