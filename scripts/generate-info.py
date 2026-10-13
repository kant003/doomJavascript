"""Copy the literal actor/state tables. Symbolic actions are linked explicitly, never stubbed."""
from pathlib import Path
import re,runpy
root=Path(__file__).resolve().parent.parent
h=runpy.run_path(str(root/'scripts/generate-tables.py'))
source=root/'original/linuxdoom-1.10'
h['write']('sounds.h.ts',h['declarations']('sounds.h'),'sounds.h')
raw=(source/'info.c').read_text()
text=re.sub(r'//[^\n]*|/\*.*?\*/','',raw,flags=re.S)
def body(name):return re.search(r'\b'+name+r'\[[^\]\n]+\]\s*=\s*\{(.*?)\};',text,re.S)[1]
def expr(v):
    v=v.strip()
    for prefix,obj in [('SPR_','spritenum_t'),('S_','statenum_t'),('sfx_','sfxenum_t'),('MF_','mobjflag_t')]:
        v=re.sub(r'\b'+prefix+r'\w+\b',lambda m:obj+'.'+m[0],v)
    assert re.fullmatch(r'[\w.*+\-|() \t\n]+',v),v
    return v
names=re.findall(r'"([A-Z0-9]{4})"',body('sprnames'))
statebody=re.sub(r'\{(A_\w+|NULL)\}',r'\1',body('states'))
rows=re.findall(r'\{([^{}]+)\}',statebody)
actors=re.findall(r'\{([^{}]+)\}',body('mobjinfo'))
fields=re.findall(r'int\s+(\w+)\s*;',re.search(r'typedef struct\s*\{([^{}]+)\}\s*mobjinfo_t;',(source/'info.h').read_text(),re.S)[1])
actions=sorted(set(re.findall(r'\bA_\w+\b',statebody)))
code='''import { spritenum_t, statenum_t } from './info.h';
import type { state_t, mobjinfo_t } from './info.h';
import type { actionf_p1 } from './d_think.h';
import { sfxenum_t } from './sounds.h';
import { mobjflag_t } from './p_mobj.h';
import { FRACUNIT } from './m_fixed.h';
'''
code+='export const sprnames = '+repr(names).replace("'",'"')+';\n'
symbols=[None if row.split(',')[3].strip()=='NULL' else row.split(',')[3].strip() for row in rows]
code+='export const stateActionSymbols: (string | null)[] = '+repr(symbols).replace("'",'"').replace('None','null')+';\n'
code+='export const stateActionNames = '+repr(actions).replace("'",'"')+' as const;\n'
code+='''const bindings = new Map<string, actionf_p1>();
const pointers = new Map<string, actionf_p1>();
function actionFor(name: string): actionf_p1 {
    let pointer = pointers.get(name);
    if (!pointer) {
        pointer = (argument: unknown): void => {
            const action = bindings.get(name);
            if (!action) throw new Error(`State action is not linked: ${name}`);
            action(argument);
        };
        pointers.set(name,pointer);
    }
    return pointer;
}
// Linking incomplete actions is permitted only explicitly. Execution always fails for a missing symbol.
export function I_LinkStateActions(actions: Readonly<Record<string,actionf_p1>>, requireComplete = true): void {
    const known = new Set<string>(stateActionNames);
    for (const name of Object.keys(actions)) if (!known.has(name)) throw new Error(`Unknown state action: ${name}`);
    if (requireComplete) for (const name of stateActionNames) if (!actions[name]) throw new Error(`Missing state action: ${name}`);
    bindings.clear(); for (const [name,action] of Object.entries(actions)) bindings.set(name,action);
    states.forEach((state,i) => { const name = stateActionSymbols[i]; state.action = name ? bindings.get(name) ?? actionFor(name) : null; });
}
'''
code+='export const states: state_t[] = [\n'
for row in rows:
    values=[v.strip() for v in row.split(',')];assert len(values)==7,values
    action='null' if values[3]=='NULL' else 'actionFor("'+values[3]+'")'
    code+='    { '+', '.join(k+': '+v for k,v in zip(['sprite','frame','tics','action','nextstate','misc1','misc2'],[expr(values[0]),expr(values[1]),expr(values[2]),action,expr(values[4]),expr(values[5]),expr(values[6])]))+' },\n'
code+='];\nexport const mobjinfo: mobjinfo_t[] = [\n'
for row in actors:
    values=[v.strip() for v in row.split(',') if v.strip()];assert len(values)==len(fields),(len(values),len(fields))
    code+='    { '+', '.join(k+': '+expr(v) for k,v in zip(fields,values))+' },\n'
code+='];\n'
h['write']('info.ts',code,'info.c')
print(f'{len(names)} sprite names, {len(rows)} states, {len(actors)} actors, {len(actions)} action symbols')
