import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createMobjWorld } from './helpers/mobj-world';
import { P_SpawnMobj } from '../src/linuxdoom-1.10/p_mobj';
import { P_NoiseAlert } from '../src/linuxdoom-1.10/p_enemy';
import { mapstate as m } from '../src/linuxdoom-1.10/r_state.h';
import { mobjtype_t as MT } from '../src/linuxdoom-1.10/info.h';
import { ONFLOORZ } from '../src/linuxdoom-1.10/p_local.h';
import { ML_TWOSIDED, ML_SOUNDBLOCK } from '../src/linuxdoom-1.10/doomdata.h';
import type { sector_t } from '../src/linuxdoom-1.10/r_defs.h';

function graph() {
    createMobjWorld();const actor=P_SpawnMobj(0,0,ONFLOORZ,MT.MT_PLAYER),root=m.sectors[0],base=m.lines[0],side=m.sides[0];
    function sector():sector_t{return {...root,lines:[],linecount:0,soundtarget:null,soundtraversed:0,validcount:-1};}
    const a=sector(),b=sector(),c=sector(),d=sector(),e=sector(),f=sector();actor.subsector={sector:a,firstline:0,numlines:0};
    function connect(front:sector_t,back:sector_t,blocked=false){
        const index=m.sides.length;m.sides.push({...side,sector:front},{...side,sector:back});
        const line={...base,frontsector:front,backsector:back,sidenum:[index,index+1] as [number,number],flags:ML_TWOSIDED|(blocked?ML_SOUNDBLOCK:0)};
        front.lines.push(line);back.lines.push(line);front.linecount=front.lines.length;back.linecount=back.lines.length;
    }
    return {actor,a,b,c,d,e,f,connect};
}
test('Noise propagation crosses one sound blocker, stops at a second and respects closed portals',()=>{
    const {actor,a,b,c,d,e,connect}=graph();connect(a,b,true);connect(b,c,true);connect(b,d);e.floorheight=e.ceilingheight;connect(a,e);
    P_NoiseAlert(actor,actor);assert.strictEqual(a.soundtarget,actor);assert.strictEqual(b.soundtarget,actor);assert.strictEqual(d.soundtarget,actor);
    assert.equal(a.soundtraversed,1);assert.equal(b.soundtraversed,2);assert.equal(c.soundtarget,null);assert.equal(e.soundtarget,null);
    // Open the previously shut portal, then flood again using a new validcount.
    e.floorheight=0;P_NoiseAlert(actor,actor);assert.strictEqual(e.soundtarget,actor);assert.equal(e.soundtraversed,1);
});
test('A later unblocked route revisits sectors with fewer blockers and opens additional reachable sectors',()=>{
    const {actor,a,b,c,d,f,connect}=graph();connect(a,b,true);connect(b,c,true);connect(c,d,true);connect(a,f);connect(f,b);
    P_NoiseAlert(actor,actor);assert.equal(b.soundtraversed,1);assert.strictEqual(c.soundtarget,actor);assert.equal(c.soundtraversed,2);assert.equal(d.soundtarget,null);
});
