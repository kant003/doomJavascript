// Copyright (C) 1993-1996 id Software, Inc. GPL-2.0-only.
// Enemy behavior and actions. Sound, game state and sector/exit callbacks are explicit dependencies.
import type { mobj_t } from './p_mobj.h';
import type { sector_t } from './r_defs.h';
import type { player_t } from './d_player.h';
import type { pspdef_t } from './p_pspr.h';
import type { actionf_p2 } from './d_think.h';
import type { actionf_p1 } from './d_think.h';
import { GameMode_t } from './doomdef.h';
import { skill_t } from './doomdef.h';
import { mobjtype_t as MT, statenum_t as S } from './info.h';
import { mobjinfo } from './info';
import { P_SetMobjState, P_SpawnMobj, P_SpawnMissile, P_SpawnPuff, P_RemoveMobj, P_MobjThinker, P_MobjForThinker } from './p_mobj';
import { P_DamageMobj } from './p_inter';
import { P_CheckSight } from './p_sight';
import { P_TryMove, P_CheckPosition, P_TeleportMove, P_AimLineAttack, P_LineAttack, mapclip } from './p_map';
import { P_AproxDistance, P_BlockThingsIterator, P_UnsetThingPosition, P_SetThingPosition } from './p_maputl';
import { thinkercap } from './p_tick';
import { FRACUNIT as F } from './m_fixed.h';
import { FixedMul } from './m_fixed';
import { ANG90, ANG180, ANG270, ANGLETOFINESHIFT, finecosine, finesine } from './tables.h';
import { MELEERANGE, MISSILERANGE, FLOATSPEED, MAXRADIUS, MAPBLOCKSHIFT } from './p_local.h';
import { R_PointToAngle2 } from './r_main';
import type { line_t } from './r_defs.h';
import { vldoor_e, floor_e } from './p_spec.h';
import { mobjflag_t as MF } from './p_mobj.h';
import { P_Random } from './m_random';
import { P_RadiusAttack } from './p_map';
import { ML_TWOSIDED, ML_SOUNDBLOCK } from './doomdata.h';
import { mapstate } from './r_state.h';
import { view } from './r_main';
import { P_LineOpening, openings } from './p_maputl';
import { A_ReFire } from './p_pspr';
import { sfxenum_t as SFX } from './sounds.h';

