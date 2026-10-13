// Copyright (C) 1993-1996 id Software, Inc. GPL-2.0-only.
import { skill_t, card_t, MAXPLAYERS, MTF_AMBUSH } from './doomdef.h';
import { playerstate_t, cheat_t, type player_t } from './d_player.h';
import { mobjflag_t as MF, type mobj_t } from './p_mobj.h';
import { mobjtype_t as MT, statenum_t as S } from './info.h';
import { mobjinfo, states } from './info';
import { FRACBITS, FRACUNIT } from './m_fixed.h';
import { FixedMul } from './m_fixed';
import { P_Random } from './m_random';
import { ANG45, ANGLETOFINESHIFT, finecosine, finesine } from './tables.h';
import { R_PointInSubsector, R_PointToAngle2 } from './r_main';
import { sky } from './r_sky';
import { sfxenum_t } from './sounds.h';
import type { mapthing_t } from './doomdata.h';
import type { line_t } from './r_defs.h';
import type { thinker_t } from './d_think.h';
import { P_SetThingPosition, P_UnsetThingPosition, P_AproxDistance } from './p_maputl';
import { P_AddThinker, P_RemoveThinker, leveltime } from './p_tick';
import { FLOATSPEED, VIEWHEIGHT, GRAVITY, MAXMOVE, MELEERANGE, ONFLOORZ, ONCEILINGZ, ITEMQUESIZE } from './p_local.h';

// doomstat and unconverted collision, weapon, sound and UI dependencies are explicit.
// These callbacks must implement the actual subsystems; none default to successful/no-op behavior.
export interface mobj_context_t {
    gameskill: skill_t; deathmatch: number; netgame: boolean; nomonsters: boolean; respawnmonsters: boolean;
    players: player_t[]; playeringame: boolean[]; consoleplayer: number;
    playerstarts: mapthing_t[]; deathmatchstarts: mapthing_t[]; totalkills: number; totalitems: number;
    ceilingline: line_t | null; linetarget: mobj_t | null; attackrange: number;
    P_TryMove(mobj: mobj_t, x: number, y: number): boolean;
    P_CheckPosition(mobj: mobj_t, x: number, y: number): boolean;
    P_SlideMove(mobj: mobj_t): void;
    P_AimLineAttack(source: mobj_t, angle: number, distance: number): number;
    S_StartSound(origin: mobj_t, sound: sfxenum_t): void;
    S_StopSound(origin: mobj_t): void;
    G_PlayerReborn(player: number): void;
    P_SetupPsprites(player: player_t): void;
    ST_Start(): void;
    HU_Start(): void;
}
let context: mobj_context_t | null = null;
export function P_InitMobjContext(game: mobj_context_t): void { context = game; }
function game(): mobj_context_t { if (!context) throw new Error('P_InitMobjContext: gameplay dependencies are not linked'); return context; }
const owners = new WeakMap<thinker_t, mobj_t>();
// Explicit equivalent of C's cast from the initial thinker field to its enclosing actor.
export function P_MobjForThinker(thinker:thinker_t):mobj_t|null {return owners.get(thinker)??null;}
export const itemrespawnque: mapthing_t[] = Array.from({length:ITEMQUESIZE},()=>({x:0,y:0,angle:0,type:0,options:0}));
export const itemrespawntime = new Int32Array(ITEMQUESIZE);
export let iquehead = 0, iquetail = 0;
// Level setup resets queue indices in C; this extra boundary permits assigning ES bindings.
export function P_ResetItemRespawnQueue(): void { iquehead = iquetail = 0; }

