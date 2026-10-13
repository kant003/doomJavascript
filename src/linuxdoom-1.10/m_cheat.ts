// Copyright (C) 1993-1996 id Software, Inc. GPL-2.0-only.
import { SCRAMBLE } from './m_cheat.h';
import type { cheatseq_t } from './m_cheat.h';
let firsttime = true;
const cheat_xlate_table = new Uint8Array(256);
export function cht_CheckCheat(cht: cheatseq_t, key: number): number {
    if (firsttime) { firsttime = false; for (let i = 0; i < 256; i++) cheat_xlate_table[i] = SCRAMBLE(i); }
    if (cht.p === null) cht.p = 0;
    if (cht.sequence[cht.p] === 0) cht.sequence[cht.p++] = key;
    else if (cheat_xlate_table[key & 0xff] === cht.sequence[cht.p]) cht.p++;
    else cht.p = 0;
    if (cht.sequence[cht.p] === 1) cht.p++;
    else if (cht.sequence[cht.p] === 0xff) { cht.p = 0; return 1; }
    return 0;
}
export function cht_GetParam(cht: cheatseq_t, buffer: Uint8Array): void {
    let p = cht.sequence.indexOf(1) + 1, out = 0, c: number;
    if (p === 0) throw new Error('Cheat sequence has no parameter marker');
    do { c = cht.sequence[p]; buffer[out++] = c; cht.sequence[p++] = 0; }
    while (c && cht.sequence[p] !== 0xff);
    if (cht.sequence[p] === 0xff) buffer[out] = 0;
}