export interface enemy_context_t {
    S_StartSound(origin: mobj_t, sound: SFX): void;
    // Required by the corresponding additional actions; reload-only callers need neither.
    S_StartGlobalSound?(sound:SFX):void;
    gamemode?:GameMode_t;
    gameplay?:enemy_gameplay_t;
}
export interface enemy_gameplay_t {
    gameskill:skill_t;fastparm:boolean;netgame:boolean;players:player_t[];playeringame:boolean[];
    gametic:number;gamemap:number;gameepisode:number;
    P_UseSpecialLine(actor:mobj_t,line:line_t,side:number):boolean;
    EV_DoDoor(line:Pick<line_t,'tag'>,kind:vldoor_e):number;
    EV_DoFloor(line:Pick<line_t,'tag'>,kind:floor_e):number;
    G_ExitLevel():void;
}
let context: enemy_context_t | null = null;
export function P_InitEnemyContext(game: enemy_context_t): void { context = game; }
function sound(player: player_t, sfx: SFX): void {
    if (!context) throw new Error('P_InitEnemyContext: sound is not linked');
    context.S_StartSound(player.mo!,sfx);
}
function gameplay():enemy_gameplay_t {if(!context?.gameplay)throw new Error('Enemy gameplay context is not linked');return context.gameplay;}
function play(actor:mobj_t,sfx:SFX):void {if(!context)throw new Error('Enemy sound is not linked');context.S_StartSound(actor,sfx);}
function globalSound(sfx:SFX):void {if(!context?.S_StartGlobalSound)throw new Error('Global enemy sound is not linked');context.S_StartGlobalSound(sfx);}
function* actors():Generator<mobj_t> {
    for(let th=thinkercap.next;th&&th!==thinkercap;th=th.next)if(th.function===P_MobjThinker){const mo=P_MobjForThinker(th);if(mo)yield mo;}
}
export let soundtarget: mobj_t | null = null;
export function P_RecursiveSound(sec: sector_t, soundblocks: number): void {
    // Explicit frames preserve C depth-first order without risking the JavaScript call stack.
    const stack: {sec: sector_t; soundblocks: number; line: number; entered: boolean}[] = [{sec,soundblocks,line:0,entered:false}];
    while (stack.length) {
        const frame = stack[stack.length - 1], sector = frame.sec;
        if (!frame.entered) {
            if (sector.validcount === view.validcount && sector.soundtraversed <= frame.soundblocks + 1) { stack.pop(); continue; }
            sector.validcount = view.validcount; sector.soundtraversed = frame.soundblocks + 1; sector.soundtarget = soundtarget;
            frame.entered = true;
        }
        if (frame.line >= sector.linecount) { stack.pop(); continue; }
        const check = sector.lines[frame.line++];
        if (!(check.flags & ML_TWOSIDED)) continue;
        P_LineOpening(check); if (openings.openrange <= 0) continue;
        const other = mapstate.sides[check.sidenum[0]].sector === sector ? mapstate.sides[check.sidenum[1]].sector : mapstate.sides[check.sidenum[0]].sector;
        if (check.flags & ML_SOUNDBLOCK) {
            if (!frame.soundblocks) stack.push({sec:other,soundblocks:1,line:0,entered:false});
        } else stack.push({sec:other,soundblocks:frame.soundblocks,line:0,entered:false});
    }
}
export function P_NoiseAlert(target: mobj_t, emitter: mobj_t): void {
    soundtarget = target; view.validcount = (view.validcount + 1) | 0; P_RecursiveSound(emitter.subsector!.sector!,0);
}
export function A_OpenShotgun2(player: player_t, _psp: pspdef_t): void { sound(player,SFX.sfx_dbopn); }
export function A_LoadShotgun2(player: player_t, _psp: pspdef_t): void { sound(player,SFX.sfx_dbload); }
export function A_CloseShotgun2(player: player_t, psp: pspdef_t): void { sound(player,SFX.sfx_dbcls); A_ReFire(player,psp); }
export const reloadStateActions = Object.freeze({A_OpenShotgun2,A_LoadShotgun2,A_CloseShotgun2}) as unknown as Readonly<Record<string,actionf_p2>>;
export function A_Scream(actor:mobj_t):void {
    let sfx=actor.info!.deathsound;if(!sfx)return;
    if(sfx===SFX.sfx_podth1||sfx===SFX.sfx_podth2||sfx===SFX.sfx_podth3)sfx=SFX.sfx_podth1+P_Random()%3;
    else if(sfx===SFX.sfx_bgdth1||sfx===SFX.sfx_bgdth2)sfx=SFX.sfx_bgdth1+P_Random()%2;
    if(!context)throw new Error('P_InitEnemyContext: sound is not linked');
    if(actor.type===MT.MT_SPIDER||actor.type===MT.MT_CYBORG){if(!context.S_StartGlobalSound)throw new Error('Global death sound is not linked');context.S_StartGlobalSound(sfx);}
    else context.S_StartSound(actor,sfx);
}
export function A_XScream(actor:mobj_t):void {if(!context)throw new Error('P_InitEnemyContext: sound is not linked');context.S_StartSound(actor,SFX.sfx_slop);}
export function A_Pain(actor:mobj_t):void {if(actor.info!.painsound){if(!context)throw new Error('P_InitEnemyContext: sound is not linked');context.S_StartSound(actor,actor.info!.painsound);}}
export function A_Fall(actor:mobj_t):void {actor.flags&=~MF.MF_SOLID;}
export function A_Explode(actor:mobj_t):void {P_RadiusAttack(actor,actor.target,128);}
export function A_PlayerScream(actor:mobj_t):void {
    if(!context||context.gamemode===undefined)throw new Error('Player death sound context is not linked');
    context.S_StartSound(actor,context.gamemode===GameMode_t.commercial&&actor.health< -50?SFX.sfx_pdiehi:SFX.sfx_pldeth);
}
export const deathStateActions=Object.freeze({A_Scream,A_XScream,A_Pain,A_Fall,A_Explode,A_PlayerScream}) as unknown as Readonly<Record<string,actionf_p1>>;

