import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {spawnSync} from 'node:child_process';
import {Resvg} from '@resvg/resvg-js';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const directory=path.join(root,'demo');fs.mkdirSync(directory,{recursive:true});
const results=JSON.parse(fs.readFileSync(path.join(root,'examples/selections.json'),'utf8'));
const catalog=JSON.parse(fs.readFileSync(path.join(root,'assets/catalog.json'),'utf8'));
const escape=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;'}[c]));
for(const [i,result]of results.entries()){
  const original=fs.readFileSync(path.join(root,'examples',result.file),'utf8');
  const width=Number(original.match(/width="([\d.]+)"/)[1]),height=Number(original.match(/height="([\d.]+)"/)[1]);
  const scale=Math.min(1180/width,780/height),w=width*scale,h=height*scale;
  const image=original.replace('<svg ',`<svg x="${650+(1180-w)/2}" y="${190+(780-h)/2}" `).replace(`width="${width}"`,`width="${w}"`).replace(`height="${height}"`,`height="${h}"`);
  const objects=result.ids.map((id,index)=>`${catalog.objects.find(o=>o.id===id).name} · ${result.roles[index]==='main'?'главный':'фоновый'}`);
  const svg=`<svg xmlns="http://www.w3.org/2000/svg" width="1920" height="1080"><rect width="1920" height="1080" fill="#F4F5F7"/><rect width="1920" height="122" fill="white"/><text x="80" y="77" font-family="Segoe UI" font-size="42" font-weight="700" fill="#233D67">сборка.</text><text x="370" y="73" font-family="Segoe UI" font-size="25" fill="#646F7F">Примеры автоматической сборки</text><text x="80" y="252" font-family="Segoe UI" font-size="23" fill="#646F7F">Заголовок / метафора</text><text x="80" y="307" font-family="Segoe UI" font-size="34" font-weight="600" fill="#24272D">${escape(result.query)}</text><text x="80" y="410" font-family="Segoe UI" font-size="23" fill="#646F7F">Выбрана тема</text><text x="80" y="457" font-family="Segoe UI" font-size="27" fill="#233D67">${escape(result.themeName)}</text><text x="80" y="565" font-family="Segoe UI" font-size="23" fill="#646F7F">Исходные объекты</text>${objects.map((text,k)=>`<text x="80" y="${615+k*44}" font-family="Segoe UI" font-size="24" fill="#404B5B">${escape(text)}</text>`).join('')}<text x="80" y="904" font-family="Segoe UI" font-size="21" fill="#646F7F">Локальная языковая модель</text><text x="80" y="942" font-family="Segoe UI" font-size="21" fill="#646F7F">Новые изображения не генерируются</text>${image}<text x="80" y="1033" font-family="Segoe UI" font-size="20" fill="#646F7F">Реальные результаты модели и общего SVG-движка · исходные пути сохранены · 1200×630 / 1080×1080 / 1080×1440</text></svg>`;
  const renderer=new Resvg(svg,{font:{loadSystemFonts:true,defaultFontFamily:'Segoe UI'}});
  fs.writeFileSync(path.join(directory,`step-${String(i+1).padStart(2,'0')}.png`),renderer.render().asPng());
}
const video=spawnSync('ffmpeg',['-hide_banner','-loglevel','error','-y','-framerate','1/7','-i',path.join(directory,'step-%02d.png'),'-c:v','libx264','-preset','medium','-crf','20','-r','30','-t','21','-pix_fmt','yuv420p','-movflags','+faststart',path.join(directory,'demo.mp4')],{windowsHide:true,stdio:'inherit'});
if(video.status!==0)throw Error('Не удалось собрать видео ffmpeg.');
console.log('Demo: 3 real model outputs, 21 seconds.');
