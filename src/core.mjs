const normalize = value => String(value).toLowerCase().replaceAll('ё','е');
const escapeXML = value => String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;'}[c]));
const n = value => Number(Number(value).toFixed(5));
let sequence = 0;
export const MAX_ITEMS = 50;

export function selectObjects(query, catalog, mode='meaning') {
  const q=normalize(query).trim();
  if(!q) return {ids:[],explanation:'Введите заголовок или выберите объекты.'};
  const words=q.split(/[^a-zа-я0-9]+/).filter(Boolean);
  const ranked=catalog.objects.map((object,index)=>{
    const names=[normalize(object.name),object.id];
    let score=0;
    for(const word of words) {
      if(names.some(name=>name===word || (word.length>=4 && name.startsWith(word.slice(0,-1))))) score+=12;
      if(mode==='meaning') for(const tag of object.tags) if(word.startsWith(normalize(tag))) score+=Math.min(tag.length,8);
    }
    return {id:object.id,index,score};
  }).filter(x=>x.score>0);
  if(mode==='components') {
    ranked.sort((a,b)=>{
      const pos=id=>q.indexOf(normalize(catalog.objects.find(x=>x.id===id).name).slice(0,4));
      return pos(a.id)-pos(b.id);
    });
  } else ranked.sort((a,b)=>b.score-a.score || a.index-b.index);
  return {ids:ranked.slice(0,mode==='meaning'?3:10).map(x=>x.id),explanation:ranked.length?'Подобрано по словарю смыслов библиотеки.':'Не нашлось подходящих объектов. Уточните заголовок или выберите их в библиотеке.'};
}

