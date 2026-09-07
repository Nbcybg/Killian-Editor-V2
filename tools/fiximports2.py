import re, os, json
expmap=json.load(open('tools/expmap.json'))
SPOKES=['dashboard','recycle','books','dialogs','wiki-ui','scene-ops','section-ops','timeline-ui','maps-ui','scene-props']
GLOBALS=set('kapi document window console Math JSON Object Array Promise setTimeout setInterval clearInterval clearTimeout Set Map WeakMap WeakSet Date RegExp Number String Boolean Symbol parseInt parseFloat isNaN isFinite encodeURIComponent decodeURIComponent navigator location history fetch alert confirm prompt requestAnimationFrame cancelAnimationFrame CSS URL Blob File FileReader Intl structuredClone getComputedStyle Error TypeError performance crypto Node NodeList Element HTMLElement Event KeyboardEvent MouseEvent CustomEvent DataTransfer Image atob btoa TextSelection spell'.split())
def parse_imports(s):
    got={}
    for m in re.finditer(r"import \{([^}]+)\} from '([^']+)';", s):
        for nm in m.group(1).split(','):
            nm=nm.strip().split(' as ')[0].strip()
            if nm: got[nm]=m.group(2)
    for m in re.finditer(r"import \* as (\w+) from", s): got[m.group(1)]='*'
    return got
def defined_in(s):
    d=set()
    for m in re.finditer(r'^\s*(?:export )?(?:async )?function (\w+)', s, re.M): d.add(m.group(1))
    for m in re.finditer(r'\b(?:const|let|var) (\w+)', s): d.add(m.group(1))
    return d
for base in SPOKES:
    p='src/'+base+'.js'
    if not os.path.exists(p): continue
    s=open(p,encoding='utf-8').read(); self_mod='./'+base+'.js'
    got=parse_imports(s); defined=defined_in(s)
    used=set(re.findall(r'\b([A-Za-z_]\w*)\b', s))
    add={}
    for nm in used:
        if nm in got or nm in defined or nm in GLOBALS: continue
        tgt=expmap.get(nm)
        if tgt and tgt!=self_mod: add.setdefault(tgt,set()).add(nm)
    if not add: continue
    lines=s.split('\n'); last=max(i for i,l in enumerate(lines) if l.startswith('import '))
    lines[last+1:last+1]=["import { "+', '.join(sorted(add[m]))+" } from '"+m+"';" for m in sorted(add)]
    open(p,'w',encoding='utf-8').write('\n'.join(lines))
    print(f'{base}.js: +{dict((k,sorted(v)) for k,v in add.items())}')
