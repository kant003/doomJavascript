// Copyright (C) 1993-1996 id Software, Inc. GPL-2.0-only.
import { FRACBITS } from './m_fixed.h';
import { FixedMul, FixedDiv } from './m_fixed';
import { mapstate as m } from './r_state.h';
import { view } from './r_main';
import { ML_TWOSIDED, NF_SUBSECTOR } from './doomdata.h';
import type { divline_t } from './p_local.h';
import type { mobj_t } from './p_mobj.h';

// topslope/bottomslope are shared with p_map in the original engine.
export const sight = { sightzstart:0, topslope:0, bottomslope:0, strace:{x:0,y:0,dx:0,dy:0}, t2x:0,t2y:0,sightcounts:new Int32Array(2) };
export function P_DivlineSide(x:number,y:number,node:divline_t):number {
    if (!node.dx) { if(x===node.x)return 2;return +(x<=node.x?node.dy>0:node.dy<0); }
    // Preserve the original x==node.y comparison in this horizontal case.
    if (!node.dy) { if(x===node.y)return 2;return +(y<=node.y?node.dx<0:node.dx>0); }
    const dx=(x-node.x)|0,dy=(y-node.y)|0;
    const left=Math.imul(node.dy>>FRACBITS,dx>>FRACBITS),right=Math.imul(dy>>FRACBITS,node.dx>>FRACBITS);
    return right<left?0:left===right?2:1;
}
export function P_InterceptVector2(v2:divline_t,v1:divline_t):number {
    const den=(FixedMul(v1.dy>>8,v2.dx)-FixedMul(v1.dx>>8,v2.dy))|0;if(!den)return 0;
    const num=(FixedMul((v1.x-v2.x)>>8,v1.dy)+FixedMul((v2.y-v1.y)>>8,v1.dx))|0;return FixedDiv(num,den);
}
export function P_CrossSubsector(num:number):boolean {
    const sub=m.subsectors[num];if(!sub)throw new Error('P_CrossSubsector: invalid subsector');
    for(let i=0;i<sub.numlines;i++) {
        const seg=m.segs[sub.firstline+i],line=seg.linedef;
        if(line.validcount===view.validcount)continue;line.validcount=view.validcount;
        const v1=line.v1,v2=line.v2;
        if(P_DivlineSide(v1.x,v1.y,sight.strace)===P_DivlineSide(v2.x,v2.y,sight.strace))continue;
        const divl={x:v1.x,y:v1.y,dx:(v2.x-v1.x)|0,dy:(v2.y-v1.y)|0};
        if(P_DivlineSide(sight.strace.x,sight.strace.y,divl)===P_DivlineSide(sight.t2x,sight.t2y,divl))continue;
        if(!(line.flags&ML_TWOSIDED))return false;
        const front=seg.frontsector,back=seg.backsector!;
        if(front.floorheight===back.floorheight&&front.ceilingheight===back.ceilingheight)continue;
        const opentop=Math.min(front.ceilingheight,back.ceilingheight),openbottom=Math.max(front.floorheight,back.floorheight);
        if(openbottom>=opentop)return false;
        const frac=P_InterceptVector2(sight.strace,divl);
        if(front.floorheight!==back.floorheight)sight.bottomslope=Math.max(sight.bottomslope,FixedDiv((openbottom-sight.sightzstart)|0,frac));
        if(front.ceilingheight!==back.ceilingheight)sight.topslope=Math.min(sight.topslope,FixedDiv((opentop-sight.sightzstart)|0,frac));
        if(sight.topslope<=sight.bottomslope)return false;
    }return true;
}
export function P_CrossBSPNode(bspnum:number):boolean {
    const stack=[bspnum];
    while(stack.length) {
        const number=stack.pop()!;
        if(number&NF_SUBSECTOR) { if(!P_CrossSubsector(number===-1?0:number&~NF_SUBSECTOR))return false;continue; }
        const bsp=m.nodes[number];if(!bsp)throw new Error('P_CrossBSPNode: invalid node');
        let side=P_DivlineSide(sight.strace.x,sight.strace.y,bsp);if(side===2)side=0;
        if(side!==P_DivlineSide(sight.t2x,sight.t2y,bsp))stack.push(bsp.children[side^1]);
        stack.push(bsp.children[side]);
    }return true;
}
export function P_CheckSight(t1:mobj_t,t2:mobj_t):boolean {
    const s1=m.sectors.indexOf(t1.subsector!.sector!),s2=m.sectors.indexOf(t2.subsector!.sector!);
    if(s1<0||s2<0)throw new Error('P_CheckSight: actor sector is outside the level');
    const pnum=s1*m.numsectors+s2;
    if(m.rejectmatrix[pnum>>3]&(1<<(pnum&7))){sight.sightcounts[0]++;return false;}
    sight.sightcounts[1]++;view.validcount=(view.validcount+1)|0;
    sight.sightzstart=(t1.z+t1.height-(t1.height>>2))|0;
    sight.topslope=(t2.z+t2.height-sight.sightzstart)|0;sight.bottomslope=(t2.z-sight.sightzstart)|0;
    sight.strace.x=t1.x;sight.strace.y=t1.y;sight.t2x=t2.x;sight.t2y=t2.y;
    sight.strace.dx=(t2.x-t1.x)|0;sight.strace.dy=(t2.y-t1.y)|0;
    return P_CrossBSPNode(m.numnodes-1);
}
