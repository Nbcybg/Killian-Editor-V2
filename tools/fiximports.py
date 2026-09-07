import re, os, json
expmap=json.load(open('tools/expmap.json'))
GLOBALS=set('kapi document window console Math JSON Object Array Promise setTimeout setInterval clearInterval clearTimeout Set Map WeakMap WeakSet Date RegExp Number String Boolean Symbol parseInt parseFloat isNaN isFinite encodeURIComponent decodeURIComponent navigator location history fetch alert confirm prompt requestAnimationFrame cancelAnimationFrame CSS URL Blob File FileReader Intl structuredClone getComputedStyle Error TypeError performance crypto Node NodeList Element HTMLElement Event KeyboardEvent MouseEvent CustomEvent DataTransfer Image atob btoa TextSelection spell'.split())

def parse_imports(s):
    got={}  # name -> mod (ที่ import แล้ว)
    for m in re.finditer(r"import \{([^}]+)\} from '([^']+)';", s):
        for nm in m.group(1).split(','):
            nm=nm.strip().split(' as ')[0].strip()
            if nm: got[nm]=m.group(2)
    for m in re.finditer(r"import \* as (\w+) from '([^']+)';", s):
        got[m.group(1)]=m.group(2)
    return got

def defined_in(s):
    d=set()
    for m in re.finditer(r'^\s*(?:export )?(?:async )?function (\w+)', s, re.M): d.add(m.group(1))
    for m in re.finditer(r'\b(?:const|let|var) (\w+)', s): d.add(m.group(1))
    for m in re.finditer(r'function\s*\w*\s*\(([^)]*)\)', s):  # params
        for p in m.group(1).split(','):
            p=p.strip().split('=')[0].strip().lstrip('.').strip()
            if re.match(r'^\w+$',p): d.add(p)
    return d

changed=0
for fn in os.listdir('src'):
    if fn in ('app.js','core.js') or not fn.endswith('.js'): continue
    p='src/'+fn; s=open(p,encoding='utf-8').read()
    self_mod='./'+fn
    got=parse_imports(s); defined=defined_in(s)
    # idents ที่ใช้
    used=set(re.findall(r'\b([A-Za-z_]\w*)\b', s))
    if re.search(r'\$[\(\.\[]', s): used.add('$')
    add={}  # mod -> set(names)
    for nm in used:
        if nm in got or nm in defined or nm in GLOBALS: continue
        tgt=expmap.get(nm)
        if tgt and tgt!=self_mod:
            add.setdefault(tgt,set()).add(nm)
    if not add: continue
    # เติม import: รวมกับ import เดิมของ mod เดียวกันถ้ามี
    lines=s.split('\n')
    # หาตำแหน่งท้าย import block
    last=0
    for i,l in enumerate(lines):
        if l.startswith('import '): last=i
    newimps=[]
    for mod in sorted(add):
        newimps.append("import { "+', '.join(sorted(add[mod]))+" } from '"+mod+"';")
    lines[last+1:last+1]=newimps
    open(p,'w',encoding='utf-8').write('\n'.join(lines))
    print(f'{fn}: +import {dict((k,sorted(v)) for k,v in add.items())}')
    changed+=1
print('แก้',changed,'ไฟล์')
