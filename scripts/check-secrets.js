const fs=require('node:fs');
const path=require('node:path');
const {spawnSync}=require('node:child_process');
const ignored=new Set(['.git','node_modules','.env','secrets','artifacts','output','backups','playwright-report','test-results']);
const rules=[['private key',/-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/],['OpenAI key',/sk-(?:proj-)?[A-Za-z0-9_-]{24,}/],['GitHub token',/gh[pousr]_[A-Za-z0-9]{30,}/],['AWS access key',/AKIA[A-Z0-9]{16}/]];
const findings=[];let checked=0;
function scan(directory){for(const entry of fs.readdirSync(directory,{withFileTypes:true})){if(ignored.has(entry.name)||entry.name.startsWith('.env')&&entry.name!=='.env.example')continue;const file=path.join(directory,entry.name);if(entry.isDirectory()){scan(file);continue;}if(file.startsWith(path.join('backend','tests')))continue;if(!/\.(js|py|sh|json|ya?ml|html|css|md|sql)$/.test(file)&&entry.name!=='.env.example')continue;const content=fs.readFileSync(file,'utf8');checked++;for(const[label,pattern]of rules)if(pattern.test(content))findings.push({file,rule:label});}}
scan('.');
const lock=JSON.parse(fs.readFileSync('package-lock.json','utf8'));
for(const entry of Object.values(lock.packages||{}))if(entry.resolved){const url=new URL(entry.resolved);if(url.username||url.password)findings.push({file:'package-lock.json',rule:'registry URL credentials'});}
function git(args) {
  const result=spawnSync('git',args,{encoding:'utf8',maxBuffer:16*1024*1024});
  if(result.status!==0)throw new Error('Git secret scan command failed');
  return result.stdout;
}
for(const file of git(['ls-files','-z']).split('\0').filter(Boolean)) {
  if(/(^|\/)(\.env(?:\..+)?|secrets|backups|artifacts)(\/|$)/.test(file)&&file!=='.env.example')findings.push({file,rule:'sensitive path tracked in index'});
}
const base=process.argv.find(arg=>arg.startsWith('--history-base='))?.slice('--history-base='.length);
const revisions=base?git(['rev-list',`${base}..HEAD`]).trim().split('\n').filter(Boolean):['HEAD'];
const expression='-----BEGIN (RSA |EC |OPENSSH )?PRIVATE KEY-----|sk-(proj-)?[A-Za-z0-9_-]{24,}|gh[pousr]_[A-Za-z0-9]{30,}|AKIA[A-Z0-9]{16}';
for(const revision of [null,...revisions]) {
  const result=spawnSync('git',['grep',...(revision?[]:['--cached']),'-I','-l','-E','-e',expression,...(revision?[revision]:[])],{encoding:'utf8',maxBuffer:16*1024*1024});
  if(result.status!==0&&result.status!==1)throw new Error('Git content secret scan failed');
  if(result.status===0)for(const file of result.stdout.trim().split('\n'))findings.push({file,rule:'credential pattern in Git snapshot'});
}
console.log(JSON.stringify({checked,gitSnapshots:revisions.length+1,findings,scope:'Working source/config/docs, index paths/content and requested Git history; real env/secrets/artifacts and binary output excluded from filesystem scan'},null,2));
if(findings.length)process.exitCode=1;
