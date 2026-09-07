import re, json, sys, os

APP='src/app.js'
expmap=json.load(open('tools/expmap.json'))
GLOBALS=set('kapi document window console Math JSON Object Array Promise setTimeout setInterval clearInterval clearTimeout Set Map WeakMap WeakSet Date RegExp Number String Boolean Symbol parseInt parseFloat isNaN isFinite encodeURIComponent decodeURIComponent navigator location history fetch alert confirm prompt requestAnimationFrame cancelAnimationFrame CSS URL Blob File FileReader Intl structuredClone getComputedStyle Error TypeError performance crypto Node NodeList Element HTMLElement Event KeyboardEvent MouseEvent CustomEvent DataTransfer Image atob btoa TextSelection'.split())

def load_lines(): return open(APP,encoding='utf-8').read().split('\n')
def save_lines(ls): open(APP,'w',encoding='utf-8').write('\n'.join(ls))

def all_app_funcs(ls):
    s='\n'.join(ls); funcs={}
    for m in re.finditer(r'^(export )?(async )?function (\w+)', s, re.M):
        funcs[m.group(3)]=bool(m.group(1))
    return funcs

def all_app_vars(ls):
    # top-level const/let (module-scope) → {name: (kind, exported)}
    s='\n'.join(ls); v={}
    for m in re.finditer(r'^(export )?(const|let) (\w+)', s, re.M):
        v[m.group(3)]=(m.group(2), bool(m.group(1)))
    # หา var ที่ reassign (NAME = ... นอก declaration) — บ่งชี้ว่า export ข้ามไฟล์ไม่ได้
    reassigned=set()
    for name in v:
        for m in re.finditer(r'(?<![.\w])'+re.escape(name)+r'\s*=(?!=)', s):
            # ข้ามบรรทัด declaration
            reassigned.add(name)
    # ถือว่า reassign ถ้าปรากฏ `= ` มากกว่า 1 ครั้ง (decl + reassign) สำหรับ let
    real_reassign=set()
    for name in v:
        kind,_=v[name]
        n=len(re.findall(r'(?<![.\w])'+re.escape(name)+r'\s*=(?!=)', s))
        if kind=='let' and n>1: real_reassign.add(name)
    return v, real_reassign

def find_decl(ls, name):
    pat=re.compile(r'^(export )?(async )?function '+re.escape(name)+r'\b')
    for i,l in enumerate(ls):
        if pat.match(l): return i
    return -1

def block_end(ls, start):
    depth=0; started=False; i=start
    while i<len(ls):
        line=ls[i]
        # ข้าม brace ใน string/comment แบบหยาบ — พอใช้กับโค้ดนี้
        for ch in line:
            if ch=='{': depth+=1; started=True
            elif ch=='}': depth-=1
        i+=1
        if started and depth<=0: break
    return i  # exclusive

def scan_idents(text):
    used=set()
    if re.search(r'\$[\(\.\[]', text) or re.search(r'[^\w.]\$\b', text): used.add('$')
    for m in re.finditer(r'\b([A-Za-z_]\w*)\b', text):
        used.add(m.group(1))
    return used

def run(dest, names, header):
    ls=load_lines()
    appfuncs=all_app_funcs(ls)
    appvars, reassigned=all_app_vars(ls)
    # 1) หา + extract blocks (เรียงตาม index มากไปน้อยเพื่อ delete)
    ranges=[]
    for nm in names:
        i=find_decl(ls,nm)
        if i<0: print('!! ไม่พบ',nm); sys.exit(1)
        e=block_end(ls,i)
        ranges.append((i,e,nm))
    ranges.sort()
    block_texts=[]
    for (i,e,nm) in ranges:
        block_texts.append('\n'.join(ls[i:e]))
    body='\n\n'.join(block_texts)
    own=set(names)
    # 2) detect deps
    used=scan_idents(body)
    from_mod={}   # module -> set(names)
    need_export=set()
    need_export_var=[]
    for name in sorted(used):
        if name in own or name in GLOBALS: continue
        if name=='$':
            from_mod.setdefault('./core.js',set()).add('$'); continue
        if name in expmap and expmap[name]!=dest:
            src=expmap[name]
            if src=='./'+os.path.basename(dest): continue
            from_mod.setdefault(src,set()).add(name)
        elif name in appfuncs and name not in own:
            from_mod.setdefault('./app.js',set()).add(name)
            if not appfuncs[name]: need_export.add(name)
        elif name in appvars and name not in own:
            if name in reassigned:
                print('!! หยุด:',name,'เป็น let ที่ reassign ใน app.js — export ข้ามไฟล์ไม่ได้')
                print('   → ฟังก์ชันที่ใช้',name,'ควรคงไว้ใน app.js (อย่ายก) หรือแก้เป็น object property ก่อน')
                sys.exit(2)
            from_mod.setdefault('./app.js',set()).add(name)
            kind,exp=appvars[name]
            if not exp: need_export_var.append(name)
    # 3) ensure exports ใน app.js
    s='\n'.join(ls)
    for nm in need_export:
        s=re.sub(r'^((?:async )?function '+re.escape(nm)+r'\b)', r'export \1', s, count=1, flags=re.M)
    for nm in need_export_var:
        s=re.sub(r'^((?:const|let) '+re.escape(nm)+r'\b)', r'export \1', s, count=1, flags=re.M)
    ls=s.split('\n')
    # 4) เขียนไฟล์ใหม่
    imp=[]
    for mod in sorted(from_mod):
        nms=sorted(from_mod[mod])
        imp.append('import { '+', '.join(nms)+" } from '"+mod+"';")
    # export ทุก function ที่ยก (ให้ app.js import กลับได้)
    body_exp=body
    for nm in names:
        body_exp=re.sub(r'^((?:async )?function '+re.escape(nm)+r'\b)', r'export \1', body_exp, count=1, flags=re.M)
    open('src/'+os.path.basename(dest),'w',encoding='utf-8').write(header+'\n'+'\n'.join(imp)+'\n\n'+body_exp+'\n')
    # 5) ลบ blocks จาก app.js (มากไปน้อย) + เพิ่ม import
    ls=s.split('\n')
    for (i,e,nm) in sorted(ranges, reverse=True):
        del ls[i:e]
    # แทรก import dest หลัง import core.js
    modname='./'+os.path.basename(dest)
    for i,l in enumerate(ls):
        if "from './core.js';" in l and 'SCENE_STATUSES' in l:
            ls.insert(i+1, 'import { '+', '.join(names)+" } from '"+modname+"';")
            break
    save_lines(ls)
    print('✓ ยก',len(names),'ฟังก์ชัน →',dest)
    print('  imports:', {m:sorted(n) for m,n in from_mod.items()})
    print('  +export ใน app.js:', sorted(need_export))

if __name__=='__main__':
    cfg=json.load(open(sys.argv[1]))
    run(cfg['dest'], cfg['names'], cfg['header'])
