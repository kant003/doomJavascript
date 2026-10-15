import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as floors from '../src/linuxdoom-1.10/p_floor';
import * as ceilings from '../src/linuxdoom-1.10/p_ceilng';
import * as doors from '../src/linuxdoom-1.10/p_doors';
import * as plats from '../src/linuxdoom-1.10/p_plats';
import { createCombatWorld } from './helpers/combat-world';
import { P_InitSectorContext,P_FindLowestFloorSurrounding,P_FindHighestFloorSurrounding,P_FindNextHighestFloor,P_FindLowestCeilingSurrounding,
 P_FindHighestCeilingSurrounding,P_FindMinSurroundingLight,P_FindSectorFromLineTag,getSide,getSector,twoSided,getNextSector } from '../src/linuxdoom-1.10/p_spec';
import { floor_e as FT,ceiling_e as CT,vldoor_e as DT,plattype_e as PT,plat_e as PS,stair_e as ST,result_e as RES,
 type floormove_t,type ceiling_t,type vldoor_t,type plat_t } from '../src/linuxdoom-1.10/p_spec.h';
import { P_RunThinkers,P_Ticker,thinkercap } from '../src/linuxdoom-1.10/p_tick';
import { P_InitEnemyContext,A_BossDeath,enemyStateActions } from '../src/linuxdoom-1.10/p_enemy';
import { weaponStateActions } from '../src/linuxdoom-1.10/p_pspr';
import { P_SpawnMobj } from '../src/linuxdoom-1.10/p_mobj';
import { I_LinkStateActions } from '../src/linuxdoom-1.10/info';
import { mobjtype_t as MT } from '../src/linuxdoom-1.10/info.h';
import { skill_t,GameMode_t,card_t as CARD } from '../src/linuxdoom-1.10/doomdef.h';
import { ONFLOORZ } from '../src/linuxdoom-1.10/p_local.h';
import { mapstate as m } from '../src/linuxdoom-1.10/r_state.h';
import { ML_TWOSIDED } from '../src/linuxdoom-1.10/doomdata.h';
import type { sector_t,line_t,degenmobj_t } from '../src/linuxdoom-1.10/r_defs.h';
import type { mobj_t } from '../src/linuxdoom-1.10/p_mobj.h';
import { FRACUNIT as F } from '../src/linuxdoom-1.10/m_fixed.h';
import { sfxenum_t as SFX } from '../src/linuxdoom-1.10/sounds.h';
import * as TEXT from '../src/linuxdoom-1.10/d_englsh.h';
function init(){
 const f=createCombatWorld();ceilings.activeceilings.fill(null);plats.activeplats.fill(null);
 const sounds:{origin:mobj_t|degenmobj_t|null;sound:SFX}[]=[];P_InitSectorContext({S_StartSound:(origin,sound)=>sounds.push({origin,sound})});
 const root=m.sectors[0];root.tag=1;
 function neighbor(floor:number,ceil=192*F,from=root):sector_t {
  const sec:sector_t={...root,floorheight:floor,ceilingheight:ceil,thinglist:null,specialdata:null,tag:0,lines:[],linecount:0,blockbox:root.blockbox.slice(),soundorg:{...root.soundorg}};
  m.sectors.push(sec);m.numsectors=m.sectors.length;const side=m.sides.length;m.sides.push({...m.sides[0],sector:from},{...m.sides[0],sector:sec});
  const line:line_t={...m.lines[0],sidenum:[side,side+1],frontsector:from,backsector:sec,flags:ML_TWOSIDED,tag:0,special:0};m.lines.push(line);from.lines.push(line);from.linecount=from.lines.length;sec.lines.push(line);sec.linecount=1;return sec;
 }
 return {...f,root,neighbor,sounds};
}
function run(n:number){for(let i=0;i<n;i++)P_RunThinkers();}
function doorEffect(sec:sector_t):vldoor_t {const effect=sec.specialdata as vldoor_t|null;assert.ok(effect);return effect;}
test('All active floor, ceiling, platform and door definitions are exported; abandoned sliding code stays excluded',()=>{
 for(const [file,module,count] of [['p_floor.c',floors,4],['p_ceilng.c',ceilings,6],['p_plats.c',plats,6],['p_doors.c',doors,6]] as const){
  let source=readFileSync(`original/linuxdoom-1.10/${file}`,'utf8');if(file==='p_doors.c')source=source.split('// UNUSED\n// Separate into p_slidoor.c?')[0];
  const names=[...source.matchAll(/^(?:(?:void|int|result_e)[ \t]+)?((?:T|EV|P)_\w+)\s*\([^;{}]*\)\s*\{/gm)].map(r=>r[1]);assert.equal(names.length,count,file);
  for(const name of names)assert.equal(typeof (module as Record<string,unknown>)[name],'function',name);
 }
});
test('Sector queries preserve adjacency, tag order and classic sentinel values',()=>{
 const {root,neighbor}=init();assert.equal(P_FindHighestFloorSurrounding(root),-500*F);assert.equal(P_FindLowestCeilingSurrounding(root),0x7fffffff);
 const low=neighbor(-16*F,128*F),high=neighbor(32*F,200*F);low.lightlevel=80;high.lightlevel=120;
 assert.equal(P_FindLowestFloorSurrounding(root),-16*F);assert.equal(P_FindHighestFloorSurrounding(root),32*F);assert.equal(P_FindNextHighestFloor(root,0),32*F);
 assert.equal(P_FindLowestCeilingSurrounding(root),128*F);assert.equal(P_FindHighestCeilingSurrounding(root),200*F);assert.equal(P_FindMinSurroundingLight(root,160),80);
 assert.equal(P_FindSectorFromLineTag({tag:1},-1),0);assert.equal(P_FindSectorFromLineTag({tag:1},0),-1);
 const i=root.lines.length-2;assert.ok(twoSided(0,i));assert.strictEqual(getSide(0,i,1).sector,low);assert.strictEqual(getSector(0,i,0),root);assert.strictEqual(getNextSector(root.lines[i],root),low);
});
test('MovePlane uses strict destination crossing and only reports pastdest on the following tic',()=>{
 const {root,a}=init();assert.equal(floors.T_MovePlane(root,F,2*F,false,0,1),RES.ok);assert.equal(root.floorheight,F);assert.equal(a.z,F);
 assert.equal(floors.T_MovePlane(root,F,2*F,false,0,1),RES.ok);assert.equal(root.floorheight,2*F);
 assert.equal(floors.T_MovePlane(root,F,2*F,false,0,1),RES.pastdest);assert.equal(root.floorheight,2*F);
 assert.equal(floors.T_MovePlane(root,F,0,false,0,-1),RES.ok);assert.equal(a.z,F);
});
test('Noncrushing ceilings roll back at obstruction; crushing ceilings keep moving and cause native damage',()=>{
 const {root,p}=init();root.ceilingheight=56*F;assert.equal(floors.T_MovePlane(root,F,0,false,1,-1),RES.crushed);assert.equal(root.ceilingheight,56*F);assert.equal(p.health,100);
 assert.equal(floors.T_MovePlane(root,F,0,true,1,-1),RES.crushed);assert.equal(root.ceilingheight,55*F);assert.ok(p.health<100);
});
test('Floor thinker runs through original sentinel list, carries the player and removes itself',()=>{
 const {root,a,neighbor,sounds}=init();neighbor(32*F);assert.equal(floors.EV_DoFloor({tag:1},FT.raiseFloorToNearest),1);
 const effect=root.specialdata as floormove_t;assert.strictEqual(effect.thinker.function,floors.T_MoveFloor);assert.equal(floors.EV_DoFloor({tag:1},FT.raiseFloor24),0);
 run(33);assert.equal(root.floorheight,32*F);assert.equal(a.z,32*F);assert.equal(root.specialdata,null);assert.equal(effect.thinker.function,-1);assert.ok(sounds.some(s=>s.sound===SFX.sfx_pstop));
});
test('Floor types preserve speed, destinations, texture lookup and texture/special transfer',()=>{
 for(const type of [FT.lowerFloor,FT.lowerFloorToLowest,FT.turboLower,FT.raiseFloor,FT.raiseFloorCrush,FT.raiseFloorTurbo,FT.raiseFloor24,FT.raiseFloor512,FT.raiseToTexture,FT.lowerAndChange]){
  const {root,neighbor}=init();const other=neighbor(-16*F);other.floorpic=7;other.special=4;
  floors.EV_DoFloor({tag:1},type);const f=root.specialdata as floormove_t;assert.ok(f,type.toString());assert.equal(f.type,type);
  if(type===FT.turboLower)assert.equal(f.floordestheight,-8*F);if(type===FT.raiseFloor512)assert.equal(f.floordestheight,512*F);if(type===FT.raiseToTexture)assert.ok(f.floordestheight>0);
  if(type===FT.lowerAndChange){run(17);assert.equal(root.floorpic,7);assert.equal(root.special,4);}
 }
});
test('Stair construction follows front-to-back matching textures and preserves per-step height',()=>{
 const {root,neighbor}=init(),s1=neighbor(0,128*F),s2=neighbor(0,128*F,s1);s1.floorpic=s2.floorpic=root.floorpic;
 assert.equal(floors.EV_BuildStairs({tag:1},ST.build8),1);assert.equal((root.specialdata as floormove_t).floordestheight,8*F);assert.equal((s1.specialdata as floormove_t).floordestheight,16*F);assert.equal((s2.specialdata as floormove_t).floordestheight,24*F);
 run(97);assert.deepEqual([root.floorheight,s1.floorheight,s2.floorheight],[8*F,16*F,24*F]);
});
test('Ceilings stop and resume with the same shared callback identity, slowing under crushing',()=>{
 const {root}=init();ceilings.EV_DoCeiling({tag:1},CT.crushAndRaise);const effect=root.specialdata as ceiling_t;
 run(1);const before=root.ceilingheight;assert.equal(ceilings.EV_CeilingCrushStop({tag:1}),1);assert.equal(effect.thinker.function,null);run(5);assert.equal(root.ceilingheight,before);
 ceilings.P_ActivateInStasisCeiling({tag:1});assert.strictEqual(effect.thinker.function,ceilings.T_MoveCeiling);run(73);assert.equal(effect.speed,F/8);
});
test('Raising ceiling reaches highest neighbor and releases active slot; silent crusher suppresses movement sound',()=>{
 const {root,neighbor,sounds}=init();neighbor(0,132*F);ceilings.EV_DoCeiling({tag:1},CT.raiseToHighest);const effect=root.specialdata as ceiling_t;run(5);assert.equal(root.ceilingheight,132*F);assert.equal(root.specialdata,null);assert.ok(!ceilings.activeceilings.includes(effect));
 sounds.length=0;ceilings.EV_DoCeiling({tag:1},CT.silentCrushAndRaise);run(3);assert.equal(sounds.filter(s=>s.sound===SFX.sfx_stnmov).length,0);
});
test('Door opens, waits and closes with original strict endpoint timing',()=>{
 const {root,neighbor}=init();neighbor(0,132*F);root.ceilingheight=64*F;doors.EV_DoDoor({tag:1},DT.normal);const effect=root.specialdata as vldoor_t;
 run(33);assert.equal(root.ceilingheight,128*F);assert.equal(effect.direction,0);assert.equal(effect.topcountdown,150);
 run(150);assert.equal(effect.direction,-1);run(40);assert.equal(effect.direction,1); // occupant blocks closing and door reverses
});
test('Opening-only tagged doors remove their thinker; close-only doors do not reverse on obstruction',()=>{
 const {root,neighbor}=init();neighbor(0,132*F);root.ceilingheight=64*F;doors.EV_DoDoor({tag:1},DT.blazeOpen);run(9);assert.equal(root.ceilingheight,128*F);assert.equal(root.specialdata,null);
 doors.EV_DoDoor({tag:1},DT.close);const effect=doorEffect(root);run(40);assert.equal(root.ceilingheight,56*F);assert.equal(effect.direction,-1);
});
test('Manual locked doors accept card or skull, report original message and can reverse an existing door',()=>{
 const {root,neighbor,a,p,sounds}=init();const back=neighbor(0,64*F),line=root.lines.at(-1)!;line.special=26;doors.EV_VerticalDoor(line,a);assert.equal(back.specialdata,null);assert.equal(p.message,TEXT.PD_BLUEK);assert.equal(sounds.at(-1)!.origin,null);
 p.cards[CARD.it_blueskull]=true;doors.EV_VerticalDoor(line,a);const effect=doorEffect(back);assert.equal(effect.direction,1);doors.EV_VerticalDoor(line,a);assert.equal(effect.direction,-1);
 doors.EV_VerticalDoor(line,a);assert.equal(effect.direction,1);
});
test('Remote locks reject nonplayers and manual open-only door clears its special',()=>{
 const {root,neighbor,a,p}=init();neighbor(0,132*F);const line={...root.lines.at(-1)!,tag:1,special:134};assert.equal(doors.EV_DoLockedDoor(line,DT.open,a),0);p.cards[CARD.it_redcard]=true;assert.equal(doors.EV_DoLockedDoor(line,DT.open,a),1);
 const other=init();const back=other.neighbor(0,64*F),manual=other.root.lines.at(-1)!;manual.special=31;doors.EV_VerticalDoor(manual,other.a);assert.equal(manual.special,0);assert.equal((back.specialdata as vldoor_t).type,DT.open);
});
test('Timed doors retain 30-second and 5-minute countdowns',()=>{
 const {root,neighbor}=init();neighbor(0,132*F);doors.P_SpawnDoorCloseIn30(root);const close=root.specialdata as vldoor_t;run(1049);assert.equal(close.direction,0);run(1);assert.equal(close.direction,-1);
 const next=init();next.neighbor(0,132*F);doors.P_SpawnDoorRaiseIn5Mins(next.root,0);const raise=next.root.specialdata as vldoor_t;run(10499);assert.equal(raise.direction,2);run(1);assert.equal(raise.direction,1);assert.equal(raise.type,DT.normal);
});
test('Down-wait-up platform carries the player and releases its active slot at the top',()=>{
 const {root,neighbor,a}=init();neighbor(-16*F);plats.EV_DoPlat({tag:1},PT.downWaitUpStay,0);const effect=root.specialdata as plat_t;run(5);assert.equal(root.floorheight,-16*F);assert.equal(a.z,-16*F);assert.equal(effect.status,PS.waiting);
 run(105);assert.equal(effect.status,PS.up);run(5);assert.equal(root.floorheight,0);assert.equal(root.specialdata,null);assert.ok(!plats.activeplats.includes(effect));
});
test('Perpetual platforms stop/resume and active platform capacity reports overflow',()=>{
 const {root,neighbor}=init();neighbor(-8*F);neighbor(8*F);plats.EV_DoPlat({tag:1},PT.perpetualRaise,0);const effect=root.specialdata as plat_t;
 plats.EV_StopPlat({tag:1});assert.equal(effect.status,PS.in_stasis);assert.equal(effect.thinker.function,null);const h=root.floorheight;run(10);assert.equal(root.floorheight,h);plats.P_ActivateInStasis(1);assert.strictEqual(effect.thinker.function,plats.T_PlatRaise);
 plats.activeplats.fill(effect);assert.throws(()=>plats.P_AddActivePlat(effect),/no more plats/);
});
test('Boss callback now starts a real moving floor through native thinkers',()=>{
 const {root,neighbor,a,g,context}=init();neighbor(-24*F);root.tag=666;g.playeringame[0]=true;
 P_InitEnemyContext({gamemode:GameMode_t.commercial,S_StartSound:context.S_StartSound,S_StartGlobalSound:s=>context.S_StartSound(null,s),gameplay:{gameskill:skill_t.sk_medium,fastparm:false,netgame:false,players:g.players,playeringame:g.playeringame,gametic:0,gamemap:7,gameepisode:1,
  P_UseSpecialLine:()=>assert.fail('no door use'),EV_DoDoor:doors.EV_DoDoor,EV_DoFloor:floors.EV_DoFloor,G_ExitLevel:()=>assert.fail('no exit')}});
 I_LinkStateActions({...weaponStateActions,...enemyStateActions});const boss=P_SpawnMobj(300*F,0,ONFLOORZ,MT.MT_FATSO);boss.health=0;A_BossDeath(boss);assert.ok(root.specialdata);run(25);assert.equal(root.floorheight,-24*F);assert.equal(a.z,-24*F);
});
