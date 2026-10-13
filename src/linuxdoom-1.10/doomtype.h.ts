// Copyright (C) 1993-1996 id Software, Inc. GPL-2.0-only; see LICENSE.TXT.
// Conversion of doomtype.h. Integers crossing a C boundary must be narrowed explicitly.
export type byte = number;
export type DoomBoolean = boolean; // TS reserves the original typedef name boolean.
export const MAXCHAR = 127, MAXSHORT = 32767, MAXINT = 2147483647, MAXLONG = MAXINT;
export const MINCHAR = -128, MINSHORT = -32768, MININT = -2147483648, MINLONG = MININT;
