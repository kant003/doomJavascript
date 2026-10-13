from pathlib import Path
import re
root=Path(__file__).resolve().parent.parent
text=(root/'original/linuxdoom-1.10/d_items.c').read_text()
text=re.sub(r'//[^\n]*','',text)
body=re.search(r'weaponinfo\[NUMWEAPONS\]\s*=\s*\{(.*?)\};',text,re.S)[1]
fields=['ammo','upstate','downstate','readystate','atkstate','flashstate']
code='// Copyright (C) 1993-1996 id Software, Inc. GPL-2.0-only.\n// Literal conversion of d_items.c.\nimport { ammotype_t } from "./doomdef.h";\nimport { statenum_t } from "./info.h";\nimport type { weaponinfo_t } from "./d_items.h";\nexport const weaponinfo: weaponinfo_t[] = [\n'
for entry in re.findall(r'\{([^{}]+)\}',body):
    values=[v.strip() for v in entry.split(',') if v.strip()]
    assert len(values)==6
    code+='    { '+', '.join(f'{k}: '+('ammotype_t.' if k=='ammo' else 'statenum_t.')+v for k,v in zip(fields,values))+' },\n'
code+='];\n'
(root/'src/linuxdoom-1.10/d_items.ts').write_text(code)
