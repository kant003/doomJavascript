// Copyright (C) 1993-1996 id Software, Inc. GPL-2.0-only.
export const FRACBITS = 16;
export const FRACUNIT = 1 << FRACBITS;
export type fixed_t = number;
export { FixedMul, FixedDiv, FixedDiv2 } from './m_fixed';