export function validatePalette(input) {
  if(!input || typeof input!=='object' || !Array.isArray(input.background) || !Array.isArray(input.objects)) throw Error('Палитра: нужны массивы background и objects.');
  if(input.background.length!==3 || input.objects.length<3 || input.objects.length>5) throw Error('Палитра: 3 цвета background и от 3 до 5 цветов objects.');
  const colors=[...input.background,...input.objects];
  if(colors.some(x=>typeof x!=='string' || !/^#[a-f0-9]{6}$/i.test(x))) throw Error('Каждый цвет палитры должен иметь формат #RRGGBB.');
  const objects=input.objects.map(x=>x.toUpperCase());
  if(objects.length===3) objects.push('#181817');
  if(objects.length===4) objects.push('#FFFFFF');
  return {id:input.id || 'custom',name:String(input.name||'Своя палитра').slice(0,50),background:input.background.map(x=>x.toUpperCase()),objects};
}

export function getAsset(item, scene, catalog) {
  const object=catalog.objects.find(x=>x.id===item.assetId);
  if(!object) throw Error('Неизвестный объект библиотеки.');
  return object.variants[scene.detail][item.role];
}

export function createScene(options, catalog) {
  const {ids,detail='L',width=1200,height=630,layout='balanced',variant=0,background=true}=options;
  if(!ids?.length && !options.allowEmpty) throw Error('Выберите хотя бы один объект.');
  if(!['L','S'].includes(detail)) throw Error('Размер должен быть S или L.');
  if(!Number.isFinite(width)||!Number.isFinite(height)||width<200||height<200||width>4096||height>4096) throw Error('Размер холста: от 200 до 4096 пикселей.');
  if(ids.length>MAX_ITEMS) throw Error(`В одной композиции допускается до ${MAX_ITEMS} экземпляров.`);
  const palette=validatePalette(options.palette||catalog.palettes[0]);
  const backgroundStyle=options.backgroundStyle??Math.max(0,catalog.palettes.findIndex(p=>p.id===palette.id));
  const scene={width,height,detail,layout,variant,palette,background,backgroundStyle,items:[]};
  const ordered=ids.map((id,i)=>({id,role:options.roles?.[i]||'main'}));
  if(variant%2 && ordered.length>1) ordered.push(ordered.shift());
  scene.items=ordered.map(({id,role})=>({uid:`object-${++sequence}`,assetId:id,role,x:0,y:0,scale:1,rotation:0}));
  return arrangeScene(scene,catalog);
}

export function arrangeScene(scene,catalog) {
  if(!scene.items.length) return scene;
  scene.items.sort((a,b)=>Number(a.role==='main')-Number(b.role==='main'));
  const margin=Math.min(scene.width,scene.height)*0.065;
  const portraitTitle=scene.layout==='title'&&scene.height>scene.width;
  const area={x:scene.layout==='title'&&!portraitTitle?scene.width*0.38:margin,y:portraitTitle?scene.height*.28:margin};
  area.w=scene.width-area.x-margin;area.h=scene.height-area.y-margin;
  const assets=scene.items.map(item=>getAsset(item,scene,catalog));
  if(scene.items.length>=2&&scene.items.length<=5){
    const main=scene.items.map((item,i)=>({item,i,asset:assets[i]})).filter(x=>x.item.role==='main').sort((a,b)=>b.asset.width*b.asset.height-a.asset.width*a.asset.height);
    const hero=main[0]||scene.items.map((item,i)=>({item,i,asset:assets[i]})).sort((a,b)=>b.asset.width*b.asset.height-a.asset.width*a.asset.height)[0];
    const maxW=Math.max(...assets.map(a=>a.width)),maxH=Math.max(...assets.map(a=>a.height));
    const positions=assets.map(()=>({x:0,y:0}));
    const variant=((scene.variant||0)%3+3)%3,tall=area.h>area.w*1.1;
    const backgrounds=scene.items.map((item,i)=>({item,i})).filter(x=>x.item.role==='background'&&x.i!==hero.i);
    positions[hero.i]=[{x:maxW*.16,y:maxH*.30},{x:maxW*.52,y:maxH*.18},{x:0,y:0}][variant];
    backgrounds.forEach(({i},k)=>{positions[i]=[{x:k*maxW*.22,y:k*maxH*.16},{x:maxW*.10+k*maxW*.25,y:k*maxH*.20},{x:maxW*.33+k*maxW*.20,y:maxH*.16+k*maxH*.24}][variant];});
    const others=main.length?main.slice(1):assets.map((asset,i)=>({asset,i})).filter(x=>x.i!==hero.i);
    others.forEach((other,k)=>{
      const h=positions[hero.i];
      positions[other.i]=variant===0
        ?tall?{x:h.x+hero.asset.width*(k%2?.02:.52),y:h.y+hero.asset.height*(.76+k*.48)}:{x:h.x+hero.asset.width*(.83+(k%2)*.62),y:maxH*(.08+Math.floor(k/2)*.72)}
        :variant===1
          ?tall?{x:maxW*(k%2?.72:0),y:h.y+hero.asset.height*(.76+Math.floor(k/2)*.60)}:{x:maxW*(k%2?.74:0),y:maxH*(.05+Math.floor(k/2)*.74)}
          :{x:h.x+hero.asset.width*(.78+(k%2)*.56),y:h.y+hero.asset.height*(.68+Math.floor(k/2)*.65)};
      if(scene.layout==='diagonal')positions[other.i].y+=maxH*(.20+k*.12);
    });
    const w=Math.max(...assets.map((a,i)=>positions[i].x+a.width));
    const h=Math.max(...assets.map((a,i)=>positions[i].y+a.height));
    const scale=Math.min(area.w/w,area.h/h),offsetX=area.x+(area.w-w*scale)/2,offsetY=area.y+(area.h-h*scale)/2;
    scene.items.forEach((item,i)=>{item.x=n(offsetX+positions[i].x*scale);item.y=n(offsetY+positions[i].y*scale);item.scale=scale;item.rotation=0;});
    return scene;
  }
  const variant=((scene.variant||0)%3+3)%3;
  const gap=80+variant*100;
  let best=null;
  for(let cols=1;cols<=assets.length;cols++) {
    const rows=[];
    for(let i=0;i<assets.length;i+=cols) {
      const slice=assets.slice(i,i+cols);
      rows.push({start:i,w:slice.reduce((sum,a)=>sum+a.width,0)+gap*(slice.length-1),h:Math.max(...slice.map(a=>a.height))});
    }
    const w=Math.max(...rows.map(r=>r.w));const h=rows.reduce((sum,r)=>sum+r.h,0)+gap*(rows.length-1);
    const scale=Math.min(area.w/w,area.h/h)*(assets.length===1?1-variant*.14:1);
    if(!best||scale>best.scale) best={rows,w,h,scale};
  }
  const alignment=assets.length===1?[.5,.2,.8][variant]:.5;
  let y=area.y+(area.h-best.h*best.scale)*alignment;
  for(const row of best.rows) {
    let x=area.x+(area.w-row.w*best.scale)*alignment;
    // Rows own an explicit range; avoid inferred counts when the final row is shorter.
    const next=best.rows.find(r=>r.start>row.start)?.start??assets.length;
    for(let i=row.start;i<next;i++) {
      const asset=assets[i];const item=scene.items[i];
      item.x=n(x);item.y=n(y+(row.h-asset.height)*best.scale*(scene.layout==='diagonal'?(i%2?0.12:0.88):0.5));
      item.scale=best.scale;item.rotation=0;x+=(asset.width+gap)*best.scale;
    }
    y+=(row.h+gap)*best.scale;
  }
  return scene;
}

export function compositionVariant(scene,catalog,variant){
  return arrangeScene({...scene,variant:((variant%3)+3)%3,items:scene.items.map(item=>({...item}))},catalog);
}

export function compositionPreview(scene,catalog,prefix){
  return prefixIds(renderSVG(scene,catalog),prefix);
}

export function setDetail(scene, detail, catalog) {
  return arrangeScene({...scene,detail,items:scene.items.map(x=>({...x}))},catalog);
}

export function recolor(body, sourcePalette, targetPalette) {
  const source=[...sourcePalette.background,...sourcePalette.objects];
  const target=[...targetPalette.background,...targetPalette.objects];
  const map=new Map(source.map((color,i)=>[color.toUpperCase(),target[i]]));
  map.set('WHITE',targetPalette.objects[4]);map.set('BLACK',targetPalette.objects[3]);
  return body.replace(/\b(fill|stroke)="(#[a-f0-9]{6}|white|black)"/gi,(match,attr,color)=>`${attr}="${map.get(color.toUpperCase())||color}"`);
}

function prefixIds(body,prefix) {
  const map=new Map();
  body.replace(/\bid="([^"]+)"/g,(_,id)=>{map.set(id,`${prefix}-${map.size}`);return '';});
  return body.replace(/\bid="([^"]+)"/g,(_,id)=>`id="${map.get(id)}"`).replace(/url\(#([^)]+)\)/g,(_,id)=>`url(#${map.get(id)||id})`);
}

