"""Extract exact paths; compute cubic Bezier extrema without third-party dependencies."""
from pathlib import Path
import xml.etree.ElementTree as E
import json, re, math, copy, hashlib
ROOT=Path(__file__).resolve().parents[1]
NS='{http://www.w3.org/2000/svg}'
E.register_namespace('',NS[1:-1])
def name(x):
    s=x.attrib.get('id','')
    try:return s.encode('latin1').decode('utf8')
    except (UnicodeError,ValueError):return s
def bounds(group):
    pts=[]
    def add(x,y):pts.append((float(x),float(y)))
    for e in group.iter():
        tag=e.tag.removeprefix(NS)
        if tag=='rect':
            x=float(e.get('x',0));y=float(e.get('y',0))
            if e.get('transform'):
                tx,ty=map(float,re.findall(r'[-+]?\d*\.?\d+',e.get('transform')));x+=tx;y+=ty
            add(x,y);add(x+float(e.get('width')),y+float(e.get('height')))
        if tag!='path':continue
        ts=re.findall(r'[MLCHVZ]|[-+]?(?:\d*\.\d+|\d+\.?\d*)(?:[eE][-+]?\d+)?',e.get('d',''))
        i=0;x=y=sx=sy=0;cmd=None
        while i<len(ts):
            if ts[i].isalpha():cmd=ts[i];i+=1
            if cmd=='Z':x,y=sx,sy;cmd=None;continue
            n={'M':2,'L':2,'C':6,'H':1,'V':1}[cmd]
            v=list(map(float,ts[i:i+n]));i+=n
            if cmd in ('M','L'):
                x,y=v;add(x,y)
                if cmd=='M':sx,sy=x,y;cmd='L'
            elif cmd=='H':x=v[0];add(x,y)
            elif cmd=='V':y=v[0];add(x,y)
            else:
                p0=(x,y);p1=v[:2];p2=v[2:4];p3=v[4:6]
                add(*p0);add(*p3)
                for axis in (0,1):
                    a=-p0[axis]+3*p1[axis]-3*p2[axis]+p3[axis]
                    b=2*(p0[axis]-2*p1[axis]+p2[axis]);c=p1[axis]-p0[axis]
                    roots=[]
                    if abs(a)<1e-10:
                        if abs(b)>1e-10:roots=[-c/b]
                    elif b*b-4*a*c>=0:
                        d=math.sqrt(b*b-4*a*c);roots=[(-b+d)/(2*a),(-b-d)/(2*a)]
                    for t in roots:
                        if 0<t<1:
                            q=[(1-t)**3*p0[k]+3*(1-t)**2*t*p1[k]+3*(1-t)*t*t*p2[k]+t**3*p3[k] for k in (0,1)]
                            add(*q)
                x,y=p3
    xs,ys=zip(*pts);pad=2
    return [min(xs)-pad,min(ys)-pad,max(xs)-min(xs)+2*pad,max(ys)-min(ys)+2*pad]
def asset(g,definitions=None,background=False):
    box=bounds(g);clone=copy.deepcopy(g)
    if background:
        base=list(g)[0]
        tx,ty=map(float,re.findall(r'[-+]?\d*\.?\d+',base.get('transform')))
        box=[tx,ty,float(base.get('width')),float(base.get('height'))]
    refs=set(re.findall(r'url\(#([^)]+)\)',E.tostring(clone,encoding='unicode')))
    if refs:
        wrapper=E.Element(NS+'g');defs=E.SubElement(wrapper,NS+'defs')
        for ref in sorted(refs):
            if not definitions or ref not in definitions:raise ValueError('Missing SVG definition: '+ref)
            defs.append(copy.deepcopy(definitions[ref]))
        wrapper.append(clone);clone=wrapper
    for e in clone.iter():
        if 'id' in e.attrib:e.set('id',name(e))
    return dict(x=box[0],y=box[1],width=box[2],height=box[3],body=E.tostring(clone,encoding='unicode').replace(' xmlns="http://www.w3.org/2000/svg"',''))
