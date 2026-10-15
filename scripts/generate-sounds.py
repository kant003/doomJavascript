"""Copy the original sound and music descriptor tables, preserving the linked descriptor."""
from pathlib import Path
import re
root=Path(__file__).resolve().parent.parent
s=(root/'original/linuxdoom-1.10/sounds.c').read_text()
music=re.findall(r'\{ "([^"]+)", 0 \}',s.split('sfxinfo_t S_sfx')[0])
rows=re.findall(r'\{ "(\w+)",\s*(false|true),\s*(\d+),\s*(0|&S_sfx\[sfx_pistol\]),\s*(-?\d+),\s*(-?\d+),\s*0 \}',s.split('sfxinfo_t S_sfx')[1])
assert len(rows)==109 and len(music)==67,(len(rows),len(music))
out='''// Copyright (C) 1993-1996 id Software, Inc. GPL-2.0-only.
// Literal tables from sounds.c. Omitted C initializer fields retain their zero values.
import { sfxenum_t as SFX,type sfxinfo_t,type musicinfo_t } from './sounds.h';
export const S_music:musicinfo_t[]=[null,'''+','.join(repr(n) for n in music)+'''].map(name=>({name,lumpnum:0,data:null,handle:0}));
export const S_sfx:sfxinfo_t[]=[
'''
for name,sing,priority,link,pitch,vol in rows:
 out+=f"    {{name:'{name}',singularity:{sing},priority:{priority},link:null,pitch:{pitch},volume:{vol},data:null,usefulness:0,lumpnum:0}},\n"
out+='];\nS_sfx[SFX.sfx_chgun].link=S_sfx[SFX.sfx_pistol];\n'
(root/'src/linuxdoom-1.10/sounds.ts').write_text(out)
