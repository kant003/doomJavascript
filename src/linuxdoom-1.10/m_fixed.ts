// Copyright (C) 1993-1996 id Software, Inc. GPL-2.0-only.
// Conversion of m_fixed.c: exact signed 64-bit multiply and 32-bit narrowing.
import { FRACBITS, FRACUNIT } from './m_fixed.h';
import { MININT, MAXINT } from './doomtype.h';
import { I_Error } from './i_system';
export function FixedMul(a: number, b: number): number {
    return Number(BigInt.asIntN(32, (BigInt(a | 0) * BigInt(b | 0)) >> BigInt(FRACBITS)));
}
export function FixedDiv(a: number, b: number): number {
    a |= 0; b |= 0;
    // Use unsigned shift for abs(INT_MIN), whose positive value fits JS but not C int.
    if ((Math.abs(a) >>> 14) >= Math.abs(b)) return (a ^ b) < 0 ? MININT : MAXINT;
    return FixedDiv2(a, b);
}
export function FixedDiv2(a: number, b: number): number {
    const c = (a | 0) / (b | 0) * FRACUNIT;
    if (!Number.isFinite(c) || c >= 2147483648 || c < -2147483648) I_Error('FixedDiv: divide by zero');
    return Math.trunc(c) | 0;
}