export enum dirtype_t {DI_EAST,DI_NORTHEAST,DI_NORTH,DI_NORTHWEST,DI_WEST,DI_SOUTHWEST,DI_SOUTH,DI_SOUTHEAST,DI_NODIR,NUMDIRS}
const D=dirtype_t;
export const opposite=[D.DI_WEST,D.DI_SOUTHWEST,D.DI_SOUTH,D.DI_SOUTHEAST,D.DI_EAST,D.DI_NORTHEAST,D.DI_NORTH,D.DI_NORTHWEST,D.DI_NODIR];
export const diags=[D.DI_NORTHWEST,D.DI_NORTHEAST,D.DI_SOUTHWEST,D.DI_SOUTHEAST];
export const xspeed=new Int32Array([F,47000,0,-47000,-F,-47000,0,47000]),yspeed=new Int32Array([0,47000,F,47000,0,-47000,-F,-47000]);
export function P_CheckMeleeRange(actor:mobj_t):boolean {
    if(!actor.target)return false;
    return P_AproxDistance((actor.target.x-actor.x)|0,(actor.target.y-actor.y)|0)<MELEERANGE-20*F+actor.target.info!.radius&&P_CheckSight(actor,actor.target);
}
export function P_CheckMissileRange(actor:mobj_t):boolean {
    if(!P_CheckSight(actor,actor.target!))return false;
    if(actor.flags&MF.MF_JUSTHIT){actor.flags&=~MF.MF_JUSTHIT;return true;}
    if(actor.reactiontime)return false;
    let dist=(P_AproxDistance((actor.x-actor.target!.x)|0,(actor.y-actor.target!.y)|0)-64*F)|0;
    if(!actor.info!.meleestate)dist=(dist-128*F)|0;dist>>=16;
    if(actor.type===MT.MT_VILE&&dist>14*64)return false;
    if(actor.type===MT.MT_UNDEAD){if(dist<196)return false;dist>>=1;}
    if(actor.type===MT.MT_CYBORG||actor.type===MT.MT_SPIDER||actor.type===MT.MT_SKULL)dist>>=1;
    dist=Math.min(dist,actor.type===MT.MT_CYBORG?160:200);return P_Random()>=dist;
}
export function P_Move(actor:mobj_t):boolean {
    if(actor.movedir===D.DI_NODIR)return false;if((actor.movedir>>>0)>=8)throw new Error('Weird actor->movedir');
    if(!P_TryMove(actor,(actor.x+Math.imul(actor.info!.speed,xspeed[actor.movedir]))|0,(actor.y+Math.imul(actor.info!.speed,yspeed[actor.movedir]))|0)) {
        if((actor.flags&MF.MF_FLOAT)&&mapclip.floatok){actor.z=(actor.z+(actor.z<mapclip.tmfloorz?FLOATSPEED:-FLOATSPEED))|0;actor.flags|=MF.MF_INFLOAT;return true;}
        if(!mapclip.numspechit)return false;actor.movedir=D.DI_NODIR;let good=false;
        while(mapclip.numspechit-->0)if(gameplay().P_UseSpecialLine(actor,mapclip.spechit[mapclip.numspechit],0))good=true;return good;
    }
    actor.flags&=~MF.MF_INFLOAT;if(!(actor.flags&MF.MF_FLOAT))actor.z=actor.floorz;return true;
}
export function P_TryWalk(actor:mobj_t):boolean {if(!P_Move(actor))return false;actor.movecount=P_Random()&15;return true;}
export function P_NewChaseDir(actor:mobj_t):void {
    if(!actor.target)throw new Error('P_NewChaseDir: called with no target');
    const olddir=actor.movedir,turnaround=opposite[olddir],dx=(actor.target.x-actor.x)|0,dy=(actor.target.y-actor.y)|0;
    let d1=dx>10*F?D.DI_EAST:dx< -10*F?D.DI_WEST:D.DI_NODIR,d2=dy< -10*F?D.DI_SOUTH:dy>10*F?D.DI_NORTH:D.DI_NODIR;
    if(d1!==D.DI_NODIR&&d2!==D.DI_NODIR){actor.movedir=diags[(+ (dy<0)<<1)+ +(dx>0)];if(actor.movedir!==turnaround&&P_TryWalk(actor))return;}
    if(P_Random()>200||Math.abs(dy)>Math.abs(dx))[d1,d2]=[d2,d1];
    if(d1===turnaround)d1=D.DI_NODIR;if(d2===turnaround)d2=D.DI_NODIR;
    for(const dir of [d1,d2,olddir])if(dir!==D.DI_NODIR){actor.movedir=dir;if(P_TryWalk(actor))return;}
    const forward=P_Random()&1;
    for(let i=0;i<8;i++){const dir=forward?i:7-i;if(dir!==turnaround){actor.movedir=dir;if(P_TryWalk(actor))return;}}
    if(turnaround!==D.DI_NODIR){actor.movedir=turnaround;if(P_TryWalk(actor))return;}actor.movedir=D.DI_NODIR;
}
export function P_LookForPlayers(actor:mobj_t,allaround:boolean):boolean {
    const g=gameplay();if(!g.playeringame.some(Boolean))return false; // C otherwise spins forever.
    let count=0;const stop=(actor.lastlook-1)&3;
    for(;;actor.lastlook=(actor.lastlook+1)&3) {
        if(!g.playeringame[actor.lastlook])continue;
        if(count++===2||actor.lastlook===stop)return false;
        const p=g.players[actor.lastlook];if(p.health<=0||!P_CheckSight(actor,p.mo!))continue;
        if(!allaround){const an=(R_PointToAngle2(actor.x,actor.y,p.mo!.x,p.mo!.y)-actor.angle)>>>0;
            if(an>ANG90&&an<ANG270&&P_AproxDistance((p.mo!.x-actor.x)|0,(p.mo!.y-actor.y)|0)>MELEERANGE)continue;}
        actor.target=p.mo;return true;
    }
}
export function A_KeenDie(mo:mobj_t):void {A_Fall(mo);for(const other of actors())if(other!==mo&&other.type===mo.type&&other.health>0)return;gameplay().EV_DoDoor({tag:666},vldoor_e.open);}
export function A_Look(actor:mobj_t):void {
    actor.threshold=0;const targ=actor.subsector!.sector!.soundtarget;let seen=false;
    if(targ&&(targ.flags&MF.MF_SHOOTABLE)){actor.target=targ;seen=!(actor.flags&MF.MF_AMBUSH)||P_CheckSight(actor,targ);}
    if(!seen&&!P_LookForPlayers(actor,false))return;
    let sfx=actor.info!.seesound;
    if(sfx){if(sfx===SFX.sfx_posit1||sfx===SFX.sfx_posit2||sfx===SFX.sfx_posit3)sfx=SFX.sfx_posit1+P_Random()%3;
        else if(sfx===SFX.sfx_bgsit1||sfx===SFX.sfx_bgsit2)sfx=SFX.sfx_bgsit1+P_Random()%2;
        if(actor.type===MT.MT_SPIDER||actor.type===MT.MT_CYBORG)globalSound(sfx);else play(actor,sfx);}
    P_SetMobjState(actor,actor.info!.seestate);
}
export function A_Chase(actor:mobj_t):void {
    const g=gameplay();if(actor.reactiontime)actor.reactiontime--;
    if(actor.threshold){if(!actor.target||actor.target.health<=0)actor.threshold=0;else actor.threshold--;}
    if(actor.movedir<8){actor.angle=(actor.angle&(7<<29))>>>0;const delta=(actor.angle-(actor.movedir<<29))|0;
        if(delta>0)actor.angle=(actor.angle-ANG90/2)>>>0;else if(delta<0)actor.angle=(actor.angle+ANG90/2)>>>0;}
    if(!actor.target||!(actor.target.flags&MF.MF_SHOOTABLE)){if(P_LookForPlayers(actor,true))return;P_SetMobjState(actor,actor.info!.spawnstate);return;}
    if(actor.flags&MF.MF_JUSTATTACKED){actor.flags&=~MF.MF_JUSTATTACKED;if(g.gameskill!==skill_t.sk_nightmare&&!g.fastparm)P_NewChaseDir(actor);return;}
    if(actor.info!.meleestate&&P_CheckMeleeRange(actor)){if(actor.info!.attacksound)play(actor,actor.info!.attacksound);P_SetMobjState(actor,actor.info!.meleestate);return;}
    if(actor.info!.missilestate&&!(g.gameskill<skill_t.sk_nightmare&&!g.fastparm&&actor.movecount)&&P_CheckMissileRange(actor)) {
        P_SetMobjState(actor,actor.info!.missilestate);actor.flags|=MF.MF_JUSTATTACKED;return;
    }
    if(g.netgame&&!actor.threshold&&!P_CheckSight(actor,actor.target)&&P_LookForPlayers(actor,true))return;
    actor.movecount=(actor.movecount-1)|0;if(actor.movecount<0||!P_Move(actor))P_NewChaseDir(actor);
    if(actor.info!.activesound&&P_Random()<3)play(actor,actor.info!.activesound);
}
export function A_FaceTarget(actor:mobj_t):void {
    if(!actor.target)return;actor.flags&=~MF.MF_AMBUSH;actor.angle=R_PointToAngle2(actor.x,actor.y,actor.target.x,actor.target.y);
    if(actor.target.flags&MF.MF_SHADOW)actor.angle=(actor.angle+((P_Random()-P_Random())<<21))>>>0;
}
export function A_PosAttack(actor:mobj_t):void {
    if(!actor.target)return;A_FaceTarget(actor);let angle=actor.angle;const slope=P_AimLineAttack(actor,angle,MISSILERANGE);
    play(actor,SFX.sfx_pistol);angle=(angle+((P_Random()-P_Random())<<20))>>>0;const damage=(P_Random()%5+1)*3;P_LineAttack(actor,angle,MISSILERANGE,slope,damage);
}
export function A_SPosAttack(actor:mobj_t):void {
    if(!actor.target)return;play(actor,SFX.sfx_shotgn);A_FaceTarget(actor);const angle=actor.angle,slope=P_AimLineAttack(actor,angle,MISSILERANGE);
    for(let i=0;i<3;i++){const an=(angle+((P_Random()-P_Random())<<20))>>>0,damage=(P_Random()%5+1)*3;P_LineAttack(actor,an,MISSILERANGE,slope,damage);}
}
export function A_CPosAttack(actor:mobj_t):void {
    if(!actor.target)return;play(actor,SFX.sfx_shotgn);A_FaceTarget(actor);const angle=actor.angle,slope=P_AimLineAttack(actor,angle,MISSILERANGE);
    const an=(angle+((P_Random()-P_Random())<<20))>>>0,damage=(P_Random()%5+1)*3;P_LineAttack(actor,an,MISSILERANGE,slope,damage);
}
export function A_CPosRefire(actor:mobj_t):void {A_FaceTarget(actor);if(P_Random()<40)return;if(!actor.target||actor.target.health<=0||!P_CheckSight(actor,actor.target))P_SetMobjState(actor,actor.info!.seestate);}
export function A_SpidRefire(actor:mobj_t):void {A_FaceTarget(actor);if(P_Random()<10)return;if(!actor.target||actor.target.health<=0||!P_CheckSight(actor,actor.target))P_SetMobjState(actor,actor.info!.seestate);}
export function A_BspiAttack(actor:mobj_t):void {if(!actor.target)return;A_FaceTarget(actor);P_SpawnMissile(actor,actor.target,MT.MT_ARACHPLAZ);}
export function A_TroopAttack(actor:mobj_t):void {
    if(!actor.target)return;A_FaceTarget(actor);if(P_CheckMeleeRange(actor)){play(actor,SFX.sfx_claw);P_DamageMobj(actor.target,actor,actor,(P_Random()%8+1)*3);return;}
    P_SpawnMissile(actor,actor.target,MT.MT_TROOPSHOT);
}
export function A_SargAttack(actor:mobj_t):void {if(!actor.target)return;A_FaceTarget(actor);if(P_CheckMeleeRange(actor))P_DamageMobj(actor.target,actor,actor,(P_Random()%10+1)*4);}
export function A_HeadAttack(actor:mobj_t):void {
    if(!actor.target)return;A_FaceTarget(actor);if(P_CheckMeleeRange(actor)){P_DamageMobj(actor.target,actor,actor,(P_Random()%6+1)*10);return;}P_SpawnMissile(actor,actor.target,MT.MT_HEADSHOT);
}
export function A_CyberAttack(actor:mobj_t):void {if(!actor.target)return;A_FaceTarget(actor);P_SpawnMissile(actor,actor.target,MT.MT_ROCKET);}
export function A_BruisAttack(actor:mobj_t):void {
    if(!actor.target)return;if(P_CheckMeleeRange(actor)){play(actor,SFX.sfx_claw);P_DamageMobj(actor.target,actor,actor,(P_Random()%8+1)*10);return;}P_SpawnMissile(actor,actor.target,MT.MT_BRUISERSHOT);
}
export function A_SkelMissile(actor:mobj_t):void {
    if(!actor.target)return;A_FaceTarget(actor);actor.z=(actor.z+16*F)|0;const mo=P_SpawnMissile(actor,actor.target,MT.MT_TRACER);actor.z=(actor.z-16*F)|0;
    mo.x=(mo.x+mo.momx)|0;mo.y=(mo.y+mo.momy)|0;mo.tracer=actor.target;
}
export const TRACEANGLE=0xc000000;
export function A_Tracer(actor:mobj_t):void {
    if(gameplay().gametic&3)return;P_SpawnPuff(actor.x,actor.y,actor.z);
    const smoke=P_SpawnMobj((actor.x-actor.momx)|0,(actor.y-actor.momy)|0,actor.z,MT.MT_SMOKE);smoke.momz=F;smoke.tics-=P_Random()&3;if(smoke.tics<1)smoke.tics=1;
    const dest=actor.tracer;if(!dest||dest.health<=0)return;let exact=R_PointToAngle2(actor.x,actor.y,dest.x,dest.y);
    if(exact!==actor.angle){if(((exact-actor.angle)>>>0)>0x80000000){actor.angle=(actor.angle-TRACEANGLE)>>>0;if(((exact-actor.angle)>>>0)<0x80000000)actor.angle=exact;}
        else {actor.angle=(actor.angle+TRACEANGLE)>>>0;if(((exact-actor.angle)>>>0)>0x80000000)actor.angle=exact;}}
    exact=actor.angle>>>ANGLETOFINESHIFT;actor.momx=FixedMul(actor.info!.speed,finecosine[exact]);actor.momy=FixedMul(actor.info!.speed,finesine[exact]);
    const dist=Math.max(1,Math.trunc(P_AproxDistance((dest.x-actor.x)|0,(dest.y-actor.y)|0)/actor.info!.speed));
    const slope=Math.trunc(((dest.z+40*F-actor.z)|0)/dist);actor.momz=(actor.momz+(slope<actor.momz?-F/8:F/8))|0;
}
export function A_SkelWhoosh(actor:mobj_t):void {if(!actor.target)return;A_FaceTarget(actor);play(actor,SFX.sfx_skeswg);}
export function A_SkelFist(actor:mobj_t):void {if(!actor.target)return;A_FaceTarget(actor);if(P_CheckMeleeRange(actor)){const damage=(P_Random()%10+1)*6;play(actor,SFX.sfx_skepch);P_DamageMobj(actor.target,actor,actor,damage);}}

