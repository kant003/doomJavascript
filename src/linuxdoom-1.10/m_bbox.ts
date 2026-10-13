// Copyright (C) 1993-1996 id Software, Inc. GPL-2.0-only.
import { BOXTOP, BOXBOTTOM, BOXLEFT, BOXRIGHT } from './m_bbox.h';
import { MAXINT, MININT } from './doomtype.h';
export function M_ClearBox(box: Int32Array): void {
    box[BOXTOP] = box[BOXRIGHT] = MININT;
    box[BOXBOTTOM] = box[BOXLEFT] = MAXINT;
}
export function M_AddToBox(box: Int32Array, x: number, y: number): void {
    if (x < box[BOXLEFT]) box[BOXLEFT] = x;
    else if (x > box[BOXRIGHT]) box[BOXRIGHT] = x;
    if (y < box[BOXBOTTOM]) box[BOXBOTTOM] = y;
    else if (y > box[BOXTOP]) box[BOXTOP] = y;
}
