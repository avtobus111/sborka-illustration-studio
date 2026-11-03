import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createSemanticSelector,MODEL_ID} from '../src/semantic.mjs';
import {renderSVG} from '../src/core.mjs';
import {restoreProject,serializeProject} from '../src/project.mjs';
const project=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const catalog=JSON.parse(fs.readFileSync(path.join(project,'assets/catalog.json'),'utf8'));

export function getListenAddress(env=process.env){
  const port=Number(env.PORT||4173),host=env.HOST||'127.0.0.1';
  if(!Number.isInteger(port)||port<1||port>65535)throw Error('PORT должен быть целым числом от 1 до 65535.');
  return {host,port};
}

export async function createStudioServer(){
  const state={ready:false,model:MODEL_ID,error:null};
  const model=createSemanticSelector(catalog).then(value=>{state.ready=true;return value;}).catch(error=>{state.error='Модель не загружена. Выполните npm run setup:model и перезапустите сервер.';return null;});
  const server=http.createServer(async(req,res)=>{
    const send=(status,data)=>{res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','Access-Control-Allow-Origin':'*'});res.end(JSON.stringify(data));};
    try{
      const url=new URL(req.url,'http://localhost');
      if(req.method==='OPTIONS'){res.writeHead(204,{'Access-Control-Allow-Origin':'*','Access-Control-Allow-Methods':'POST, GET, OPTIONS','Access-Control-Allow-Headers':'Content-Type'});res.end();return;}
      if(req.method==='GET'&&url.pathname==='/api/status'){send(200,state);return;}
      if(req.method==='GET'&&url.pathname==='/healthz'){send(state.ready?200:503,{ready:state.ready});return;}
      if(req.method==='POST'&&['/api/export/svg','/api/export/project'].includes(url.pathname)){
        let body='';for await(const chunk of req){body+=chunk;if(Buffer.byteLength(body)>1500000){send(413,{error:'Проект слишком большой.'});return;}}
        let restored;try{restored=restoreProject(new URLSearchParams(body).get('project'),catalog);}catch(error){send(400,{error:error.message});return;}
        const svg=url.pathname.endsWith('/svg');
        const file=svg?renderSVG(restored.scene,catalog):serializeProject(restored.scene,restored.ui,catalog);
        res.writeHead(200,{'Content-Type':svg?'image/svg+xml; charset=utf-8':'application/json; charset=utf-8','Content-Disposition':`attachment; filename="${svg?'composition.svg':'composition.sbor.json'}"`,'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});res.end(file);return;
      }
      if(req.method==='POST'&&url.pathname==='/api/select'){
        let body='';
        for await(const chunk of req){body+=chunk;if(Buffer.byteLength(body)>8192){send(413,{error:'Запрос слишком большой.'});return;}}
        let data;try{data=JSON.parse(body);}catch{send(400,{error:'Некорректный JSON запроса.'});return;}
        if(!data||typeof data.query!=='string'||data.query.length>500){send(400,{error:'Запрос должен быть строкой до 500 символов.'});return;}
        const selector=await model;if(!selector){send(503,{error:state.error});return;}
        send(200,await selector.select(data.query));return;
      }
      if(req.method==='GET'&&(url.pathname==='/'||url.pathname==='/index.html')){res.writeHead(200,{'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-store'});fs.createReadStream(path.join(project,'dist/index.html')).pipe(res);return;}
      send(404,{error:'Не найдено.'});
    }catch(error){if(!res.headersSent)send(500,{error:'Не удалось выполнить подбор. Попробуйте ещё раз.'});else res.end();}
  });
  return {server,state,model};
}

if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  const {host,port}=getListenAddress();const app=await createStudioServer();
  app.server.listen(port,host,()=>console.log(`Сборка: http://${host}:${port}`));
  app.server.on('error',error=>{console.error(error.code==='EADDRINUSE'?'Этот порт уже занят. Откройте существующую студию или задайте PORT.':error.message);process.exitCode=1;app.server.close();});
  app.model.then(value=>console.log(value?'Локальная языковая модель готова.':'Модель недоступна: npm run setup:model'));
}
