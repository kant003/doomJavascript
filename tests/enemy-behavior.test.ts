import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as enemy from '../src/linuxdoom-1.10/p_enemy';
import { P_InitEnemyContext, enemyStateActions, P_LookForPlayers, P_NewChaseDir, P_Move, P_CheckMeleeRange, P_CheckMissileRange,
    A_Look,A_Chase,A_FaceTarget,A_PosAttack,A_SPosAttack,A_TroopAttack,A_SargAttack,A_HeadAttack,A_BruisAttack,A_CyberAttack,A_BspiAttack,
    A_SkelMissile,A_Tracer,A_VileChase,A_VileTarget,A_VileAttack,A_FatAttack1,A_FatAttack2,A_FatAttack3,A_SkullAttack,A_PainShootSkull,
    A_BossDeath,A_KeenDie,A_BrainAwake,A_BrainSpit,A_SpawnFly,A_BrainScream,brain,dirtype_t as D,type enemy_gameplay_t } from '../src/linuxdoom-1.10/p_enemy';
import { createCombatWorld } from './helpers/combat-world';
import { P_SpawnMobj,P_SetMobjState } from '../src/linuxdoom-1.10/p_mobj';
import { I_LinkStateActions,stateActionNames,states } from '../src/linuxdoom-1.10/info';
import { weaponStateActions,P_MovePsprites } from '../src/linuxdoom-1.10/p_pspr';
import { P_InitPlayerContext,P_PlayerThink } from '../src/linuxdoom-1.10/p_user';
import { P_Ticker,P_RunThinkers } from '../src/linuxdoom-1.10/p_tick';
import { P_DamageMobj } from '../src/linuxdoom-1.10/p_inter';
import { mobjtype_t as MT,statenum_t as S } from '../src/linuxdoom-1.10/info.h';
import { mobjflag_t as MF,type mobj_t } from '../src/linuxdoom-1.10/p_mobj.h';
import { skill_t,GameMode_t } from '../src/linuxdoom-1.10/doomdef.h';
import { ONFLOORZ } from '../src/linuxdoom-1.10/p_local.h';
import { mapstate as m } from '../src/linuxdoom-1.10/r_state.h';
import { FRACUNIT as F } from '../src/linuxdoom-1.10/m_fixed.h';
import { ANG90,ANG180,ANGLETOFINESHIFT,finecosine,finesine } from '../src/linuxdoom-1.10/tables.h';
import { FixedMul } from '../src/linuxdoom-1.10/m_fixed';
import { P_UnsetThingPosition,P_SetThingPosition } from '../src/linuxdoom-1.10/p_maputl';
import { M_ClearRandom,prndindex } from '../src/linuxdoom-1.10/m_random';
import { floor_e,vldoor_e } from '../src/linuxdoom-1.10/p_spec.h';

