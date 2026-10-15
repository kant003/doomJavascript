import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as lights from '../src/linuxdoom-1.10/p_lights';
import { EV_DoFloor } from '../src/linuxdoom-1.10/p_floor';
import { floor_e } from '../src/linuxdoom-1.10/p_spec.h';
import { EV_Teleport } from '../src/linuxdoom-1.10/p_telept';
import { P_InitSectorContext,P_SpecialForThinker } from '../src/linuxdoom-1.10/p_spec';
import { type fireflicker_t,type lightflash_t,type strobe_t,type glow_t,FASTDARK,SLOWDARK } from '../src/linuxdoom-1.10/p_spec.h';
import { createCombatWorld } from './helpers/combat-world';
import { P_RunThinkers,P_RemoveThinker,thinkercap } from '../src/linuxdoom-1.10/p_tick';
import { P_SpawnMobj,P_MobjForThinker,P_MobjThinker } from '../src/linuxdoom-1.10/p_mobj';
import { mobjtype_t as MT } from '../src/linuxdoom-1.10/info.h';
import { mobjflag_t as MF,type mobj_t } from '../src/linuxdoom-1.10/p_mobj.h';
import { mapstate as m } from '../src/linuxdoom-1.10/r_state.h';
import { ML_TWOSIDED } from '../src/linuxdoom-1.10/doomdata.h';
import type { sector_t,line_t,degenmobj_t } from '../src/linuxdoom-1.10/r_defs.h';
import { FRACUNIT as F } from '../src/linuxdoom-1.10/m_fixed.h';
import { ONFLOORZ } from '../src/linuxdoom-1.10/p_local.h';
import { sfxenum_t as SFX } from '../src/linuxdoom-1.10/sounds.h';
import { prndindex,M_ClearRandom } from '../src/linuxdoom-1.10/m_random';
import { ANG90,ANGLETOFINESHIFT,finecosine,finesine } from '../src/linuxdoom-1.10/tables.h';
function init(){
 const f=createCombatWorld();M_ClearRandom();const root=m.sectors[0];root.tag=1;root.lightlevel=160;
 const sounds:{origin:mobj_t|degenmobj_t|null;sound:SFX}[]=[];
 P_InitSectorContext({S_StartSound:(origin,sound)=>sounds.push({origin,sound})});
 function neighbor(light:number,from=root):sector_t {
  const sec:sector_t={...root,thinglist:null,specialdata:null,tag:0,lines:[],linecount:0,blockbox:root.blockbox.slice(),soundorg:{...root.soundorg},lightlevel:light};
  m.sectors.push(sec);m.numsectors=m.sectors.length;
  const side=m.sides.length;m.sides.push({...m.sides[0],sector:from},{...m.sides[0],sector:sec});
  const line:line_t={...m.lines[0],sidenum:[side,side+1],frontsector:from,backsector:sec,flags:ML_TWOSIDED,tag:0,special:0};
  m.lines.push(line);from.lines.push(line);from.linecount=from.lines.length;sec.lines.push(line);sec.linecount=1;
  return sec;
 }
 return {...f,root,neighbor,sounds};
}
function run(n:number){for(let i=0;i<n;i++)P_RunThinkers();}
function effect<T extends {thinker:unknown}>():T {return P_SpecialForThinker(thinkercap.prev) as unknown as T;}
function actors():mobj_t[]{const all:mobj_t[]=[];for(let th=thinkercap.next;th&&th!==thinkercap;th=th.next)if(th.function===P_MobjThinker)all.push(P_MobjForThinker(th)!);return all;}
test('Every lighting definition in C is exported with its original name',()=>{
 const c=readFileSync('original/linuxdoom-1.10/p_lights.c','utf8');
 const names=[...c.matchAll(/^(?:(?:void)[ \t]+)?((?:T|EV|P)_\w+)\s*\([^;{}]*\)\s*\{/gm)].map(r=>r[1]);
 assert.equal(names.length,11);for(const name of names)assert.equal(typeof (lights as Record<string,unknown>)[name],'function',name);
});
test('Fire flicker uses four tics per random draw and compares against the current light',()=>{
 const {root,neighbor}=init();neighbor(80);root.special=17;lights.P_SpawnFireFlicker(root);
 const fx=effect<fireflicker_t>();assert.equal(root.special,0);assert.equal(root.specialdata,null);assert.strictEqual(fx.thinker.function,lights.T_FireFlicker);
 run(3);assert.equal(prndindex,0);assert.equal(root.lightlevel,160);run(1);assert.equal(prndindex,1);assert.equal(fx.count,4);
 root.lightlevel=100;run(4);assert.equal(root.lightlevel,96); // random 109 gives amount=16; comparison uses 100, not maxlight 160
});
test('Broken lights preserve the bit mask durations and deterministic RNG',()=>{
 const {root,neighbor}=init();neighbor(80);lights.P_SpawnLightFlash(root);const fx=effect<lightflash_t>();
 assert.equal(fx.count,1);assert.equal(prndindex,1);run(1);assert.equal(root.lightlevel,80);assert.equal(fx.count,6);assert.equal(prndindex,2);
 run(6);assert.equal(root.lightlevel,160);assert.equal(fx.count,65);assert.equal(prndindex,3);run(64);assert.equal(root.lightlevel,160);run(1);assert.equal(root.lightlevel,80);
});
test('Synchronized strobes preserve dark and bright durations without consuming RNG',()=>{
 for(const dark of [FASTDARK,SLOWDARK]){
  const {root,neighbor}=init();neighbor(80);lights.P_SpawnStrobeFlash(root,dark,1);const fx=effect<strobe_t>();
  assert.equal(prndindex,0);run(1);assert.equal(root.lightlevel,80);assert.equal(fx.count,dark);run(dark-1);assert.equal(root.lightlevel,80);run(1);assert.equal(root.lightlevel,160);
  run(5);assert.equal(root.lightlevel,80);
 }
});
test('Unsynchronized isolated strobe goes dark to zero and draws one random value at spawn',()=>{
 const {root}=init();root.special=3;lights.P_SpawnStrobeFlash(root,SLOWDARK,0);const fx=effect<strobe_t>();assert.equal(prndindex,1);assert.equal(fx.count,1);assert.equal(fx.minlight,0);assert.equal(root.special,0);run(1);assert.equal(root.lightlevel,0);
});
test('Glowing light reverses before either bound and does not claim sector.specialdata',()=>{
 const {root,neighbor}=init();neighbor(128);root.special=8;lights.P_SpawnGlowingLight(root);const fx=effect<glow_t>();
 run(3);assert.equal(root.lightlevel,136);run(1);assert.equal(root.lightlevel,136);assert.equal(fx.direction,1);run(2);assert.equal(root.lightlevel,152);run(1);assert.equal(root.lightlevel,152);assert.equal(fx.direction,-1);assert.equal(root.specialdata,null);assert.equal(root.special,0);
});
test('Tag lighting changes exclude other tags and preserve the reused bright value across sectors',()=>{
 const {root,neighbor}=init(),low=neighbor(80),other=neighbor(240,low);other.tag=1;
 lights.EV_LightTurnOn({tag:1},0);assert.equal(root.lightlevel,80);assert.equal(other.lightlevel,80);assert.equal(low.lightlevel,80);
 lights.EV_LightTurnOn({tag:1},255);assert.equal(root.lightlevel,255);assert.equal(other.lightlevel,255);
 lights.EV_TurnTagLightsOff({tag:1});assert.equal(root.lightlevel,80);assert.equal(other.lightlevel,80);
});
test('Triggered strobes skip sectors with movers and can coexist with a subsequently added mover',()=>{
 const {root,neighbor}=init(),other=neighbor(80);other.tag=1;other.specialdata={};
 lights.EV_StartLightStrobing({tag:1});const fx=effect<strobe_t>();assert.strictEqual(fx.sector,root);assert.equal(fx.darktime,SLOWDARK);assert.equal(root.specialdata,null);assert.notEqual(other.specialdata,null);
 root.specialdata={};run(1);assert.equal(root.lightlevel,80);
});
test('Teleporter rejects missiles, the back side and tags without an active destination',()=>{
 const {a}=init();const dest=P_SpawnMobj(100*F,0,ONFLOORZ,MT.MT_TELEPORTMAN);
 a.flags|=MF.MF_MISSILE;assert.equal(EV_Teleport({tag:1},0,a),0);a.flags&=~MF.MF_MISSILE;
 assert.equal(EV_Teleport({tag:1},1,a),0);assert.equal(EV_Teleport({tag:99},0,a),0);
 P_RemoveThinker(dest.thinker);assert.equal(EV_Teleport({tag:1},0,a),0);assert.equal(a.x,0);
});
test('Player teleport relinks position, sets view/angle, clears momentum and creates two real fog actors with sounds',()=>{
 const {a,p,root,sounds}=init();const dest=P_SpawnMobj(64*F,0,ONFLOORZ,MT.MT_TELEPORTMAN);dest.angle=ANG90;
 a.z=8*F;a.momx=F;a.momy=2*F;a.momz=3*F;root.floorheight=16*F;
 assert.equal(EV_Teleport({tag:1},0,a),1);assert.equal(a.x,dest.x);assert.equal(a.y,dest.y);assert.equal(a.z,16*F);assert.equal(a.angle,ANG90);assert.equal(p.viewz,16*F+p.viewheight);assert.equal(a.reactiontime,18);assert.deepEqual([a.momx,a.momy,a.momz],[0,0,0]);
 const fog=actors().filter(a=>a.type===MT.MT_TFOG);assert.equal(fog.length,2);assert.deepEqual([fog[0].x,fog[0].y,fog[0].z],[0,0,8*F]);const an=ANG90>>>ANGLETOFINESHIFT;
 assert.deepEqual([fog[1].x,fog[1].y,fog[1].z],[dest.x+20*finecosine[an],dest.y+20*finesine[an],16*F]);assert.deepEqual(sounds.map(s=>s.sound),[SFX.sfx_telept,SFX.sfx_telept]);assert.strictEqual(sounds[0].origin,fog[0]);assert.strictEqual(sounds[1].origin,fog[1]);
 assert.ok(actors().includes(a));
});
test('Player teleport telefrags an occupant through the real damage and death routines',()=>{
 const {a}=init();P_SpawnMobj(64*F,0,ONFLOORZ,MT.MT_TELEPORTMAN);const victim=P_SpawnMobj(64*F,0,ONFLOORZ,MT.MT_TROOP);
 assert.equal(EV_Teleport({tag:1},0,a),1);assert.ok(victim.health<=0);assert.ok(victim.flags&MF.MF_CORPSE);
});
test('Blocked monster teleport returns immediately instead of trying a second marker',()=>{
 const {a,sounds}=init();P_SpawnMobj(0,0,ONFLOORZ,MT.MT_TELEPORTMAN);P_SpawnMobj(96*F,0,ONFLOORZ,MT.MT_TELEPORTMAN);
 const monster=P_SpawnMobj(-64*F,0,ONFLOORZ,MT.MT_TROOP);monster.reactiontime=7;
 assert.equal(EV_Teleport({tag:1},0,monster),0);assert.equal(monster.x,-64*F);assert.equal(a.health,100);assert.equal(sounds.length,0);
 // Once the first marker is removed the next marker is used, without the player's reaction delay.
 const first=actors().find(a=>a.type===MT.MT_TELEPORTMAN)!;P_RemoveThinker(first.thinker);
 assert.equal(EV_Teleport({tag:1},0,monster),1);assert.equal(monster.x,96*F);assert.equal(monster.reactiontime,7);
});

test('Lighting and a moving floor run together on the shared thinker list',()=>{
 const {root,neighbor,a}=init();const other=neighbor(80);other.floorheight=32*F;
 lights.P_SpawnGlowingLight(root);assert.equal(EV_DoFloor({tag:1},floor_e.raiseFloorToNearest),1);
 run(33);assert.equal(root.floorheight,32*F);assert.equal(a.z,32*F);assert.equal(root.specialdata,null);assert.ok(root.lightlevel>=80&&root.lightlevel<=160);
 const before=root.lightlevel;run(1);assert.notEqual(root.lightlevel,before);
});
test('Mixed lighting repeats exactly over 200 native thinker tics',()=>{
 function simulate(){
  const {root,neighbor}=init();const dark=neighbor(64),flash=neighbor(192),glow=neighbor(128);neighbor(80,flash);
  lights.P_SpawnFireFlicker(root);lights.P_SpawnStrobeFlash(dark,FASTDARK,0);lights.P_SpawnLightFlash(flash);lights.P_SpawnGlowingLight(glow);
  const history:number[][]=[];for(let i=0;i<200;i++){run(1);history.push([root.lightlevel,dark.lightlevel,flash.lightlevel,glow.lightlevel,prndindex]);}
  assert.ok(new Set(history.map(h=>h.join(','))).size>50);return history;
 }
 assert.deepEqual(simulate(),simulate());
});
