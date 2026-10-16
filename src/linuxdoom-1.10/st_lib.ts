// Copyright (C) 1993-1996 id Software, Inc. GPL-2.0-only.
// st_lib.c. Getter references replace C pointers; patch/copy operations stay native.
import { W_CacheLumpName } from './w_wad';
import { V_PatchHeader,V_CopyRect,V_DrawPatch } from './v_video';
import { ST_Y } from './st_stuff.h';
import { BG,FG,type st_number_t,type st_percent_t,type st_multicon_t,type st_binicon_t } from './st_lib.h';
let sttminus:Uint8Array;
export function STlib_init():void {sttminus=W_CacheLumpName('STTMINUS',1);}
export function STlib_initNum(n:st_number_t,x:number,y:number,p:Uint8Array[],num:()=>number,on:()=>boolean,width:number):void {Object.assign(n,{x,y,oldnum:0,width,num,on,p});}
export function STlib_drawNum(n:st_number_t,_refresh:boolean):void {
    let numdigits=n.width,num=n.num(),x=n.x;const {width:w,height:h}=V_PatchHeader(n.p[0]);
    n.oldnum=num;const neg=num<0;
    if(neg){if(numdigits===2&&num< -9)num=-9;else if(numdigits===3&&num< -99)num=-99;num=-num;}
    x=n.x-numdigits*w;if(n.y-ST_Y<0)throw new Error('drawNum: n->y - ST_Y < 0');
    V_CopyRect(x,n.y-ST_Y,BG,w*numdigits,h,x,n.y,FG);
    if(num===1994)return;x=n.x;
    if(!num)V_DrawPatch(x-w,n.y,FG,n.p[0]);
    while(num&&numdigits--){x-=w;V_DrawPatch(x,n.y,FG,n.p[num%10]);num=Math.trunc(num/10);}
    if(neg)V_DrawPatch(x-8,n.y,FG,sttminus);
}
export function STlib_updateNum(n:st_number_t,refresh:boolean):void {if(n.on())STlib_drawNum(n,refresh);}
export function STlib_initPercent(p:st_percent_t,x:number,y:number,pl:Uint8Array[],num:()=>number,on:()=>boolean,percent:Uint8Array):void {p.n={} as st_number_t;STlib_initNum(p.n,x,y,pl,num,on,3);p.p=percent;}
export function STlib_updatePercent(per:st_percent_t,refresh:boolean):void {if(refresh&&per.n.on())V_DrawPatch(per.n.x,per.n.y,FG,per.p);STlib_updateNum(per.n,refresh);}
export function STlib_initMultIcon(i:st_multicon_t,x:number,y:number,p:Uint8Array[],inum:()=>number,on:()=>boolean):void {Object.assign(i,{x,y,oldinum:-1,inum,on,p});}
export function STlib_updateMultIcon(mi:st_multicon_t,refresh:boolean):void {
    const index=mi.inum();if(mi.on()&&(mi.oldinum!==index||refresh)&&index!==-1){
        if(mi.oldinum!==-1){const p=V_PatchHeader(mi.p[mi.oldinum]),x=mi.x-p.leftoffset,y=mi.y-p.topoffset;
            if(y-ST_Y<0)throw new Error('updateMultIcon: y - ST_Y < 0');V_CopyRect(x,y-ST_Y,BG,p.width,p.height,x,y,FG);}
        V_DrawPatch(mi.x,mi.y,FG,mi.p[index]);mi.oldinum=index;
    }
}
export function STlib_initBinIcon(b:st_binicon_t,x:number,y:number,p:Uint8Array,val:()=>boolean,on:()=>boolean):void {Object.assign(b,{x,y,oldval:false,val,on,p});}
export function STlib_updateBinIcon(b:st_binicon_t,refresh:boolean):void {
    const value=b.val();if(b.on()&&(b.oldval!==value||refresh)){const p=V_PatchHeader(b.p),x=b.x-p.leftoffset,y=b.y-p.topoffset;
        if(y-ST_Y<0)throw new Error('updateBinIcon: y - ST_Y < 0');if(value)V_DrawPatch(b.x,b.y,FG,b.p);else V_CopyRect(x,y-ST_Y,BG,p.width,p.height,x,y,FG);b.oldval=value;}
}
