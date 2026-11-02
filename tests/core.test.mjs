import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { selectObjects, createScene, renderSVG, validatePalette, setDetail, arrangeScene } from '../src/core.mjs';
const catalog = JSON.parse(fs.readFileSync(new URL('../assets/catalog.json', import.meta.url)));

test('варианты различаются и у одного предмета, и в большой сцене',()=>{
  for(const ids of [['phone'],['book','phone','puzzle','pen','lamp','folder']]){
    const variants=[0,1,2].map(variant=>createScene({ids,width:1200,height:630,variant},catalog));
    const signatures=variants.map(s=>JSON.stringify([...s.items].sort((a,b)=>a.assetId.localeCompare(b.assetId)).map(i=>[i.assetId,i.x,i.y,i.scale])));
    assert.equal(new Set(signatures).size,3);
  }
});

test('три варианта дают разные композиции при одинаковых предметах, формате и расположении',()=>{
  for(const roles of [['main','main','background'],['main','main','main'],['background','background','background']])for(const [width,height]of [[1200,630],[1080,1080],[1080,1440]]){
    const variants=[0,1,2].map(variant=>createScene({ids:['wallet','coin','folder'],roles,width,height,variant},catalog));
    const signature=s=>JSON.stringify([...s.items].sort((a,b)=>a.assetId.localeCompare(b.assetId)).map(i=>[i.assetId,i.x,i.y,i.scale]));
    assert.equal(new Set(variants.map(signature)).size,3);
    for(const s of variants)for(const item of s.items){const a=catalog.objects.find(o=>o.id===item.assetId).variants[s.detail][item.role];assert.ok(item.x>=0&&item.y>=0&&item.x+a.width*item.scale<=width+.1&&item.y+a.height*item.scale<=height+.1);assert.equal(item.scale,s.items[0].scale);}
  }
});

