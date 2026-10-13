// Copyright (C) 1993-1996 id Software, Inc. GPL-2.0-only.
// Original visplanes and flat/sky span mapping. Padded arrays model the C sentinel bytes.
import { SCREENWIDTH, SCREENHEIGHT } from './doomdef.h';
import { FixedMul, FixedDiv } from './m_fixed';
import { ANG90, ANGLETOFINESHIFT } from './tables.h';
import { finesine, finecosine } from './tables';
import { view } from './r_main';
import { LIGHTLEVELS, LIGHTSEGSHIFT, LIGHTZSHIFT, MAXLIGHTZ } from './r_main.h';
import { texturestate, R_GetColumn } from './r_data';
import { draw } from './r_draw';
import { sky } from './r_sky';
import { ANGLETOSKYSHIFT } from './r_sky.h';
import { W_CacheLumpNum } from './w_wad';
import type { visplane_t } from './r_defs.h';
export const MAXVISPLANES = 128, MAXOPENINGS = SCREENWIDTH*64;
export const planes = {
    visplanes: [] as visplane_t[], floorplane: null as visplane_t | null, ceilingplane: null as visplane_t | null,
    openings: new Int16Array(MAXOPENINGS), lastopening: 0, floorclip: new Int16Array(SCREENWIDTH), ceilingclip: new Int16Array(SCREENWIDTH),
    spanstart: new Int32Array(SCREENHEIGHT), spanstop: new Int32Array(SCREENHEIGHT), planezlight: [] as Uint8Array[], planeheight: 0,
    yslope: new Int32Array(SCREENHEIGHT), distscale: new Int32Array(SCREENWIDTH), basexscale: 0, baseyscale: 0,
    cachedheight: new Int32Array(SCREENHEIGHT), cacheddistance: new Int32Array(SCREENHEIGHT), cachedxstep: new Int32Array(SCREENHEIGHT), cachedystep: new Int32Array(SCREENHEIGHT),
};
export function R_InitPlanes(): void { /* empty in original */ }
export function R_ClearPlanes(): void {
    planes.floorclip.fill(view.viewheight,0,view.viewwidth); planes.ceilingclip.fill(-1,0,view.viewwidth);
    planes.visplanes.length = 0; planes.lastopening = 0; planes.cachedheight.fill(0);
    const angle = ((view.viewangle - ANG90) >>> 0) >>> ANGLETOFINESHIFT;
    planes.basexscale = FixedDiv(finecosine[angle],view.centerxfrac);
    planes.baseyscale = -FixedDiv(finesine[angle],view.centerxfrac);
}
function newPlane(height: number, picnum: number, lightlevel: number, minx: number, maxx: number): visplane_t {
    if (planes.visplanes.length >= MAXVISPLANES) throw new Error('R_FindPlane: no more visplanes');
    const pl = {height,picnum,lightlevel,minx,maxx,top:new Uint8Array(SCREENWIDTH+2).fill(255),bottom:new Uint8Array(SCREENWIDTH+2)};
    planes.visplanes.push(pl); return pl;
}
export function R_FindPlane(height: number, picnum: number, lightlevel: number): visplane_t {
    if (picnum === sky.skyflatnum) { height = 0; lightlevel = 0; }
    return planes.visplanes.find(pl=>pl.height===height && pl.picnum===picnum && pl.lightlevel===lightlevel) ?? newPlane(height,picnum,lightlevel,SCREENWIDTH,-1);
}
export function R_CheckPlane(pl: visplane_t, start: number, stop: number): visplane_t {
    const intrl=Math.max(start,pl.minx),intrh=Math.min(stop,pl.maxx);
    let x=intrl; while(x<=intrh && pl.top[x+1]===255) x++;
    if(x>intrh){pl.minx=Math.min(start,pl.minx);pl.maxx=Math.max(stop,pl.maxx);return pl;}
    return newPlane(pl.height,pl.picnum,pl.lightlevel,start,stop);
}
export function R_MapPlane(y: number, x1: number, x2: number): void {
    if(x2<x1 || x1<0 || x2>=view.viewwidth || y<0 || y>=view.viewheight) throw new Error('R_MapPlane: invalid bounds');
    let distance: number;
    if(planes.planeheight!==planes.cachedheight[y]){
        planes.cachedheight[y]=planes.planeheight;
        distance=planes.cacheddistance[y]=FixedMul(planes.planeheight,planes.yslope[y]);
        draw.ds_xstep=planes.cachedxstep[y]=FixedMul(distance,planes.basexscale);
        draw.ds_ystep=planes.cachedystep[y]=FixedMul(distance,planes.baseyscale);
    }else{distance=planes.cacheddistance[y];draw.ds_xstep=planes.cachedxstep[y];draw.ds_ystep=planes.cachedystep[y];}
    const length=FixedMul(distance,planes.distscale[x1]);
    const angle=((view.viewangle+view.xtoviewangle[x1])>>>0)>>>ANGLETOFINESHIFT;
    draw.ds_xfrac=(view.viewx+FixedMul(finecosine[angle],length))|0;
    draw.ds_yfrac=(-view.viewy-FixedMul(finesine[angle],length))|0;
    draw.ds_colormap=view.fixedcolormap??planes.planezlight[Math.min(MAXLIGHTZ-1,(distance>>LIGHTZSHIFT)>>>0)];
    draw.ds_y=y;draw.ds_x1=x1;draw.ds_x2=x2;view.spanfunc();
}
export function R_MakeSpans(x:number,t1:number,b1:number,t2:number,b2:number):void{
    while(t1<t2 && t1<=b1){R_MapPlane(t1,planes.spanstart[t1],x-1);t1++;}
    while(b1>b2 && b1>=t1){R_MapPlane(b1,planes.spanstart[b1],x-1);b1--;}
    while(t2<t1 && t2<=b2){planes.spanstart[t2]=x;t2++;}
    while(b2>b1 && b2>=t2){planes.spanstart[b2]=x;b2--;}
}
export function R_DrawPlanes():void{
    for(const pl of planes.visplanes){
        if(pl.minx>pl.maxx)continue;
        if(pl.picnum===sky.skyflatnum){
            draw.dc_iscale=view.pspriteiscale>>view.detailshift;draw.dc_colormap=texturestate.colormaps.subarray(0,256);draw.dc_texturemid=sky.skytexturemid;
            for(let x=pl.minx;x<=pl.maxx;x++){
                draw.dc_yl=pl.top[x+1];draw.dc_yh=pl.bottom[x+1];
                if(draw.dc_yl<=draw.dc_yh){const angle=((view.viewangle+view.xtoviewangle[x])>>>0)>>>ANGLETOSKYSHIFT;draw.dc_x=x;draw.dc_source=R_GetColumn(sky.skytexture,angle);view.colfunc();}
            }continue;
        }
        draw.ds_source=W_CacheLumpNum(texturestate.firstflat+texturestate.flattranslation[pl.picnum],1);
        if(draw.ds_source.length<4096)throw new Error('Flat requires 64 × 64 indexed pixels');
        planes.planeheight=Math.abs((pl.height-view.viewz)|0);
        planes.planezlight=view.zlight[Math.max(0,Math.min(LIGHTLEVELS-1,(pl.lightlevel>>LIGHTSEGSHIFT)+view.extralight))];
        pl.top[pl.maxx+2]=255;pl.top[pl.minx]=255;
        for(let x=pl.minx;x<=pl.maxx+1;x++)R_MakeSpans(x,pl.top[x],pl.bottom[x],pl.top[x+1],pl.bottom[x+1]);
    }
}
