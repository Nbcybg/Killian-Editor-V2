#!/bin/bash
cd /home/claude/work/v2_extract/Killian2
python3 tools/refactor.py "$1" || exit $?
regen(){ python3 - << 'PY'
import re,os,json
e={}
for fn in os.listdir('src'):
    if not fn.endswith('.js'): continue
    mod='./'+fn; s=open('src/'+fn,encoding='utf-8').read()
    for m in re.finditer(r'^export (?:async )?function (\w+)',s,re.M): e[m.group(1)]=mod
    for m in re.finditer(r'^export (?:const|let|class) (\w+)',s,re.M): e[m.group(1)]=mod
json.dump(e,open('tools/expmap.json','w'),ensure_ascii=False)
PY
}
regen; python3 tools/redirect.py; regen
node build.js 2>&1 | grep -E "bundle OK|ERROR" | head -6