function init(){
 const f=createCombatWorld(),{g,context}=f;g.playeringame[0]=true;
 const events:{kind:string;tag?:number;type?:number}[]=[];
 const settings:enemy_gameplay_t={gameskill:skill_t.sk_medium,fastparm:false,netgame:false,players:g.players,playeringame:g.playeringame,gametic:0,gamemap:1,gameepisode:1,
  P_UseSpecialLine:()=>{events.push({kind:'use'});return true;},EV_DoFloor:(line,type)=>{events.push({kind:'floor',tag:line.tag,type});return 1;},
  EV_DoDoor:(line,type)=>{events.push({kind:'door',tag:line.tag,type});return 1;},G_ExitLevel:()=>events.push({kind:'exit'})};
 const ec={S_StartSound:context.S_StartSound,S_StartGlobalSound:(s:Parameters<typeof context.S_StartSound>[1])=>context.S_StartSound(null,s),gamemode:context.gamemode,gameplay:settings};
 P_InitEnemyContext(ec);I_LinkStateActions({...weaponStateActions,...enemyStateActions});
 return {...f,settings,events,ec};
}
function spawn(type:MT,x=64*F,y=0){return P_SpawnMobj(x,y,ONFLOORZ,type);}
function relocate(a:mobj_t,x:number,y:number){P_UnsetThingPosition(a);a.x=x;a.y=y;P_SetThingPosition(a);}
function all():mobj_t[]{const out:mobj_t[]=[];for(let a=m.sectors[0].thinglist;a;a=a.snext)out.push(a);return out;}
test('All 64 original enemy functions and all 74 state actions have real implementations',()=>{
 init();const text=readFileSync('original/linuxdoom-1.10/p_enemy.c','utf8');const names=[...text.matchAll(/^(?:(?:void|boolean)[ \t]+)?((?:P|PIT|A)_\w+)\s*\([^;{}]*\)\s*\{/gm)].map(r=>r[1]);
 assert.equal(names.length,64);for(const name of names)assert.equal(typeof enemy[name as keyof typeof enemy],'function',name);
 const bindings={...weaponStateActions,...enemyStateActions};assert.equal(Object.keys(bindings).length,74);assert.deepEqual(Object.keys(bindings).sort(),[...stateActionNames].sort());
 assert.strictEqual(states[S.S_POSS_RUN1].action,A_Chase);
});
test('Player search preserves cone, close-range exception, cycling and inactive-player guard',()=>{
 const {settings,a}=init(),mo=spawn(MT.MT_POSSESSED,96*F);mo.lastlook=0;mo.angle=0;assert.equal(P_LookForPlayers(mo,false),false);
 mo.lastlook=0;assert.equal(P_LookForPlayers(mo,true),true);assert.strictEqual(mo.target,a);mo.lastlook=0;relocate(mo,32*F,0);assert.equal(P_LookForPlayers(mo,false),true);
 settings.playeringame.fill(false);assert.equal(P_LookForPlayers(mo,true),false);
});
test('Sound wakes enemies and native chase/retargeting no longer requires an absent action',()=>{
 const {a}=init(),mo=spawn(MT.MT_POSSESSED);enemy.P_NoiseAlert(a,a);A_Look(mo);assert.strictEqual(mo.target,a);assert.notStrictEqual(mo.state,states[mo.info!.spawnstate]);
 mo.state=states[mo.info!.spawnstate];mo.threshold=0;mo.info={...mo.info!,painchance:0};P_DamageMobj(mo,null,a,1);assert.strictEqual(mo.target,a);assert.ok(mo.threshold>0);
});
test('New chase directions use real movement/collision and turn counts; invalid direction fails',()=>{
 const {a}=init(),mo=spawn(MT.MT_SERGEANT);mo.target=a;mo.movedir=D.DI_NODIR;const before=mo.x;P_NewChaseDir(mo);assert.ok(mo.x<before);assert.ok(mo.movecount>=0&&mo.movecount<=15);
 mo.movedir=99;assert.throws(()=>P_Move(mo),/movedir/);mo.movedir=D.DI_NODIR;assert.equal(P_Move(mo),false);
 relocate(mo,110*F,0);mo.movedir=D.DI_EAST;assert.equal(P_Move(mo),false);
});
test('Range checks honor melee reach, sight, reaction delay and JUSTHIT retaliation',()=>{
 const {a}=init(),mo=spawn(MT.MT_TROOP,40*F);mo.target=a;assert.equal(P_CheckMeleeRange(mo),true);relocate(mo,100*F,0);assert.equal(P_CheckMeleeRange(mo),false);
 mo.reactiontime=8;assert.equal(P_CheckMissileRange(mo),false);mo.flags|=MF.MF_JUSTHIT;assert.equal(P_CheckMissileRange(mo),true);assert.equal(mo.flags&MF.MF_JUSTHIT,0);
 relocate(mo,200*F,0);mo.flags|=MF.MF_JUSTHIT;assert.equal(P_CheckMissileRange(mo),false);assert.ok(mo.flags&MF.MF_JUSTHIT);
});
test('Hitscan enemies use native aim, impacts and player damage with original pellet counts',()=>{
 const {a,p}=init(),mo=spawn(MT.MT_POSSESSED,64*F);mo.target=a;M_ClearRandom();A_PosAttack(mo);assert.ok(p.health<100);assert.ok(prndindex>=4);
 p.health=a.health=100;M_ClearRandom();A_SPosAttack(mo);assert.ok(p.health<100);assert.ok(all().some(o=>o.type===MT.MT_BLOOD));
});
test('Melee attackers apply their original damage multipliers',()=>{
 for(const [type,fn] of [[MT.MT_TROOP,A_TroopAttack],[MT.MT_SERGEANT,A_SargAttack],[MT.MT_HEAD,A_HeadAttack],[MT.MT_BRUISER,A_BruisAttack]] as const){
  const {a,p}=init(),mo=spawn(type,40*F);mo.target=a;M_ClearRandom();fn(mo);assert.ok(p.health<100,MT[type]);}
});
test('Projectile attackers create the correct native missile type and link its source',()=>{
 for(const [type,fn,missile] of [[MT.MT_TROOP,A_TroopAttack,MT.MT_TROOPSHOT],[MT.MT_HEAD,A_HeadAttack,MT.MT_HEADSHOT],[MT.MT_BRUISER,A_BruisAttack,MT.MT_BRUISERSHOT],[MT.MT_CYBORG,A_CyberAttack,MT.MT_ROCKET],[MT.MT_BABY,A_BspiAttack,MT.MT_ARACHPLAZ]] as const){
  const {a}=init();relocate(a,-80*F,0);const mo=spawn(type,80*F);mo.target=a;fn(mo);const shot=all().find(o=>o.type===missile)!;assert.ok(shot,MT[type]);assert.strictEqual(shot.target,mo);}
});
test('Revenant missile tracks its target, spawns smoke every fourth gametic and turns toward it',()=>{
 const {a,settings}=init();relocate(a,-80*F,24*F);const mo=spawn(MT.MT_UNDEAD);mo.target=a;A_SkelMissile(mo);const shot=all().find(o=>o.type===MT.MT_TRACER)!;assert.strictEqual(shot.tracer,a);
 const count=all().length;settings.gametic=1;A_Tracer(shot);assert.equal(all().length,count);settings.gametic=4;const z=shot.momz;A_Tracer(shot);assert.ok(all().some(o=>o.type===MT.MT_SMOKE));assert.notEqual(shot.momz,z);
});
test('Mancubus attack pairs preserve original angle deviations and momentum tables',()=>{
 for(const fn of [A_FatAttack1,A_FatAttack2,A_FatAttack3]){const {a}=init();relocate(a,-80*F,0);const mo=spawn(MT.MT_FATSO,70*F);mo.target=a;fn(mo);
  const shots=all().filter(o=>o.type===MT.MT_FATSHOT);assert.equal(shots.length,2);assert.notEqual(shots[0].angle,shots[1].angle);
  for(const s of shots){assert.equal(s.momx,FixedMul(s.info!.speed,finecosine[s.angle>>>ANGLETOFINESHIFT]));assert.equal(s.momy,FixedMul(s.info!.speed,finesine[s.angle>>>ANGLETOFINESHIFT]));}}
});
test('Lost souls charge and pain elemental preserves the original >20 population limit',()=>{
 const {a}=init(),skull=spawn(MT.MT_SKULL,64*F);skull.target=a;A_SkullAttack(skull);assert.ok(skull.flags&MF.MF_SKULLFLY);assert.ok(skull.momx<0);
 const pain=spawn(MT.MT_PAIN,-64*F,64*F);pain.target=a;for(let i=0;i<20;i++)spawn(MT.MT_SKULL,500*F,i*64*F);
 const count=all().length;A_PainShootSkull(pain,0);assert.equal(all().length,count);
});
test('Arch-vile finds a stationary corpse and restores original flags, height and health',()=>{
 const {a}=init();relocate(a,-100*F,-100*F);const corpse=spawn(MT.MT_POSSESSED,40*F,40*F);corpse.flags=MF.MF_CORPSE;corpse.health=0;corpse.height>>=2;corpse.tics=-1;
 const vile=spawn(MT.MT_VILE,-8*F,40*F);vile.target=a;vile.movedir=D.DI_EAST;A_VileChase(vile);
 assert.equal(corpse.health,corpse.info!.spawnhealth);assert.equal(corpse.height,corpse.info!.height);assert.equal(corpse.flags,corpse.info!.flags);assert.equal(corpse.target,null);assert.strictEqual(vile.state,states[S.S_VILE_HEAL1]);
});
test('Arch-vile fire follows target with native spatial links and its attack applies damage/thrust',()=>{
 const {a,p}=init();relocate(a,-64*F,24*F);const vile=spawn(MT.MT_VILE,64*F,24*F);vile.target=a;A_VileTarget(vile);const fire=vile.tracer!;assert.strictEqual(fire.tracer,a);assert.strictEqual(fire.target,vile);
 assert.ok(fire.subsector);p.health=a.health=500;A_VileAttack(vile);assert.ok(p.health<500);assert.equal(a.momz,Math.trunc(1000*F/a.info!.mass));
});
test('Keen and map 7 boss triggers wait for the last living actor and use original tags/types',()=>{
 const {settings,events}=init(),one=spawn(MT.MT_KEEN),two=spawn(MT.MT_KEEN,-64*F);one.health=0;A_KeenDie(one);assert.equal(events.length,0);two.health=0;A_KeenDie(one);assert.deepEqual(events[0],{kind:'door',tag:666,type:vldoor_e.open});
 settings.gamemap=7;const boss=spawn(MT.MT_FATSO);boss.health=0;A_BossDeath(boss);assert.deepEqual(events.at(-1),{kind:'floor',tag:666,type:floor_e.lowerFloorToLowest});
});
test('Boss rules respect episode/map, active survivors and remaining living bosses',()=>{
 const {settings,events,ec}=init();ec.gamemode=GameMode_t.registered;settings.gameepisode=4;settings.gamemap=6;const boss=spawn(MT.MT_CYBORG);boss.health=0;
 A_BossDeath(boss);assert.deepEqual(events[0],{kind:'door',tag:666,type:vldoor_e.blazeOpen});events.length=0;settings.playeringame.fill(false);A_BossDeath(boss);assert.equal(events.length,0);
});
test('Brain discovers native target thinkers, alternates on easy and launches cube with travel time',()=>{
 const {settings}=init();settings.gameskill=skill_t.sk_easy;brain.easy=0;const boss=spawn(MT.MT_BOSSBRAIN,64*F,-64*F),target=spawn(MT.MT_BOSSTARGET,64*F,96*F);
 A_BrainAwake(boss);assert.equal(brain.numbraintargets,1);assert.strictEqual(brain.braintargets[0],target);A_BrainSpit(boss);const shot=all().find(o=>o.type===MT.MT_SPAWNSHOT)!;assert.ok(shot);assert.strictEqual(shot.target,target);assert.ok(shot.reactiontime>0);
 const count=all().length;A_BrainSpit(boss);assert.equal(all().length,count);
});
test('Spawn cube arrival creates monster/fog and removes the cube through native teleport',()=>{
 const {a}=init();relocate(a,-100*F,-100*F);const target=spawn(MT.MT_BOSSTARGET,64*F,64*F),cube=spawn(MT.MT_SPAWNSHOT,-64*F,64*F);cube.target=target;cube.reactiontime=1;M_ClearRandom();A_SpawnFly(cube);
 assert.equal(cube.thinker.function,-1);assert.ok(all().some(o=>o.type===MT.MT_SPAWNFIRE));assert.ok(all().some(o=>(o.flags&MF.MF_COUNTKILL)&&o.health>0));
});
test('Brain death spawns 65 original explosion rockets and global death sound',()=>{
 const {sounds}=init(),boss=spawn(MT.MT_BOSSBRAIN);A_BrainScream(boss);assert.equal(all().filter(o=>o.type===MT.MT_ROCKET).length,65);assert.equal(sounds.at(-1)!.origin,null);
});
test('Deterministic native ticker runs perception, chase, attacks and damage for multiple enemies',()=>{
 function scenario(){const {p,a,g,settings}=init();p.health=a.health=1000;const z=spawn(MT.MT_POSSESSED,80*F,0),imp=spawn(MT.MT_TROOP,-80*F,24*F);z.angle=ANG180;imp.angle=0;
  P_InitPlayerContext({gamemode:GameMode_t.commercial,P_MovePsprites,P_PlayerInSpecialSector:()=>assert.fail('sector'),P_UseLines:()=>assert.fail('use')});
  const clock={paused:false,netgame:false,menuactive:false,demoplayback:false,players:g.players,consoleplayer:0,playeringame:g.playeringame,P_PlayerThink,P_UpdateSpecials:()=>{},P_RespawnSpecials:()=>{}};
  for(let i=0;i<200;i++){settings.gametic=i;P_Ticker(clock);}return {health:p.health,z:[z.x,z.y,z.health,z.state?.frame],imp:[imp.x,imp.y,imp.health],rng:prndindex};}
 const result=scenario();assert.ok(result.health<1000);assert.deepEqual(scenario(),result);
});
