import {validatePalette,MAX_ITEMS,selectObjects} from './core.mjs';

const projectLibrary='4MCFttsSoP7hgQh29zq5G3';
const projectNumber=(value,min,max)=>typeof value==='number'&&Number.isFinite(value)&&value>=min&&value<=max;

export function restoreProject(text,catalog){
  if(typeof text!=='string'||text.length>1000000)throw Error('Проект должен быть JSON-файлом до 1 МБ.');
  let data;try{data=JSON.parse(text);}catch{throw Error('Не удалось прочитать JSON проекта.');}
  if(!data||data.version!==1||data.library!==projectLibrary)throw Error('Неподдерживаемая версия или библиотека проекта.');
  const s=data.scene;
  if(!s||!projectNumber(s.width,200,4096)||!projectNumber(s.height,200,4096)||!['S','L'].includes(s.detail)||!['balanced','diagonal','title'].includes(s.layout)||!Number.isInteger(s.variant)||s.variant<0||s.variant>1000000||typeof s.background!=='boolean')throw Error('Некорректные параметры холста.');
  if(!Array.isArray(s.items)||s.items.length>MAX_ITEMS)throw Error(`В проекте допускается до ${MAX_ITEMS} предметов.`);
  const ids=new Set(catalog.objects.map(o=>o.id));
  const items=s.items.map((item,index)=>{
    if(!item||!ids.has(item.assetId)||!['main','background'].includes(item.role))throw Error('Проект содержит неизвестный предмет или состояние.');
    if(!projectNumber(item.x,-100000,100000)||!projectNumber(item.y,-100000,100000)||!projectNumber(item.scale,.00001,100)||!projectNumber(item.rotation,-180,180))throw Error('Некорректное положение, масштаб или поворот предмета.');
    return {uid:`restored-${index+1}`,assetId:item.assetId,role:item.role,x:item.x,y:item.y,scale:item.scale,rotation:item.rotation};
  });
  if(items.some(item=>Math.abs(item.scale-items[0].scale)>1e-8))throw Error('Все предметы должны сохранять общий масштаб.');
  const palette=validatePalette(s.palette);
  if(s.backgroundStyle!==undefined&&(!Number.isInteger(s.backgroundStyle)||s.backgroundStyle<0||s.backgroundStyle>2))throw Error('Неизвестный вариант декоративного фона.');
  const backgroundStyle=s.backgroundStyle??Math.max(0,catalog.palettes.findIndex(p=>p.id===palette.id));
  if(s.heroId!=null&&(!ids.has(s.heroId)||!items.some(i=>i.assetId===s.heroId)))throw Error('Смысловой центр отсутствует в проекте.');
  const scene={width:s.width,height:s.height,detail:s.detail,layout:s.layout,variant:s.variant,background:s.background,backgroundStyle,heroId:s.heroId??null,palette,title:String(s.title||'').slice(0,500),items};
  const ui={mode:data.ui?.mode==='components'?'components':'meaning',prompt:typeof data.ui?.prompt==='string'?data.ui.prompt.slice(0,500):scene.title};
  return {scene,ui};
}

export function projectChosenIds(restored,catalog){
  return restored.ui.mode==='components'?selectObjects(restored.ui.prompt,catalog,'components').ids:restored.scene.items.map(i=>i.assetId);
}

export function serializeProject(scene,ui,catalog){
  const text=JSON.stringify({version:1,library:projectLibrary,scene,ui},null,2);
  // Round-trip validation also strips unrelated fields and never imports SVG markup.
  const clean=restoreProject(text,catalog);
  return JSON.stringify({version:1,library:projectLibrary,...clean},null,2);
}
