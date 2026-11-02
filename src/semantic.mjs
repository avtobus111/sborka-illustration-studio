import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {pipeline,env} from '@huggingface/transformers';
import {semanticProfiles,unsupportedTopics} from './semantic-profiles.mjs';
import {objectConcepts,intentAnchors,objectContexts} from './object-concepts.mjs';

export const MODEL_ID='Xenova/paraphrase-multilingual-MiniLM-L12-v2';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
env.localModelPath=path.join(root,'models')+path.sep;
env.allowRemoteModels=false;
env.allowLocalModels=true;
env.backends.onnx.logLevel='error';
let sharedPipeline;
const cosine=(a,b)=>a.reduce((sum,x,i)=>sum+x*b[i],0);

export async function createSemanticSelector(catalog){
  sharedPipeline??=pipeline('feature-extraction',MODEL_ID,{dtype:'q8',device:'cpu',session_options:{intraOpNumThreads:2,interOpNumThreads:1}}).catch(error=>{sharedPipeline=null;throw error;});
  const encoder=await sharedPipeline;
  const entries=semanticProfiles.flatMap(profile=>profile.descriptions.map(text=>({profile,text})));
  const descriptions=[...entries.map(x=>x.text),...unsupportedTopics];
  // Q8 activation scales can depend on the batch. Encode references individually,
  // exactly like a user query, so an unrelated profile cannot shift existing scores.
  const embeddings=[];
  for(const description of descriptions)embeddings.push((await encoder(description,{pooling:'mean',normalize:true,truncation:true,max_length:192})).tolist()[0]);
  const validIds=new Set(catalog.objects.map(x=>x.id));
  const objectEntries=objectConcepts.flatMap(object=>object.texts.map(text=>({object,text})));
  const objectEmbeddings=[];
  for(const entry of objectEntries)objectEmbeddings.push((await encoder(entry.text,{pooling:'mean',normalize:true,truncation:true,max_length:192})).tolist()[0]);
  const cache=new Map();
  return {
    model:MODEL_ID,
    async select(query){
      const text=String(query||'').trim();
      const empty=explanation=>({ids:[],roles:[],alternatives:[],needsReview:false,engine:'sentence-transformer',model:MODEL_ID,explanation});
      if(text.length<3)return empty('Введите заголовок или метафору.');
      if(text.length>500)throw Error('Запрос должен быть короче 500 символов.');
      if(!/[а-яёa-z]{3}/i.test(text))return empty('Нужна осмысленная фраза словами.');
      if(cache.has(text))return structuredClone(cache.get(text));
      const positive=text.match(/не\s+(?:про|о)\s+.+?\s+а\s+(?:про|о)\s+(.+)$/i)?.[1]||text;
      const vector=(await encoder(positive,{pooling:'mean',normalize:true,truncation:true,max_length:192})).tolist()[0];
      const fragments=positive.split(/\s+(?:и|а также|вместе с|над|чтобы|помогает|помогают)\s+|[,;:]/i).map(s=>s.trim()).filter(s=>s.length>=4&&s!==text&&!/^(?:не\s+(?:про|о)|без)\s/i.test(s)).slice(0,5);
      const fragmentVectors=[];
      for(const fragment of fragments)fragmentVectors.push((await encoder(fragment,{pooling:'mean',normalize:true,truncation:true,max_length:192})).tolist()[0]);
      const objectRanks=objectConcepts.map(object=>({object,score:Math.max(...objectEntries.flatMap((entry,i)=>entry.object===object?[cosine(vector,objectEmbeddings[i]),...fragmentVectors.map(v=>cosine(v,objectEmbeddings[i])*.92)]:[]))})).sort((a,b)=>b.score-a.score);
      const coverage=fragmentVectors.flatMap(v=>{
        const ranks=objectConcepts.map(object=>({id:object.id,score:Math.max(...objectEntries.flatMap((entry,i)=>entry.object===object?[cosine(v,objectEmbeddings[i])]:[]))})).sort((a,b)=>b.score-a.score);
        return ranks.filter(r=>r.score>=Math.max(.48,ranks[0].score-.08)).slice(0,2);
      }).sort((a,b)=>b.score-a.score);
      const ranks=semanticProfiles.map(profile=>({profile,score:Math.max(...entries.flatMap((entry,i)=>entry.profile===profile?[cosine(vector,embeddings[i])]:[]))})).sort((a,b)=>b.score-a.score);
      const unsupported=Math.max(...embeddings.slice(entries.length).map(v=>cosine(vector,v)));
      const best=ranks[0];
      const words=text.match(/[а-яёa-z]+/gi)||[];
      const tokenized=await encoder.tokenizer(text,{truncation:true,max_length:192});
      const fragmented=words.length>=2&&(tokenized.input_ids.dims[1]-2)/words.length>3;
      const objectBest=objectRanks[0].score;
      if((best.score<.33&&objectBest<.45)||unsupported>Math.max(best.score,objectBest)+.005||(fragmented&&Math.max(best.score,objectBest)<.55))return empty('В исходной библиотеке не нашлось убедительной метафоры для этой темы. Уточните смысл или выберите объекты.');
      function sceneFor(profile,score){
        const anchors=intentAnchors[profile.id];
        const selected=[...anchors];
        for(const rank of coverage)if(selected.length<4&&!selected.includes(rank.id))selected.push(rank.id);
        if(selected.includes('coin')&&!selected.includes('wallet')&&objectRanks.find(r=>r.object.id==='wallet').score>=.30&&selected.length<4)selected.push('wallet');
        const threshold=Math.max(.45,objectBest-.08);
        for(const rank of objectRanks){if(selected.length>=4)break;if(rank.score>=threshold&&objectContexts[rank.object.id].includes(profile.id)&&!selected.includes(rank.object.id))selected.push(rank.object.id);}
        // A sparse query gets two objects; an unrelated filler is never mandatory.
        if(selected.length===1&&objectRanks[1].score>=.30)selected.push(objectRanks.find(r=>!selected.includes(r.object.id)).object.id);
        const ids=selected.filter(id=>validIds.has(id));
        const roles=ids.map(id=>anchors.includes(id)||objectRanks.find(r=>r.object.id===id).score>=objectBest-.04?'main':'background');
        return {ids,roles,heroId:anchors[0],reasons:ids.map(id=>({id,reason:objectConcepts.find(o=>o.id===id).reason})),theme:profile.id,themeName:profile.name,confidence:Number(score.toFixed(3))};
      }
      const alternatives=ranks.filter((r,i)=>i===0||r.score>=Math.max(.30,best.score-.12)).slice(0,3).map(({profile,score})=>sceneFor(profile,score));
      const needsReview=best.score<.45||(best.score<.6&&best.score-ranks[1].score<.025);
      const result={...alternatives[0],alternatives,needsReview,strategy:'semantic-object-retrieval',engine:'sentence-transformer',model:MODEL_ID,explanation:needsReview?'Есть несколько возможных трактовок. Выберите подходящий смысл.':`${best.profile.name}. Предметы подобраны по смысловым описаниям библиотеки.`};
      if(!result.ids.includes(result.heroId))throw Error('Смысловая опора отсутствует в каталоге.');
      if(cache.size>=100)cache.delete(cache.keys().next().value);cache.set(text,result);
      return structuredClone(result);
    }
  };
}
