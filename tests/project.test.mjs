import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createScene} from '../src/core.mjs';
const catalog=JSON.parse(fs.readFileSync(new URL('../assets/catalog.json',import.meta.url)));
const project=await import('../src/project.mjs').catch(()=>null);
const make=()=>createScene({ids:['phone','puzzle','pen'],roles:['main','main','background'],width:1080,height:1440,variant:2},catalog);

test('проект сохраняет ручную композицию и восстанавливает редактируемые предметы',()=>{
  assert.equal(typeof project?.serializeProject,'function');
  const scene=make();scene.title='Найти общий язык';scene.items[1].x=123.5;scene.items[1].rotation=-25;
  const text=project.serializeProject(scene,{mode:'meaning',prompt:'Найти общий язык'},catalog);
  assert.doesNotMatch(text,/<path|<svg|<script/);
  const restored=project.restoreProject(text,catalog);
  for(const key of ['width','height','detail','layout','variant','palette','background','title'])assert.deepEqual(restored.scene[key],scene[key]);
  assert.deepEqual(restored.scene.items.map(({uid,...item})=>item),scene.items.map(({uid,...item})=>item));
  assert.equal(new Set(restored.scene.items.map(i=>i.uid)).size,scene.items.length);
  assert.deepEqual(restored.ui,{mode:'meaning',prompt:'Найти общий язык'});
});

test('пустая сцена также сохраняется без восстановления удалённых предметов',()=>{
  const scene=make();scene.items=[];
  assert.equal(project.restoreProject(project.serializeProject(scene,{},catalog),catalog).scene.items.length,0);
});

test('черновик ввода компонентов не подменяется предметами предыдущей сцены',()=>{
  assert.equal(typeof project?.projectChosenIds,'function');
  const restored=project.restoreProject(project.serializeProject(make(),{mode:'components',prompt:'телефон'},catalog),catalog);
  assert.deepEqual(project.projectChosenIds(restored,catalog),['phone']);
});

test('геометрия фона пользовательской палитры сохраняется отдельно от её цветов',()=>{
  const palette={...catalog.palettes[1],id:'custom-peach',name:'Пользовательская'};
  const scene=createScene({ids:['book'],palette},catalog);
  assert.equal(scene.backgroundStyle,0);
  const restored=project.restoreProject(project.serializeProject(scene,{},catalog),catalog);
  assert.equal(restored.scene.backgroundStyle,0);
  restored.scene.palette={...catalog.palettes[1]};
  assert.equal(restored.scene.backgroundStyle,0,'совпадение цветов с Персиком не меняет исходный фон');
});

test('импорт проекта отклоняет посторонние ID, размеры, масштабы и повреждённые данные',()=>{
  assert.equal(typeof project?.serializeProject,'function');
  const source=JSON.parse(project.serializeProject(make(),{},catalog));
  const changes=[d=>d.version=999,d=>d.library='other',d=>d.scene.width=Infinity,d=>d.scene.height=1,d=>d.scene.items[0].assetId='airplane',d=>d.scene.items[0].role='html',d=>d.scene.items[0].scale=0,d=>d.scene.items[0].scale*=2,d=>d.scene.items[0].rotation='10',d=>d.scene.items[0].x=null,d=>d.scene.items=Array(51).fill(d.scene.items[0])];
  for(const mutate of changes){const data=structuredClone(source);mutate(data);assert.throws(()=>project.restoreProject(JSON.stringify(data),catalog));}
  assert.throws(()=>project.restoreProject('null',catalog));
  assert.throws(()=>project.restoreProject('{oops',catalog));
  assert.throws(()=>project.restoreProject(' '.repeat(1000001),catalog));
});
