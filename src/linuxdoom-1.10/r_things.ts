// Copyright (C) 1993-1996 id Software, Inc. GPL-2.0-only.
// Sprite frame/rotation definitions, projection, post drawing and wall/sprite depth clipping.
import { lumpinfo,W_GetNumForName,W_CacheLumpNum } from './w_wad';
import { texturestate as t } from './r_data';
import { V_PatchHeader } from './v_video';
import { view,R_PointToAngle,R_PointOnSegSide } from './r_main';
import { LIGHTSEGSHIFT,LIGHTLEVELS,LIGHTSCALESHIFT,MAXLIGHTSCALE } from './r_main.h';
import { R_DrawTranslatedColumn,draw } from './r_draw';
import { FixedMul,FixedDiv } from './m_fixed';
import { FRACBITS,FRACUNIT } from './m_fixed.h';
import { ANG45 } from './tables.h';
import { FF_FRAMEMASK,FF_FULLBRIGHT,psprnum_t } from './p_pspr.h';
import type { pspdef_t } from './p_pspr.h';
import { mobjflag_t } from './p_mobj.h';
import type { mobj_t } from './p_mobj.h';
import type { spriteframe_t,spritedef_t,sector_t,vissprite_t,ClipSpan } from './r_defs.h';
import { SIL_BOTTOM,SIL_TOP } from './r_defs.h';
import { bsp } from './r_bsp';
import { R_RenderMaskedSegRange } from './r_segs';
import { MAXVISSPRITES } from './r_things.h';
import { powertype_t } from './doomdef.h';
export const MINZ=4*FRACUNIT,BASEYCENTER=100;
function visSprite():vissprite_t{return{prev:null,next:null,x1:0,x2:0,gx:0,gy:0,gz:0,gzt:0,startfrac:0,scale:0,xiscale:0,texturemid:0,patch:0,colormap:null,mobjflags:0};}
type TemporaryFrame={rotate:-1|0|1;lump:Int16Array;flip:Uint8Array};
export const spritesState={
    sprites:[] as spritedef_t[],numsprites:0,sprtemp:[] as TemporaryFrame[],maxframe:-1,spritename:'',
    vissprites:[] as vissprite_t[],sorted:[] as vissprite_t[],overflowsprite:visSprite(),vsprsortedhead:visSprite(),
    spritelights:[] as Uint8Array[],mfloorclip:{data:new Int16Array(320),base:0} as ClipSpan,
    mceilingclip:{data:new Int16Array(320),base:0} as ClipSpan,spryscale:0,sprtopscreen:0,
};
function clip(span:ClipSpan,x:number):number{
    const index=x-span.base;if(index<0 || index>=span.data.length)throw new Error('Sprite clipping span outside range');return span.data[index];
}
function frameError(message:string):never{throw new Error(`R_InitSprites: ${spritesState.spritename}: ${message}`);}
export function R_InstallSpriteLump(lump:number,frame:number,rotation:number,flipped:boolean):void{
    if(!Number.isInteger(frame) || !Number.isInteger(rotation) || frame<0 || frame>=29 || rotation<0 || rotation>8)frameError('bad frame characters');
    spritesState.maxframe=Math.max(frame,spritesState.maxframe);const temp=spritesState.sprtemp[frame];
    const relative=lump-t.firstspritelump;
    if(relative<0 || relative>32767 || lump>t.lastspritelump)frameError('sprite lump outside classic signed 16-bit range');
    if(rotation===0){
        if(temp.rotate!==-1)frameError('multiple rot=0 or mixed rotations');
        temp.rotate=0;temp.lump.fill(relative);temp.flip.fill(Number(flipped));return;
    }
    if(temp.rotate===0)frameError('mixed rot=0 and numbered rotations');temp.rotate=1;
    if(temp.lump[rotation-1]!==-1)frameError('two lumps mapped to one rotation');
    temp.lump[rotation-1]=relative;temp.flip[rotation-1]=Number(flipped);
}
export function R_InitSpriteDefs(namelist:readonly string[],modifiedgame=false):void{
    const previous=spritesState.sprites,previousCount=spritesState.numsprites;
    spritesState.sprites=[];spritesState.numsprites=namelist.length;
    try{for(const name of namelist){
        if(name.length!==4)throw new Error('Sprite name must have four characters');
        spritesState.spritename=name;spritesState.maxframe=-1;
        spritesState.sprtemp=Array.from({length:29},()=>({rotate:-1 as const,lump:new Int16Array(8).fill(-1),flip:new Uint8Array(8).fill(255)}));
        for(let l=t.firstspritelump;l<=t.lastspritelump;l++){
            const lump=lumpinfo[l];if(lump.name.slice(0,4)!==name)continue;
            R_InstallSpriteLump(modifiedgame?W_GetNumForName(lump.name):l,lump.name.charCodeAt(4)-65,lump.name.charCodeAt(5)-48,false);
            if(lump.name.length>6)R_InstallSpriteLump(l,lump.name.charCodeAt(6)-65,lump.name.charCodeAt(7)-48,true);
        }
        const frames:spriteframe_t[]=[];
        for(let f=0;f<=spritesState.maxframe;f++){
            const temp=spritesState.sprtemp[f];if(temp.rotate===-1)frameError(`no patches for frame ${String.fromCharCode(65+f)}`);
            if(temp.rotate===1 && temp.lump.some(l=>l===-1))frameError('missing rotations');
            frames.push({rotate:temp.rotate===1,lump:temp.lump.slice(),flip:temp.flip.slice()});
        }
        spritesState.sprites.push({numframes:frames.length,spriteframes:frames});
    }}catch(error){spritesState.sprites=previous;spritesState.numsprites=previousCount;throw error;}
}
export function R_InitSprites(names:readonly string[],modifiedgame=false):void{view.negonearray.fill(-1);R_InitSpriteDefs(names,modifiedgame);}
export function R_ClearSprites():void{spritesState.vissprites.length=0;spritesState.sorted.length=0;}
export function R_NewVisSprite():vissprite_t{
    if(spritesState.vissprites.length===MAXVISSPRITES)return spritesState.overflowsprite;
    const vis=visSprite();spritesState.vissprites.push(vis);return vis;
}
export function R_DrawMaskedColumn(column:Uint8Array):void{
    const base=draw.dc_texturemid;let offset=0;
    try{while(true){
        if(offset>=column.length)throw new Error('Truncated sprite column');
        if(column[offset]===255)break;
        if(offset+4>column.length || offset+column[offset+1]+4>column.length)throw new Error('Truncated sprite post');
        const top=column[offset],length=column[offset+1];
        const topscreen=(spritesState.sprtopscreen+Math.imul(spritesState.spryscale,top))|0;
        const bottomscreen=(topscreen+Math.imul(spritesState.spryscale,length))|0;
        draw.dc_yl=((topscreen+FRACUNIT-1)|0)>>FRACBITS;draw.dc_yh=((bottomscreen-1)|0)>>FRACBITS;
        if(draw.dc_yh>=clip(spritesState.mfloorclip,draw.dc_x))draw.dc_yh=clip(spritesState.mfloorclip,draw.dc_x)-1;
        if(draw.dc_yl<=clip(spritesState.mceilingclip,draw.dc_x))draw.dc_yl=clip(spritesState.mceilingclip,draw.dc_x)+1;
        if(draw.dc_yl<=draw.dc_yh){draw.dc_source=column.subarray(offset+3);draw.dc_texturemid=(base-(top<<FRACBITS))|0;view.colfunc();}
        offset+=length+4;
    }}finally{draw.dc_texturemid=base;}
}
export function R_DrawVisSprite(vis:vissprite_t,_x1:number,_x2:number):void{
    const patch=W_CacheLumpNum(vis.patch+t.firstspritelump,101),header=V_PatchHeader(patch),v=new DataView(patch.buffer,patch.byteOffset,patch.byteLength);
    draw.dc_colormap=vis.colormap??t.colormaps.subarray(0,256);
    if(!vis.colormap)view.colfunc=view.fuzzcolfunc;
    else if(vis.mobjflags&mobjflag_t.MF_TRANSLATION){
        view.colfunc=R_DrawTranslatedColumn;
        const offset=-256+((vis.mobjflags&mobjflag_t.MF_TRANSLATION)>>(mobjflag_t.MF_TRANSSHIFT-8));
        draw.dc_translation=draw.translationtables.subarray(offset,offset+256);
    }
    draw.dc_iscale=Math.abs(vis.xiscale)>>view.detailshift;draw.dc_texturemid=vis.texturemid;
    spritesState.spryscale=vis.scale;spritesState.sprtopscreen=(view.centeryfrac-FixedMul(vis.texturemid,vis.scale))|0;
    let frac=vis.startfrac;
    try{for(draw.dc_x=vis.x1;draw.dc_x<=vis.x2;draw.dc_x++,frac=(frac+vis.xiscale)|0){
        const col=frac>>FRACBITS;if(col<0 || col>=header.width)throw new Error('R_DrawSpriteRange: bad texture column');
        const offset=v.getUint32(8+col*4,true);if(offset>=patch.length)throw new Error('Sprite column outside patch');
        R_DrawMaskedColumn(patch.subarray(offset));
    }}finally{view.colfunc=view.basecolfunc;}
}
export function R_ProjectSprite(thing:mobj_t):void{
    const trx=(thing.x-view.viewx)|0,tryy=(thing.y-view.viewy)|0;
    const tz=(FixedMul(trx,view.viewcos)+FixedMul(tryy,view.viewsin))|0;if(tz<MINZ)return;
    const xscale=FixedDiv(view.projection,tz);
    let tx=-(FixedMul(tryy,view.viewcos)-FixedMul(trx,view.viewsin))|0;
    if(Math.abs(tx)>(tz<<2))return;
    const definition=spritesState.sprites[thing.sprite],frame=definition?.spriteframes[thing.frame&FF_FRAMEMASK];
    if(!frame)throw new Error('R_ProjectSprite: invalid sprite or frame');
    const rotation=frame.rotate?((R_PointToAngle(thing.x,thing.y)-thing.angle+ANG45/2*9)>>>0)>>>29:0;
    const lump=frame.lump[rotation],flip=!!frame.flip[rotation];
    tx=(tx-t.spriteoffset[lump])|0;const x1=((view.centerxfrac+FixedMul(tx,xscale))|0)>>FRACBITS;
    if(x1>view.viewwidth)return;
    tx=(tx+t.spritewidth[lump])|0;const x2=(((view.centerxfrac+FixedMul(tx,xscale))|0)>>FRACBITS)-1;if(x2<0)return;
    const vis=R_NewVisSprite();vis.mobjflags=thing.flags;vis.scale=xscale<<view.detailshift;vis.gx=thing.x;vis.gy=thing.y;vis.gz=thing.z;vis.gzt=(thing.z+t.spritetopoffset[lump])|0;
    vis.texturemid=(vis.gzt-view.viewz)|0;vis.x1=Math.max(0,x1);vis.x2=Math.min(view.viewwidth-1,x2);
    const iscale=FixedDiv(FRACUNIT,xscale);vis.xiscale=flip?-iscale:iscale;vis.startfrac=flip?t.spritewidth[lump]-1:0;
    if(vis.x1>x1)vis.startfrac=(vis.startfrac+Math.imul(vis.xiscale,vis.x1-x1))|0;vis.patch=lump;
    if(thing.flags&mobjflag_t.MF_SHADOW)vis.colormap=null;
    else if(view.fixedcolormap)vis.colormap=view.fixedcolormap;
    else if(thing.frame&FF_FULLBRIGHT)vis.colormap=t.colormaps.subarray(0,256);
    else vis.colormap=spritesState.spritelights[Math.min(MAXLIGHTSCALE-1,(xscale>>(LIGHTSCALESHIFT-view.detailshift))>>>0)];
}
export function R_AddSprites(sec:sector_t):void{
    if(sec.validcount===view.validcount)return;sec.validcount=view.validcount;
    spritesState.spritelights=view.scalelight[Math.max(0,Math.min(LIGHTLEVELS-1,(sec.lightlevel>>LIGHTSEGSHIFT)+view.extralight))];
    const seen=new Set<mobj_t>();
    for(let thing=sec.thinglist;thing;thing=thing.snext){if(seen.has(thing))throw new Error('Cyclic sector actor list');seen.add(thing);R_ProjectSprite(thing);}
}
export function R_SortVisSprites():void{
    // Stable minimum-first selection preserves the original equal-scale tie order.
    const remaining=[...spritesState.vissprites],head=spritesState.vsprsortedhead;head.next=head.prev=head;spritesState.sorted=[];
    while(remaining.length){let best=0;for(let i=1;i<remaining.length;i++)if(remaining[i].scale<remaining[best].scale)best=i;
        const spr=remaining.splice(best,1)[0];spr.next=head;spr.prev=head.prev;head.prev!.next=spr;head.prev=spr;spritesState.sorted.push(spr);}
}
export function R_DrawSprite(spr:vissprite_t):void{
    const bot=new Int16Array(320).fill(-2),top=new Int16Array(320).fill(-2);
    for(let i=bsp.drawsegs.length-1;i>=0;i--){const ds=bsp.drawsegs[i];
        if(ds.x1>spr.x2 || ds.x2<spr.x1 || (!ds.silhouette && !ds.maskedtexturecol))continue;
        const r1=Math.max(ds.x1,spr.x1),r2=Math.min(ds.x2,spr.x2),scale=Math.max(ds.scale1,ds.scale2),low=Math.min(ds.scale1,ds.scale2);
        if(scale<spr.scale || (low<spr.scale && !R_PointOnSegSide(spr.gx,spr.gy,ds.curline))){if(ds.maskedtexturecol)R_RenderMaskedSegRange(ds,r1,r2);continue;}
        let silhouette=ds.silhouette;if(spr.gz>=ds.bsilheight)silhouette&=~SIL_BOTTOM;if(spr.gzt<=ds.tsilheight)silhouette&=~SIL_TOP;
        for(let x=r1;x<=r2;x++){if((silhouette&SIL_BOTTOM) && bot[x]===-2)bot[x]=clip(ds.sprbottomclip!,x);if((silhouette&SIL_TOP) && top[x]===-2)top[x]=clip(ds.sprtopclip!,x);}
    }
    for(let x=spr.x1;x<=spr.x2;x++){if(bot[x]===-2)bot[x]=view.viewheight;if(top[x]===-2)top[x]=-1;}
    spritesState.mfloorclip={data:bot,base:0};spritesState.mceilingclip={data:top,base:0};R_DrawVisSprite(spr,spr.x1,spr.x2);
}
export function R_DrawPSprite(psp:pspdef_t):void{
    const state=psp.state;if(!state)return;
    const frame=spritesState.sprites[state.sprite]?.spriteframes[state.frame&FF_FRAMEMASK];if(!frame)throw new Error('Invalid player sprite frame');
    const lump=frame.lump[0],flip=!!frame.flip[0];let tx=(psp.sx-160*FRACUNIT-t.spriteoffset[lump])|0;
    const x1=((view.centerxfrac+FixedMul(tx,view.pspritescale))|0)>>FRACBITS;if(x1>view.viewwidth)return;
    tx=(tx+t.spritewidth[lump])|0;const x2=(((view.centerxfrac+FixedMul(tx,view.pspritescale))|0)>>FRACBITS)-1;if(x2<0)return;
    const vis=visSprite();vis.texturemid=((BASEYCENTER<<FRACBITS)+FRACUNIT/2-(psp.sy-t.spritetopoffset[lump]))|0;
    vis.x1=Math.max(0,x1);vis.x2=Math.min(view.viewwidth-1,x2);vis.scale=view.pspritescale<<view.detailshift;
    vis.xiscale=flip?-view.pspriteiscale:view.pspriteiscale;vis.startfrac=flip?t.spritewidth[lump]-1:0;
    if(vis.x1>x1)vis.startfrac=(vis.startfrac+Math.imul(vis.xiscale,vis.x1-x1))|0;vis.patch=lump;
    const invisible=view.viewplayer!.powers[powertype_t.pw_invisibility];
    vis.colormap=invisible>4*32 || (invisible&8)?null:view.fixedcolormap??(state.frame&FF_FULLBRIGHT?t.colormaps.subarray(0,256):spritesState.spritelights[MAXLIGHTSCALE-1]);
    R_DrawVisSprite(vis,vis.x1,vis.x2);
}
export function R_DrawPlayerSprites():void{
    const player=view.viewplayer,sector=player?.mo?.subsector?.sector;if(!player || !sector)throw new Error('Player sprite drawing requires a player and sector');
    spritesState.spritelights=view.scalelight[Math.max(0,Math.min(LIGHTLEVELS-1,(sector.lightlevel>>LIGHTSEGSHIFT)+view.extralight))];
    spritesState.mfloorclip={data:view.screenheightarray,base:0};spritesState.mceilingclip={data:view.negonearray,base:0};
    for(let i=0;i<psprnum_t.NUMPSPRITES;i++)if(player.psprites[i]?.state)R_DrawPSprite(player.psprites[i]);
}
export function R_DrawMasked(includePlayerSprites=true):void{
    R_SortVisSprites();for(const spr of spritesState.sorted)R_DrawSprite(spr);
    for(let i=bsp.drawsegs.length-1;i>=0;i--){const ds=bsp.drawsegs[i];if(ds.maskedtexturecol)R_RenderMaskedSegRange(ds,ds.x1,ds.x2);}
    if(includePlayerSprites && !view.viewangleoffset)R_DrawPlayerSprites();
}
