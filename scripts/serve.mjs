import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createSemanticSelector,MODEL_ID} from '../src/semantic.mjs';
const project=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const catalog=JSON.parse(fs.readFileSync(path.join(project,'assets/catalog.json'),'utf8'));

export async function createStudioServer(){
  const state={ready:false,model:MODEL_ID,error:null};
  const model=createSemanticSelector(catalog).then(value=>{state.ready=true;return value;}).catch(error=>{state.error='Модель не загружена. Выполните npm run setup:model и перезапустите сервер.';return null;});
  const server=http.createServer(async(req,res)=>{
    const send=(status,data)=>{res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','Access-Control-Allow-Origin':'*'});res.end(JSON.stringify(data));};
    try{
      const url=new URL(req.url,'http://localhost');
      if(req.method==='OPTIONS'){res.writeHead(204,{'Access-Control-Allow-Origin':'*','Access-Control-Allow-Methods':'POST, GET, OPTIONS','Access-Control-Allow-Headers':'Content-Type'});res.end();return;}
      if(req.method==='GET'&&url.pathname==='/api/status'){send(200,state);return;}
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
  const app=await createStudioServer();const port=Number(process.env.PORT||4173);
  app.server.listen(port,'127.0.0.1',()=>console.log(`Сборка: http://127.0.0.1:${port}`));
  app.server.on('error',error=>{console.error(error.code==='EADDRINUSE'?'Этот порт уже занят. Откройте существующую студию или задайте PORT.':error.message);process.exitCode=1;app.server.close();});
  app.model.then(value=>console.log(value?'Локальная языковая модель готова.':'Модель недоступна: npm run setup:model'));
}
