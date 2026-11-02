import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createScene,renderSVG} from '../src/core.mjs';
import {createSemanticSelector} from '../src/semantic.mjs';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const read=p=>fs.readFileSync(path.join(root,p),'utf8');
const catalog=JSON.parse(read('assets/catalog.json'));
const selector=await createSemanticSelector(catalog);
const core=read('src/core.mjs').replace(/^export /gm,'');
const app=`(()=>{\nconst CATALOG=${JSON.stringify(catalog)};\n${core}\n${read('src/ui.mjs')}\n})();`.replace(/<\/script/gi,'<\\/script');
const html=read('src/index.html').replace('/*__CSS__*/',()=>read('src/style.css')).replace('/*__APP__*/',()=>app);
for(const dir of ['dist','figma-plugin','examples'])fs.mkdirSync(path.join(root,dir),{recursive:true});
fs.writeFileSync(path.join(root,'dist/index.html'),html);
fs.writeFileSync(path.join(root,'figma-plugin/ui.html'),html);
fs.copyFileSync(path.join(root,'src/plugin.js'),path.join(root,'figma-plugin/code.js'));
fs.writeFileSync(path.join(root,'figma-plugin/manifest.json'),JSON.stringify({name:'Сборка — векторная студия',id:'sobrano-illustration-studio-local',api:'1.0.0',main:'code.js',ui:'ui.html',editorType:['figma'],documentAccess:'dynamic-page',networkAccess:{allowedDomains:['none']}},null,2));
const demos=[
 {file:'01-learning.svg',title:'Учиться и сохранять фокус',width:1200,height:630,palette:catalog.palettes[0],detail:'L'},
 {file:'02-savings.svg',title:'Копить на мечту',width:1080,height:1080,palette:catalog.palettes[1],detail:'L'},
 {file:'03-teamwork.svg',title:'Найти общий язык',width:1080,height:1440,palette:catalog.palettes[2],detail:'S'}
];
const results=[];
for(const demo of demos){const selected=await selector.select(demo.title);const s=createScene({...demo,ids:selected.ids,roles:selected.roles},catalog);s.title=demo.title;fs.writeFileSync(path.join(root,'examples',demo.file),renderSVG(s,catalog));results.push({file:demo.file,query:demo.title,...selected});}
fs.writeFileSync(path.join(root,'examples/selections.json'),JSON.stringify(results,null,2));
fs.writeFileSync(path.join(root,'examples/palette-example.json'),JSON.stringify({name:'Моя палитра',background:catalog.palettes[0].background,objects:catalog.palettes[0].objects},null,2));
console.log(`Built: dist/index.html (${Math.round(Buffer.byteLength(html)/1024)} KB), figma-plugin, 3 model-selected SVG examples.`);
