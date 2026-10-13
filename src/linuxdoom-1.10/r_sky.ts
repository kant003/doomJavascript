// Copyright (C) 1993-1996 id Software, Inc. GPL-2.0-only.
import { FRACUNIT } from './m_fixed.h';
export const sky = { skyflatnum: 0, skytexture: 0, skytexturemid: 0 };
export function R_InitSkyMap(): void { sky.skytexturemid = 100 * FRACUNIT; }