export function P_SetMobjState(mobj: mobj_t, state: S): boolean {
    let transitions = 0;
    do {
        if (state === S.S_NULL) { mobj.state = null; P_RemoveMobj(mobj); return false; }
        const st = states[state]; if (!st) throw new Error(`P_SetMobjState: invalid state ${state}`);
        mobj.state = st; mobj.tics = st.tics; mobj.sprite = st.sprite; mobj.frame = st.frame;
        if (st.action) {
            if (typeof st.action !== 'function') throw new Error('Invalid state action');
            (st.action as (actor: mobj_t) => void)(mobj);
        }
        state = st.nextstate;
        if (++transitions > 10000 && !mobj.tics) throw new Error('P_SetMobjState: runaway zero-tic state chain');
    } while (!mobj.tics);
    return true;
}
export function P_ExplodeMissile(mo: mobj_t): void {
    mo.momx = mo.momy = mo.momz = 0;
    P_SetMobjState(mo, mobjinfo[mo.type].deathstate);
    mo.tics -= P_Random() & 3; if (mo.tics < 1) mo.tics = 1;
    mo.flags &= ~MF.MF_MISSILE;
    if (mo.info!.deathsound) game().S_StartSound(mo, mo.info!.deathsound);
}
const STOPSPEED = 0x1000, FRICTION = 0xe800;
export function P_XYMovement(mo: mobj_t): void {
    if (!mo.momx && !mo.momy) {
        if (mo.flags & MF.MF_SKULLFLY) {
            mo.flags &= ~MF.MF_SKULLFLY; mo.momx = mo.momy = mo.momz = 0;
            P_SetMobjState(mo, mo.info!.spawnstate);
        }
        return;
    }
    const g = game(), player = mo.player;
    mo.momx = Math.max(-MAXMOVE, Math.min(MAXMOVE, mo.momx)); mo.momy = Math.max(-MAXMOVE, Math.min(MAXMOVE, mo.momy));
    let xmove = mo.momx, ymove = mo.momy;
    do {
        let ptryx: number, ptryy: number;
        // Original asymmetry: only positive movement triggers subdivision; /2 truncates toward zero.
        if (xmove > MAXMOVE / 2 || ymove > MAXMOVE / 2) {
            ptryx = (mo.x + Math.trunc(xmove / 2)) | 0; ptryy = (mo.y + Math.trunc(ymove / 2)) | 0;
            xmove >>= 1; ymove >>= 1;
        } else { ptryx = (mo.x + xmove) | 0; ptryy = (mo.y + ymove) | 0; xmove = ymove = 0; }
        if (!g.P_TryMove(mo, ptryx, ptryy)) {
            if (mo.player) g.P_SlideMove(mo);
            else if (mo.flags & MF.MF_MISSILE) {
                if (g.ceilingline?.backsector && g.ceilingline.backsector.ceilingpic === sky.skyflatnum) { P_RemoveMobj(mo); return; }
                P_ExplodeMissile(mo);
            } else mo.momx = mo.momy = 0;
        }
    } while (xmove || ymove);
    if (player && (player.cheats & cheat_t.CF_NOMOMENTUM)) { mo.momx = mo.momy = 0; return; }
    if (mo.flags & (MF.MF_MISSILE | MF.MF_SKULLFLY)) return;
    if (mo.z > mo.floorz) return;
    if ((mo.flags & MF.MF_CORPSE) && (Math.abs(mo.momx) > FRACUNIT / 4 || Math.abs(mo.momy) > FRACUNIT / 4)
        && mo.floorz !== mo.subsector!.sector!.floorheight) return;
    if (mo.momx > -STOPSPEED && mo.momx < STOPSPEED && mo.momy > -STOPSPEED && mo.momy < STOPSPEED
        && (!player || (!player.cmd.forwardmove && !player.cmd.sidemove))) {
        if (player && ((states.indexOf(player.mo!.state!) - S.S_PLAY_RUN1) >>> 0) < 4) P_SetMobjState(player.mo!, S.S_PLAY);
        mo.momx = mo.momy = 0;
    } else { mo.momx = FixedMul(mo.momx, FRICTION); mo.momy = FixedMul(mo.momy, FRICTION); }
}
export function P_ZMovement(mo: mobj_t): void {
    if (mo.player && mo.z < mo.floorz) {
        mo.player.viewheight = (mo.player.viewheight - (mo.floorz - mo.z)) | 0;
        mo.player.deltaviewheight = (VIEWHEIGHT - mo.player.viewheight) >> 3;
    }
    mo.z = (mo.z + mo.momz) | 0;
    if ((mo.flags & MF.MF_FLOAT) && mo.target && !(mo.flags & (MF.MF_SKULLFLY | MF.MF_INFLOAT))) {
        const dist = P_AproxDistance((mo.x - mo.target.x) | 0, (mo.y - mo.target.y) | 0);
        const delta = (mo.target.z + (mo.height >> 1) - mo.z) | 0;
        if (delta < 0 && dist < -((delta * 3) | 0)) mo.z = (mo.z - FLOATSPEED) | 0;
        else if (delta > 0 && dist < ((delta * 3) | 0)) mo.z = (mo.z + FLOATSPEED) | 0;
    }
    if (mo.z <= mo.floorz) {
        if (mo.flags & MF.MF_SKULLFLY) mo.momz = (-mo.momz) | 0;
        if (mo.momz < 0) {
            if (mo.player && mo.momz < -GRAVITY * 8) { mo.player.deltaviewheight = mo.momz >> 3; game().S_StartSound(mo, sfxenum_t.sfx_oof); }
            mo.momz = 0;
        }
        mo.z = mo.floorz;
        if ((mo.flags & MF.MF_MISSILE) && !(mo.flags & MF.MF_NOCLIP)) { P_ExplodeMissile(mo); return; }
    } else if (!(mo.flags & MF.MF_NOGRAVITY)) mo.momz = mo.momz === 0 ? -GRAVITY * 2 : (mo.momz - GRAVITY) | 0;
    if (((mo.z + mo.height) | 0) > mo.ceilingz) {
        if (mo.momz > 0) mo.momz = 0;
        mo.z = (mo.ceilingz - mo.height) | 0;
        // Original order means an upward skull's momentum was already zeroed.
        if (mo.flags & MF.MF_SKULLFLY) mo.momz = (-mo.momz) | 0;
        if ((mo.flags & MF.MF_MISSILE) && !(mo.flags & MF.MF_NOCLIP)) { P_ExplodeMissile(mo); return; }
    }
}
export function P_NightmareRespawn(mobj: mobj_t): void {
    const g = game(), x = mobj.spawnpoint.x << FRACBITS, y = mobj.spawnpoint.y << FRACBITS;
    if (!g.P_CheckPosition(mobj, x, y)) return;
    let mo = P_SpawnMobj(mobj.x, mobj.y, mobj.subsector!.sector!.floorheight, MT.MT_TFOG); g.S_StartSound(mo, sfxenum_t.sfx_telept);
    const ss = R_PointInSubsector(x, y); mo = P_SpawnMobj(x, y, ss.sector!.floorheight, MT.MT_TFOG); g.S_StartSound(mo, sfxenum_t.sfx_telept);
    mo = P_SpawnMobj(x, y, mobj.info!.flags & MF.MF_SPAWNCEILING ? ONCEILINGZ : ONFLOORZ, mobj.type);
    mo.spawnpoint = {...mobj.spawnpoint}; mo.angle = (ANG45 * Math.trunc(mobj.spawnpoint.angle / 45)) >>> 0;
    if (mobj.spawnpoint.options & MTF_AMBUSH) mo.flags |= MF.MF_AMBUSH;
    mo.reactiontime = 18; P_RemoveMobj(mobj);
}
export function P_MobjThinker(argument: unknown): void {
    // C casts the initial thinker address to its enclosing mobj. Keep the shared function identity in TS.
    const mobj = owners.get(argument as thinker_t) ?? (argument && typeof argument === 'object' && 'thinker' in argument ? argument as mobj_t : null);
    if (!mobj) throw new Error('P_MobjThinker: no actor owns this thinker');
    if (mobj.momx || mobj.momy || (mobj.flags & MF.MF_SKULLFLY)) {
        P_XYMovement(mobj); if (mobj.thinker.function === -1) return;
    }
    if (mobj.z !== mobj.floorz || mobj.momz) { P_ZMovement(mobj); if (mobj.thinker.function === -1) return; }
    if (mobj.tics !== -1) {
        mobj.tics = (mobj.tics - 1) | 0;
        if (!mobj.tics && !P_SetMobjState(mobj, mobj.state!.nextstate)) return;
    } else {
        if (!(mobj.flags & MF.MF_COUNTKILL) || !game().respawnmonsters) return;
        mobj.movecount = (mobj.movecount + 1) | 0;
        if (mobj.movecount < 12 * 35 || (leveltime & 31) || P_Random() > 4) return;
        P_NightmareRespawn(mobj);
    }
}
export function P_SpawnMobj(x: number, y: number, z: number, type: MT): mobj_t {
    const g = game(), info = mobjinfo[type]; if (!info) throw new Error(`P_SpawnMobj: invalid type ${type}`);
    const st = states[info.spawnstate];
    const mobj: mobj_t = {
        thinker:{prev:null,next:null,function:null},x:x|0,y:y|0,z:0,snext:null,sprev:null,angle:0,sprite:st.sprite,frame:st.frame,
        bnext:null,bprev:null,subsector:null,floorz:0,ceilingz:0,radius:info.radius,height:info.height,momx:0,momy:0,momz:0,validcount:0,
        type,info,tics:st.tics,state:st,flags:info.flags,health:info.spawnhealth,movedir:0,movecount:0,target:null,
        reactiontime:g.gameskill === skill_t.sk_nightmare ? 0 : info.reactiontime,threshold:0,player:null,lastlook:P_Random()%MAXPLAYERS,
        spawnpoint:{x:0,y:0,angle:0,type:0,options:0},tracer:null
    };
    // Initial state actions do not execute at spawn, as in C.
    P_SetThingPosition(mobj); mobj.floorz = mobj.subsector!.sector!.floorheight; mobj.ceilingz = mobj.subsector!.sector!.ceilingheight;
    mobj.z = z === ONFLOORZ ? mobj.floorz : z === ONCEILINGZ ? (mobj.ceilingz - info.height) | 0 : z | 0;
    owners.set(mobj.thinker,mobj); mobj.thinker.function = P_MobjThinker; P_AddThinker(mobj.thinker);
    return mobj;
}
export function P_RemoveMobj(mobj: mobj_t): void {
    const g = game();
    if ((mobj.flags & MF.MF_SPECIAL) && !(mobj.flags & MF.MF_DROPPED) && mobj.type !== MT.MT_INV && mobj.type !== MT.MT_INS) {
        itemrespawnque[iquehead] = {...mobj.spawnpoint}; itemrespawntime[iquehead] = leveltime;
        iquehead = (iquehead + 1) & (ITEMQUESIZE - 1); if (iquehead === iquetail) iquetail = (iquetail + 1) & (ITEMQUESIZE - 1);
    }
    P_UnsetThingPosition(mobj); g.S_StopSound(mobj); P_RemoveThinker(mobj.thinker);
}
export function P_RespawnSpecials(): void {
    const g = game(); if (g.deathmatch !== 2 || iquehead === iquetail || ((leveltime - itemrespawntime[iquetail]) | 0) < 30 * 35) return;
    const mthing = itemrespawnque[iquetail], x = mthing.x << FRACBITS, y = mthing.y << FRACBITS;
    const ss = R_PointInSubsector(x, y), fog = P_SpawnMobj(x,y,ss.sector!.floorheight,MT.MT_IFOG); g.S_StartSound(fog,sfxenum_t.sfx_itmbk);
    const type = mobjinfo.findIndex(info=>info.doomednum === mthing.type);
    if (type < 0) throw new Error(`P_RespawnSpecials: unknown type ${mthing.type}`);
    const mo = P_SpawnMobj(x,y,mobjinfo[type].flags & MF.MF_SPAWNCEILING ? ONCEILINGZ : ONFLOORZ,type);
    mo.spawnpoint = {...mthing}; mo.angle = (ANG45 * Math.trunc(mthing.angle / 45)) >>> 0; iquetail = (iquetail + 1) & (ITEMQUESIZE - 1);
}
export function P_SpawnPlayer(mthing: mapthing_t): void {
    const g = game(), index = mthing.type - 1; if (!g.playeringame[index]) return;
    const p = g.players[index]; if (p.playerstate === playerstate_t.PST_REBORN) g.G_PlayerReborn(index);
    const mobj = P_SpawnMobj(mthing.x << FRACBITS,mthing.y << FRACBITS,ONFLOORZ,MT.MT_PLAYER);
    if (mthing.type > 1) mobj.flags |= (mthing.type - 1) << MF.MF_TRANSSHIFT;
    mobj.angle = (ANG45 * Math.trunc(mthing.angle / 45)) >>> 0; mobj.player = p; mobj.health = p.health;
    p.mo = mobj; p.playerstate = playerstate_t.PST_LIVE; p.refire = 0; p.message = null;
    p.damagecount = p.bonuscount = p.extralight = p.fixedcolormap = 0; p.viewheight = VIEWHEIGHT;
    g.P_SetupPsprites(p);
    if (g.deathmatch) for (let i = 0; i < card_t.NUMCARDS; i++) p.cards[i] = true;
    if (index === g.consoleplayer) { g.ST_Start(); g.HU_Start(); }
}
export function P_SpawnMapThing(mthing: mapthing_t): void {
    const g = game();
    if (mthing.type === 11) { if (g.deathmatchstarts.length < 10) g.deathmatchstarts.push({...mthing}); return; }
    if (mthing.type >= 1 && mthing.type <= 4) { g.playerstarts[mthing.type - 1] = {...mthing}; if (!g.deathmatch) P_SpawnPlayer(mthing); return; }
    if (!g.netgame && (mthing.options & 16)) return;
    const bit = g.gameskill === skill_t.sk_baby ? 1 : g.gameskill === skill_t.sk_nightmare ? 4 : 1 << (g.gameskill - 1);
    if (!(mthing.options & bit)) return;
    const type = mobjinfo.findIndex(info=>info.doomednum === mthing.type);
    if (type < 0) throw new Error(`P_SpawnMapThing: Unknown type ${mthing.type} at (${mthing.x}, ${mthing.y})`);
    if (g.deathmatch && (mobjinfo[type].flags & MF.MF_NOTDMATCH)) return;
    if (g.nomonsters && (type === MT.MT_SKULL || (mobjinfo[type].flags & MF.MF_COUNTKILL))) return;
    const mobj = P_SpawnMobj(mthing.x << FRACBITS,mthing.y << FRACBITS,mobjinfo[type].flags & MF.MF_SPAWNCEILING ? ONCEILINGZ : ONFLOORZ,type);
    mobj.spawnpoint = {...mthing}; if (mobj.tics > 0) mobj.tics = 1 + (P_Random() % mobj.tics);
    if (mobj.flags & MF.MF_COUNTKILL) g.totalkills++;
    if (mobj.flags & MF.MF_COUNTITEM) g.totalitems++;
    mobj.angle = (ANG45 * Math.trunc(mthing.angle / 45)) >>> 0;
    if (mthing.options & MTF_AMBUSH) mobj.flags |= MF.MF_AMBUSH;
}
export function P_SpawnPuff(x: number, y: number, z: number): void {
    z = (z + ((P_Random() - P_Random()) << 10)) | 0;
    const th = P_SpawnMobj(x,y,z,MT.MT_PUFF); th.momz = FRACUNIT; th.tics -= P_Random() & 3; if (th.tics < 1) th.tics = 1;
    if (game().attackrange === MELEERANGE) P_SetMobjState(th,S.S_PUFF3);
}
export function P_SpawnBlood(x: number, y: number, z: number, damage: number): void {
    z = (z + ((P_Random() - P_Random()) << 10)) | 0;
    const th = P_SpawnMobj(x,y,z,MT.MT_BLOOD); th.momz = FRACUNIT * 2; th.tics -= P_Random() & 3; if (th.tics < 1) th.tics = 1;
    if (damage <= 12 && damage >= 9) P_SetMobjState(th,S.S_BLOOD2); else if (damage < 9) P_SetMobjState(th,S.S_BLOOD3);
}
export function P_CheckMissileSpawn(th: mobj_t): void {
    th.tics -= P_Random() & 3; if (th.tics < 1) th.tics = 1;
    th.x = (th.x + (th.momx >> 1)) | 0; th.y = (th.y + (th.momy >> 1)) | 0; th.z = (th.z + (th.momz >> 1)) | 0;
    if (!game().P_TryMove(th,th.x,th.y)) P_ExplodeMissile(th);
}
export function P_SpawnMissile(source: mobj_t, dest: mobj_t, type: MT): mobj_t {
    const th = P_SpawnMobj(source.x,source.y,(source.z + 32 * FRACUNIT) | 0,type);
    if (th.info!.seesound) game().S_StartSound(th,th.info!.seesound);
    th.target = source; let an = R_PointToAngle2(source.x,source.y,dest.x,dest.y);
    if (dest.flags & MF.MF_SHADOW) an = (an + ((P_Random() - P_Random()) << 20)) >>> 0;
    th.angle = an; an >>>= ANGLETOFINESHIFT;
    th.momx = FixedMul(th.info!.speed,finecosine[an]); th.momy = FixedMul(th.info!.speed,finesine[an]);
    const dist = Math.max(1,Math.trunc(P_AproxDistance((dest.x - source.x) | 0,(dest.y - source.y) | 0) / th.info!.speed));
    th.momz = Math.trunc(((dest.z - source.z) | 0) / dist) | 0; P_CheckMissileSpawn(th); return th;
}
export function P_SpawnPlayerMissile(source: mobj_t, type: MT): void {
    const g = game(); let an = source.angle, slope = g.P_AimLineAttack(source,an,16 * 64 * FRACUNIT);
    if (!g.linetarget) {
        an = (an + (1 << 26)) >>> 0; slope = g.P_AimLineAttack(source,an,16 * 64 * FRACUNIT);
        if (!g.linetarget) { an = (an - (2 << 26)) >>> 0; slope = g.P_AimLineAttack(source,an,16 * 64 * FRACUNIT); }
        if (!g.linetarget) { an = source.angle; slope = 0; }
    }
    const th = P_SpawnMobj(source.x,source.y,(source.z + 32 * FRACUNIT) | 0,type);
    if (th.info!.seesound) g.S_StartSound(th,th.info!.seesound);
    th.target = source; th.angle = an; th.momx = FixedMul(th.info!.speed,finecosine[an >>> ANGLETOFINESHIFT]);
    th.momy = FixedMul(th.info!.speed,finesine[an >>> ANGLETOFINESHIFT]); th.momz = FixedMul(th.info!.speed,slope); P_CheckMissileSpawn(th);
}
