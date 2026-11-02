// Shared UI. Semantic requests go only to the local studio API.
const $=id=>document.getElementById(id);
const clone=value=>JSON.parse(JSON.stringify(value));
const catalog=CATALOG;
const isFigma=window.parent!==window;
let mode='meaning',chosen=new Set(['book','lamp','headphones']),selected=null,history=[],future=[],drag=null,buildVersion=0;
const apiBase=location.protocol==='file:'||isFigma?'http://127.0.0.1:4173':'';
let scene=createScene({ids:[...chosen],roles:['main','main','background'],width:1200,height:630,detail:'L'},catalog);
scene.title='Учиться и сохранять фокус';
const palettes=[...catalog.palettes];

function status(text,error=false){$('status').textContent=text;$('status').classList.toggle('error',error);}
function remember(){history.push(clone(scene));if(history.length>40)history.shift();future=[];}
function changed(message){render();if(message)status(message);}
function objectFor(item){return catalog.objects.find(o=>o.id===item.assetId);}
function current(){return scene.items.find(x=>x.uid===selected);}
function renderLibrary(){
  const filter=$('library-search').value.toLowerCase().replaceAll('ё','е');
  $('library').innerHTML=catalog.objects.filter(o=>o.name.toLowerCase().replaceAll('ё','е').includes(filter)).map(o=>`<button class="asset-card" data-asset="${o.id}" aria-pressed="${chosen.has(o.id)}" aria-label="${o.name}"><span class="asset-check" aria-hidden="true">${chosen.has(o.id)?'✓':''}</span>${thumbnail(o,scene.detail,'main',scene.palette,catalog)}<span>${o.name}</span></button>`).join('');
}
function renderPalettes(){
  $('palettes').innerHTML='';
  for(const p of palettes){
    const button=document.createElement('button');button.className='palette-row'+(p.id===scene.palette.id?' active':'');button.setAttribute('aria-label',`Палитра ${p.name}`);button.setAttribute('aria-pressed',String(p.id===scene.palette.id));
    const label=document.createElement('span');label.className='palette-name';label.textContent=p.name;
    const swatches=document.createElement('span');swatches.className='swatches';
    [...p.background,...p.objects.slice(0,3)].forEach(c=>{const el=document.createElement('i');el.style.background=c;swatches.append(el);});
    const check=document.createElement('span');check.className='palette-check';check.textContent=p.id===scene.palette.id?'✓':'';button.append(label,swatches,check);
    button.addEventListener('click',()=>{remember();scene.palette=clone(p);changed(`Палитра «${p.name}» применена ко всей композиции.`);});$('palettes').append(button);
  }
}
function renderInspector(){
  const item=current();$('selection-empty').hidden=!!item;$('selection-controls').hidden=!item;$('selection-title').textContent=item?objectFor(item).name:'Объект';$('selection-kind').textContent=item?scene.detail:'не выбран';
  if(item){$('object-role').value=item.role;$('rotation').value=item.rotation;$('rotation-value').value=`${item.rotation}°`;}
  ['duplicate','delete','layer-up','layer-down'].forEach(id=>$(id).disabled=!item);
  $('layers').innerHTML=[...scene.items].reverse().map(item=>`<button class="layer-row${item.uid===selected?' active':''}" data-layer="${item.uid}">${thumbnail(objectFor(item),scene.detail,item.role,scene.palette,catalog)}${objectFor(item).name}<span>${item.role==='main'?'главный':'фоновый'}</span></button>`).join('');
}
function selectionBox(){
  $('selection-box')?.remove();const item=current();if(!item)return;
  const a=getAsset(item,scene,catalog);const box=document.createElement('div');box.id='selection-box';
  Object.assign(box.style,{left:`${item.x/scene.width*100}%`,top:`${item.y/scene.height*100}%`,width:`${a.width*item.scale/scene.width*100}%`,height:`${a.height*item.scale/scene.height*100}%`,transform:`rotate(${item.rotation}deg)`});$('artboard').append(box);
}
function draw(){
  $('artboard').innerHTML=renderSVG(scene,catalog,{interactive:true});$('artboard').style.aspectRatio=`${scene.width}/${scene.height}`;
  const well=$('artboard').parentElement;const maxHeight=Math.max(220,well.clientHeight-105);
  $('artboard').style.maxWidth=`${maxHeight*scene.width/scene.height}px`;
  selectionBox();
}
function render(){
  draw();renderLibrary();renderPalettes();renderInspector();$('canvas-size').textContent=`${scene.width} × ${scene.height}`;
  document.querySelectorAll('[data-detail]').forEach(b=>{b.classList.toggle('active',b.dataset.detail===scene.detail);b.setAttribute('aria-pressed',String(b.dataset.detail===scene.detail));});
  $('background').checked=scene.background;$('layout').value=scene.layout;$('undo').disabled=!history.length;$('redo').disabled=!future.length;
  const sizeValue=`${scene.width},${scene.height}`;
  $('format').value=[...$('format').options].some(o=>o.value===sizeValue)?sizeValue:'custom';
  $('custom-size').hidden=$('format').value!=='custom';$('width').value=scene.width;$('height').value=scene.height;
}
function download(text,name,type='image/svg+xml'){
  const url=URL.createObjectURL(new Blob([text],{type}));const a=document.createElement('a');a.href=url;a.download=name;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);
}
async function build(){
  const version=++buildVersion;const query=$('prompt').value;
  try{
    let result;
    if(mode==='meaning'){
      $('generate').disabled=true;$('generate').textContent='Подбираю…';status('Анализирую смысл и подбираю исходные объекты…');
      let response;
      try{response=await fetch(apiBase+'/api/select',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({query}),signal:AbortSignal.timeout(30000)});}catch{throw Error('Смысловой подбор недоступен. Запустите START.cmd или npm start и попробуйте снова.');}
      result=await response.json();if(!response.ok)throw Error(result.error||'Не удалось выполнить подбор.');
    }
    else {
      const typed=selectObjects($('prompt').value,catalog,'components');
      result={ids:chosen.size?[...chosen]:typed.ids,explanation:'Собрано из выбранных объектов.'};
    }
    if(version!==buildVersion)return;
    if(!result.ids.length){status(result.explanation||'Выберите объекты в библиотеке.',true);return;}
    remember();scene=createScene({ids:result.ids,roles:result.roles,width:scene.width,height:scene.height,detail:scene.detail,palette:scene.palette,layout:scene.layout,background:scene.background,variant:scene.variant},catalog);
    scene.title=query.trim().slice(0,160)||'Композиция';scene.semantic=result.engine?{theme:result.theme,engine:result.engine}:null;chosen=new Set(result.ids);selected=null;changed(`${result.ids.length} объекта · ${result.explanation}`);
  }catch(error){if(version===buildVersion)status(error.message,true);}
  finally{if(version===buildVersion){$('generate').disabled=false;$('generate').innerHTML='Собрать <span aria-hidden="true">↗</span>';}}
}
function setMode(next){
  buildVersion++;$('generate').disabled=false;$('generate').innerHTML='Собрать <span aria-hidden="true">↗</span>';
  mode=next;
  for(const m of ['meaning','components']){$(`${m}-tab`).classList.toggle('active',m===mode);$(`${m}-tab`).setAttribute('aria-selected',String(m===mode));}
  $('prompt').placeholder=mode==='meaning'?'О чём ваша иллюстрация?':'Например: книга, телефон, пазлы';
  $('prompt').value=mode==='meaning'?'':catalog.objects.filter(x=>chosen.has(x.id)).map(x=>x.name).join(', ');
  $('prompt-hint').textContent=mode==='meaning'?'Заголовок → подбор объектов → композиция':'Выбор в библиотеке или названия через запятую';
}
$('meaning-tab').onclick=()=>setMode('meaning');$('components-tab').onclick=()=>setMode('components');$('generate').onclick=build;
$('prompt').addEventListener('keydown',e=>{if(e.key==='Enter'&&(e.ctrlKey||e.metaKey)){e.preventDefault();build();}});
$('prompt').addEventListener('input',()=>{buildVersion++;$('generate').disabled=false;$('generate').innerHTML='Собрать <span aria-hidden="true">↗</span>';if(mode==='components'){chosen=new Set(selectObjects($('prompt').value,catalog,'components').ids);renderLibrary();}});
document.querySelectorAll('[data-prompt]').forEach(b=>b.onclick=()=>{if(mode!=='meaning')setMode('meaning');$('prompt').value=b.dataset.prompt;build();});
$('library-search').oninput=renderLibrary;
$('library').onclick=e=>{
  const button=e.target.closest('[data-asset]');if(!button)return;const id=button.dataset.asset;
  chosen.has(id)?chosen.delete(id):chosen.add(id);renderLibrary();
  if(mode!=='components')setMode('components');
  $('prompt').value=catalog.objects.filter(x=>chosen.has(x.id)).map(x=>x.name).join(', ');
  status(`${chosen.size} объектов выбрано. Нажмите «Собрать».`);
};
$('variant').onclick=()=>{remember();scene.variant++;const items=[...scene.items];if(items.length>1)items.push(items.shift());scene.items=items;scene.layout=['balanced','diagonal','title'][scene.variant%3];arrangeScene(scene,catalog);changed('Новый вариант расположения готов.');};
document.querySelectorAll('[data-detail]').forEach(b=>b.onclick=()=>{if(scene.detail===b.dataset.detail)return;remember();scene=setDetail(scene,b.dataset.detail,catalog);changed(`Загружены исходные векторы ${scene.detail}. Раскладка пересчитана.`);});
$('layout').onchange=()=>{remember();scene.layout=$('layout').value;arrangeScene(scene,catalog);changed('Расположение обновлено.');};
function resize(width,height){
  try{const next=createScene({ids:scene.items.map(x=>x.assetId),roles:scene.items.map(x=>x.role),width,height,detail:scene.detail,palette:scene.palette,layout:scene.layout,background:scene.background,allowEmpty:true},catalog);remember();scene={...next,title:scene.title};selected=null;changed('Композиция адаптирована под новый формат.');}catch(error){status(error.message,true);}
}
$('format').onchange=()=>{const custom=$('format').value==='custom';$('custom-size').hidden=!custom;if(!custom)resize(...$('format').value.split(',').map(Number));};
$('apply-size').onclick=()=>resize(Number($('width').value),Number($('height').value));
$('background').onchange=()=>{remember();scene.background=$('background').checked;changed();};
$('import-palette').onclick=()=>$('palette-file').click();
$('palette-file').onchange=async()=>{
  const file=$('palette-file').files[0];if(!file)return;
  try{if(file.size>50000)throw Error('Файл палитры слишком большой. Максимум 50 КБ.');const p=validatePalette(JSON.parse(await file.text()));p.id=`custom-${Date.now()}`;remember();palettes.push(p);scene.palette=p;changed(`Палитра «${p.name}» загружена.`);}catch(error){status(`Не удалось загрузить палитру: ${error.message}`,true);}finally{$('palette-file').value='';}
};
$('palette-example').onclick=()=>download(JSON.stringify({name:'Моя палитра',background:['#D7CDF5','#AA9BF0','#7864D7'],objects:['#F9ECB0','#F9A3AA','#FFE3E1','#181817','#FFFFFF']},null,2),'palette-example.json','application/json');
$('layers').onclick=e=>{const b=e.target.closest('[data-layer]');if(!b)return;selected=b.dataset.layer;renderInspector();selectionBox();};
$('object-role').onchange=()=>{const item=current();if(!item)return;remember();item.role=$('object-role').value;changed('Состояние объекта изменено.');};
$('rotation').addEventListener('pointerdown',()=>{if(current())remember();});
$('rotation').addEventListener('keydown',e=>{if(['ArrowLeft','ArrowRight','Home','End'].includes(e.key)&&current())remember();});
$('rotation').oninput=()=>{const item=current();if(!item)return;item.rotation=Number($('rotation').value);$('rotation-value').value=`${item.rotation}°`;draw();};
$('rotation').onchange=()=>changed();
$('duplicate').onclick=()=>{const item=current();if(!item)return;if(scene.items.length>=MAX_ITEMS){status(`Максимум ${MAX_ITEMS} экземпляров в одной композиции. Удалите лишние объекты.`,true);return;}remember();const copy={...item,uid:`copy-${Date.now()}-${sequence++}`,x:item.x+20,y:item.y+20};scene.items.push(copy);selected=copy.uid;changed('Объект продублирован.');};
function removeSelected(){if(!current())return;remember();scene.items=scene.items.filter(x=>x.uid!==selected);selected=null;changed('Объект удалён.');}
$('delete').onclick=removeSelected;
function moveLayer(delta){const index=scene.items.findIndex(x=>x.uid===selected),next=index+delta;if(index<0||next<0||next>=scene.items.length)return;remember();[scene.items[index],scene.items[next]]=[scene.items[next],scene.items[index]];changed('Порядок слоёв изменён.');}
$('layer-up').onclick=()=>moveLayer(1);$('layer-down').onclick=()=>moveLayer(-1);
function undo(){if(!history.length)return;future.push(clone(scene));scene=history.pop();selected=null;changed('Действие отменено.');}
function redo(){if(!future.length)return;history.push(clone(scene));scene=future.pop();selected=null;changed('Действие повторено.');}
$('undo').onclick=undo;$('redo').onclick=redo;
$('artboard').addEventListener('pointerdown',e=>{
  const group=e.target.closest('g[data-object]');selected=group?.id||null;renderInspector();selectionBox();if(!selected)return;
  const rect=$('artboard').getBoundingClientRect();const item=current();remember();drag={clientX:e.clientX,clientY:e.clientY,x:item.x,y:item.y,ratio:scene.width/rect.width,pointerId:e.pointerId};$('artboard').setPointerCapture(e.pointerId);$('artboard').classList.add('dragging');e.preventDefault();
});
$('artboard').addEventListener('pointermove',e=>{if(!drag||!current())return;const item=current();item.x=drag.x+(e.clientX-drag.clientX)*drag.ratio;item.y=drag.y+(e.clientY-drag.clientY)*drag.ratio;draw();});
function endDrag(){if(!drag)return;drag=null;$('artboard').classList.remove('dragging');renderInspector();$('undo').disabled=!history.length;$('redo').disabled=true;status('Положение изменено. Объекты за краем холста обрезаются при экспорте.');}
$('artboard').addEventListener('pointerup',endDrag);$('artboard').addEventListener('pointercancel',endDrag);
document.addEventListener('keydown',e=>{
  if(['INPUT','TEXTAREA','SELECT'].includes(e.target.tagName))return;
  if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='z'){e.preventDefault();e.shiftKey?redo():undo();return;}
  if(e.key==='Delete'||e.key==='Backspace'){if(current()){e.preventDefault();removeSelected();}return;}
  const moves={ArrowLeft:[-1,0],ArrowRight:[1,0],ArrowUp:[0,-1],ArrowDown:[0,1]};
  if(current()&&moves[e.key]){e.preventDefault();remember();const [x,y]=moves[e.key],step=e.shiftKey?10:1;current().x+=x*step;current().y+=y*step;changed();}
});
$('export-button').onclick=()=>{download(renderSVG(scene,catalog),'composition.svg');status('SVG подготовлен к скачиванию.');};
$('help-button').onclick=()=>$('help-dialog').showModal();$('close-help').onclick=()=>$('help-dialog').close();
$('help-dialog').addEventListener('click',e=>{if(e.target===$('help-dialog'))$('help-dialog').close();});
if(isFigma){$('figma-insert').hidden=false;$('export-native').hidden=false;$('export-button').classList.remove('primary');$('export-button').classList.add('quiet');}
$('figma-insert').onclick=()=>{parent.postMessage({pluginMessage:{type:'insert',svg:renderSVG(scene,catalog),title:scene.title,width:scene.width,height:scene.height}},'*');status('Добавляю композицию на холст Figma…');};
$('export-native').onclick=()=>parent.postMessage({pluginMessage:{type:'export-selection'}},'*');
window.addEventListener('message',e=>{const msg=e.data.pluginMessage;if(!msg)return;if(msg.type==='export-result')download(msg.svg,'figma-composition.svg');if(msg.type==='status')status(msg.text,!!msg.error);});
new ResizeObserver(()=>draw()).observe($('artboard').parentElement);
render();status('3 объекта · исходная библиотека L · палитра «Сирень».');
async function checkModel(attempt=0){
  try{const response=await fetch(apiBase+'/api/status',{signal:AbortSignal.timeout(3000)});if(!response.ok)throw Error();const data=await response.json();$('engine-label').textContent=data.ready?'Модель готова':data.error?'Нужен запуск модели':'Загрузка модели…';if(!data.ready&&!data.error&&attempt<15)setTimeout(()=>checkModel(attempt+1),1000);}
  catch{$('engine-label').textContent='Запустите START.cmd для подбора';}
}
checkModel();