test('место под заголовок оставляет верх портрета и левую часть обложки свободными',()=>{
  const options={ids:['phone','puzzle','pen'],roles:['main','main','background'],layout:'title'};
  for(const variant of [0,1,2]){
    const wide=createScene({...options,width:1200,height:630,variant},catalog),tall=createScene({...options,width:1080,height:1440,variant},catalog);
    assert.ok(wide.items.every(i=>i.x>=1200*.35));
    assert.ok(tall.items.every(i=>i.y>=1440*.26));
  }
});
test('названия компонентов дают именно запрошенные объекты', () => {
  assert.deepEqual(selectObjects('книга, наушники, лампа', catalog, 'components').ids, ['book','headphones','lamp']);
});
test('подбор связывает накопления с кошельком и монетой', () => {
  const result = selectObjects('Как накопить деньги', catalog);
  assert.ok(result.ids.includes('wallet'));
  assert.ok(result.ids.includes('coin'));
});
test('неизвестный запрос и пустой набор не создают ложную композицию', () => {
  assert.equal(selectObjects('абракадабра',catalog).ids.length,0);
  assert.throws(() => createScene({ids:[],width:1200,height:630},catalog), /объект/);
});
test('общий масштаб сохраняет относительные размеры для всех форматов и S/L', () => {
  for(const detail of ['S','L']) for(const [width,height] of [[1200,630],[1080,1080],[1080,1440]]) {
    const s=createScene({ids:['book','phone','lamp','coin'],detail,width,height},catalog);
    assert.equal(new Set(s.items.map(x=>x.scale)).size,1);
    for(const item of s.items) {
      const a=catalog.objects.find(x=>x.id===item.assetId).variants[detail][item.role];
      assert.ok(item.x>=0 && item.y>=0);
      assert.ok(item.x+a.width*item.scale<=width+0.1);
      assert.ok(item.y+a.height*item.scale<=height+0.1);
    }
  }
});
test('SVG содержит исходные пути и самостоятельный векторный документ без растра', () => {
  const s=createScene({ids:['book','lamp'],width:1200,height:630},catalog);
  s.items.push({...s.items[0],uid:'copy'});
  const svg=renderSVG(s,catalog);
  assert.match(svg,/<svg[^>]+viewBox="0 0 1200 630"/);
  assert.match(svg,/<path/);
  assert.doesNotMatch(svg,/<image|<script|foreignObject|href="https?:/i);
  const ids=[...svg.matchAll(/\bid="([^"]+)"/g)].map(x=>x[1]);
  assert.equal(ids.length,new Set(ids).size);
});
test('палитра валидируется целиком, фон не принимает цвета объектов', () => {
  assert.throws(()=>validatePalette({background:['red'],objects:['#ffffff']}),/цвет|палитр/i);
  assert.throws(()=>validatePalette({background:['#ffffff'],objects:[]}),/цвет|палитр/i);
  const p=validatePalette({name:'Моя',background:['#112233','#223344','#334455'],objects:['#aa0011','#bb0022','#cc0033','#dd0044']});
  const s=createScene({ids:['wallet','coin'],palette:p,width:800,height:800},catalog);
  const svg=renderSVG(s,catalog);
  assert.match(svg,/#112233/);
  assert.ok(svg.includes('#AA0011'));
});
test('S/L переключает геометрию сохраняя набор и использует разные исходники', () => {
  const s=createScene({ids:['book','phone'],detail:'L',width:1200,height:630},catalog);
  const before=renderSVG(s,catalog);
  const updated=setDetail(s,'S',catalog);
  assert.deepEqual(updated.items.map(x=>x.assetId),s.items.map(x=>x.assetId));
  assert.notEqual(renderSVG(updated,catalog),before);
});
test('декоративный фон не получает акценты пользовательской палитры',()=>{
  const palette=validatePalette({background:['#112233','#223344','#334455'],objects:['#AA0011','#BB0022','#CC0033','#DD0044','#EE0055']});
  const scene=createScene({ids:['book'],width:1200,height:630,palette},catalog);
  scene.items=[];
  const svg=renderSVG(scene,catalog);
  assert.ok(!svg.includes('#EE0055'),'нейтральный декор фона не должен получать цвет объекта');
});
test('удаление последнего объекта оставляет рабочие настройки сцены',()=>{
  const scene=createScene({ids:['book'],width:1200,height:630},catalog);
  scene.items=[];
  assert.doesNotThrow(()=>arrangeScene(scene,catalog));
  assert.equal(setDetail(scene,'S',catalog).items.length,0);
  assert.ok(renderSVG(scene,catalog).includes('<svg'));
});
test('дубликаты сверх десяти экземпляров сохраняют возможность сменить формат',()=>{
  const s=createScene({ids:Array(11).fill('book'),width:1080,height:1080},catalog);
  assert.equal(s.items.length,11);
  assert.equal(new Set(s.items.map(x=>x.scale)).size,1);
});
test('все ссылки SVG разрешаются для каждой палитры и детализации',()=>{
  for(const detail of ['S','L']) for(const palette of catalog.palettes) {
    const svg=renderSVG(createScene({ids:['book','phone'],detail,palette,width:1200,height:630},catalog),catalog);
    const ids=new Set([...svg.matchAll(/\bid="([^"]+)"/g)].map(x=>x[1]));
    const refs=[...svg.matchAll(/url\(#([^)]+)\)/g)].map(x=>x[1]);
    assert.ok(refs.every(x=>ids.has(x)),`${detail} ${palette.id}: отсутствует определение clipPath`);
  }
});
test('композиция с задним планом сохраняет общий масштаб и границы',()=>{
  for(const detail of ['S','L'])for(const [width,height]of [[1200,630],[1080,1080],[1080,1440]]){
    const scene=createScene({ids:['wallet','coin','folder'],roles:['main','main','background'],detail,width,height},catalog);
    assert.equal(scene.items.find(x=>x.assetId==='folder').role,'background');
    assert.equal(new Set(scene.items.map(x=>x.scale)).size,1);
    for(const item of scene.items){const a=catalog.objects.find(o=>o.id===item.assetId).variants[detail][item.role];assert.ok(item.x>=0&&item.y>=0&&item.x+a.width*item.scale<=width+.1&&item.y+a.height*item.scale<=height+.1);}
    const bg=scene.items.find(x=>x.role==='background'),a=catalog.objects.find(o=>o.id===bg.assetId).variants[detail].background;
    assert.equal(scene.items[0].role,'background');
    const fg=scene.items.find(x=>x.assetId==='wallet'),b=catalog.objects.find(o=>o.id===fg.assetId).variants[detail].main;
    assert.ok(bg.x<fg.x+b.width*fg.scale && fg.x<bg.x+a.width*bg.scale && bg.y<fg.y+b.height*fg.scale && fg.y<bg.y+a.height*bg.scale,'предметы создают передний и задний план');
  }
});
test('перестановка вариантов не передаёт состояние другому объекту',()=>{
  for(const variant of [0,1,2,3]){
    const s=createScene({ids:['phone','puzzle','pen'],roles:['main','main','background'],variant,width:1200,height:630},catalog);
    assert.equal(s.items.find(x=>x.assetId==='pen').role,'background');
    assert.equal(s.items.find(x=>x.assetId==='phone').role,'main');
  }
});
