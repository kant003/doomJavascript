// Copyright (C) 1993-1996 id Software, Inc. GPL-2.0-only.
export function SCRAMBLE(a: number): number {
    return ((a & 1) << 7) + ((a & 2) << 5) + (a & 4) + ((a & 8) << 1)
        + ((a & 16) >> 1) + (a & 32) + ((a & 64) >> 5) + ((a & 128) >> 7);
}
// A pointer into sequence is represented by an index; null is an uninitialized pointer.
export interface cheatseq_t { sequence: Uint8Array; p: number | null }
export { cht_CheckCheat, cht_GetParam } from './m_cheat';
