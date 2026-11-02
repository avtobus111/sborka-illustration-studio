import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {pipeline,env} from '@huggingface/transformers';
import {semanticProfiles,unsupportedTopics} from './semantic-profiles.mjs';

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
      const vector=(await encoder(text,{pooling:'mean',normalize:true,truncation:true,max_length:192})).tolist()[0];
      const ranks=semanticProfiles.map(profile=>({profile,score:Math.max(...entries.flatMap((entry,i)=>entry.profile===profile?[cosine(vector,embeddings[i])]:[]))})).sort((a,b)=>b.score-a.score);
      const unsupported=Math.max(...embeddings.slice(entries.length).map(v=>cosine(vector,v)));
      const best=ranks[0];
      const words=text.match(/[а-яёa-z]+/gi)||[];
      const tokenized=await encoder.tokenizer(text,{truncation:true,max_length:192});
      const fragmented=words.length>=2&&(tokenized.input_ids.dims[1]-2)/words.length>3;
      if(best.score<0.33 || unsupported>best.score+0.005 || (best.score<0.45&&(best.score-ranks[1].score<0.02||fragmented)))return empty('В исходной библиотеке не нашлось убедительной метафоры для этой темы. Уточните смысл или выберите объекты.');
      const alternatives=ranks.filter(r=>r.score>=Math.max(.33,best.score-.12)).slice(0,3).map(({profile,score})=>({ids:profile.ids.filter(id=>validIds.has(id)),roles:[...profile.roles],theme:profile.id,themeName:profile.name,confidence:Number(score.toFixed(3))}));
      const needsReview=best.score<.45||(best.score<.6&&best.score-ranks[1].score<.025);
      const result={...alternatives[0],alternatives,needsReview,engine:'sentence-transformer',model:MODEL_ID,explanation:needsReview?'Есть несколько возможных трактовок. Выберите подходящий смысл.':`${best.profile.name}. Объекты подобраны локальной языковой моделью.`};
      if(result.ids.length!==best.profile.ids.length)throw Error('Профиль ссылается на отсутствующий объект каталога.');
      if(cache.size>=100)cache.delete(cache.keys().next().value);cache.set(text,result);
      return structuredClone(result);
    }
  };
}