export const vile={corpsehit:null as mobj_t|null,vileobj:null as mobj_t|null,viletryx:0,viletryy:0};
export function PIT_VileCheck(thing:mobj_t):boolean {
    if(!(thing.flags&MF.MF_CORPSE)||thing.tics!==-1||thing.info!.raisestate===S.S_NULL)return true;
    const maxdist=thing.info!.radius+mobjinfo[MT.MT_VILE].radius;
    if(Math.abs((thing.x-vile.viletryx)|0)>maxdist||Math.abs((thing.y-vile.viletryy)|0)>maxdist)return true;
    vile.corpsehit=thing;thing.momx=thing.momy=0;thing.height<<=2;const fits=P_CheckPosition(thing,thing.x,thing.y);thing.height>>=2;return !fits;
}
export function A_VileChase(actor:mobj_t):void {
    if(actor.movedir!==D.DI_NODIR){vile.viletryx=(actor.x+Math.imul(actor.info!.speed,xspeed[actor.movedir]))|0;vile.viletryy=(actor.y+Math.imul(actor.info!.speed,yspeed[actor.movedir]))|0;
        const xl=(vile.viletryx-mapstate.bmaporgx-MAXRADIUS*2)>>MAPBLOCKSHIFT,xh=(vile.viletryx-mapstate.bmaporgx+MAXRADIUS*2)>>MAPBLOCKSHIFT;
        const yl=(vile.viletryy-mapstate.bmaporgy-MAXRADIUS*2)>>MAPBLOCKSHIFT,yh=(vile.viletryy-mapstate.bmaporgy+MAXRADIUS*2)>>MAPBLOCKSHIFT;vile.vileobj=actor;
        for(let x=xl;x<=xh;x++)for(let y=yl;y<=yh;y++)if(!P_BlockThingsIterator(x,y,PIT_VileCheck)) {
            const corpse=vile.corpsehit!,oldtarget=actor.target;actor.target=corpse;A_FaceTarget(actor);actor.target=oldtarget;
            P_SetMobjState(actor,S.S_VILE_HEAL1);play(corpse,SFX.sfx_slop);const info=corpse.info!;
            P_SetMobjState(corpse,info.raisestate);corpse.height<<=2;corpse.flags=info.flags;corpse.health=info.spawnhealth;corpse.target=null;return;
        }
    }A_Chase(actor);
}
export function A_VileStart(actor:mobj_t):void {play(actor,SFX.sfx_vilatk);}
export function A_StartFire(actor:mobj_t):void {play(actor,SFX.sfx_flamst);A_Fire(actor);}
export function A_FireCrackle(actor:mobj_t):void {play(actor,SFX.sfx_flame);A_Fire(actor);}
export function A_Fire(actor:mobj_t):void {
    const dest=actor.tracer;if(!dest||!P_CheckSight(actor.target!,dest))return;const an=dest.angle>>>ANGLETOFINESHIFT;
    P_UnsetThingPosition(actor);actor.x=(dest.x+FixedMul(24*F,finecosine[an]))|0;actor.y=(dest.y+FixedMul(24*F,finesine[an]))|0;actor.z=dest.z;P_SetThingPosition(actor);
}
export function A_VileTarget(actor:mobj_t):void {
    if(!actor.target)return;A_FaceTarget(actor);
    // Original passes target.x for both coordinates before A_Fire relocates the flame.
    const fog=P_SpawnMobj(actor.target.x,actor.target.x,actor.target.z,MT.MT_FIRE);actor.tracer=fog;fog.target=actor;fog.tracer=actor.target;A_Fire(fog);
}
export function A_VileAttack(actor:mobj_t):void {
    if(!actor.target)return;A_FaceTarget(actor);if(!P_CheckSight(actor,actor.target))return;
    play(actor,SFX.sfx_barexp);P_DamageMobj(actor.target,actor,actor,20);actor.target.momz=Math.trunc(1000*F/actor.target.info!.mass)|0;
    const an=actor.angle>>>ANGLETOFINESHIFT,fire=actor.tracer;if(!fire)return;
    fire.x=(actor.target.x-FixedMul(24*F,finecosine[an]))|0;fire.y=(actor.target.y-FixedMul(24*F,finesine[an]))|0;P_RadiusAttack(fire,actor,70);
}
const FATSPREAD=ANG90/8;
export function A_FatRaise(actor:mobj_t):void {A_FaceTarget(actor);play(actor,SFX.sfx_manatk);}
function setMissileAngle(mo:mobj_t,delta:number):void {mo.angle=(mo.angle+delta)>>>0;const an=mo.angle>>>ANGLETOFINESHIFT;mo.momx=FixedMul(mo.info!.speed,finecosine[an]);mo.momy=FixedMul(mo.info!.speed,finesine[an]);}
export function A_FatAttack1(actor:mobj_t):void {
    A_FaceTarget(actor);actor.angle=(actor.angle+FATSPREAD)>>>0;P_SpawnMissile(actor,actor.target!,MT.MT_FATSHOT);setMissileAngle(P_SpawnMissile(actor,actor.target!,MT.MT_FATSHOT),FATSPREAD);
}
export function A_FatAttack2(actor:mobj_t):void {
    A_FaceTarget(actor);actor.angle=(actor.angle-FATSPREAD)>>>0;P_SpawnMissile(actor,actor.target!,MT.MT_FATSHOT);setMissileAngle(P_SpawnMissile(actor,actor.target!,MT.MT_FATSHOT),-FATSPREAD*2);
}
export function A_FatAttack3(actor:mobj_t):void {A_FaceTarget(actor);setMissileAngle(P_SpawnMissile(actor,actor.target!,MT.MT_FATSHOT),-FATSPREAD/2);setMissileAngle(P_SpawnMissile(actor,actor.target!,MT.MT_FATSHOT),FATSPREAD/2);}
const SKULLSPEED=20*F;
export function A_SkullAttack(actor:mobj_t):void {
    const dest=actor.target;if(!dest)return;actor.flags|=MF.MF_SKULLFLY;play(actor,actor.info!.attacksound);A_FaceTarget(actor);
    const an=actor.angle>>>ANGLETOFINESHIFT;actor.momx=FixedMul(SKULLSPEED,finecosine[an]);actor.momy=FixedMul(SKULLSPEED,finesine[an]);
    const dist=Math.max(1,Math.trunc(P_AproxDistance((dest.x-actor.x)|0,(dest.y-actor.y)|0)/SKULLSPEED));actor.momz=Math.trunc(((dest.z+(dest.height>>1)-actor.z)|0)/dist)|0;
}
export function A_PainShootSkull(actor:mobj_t,angle:number):void {
    let count=0;for(const mo of actors())if(mo.type===MT.MT_SKULL)count++;if(count>20)return;
    const an=angle>>>ANGLETOFINESHIFT,prestep=(4*F+Math.trunc(3*(actor.info!.radius+mobjinfo[MT.MT_SKULL].radius)/2))|0;
    const mo=P_SpawnMobj((actor.x+FixedMul(prestep,finecosine[an]))|0,(actor.y+FixedMul(prestep,finesine[an]))|0,(actor.z+8*F)|0,MT.MT_SKULL);
    if(!P_TryMove(mo,mo.x,mo.y)){P_DamageMobj(mo,actor,actor,10000);return;}mo.target=actor.target;A_SkullAttack(mo);
}
export function A_PainAttack(actor:mobj_t):void {if(!actor.target)return;A_FaceTarget(actor);A_PainShootSkull(actor,actor.angle);}
export function A_PainDie(actor:mobj_t):void {A_Fall(actor);A_PainShootSkull(actor,(actor.angle+ANG90)>>>0);A_PainShootSkull(actor,(actor.angle+ANG180)>>>0);A_PainShootSkull(actor,(actor.angle+ANG270)>>>0);}
export function A_BossDeath(mo:mobj_t):void {
    const g=gameplay(),mode=context?.gamemode;if(mode===undefined)throw new Error('Boss gamemode is not linked');
    if(mode===GameMode_t.commercial){if(g.gamemap!==7||(mo.type!==MT.MT_FATSO&&mo.type!==MT.MT_BABY))return;}
    else switch(g.gameepisode){
        case 1:if(g.gamemap!==8||mo.type!==MT.MT_BRUISER)return;break;
        case 2:if(g.gamemap!==8||mo.type!==MT.MT_CYBORG)return;break;
        case 3:if(g.gamemap!==8||mo.type!==MT.MT_SPIDER)return;break;
        case 4:if(g.gamemap===6){if(mo.type!==MT.MT_CYBORG)return;}else if(g.gamemap===8){if(mo.type!==MT.MT_SPIDER)return;}else return;break;
        default:if(g.gamemap!==8)return;
    }
    if(!g.playeringame.some((active,i)=>active&&g.players[i].health>0))return;
    for(const other of actors())if(other!==mo&&other.type===mo.type&&other.health>0)return;
    if(mode===GameMode_t.commercial&&g.gamemap===7){g.EV_DoFloor({tag:mo.type===MT.MT_FATSO?666:667},mo.type===MT.MT_FATSO?floor_e.lowerFloorToLowest:floor_e.raiseToTexture);return;}
    if(mode!==GameMode_t.commercial){
        if(g.gameepisode===1){g.EV_DoFloor({tag:666},floor_e.lowerFloorToLowest);return;}
        if(g.gameepisode===4){if(g.gamemap===6)g.EV_DoDoor({tag:666},vldoor_e.blazeOpen);else g.EV_DoFloor({tag:666},floor_e.lowerFloorToLowest);return;}
    }g.G_ExitLevel();
}
export function A_Hoof(mo:mobj_t):void {play(mo,SFX.sfx_hoof);A_Chase(mo);}
export function A_Metal(mo:mobj_t):void {play(mo,SFX.sfx_metal);A_Chase(mo);}
export function A_BabyMetal(mo:mobj_t):void {play(mo,SFX.sfx_bspwlk);A_Chase(mo);}
export const brain={braintargets:[] as mobj_t[],numbraintargets:0,braintargeton:0,easy:0};
export function A_BrainAwake(_mo:mobj_t):void {
    brain.numbraintargets=brain.braintargeton=0;brain.braintargets.length=0;
    for(const mo of actors())if(mo.type===MT.MT_BOSSTARGET){if(brain.numbraintargets>=32)throw new Error('A_BrainAwake: braintargets overflow');brain.braintargets[brain.numbraintargets++]=mo;}globalSound(SFX.sfx_bossit);
}
export function A_BrainPain(_mo:mobj_t):void {globalSound(SFX.sfx_bospn);}
export function A_BrainScream(mo:mobj_t):void {
    for(let x=(mo.x-196*F)|0;x<mo.x+320*F;x=(x+8*F)|0){const y=(mo.y-320*F)|0,z=(128+P_Random()*2*F)|0,th=P_SpawnMobj(x,y,z,MT.MT_ROCKET);
        th.momz=P_Random()*512;P_SetMobjState(th,S.S_BRAINEXPLODE1);th.tics-=P_Random()&7;if(th.tics<1)th.tics=1;}globalSound(SFX.sfx_bosdth);
}
export function A_BrainExplode(mo:mobj_t):void {
    const x=(mo.x+(P_Random()-P_Random())*2048)|0,z=(128+P_Random()*2*F)|0,th=P_SpawnMobj(x,mo.y,z,MT.MT_ROCKET);
    th.momz=P_Random()*512;P_SetMobjState(th,S.S_BRAINEXPLODE1);th.tics-=P_Random()&7;if(th.tics<1)th.tics=1;
}
export function A_BrainDie(_mo:mobj_t):void {gameplay().G_ExitLevel();}
export function A_BrainSpit(mo:mobj_t):void {
    brain.easy^=1;if(gameplay().gameskill<=skill_t.sk_easy&&!brain.easy)return;
    if(!brain.numbraintargets)throw new Error('A_BrainSpit: no brain target');const targ=brain.braintargets[brain.braintargeton];brain.braintargeton=(brain.braintargeton+1)%brain.numbraintargets;
    const shot=P_SpawnMissile(mo,targ,MT.MT_SPAWNSHOT);shot.target=targ;
    if(!shot.momy||!shot.state!.tics)throw new Error('A_BrainSpit: invalid cube travel time');
    shot.reactiontime=Math.trunc(Math.trunc(((targ.y-mo.y)|0)/shot.momy)/shot.state!.tics)|0;globalSound(SFX.sfx_bospit);
}
export function A_SpawnSound(mo:mobj_t):void {play(mo,SFX.sfx_boscub);A_SpawnFly(mo);}
export function A_SpawnFly(mo:mobj_t):void {
    mo.reactiontime=(mo.reactiontime-1)|0;if(mo.reactiontime)return;const target=mo.target!;
    const fog=P_SpawnMobj(target.x,target.y,target.z,MT.MT_SPAWNFIRE);play(fog,SFX.sfx_telept);const r=P_Random();
    const type=r<50?MT.MT_TROOP:r<90?MT.MT_SERGEANT:r<120?MT.MT_SHADOWS:r<130?MT.MT_PAIN:r<160?MT.MT_HEAD:r<162?MT.MT_VILE:r<172?MT.MT_UNDEAD:r<192?MT.MT_BABY:r<222?MT.MT_FATSO:r<246?MT.MT_KNIGHT:MT.MT_BRUISER;
    const spawned=P_SpawnMobj(target.x,target.y,target.z,type);if(P_LookForPlayers(spawned,true))P_SetMobjState(spawned,spawned.info!.seestate);
    P_TeleportMove(spawned,spawned.x,spawned.y);P_RemoveMobj(mo);
}
export const enemyStateActions=Object.freeze({ ...reloadStateActions,...deathStateActions,
    A_KeenDie,A_Look,A_Chase,A_FaceTarget,A_PosAttack,A_SPosAttack,A_CPosAttack,A_CPosRefire,A_SpidRefire,A_BspiAttack,A_TroopAttack,A_SargAttack,A_HeadAttack,A_CyberAttack,A_BruisAttack,
    A_SkelMissile,A_Tracer,A_SkelWhoosh,A_SkelFist,A_VileChase,A_VileStart,A_StartFire,A_FireCrackle,A_Fire,A_VileTarget,A_VileAttack,A_FatRaise,A_FatAttack1,A_FatAttack2,A_FatAttack3,
    A_SkullAttack,A_PainAttack,A_PainDie,A_BossDeath,A_Hoof,A_Metal,A_BabyMetal,A_BrainAwake,A_BrainPain,A_BrainScream,A_BrainExplode,A_BrainDie,A_BrainSpit,A_SpawnSound,A_SpawnFly
}) as Readonly<Record<string,actionf_p1|actionf_p2>>;
