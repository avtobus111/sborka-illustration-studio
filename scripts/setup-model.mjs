import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const manifest=JSON.parse(await fsp.readFile(path.join(root,'assets/model-manifest.json'),'utf8'));
const digest=async file=>{const hash=createHash('sha256');for await(const chunk of fs.createReadStream(file))hash.update(chunk);return hash.digest('hex');};
export async function ensureModel(){
  for(const file of manifest.files){
    const target=path.join(root,'models',manifest.model,file.path);
    if(fs.existsSync(target)&&fs.statSync(target).size===file.bytes&&await digest(target)===file.sha256)continue;
    console.log('Загрузка модели:',file.path);
    const response=await fetch(`https://huggingface.co/${manifest.model}/resolve/${manifest.revision}/${file.path}`,{signal:AbortSignal.timeout(180000)});
    if(!response.ok)throw Error(`Не удалось скачать ${file.path}: HTTP ${response.status}`);
    await fsp.mkdir(path.dirname(target),{recursive:true});
    const temporary=target+'.part',handle=await fsp.open(temporary,'w');
    try{for await(const chunk of response.body)await handle.write(chunk);}finally{await handle.close();}
    if(await digest(temporary)!==file.sha256)throw Error(`Контрольная сумма модели не совпадает: ${file.path}`);
    await fsp.rename(temporary,target);
  }
  console.log('Файлы модели проверены.');
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url))await ensureModel();
