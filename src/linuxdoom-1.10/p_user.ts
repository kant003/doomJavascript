// Copyright (C) 1993-1996 id Software, Inc. GPL-2.0-only.
import { GameMode_t, weapontype_t as WP, powertype_t as PW } from './doomdef.h';
import { buttoncode_t } from './d_event.h';
import { playerstate_t, cheat_t, type player_t } from './d_player.h';
import { mobjflag_t as MF } from './p_mobj.h';
import { statenum_t as S } from './info.h';
import { states } from './info';
import { FRACUNIT } from './m_fixed.h';
import { FixedMul } from './m_fixed';
import { FINEANGLES, FINEMASK, ANG90, ANG180, ANGLETOFINESHIFT, finecosine, finesine } from './tables.h';
import { VIEWHEIGHT } from './p_local.h';
import { P_SetMobjState } from './p_mobj';
import { leveltime } from './p_tick';
import { R_PointToAngle2 } from './r_main';

const INVERSECOLORMAP = 32, MAXBOB = 0x100000, ANG5 = Math.trunc(ANG90 / 18);
const { BT_USE, BT_SPECIAL, BT_CHANGE, BT_WEAPONMASK, BT_WEAPONSHIFT } = buttoncode_t;
export let onground = false;
export interface player_context_t {
    gamemode: GameMode_t;
    P_MovePsprites(player: player_t): void;
    P_PlayerInSpecialSector(player: player_t): void;
    P_UseLines(player: player_t): void;
}
let context: player_context_t | null = null;
export function P_InitPlayerContext(game: player_context_t): void { context = game; }
function game(): player_context_t { if (!context) throw new Error('P_InitPlayerContext: gameplay dependencies are not linked'); return context; }

