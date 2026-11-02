import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createSemanticSelector} from '../src/semantic.mjs';
const catalog=JSON.parse(fs.readFileSync(new URL('../assets/catalog.json',import.meta.url)));
const selector=await createSemanticSelector(catalog);

test('смысловой подбор предлагает до трёх реальных тем для ручного уточнения',async()=>{
  const r=await selector.select('Найти общий язык');
  assert.ok(r.alternatives?.length>=1&&r.alternatives.length<=3);
  assert.equal(r.alternatives[0].theme,r.theme);
  assert.equal(new Set(r.alternatives.map(a=>a.theme)).size,r.alternatives.length);
  for(const a of r.alternatives){assert.ok(a.ids.every(id=>catalog.objects.some(o=>o.id===id)));assert.equal(a.roles.length,a.ids.length);}
  assert.equal(r.needsReview,false);
});

test('слабая ассоциация требует выбора пользователя вместо уверенной сборки',async()=>{
  const r=await selector.select('Удобный сервис всегда под рукой');
  assert.equal(r.needsReview,true);
  assert.ok(r.alternatives.length>0);
});

const cases=[
  {query:'Найти общий язык',required:['puzzle','phone']},
  {query:'Копить на мечту',required:['wallet','coin']},
  {query:'Как накопить деньги',required:['wallet','coin']},
  {query:'Отложить на большую покупку',required:['wallet','coin']},
  {query:'Понять друг друга без лишних слов',required:['puzzle','phone']},
  {query:'Сложить усилия ради общего результата',required:['puzzle']},
  {query:'Освоить новую профессию с нуля',required:['book']},
  {query:'Убрать хаос из рабочих дел',required:['folder']},
  {query:'Тихий вечер с любимыми мелодиями',required:['headphones']},
  {query:'Порадовать близкого человека',required:['flowers']},
  {query:'Сюрприз для мамы к юбилею',required:['flowers']},
  {query:'После получки оставляю немного на будущую квартиру',required:['wallet','coin']},
  {query:'Хочу перестать реагировать на каждое уведомление',required:['headphones']}
];
for(const c of cases)test(`смысловой подбор: ${c.query}`,async()=>{
  const r=await selector.select(c.query);
  assert.ok(c.required.every(id=>r.ids.includes(id)),`${c.query}: ${JSON.stringify(r)}`);
  assert.ok(r.ids.every(id=>catalog.objects.some(o=>o.id===id)),'Выход только из каталога');
  assert.equal(r.engine,'sentence-transformer');
});
test('пустой запрос не получает выдуманный результат',async()=>{
  assert.equal((await selector.select('   ')).ids.length,0);
});
test('случайные символы явно отклоняются',async()=>{
  assert.equal((await selector.select('фывап ролдж ячсмить')).ids.length,0);
});
test('одинаковый запрос даёт одинаковые ID',async()=>{
  const a=await selector.select('Как накопить деньги'),b=await selector.select('Как накопить деньги');
  assert.deepEqual(a.ids,b.ids);
});
for(const query of ['Срочно вылечить зуб','Сварить борщ для всей семьи','блаблабла труляля'])test(`неподдерживаемый или неопределённый смысл: ${query}`,async()=>{
  assert.equal((await selector.select(query)).ids.length,0);
});
