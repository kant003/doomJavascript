// Copyright (C) 1993-1996 id Software, Inc. GPL-2.0-only.
// Partial r_main.c: original BSP point classification. Frame/render orchestration pending.
import { FixedMul } from './m_fixed';
import { FRACBITS } from './m_fixed.h';
import { NF_SUBSECTOR } from './doomdata.h';
import type { node_t, seg_t, subsector_t } from './r_defs.h';
import { mapstate } from './r_state.h';
export function R_PointOnSide(x: number, y: number, node: Pick<node_t, 'x' | 'y' | 'dx' | 'dy'>): number {
    if (!node.dx) return Number(x <= node.x ? node.dy > 0 : node.dy < 0);
    if (!node.dy) return Number(y <= node.y ? node.dx < 0 : node.dx > 0);
    const dx = (x - node.x) | 0, dy = (y - node.y) | 0;
    if ((node.dy ^ node.dx ^ dx ^ dy) & 0x80000000) return (node.dy ^ dx) & 0x80000000 ? 1 : 0;
    const left = FixedMul(node.dy >> FRACBITS, dx), right = FixedMul(dy, node.dx >> FRACBITS);
    return right < left ? 0 : 1;
}
export function R_PointOnSegSide(x: number, y: number, line: seg_t): number {
    return R_PointOnSide(x, y, { x: line.v1.x, y: line.v1.y, dx: (line.v2.x - line.v1.x) | 0, dy: (line.v2.y - line.v1.y) | 0 });
}
export function R_PointInSubsector(x: number, y: number): subsector_t {
    if (!mapstate.numnodes) {
        if (!mapstate.subsectors[0]) throw new Error('No subsectors loaded');
        return mapstate.subsectors[0];
    }
    let nodenum = mapstate.numnodes - 1, remaining = mapstate.numnodes + 1;
    while (!(nodenum & NF_SUBSECTOR)) {
        if (!remaining--) throw new Error('Cyclic BSP traversal');
        const node = mapstate.nodes[nodenum]; if (!node) throw new Error('Invalid BSP node');
        nodenum = node.children[R_PointOnSide(x, y, node)];
    }
    const ss = mapstate.subsectors[nodenum & ~NF_SUBSECTOR];
    if (!ss) throw new Error('Invalid BSP subsector'); return ss;
}
