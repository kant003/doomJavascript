import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as actors from '../src/linuxdoom-1.10/p_mobj';
import { P_InitMobjContext, P_SpawnMobj, P_SetMobjState, P_RemoveMobj, P_MobjThinker, P_XYMovement, P_ZMovement, P_ExplodeMissile,
    P_ResetItemRespawnQueue, itemrespawnque, itemrespawntime, iquehead, iquetail, P_RespawnSpecials, P_NightmareRespawn,
    P_SpawnPlayer, P_SpawnMapThing, P_SpawnPuff, P_SpawnBlood, P_SpawnMissile, P_SpawnPlayerMissile, type mobj_context_t } from '../src/linuxdoom-1.10/p_mobj';
import { P_InitThinkers, P_RunThinkers, thinkercap, P_ResetLevelTime, P_Ticker } from '../src/linuxdoom-1.10/p_tick';
import { P_SetThingPosition, P_UnsetThingPosition } from '../src/linuxdoom-1.10/p_maputl';
import { mobjtype_t as MT, statenum_t as S } from '../src/linuxdoom-1.10/info.h';
import { mobjinfo, states, I_LinkStateActions } from '../src/linuxdoom-1.10/info';
import { mobjflag_t as MF, type mobj_t } from '../src/linuxdoom-1.10/p_mobj.h';
import { playerstate_t, cheat_t, type player_t } from '../src/linuxdoom-1.10/d_player.h';
import { skill_t, card_t, weapontype_t } from '../src/linuxdoom-1.10/doomdef.h';
import { ONFLOORZ, ONCEILINGZ, VIEWHEIGHT, GRAVITY, MAXMOVE, MELEERANGE, ITEMQUESIZE } from '../src/linuxdoom-1.10/p_local.h';
import { FRACUNIT as F } from '../src/linuxdoom-1.10/m_fixed.h';
import { FixedMul } from '../src/linuxdoom-1.10/m_fixed';
import { ANG45, ANG90, ANGLETOFINESHIFT, finecosine, finesine } from '../src/linuxdoom-1.10/tables.h';
import { M_ClearRandom, P_Random, prndindex, rndtable } from '../src/linuxdoom-1.10/m_random';
import { sfxenum_t } from '../src/linuxdoom-1.10/sounds.h';
import { sky } from '../src/linuxdoom-1.10/r_sky';
import { mapstate as m } from '../src/linuxdoom-1.10/r_state.h';
import { W_InitFile, W_GetNumForName } from '../src/linuxdoom-1.10/w_wad';
import { R_InitData } from '../src/linuxdoom-1.10/r_data';
import { P_LoadMapData } from '../src/linuxdoom-1.10/p_setup';
import { demoWad } from '../src/web/demo';

import { createPlayer } from './helpers/player';

function init() {
    W_InitFile({name:'demo.wad',data:demoWad()});R_InitData();P_LoadMapData(W_GetNumForName('E1M1'));
    P_InitThinkers();P_ResetLevelTime();P_ResetItemRespawnQueue();M_ClearRandom();I_LinkStateActions({},false);
    const sounds:{origin:mobj_t;sound:sfxenum_t}[]=[],stopped:mobj_t[]=[],calls:string[]=[];
    const missing=(name:string):never=>{throw new Error(`Test dependency not configured: ${name}`);};
    const g:mobj_context_t={gameskill:skill_t.sk_medium,deathmatch:0,netgame:false,nomonsters:false,respawnmonsters:false,players:Array.from({length:4},createPlayer),
        playeringame:[false,false,false,false],consoleplayer:0,playerstarts:[],deathmatchstarts:[],totalkills:0,totalitems:0,ceilingline:null,linetarget:null,attackrange:0,
        P_TryMove:()=>missing('P_TryMove'),P_CheckPosition:()=>missing('P_CheckPosition'),P_SlideMove:()=>missing('P_SlideMove'),P_AimLineAttack:()=>missing('P_AimLineAttack'),
        S_StartSound:(origin,sound)=>sounds.push({origin,sound}),S_StopSound:origin=>stopped.push(origin),
        G_PlayerReborn:()=>missing('G_PlayerReborn'),P_SetupPsprites:()=>missing('P_SetupPsprites'),ST_Start:()=>calls.push('status'),HU_Start:()=>calls.push('hud')};
    P_InitMobjContext(g);return {g,sounds,stopped,calls};
}
function lampType():MT {return mobjinfo.findIndex(i=>i.doomednum===2028);}
function list():mobj_t[]{const result:mobj_t[]=[];for(let a=m.sectors[0].thinglist;a;a=a.snext)result.push(a);return result;}
function allowMove(g:mobj_context_t,targets:{x:number;y:number}[]=[]):void {
    g.P_TryMove=(mo,x,y)=>{targets.push({x,y});P_UnsetThingPosition(mo);mo.x=x;mo.y=y;P_SetThingPosition(mo);return true;};
}

