// Copyright (C) 1993-1996 id Software, Inc. GPL-2.0-only.
import { GameMode_t, weapontype_t as WP, ammotype_t as AM, powertype_t as PW } from './doomdef.h';
import { buttoncode_t as BT } from './d_event.h';
import { playerstate_t as PST, type player_t } from './d_player.h';
import { mobjflag_t as MF, type mobj_t } from './p_mobj.h';
import { psprnum_t as PS, type pspdef_t } from './p_pspr.h';
import { statenum_t as S, mobjtype_t as MT } from './info.h';
import { states } from './info';
import { weaponinfo } from './d_items';
import { P_SetMobjState, P_SpawnMobj, P_SpawnPlayerMissile } from './p_mobj';
import { P_Random } from './m_random';
import { FRACUNIT as F, FRACBITS } from './m_fixed.h';
import { FixedMul } from './m_fixed';
import { FINEANGLES, FINEMASK, ANG90, ANG180, finecosine, finesine } from './tables.h';
import { MELEERANGE, MISSILERANGE } from './p_local.h';
import { leveltime } from './p_tick';
import { R_PointToAngle2 } from './r_main';
import { sfxenum_t as SFX } from './sounds.h';
import type { actionf_p1, actionf_p2 } from './d_think.h';

const LOWERSPEED = F * 6, RAISESPEED = F * 6, WEAPONBOTTOM = 128 * F, WEAPONTOP = 32 * F, BFGCELLS = 40;
export interface psprite_context_t {
    gamemode: GameMode_t; linetarget: mobj_t | null;
    S_StartSound(origin: mobj_t, sound: SFX): void;
    P_NoiseAlert(target: mobj_t, emitter: mobj_t): void;
    P_AimLineAttack(source: mobj_t, angle: number, distance: number): number;
    P_LineAttack(source: mobj_t, angle: number, distance: number, slope: number, damage: number): void;
    P_DamageMobj(target: mobj_t, inflictor: mobj_t, source: mobj_t, damage: number): void;
}
let context: psprite_context_t | null = null;
export function P_InitPspriteContext(game: psprite_context_t): void { context = game; }
function game(): psprite_context_t { if (!context) throw new Error('P_InitPspriteContext: gameplay dependencies are not linked'); return context; }

