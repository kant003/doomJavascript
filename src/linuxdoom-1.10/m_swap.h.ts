// Copyright (C) 1993-1996 id Software, Inc. GPL-2.0-only.
// Binary readers use DataView with littleEndian=true, independent of host byte order.
export const SHORT = (x: number): number => (x << 16) >> 16;
export const LONG = (x: number): number => x | 0;
export { SwapSHORT, SwapLONG } from './m_swap';
