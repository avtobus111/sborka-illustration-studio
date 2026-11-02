import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {spawn} from 'node:child_process';
import {ensureModel} from './setup-model.mjs';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
await ensureModel();
if(!fs.existsSync(path.join(root,'dist/index.html')))await import('./build.mjs');
const address='http://127.0.0.1:4173';
let running=false;
try{const response=await fetch(address+'/api/status',{signal:AbortSignal.timeout(1500)});running=response.ok&&typeof(await response.json()).ready==='boolean';}catch{}
if(!running){
  const log=fs.openSync(path.join(root,'studio.log'),'a');
  const child=spawn(process.execPath,[path.join(root,'scripts/serve.mjs')],{cwd:root,detached:true,windowsHide:true,stdio:['ignore',log,log]});child.unref();fs.closeSync(log);
  for(let i=0;i<30;i++){try{const r=await fetch(address+'/api/status');if(r.ok){running=true;break;}}catch{}await new Promise(resolve=>setTimeout(resolve,300));}
}
if(!running)throw Error('Студия не запустилась. Проверьте studio.log или занятость порта 4173.');
if(!process.argv.includes('--no-browser')){
  if(process.platform==='win32'){const child=spawn('cmd.exe',['/c','start','',address],{windowsHide:true,stdio:'ignore'});child.unref();}
  else console.log('Откройте',address);
}
console.log('Студия запущена:',address);
