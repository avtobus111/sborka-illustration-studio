// Concrete library names and narrow synonyms. These are not headline templates.
const componentAliases=[
 ['book',/^(?:книг[а-я]*|книжн[а-я]*|учебник[а-я]*|читальн[а-я]*|books?)$/],
 ['phone',/^(?:(?:телефон|смартфон)(?:а|у|е|ы|ом|ов|ам|ами|ах)?|phones?|smartphones?)$/],
 ['puzzle',/^(?:пазл[а-я]*|головолом[а-я]*|puzzles?)$/],
 ['coin',/^(?:монет(?:а|ы|е|у|ой|ою|ам|ами|ах)?|coins?)$/],
 ['headphones',/^(?:наушник[а-я]*|headphones?)$/],
 ['lamp',/^(?:ламп[а-я]*|светильник[а-я]*|lamps?)$/],
 ['flowers',/^(?:цвет(?:ы|ов|ами|ам|ах|ок|к[а-я]*)|букет[а-я]*|тюльпан[а-я]*|flowers?)$/],
 ['wallet',/^(?:кошел[а-я]*|бумажник[а-я]*|wallets?)$/],
 ['folder',/^(?:папк[а-я]*|скоросшивател[а-я]*|folders?)$/],
 ['pen',/^(?:ручк[а-я]*|pens?)$/]
];
const componentConnectors=new Set(['и','или','а','но','зато','с','со','без','кроме','не','только','плюс','and','without']);

export function readComponentNames(value){
 const tokens=String(value).toLowerCase().replaceAll('ё','е').match(/[a-zа-я]+|[,;.!?]/g)||[];
 const ids=[],excluded=[],mentions=[],unmatched=[];let negative=false,exclusionList=false,onlyNames=true;
 for(const token of tokens){
  if(/^[,;.!?]$/.test(token)){if(token!==','||!exclusionList){negative=false;exclusionList=false;}continue;}
  if(['а','но','зато','с','со'].includes(token)){negative=false;exclusionList=false;continue;}
  if(['без','кроме','не','without'].includes(token)){negative=true;exclusionList=ids.length===0;continue;}
  if(token==='только'){negative=false;exclusionList=false;continue;}
  const id=componentAliases.find(([,pattern])=>pattern.test(token))?.[0];
  if(id){const target=negative?excluded:ids;if(!target.includes(id))target.push(id);mentions.push({id,word:token,excluded:negative});}
  else if(negative&&/^экран[а-я]*$/.test(token)){if(!excluded.includes('phone'))excluded.push('phone');}
  else if(!componentConnectors.has(token)){onlyNames=false;if(!negative&&!unmatched.includes(token))unmatched.push(token);}
 }
 return {ids:ids.filter(id=>!excluded.includes(id)),excluded,mentions,onlyNames,unmatched};
}
