// Copyright (C) 1993-1996 id Software, Inc. GPL-2.0-only.
// Original opaque wall tiers, visplane marking and saved sprite clipping. Masked drawing pending.
import { bsp } from './r_bsp';
import { view,R_PointToDist,R_ScaleFromGlobalAngle } from './r_main';
import { LIGHTSEGSHIFT,LIGHTLEVELS,LIGHTSCALESHIFT,MAXLIGHTSCALE } from './r_main.h';
import { ANG90,ANG180,ANGLETOFINESHIFT } from './tables.h';
import { finesine,finetangent } from './tables';
import { FixedMul } from './m_fixed';
import { FRACBITS,FRACUNIT } from './m_fixed.h';
import { ML_MAPPED,ML_DONTPEGBOTTOM,ML_DONTPEGTOP } from './doomdata.h';
import { MAXINT,MININT } from './doomtype.h';
import { SIL_BOTH,SIL_BOTTOM,SIL_TOP,MAXDRAWSEGS } from './r_defs.h';
import type { drawseg_t,ClipSpan } from './r_defs.h';
import { texturestate as t,R_GetColumn } from './r_data';
import { planes,R_CheckPlane } from './r_plane';
import { draw } from './r_draw';
import { sky } from './r_sky';
export const HEIGHTBITS=12,HEIGHTUNIT=1<<HEIGHTBITS;
export const wall={
    rw_normalangle:0,rw_angle1:0,rw_x:0,rw_stopx:0,rw_centerangle:0,rw_offset:0,rw_distance:0,rw_scale:0,rw_scalestep:0,
    rw_midtexturemid:0,rw_toptexturemid:0,rw_bottomtexturemid:0,worldtop:0,worldbottom:0,worldhigh:0,worldlow:0,
    pixhigh:0,pixlow:0,pixhighstep:0,pixlowstep:0,topfrac:0,topstep:0,bottomfrac:0,bottomstep:0,
    midtexture:0,toptexture:0,bottomtexture:0,maskedtexture:false,markfloor:false,markceiling:false,segtextured:false,
    maskedtexturecol:null as ClipSpan|null,
};
export function R_RenderSegLoop():void{
    for(;wall.rw_x<wall.rw_stopx;wall.rw_x++){
        const x=wall.rw_x;
        let yl=((wall.topfrac+HEIGHTUNIT-1)|0)>>HEIGHTBITS;
        if(yl<planes.ceilingclip[x]+1)yl=planes.ceilingclip[x]+1;
        if(wall.markceiling){
            const top=planes.ceilingclip[x]+1,bottom=Math.min(yl-1,planes.floorclip[x]-1);
            if(top<=bottom){planes.ceilingplane!.top[x+1]=top;planes.ceilingplane!.bottom[x+1]=bottom;}
        }
        let yh=wall.bottomfrac>>HEIGHTBITS;if(yh>=planes.floorclip[x])yh=planes.floorclip[x]-1;
        if(wall.markfloor){
            const top=Math.max(yh+1,planes.ceilingclip[x]+1),bottom=planes.floorclip[x]-1;
            if(top<=bottom){planes.floorplane!.top[x+1]=top;planes.floorplane!.bottom[x+1]=bottom;}
        }
        let texturecolumn=0;
        if(wall.segtextured){
            const angle=((wall.rw_centerangle+view.xtoviewangle[x])>>>0)>>>ANGLETOFINESHIFT;
            if(angle>=finetangent.length)throw new Error('Wall texture angle outside tangent table');
            texturecolumn=((wall.rw_offset-FixedMul(finetangent[angle],wall.rw_distance))|0)>>FRACBITS;
            draw.dc_colormap=view.walllights[Math.min(MAXLIGHTSCALE-1,(wall.rw_scale>>LIGHTSCALESHIFT)>>>0)];
            draw.dc_x=x;draw.dc_iscale=Math.floor(0xffffffff/(wall.rw_scale>>>0))|0;
        }
        if(wall.midtexture){
            draw.dc_yl=yl;draw.dc_yh=yh;draw.dc_texturemid=wall.rw_midtexturemid;draw.dc_source=R_GetColumn(wall.midtexture,texturecolumn);view.colfunc();
            planes.ceilingclip[x]=view.viewheight;planes.floorclip[x]=-1;
        }else{
            if(wall.toptexture){
                let mid=wall.pixhigh>>HEIGHTBITS;wall.pixhigh=(wall.pixhigh+wall.pixhighstep)|0;
                if(mid>=planes.floorclip[x])mid=planes.floorclip[x]-1;
                if(mid>=yl){draw.dc_yl=yl;draw.dc_yh=mid;draw.dc_texturemid=wall.rw_toptexturemid;draw.dc_source=R_GetColumn(wall.toptexture,texturecolumn);view.colfunc();planes.ceilingclip[x]=mid;}
                else planes.ceilingclip[x]=yl-1;
            }else if(wall.markceiling)planes.ceilingclip[x]=yl-1;
            if(wall.bottomtexture){
                let mid=((wall.pixlow+HEIGHTUNIT-1)|0)>>HEIGHTBITS;wall.pixlow=(wall.pixlow+wall.pixlowstep)|0;
                if(mid<=planes.ceilingclip[x])mid=planes.ceilingclip[x]+1;
                if(mid<=yh){draw.dc_yl=mid;draw.dc_yh=yh;draw.dc_texturemid=wall.rw_bottomtexturemid;draw.dc_source=R_GetColumn(wall.bottomtexture,texturecolumn);view.colfunc();planes.floorclip[x]=mid;}
                else planes.floorclip[x]=yh+1;
            }else if(wall.markfloor)planes.floorclip[x]=yh+1;
            if(wall.maskedtexture){const span=wall.maskedtexturecol!;span.data[x-span.base]=texturecolumn;}
        }
        wall.rw_scale=(wall.rw_scale+wall.rw_scalestep)|0;wall.topfrac=(wall.topfrac+wall.topstep)|0;wall.bottomfrac=(wall.bottomfrac+wall.bottomstep)|0;
    }
}
function opening(start:number,length:number,source?:Int16Array):ClipSpan{
    if(planes.lastopening+length>planes.openings.length)throw new Error('R_StoreWallRange: opening overflow');
    const data=planes.openings.subarray(planes.lastopening,planes.lastopening+length);planes.lastopening+=length;
    if(source)data.set(source.subarray(start,start+length));return{data,base:start};
}
export function R_StoreWallRange(start:number,stop:number):void{
    if(bsp.drawsegs.length===MAXDRAWSEGS)return;
    if(start<0 || start>=view.viewwidth || stop>=view.viewwidth || start>stop)throw new Error('Bad R_RenderWallRange');
    const line=bsp.curline;if(!line || !bsp.frontsector)throw new Error('Missing current wall sector');
    const side=line.sidedef,linedef=line.linedef,front=bsp.frontsector,back=bsp.backsector;
    linedef.flags|=ML_MAPPED;
    wall.rw_normalangle=(line.angle+ANG90)>>>0;
    let offsetangle=Math.min(ANG90,Math.abs((wall.rw_normalangle-wall.rw_angle1)|0));
    const hyp=R_PointToDist(line.v1.x,line.v1.y);
    wall.rw_distance=FixedMul(hyp,finesine[(ANG90-offsetangle)>>>ANGLETOFINESHIFT]);
    wall.rw_x=start;wall.rw_stopx=stop+1;
    const scale1=wall.rw_scale=R_ScaleFromGlobalAngle((view.viewangle+view.xtoviewangle[start])>>>0);
    const scale2=stop>start?R_ScaleFromGlobalAngle((view.viewangle+view.xtoviewangle[stop])>>>0):scale1;
    wall.rw_scalestep=stop>start?Math.trunc((scale2-scale1)/(stop-start)):0;
    const ds:drawseg_t={curline:line,x1:start,x2:stop,scale1,scale2,scalestep:wall.rw_scalestep,silhouette:0,bsilheight:0,tsilheight:0,sprtopclip:null,sprbottomclip:null,maskedtexturecol:null};
    wall.worldtop=(front.ceilingheight-view.viewz)|0;wall.worldbottom=(front.floorheight-view.viewz)|0;
    wall.midtexture=wall.toptexture=wall.bottomtexture=0;wall.maskedtexture=false;wall.maskedtexturecol=null;
    if(!back){
        wall.midtexture=t.texturetranslation[side.midtexture];wall.markfloor=wall.markceiling=true;
        wall.rw_midtexturemid=linedef.flags&ML_DONTPEGBOTTOM?(front.floorheight+t.textureheight[side.midtexture]-view.viewz)|0:wall.worldtop;
        wall.rw_midtexturemid=(wall.rw_midtexturemid+side.rowoffset)|0;
        ds.silhouette=SIL_BOTH;ds.sprtopclip={data:view.screenheightarray,base:0};ds.sprbottomclip={data:view.negonearray,base:0};ds.bsilheight=MAXINT;ds.tsilheight=MININT;
    }else{
        if(front.floorheight>back.floorheight){ds.silhouette=SIL_BOTTOM;ds.bsilheight=front.floorheight;}
        else if(back.floorheight>view.viewz){ds.silhouette=SIL_BOTTOM;ds.bsilheight=MAXINT;}
        if(front.ceilingheight<back.ceilingheight){ds.silhouette|=SIL_TOP;ds.tsilheight=front.ceilingheight;}
        else if(back.ceilingheight<view.viewz){ds.silhouette|=SIL_TOP;ds.tsilheight=MININT;}
        if(back.ceilingheight<=front.floorheight){ds.sprbottomclip={data:view.negonearray,base:0};ds.bsilheight=MAXINT;ds.silhouette|=SIL_BOTTOM;}
        if(back.floorheight>=front.ceilingheight){ds.sprtopclip={data:view.screenheightarray,base:0};ds.tsilheight=MININT;ds.silhouette|=SIL_TOP;}
        wall.worldhigh=(back.ceilingheight-view.viewz)|0;wall.worldlow=(back.floorheight-view.viewz)|0;
        if(front.ceilingpic===sky.skyflatnum && back.ceilingpic===sky.skyflatnum)wall.worldtop=wall.worldhigh;
        wall.markfloor=wall.worldlow!==wall.worldbottom || back.floorpic!==front.floorpic || back.lightlevel!==front.lightlevel;
        wall.markceiling=wall.worldhigh!==wall.worldtop || back.ceilingpic!==front.ceilingpic || back.lightlevel!==front.lightlevel;
        if(back.ceilingheight<=front.floorheight || back.floorheight>=front.ceilingheight)wall.markfloor=wall.markceiling=true;
        if(wall.worldhigh<wall.worldtop){
            wall.toptexture=t.texturetranslation[side.toptexture];
            wall.rw_toptexturemid=linedef.flags&ML_DONTPEGTOP?wall.worldtop:(back.ceilingheight+t.textureheight[side.toptexture]-view.viewz)|0;
        }
        if(wall.worldlow>wall.worldbottom){wall.bottomtexture=t.texturetranslation[side.bottomtexture];wall.rw_bottomtexturemid=linedef.flags&ML_DONTPEGBOTTOM?wall.worldtop:wall.worldlow;}
        wall.rw_toptexturemid=(wall.rw_toptexturemid+side.rowoffset)|0;wall.rw_bottomtexturemid=(wall.rw_bottomtexturemid+side.rowoffset)|0;
        if(side.midtexture){wall.maskedtexture=true;ds.maskedtexturecol=wall.maskedtexturecol=opening(start,stop-start+1);}
    }
    wall.segtextured=!!(wall.midtexture|wall.toptexture|wall.bottomtexture|Number(wall.maskedtexture));
    if(wall.segtextured){
        offsetangle=(wall.rw_normalangle-wall.rw_angle1)>>>0;if(offsetangle>ANG180)offsetangle=(-offsetangle)>>>0;offsetangle=Math.min(offsetangle,ANG90);
        wall.rw_offset=FixedMul(hyp,finesine[offsetangle>>>ANGLETOFINESHIFT]);
        if(((wall.rw_normalangle-wall.rw_angle1)>>>0)<ANG180)wall.rw_offset=-wall.rw_offset;
        wall.rw_offset=(wall.rw_offset+side.textureoffset+line.offset)|0;wall.rw_centerangle=(ANG90+view.viewangle-wall.rw_normalangle)>>>0;
        if(!view.fixedcolormap){
            let lightnum=(front.lightlevel>>LIGHTSEGSHIFT)+view.extralight;
            if(line.v1.y===line.v2.y)lightnum--;else if(line.v1.x===line.v2.x)lightnum++;
            view.walllights=view.scalelight[Math.max(0,Math.min(LIGHTLEVELS-1,lightnum))];
        }
    }
    if(front.floorheight>=view.viewz)wall.markfloor=false;
    if(front.ceilingheight<=view.viewz && front.ceilingpic!==sky.skyflatnum)wall.markceiling=false;
    wall.worldtop>>=4;wall.worldbottom>>=4;
    wall.topstep=-FixedMul(wall.rw_scalestep,wall.worldtop);wall.topfrac=((view.centeryfrac>>4)-FixedMul(wall.worldtop,wall.rw_scale))|0;
    wall.bottomstep=-FixedMul(wall.rw_scalestep,wall.worldbottom);wall.bottomfrac=((view.centeryfrac>>4)-FixedMul(wall.worldbottom,wall.rw_scale))|0;
    if(back){
        wall.worldhigh>>=4;wall.worldlow>>=4;
        if(wall.worldhigh<wall.worldtop){wall.pixhigh=((view.centeryfrac>>4)-FixedMul(wall.worldhigh,wall.rw_scale))|0;wall.pixhighstep=-FixedMul(wall.rw_scalestep,wall.worldhigh);}
        if(wall.worldlow>wall.worldbottom){wall.pixlow=((view.centeryfrac>>4)-FixedMul(wall.worldlow,wall.rw_scale))|0;wall.pixlowstep=-FixedMul(wall.rw_scalestep,wall.worldlow);}
    }
    if(wall.markceiling){if(!planes.ceilingplane)throw new Error('Missing ceiling visplane');planes.ceilingplane=R_CheckPlane(planes.ceilingplane,start,stop);}
    if(wall.markfloor){if(!planes.floorplane)throw new Error('Missing floor visplane');planes.floorplane=R_CheckPlane(planes.floorplane,start,stop);}
    R_RenderSegLoop();
    if(((ds.silhouette&SIL_TOP)||wall.maskedtexture) && !ds.sprtopclip)ds.sprtopclip=opening(start,stop-start+1,planes.ceilingclip);
    if(((ds.silhouette&SIL_BOTTOM)||wall.maskedtexture) && !ds.sprbottomclip)ds.sprbottomclip=opening(start,stop-start+1,planes.floorclip);
    if(wall.maskedtexture && !(ds.silhouette&SIL_TOP)){ds.silhouette|=SIL_TOP;ds.tsilheight=MININT;}
    if(wall.maskedtexture && !(ds.silhouette&SIL_BOTTOM)){ds.silhouette|=SIL_BOTTOM;ds.bsilheight=MAXINT;}
    bsp.drawsegs.push(ds);
}