test('Every active original p_mobj function is exported',()=>{
    const source=readFileSync('original/linuxdoom-1.10/p_mobj.c','utf8');
    const names=[...source.matchAll(/^(?:(?:void|boolean|mobj_t\*)[ \t]+)?(P_\w+)\s*\([^;{}]*\)\s*\{/gm)].map(row=>row[1]);assert.equal(names.length,16);
    for(const name of names)assert.equal(typeof actors[name as keyof typeof actors],'function',name);
});
test('Spawn initializes original fields, links lists, skips initial actions and retains thinker identity',()=>{
    const {g}=init();let called=0;I_LinkStateActions({A_Look:()=>called++},false);
    const a=P_SpawnMobj(12*F,-20*F,ONFLOORZ,MT.MT_POSSESSED),info=mobjinfo[MT.MT_POSSESSED];
    assert.equal(called,0);assert.strictEqual(a.info,info);assert.strictEqual(a.state,states[info.spawnstate]);assert.equal(a.lastlook,8%4);assert.equal(prndindex,1);
    assert.equal(a.radius,info.radius);assert.equal(a.reactiontime,info.reactiontime);assert.equal(a.health,info.spawnhealth);assert.equal(a.z,m.sectors[0].floorheight);
    assert.strictEqual(thinkercap.next,a.thinker);assert.strictEqual(a.thinker.function,P_MobjThinker);
    a.tics=1;P_RunThinkers();assert.equal(called,1);assert.equal(a.tics,states[a.state!.nextstate].tics);
    g.gameskill=skill_t.sk_nightmare;const b=P_SpawnMobj(0,0,ONCEILINGZ,MT.MT_POSSESSED);
    assert.equal(b.reactiontime,0);assert.equal(b.z,b.ceilingz-b.height);
    const c=P_SpawnMobj(0,0,17*F,lampType());assert.equal(c.z,17*F);assert.equal(c.momx,0);assert.equal(c.target,null);
    assert.throws(()=>P_MobjThinker({prev:null,next:null,function:null}),/no actor/);
});
test('States execute zero-tic chains with actor arguments and remove on S_NULL',t=>{
    const {stopped}=init(),a=P_SpawnMobj(0,0,ONFLOORZ,lampType());
    const saved=[S.S_PUFF1,S.S_PUFF2].map(i=>({...states[i]}));t.after(()=>{Object.assign(states[S.S_PUFF1],saved[0]);Object.assign(states[S.S_PUFF2],saved[1]);});
    const calls:string[]=[];
    Object.assign(states[S.S_PUFF1],{tics:0,nextstate:S.S_PUFF2,action:(mo:unknown)=>{assert.strictEqual(mo,a);calls.push('first');}});
    Object.assign(states[S.S_PUFF2],{tics:-1,action:()=>calls.push('second')});
    assert.equal(P_SetMobjState(a,S.S_PUFF1),true);assert.deepEqual(calls,['first','second']);assert.strictEqual(a.state,states[S.S_PUFF2]);assert.equal(a.tics,-1);
    assert.equal(P_SetMobjState(a,S.S_NULL),false);assert.equal(a.state,null);assert.equal(a.thinker.function,-1);assert.deepEqual(stopped,[a]);assert.equal(list().length,0);
    P_RunThinkers();assert.strictEqual(thinkercap.next,thinkercap);
});
test('Unlinked state actions fail and zero-tic cycles are bounded',t=>{
    init();const a=P_SpawnMobj(0,0,ONFLOORZ,lampType());assert.throws(()=>P_SetMobjState(a,S.S_POSS_STND),/not linked/);
    const saved={...states[S.S_PUFF1]};t.after(()=>Object.assign(states[S.S_PUFF1],saved));Object.assign(states[S.S_PUFF1],{tics:0,nextstate:S.S_PUFF1,action:null});
    assert.throws(()=>P_SetMobjState(a,S.S_PUFF1),/zero-tic/);
});
test('XY motion preserves positive-only subdivision, momentum clamp and friction',()=>{
    const {g}=init(),targets:{x:number;y:number}[]=[];allowMove(g,targets);const a=P_SpawnMobj(0,0,ONFLOORZ,lampType());
    a.momx=40*F;a.momy=-11*F-1;P_XYMovement(a);assert.deepEqual(targets,[{x:15*F,y:Math.trunc((-11*F-1)/2)},{x:30*F,y:-11*F-1}]);
    assert.equal(a.momx,FixedMul(MAXMOVE,0xe800));assert.equal(a.momy,FixedMul(-11*F-1,0xe800));
    targets.length=0;a.momx=-MAXMOVE;a.momy=0;P_XYMovement(a);assert.equal(targets.length,1);assert.equal(a.x,0);
    a.z=F;a.momx=F;P_XYMovement(a);assert.equal(a.momx,F);
    a.z=0;a.momx=0x0fff;P_XYMovement(a);assert.equal(a.momx,0);
});
test('Blocked actors stop, players slide and walking states settle only without input',()=>{
    const {g}=init();g.P_TryMove=()=>false;let slides=0;g.P_SlideMove=()=>{slides++;};const a=P_SpawnMobj(0,0,ONFLOORZ,MT.MT_PLAYER);
    a.momx=F;P_XYMovement(a);assert.equal(a.momx,0);
    a.player=g.players[0];a.player.mo=a;a.momx=F;a.player.cheats=cheat_t.CF_NOMOMENTUM;P_XYMovement(a);assert.equal(slides,1);assert.equal(a.momx,0);
    a.player.cheats=0;a.momx=1;a.state=states[S.S_PLAY_RUN1];P_XYMovement(a);assert.strictEqual(a.state,states[S.S_PLAY]);
    a.state=states[S.S_PLAY_RUN1];a.player.cmd.forwardmove=1;a.momx=1;P_XYMovement(a);assert.strictEqual(a.state,states[S.S_PLAY_RUN1]);
    allowMove(g);a.player=null;a.flags|=MF.MF_CORPSE;a.floorz=F;a.z=F;a.momx=F;P_XYMovement(a);assert.equal(a.momx,F);
});
test('Skull momentum reset restores spawn state and preserves original floor/ceiling bounce order',()=>{
    init();I_LinkStateActions({A_Look:()=>{}},false);const a=P_SpawnMobj(0,0,ONFLOORZ,MT.MT_POSSESSED);a.flags|=MF.MF_SKULLFLY;a.momz=F;
    P_XYMovement(a);assert.equal(a.flags&MF.MF_SKULLFLY,0);assert.equal(a.momz,0);assert.strictEqual(a.state,states[a.info!.spawnstate]);
    a.flags|=MF.MF_SKULLFLY;a.z=F;a.momz=-2*F;P_ZMovement(a);assert.equal(a.momz,2*F);assert.equal(a.z,a.floorz);
    a.z=a.ceilingz-a.height;a.momz=F;P_ZMovement(a);assert.equal(a.momz,0);assert.equal(a.z,a.ceilingz-a.height);
});
test('Gravity, smooth step, hard landing, floating and no-gravity match original updates',()=>{
    const {g,sounds}=init();const a=P_SpawnMobj(0,0,20*F,MT.MT_PLAYER);a.flags=0;P_ZMovement(a);assert.equal(a.z,20*F);assert.equal(a.momz,-2*GRAVITY);
    P_ZMovement(a);assert.equal(a.z,18*F);assert.equal(a.momz,-3*GRAVITY);
    a.flags=MF.MF_NOGRAVITY;a.momz=0;P_ZMovement(a);assert.equal(a.momz,0);
    a.player=g.players[0];a.z=-2*F;a.momz=0;P_ZMovement(a);assert.equal(a.player.viewheight,VIEWHEIGHT-2*F);assert.equal(a.player.deltaviewheight,F/4);
    a.z=2*F;a.momz=-10*F;P_ZMovement(a);assert.equal(a.z,0);assert.equal(a.momz,0);assert.equal(a.player.deltaviewheight,-10*F>>3);assert.equal(sounds[0].sound,sfxenum_t.sfx_oof);
    a.player=null;a.flags=MF.MF_FLOAT|MF.MF_NOGRAVITY;a.z=20*F;a.target=P_SpawnMobj(0,0,50*F,lampType());P_ZMovement(a);assert.equal(a.z,24*F);
    a.flags|=MF.MF_INFLOAT;P_ZMovement(a);assert.equal(a.z,24*F);
});
test('Missiles explode with original state/RNG/sound, while sky-blocked ones are removed',()=>{
    const {g,sounds}=init();let blasts=0;I_LinkStateActions({A_Explode:()=>blasts++},false);const a=P_SpawnMobj(0,0,20*F,MT.MT_ROCKET);a.momx=2*F;P_ExplodeMissile(a);
    assert.equal(a.momx,0);assert.equal(a.momy,0);assert.equal(a.momz,0);assert.equal(a.flags&MF.MF_MISSILE,0);assert.equal(a.tics,states[a.info!.deathstate].tics-(109&3));assert.equal(sounds[0].sound,a.info!.deathsound);
    const b=P_SpawnMobj(0,0,20*F,MT.MT_ROCKET);b.momx=F;g.P_TryMove=()=>false;
    sky.skyflatnum=7;g.ceilingline={...m.lines[0],backsector:{...m.sectors[0],ceilingpic:7}};P_XYMovement(b);assert.equal(b.thinker.function,-1);
    const c=P_SpawnMobj(0,0,F,MT.MT_ROCKET);c.momz=-2*F;P_ZMovement(c);assert.equal(c.flags&MF.MF_MISSILE,0);assert.equal(blasts,2);
});
test('Respawn queue snapshots spawnpoints, excludes dropped/powerups and drops oldest on overflow',()=>{
    init();const itemType=mobjinfo.findIndex(i=>i.doomednum===2007);assert.ok(itemType>=0);
    for(let i=0;i<ITEMQUESIZE;i++){const a=P_SpawnMobj(0,0,ONFLOORZ,itemType);a.spawnpoint={x:i,y:0,angle:0,type:2007,options:7};P_RemoveMobj(a);a.spawnpoint.x=-1;}
    assert.equal(iquehead,0);assert.equal(iquetail,1);assert.equal(itemrespawnque[1].x,1);assert.equal(itemrespawntime[1],0);
    for(const type of [MT.MT_INV,MT.MT_INS,itemType]){const a=P_SpawnMobj(0,0,ONFLOORZ,type);if(type===itemType)a.flags|=MF.MF_DROPPED;P_RemoveMobj(a);}
    assert.equal(iquehead,0);P_RunThinkers();assert.strictEqual(thinkercap.next,thinkercap);
});
test('Item respawn requires deathmatch 2 and thirty seconds, then restores angle/location',()=>{
    const {g,sounds}=init();const type=mobjinfo.findIndex(i=>i.doomednum===2007),a=P_SpawnMobj(0,0,ONFLOORZ,type);
    a.spawnpoint={x:32,y:24,angle:90,type:2007,options:7};P_RemoveMobj(a);P_RunThinkers();P_RespawnSpecials();assert.equal(iquetail,0);g.deathmatch=2;
    const clock={paused:false,netgame:false,menuactive:false,demoplayback:false,players:g.players,consoleplayer:0,playeringame:[false,false,false,false],
        P_PlayerThink:()=>assert.fail('inactive player'),P_UpdateSpecials:()=>{},P_RespawnSpecials};
    for(let i=0;i<1050;i++)P_Ticker(clock);assert.equal(iquetail,0);P_RespawnSpecials();assert.equal(iquetail,1);
    const restored=list().find(o=>o.type===type)!;assert.equal(restored.x,32*F);assert.equal(restored.y,24*F);assert.equal(restored.angle,ANG90);
    assert.ok(list().some(o=>o.type===MT.MT_IFOG));assert.equal(sounds.at(-1)!.sound,sfxenum_t.sfx_itmbk);
});
test('Nightmare respawn checks occupancy and recreates ambush actor with teleport fog',()=>{
    const {g,sounds}=init();const a=P_SpawnMobj(0,0,ONFLOORZ,MT.MT_POSSESSED);a.spawnpoint={x:64,y:24,angle:135,type:3004,options:15};
    g.P_CheckPosition=()=>false;P_NightmareRespawn(a);assert.equal(list().length,1);
    g.P_CheckPosition=(_a,x,y)=>{assert.equal(x,64*F);assert.equal(y,24*F);return true;};P_NightmareRespawn(a);
    assert.equal(a.thinker.function,-1);assert.equal(sounds.length,2);assert.ok(sounds.every(s=>s.sound===sfxenum_t.sfx_telept));
    const b=list().find(o=>o.type===MT.MT_POSSESSED)!;assert.equal(b.reactiontime,18);assert.equal(b.angle,3*ANG45);assert.equal(b.flags&MF.MF_AMBUSH,MF.MF_AMBUSH);assert.notStrictEqual(b.spawnpoint,a.spawnpoint);
});
test('Mobj thinker preserves finite/permanent tics and nightmare delay/random gate',()=>{
    const {g}=init();const a=P_SpawnMobj(0,0,ONFLOORZ,MT.MT_POSSESSED);a.tics=-1;P_RunThinkers();assert.equal(a.movecount,0);
    g.respawnmonsters=true;a.movecount=418;let checks=0;g.P_CheckPosition=()=>{checks++;return false;};
    P_MobjThinker(a);assert.equal(a.movecount,419);assert.equal(checks,0);
    while(rndtable[(prndindex+1)&255]>4)P_Random();P_MobjThinker(a.thinker);assert.equal(checks,1);assert.equal(a.movecount,420);
    a.tics=2;P_MobjThinker(a);assert.equal(a.tics,1);
});
test('Map spawning handles starts, skill flags, multiplayer, unknown types and monster filters',()=>{
    const {g}=init();for(let i=0;i<12;i++)P_SpawnMapThing({x:i,y:0,angle:0,type:11,options:0});assert.equal(g.deathmatchstarts.length,10);
    P_SpawnMapThing({x:5,y:6,angle:0,type:1,options:0});assert.equal(g.playerstarts[0].x,5);assert.equal(list().length,0);
    const thing={x:10,y:20,angle:90,type:3004,options:1};P_SpawnMapThing(thing);assert.equal(list().length,0);
    g.gameskill=skill_t.sk_baby;P_SpawnMapThing({...thing,options:17});assert.equal(list().length,0);
    g.netgame=true;P_SpawnMapThing({...thing,options:25});assert.equal(list().length,1);assert.equal(g.totalkills,1);assert.equal(list()[0].angle,ANG90);assert.equal(list()[0].flags&MF.MF_AMBUSH,MF.MF_AMBUSH);
    g.nomonsters=true;P_SpawnMapThing(thing);P_SpawnMapThing({...thing,type:3006});assert.equal(list().length,1);
    assert.throws(()=>P_SpawnMapThing({...thing,type:9999}),/Unknown type/);
    g.deathmatch=1;P_SpawnMapThing({...thing,type:5});assert.equal(list().length,1);
    P_SpawnMapThing({...thing,type:2014});assert.equal(g.totalitems,1);assert.equal(list().length,2);
});
test('Player spawn resets transient fields, preserves inventory and orders rebirth/weapon/UI hooks',()=>{
    const {g,calls}=init();g.playeringame[0]=true;g.players[0].playerstate=playerstate_t.PST_REBORN;g.players[0].health=37;g.players[0].ammo[0]=17;
    g.G_PlayerReborn=i=>{assert.equal(i,0);calls.push('reborn');g.players[0].health=100;};g.P_SetupPsprites=p=>{assert.strictEqual(p,g.players[0]);calls.push('psprites');};g.deathmatch=1;
    P_SpawnPlayer({x:24,y:12,angle:90,type:1,options:0});assert.deepEqual(calls,['reborn','psprites','status','hud']);const p=g.players[0];
    assert.equal(p.health,100);assert.equal(p.mo!.health,100);assert.equal(p.ammo[0],17);assert.equal(p.playerstate,playerstate_t.PST_LIVE);assert.equal(p.viewheight,VIEWHEIGHT);assert.ok(p.cards.slice(0,card_t.NUMCARDS).every(Boolean));
    g.playeringame[1]=true;g.P_SetupPsprites=()=>calls.push('other psprites');P_SpawnPlayer({x:0,y:0,angle:0,type:2,options:0});assert.equal(g.players[1].mo!.flags&MF.MF_TRANSLATION,1<<MF.MF_TRANSSHIFT);
});
test('Puff and blood use original RNG order, damage frames and melee state',()=>{
    const {g}=init();P_SpawnBlood(0,0,40*F,10);let a=list()[0];assert.equal(a.type,MT.MT_BLOOD);assert.equal(a.z,40*F+((8-109)<<10));assert.equal(a.momz,2*F);assert.strictEqual(a.state,states[S.S_BLOOD2]);assert.equal(prndindex,4);
    P_SpawnBlood(0,0,40*F,8);a=list()[0];assert.strictEqual(a.state,states[S.S_BLOOD3]);
    g.attackrange=MELEERANGE;P_SpawnPuff(0,0,40*F);a=list()[0];assert.equal(a.type,MT.MT_PUFF);assert.equal(a.momz,F);assert.strictEqual(a.state,states[S.S_PUFF3]);
});
test('Missile spawning computes target momentum and half-step; player autoaim tries three angles',()=>{
    const {g}=init();const targets:{x:number;y:number}[]=[];allowMove(g,targets);const source=P_SpawnMobj(0,0,ONFLOORZ,MT.MT_PLAYER),dest=P_SpawnMobj(100*F,0,20*F,lampType());
    const missile=P_SpawnMissile(source,dest,MT.MT_ROCKET);assert.strictEqual(missile.target,source);assert.equal(missile.z,32*F+(missile.momz>>1));assert.equal(missile.x,missile.momx>>1);assert.equal(missile.momz,4*F);
    const angles:number[]=[];g.P_AimLineAttack=(_source,angle,distance)=>{assert.equal(distance,1024*F);angles.push(angle);g.linetarget=angles.length===3?dest:null;return F/2;};source.angle=0;
    P_SpawnPlayerMissile(source,MT.MT_ROCKET);assert.deepEqual(angles,[0,1<<26,(-1<<26)>>>0]);const th=list()[0];assert.equal(th.angle,(-1<<26)>>>0);assert.equal(th.momz,FixedMul(th.info!.speed,F/2));
    assert.equal(th.momx,FixedMul(th.info!.speed,finecosine[th.angle>>>ANGLETOFINESHIFT]));assert.equal(th.momy,FixedMul(th.info!.speed,finesine[th.angle>>>ANGLETOFINESHIFT]));
    g.P_AimLineAttack=()=>{g.linetarget=null;return F;};source.angle=ANG90;P_SpawnPlayerMissile(source,MT.MT_ROCKET);assert.equal(list()[0].angle,ANG90);assert.equal(list()[0].momz,0);
});
