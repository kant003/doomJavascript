"""Translate enums and struct declarations, retaining all upstream field names."""
from pathlib import Path
import runpy, re
root=Path(__file__).resolve().parent.parent
helpers=runpy.run_path(str(root/'scripts/generate-tables.py'))
declarations,write=helpers['declarations'],helpers['write']
source=root/'original/linuxdoom-1.10'
# These types have no C storage-size dependency: runtime pointers become nullable references.
mobj='''import type { thinker_t } from './d_think.h';
import type { subsector_t } from './r_defs.h';
import type { player_t } from './d_player.h';
import type { state_t, mobjinfo_t, mobjtype_t, spritenum_t } from './info.h';
import type { mapthing_t } from './doomdata.h';
export interface mobj_t {
    thinker: thinker_t; x: number; y: number; z: number;
    snext: mobj_t | null; sprev: mobj_t | null; angle: number; sprite: spritenum_t; frame: number;
    bnext: mobj_t | null; bprev: mobj_t | null; subsector: subsector_t | null;
    floorz: number; ceilingz: number; radius: number; height: number;
    momx: number; momy: number; momz: number; validcount: number;
    type: mobjtype_t; info: mobjinfo_t | null; tics: number; state: state_t | null;
    flags: number; health: number; movedir: number; movecount: number; target: mobj_t | null;
    reactiontime: number; threshold: number; player: player_t | null; lastlook: number;
    spawnpoint: mapthing_t; tracer: mobj_t | null;
}
'''
write('p_mobj.h.ts',declarations('p_mobj.h')+mobj,'p_mobj.h')
write('p_pspr.h.ts',declarations('p_pspr.h')+'''import type { state_t } from './info.h';
export interface pspdef_t { state: state_t | null; tics: number; sx: number; sy: number }
''','p_pspr.h')
write('d_player.h.ts',declarations('d_player.h')+'''import type { mobj_t } from './p_mobj.h';
import type { ticcmd_t } from './d_ticcmd.h';
import type { weapontype_t } from './doomdef.h';
import type { pspdef_t } from './p_pspr.h';
export interface player_t {
    mo: mobj_t | null; playerstate: playerstate_t; cmd: ticcmd_t;
    viewz: number; viewheight: number; deltaviewheight: number; bob: number;
    health: number; armorpoints: number; armortype: number;
    powers: Int32Array; cards: boolean[]; backpack: boolean; frags: Int32Array;
    readyweapon: weapontype_t; pendingweapon: weapontype_t; weaponowned: boolean[];
    ammo: Int32Array; maxammo: Int32Array; attackdown: number; usedown: number;
    cheats: number; refire: number; killcount: number; itemcount: number; secretcount: number;
    message: string | null; damagecount: number; bonuscount: number; attacker: mobj_t | null;
    extralight: number; fixedcolormap: number; colormap: number; psprites: pspdef_t[]; didsecret: boolean;
}
export interface wbplayerstruct_t { in: boolean; skills: number; sitems: number; ssecret: number; stime: number; frags: Int32Array; score: number }
export interface wbstartstruct_t { epsd: number; didsecret: boolean; last: number; next: number; maxkills: number; maxitems: number; maxsecret: number; maxfrags: number; partime: number; pnum: number; plyr: wbplayerstruct_t[] }
''','d_player.h')
info=declarations('info.h')+'''import type { actionf_t } from './d_think.h';
export interface state_t { sprite: spritenum_t; frame: number; tics: number; action: actionf_t; nextstate: statenum_t; misc1: number; misc2: number }
export interface mobjinfo_t {
'''
body=re.search(r'typedef struct\s*\{([^{}]+)\}\s*mobjinfo_t;', (source/'info.h').read_text(),re.S)[1]
info+='\n'.join('    '+name+': number;' for name in re.findall(r'int\s+(\w+)\s*;',body))+'\n}\n'
write('info.h.ts',info,'info.h')
