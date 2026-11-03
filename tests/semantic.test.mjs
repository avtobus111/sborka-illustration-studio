import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createSemanticSelector} from '../src/semantic.mjs';
const catalog=JSON.parse(fs.readFileSync(new URL('../assets/catalog.json',import.meta.url)));
const selector=await createSemanticSelector(catalog);

test('производные слова проходят смысловой подбор вместо обхода по названиям',async()=>{
 for(const query of ['монетизация','телефония'])assert.notEqual((await selector.select(query)).engine,'catalog-names');
});

test('финансовая метафора сохраняет сильную пару без слабой фоновой ручки',async()=>{
 const r=await selector.select('Копить на мечту');
 assert.deepEqual(new Set(r.ids),new Set(['wallet','coin']));
});

test('явно названная головоломка имеет приоритет над вечерней темой',async()=>{
 const r=await selector.select('Вечер головоломок без телефона');
 assert.ok(r.ids.includes('puzzle'));assert.equal(r.heroId,'puzzle');assert.ok(!r.ids.includes('phone'));
 assert.ok(r.alternatives.every(a=>a.ids.includes('puzzle')&&!a.ids.includes('phone')));
});

test('читальный уголок содержит книгу во всех предложенных трактовках',async()=>{
 const r=await selector.select('Ночной читальный уголок с мягким светом');
 assert.ok(r.ids.includes('book'));assert.equal(r.heroId,'book');
 assert.ok(r.alternatives.every(a=>a.ids.includes('book')));
});

test('чистое перечисление предметов не дополняется случайными соседями',async()=>{
 const r=await selector.select('смартфон, пазлы и книга');
 assert.deepEqual(r.ids,['phone','puzzle','book']);assert.equal(r.strategy,'explicit-components');assert.equal(r.needsReview,false);
 const single=await selector.select('светильник');assert.deepEqual(single.ids,['lamp']);
});

test('простая финансовая метафора не заполняется отвлекающими предметами',async()=>{
 const r=await selector.select('Копить на мечту');
 assert.ok(r.ids.includes('wallet')&&r.ids.includes('coin'));
 assert.ok(!r.ids.includes('lamp'),JSON.stringify(r.ids));
 assert.ok(r.ids.length<=3);
});

test('явная конструкция не про X а про Y исключает отрицательный финансовый смысл',async()=>{
 const r=await selector.select('Не про деньги, а про музыку в дороге');
 assert.ok(r.ids.includes('headphones'));
 assert.ok(!r.ids.includes('wallet')&&!r.ids.includes('coin'),JSON.stringify(r.ids));
});

for(const c of [
 {q:'Сотрудничаем над учебным проектом',ids:['book','puzzle']},
 {q:'Мобильный банк помогает копить',ids:['phone','wallet','coin']},
 {q:'Записываю лекции с электронного курса',ids:['book','pen']},
 {q:'Планирую покупки заранее',ids:['wallet','pen']}
])test(`комбинированный смысл: ${c.q}`,async()=>{
 const r=await selector.select(c.q);
 assert.ok(c.ids.every(id=>r.ids.includes(id)),JSON.stringify(r));
 assert.equal(r.strategy,'semantic-object-retrieval');
 assert.ok(r.ids.includes(r.heroId));
 assert.equal(r.reasons.length,r.ids.length);
 assert.ok(r.reasons.every(x=>r.ids.includes(x.id)&&typeof x.reason==='string'));
});

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
test('исключения, положительный префикс и цветок сохраняют буквальный смысл',async()=>{
 assert.deepEqual((await selector.select('Без телефона, кошелька и монет')).ids,[]);
 const r=await selector.select('Книга: не про деньги, а про музыку в дороге');
 assert.ok(r.ids.includes('book')&&r.ids.includes('headphones'),JSON.stringify(r));
 assert.ok(r.alternatives.every(a=>a.ids.includes('book')));
 assert.deepEqual((await selector.select('Цветок и ручка')).ids,['flowers','pen']);
});
