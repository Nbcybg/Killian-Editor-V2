import re, os, json
expmap=json.load(open('tools/expmap.json'))
for fn in os.listdir('src'):
    if fn in ('app.js','core.js') or not fn.endswith('.js'): continue
    p='src/'+fn; s=open(p,encoding='utf-8').read()
    m=re.search(r"import \{([^}]+)\} from '\./app\.js';", s)
    if not m: continue
    names=[x.strip() for x in m.group(1).split(',') if x.strip()]
    keep=[]; move={}
    for nm in names:
        tgt=expmap.get(nm)
        if tgt and tgt not in ('./app.js','./'+fn): move.setdefault(tgt,[]).append(nm)
        else: keep.append(nm)
    if not move: continue
    newimps=[]
    if keep: newimps.append("import { "+', '.join(keep)+" } from './app.js';")
    for tgt,nms in move.items(): newimps.append("import { "+', '.join(sorted(nms))+" } from '"+tgt+"';")
    s=s.replace(m.group(0), '\n'.join(newimps)); open(p,'w',encoding='utf-8').write(s)
    print(f'  redirect {fn}: {dict((k,sorted(v)) for k,v in move.items())}')
