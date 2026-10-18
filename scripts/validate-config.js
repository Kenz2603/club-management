const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const root = path.resolve(__dirname, '..').split(path.sep).join('/');
const env = { ...process.env, MYSQL_DATABASE:'club_config_validation', MYSQL_USER:'club_validation', MYSQL_PASSWORD:'validation-placeholder-only', MYSQL_ROOT_PASSWORD:'validation-placeholder-only' };
const results=[];
function run(name, args, binary = 'docker') {
  const result=spawnSync(binary,args,{env,encoding:'utf8'});
  if(result.status!==0){console.error(result.stderr||result.stdout||result.error?.message);throw new Error(name+' failed');}
  results.push({name,status:'PASS'}); console.log(name+': PASS');
}
try{
 fs.mkdirSync('artifacts',{recursive:true});
 run('Compose merged config',['compose','--env-file','.env.example','-p','club-management-validation','-f','compose.yaml','-f','compose.backend.yaml','-f','compose.migrate.yaml','-f','compose.monitoring.yaml','-f','compose.logging.yaml','config','--quiet']);
 run('Prometheus config and alert rules',['run','--rm','--entrypoint','/bin/promtool','-v',root+'/monitoring/prometheus:/etc/prometheus:ro','prom/prometheus:v3.5.0','check','config','/etc/prometheus/prometheus.yml']);
 run('Loki config',['run','--rm','-v',root+'/monitoring/loki/loki.yml:/etc/loki/loki.yml:ro','grafana/loki:3.5.5','-config.file=/etc/loki/loki.yml','-verify-config=true']);
 run('Alloy config',['run','--rm','-v',root+'/monitoring/alloy/config.alloy:/etc/alloy/config.alloy:ro','grafana/alloy:v1.11.0','validate','/etc/alloy/config.alloy']);
 run('Legacy Promtail syntax only',['run','--rm','-v',root+'/monitoring/promtail/promtail.yml:/etc/promtail/promtail.yml:ro','grafana/promtail:3.5.5','-config.file=/etc/promtail/promtail.yml','-check-syntax']);
 fs.writeFileSync('artifacts/club-status-test.conf',fs.readFileSync('nginx/club-status.conf','utf8').replace('172.17.0.1:8081','127.0.0.1:8081'));
 fs.writeFileSync('artifacts/nginx-test.conf','events {} http { include /etc/nginx/club/club-logging.conf; include /etc/nginx/club/club-management.conf; include /etc/nginx/validation/club-status-test.conf; }');
 const mounts=['-v',root+'/nginx:/etc/nginx/club:ro','-v',root+'/artifacts:/etc/nginx/validation:ro','-v',root+'/artifacts/nginx-test.conf:/etc/nginx/nginx.conf:ro'];
 run('Nginx HTTP and status adapted to loopback',['run','--rm','--entrypoint','nginx',...mounts,'nginx:1.28-alpine','-t']);
 const openssl=process.env.OPENSSL_BIN || 'C:/Program Files/Git/usr/bin/openssl.exe';
 run('Temporary TLS certificate',['req','-x509','-nodes','-newkey','rsa:2048','-days','1','-keyout',root+'/artifacts/club.local.key','-out',root+'/artifacts/club.local.crt','-subj','/CN=club.local','-addext','subjectAltName=DNS:club.local'],openssl);
 fs.writeFileSync('artifacts/club-https-test.conf',fs.readFileSync('nginx/club-management.https.conf.example','utf8').replaceAll('/etc/nginx/club-tls/','/etc/nginx/validation/'));
 fs.writeFileSync('artifacts/nginx-tls-test.conf','events {} http { include /etc/nginx/club/club-logging.conf; include /etc/nginx/validation/club-https-test.conf; }');
 run('Nginx HTTPS syntax with temporary certificate',['run','--rm','--entrypoint','nginx','-v',root+'/nginx:/etc/nginx/club:ro','-v',root+'/artifacts:/etc/nginx/validation:ro','-v',root+'/artifacts/nginx-tls-test.conf:/etc/nginx/nginx.conf:ro','nginx:1.28-alpine','-t']);
 for(const script of ['backup.sh','restore-test.sh','ubuntu-precheck.sh'])run('bash syntax '+script,['run','--rm','--entrypoint','bash','-v',root+'/scripts:/scripts:ro','node:22-bookworm-slim','-n','/scripts/'+script]);
 fs.writeFileSync('artifacts/config-validation.json',JSON.stringify(results,null,2));
}catch(error){console.error(error.message);process.exitCode=1;}
