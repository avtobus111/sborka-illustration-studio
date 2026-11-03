import test from 'node:test';
import assert from 'node:assert/strict';
import {createStudioServer} from '../scripts/serve.mjs';
import * as serverModule from '../scripts/serve.mjs';
import fs from 'node:fs';
import {createScene} from '../src/core.mjs';
import {serializeProject,restoreProject} from '../src/project.mjs';
const catalog=JSON.parse(fs.readFileSync(new URL('../assets/catalog.json',import.meta.url)));
const app=await createStudioServer();
await new Promise(resolve=>app.server.listen(0,'127.0.0.1',resolve));
const base=`http://127.0.0.1:${app.server.address().port}`;
test.after(()=>new Promise(resolve=>app.server.close(resolve)));

test('HTTP выдаёт векторный SVG как скачиваемый файл',async()=>{
 const scene=createScene({ids:['book','lamp'],heroId:'book'},catalog);
 const body=new URLSearchParams({project:serializeProject(scene,{},catalog)});
 const r=await fetch(base+'/api/export/svg',{method:'POST',body});
 assert.equal(r.status,200);assert.match(r.headers.get('content-disposition'),/attachment.*composition.svg/);
 const svg=await r.text();assert.match(svg,/<svg/);assert.match(svg,/data-object="book"/);assert.doesNotMatch(svg,/<image|<script|foreignObject/);
});

test('HTTP выдаёт переносимый JSON и отклоняет постороннюю геометрию',async()=>{
 const project=serializeProject(createScene({ids:['phone','puzzle'],heroId:'phone'},catalog),{mode:'components',prompt:'телефон, пазлы'},catalog);
 const r=await fetch(base+'/api/export/project',{method:'POST',body:new URLSearchParams({project})});
 assert.equal(r.status,200);assert.match(r.headers.get('content-disposition'),/attachment/);
 assert.equal(restoreProject(await r.text(),catalog).scene.heroId,'phone');
 const bad=await fetch(base+'/api/export/svg',{method:'POST',body:new URLSearchParams({project:'<svg><script>bad</script></svg>'})});assert.equal(bad.status,400);
});
test('HTTP API выполняет реальный смысловой подбор',async()=>{
  const response=await fetch(base+'/api/select',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({query:'Найти общий язык'})});
  assert.equal(response.status,200);
  const data=await response.json();assert.ok(data.ids.includes('phone')&&data.ids.includes('puzzle'));assert.equal(data.engine,'sentence-transformer');
});
test('HTTP API сообщает готовность модели',async()=>{
  const r=await fetch(base+'/api/status');const data=await r.json();assert.equal(data.ready,true);assert.ok(data.model);
});
test('ошибочный JSON отклоняется без падения сервера',async()=>{
  const r=await fetch(base+'/api/select',{method:'POST',headers:{'content-type':'application/json'},body:'{broken'});assert.equal(r.status,400);
  assert.equal((await fetch(base+'/')).status,200);
});
test('null вместо объекта запроса получает 400',async()=>{
  const r=await fetch(base+'/api/select',{method:'POST',headers:{'content-type':'application/json'},body:'null'});assert.equal(r.status,400);
});
test('слишком длинный запрос не передаётся модели',async()=>{
  const r=await fetch(base+'/api/select',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({query:'я'.repeat(501)})});assert.equal(r.status,400);
});
test('неподдерживаемые маршруты получают 404',async()=>{
  assert.equal((await fetch(base+'/../package.json')).status,404);
});


test('локальный запуск остаётся на loopback, хостинг принимает HOST и PORT',()=>{
  assert.deepEqual(serverModule.getListenAddress({}),{host:'127.0.0.1',port:4173});
  assert.deepEqual(serverModule.getListenAddress({HOST:'0.0.0.0',PORT:'10000'}),{host:'0.0.0.0',port:10000});
  for(const PORT of ['0','65536','abc','4173.5','-1'])assert.throws(()=>serverModule.getListenAddress({PORT}),/PORT/);
});

test('healthcheck подтверждает готовую модель и возвращает 503 при её недоступности',async()=>{
  await app.model;
  let r=await fetch(base+'/healthz');assert.equal(r.status,200);assert.equal((await r.json()).ready,true);
  app.state.ready=false;
  try {r=await fetch(base+'/healthz');assert.equal(r.status,503);assert.equal((await r.json()).ready,false);}
  finally {app.state.ready=true;}
});
