import test from 'node:test';
import assert from 'node:assert/strict';
import {createStudioServer} from '../scripts/serve.mjs';
const app=await createStudioServer();
await new Promise(resolve=>app.server.listen(0,'127.0.0.1',resolve));
const base=`http://127.0.0.1:${app.server.address().port}`;
test.after(()=>new Promise(resolve=>app.server.close(resolve)));
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
