// Copyright (C) 1993-1996 id Software, Inc. GPL-2.0-only.
import type { thinker_t } from './d_think.h';
import type { player_t } from './d_player.h';
import { MAXPLAYERS } from './doomdef.h';

export let leveltime = 0;
export const thinkercap: thinker_t = { prev: null, next: null, function: null };
export function P_InitThinkers(): void { thinkercap.prev = thinkercap.next = thinkercap; }
export function P_AddThinker(thinker: thinker_t): void {
    if (!thinkercap.prev) throw new Error('P_InitThinkers must precede P_AddThinker');
    thinkercap.prev.next = thinker;
    thinker.next = thinkercap;
    thinker.prev = thinkercap.prev;
    thinkercap.prev = thinker;
}
export function P_RemoveThinker(thinker: thinker_t): void { thinker.function = -1; }
// Empty in the original C source too. Allocation and insertion are the caller's responsibility.
export function P_AllocateThinker(_thinker: thinker_t): void {}
export function P_RunThinkers(): void {
    let currentthinker = thinkercap.next;
    if (!currentthinker) throw new Error('P_InitThinkers must precede P_RunThinkers');
    while (currentthinker !== thinkercap) {
        if (currentthinker.function === -1) {
            currentthinker.next!.prev = currentthinker.prev;
            currentthinker.prev!.next = currentthinker.next;
            // Z_Free becomes GC: unlinked nodes are no longer retained by the sentinel.
        } else if (currentthinker.function) {
            (currentthinker.function as (thinker: thinker_t) => void)(currentthinker);
        }
        // Read AFTER the action: a newly appended thinker can run in this same tic.
        currentthinker = currentthinker.next!;
    }
}
// Explicit dependencies until doomstat, p_user and p_spec are converted. No placeholder actions.
export interface ticker_context_t {
    paused: boolean; netgame: boolean; menuactive: boolean; demoplayback: boolean;
    players: readonly player_t[]; consoleplayer: number; playeringame: readonly boolean[];
    P_PlayerThink(player: player_t): void;
    P_UpdateSpecials(): void;
    P_RespawnSpecials(): void;
}
export function P_Ticker(game: ticker_context_t): void {
    if (game.paused) return;
    if (!game.netgame && game.menuactive && !game.demoplayback && game.players[game.consoleplayer].viewz !== 1) return;
    for (let i = 0; i < MAXPLAYERS; i++) if (game.playeringame[i]) game.P_PlayerThink(game.players[i]);
    P_RunThinkers();
    game.P_UpdateSpecials();
    game.P_RespawnSpecials();
    leveltime = (leveltime + 1) | 0;
}
// Level setup owns this reset in C; ES module bindings cannot be assigned by callers.
export function P_ResetLevelTime(): void { leveltime = 0; }