export function renderItem(item,scene,catalog) {
  const a=getAsset(item,scene,catalog);
  const body=prefixIds(recolor(a.body,catalog.palettes[0],scene.palette),item.uid);
  const w=a.width*item.scale,h=a.height*item.scale;
  return `<g id="${escapeXML(item.uid)}" data-object="${escapeXML(item.assetId)}" data-role="${item.role}" transform="translate(${n(item.x)} ${n(item.y)}) rotate(${n(item.rotation)} ${n(w/2)} ${n(h/2)}) scale(${n(item.scale)})"><g transform="translate(${n(-a.x)} ${n(-a.y)})">${body}</g></g>`;
}

export function renderSVG(scene,catalog,{interactive=false}={}) {
  const palette=validatePalette(scene.palette);
  let bg=`<rect width="${scene.width}" height="${scene.height}" fill="${palette.background[0]}"/>`;
  if(scene.background) {
    const index=Number.isInteger(scene.backgroundStyle)&&scene.backgroundStyle>=0&&scene.backgroundStyle<catalog.backgrounds[scene.detail].length?scene.backgroundStyle:Math.max(0,catalog.palettes.findIndex(x=>x.id===palette.id));
    const a=catalog.backgrounds[scene.detail][index];
    const backgroundPalette={...palette,objects:catalog.palettes[index].objects};
    const body=prefixIds(recolor(a.body,catalog.palettes[index],backgroundPalette),'backdrop');
    // Background is adapted to the aspect ratio; illustration objects retain a common uniform scale.
    const scale=Math.max(scene.width/a.width,scene.height/a.height);
    bg=`<g transform="translate(${n((scene.width-a.width*scale)/2)} ${n((scene.height-a.height*scale)/2)}) scale(${n(scale)})"><g transform="translate(${n(-a.x)} ${n(-a.y)})">${body}</g></g>`;
  }
  const title=escapeXML(scene.title||'Композиция из исходных векторных объектов');
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${scene.width}" height="${scene.height}" viewBox="0 0 ${scene.width} ${scene.height}" role="img" aria-label="${title}"><title>${title}</title><defs><clipPath id="artboard-clip"><rect width="${scene.width}" height="${scene.height}"/></clipPath></defs><g clip-path="url(#artboard-clip)">${bg}${scene.items.map(item=>renderItem(item,{...scene,palette},catalog)).join('')}</g></svg>`;
}

export function thumbnail(object,detail,role,palette,catalog) {
  const a=object.variants[detail][role];
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${a.x} ${a.y} ${a.width} ${a.height}" role="img" aria-label="${escapeXML(object.name)}">${prefixIds(recolor(a.body,catalog.palettes[0],palette),`thumb-${object.id}-${role}`)}</svg>`;
}
