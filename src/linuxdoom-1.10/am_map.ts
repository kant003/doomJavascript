// Copyright (C) 1993-1996 id Software, Inc. GPL-2.0-only.
// am_map.c: indexed native automap. Context replaces doomstat globals and ST callback.
import { MAXPLAYERS,KEY_TAB,KEY_UPARROW,KEY_DOWNARROW,KEY_LEFTARROW,KEY_RIGHTARROW,powertype_t as PW } from './doomdef.h';
import { evtype_t as EV,type event_t } from './d_event.h';
import type { player_t } from './d_player.h';
import { FRACUNIT as F } from './m_fixed.h';
import { FixedMul,FixedDiv } from './m_fixed';
import { finecosine,finesine,ANGLETOFINESHIFT } from './tables.h';
import { mapstate as s } from './r_state.h';
import { ML_MAPPED,ML_DONTDRAW,ML_SECRET } from './doomdata.h';
import { MAPBLOCKUNITS } from './p_local.h';
import { W_CheckNumForName,W_CacheLumpName } from './w_wad';
import { screens,V_DrawPatch,V_MarkRect } from './v_video';
import { cht_CheckCheat } from './m_cheat';
import { AM_MSGENTERED,AM_MSGEXITED } from './am_map.h';
import * as T from './d_englsh.h';
export interface mpoint_t {x:number;y:number}
export interface mline_t {a:mpoint_t;b:mpoint_t}
export type fpoint_t=mpoint_t;export type fline_t=mline_t;
export interface islope_t {slp:number;islp:number}
export interface automap_context_t {players:player_t[];playeringame:boolean[];consoleplayer:number;gamemap:number;gameepisode:number;netgame:boolean;deathmatch:number;singledemo:boolean;automapactive:boolean;viewactive:boolean;ST_Responder(ev:event_t):boolean}
let context:automap_context_t,plr:player_t,fb:Uint8Array;
const MAXINT=0x7fffffff,PLAYERRADIUS=16*F,F_PANINC=4,M_ZOOMIN=Math.trunc(1.02*F),M_ZOOMOUT=Math.trunc(F/1.02),AM_NUMMARKPOINTS=10;
const REDS=176,GREENS=112,GRAYS=96,BROWNS=64,YELLOWS=231,WHITE=209,GRIDCOLORS=104;
let cheating=0,grid=0,stopped=true,followplayer=true,bigstate=false,lastlevel=-1,lastepisode=-1;
let f_x=0,f_y=0,f_w=320,f_h=168,lightlev=0,amclock=0;
let m_x=0,m_y=0,m_x2=0,m_y2=0,m_w=0,m_h=0,min_x=0,min_y=0,max_x=0,max_y=0,max_w=0,max_h=0,min_w=0,min_h=0;
let min_scale_mtof=0,max_scale_mtof=0,scale_mtof=Math.trunc(.2*F),scale_ftom=0,mtof_zoommul=F,ftom_zoommul=F;
let old_m_x=0,old_m_y=0,old_m_w=0,old_m_h=0,nexttic=0,litelevelscnt=0;
const m_paninc={x:0,y:0},f_oldloc={x:MAXINT,y:0},markpoints=Array.from({length:AM_NUMMARKPOINTS},()=>({x:-1,y:0})),marknums:Uint8Array[]=[];
let markpointnum=0;
const cheat_amap={sequence:new Uint8Array([0xb2,0x26,0x26,0x2e,0xff]),p:null as number|null};
const FTOM=(x:number)=>FixedMul(x<<16,scale_ftom),MTOF=(x:number)=>FixedMul(x|0,scale_mtof)>>16;
const CXMTOF=(x:number)=>f_x+MTOF((x-m_x)|0),CYMTOF=(y:number)=>f_y+f_h-MTOF((y-m_y)|0),half=(x:number)=>Math.trunc(x/2);
const line=(ax:number,ay:number,bx:number,by:number):mline_t=>({a:{x:ax,y:ay},b:{x:bx,y:by}});
export function AM_InitContext(value:automap_context_t):void {context=value;}
export function AM_CanLoad():boolean {return Array.from({length:10},(_,i)=>W_CheckNumForName(`AMMNUM${i}`)>=0).every(Boolean);}
// Reset level identity on WAD/rebirth loads, including a new map with the same name.
export function AM_ResetLevel():void {if(context&&!stopped)AM_Stop();lastlevel=lastepisode=-1;}
export function AM_GetState(){return {active:context?.automapactive??false,clock:amclock,cheating,grid:!!grid,followplayer,scale:scale_mtof,minScale:min_scale_mtof,maxScale:max_scale_mtof,x:m_x,y:m_y,width:m_w,height:m_h,marks:markpoints.map(p=>({...p})),nextMark:markpointnum};}
export function AM_getIslope(ml:mline_t,is:islope_t):void {const dy=(ml.a.y-ml.b.y)|0,dx=(ml.b.x-ml.a.x)|0;is.islp=dy?FixedDiv(dx,dy):dx<0?-MAXINT:MAXINT;is.slp=dx?FixedDiv(dy,dx):dy<0?-MAXINT:MAXINT;}
export function AM_activateNewScale():void {m_x=(m_x+half(m_w))|0;m_y=(m_y+half(m_h))|0;m_w=FTOM(f_w);m_h=FTOM(f_h);m_x=(m_x-half(m_w))|0;m_y=(m_y-half(m_h))|0;m_x2=(m_x+m_w)|0;m_y2=(m_y+m_h)|0;}
export function AM_saveScaleAndLoc():void {old_m_x=m_x;old_m_y=m_y;old_m_w=m_w;old_m_h=m_h;}
export function AM_restoreScaleAndLoc():void {m_w=old_m_w;m_h=old_m_h;m_x=followplayer?(plr.mo!.x-half(m_w))|0:old_m_x;m_y=followplayer?(plr.mo!.y-half(m_h))|0:old_m_y;m_x2=(m_x+m_w)|0;m_y2=(m_y+m_h)|0;scale_mtof=FixedDiv(f_w<<16,m_w);scale_ftom=FixedDiv(F,scale_mtof);}
export function AM_addMark():void {markpoints[markpointnum]={x:(m_x+half(m_w))|0,y:(m_y+half(m_h))|0};markpointnum=(markpointnum+1)%AM_NUMMARKPOINTS;}
export function AM_findMinMaxBoundaries():void {
    min_x=min_y=MAXINT;max_x=max_y=-MAXINT;
    for(const v of s.vertexes){if(v.x<min_x)min_x=v.x;else if(v.x>max_x)max_x=v.x;if(v.y<min_y)min_y=v.y;else if(v.y>max_y)max_y=v.y;}
    max_w=(max_x-min_x)|0;max_h=(max_y-min_y)|0;min_w=min_h=2*PLAYERRADIUS;
    if(max_w<=0||max_h<=0)throw new Error('AM: invalid or degenerate map bounds');
    min_scale_mtof=Math.min(FixedDiv(f_w<<16,max_w),FixedDiv(f_h<<16,max_h));max_scale_mtof=FixedDiv(f_h<<16,2*PLAYERRADIUS);
}
export function AM_changeWindowLoc():void {if(m_paninc.x||m_paninc.y){followplayer=false;f_oldloc.x=MAXINT;}m_x=(m_x+m_paninc.x)|0;m_y=(m_y+m_paninc.y)|0;
    if(m_x+half(m_w)>max_x)m_x=(max_x-half(m_w))|0;else if(m_x+half(m_w)<min_x)m_x=(min_x-half(m_w))|0;
    if(m_y+half(m_h)>max_y)m_y=(max_y-half(m_h))|0;else if(m_y+half(m_h)<min_y)m_y=(min_y-half(m_h))|0;m_x2=(m_x+m_w)|0;m_y2=(m_y+m_h)|0;
}
export function AM_initVariables():void {
    context.automapactive=true;fb=screens[0];f_oldloc.x=MAXINT;amclock=lightlev=0;m_paninc.x=m_paninc.y=0;ftom_zoommul=mtof_zoommul=F;m_w=FTOM(f_w);m_h=FTOM(f_h);
    let pnum=context.consoleplayer;if(!context.playeringame[pnum])pnum=context.playeringame.findIndex(Boolean);plr=context.players[pnum];if(!plr?.mo)throw new Error('AM: no active player actor');
    m_x=(plr.mo.x-half(m_w))|0;m_y=(plr.mo.y-half(m_h))|0;AM_changeWindowLoc();AM_saveScaleAndLoc();context.ST_Responder({type:EV.ev_keyup,data1:AM_MSGENTERED,data2:0,data3:0});
}
export function AM_loadPics():void {for(let i=0;i<10;i++)marknums[i]=W_CacheLumpName(`AMMNUM${i}`,1);}
export function AM_unloadPics():void {marknums.length=0;}
export function AM_clearMarks():void {for(const p of markpoints)p.x=-1;markpointnum=0;}
export function AM_LevelInit():void {f_x=f_y=0;f_w=320;f_h=168;AM_clearMarks();AM_findMinMaxBoundaries();scale_mtof=FixedDiv(min_scale_mtof,Math.trunc(.7*F));if(scale_mtof>max_scale_mtof)scale_mtof=min_scale_mtof;scale_ftom=FixedDiv(F,scale_mtof);}
export function AM_Stop():void {
    AM_unloadPics();context.automapactive=false;
    // Published initializer {0, ev_keyup, AM_MSGEXITED} puts the fields in the
    // wrong slots. Preserve its harmless ST notification bug explicitly.
    context.ST_Responder({type:EV.ev_keydown,data1:EV.ev_keyup,data2:AM_MSGEXITED,data3:0});stopped=true;
}
export function AM_Start():void {if(!stopped)AM_Stop();stopped=false;if(lastlevel!==context.gamemap||lastepisode!==context.gameepisode){AM_LevelInit();lastlevel=context.gamemap;lastepisode=context.gameepisode;}AM_initVariables();AM_loadPics();}
export function AM_minOutWindowScale():void {scale_mtof=min_scale_mtof;scale_ftom=FixedDiv(F,scale_mtof);AM_activateNewScale();}
export function AM_maxOutWindowScale():void {scale_mtof=max_scale_mtof;scale_ftom=FixedDiv(F,scale_mtof);AM_activateNewScale();}
export function AM_Responder(ev:event_t):boolean {
    let rc=false;
    if(!context.automapactive){if(ev.type===EV.ev_keydown&&ev.data1===KEY_TAB){AM_Start();context.viewactive=false;rc=true;}}
    else if(ev.type===EV.ev_keydown){rc=true;switch(ev.data1){
        case KEY_RIGHTARROW:if(!followplayer)m_paninc.x=FTOM(F_PANINC);else rc=false;break;
        case KEY_LEFTARROW:if(!followplayer)m_paninc.x=-FTOM(F_PANINC);else rc=false;break;
        case KEY_UPARROW:if(!followplayer)m_paninc.y=FTOM(F_PANINC);else rc=false;break;
        case KEY_DOWNARROW:if(!followplayer)m_paninc.y=-FTOM(F_PANINC);else rc=false;break;
        case 45:mtof_zoommul=M_ZOOMOUT;ftom_zoommul=M_ZOOMIN;break;
        case 61:mtof_zoommul=M_ZOOMIN;ftom_zoommul=M_ZOOMOUT;break;
        case KEY_TAB:bigstate=false;context.viewactive=true;AM_Stop();break;
        case 48:bigstate=!bigstate;if(bigstate){AM_saveScaleAndLoc();AM_minOutWindowScale();}else AM_restoreScaleAndLoc();break;
        case 102:followplayer=!followplayer;f_oldloc.x=MAXINT;plr.message=followplayer?T.AMSTR_FOLLOWON:T.AMSTR_FOLLOWOFF;break;
        case 103:grid=1-grid;plr.message=grid?T.AMSTR_GRIDON:T.AMSTR_GRIDOFF;break;
        case 109:plr.message=`${T.AMSTR_MARKEDSPOT} ${markpointnum}`;AM_addMark();break;
        case 99:AM_clearMarks();plr.message=T.AMSTR_MARKSCLEARED;break;
        default:rc=false;
    }if(!context.deathmatch&&cht_CheckCheat(cheat_amap,ev.data1)){rc=false;cheating=(cheating+1)%3;}}
    else if(ev.type===EV.ev_keyup){switch(ev.data1){case KEY_RIGHTARROW:case KEY_LEFTARROW:if(!followplayer)m_paninc.x=0;break;case KEY_UPARROW:case KEY_DOWNARROW:if(!followplayer)m_paninc.y=0;break;case 45:case 61:mtof_zoommul=ftom_zoommul=F;break;}}
    return rc;
}
export function AM_changeWindowScale():void {scale_mtof=FixedMul(scale_mtof,mtof_zoommul);scale_ftom=FixedDiv(F,scale_mtof);if(scale_mtof<min_scale_mtof)AM_minOutWindowScale();else if(scale_mtof>max_scale_mtof)AM_maxOutWindowScale();else AM_activateNewScale();}
export function AM_doFollowPlayer():void {if(f_oldloc.x!==plr.mo!.x||f_oldloc.y!==plr.mo!.y){m_x=(FTOM(MTOF(plr.mo!.x))-half(m_w))|0;m_y=(FTOM(MTOF(plr.mo!.y))-half(m_h))|0;m_x2=(m_x+m_w)|0;m_y2=(m_y+m_h)|0;Object.assign(f_oldloc,{x:plr.mo!.x,y:plr.mo!.y});}}
export function AM_updateLightLev():void {const levels=[0,4,7,10,12,14,15,15];if(amclock>nexttic){lightlev=levels[litelevelscnt++];if(litelevelscnt===levels.length)litelevelscnt=0;nexttic=amclock+6-amclock%6;}}
export function AM_Ticker():void {if(!context.automapactive)return;amclock++;if(followplayer)AM_doFollowPlayer();if(ftom_zoommul!==F)AM_changeWindowScale();if(m_paninc.x||m_paninc.y)AM_changeWindowLoc();/* AM_updateLightLev is commented out upstream. */}
export function AM_clearFB(color:number):void {fb.fill(color,0,f_w*f_h);}
export function AM_clipMline(ml:mline_t,fl:fline_t):boolean {
    const LEFT=1,RIGHT=2,BOTTOM=4,TOP=8;let a=ml.a.y>m_y2?TOP:ml.a.y<m_y?BOTTOM:0,b=ml.b.y>m_y2?TOP:ml.b.y<m_y?BOTTOM:0;if(a&b)return false;
    a|=ml.a.x<m_x?LEFT:ml.a.x>m_x2?RIGHT:0;b|=ml.b.x<m_x?LEFT:ml.b.x>m_x2?RIGHT:0;if(a&b)return false;
    fl.a={x:CXMTOF(ml.a.x),y:CYMTOF(ml.a.y)};fl.b={x:CXMTOF(ml.b.x),y:CYMTOF(ml.b.y)};
    const out=(p:fpoint_t)=>(p.y<0?TOP:p.y>=f_h?BOTTOM:0)|(p.x<0?LEFT:p.x>=f_w?RIGHT:0);a=out(fl.a);b=out(fl.b);if(a&b)return false;
    for(let guard=0;a|b;guard++){if(guard>16)throw new Error('AM: line clipping failed to converge');const outside=a||b;let x:number,y:number,dx:number,dy:number;
        if(outside&TOP){dy=fl.a.y-fl.b.y;dx=fl.b.x-fl.a.x;x=fl.a.x+Math.trunc(Math.imul(dx,fl.a.y)/dy);y=0;}
        else if(outside&BOTTOM){dy=fl.a.y-fl.b.y;dx=fl.b.x-fl.a.x;x=fl.a.x+Math.trunc(Math.imul(dx,fl.a.y-f_h)/dy);y=f_h-1;}
        else if(outside&RIGHT){dy=fl.b.y-fl.a.y;dx=fl.b.x-fl.a.x;y=fl.a.y+Math.trunc(Math.imul(dy,f_w-1-fl.a.x)/dx);x=f_w-1;}
        else {dy=fl.b.y-fl.a.y;dx=fl.b.x-fl.a.x;y=fl.a.y+Math.trunc(Math.imul(dy,-fl.a.x)/dx);x=0;}
        const p={x:x|0,y:y|0};if(outside===a){fl.a=p;a=out(fl.a);}else {fl.b=p;b=out(fl.b);}if(a&b)return false;
    }return true;
}
export function AM_drawFline(fl:fline_t,color:number):void {
    if([fl.a,fl.b].some(p=>!Number.isInteger(p.x)||!Number.isInteger(p.y)))throw new Error(`AM: invalid screen line ${JSON.stringify(fl)}`);
    if([fl.a,fl.b].some(p=>p.x<0||p.x>=f_w||p.y<0||p.y>=f_h))return;
    const dx=fl.b.x-fl.a.x,ax=2*Math.abs(dx),sx=dx<0?-1:1,dy=fl.b.y-fl.a.y,ay=2*Math.abs(dy),sy=dy<0?-1:1;let {x,y}=fl.a;
    if(ax>ay){let d=ay-half(ax);for(;;){fb[y*f_w+x]=color;if(x===fl.b.x)return;if(d>=0){y+=sy;d-=ax;}x+=sx;d+=ay;}}
    else {let d=ax-half(ay);for(;;){fb[y*f_w+x]=color;if(y===fl.b.y)return;if(d>=0){x+=sx;d-=ay;}y+=sy;d+=ax;}}
}
export function AM_drawMline(ml:mline_t,color:number):void {const fl=line(0,0,0,0);if(AM_clipMline(ml,fl))AM_drawFline(fl,color);}
export function AM_drawGrid(color:number):void {
    const block=MAPBLOCKUNITS*F;let start=m_x;if((start-s.bmaporgx)%block)start+=block-(start-s.bmaporgx)%block;
    for(let x=start;x<m_x+m_w;x+=block)AM_drawMline(line(x,m_y,x,m_y+m_h),color);
    start=m_y;if((start-s.bmaporgy)%block)start+=block-(start-s.bmaporgy)%block;
    for(let y=start;y<m_y+m_h;y+=block)AM_drawMline(line(m_x,y,m_x+m_w,y),color);
}
export function AM_drawWalls():void {
    for(const wall of s.lines){const l={a:{...wall.v1},b:{...wall.v2}};if(cheating||(wall.flags&ML_MAPPED)){
        if((wall.flags&ML_DONTDRAW)&&!cheating)continue;
        if(!wall.backsector)AM_drawMline(l,REDS+lightlev);
        else if(wall.special===39)AM_drawMline(l,REDS+8);
        else if(wall.flags&ML_SECRET)AM_drawMline(l,REDS+lightlev);
        else if(wall.backsector.floorheight!==wall.frontsector!.floorheight)AM_drawMline(l,BROWNS+lightlev);
        else if(wall.backsector.ceilingheight!==wall.frontsector!.ceilingheight)AM_drawMline(l,YELLOWS+lightlev);
        else if(cheating)AM_drawMline(l,GRAYS+lightlev);
    }else if(plr.powers[PW.pw_allmap]&&!(wall.flags&ML_DONTDRAW))AM_drawMline(l,GRAYS+3);}
}
export function AM_rotate(p:mpoint_t,angle:number):void {const a=(angle>>>0)>>>ANGLETOFINESHIFT,x=(FixedMul(p.x,finecosine[a])-FixedMul(p.y,finesine[a]))|0;p.y=(FixedMul(p.x,finesine[a])+FixedMul(p.y,finecosine[a]))|0;p.x=x;}
export function AM_drawLineCharacter(guy:mline_t[],count:number,scale:number,angle:number,color:number,x:number,y:number):void {
    for(let i=0;i<count;i++){const l={a:{...guy[i].a},b:{...guy[i].b}};for(const p of [l.a,l.b]){if(scale){p.x=FixedMul(scale,p.x);p.y=FixedMul(scale,p.y);}if(angle)AM_rotate(p,angle);p.x=(p.x+x)|0;p.y=(p.y+y)|0;}AM_drawMline(l,color);}
}
export function AM_drawPlayers():void {
    if(!context.netgame){const guy=cheating?cheat_player_arrow:player_arrow;AM_drawLineCharacter(guy,guy.length,0,plr.mo!.angle,WHITE,plr.mo!.x,plr.mo!.y);return;}
    const colors=[GREENS,GRAYS,BROWNS,REDS];for(let i=0;i<MAXPLAYERS;i++){const p=context.players[i];if(context.deathmatch&&!context.singledemo&&p!==plr)continue;if(!context.playeringame[i])continue;AM_drawLineCharacter(player_arrow,player_arrow.length,0,p.mo!.angle,p.powers[PW.pw_invisibility]?246:colors[i],p.mo!.x,p.mo!.y);}
}
export function AM_drawThings(colors:number,_range:number):void {for(const sector of s.sectors)for(let thing=sector.thinglist;thing;thing=thing.snext)AM_drawLineCharacter(thintriangle_guy,thintriangle_guy.length,16*F,thing.angle,colors+lightlev,thing.x,thing.y);}
export function AM_drawMarks():void {for(let i=0;i<AM_NUMMARKPOINTS;i++){const p=markpoints[i];if(p.x!==-1){const x=CXMTOF(p.x),y=CYMTOF(p.y);if(x>=f_x&&x<=f_w-5&&y>=f_y&&y<=f_h-6)V_DrawPatch(x,y,0,marknums[i]);}}}
export function AM_drawCrosshair(color:number):void {fb[Math.trunc(f_w*(f_h+1)/2)]=color;}
export function AM_Drawer():void {if(!context.automapactive)return;AM_clearFB(0);if(grid)AM_drawGrid(GRIDCOLORS);AM_drawWalls();AM_drawPlayers();if(cheating===2)AM_drawThings(GREENS,16);AM_drawCrosshair(GRAYS);AM_drawMarks();V_MarkRect(f_x,f_y,f_w,f_h);}
export const player_arrow:mline_t[]=[{"a":{"x":-1048576,"y":0},"b":{"x":1198372,"y":0}},{"a":{"x":1198372,"y":0},"b":{"x":599186,"y":299593}},{"a":{"x":1198372,"y":0},"b":{"x":599186,"y":-299593}},{"a":{"x":-1048576,"y":0},"b":{"x":-1348168,"y":299593}},{"a":{"x":-1048576,"y":0},"b":{"x":-1348168,"y":-299593}},{"a":{"x":-748983,"y":0},"b":{"x":-1048576,"y":299593}},{"a":{"x":-748983,"y":0},"b":{"x":-1048576,"y":-299593}}];
export const cheat_player_arrow:mline_t[]=[{"a":{"x":-1048576,"y":0},"b":{"x":1198372,"y":0}},{"a":{"x":1198372,"y":0},"b":{"x":599186,"y":199728}},{"a":{"x":1198372,"y":0},"b":{"x":599186,"y":-199728}},{"a":{"x":-1048576,"y":0},"b":{"x":-1348168,"y":199728}},{"a":{"x":-1048576,"y":0},"b":{"x":-1348168,"y":-199728}},{"a":{"x":-748983,"y":0},"b":{"x":-1048576,"y":199728}},{"a":{"x":-748983,"y":0},"b":{"x":-1048576,"y":-199728}},{"a":{"x":-599186,"y":0},"b":{"x":-599186,"y":-199728}},{"a":{"x":-599186,"y":-199728},"b":{"x":-399458,"y":-199728}},{"a":{"x":-399458,"y":-199728},"b":{"x":-399458,"y":299593}},{"a":{"x":-199728,"y":0},"b":{"x":-199728,"y":-199728}},{"a":{"x":-199728,"y":-199728},"b":{"x":0,"y":-199728}},{"a":{"x":0,"y":-199728},"b":{"x":0,"y":299593}},{"a":{"x":199728,"y":299593},"b":{"x":199728,"y":-171196}},{"a":{"x":199728,"y":-171196},"b":{"x":237177,"y":-208645}},{"a":{"x":237177,"y":-208645},"b":{"x":319565,"y":-171196}}];
export const triangle_guy:mline_t[]=[{"a":{"x":-56819,"y":-32768},"b":{"x":56819,"y":-32768}},{"a":{"x":56819,"y":-32768},"b":{"x":0,"y":65536}},{"a":{"x":0,"y":65536},"b":{"x":-56819,"y":-32768}}];
export const thintriangle_guy:mline_t[]=[{"a":{"x":-32768,"y":-45875},"b":{"x":65536,"y":0}},{"a":{"x":65536,"y":0},"b":{"x":-32768,"y":45875}},{"a":{"x":-32768,"y":45875},"b":{"x":-32768,"y":-45875}}];