objects=[
 ('book','Книга',['книг','читать','чтени','учеб','учёб','учить','учиться','обуч','образован','знани','курс','экзамен','студент','развити']),
 ('phone','Телефон',['телефон','смартфон','связ','общени','приложен','цифров','технолог','онлайн','уведомлен']),
 ('puzzle','Пазлы',['пазл','команд','сотруднич','взаимодейств','решени','задач','собрать','вместе','логик','головолом']),
 ('coin','Монета',['монет','деньг','денег','финанс','бюджет','накоп','сбереж','инвест','доход','оплат','эконом']),
 ('headphones','Наушники',['наушник','музык','слуш','подкаст','аудио','фокус','концентр','отвлек','зву','отдых']),
 ('lamp','Лампа',['ламп','свет','иде','работ','рабоч','вечер','вдохнов','учиться','фокус','концентр','продуктив']),
 ('flowers','Цветы',['цвет','тюльпан','букет','подар','весн','забот','красот','праздник','уют','вдохнов']),
 ('wallet','Кошелёк',['кошел','деньг','денег','финанс','бюджет','накоп','сбереж','покуп','расход','эконом']),
 ('folder','Папка',['папк','документ','порядок','организац','работ','офис','проект','отчёт','отчет','карьер']),
 ('pen','Ручка',['ручк','писать','письм','запис','замет','план','творчеств','конспект','учеб','учёб','учиться'])]
catalog={'objects':[dict(id=i,name=n,tags=t,variants={}) for i,n,t in objects],'backgrounds':{},'palettes':[
 {'id':'lilac','name':'Сирень','background':['#D7CDF5','#AA9BF0','#7864D7'],'objects':['#F9ECB0','#F9A3AA','#FFE3E1','#181817','#FFFFFF']},
 {'id':'peach','name':'Персик','background':['#FDD7B9','#FAC896','#D27532'],'objects':['#F9ECB0','#80DADA','#BEEBEB','#181817','#FFFFFF']},
 {'id':'mint','name':'Мята','background':['#BEEBEB','#80DADA','#5ABEBE'],'objects':['#FFD4F2','#6D7BFC','#B6C6FE','#181817','#FFFFFF']}],
 'provenance':{'fileKey':'4MCFttsSoP7hgQh29zq5G3','exportDate':'2026-11-02','method':'Figma SVG export, Include id, all overlapping layers'}}
for size in ('S','L'):
    source=ROOT/'source'/f'library-{size}.svg'
    r=E.parse(source).getroot(); groups={name(g):g for g in list(r)[1] if g.tag==NS+'g'}
    definitions={e.get('id'):e for d in r if d.tag==NS+'defs' for e in d if e.get('id')}
    special={'L':{'flowers':('Group 2136136344','Group 2136136347')},'S':{'book':('Group 2136136335','Group 2136136341'),'flowers':('Group 2136136345','Group 2136136346'),'folder':('Group 2136136337','Group 2136136342'),'pen':('Group 2136136336','Group 2136136343')}}
    for obj in catalog['objects']:
        base=obj['name'].replace('ё','е');names=special[size].get(obj['id'],(base,base+'_2'))
        obj['variants'][size]={role:asset(groups[n],definitions) for role,n in zip(('main','background'),names)}
    catalog['backgrounds'][size]=[asset(groups[n],definitions,background=True) for n in ['Фон','Фон_3','Фон_2']]
    print(size,'objects',20,'sha256',hashlib.sha256(source.read_bytes()).hexdigest())
out=ROOT/'assets';out.mkdir(exist_ok=True)
(out/'catalog.json').write_text(json.dumps(catalog,ensure_ascii=False,separators=(',',':')),encoding='utf8')
print('catalog bytes',(out/'catalog.json').stat().st_size)
