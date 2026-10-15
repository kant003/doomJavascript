// Copyright (C) 1993-1996 id Software, Inc. GPL-2.0-only.
// Single-player wi_stuff.c counters and transitions. WAD graphics, animation,
// music, netgame and deathmatch intermissions remain pending (see PORTING.md).
import { GameMode_t,MAXPLAYERS,TICRATE } from './doomdef.h';
import { buttoncode_t as BT } from './d_event.h';
import type { player_t,wbstartstruct_t,wbplayerstruct_t } from './d_player.h';
import { sfxenum_t as SFX } from './sounds.h';
import { stateenum_t as ST } from './wi_stuff.h';
export interface intermission_context_t {
    gamemode:GameMode_t;netgame:boolean;deathmatch:number;players:player_t[];playeringame:boolean[];
    S_StartSound(origin:null,sound:SFX):void;G_WorldDone():void;
}
let context:intermission_context_t;
let wbs:wbstartstruct_t,plrs:wbplayerstruct_t[],me=0;
let state=ST.StatCount,acceleratestage=0,cnt=0,bcnt=0,sp_state=1,cnt_pause=TICRATE;
const cnt_kills=[-1],cnt_items=[-1],cnt_secret=[-1];
let cnt_time=-1,cnt_par=-1,snl_pointeron=false;
export function WI_InitContext(value:intermission_context_t):void {context=value;}
// Presentation adapter: copies counters without exposing mutable engine storage.
export function WI_GetState(){return {state,sp_state,cnt,bcnt,kills:cnt_kills[0],items:cnt_items[0],secret:cnt_secret[0],time:cnt_time,par:cnt_par,snl_pointeron};}
export function WI_initNoState():void {state=ST.NoState;acceleratestage=0;cnt=10;}
export function WI_updateNoState():void {
    if(!--cnt)context.G_WorldDone(); // WI_End only unloads graphics, not yet loaded by this partial port.
}
export function WI_initShowNextLoc():void {state=ST.ShowNextLoc;acceleratestage=0;cnt=4*TICRATE;}
export function WI_updateShowNextLoc():void {
    if(!--cnt||acceleratestage)WI_initNoState();
    else snl_pointeron=(cnt&31)<20;
}
export function WI_initStats():void {
    state=ST.StatCount;acceleratestage=0;sp_state=1;
    cnt_kills[0]=cnt_items[0]=cnt_secret[0]=-1;cnt_time=cnt_par=-1;cnt_pause=TICRATE;
}
const percent=(value:number,total:number)=>Math.trunc(value*100/total);
export function WI_updateStats():void {
    const p=plrs[me],kills=percent(p.skills,wbs.maxkills),items=percent(p.sitems,wbs.maxitems),secret=percent(p.ssecret,wbs.maxsecret);
    const time=Math.trunc(p.stime/TICRATE),par=Math.trunc(wbs.partime/TICRATE);
    const sound=(id:SFX)=>context.S_StartSound(null,id);
    if(acceleratestage&&sp_state!==10){
        acceleratestage=0;cnt_kills[0]=kills;cnt_items[0]=items;cnt_secret[0]=secret;
        cnt_time=time;cnt_par=par;sound(SFX.sfx_barexp);sp_state=10;
    }
    if(sp_state===2){
        cnt_kills[0]+=2;if(!(bcnt&3))sound(SFX.sfx_pistol);
        if(cnt_kills[0]>=kills){cnt_kills[0]=kills;sound(SFX.sfx_barexp);sp_state++;}
    }else if(sp_state===4){
        cnt_items[0]+=2;if(!(bcnt&3))sound(SFX.sfx_pistol);
        if(cnt_items[0]>=items){cnt_items[0]=items;sound(SFX.sfx_barexp);sp_state++;}
    }else if(sp_state===6){
        cnt_secret[0]+=2;if(!(bcnt&3))sound(SFX.sfx_pistol);
        if(cnt_secret[0]>=secret){cnt_secret[0]=secret;sound(SFX.sfx_barexp);sp_state++;}
    }else if(sp_state===8){
        if(!(bcnt&3))sound(SFX.sfx_pistol);
        cnt_time+=3;if(cnt_time>=time)cnt_time=time;
        cnt_par+=3;if(cnt_par>=par){cnt_par=par;if(cnt_time>=time){sound(SFX.sfx_barexp);sp_state++;}}
    }else if(sp_state===10){
        if(acceleratestage){sound(SFX.sfx_sgcock);if(context.gamemode===GameMode_t.commercial)WI_initNoState();else WI_initShowNextLoc();}
    }else if(sp_state&1){if(!--cnt_pause){sp_state++;cnt_pause=TICRATE;}}
}
export function WI_checkForAccelerate():void {
    for(let i=0;i<MAXPLAYERS;i++)if(context.playeringame[i]){
        const p=context.players[i];
        if(p.cmd.buttons&BT.BT_ATTACK){if(!p.attackdown)acceleratestage=1;p.attackdown=1;}else p.attackdown=0;
        if(p.cmd.buttons&BT.BT_USE){if(!p.usedown)acceleratestage=1;p.usedown=1;}else p.usedown=0;
    }
}
export function WI_Ticker():void {
    bcnt++;WI_checkForAccelerate();
    switch(state){case ST.StatCount:WI_updateStats();break;case ST.ShowNextLoc:WI_updateShowNextLoc();break;case ST.NoState:WI_updateNoState();break;}
}
export function WI_initVariables(info:wbstartstruct_t):void {
    wbs=info;acceleratestage=0;cnt=bcnt=0;me=wbs.pnum;plrs=wbs.plyr;
    if(!wbs.maxkills)wbs.maxkills=1;if(!wbs.maxitems)wbs.maxitems=1;if(!wbs.maxsecret)wbs.maxsecret=1;
    if(context.gamemode!==GameMode_t.retail&&wbs.epsd>2)wbs.epsd-=3;
}
export function WI_Start(info:wbstartstruct_t):void {
    if(!context)throw new Error('Intermission context is not linked');
    if(context.netgame||context.deathmatch)throw new Error('Multiplayer intermission is not ported');
    if(!info.plyr[info.pnum])throw new Error('WI_Start: invalid player');
    WI_initVariables(info);WI_initStats();
}
