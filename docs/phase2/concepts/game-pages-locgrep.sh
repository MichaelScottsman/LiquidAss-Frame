#!/bin/bash
# read-only: look up localization strings (no writes)
F=/opt/steamvr/resources/webinterface/dashboard/localization/dashboard_english.json
ls -la "$F" 2>&1 | head -2
python3 - "$F" <<'EOF'
import json,sys,re
d=json.load(open(sys.argv[1]))
if isinstance(d,dict) and 'Tokens' in d: d=d['Tokens']
def walk(o,p=''):
    if isinstance(o,dict):
        for k,v in o.items(): yield from walk(v,k)
    elif isinstance(o,str): yield p,o
for k,v in walk(d):
    if re.search(r'binding',v,re.I) and len(v)<60: print('VR',k,'=',v)
EOF
echo ---- steam
for f in $(ls ~/.local/share/Steam/steamui/localization/ 2>/dev/null | grep -i english | head -5); do echo $f; done
S=$(ls -d ~/.local/share/Steam/steamui/localization 2>/dev/null)
grep -rhoE '"[A-Za-z0-9_]+"\s*:\s*"Steam Input"' $S 2>/dev/null | head -20
grep -rhoE '"[A-Za-z0-9_]+"\s*:\s*"(Controller|Bindings|VR Bindings)"' $S 2>/dev/null | head -20
