// Copyright (C) 1993-1996 id Software, Inc. GPL-2.0-only.
// Partial port: noise, reload, pain, death and explosion actions. Monster behavior remains pending.
import type { mobj_t } from './p_mobj.h';
import type { sector_t } from './r_defs.h';
import type { player_t } from './d_player.h';
import type { pspdef_t } from './p_pspr.h';
import type { actionf_p2 } from './d_think.h';
import type { actionf_p1 } from './d_think.h';
import { GameMode_t } from './doomdef.h';
import { mobjtype_t as MT } from './info.h';
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
}
let context: enemy_context_t | null = null;
export function P_InitEnemyContext(game: enemy_context_t): void { context = game; }
function sound(player: player_t, sfx: SFX): void {
    if (!context) throw new Error('P_InitEnemyContext: sound is not linked');
    context.S_StartSound(player.mo!,sfx);
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