export function P_SetPsprite(player: player_t, position: number, stnum: S): void {
    const psp = player.psprites[position]; if (!psp) throw new Error('P_SetPsprite: invalid position');
    let transitions = 0;
    do {
        if (!stnum) { psp.state = null; break; }
        const state = states[stnum]; if (!state) throw new Error(`P_SetPsprite: invalid state ${stnum}`);
        psp.state = state; psp.tics = state.tics;
        if (state.misc1) { psp.sx = state.misc1 << FRACBITS; psp.sy = state.misc2 << FRACBITS; }
        if (state.action) {
            if (typeof state.action !== 'function') throw new Error('Invalid psprite action');
            (state.action as (player: player_t, psp: pspdef_t) => void)(player,psp);
            if (!psp.state) break;
        }
        stnum = psp.state.nextstate;
        if (++transitions > 10000 && !psp.tics) throw new Error('P_SetPsprite: runaway zero-tic state chain');
    } while (!psp.tics);
}
export let swingx = 0, swingy = 0;
export function P_CalcSwing(player: player_t): void {
    const phase = Math.imul(Math.trunc(FINEANGLES / 70),leveltime);
    swingx = FixedMul(player.bob,finesine[phase & FINEMASK]);
    swingy = (-FixedMul(swingx,finesine[(phase + FINEANGLES / 2) & FINEMASK])) | 0;
}
export function P_BringUpWeapon(player: player_t): void {
    if (player.pendingweapon === WP.wp_nochange) player.pendingweapon = player.readyweapon;
    if (player.pendingweapon === WP.wp_chainsaw) game().S_StartSound(player.mo!,SFX.sfx_sawup);
    const newstate = weaponinfo[player.pendingweapon].upstate;
    player.pendingweapon = WP.wp_nochange; player.psprites[PS.ps_weapon].sy = WEAPONBOTTOM;
    P_SetPsprite(player,PS.ps_weapon,newstate);
}
export function P_CheckAmmo(player: player_t): boolean {
    const ammo = weaponinfo[player.readyweapon].ammo;
    const count = player.readyweapon === WP.wp_bfg ? BFGCELLS : player.readyweapon === WP.wp_supershotgun ? 2 : 1;
    if (ammo === AM.am_noammo || player.ammo[ammo] >= count) return true;
    const g = game();
    // These strict >2 and >40 thresholds are the original fallback behavior.
    if (player.weaponowned[WP.wp_plasma] && player.ammo[AM.am_cell] && g.gamemode !== GameMode_t.shareware) player.pendingweapon = WP.wp_plasma;
    else if (player.weaponowned[WP.wp_supershotgun] && player.ammo[AM.am_shell] > 2 && g.gamemode === GameMode_t.commercial) player.pendingweapon = WP.wp_supershotgun;
    else if (player.weaponowned[WP.wp_chaingun] && player.ammo[AM.am_clip]) player.pendingweapon = WP.wp_chaingun;
    else if (player.weaponowned[WP.wp_shotgun] && player.ammo[AM.am_shell]) player.pendingweapon = WP.wp_shotgun;
    else if (player.ammo[AM.am_clip]) player.pendingweapon = WP.wp_pistol;
    else if (player.weaponowned[WP.wp_chainsaw]) player.pendingweapon = WP.wp_chainsaw;
    else if (player.weaponowned[WP.wp_missile] && player.ammo[AM.am_misl]) player.pendingweapon = WP.wp_missile;
    else if (player.weaponowned[WP.wp_bfg] && player.ammo[AM.am_cell] > 40 && g.gamemode !== GameMode_t.shareware) player.pendingweapon = WP.wp_bfg;
    else player.pendingweapon = WP.wp_fist;
    P_SetPsprite(player,PS.ps_weapon,weaponinfo[player.readyweapon].downstate);
    return false;
}
export function P_FireWeapon(player: player_t): void {
    if (!P_CheckAmmo(player)) return;
    P_SetMobjState(player.mo!,S.S_PLAY_ATK1);
    P_SetPsprite(player,PS.ps_weapon,weaponinfo[player.readyweapon].atkstate);
    game().P_NoiseAlert(player.mo!,player.mo!);
}
export function P_DropWeapon(player: player_t): void { P_SetPsprite(player,PS.ps_weapon,weaponinfo[player.readyweapon].downstate); }
export function A_WeaponReady(player: player_t, psp: pspdef_t): void {
    if (player.mo!.state === states[S.S_PLAY_ATK1] || player.mo!.state === states[S.S_PLAY_ATK2]) P_SetMobjState(player.mo!,S.S_PLAY);
    if (player.readyweapon === WP.wp_chainsaw && psp.state === states[S.S_SAW]) game().S_StartSound(player.mo!,SFX.sfx_sawidl);
    if (player.pendingweapon !== WP.wp_nochange || !player.health) { P_DropWeapon(player); return; }
    if (player.cmd.buttons & BT.BT_ATTACK) {
        if (!player.attackdown || (player.readyweapon !== WP.wp_missile && player.readyweapon !== WP.wp_bfg)) {
            player.attackdown = 1; P_FireWeapon(player); return;
        }
    } else player.attackdown = 0;
    let angle = Math.imul(128,leveltime) & FINEMASK;
    psp.sx = (F + FixedMul(player.bob,finecosine[angle])) | 0;
    angle &= FINEANGLES / 2 - 1; psp.sy = (WEAPONTOP + FixedMul(player.bob,finesine[angle])) | 0;
}
export function A_ReFire(player: player_t, _psp: pspdef_t): void {
    if ((player.cmd.buttons & BT.BT_ATTACK) && player.pendingweapon === WP.wp_nochange && player.health) { player.refire++; P_FireWeapon(player); }
    else { player.refire = 0; P_CheckAmmo(player); }
}
export function A_CheckReload(player: player_t, _psp: pspdef_t): void { P_CheckAmmo(player); }
export function A_Lower(player: player_t, psp: pspdef_t): void {
    psp.sy = (psp.sy + LOWERSPEED) | 0;
    if (psp.sy < WEAPONBOTTOM) return;
    if (player.playerstate === PST.PST_DEAD) { psp.sy = WEAPONBOTTOM; return; }
    if (!player.health) { P_SetPsprite(player,PS.ps_weapon,S.S_NULL); return; }
    player.readyweapon = player.pendingweapon; P_BringUpWeapon(player);
}
export function A_Raise(player: player_t, psp: pspdef_t): void {
    psp.sy = (psp.sy - RAISESPEED) | 0;
    if (psp.sy > WEAPONTOP) return;
    psp.sy = WEAPONTOP; P_SetPsprite(player,PS.ps_weapon,weaponinfo[player.readyweapon].readystate);
}
export function A_GunFlash(player: player_t, _psp: pspdef_t): void {
    P_SetMobjState(player.mo!,S.S_PLAY_ATK2); P_SetPsprite(player,PS.ps_flash,weaponinfo[player.readyweapon].flashstate);
}
export function A_Punch(player: player_t, _psp: pspdef_t): void {
    const g = game(); let damage = (P_Random() % 10 + 1) << 1;
    if (player.powers[PW.pw_strength]) damage *= 10;
    const angle = (player.mo!.angle + ((P_Random() - P_Random()) << 18)) >>> 0;
    const slope = g.P_AimLineAttack(player.mo!,angle,MELEERANGE); g.P_LineAttack(player.mo!,angle,MELEERANGE,slope,damage);
    if (g.linetarget) { g.S_StartSound(player.mo!,SFX.sfx_punch); player.mo!.angle = R_PointToAngle2(player.mo!.x,player.mo!.y,g.linetarget.x,g.linetarget.y); }
}
export function A_Saw(player: player_t, _psp: pspdef_t): void {
    const g = game(), damage = 2 * (P_Random() % 10 + 1);
    let angle = (player.mo!.angle + ((P_Random() - P_Random()) << 18)) >>> 0;
    const slope = g.P_AimLineAttack(player.mo!,angle,MELEERANGE + 1); g.P_LineAttack(player.mo!,angle,MELEERANGE + 1,slope,damage);
    if (!g.linetarget) { g.S_StartSound(player.mo!,SFX.sfx_sawful); return; }
    g.S_StartSound(player.mo!,SFX.sfx_sawhit);
    angle = R_PointToAngle2(player.mo!.x,player.mo!.y,g.linetarget.x,g.linetarget.y);
    const delta = (angle - player.mo!.angle) >>> 0, step = Math.trunc(ANG90 / 20), snap = Math.trunc(ANG90 / 21);
    if (delta > ANG180) {
        if (delta < ((-step) >>> 0)) player.mo!.angle = (angle + snap) >>> 0;
        else player.mo!.angle = (player.mo!.angle - step) >>> 0;
    } else {
        if (delta > step) player.mo!.angle = (angle - snap) >>> 0;
        else player.mo!.angle = (player.mo!.angle + step) >>> 0;
    }
    player.mo!.flags |= MF.MF_JUSTATTACKED;
}
export function A_FireMissile(player: player_t, _psp: pspdef_t): void {
    player.ammo[weaponinfo[player.readyweapon].ammo]--; P_SpawnPlayerMissile(player.mo!,MT.MT_ROCKET);
}
export function A_FireBFG(player: player_t, _psp: pspdef_t): void {
    player.ammo[weaponinfo[player.readyweapon].ammo] -= BFGCELLS; P_SpawnPlayerMissile(player.mo!,MT.MT_BFG);
}
export function A_FirePlasma(player: player_t, _psp: pspdef_t): void {
    player.ammo[weaponinfo[player.readyweapon].ammo]--;
    P_SetPsprite(player,PS.ps_flash,weaponinfo[player.readyweapon].flashstate + (P_Random() & 1)); P_SpawnPlayerMissile(player.mo!,MT.MT_PLASMA);
}
export let bulletslope = 0;
export function P_BulletSlope(mo: mobj_t): void {
    const g = game(); let an = mo.angle;
    bulletslope = g.P_AimLineAttack(mo,an,16 * 64 * F);
    if (!g.linetarget) {
        an = (an + (1 << 26)) >>> 0; bulletslope = g.P_AimLineAttack(mo,an,16 * 64 * F);
        if (!g.linetarget) { an = (an - (2 << 26)) >>> 0; bulletslope = g.P_AimLineAttack(mo,an,16 * 64 * F); }
    }
}
export function P_GunShot(mo: mobj_t, accurate: boolean): void {
    const damage = 5 * (P_Random() % 3 + 1);
    let angle = mo.angle; if (!accurate) angle = (angle + ((P_Random() - P_Random()) << 18)) >>> 0;
    game().P_LineAttack(mo,angle,MISSILERANGE,bulletslope,damage);
}
export function A_FirePistol(player: player_t, _psp: pspdef_t): void {
    game().S_StartSound(player.mo!,SFX.sfx_pistol); P_SetMobjState(player.mo!,S.S_PLAY_ATK2);
    player.ammo[weaponinfo[player.readyweapon].ammo]--; P_SetPsprite(player,PS.ps_flash,weaponinfo[player.readyweapon].flashstate);
    P_BulletSlope(player.mo!); P_GunShot(player.mo!,!player.refire);
}
export function A_FireShotgun(player: player_t, _psp: pspdef_t): void {
    game().S_StartSound(player.mo!,SFX.sfx_shotgn); P_SetMobjState(player.mo!,S.S_PLAY_ATK2);
    player.ammo[weaponinfo[player.readyweapon].ammo]--; P_SetPsprite(player,PS.ps_flash,weaponinfo[player.readyweapon].flashstate);
    P_BulletSlope(player.mo!); for (let i = 0; i < 7; i++) P_GunShot(player.mo!,false);
}
export function A_FireShotgun2(player: player_t, _psp: pspdef_t): void {
    const g = game(); g.S_StartSound(player.mo!,SFX.sfx_dshtgn); P_SetMobjState(player.mo!,S.S_PLAY_ATK2);
    player.ammo[weaponinfo[player.readyweapon].ammo] -= 2; P_SetPsprite(player,PS.ps_flash,weaponinfo[player.readyweapon].flashstate);
    P_BulletSlope(player.mo!);
    for (let i = 0; i < 20; i++) {
        const damage = 5 * (P_Random() % 3 + 1), angle = (player.mo!.angle + ((P_Random() - P_Random()) << 19)) >>> 0;
        g.P_LineAttack(player.mo!,angle,MISSILERANGE,(bulletslope + ((P_Random() - P_Random()) << 5)) | 0,damage);
    }
}
export function A_FireCGun(player: player_t, psp: pspdef_t): void {
    game().S_StartSound(player.mo!,SFX.sfx_pistol);
    if (!player.ammo[weaponinfo[player.readyweapon].ammo]) return;
    P_SetMobjState(player.mo!,S.S_PLAY_ATK2); player.ammo[weaponinfo[player.readyweapon].ammo]--;
    P_SetPsprite(player,PS.ps_flash,weaponinfo[player.readyweapon].flashstate + states.indexOf(psp.state!) - S.S_CHAIN1);
    P_BulletSlope(player.mo!); P_GunShot(player.mo!,!player.refire);
}
export function A_Light0(player: player_t, _psp: pspdef_t): void { player.extralight = 0; }
export function A_Light1(player: player_t, _psp: pspdef_t): void { player.extralight = 1; }
export function A_Light2(player: player_t, _psp: pspdef_t): void { player.extralight = 2; }
export function A_BFGSpray(mo: mobj_t): void {
    const g = game();
    for (let i = 0; i < 40; i++) {
        const an = (mo.angle - ANG90 / 2 + Math.trunc(ANG90 / 40) * i) >>> 0;
        g.P_AimLineAttack(mo.target!,an,16 * 64 * F);
        if (!g.linetarget) continue;
        P_SpawnMobj(g.linetarget.x,g.linetarget.y,(g.linetarget.z + (g.linetarget.height >> 2)) | 0,MT.MT_EXTRABFG);
        let damage = 0; for (let j = 0; j < 15; j++) damage += (P_Random() & 7) + 1;
        g.P_DamageMobj(g.linetarget,mo.target!,mo.target!,damage);
    }
}
export function A_BFGsound(player: player_t, _psp: pspdef_t): void { game().S_StartSound(player.mo!,SFX.sfx_bfg); }
export function P_SetupPsprites(player: player_t): void {
    for (let i = 0; i < PS.NUMPSPRITES; i++) player.psprites[i].state = null;
    player.pendingweapon = player.readyweapon; P_BringUpWeapon(player);
}
export function P_MovePsprites(player: player_t): void {
    for (let i = 0; i < PS.NUMPSPRITES; i++) {
        const psp = player.psprites[i];
        if (psp.state && psp.tics !== -1) {
            psp.tics = (psp.tics - 1) | 0;
            if (!psp.tics) P_SetPsprite(player,i,psp.state.nextstate);
        }
    }
    player.psprites[PS.ps_flash].sx = player.psprites[PS.ps_weapon].sx; player.psprites[PS.ps_flash].sy = player.psprites[PS.ps_weapon].sy;
}
// C union selects the callback signature at each call site. Preserve direct function identity.
export const weaponStateActions = Object.freeze({ A_WeaponReady, A_ReFire, A_CheckReload, A_Lower, A_Raise, A_GunFlash,
    A_Punch, A_Saw, A_FireMissile, A_FireBFG, A_FirePlasma, A_FirePistol, A_FireShotgun, A_FireShotgun2, A_FireCGun,
    A_Light0, A_Light1, A_Light2, A_BFGSpray, A_BFGsound }) as unknown as Readonly<Record<string,actionf_p1 | actionf_p2>>;
