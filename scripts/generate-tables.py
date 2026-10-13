"""Copy literal upstream lookup tables and declarative headers; never approximate with Math.sin."""
from pathlib import Path
import re
base = Path(__file__).resolve().parent.parent
source = base / 'original/linuxdoom-1.10'
target = base / 'src/linuxdoom-1.10'
def header(name):
    text = (source / name).read_text()
    return text[:text.find('static const char')] if 'static const char' in text else text[:text.find('#ifndef')]
def write(name, code, origin):
    (target / name).write_text(header(origin) + '// TypeScript conversion. See PORTING.md for platform adaptations.\n' + code)
def clean(text):
    return re.sub(r'//[^\n]*|/\*.*?\*/', '', text, flags=re.S)
def declarations(name):
    text = clean((source / name).read_text())
    # Constants and enums occur interleaved; retain order so expressions can use earlier constants.
    items = []
    for m in re.finditer(r'^\s*#define\s+(\w+)\s+([^\n]+)', text, re.M):
        value = m[2].strip()
        if re.fullmatch(r'[\w\s()+*\-/|<>&.x]+', value):
            items.append((m.start(), f'export const {m[1]} = {value};\n'))
    for m in re.finditer(r'(typedef\s+)?enum\s*\{(.*?)\}\s*(\w+)?\s*;', text, re.S):
        if m[3]:
            items.append((m.start(), f'export enum {m[3]} {{ {m[2]} }}\n'))
        else:
            previous = None
            entries=[]
            for member in m[2].split(','):
                member=member.strip()
                if not member: continue
                if '=' in member:
                    key, value = member.split('=', 1)
                    key, value = key.strip(), value.strip()
                else:
                    key, value = member, ('0' if previous is None else previous+' + 1')
                entries.append(f'export const {key} = {value};\n')
                previous=key
            items.append((m.start(), ''.join(entries)))
    return ''.join(code for _,code in sorted(items))
write('doomdef.h.ts', declarations('doomdef.h'), 'doomdef.h')
write('doomdata.h.ts', declarations('doomdata.h') + '''
export interface mapvertex_t { x: number; y: number }
export interface mapsidedef_t { textureoffset: number; rowoffset: number; toptexture: string; bottomtexture: string; midtexture: string; sector: number }
export interface maplinedef_t { v1: number; v2: number; flags: number; special: number; tag: number; sidenum: [number, number] }
export interface mapsector_t { floorheight: number; ceilingheight: number; floorpic: string; ceilingpic: string; lightlevel: number; special: number; tag: number }
export interface mapsubsector_t { numsegs: number; firstseg: number }
export interface mapseg_t { v1: number; v2: number; angle: number; linedef: number; side: number; offset: number }
export interface mapnode_t { x: number; y: number; dx: number; dy: number; bbox: [number[], number[]]; children: [number, number] }
export interface mapthing_t { x: number; y: number; angle: number; type: number; options: number }
''', 'doomdata.h')
write('d_event.h.ts', declarations('d_event.h') + '''
export interface event_t { type: evtype_t; data1: number; data2: number; data3: number }
''', 'd_event.h')
text=(source/'tables.c').read_text()
code='import { SLOPERANGE } from "./tables.h";\n'
for name,kind in [('finetangent','Int32Array'),('finesine','Int32Array'),('tantoangle','Uint32Array')]:
    data=re.search(r'\b'+name+r'\[[^\]\n]+\]\s*=\s*\{(.*?)\};',text,re.S)[1]
    code+=f'export const {name} = new {kind}([{data}]);\n'
code+='''export const finecosine = finesine.subarray(8192 / 4);
export function SlopeDiv(num: number, den: number): number {
    num >>>= 0; den >>>= 0;
    if (den < 512) return SLOPERANGE;
    const ans = Math.floor(((num << 3) >>> 0) / (den >>> 8));
    return ans <= SLOPERANGE ? ans : SLOPERANGE;
}
'''
write('tables.ts', code, 'tables.c')
write('tables.h.ts', 'import { FRACBITS } from "./m_fixed.h";\n'+declarations('tables.h')+'export type angle_t = number;\nexport { finesine, finecosine, finetangent, tantoangle, SlopeDiv } from "./tables";\n', 'tables.h')
data=re.search(r'rndtable\[256\]\s*=\s*\{(.*?)\};',(source/'m_random.c').read_text(),re.S)[1]
write('m_random.ts', f'''export const rndtable = new Uint8Array([{data}]);
export let rndindex = 0;
export let prndindex = 0;
export function P_Random(): number {{ prndindex = (prndindex + 1) & 0xff; return rndtable[prndindex]; }}
export function M_Random(): number {{ rndindex = (rndindex + 1) & 0xff; return rndtable[rndindex]; }}
export function M_ClearRandom(): void {{ rndindex = prndindex = 0; }}
''', 'm_random.c')
gamma=re.search(r'gammatable\[5\]\[256\]\s*=\s*\{(.*?)\};',(source/'v_video.c').read_text(),re.S)[1]
rows=re.findall(r'\{([^{}]+)\}',gamma)
(target/'v_gamma.ts').write_text(header('v_video.c')+'// Literal tables extracted from v_video.c by scripts/generate-tables.py.\nexport const gammatable = [\n'+',\n'.join('new Uint8Array(['+r+'])' for r in rows)+'\n];\n')
