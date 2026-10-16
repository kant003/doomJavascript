// Copyright (C) 1993-1996 id Software, Inc. GPL-2.0-only.
// st_stuff.c presentation, widget/face ticker and palettes. Cheats/automap responder pending.
import { MAXPLAYERS,TICRATE,weapontype_t as WP,ammotype_t as AM,powertype_t as PW } from './doomdef.h';
import { cheat_t as CF,type player_t } from './d_player.h';
import { ANG45,ANG180 } from './tables.h';
import { M_Random } from './m_random';
import { R_PointToAngle2 } from './r_main';
import { weaponinfo } from './d_items';
import { W_CacheLumpName,W_CheckNumForName,W_GetNumForName,W_CacheLumpNum } from './w_wad';
import { V_DrawPatch,V_CopyRect,screens } from './v_video';
import { BG,FG,type st_number_t,type st_percent_t,type st_multicon_t,type st_binicon_t } from './st_lib.h';
import { ST_HEIGHT,ST_WIDTH,ST_Y,st_chatstateenum_t as CHAT,st_stateenum_t as STATE } from './st_stuff.h';
import * as L from './st_lib';
const STARTREDPALS=1,STARTBONUSPALS=9,NUMREDPALS=8,NUMBONUSPALS=4,RADIATIONPAL=13;
const ST_NUMPAINFACES=5,ST_NUMSTRAIGHTFACES=3,ST_NUMTURNFACES=2,ST_NUMSPECIALFACES=3;
const ST_FACESTRIDE=ST_NUMSTRAIGHTFACES+ST_NUMTURNFACES+ST_NUMSPECIALFACES;
const ST_TURNOFFSET=ST_NUMSTRAIGHTFACES,ST_OUCHOFFSET=ST_TURNOFFSET+ST_NUMTURNFACES;
const ST_EVILGRINOFFSET=ST_OUCHOFFSET+1,ST_RAMPAGEOFFSET=ST_EVILGRINOFFSET+1;
const ST_GODFACE=ST_NUMPAINFACES*ST_FACESTRIDE,ST_DEADFACE=ST_GODFACE+1;
const ST_EVILGRINCOUNT=2*TICRATE,ST_STRAIGHTFACECOUNT=Math.trunc(TICRATE/2),ST_TURNCOUNT=TICRATE,ST_RAMPAGEDELAY=2*TICRATE,ST_MUCHPAIN=20;
export interface status_context_t {players:player_t[];consoleplayer:number;deathmatch:number;netgame:boolean;automapactive:boolean;I_SetPalette(palette:Uint8Array):void}
let context:status_context_t,plyr:player_t;
let st_firsttime=true,st_clock=0,st_msgcounter=0,st_chatstate=CHAT.StartChatState,st_gamestate=STATE.FirstPersonState;
let st_chat=false,st_oldchat=false,st_cursoron=false,st_statusbaron=true,st_notdeathmatch=true,st_armson=true,st_fragson=false;
let st_fragscount=0,st_oldhealth=-1,st_facecount=0,st_faceindex=0,st_randomnumber=0,st_palette=0,st_stopped=true;
let lastcalc=0,painOldHealth=-1,lastattackdown=-1,priority=0,lu_palette=0,palettes:Uint8Array|null=null;
const oldweaponsowned:boolean[]=[],keyboxes=[-1,-1,-1],tallnum:Uint8Array[]=[],shortnum:Uint8Array[]=[],keys:Uint8Array[]=[],faces:Uint8Array[]=[],arms:Uint8Array[][]=[];
let sbar:Uint8Array,faceback:Uint8Array,armsbg:Uint8Array,tallpercent:Uint8Array;
const w_ready={} as st_number_t,w_frags={} as st_number_t,w_health={} as st_percent_t,w_armor={} as st_percent_t,w_armsbg={} as st_binicon_t,w_faces={} as st_multicon_t;
const w_arms:st_multicon_t[]=[],w_keyboxes:st_multicon_t[]=[],w_ammo:st_number_t[]=[],w_maxammo:st_number_t[]=[];
export function ST_InitContext(value:status_context_t):void {context=value;}
function graphicsNames():string[] {
    const names=['STTMINUS','STTPRCNT','STARMS',`STFB${context.consoleplayer}`,'STBAR'];
    for(let i=0;i<10;i++)names.push(`STTNUM${i}`,`STYSNUM${i}`);
    for(let i=0;i<6;i++)names.push(`STKEYS${i}`,`STGNUM${i+2}`);
    for(let i=0;i<ST_NUMPAINFACES;i++){for(let j=0;j<ST_NUMSTRAIGHTFACES;j++)names.push(`STFST${i}${j}`);names.push(`STFTR${i}0`,`STFTL${i}0`,`STFOUCH${i}`,`STFEVL${i}`,`STFKILL${i}`);}
    names.push('STFGOD0','STFDEAD0');return names;
}
export function ST_CanLoad():boolean {return !!context&&W_CheckNumForName('PLAYPAL')>=0&&graphicsNames().every(name=>W_CheckNumForName(name)>=0);}
export function ST_IsRunning():boolean {return !st_stopped;}
export function ST_GetState(){return {running:!st_stopped,clock:st_clock,faceindex:st_faceindex,facecount:st_facecount,priority,palette:st_palette,keyboxes:[...keyboxes],readyammo:plyr?readyAmmo():1994,frags:st_fragscount,statusbaron:st_statusbaron};}
function readyAmmo():number {const ammo=weaponinfo[plyr.readyweapon].ammo;return ammo===AM.am_noammo?1994:plyr.ammo[ammo];}
export function ST_refreshBackground():void {if(st_statusbaron){V_DrawPatch(0,0,BG,sbar);if(context.netgame)V_DrawPatch(143,0,BG,faceback);V_CopyRect(0,0,BG,ST_WIDTH,ST_HEIGHT,0,ST_Y,FG);}}
export function ST_calcPainOffset():number {const health=Math.min(100,plyr.health);if(health!==painOldHealth){lastcalc=ST_FACESTRIDE*Math.trunc((100-health)*ST_NUMPAINFACES/101);painOldHealth=health;}return lastcalc;}
export function ST_updateFaceWidget():void {
    if(priority<10&&!plyr.health){priority=9;st_faceindex=ST_DEADFACE;st_facecount=1;}
    if(priority<9&&plyr.bonuscount){let grin=false;for(let i=0;i<WP.NUMWEAPONS;i++)if(oldweaponsowned[i]!==plyr.weaponowned[i]){grin=true;oldweaponsowned[i]=plyr.weaponowned[i];}if(grin){priority=8;st_facecount=ST_EVILGRINCOUNT;st_faceindex=ST_calcPainOffset()+ST_EVILGRINOFFSET;}}
    if(priority<8&&plyr.damagecount&&plyr.attacker&&plyr.attacker!==plyr.mo){
        priority=7;
        // Preserve the published C sign error: health-oldhealth, not the reverse.
        if(plyr.health-st_oldhealth>ST_MUCHPAIN){st_facecount=ST_TURNCOUNT;st_faceindex=ST_calcPainOffset()+ST_OUCHOFFSET;}
        else {
            const angle=R_PointToAngle2(plyr.mo!.x,plyr.mo!.y,plyr.attacker.x,plyr.attacker.y),own=plyr.mo!.angle>>>0;
            let diff:number,right:boolean;if(angle>own){diff=(angle-own)>>>0;right=diff>ANG180;}else {diff=(own-angle)>>>0;right=diff<=ANG180;}
            st_facecount=ST_TURNCOUNT;st_faceindex=ST_calcPainOffset()+(diff<ANG45?ST_RAMPAGEOFFSET:right?ST_TURNOFFSET:ST_TURNOFFSET+1);
        }
    }
    if(priority<7&&plyr.damagecount){if(plyr.health-st_oldhealth>ST_MUCHPAIN){priority=7;st_facecount=ST_TURNCOUNT;st_faceindex=ST_calcPainOffset()+ST_OUCHOFFSET;}else {priority=6;st_facecount=ST_TURNCOUNT;st_faceindex=ST_calcPainOffset()+ST_RAMPAGEOFFSET;}}
    if(priority<6){if(plyr.attackdown){if(lastattackdown===-1)lastattackdown=ST_RAMPAGEDELAY;else if(!--lastattackdown){priority=5;st_faceindex=ST_calcPainOffset()+ST_RAMPAGEOFFSET;st_facecount=1;lastattackdown=1;}}else lastattackdown=-1;}
    if(priority<5&&((plyr.cheats&CF.CF_GODMODE)||plyr.powers[PW.pw_invulnerability])){priority=4;st_faceindex=ST_GODFACE;st_facecount=1;}
    if(!st_facecount){st_faceindex=ST_calcPainOffset()+st_randomnumber%ST_NUMSTRAIGHTFACES;st_facecount=ST_STRAIGHTFACECOUNT;priority=0;}
    st_facecount--;
}
export function ST_updateWidgets():void {
    w_ready.num=readyAmmo;w_ready.data=plyr.readyweapon;
    for(let i=0;i<3;i++){keyboxes[i]=plyr.cards[i]?i:-1;if(plyr.cards[i+3])keyboxes[i]=i+3;}
    ST_updateFaceWidget();st_notdeathmatch=!context.deathmatch;st_armson=st_statusbaron&&!context.deathmatch;st_fragson=!!context.deathmatch&&st_statusbaron;
    st_fragscount=0;for(let i=0;i<MAXPLAYERS;i++)st_fragscount+=i!==context.consoleplayer?plyr.frags[i]:-plyr.frags[i];
    if(!--st_msgcounter)st_chat=st_oldchat;
}
export function ST_Ticker():void {st_clock=(st_clock+1)>>>0;st_randomnumber=M_Random();ST_updateWidgets();st_oldhealth=plyr.health;}
export function ST_doPaletteStuff():void {
    let cnt=plyr.damagecount;if(plyr.powers[PW.pw_strength])cnt=Math.max(cnt,12-(plyr.powers[PW.pw_strength]>>6));
    const palette=cnt?Math.min((cnt+7)>>3,NUMREDPALS-1)+STARTREDPALS:plyr.bonuscount?Math.min((plyr.bonuscount+7)>>3,NUMBONUSPALS-1)+STARTBONUSPALS:(plyr.powers[PW.pw_ironfeet]>4*32||(plyr.powers[PW.pw_ironfeet]&8))?RADIATIONPAL:0;
    if(palette!==st_palette){st_palette=palette;const data=palettes!;context.I_SetPalette(data.length>=(palette+1)*768?data.subarray(palette*768,(palette+1)*768):data.subarray(0,768));}
}
export function ST_drawWidgets(refresh:boolean):void {
    st_armson=st_statusbaron&&!context.deathmatch;st_fragson=!!context.deathmatch&&st_statusbaron;
    L.STlib_updateNum(w_ready,refresh);for(let i=0;i<4;i++){L.STlib_updateNum(w_ammo[i],refresh);L.STlib_updateNum(w_maxammo[i],refresh);}
    L.STlib_updatePercent(w_health,refresh);L.STlib_updatePercent(w_armor,refresh);L.STlib_updateBinIcon(w_armsbg,refresh);
    for(const widget of w_arms)L.STlib_updateMultIcon(widget,refresh);L.STlib_updateMultIcon(w_faces,refresh);
    for(const widget of w_keyboxes)L.STlib_updateMultIcon(widget,refresh);L.STlib_updateNum(w_frags,refresh);
}
export function ST_doRefresh():void {st_firsttime=false;ST_refreshBackground();ST_drawWidgets(true);}
export function ST_diffDraw():void {ST_drawWidgets(false);}
export function ST_Drawer(fullscreen:boolean,refresh:boolean):void {st_statusbaron=!fullscreen||context.automapactive;st_firsttime=st_firsttime||refresh;ST_doPaletteStuff();if(st_firsttime)ST_doRefresh();else ST_diffDraw();}
export function ST_loadGraphics():void {
    const load=(name:string)=>W_CacheLumpName(name,1);
    for(let i=0;i<10;i++){tallnum[i]=load(`STTNUM${i}`);shortnum[i]=load(`STYSNUM${i}`);}tallpercent=load('STTPRCNT');
    for(let i=0;i<6;i++){keys[i]=load(`STKEYS${i}`);arms[i]=[load(`STGNUM${i+2}`),shortnum[i+2]];}
    armsbg=load('STARMS');faceback=load(`STFB${context.consoleplayer}`);sbar=load('STBAR');faces.length=0;
    for(let i=0;i<ST_NUMPAINFACES;i++){for(let j=0;j<ST_NUMSTRAIGHTFACES;j++)faces.push(load(`STFST${i}${j}`));faces.push(load(`STFTR${i}0`),load(`STFTL${i}0`),load(`STFOUCH${i}`),load(`STFEVL${i}`),load(`STFKILL${i}`));}faces.push(load('STFGOD0'),load('STFDEAD0'));
}
export function ST_loadData():void {lu_palette=W_GetNumForName('PLAYPAL');palettes=W_CacheLumpNum(lu_palette,1);if(palettes.length<768)throw new Error('PLAYPAL must contain at least 768 bytes');ST_loadGraphics();}
export function ST_unloadGraphics():void {
    tallnum.length=shortnum.length=keys.length=faces.length=arms.length=0;
    w_arms.length=w_keyboxes.length=w_ammo.length=w_maxammo.length=0;
    sbar=faceback=armsbg=tallpercent=new Uint8Array();w_armsbg.p=new Uint8Array();w_health.p=w_armor.p=new Uint8Array();
}
export function ST_unloadData():void {ST_unloadGraphics();palettes=null;}
export function ST_initData():void {
    st_firsttime=true;plyr=context.players[context.consoleplayer];st_clock=0;st_chatstate=CHAT.StartChatState;st_gamestate=STATE.FirstPersonState;st_statusbaron=true;st_oldchat=st_chat=false;st_cursoron=false;
    st_faceindex=0;st_palette=-1;st_oldhealth=-1;for(let i=0;i<WP.NUMWEAPONS;i++)oldweaponsowned[i]=plyr.weaponowned[i];keyboxes.fill(-1);L.STlib_init();
}
export function ST_createWidgets():void {
    const on=()=>st_statusbaron;
    L.STlib_initNum(w_ready,44,171,tallnum,readyAmmo,on,3);w_ready.data=plyr.readyweapon;
    L.STlib_initPercent(w_health,90,171,tallnum,()=>plyr.health,on,tallpercent);
    L.STlib_initBinIcon(w_armsbg,104,168,armsbg,()=>st_notdeathmatch,on);
    for(let i=0;i<6;i++){const w={} as st_multicon_t;L.STlib_initMultIcon(w,111+(i%3)*12,172+Math.trunc(i/3)*10,arms[i],()=>Number(plyr.weaponowned[i+1]),()=>st_armson);w_arms[i]=w;}
    L.STlib_initNum(w_frags,138,171,tallnum,()=>st_fragscount,()=>st_fragson,2);
    L.STlib_initMultIcon(w_faces,143,168,faces,()=>st_faceindex,on);L.STlib_initPercent(w_armor,221,171,tallnum,()=>plyr.armorpoints,on,tallpercent);
    for(let i=0;i<3;i++){const w={} as st_multicon_t;L.STlib_initMultIcon(w,239,171+i*10,keys,()=>keyboxes[i],on);w_keyboxes[i]=w;}
    for(let i=0;i<4;i++){const y=[173,179,191,185][i],a={} as st_number_t,m={} as st_number_t;L.STlib_initNum(a,288,y,shortnum,()=>plyr.ammo[i],on,3);L.STlib_initNum(m,314,y,shortnum,()=>plyr.maxammo[i],on,3);w_ammo[i]=a;w_maxammo[i]=m;}
}
export function ST_Start():void {if(!st_stopped)ST_Stop();ST_initData();ST_createWidgets();st_stopped=false;}
export function ST_Stop():void {if(st_stopped)return;if(palettes)context.I_SetPalette(palettes.subarray(0,768));st_stopped=true;}
export function ST_Init():void {ST_loadData();screens[4]=new Uint8Array(ST_WIDTH*ST_HEIGHT);}