export function P_Thrust(player: player_t, angle: number, move: number): void {
    angle >>>= ANGLETOFINESHIFT;
    player.mo!.momx = (player.mo!.momx + FixedMul(move, finecosine[angle])) | 0;
    player.mo!.momy = (player.mo!.momy + FixedMul(move, finesine[angle])) | 0;
}
export function P_CalcHeight(player: player_t): void {
    const mo = player.mo!;
    player.bob = (FixedMul(mo.momx,mo.momx) + FixedMul(mo.momy,mo.momy)) | 0;
    player.bob >>= 2;
    if (player.bob > MAXBOB) player.bob = MAXBOB;
    if ((player.cheats & cheat_t.CF_NOMOMENTUM) || !onground) {
        player.viewz = (mo.z + VIEWHEIGHT) | 0;
        if (player.viewz > mo.ceilingz - 4 * FRACUNIT) player.viewz = (mo.ceilingz - 4 * FRACUNIT) | 0;
        // The original overwrites its own ceiling clamp here. Preserve this behavior.
        player.viewz = (mo.z + player.viewheight) | 0;
        return;
    }
    const angle = Math.imul(Math.trunc(FINEANGLES / 20),leveltime) & FINEMASK;
    const bob = FixedMul(Math.trunc(player.bob / 2),finesine[angle]);
    if (player.playerstate === playerstate_t.PST_LIVE) {
        player.viewheight = (player.viewheight + player.deltaviewheight) | 0;
        if (player.viewheight > VIEWHEIGHT) { player.viewheight = VIEWHEIGHT; player.deltaviewheight = 0; }
        if (player.viewheight < VIEWHEIGHT / 2) {
            player.viewheight = VIEWHEIGHT / 2;
            if (player.deltaviewheight <= 0) player.deltaviewheight = 1;
        }
        if (player.deltaviewheight) {
            player.deltaviewheight = (player.deltaviewheight + FRACUNIT / 4) | 0;
            if (!player.deltaviewheight) player.deltaviewheight = 1;
        }
    }
    player.viewz = (mo.z + player.viewheight + bob) | 0;
    if (player.viewz > mo.ceilingz - 4 * FRACUNIT) player.viewz = (mo.ceilingz - 4 * FRACUNIT) | 0;
}
export function P_MovePlayer(player: player_t): void {
    const cmd = player.cmd, mo = player.mo!;
    mo.angle = (mo.angle + (cmd.angleturn << 16)) >>> 0;
    onground = mo.z <= mo.floorz;
    if (cmd.forwardmove && onground) P_Thrust(player,mo.angle,cmd.forwardmove * 2048);
    if (cmd.sidemove && onground) P_Thrust(player,(mo.angle - ANG90) >>> 0,cmd.sidemove * 2048);
    if ((cmd.forwardmove || cmd.sidemove) && mo.state === states[S.S_PLAY]) P_SetMobjState(mo,S.S_PLAY_RUN1);
}
export function P_DeathThink(player: player_t): void {
    game().P_MovePsprites(player);
    if (player.viewheight > 6 * FRACUNIT) player.viewheight -= FRACUNIT;
    if (player.viewheight < 6 * FRACUNIT) player.viewheight = 6 * FRACUNIT;
    player.deltaviewheight = 0;
    const mo = player.mo!;
    onground = mo.z <= mo.floorz;
    P_CalcHeight(player);
    if (player.attacker && player.attacker !== mo) {
        const angle = R_PointToAngle2(mo.x,mo.y,player.attacker.x,player.attacker.y);
        const delta = (angle - mo.angle) >>> 0;
        if (delta < ANG5 || delta > ((-ANG5) >>> 0)) {
            mo.angle = angle;
            if (player.damagecount) player.damagecount--;
        } else if (delta < ANG180) mo.angle = (mo.angle + ANG5) >>> 0;
        else mo.angle = (mo.angle - ANG5) >>> 0;
    } else if (player.damagecount) player.damagecount--;
    if (player.cmd.buttons & BT_USE) player.playerstate = playerstate_t.PST_REBORN;
}
export function P_PlayerThink(player: player_t): void {
    const g = game(), mo = player.mo!, cmd = player.cmd;
    if (player.cheats & cheat_t.CF_NOCLIP) mo.flags |= MF.MF_NOCLIP;
    else mo.flags &= ~MF.MF_NOCLIP;
    if (mo.flags & MF.MF_JUSTATTACKED) {
        cmd.angleturn = 0; cmd.forwardmove = 0xc800 / 512; cmd.sidemove = 0;
        mo.flags &= ~MF.MF_JUSTATTACKED;
    }
    if (player.playerstate === playerstate_t.PST_DEAD) { P_DeathThink(player); return; }
    if (mo.reactiontime) mo.reactiontime--;
    else P_MovePlayer(player);
    P_CalcHeight(player);
    if (mo.subsector!.sector!.special) g.P_PlayerInSpecialSector(player);
    if (cmd.buttons & BT_SPECIAL) cmd.buttons = 0;
    if (cmd.buttons & BT_CHANGE) {
        let newweapon = (cmd.buttons & BT_WEAPONMASK) >> BT_WEAPONSHIFT;
        if (newweapon === WP.wp_fist && player.weaponowned[WP.wp_chainsaw]
            && !(player.readyweapon === WP.wp_chainsaw && player.powers[PW.pw_strength])) newweapon = WP.wp_chainsaw;
        if (g.gamemode === GameMode_t.commercial && newweapon === WP.wp_shotgun && player.weaponowned[WP.wp_supershotgun]
            && player.readyweapon !== WP.wp_supershotgun) newweapon = WP.wp_supershotgun;
        if (player.weaponowned[newweapon] && newweapon !== player.readyweapon
            && ((newweapon !== WP.wp_plasma && newweapon !== WP.wp_bfg) || g.gamemode !== GameMode_t.shareware)) player.pendingweapon = newweapon;
    }
    if (cmd.buttons & BT_USE) {
        if (!player.usedown) { g.P_UseLines(player); player.usedown = 1; }
    } else player.usedown = 0;
    g.P_MovePsprites(player);
    if (player.powers[PW.pw_strength]) player.powers[PW.pw_strength]++;
    if (player.powers[PW.pw_invulnerability]) player.powers[PW.pw_invulnerability]--;
    if (player.powers[PW.pw_invisibility] && !--player.powers[PW.pw_invisibility]) mo.flags &= ~MF.MF_SHADOW;
    if (player.powers[PW.pw_infrared]) player.powers[PW.pw_infrared]--;
    if (player.powers[PW.pw_ironfeet]) player.powers[PW.pw_ironfeet]--;
    if (player.damagecount) player.damagecount--;
    if (player.bonuscount) player.bonuscount--;
    const invulnerability = player.powers[PW.pw_invulnerability], infrared = player.powers[PW.pw_infrared];
    if (invulnerability) player.fixedcolormap = invulnerability > 128 || (invulnerability & 8) ? INVERSECOLORMAP : 0;
    else if (infrared) player.fixedcolormap = infrared > 128 || (infrared & 8) ? 1 : 0;
    else player.fixedcolormap = 0;
}
