// Copyright (C) 1993-1996 id Software, Inc. GPL-2.0-only.
// Single-player wi_stuff.c counters, transitions and graphics. Music, netgame
// and deathmatch intermissions remain pending (see PORTING.md).
import { M_Random } from './m_random';
import { W_CacheLumpName,W_CheckNumForName } from './w_wad';
import { screens,V_MarkRect,V_DrawPatch,V_PatchHeader } from './v_video';
import type { event_t } from './d_event.h';
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
    WI_updateAnimatedBack();if(!--cnt){WI_End();context.G_WorldDone();}
}
export function WI_initShowNextLoc():void {state=ST.ShowNextLoc;acceleratestage=0;cnt=4*TICRATE;WI_initAnimatedBack();}
export function WI_updateShowNextLoc():void {
    WI_updateAnimatedBack();
    if(!--cnt||acceleratestage)WI_initNoState();
    else snl_pointeron=(cnt&31)<20;
}
export function WI_initStats():void {
    state=ST.StatCount;acceleratestage=0;sp_state=1;
    cnt_kills[0]=cnt_items[0]=cnt_secret[0]=-1;cnt_time=cnt_par=-1;cnt_pause=TICRATE;WI_initAnimatedBack();
}
const percent=(value:number,total:number)=>Math.trunc(value*100/total);
export function WI_updateStats():void {
    WI_updateAnimatedBack();
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
    if(!Number.isInteger(info.epsd)||info.epsd<0||info.epsd>3)throw new Error('WI_Start: invalid episode');
    if(!info.plyr[info.pnum])throw new Error('WI_Start: invalid player');
    WI_initVariables(info);WI_unloadData();if(requiredGraphics().every(name=>W_CheckNumForName(name)>=0))WI_loadData();WI_initStats();
}

// Single-player graphics from wi_stuff.c. Multiplayer-only labels/faces and zone
// allocator tags are not loaded; WAD cache ownership replaces Z_ChangeTag/Z_Free.
interface point_t {x:number;y:number}
enum animenum_t { ANIM_ALWAYS,ANIM_RANDOM,ANIM_LEVEL }
interface anim_t {type:animenum_t;period:number;nanims:number;loc:point_t;data1:number;data2:number;p:Uint8Array[];nexttic:number;ctr:number}
const lnodes:point_t[][]=[
    [[185,164],[148,143],[69,122],[209,102],[116,89],[166,55],[71,56],[135,29],[71,24]],
    [[254,25],[97,50],[188,64],[128,78],[214,92],[133,130],[208,136],[148,140],[235,158]],
    [[156,168],[48,154],[174,95],[265,75],[130,48],[279,23],[198,48],[140,25],[281,136]]
].map(episode=>episode.map(([x,y])=>({x,y})));
function animation(type:animenum_t,period:number,nanims:number,x:number,y:number,data1=0,data2=0):anim_t {return {type,period,nanims,loc:{x,y},data1,data2,p:[],nexttic:0,ctr:0};}
const anims:anim_t[][]=[
    [[224,104],[184,160],[112,136],[72,112],[88,96],[64,48],[192,40],[136,16],[80,16],[64,24]].map(([x,y])=>animation(animenum_t.ANIM_ALWAYS,Math.trunc(TICRATE/3),3,x,y)),
    [...Array.from({length:7},(_,i)=>animation(animenum_t.ANIM_LEVEL,Math.trunc(TICRATE/3),1,128,136,i+1)),animation(animenum_t.ANIM_LEVEL,Math.trunc(TICRATE/3),3,192,144,8),animation(animenum_t.ANIM_LEVEL,Math.trunc(TICRATE/3),1,128,136,8)],
    [[104,168],[40,136],[160,96],[104,80],[120,32],[40,0]].map(([x,y],i)=>animation(animenum_t.ANIM_ALWAYS,Math.trunc(TICRATE/(i===5?4:3)),3,x,y))
];
let graphics:Map<string,Uint8Array>|null=null;
let lnames:Uint8Array[]=[];
const commonNames=['WIMINUS',...Array.from({length:10},(_,i)=>`WINUM${i}`),'WIPCNT','WIF','WIENTER','WIOSTK','WISCRT2','WIOSTI','WICOLON','WITIME','WISUCKS','WIPAR'];
const cache=(name:string)=>{const patch=graphics?.get(name);if(!patch)throw new Error(`Intermission graphics are not loaded: ${name}`);return patch;};
const width=(patch:Uint8Array)=>V_PatchHeader(patch).width;
const height=(patch:Uint8Array)=>V_PatchHeader(patch).height;
function backgroundName():string {return context.gamemode===GameMode_t.commercial||context.gamemode===GameMode_t.retail&&wbs.epsd===3?'INTERPIC':`WIMAP${wbs.epsd}`;}
function levelNames():string[]{return context.gamemode===GameMode_t.commercial?Array.from({length:32},(_,i)=>`CWILV${String(i).padStart(2,'0')}`):Array.from({length:9},(_,i)=>`WILV${wbs.epsd}${i}`);}
function animationName(episode:number,index:number,frame:number):string {return `WIA${episode}${String(index).padStart(2,'0')}${String(frame).padStart(2,'0')}`;}
function requiredGraphics():string[]{
    const result=[backgroundName(),...levelNames(),...commonNames];
    if(context.gamemode!==GameMode_t.commercial){
        result.push('WIURH0','WIURH1','WISPLAT');
        if(wbs.epsd<3)anims[wbs.epsd]?.forEach((a,j)=>{if(wbs.epsd===1&&j===8)return;for(let i=0;i<a.nanims;i++)result.push(animationName(wbs.epsd,j,i));});
    }
    return result;
}
export function WI_CanDraw():boolean {return graphics!==null;}
// Diagnostic snapshots do not expose mutable animation state or patch storage.
export function WI_GetAnimations(){return (anims[wbs?.epsd]??[]).map(a=>({type:a.type,period:a.period,nanims:a.nanims,nexttic:a.nexttic,ctr:a.ctr}));}
export function WI_loadData():void {
    const loaded=new Map<string,Uint8Array>();
    for(const name of requiredGraphics())loaded.set(name,W_CacheLumpName(name,1));
    graphics=loaded;lnames=levelNames().map(name=>cache(name));
    V_DrawPatch(0,0,1,cache(backgroundName()));
    if(context.gamemode!==GameMode_t.commercial&&wbs.epsd<3){
        anims[wbs.epsd].forEach((a,j)=>{a.p=Array.from({length:a.nanims},(_,i)=>wbs.epsd===1&&j===8?anims[1][4].p[i]:cache(animationName(wbs.epsd,j,i)));});
    }
}
export function WI_unloadData():void {graphics=null;lnames=[];for(const episode of anims)for(const a of episode)a.p=[];}
export function WI_End():void {WI_unloadData();}
export function WI_slamBackground():void {screens[0].set(screens[1]);V_MarkRect(0,0,320,200);}
export function WI_Responder(_event:event_t):boolean {return false;}
export function WI_drawLF():void {
    const name=lnames[wbs.last];if(!name)throw new Error('Invalid completed-level title index');
    let y=2;V_DrawPatch(Math.trunc((320-width(name))/2),y,0,name);y+=Math.trunc(5*height(name)/4);
    const finished=cache('WIF');V_DrawPatch(Math.trunc((320-width(finished))/2),y,0,finished);
}
export function WI_drawEL():void {
    const name=lnames[wbs.next];if(!name)throw new Error('Invalid next-level title index');
    const entering=cache('WIENTER');let y=2;V_DrawPatch(Math.trunc((320-width(entering))/2),y,0,entering);
    y+=Math.trunc(5*height(name)/4);V_DrawPatch(Math.trunc((320-width(name))/2),y,0,name);
}
export function WI_drawOnLnode(n:number,choices:readonly Uint8Array[]):void {
    const node=lnodes[wbs.epsd]?.[n];if(!node)throw new Error('Invalid intermission map node');
    for(const patch of choices.slice(0,2)){
        const h=V_PatchHeader(patch),left=node.x-h.leftoffset,top=node.y-h.topoffset;
        if(left>=0&&left+h.width<320&&top>=0&&top+h.height<200){V_DrawPatch(node.x,node.y,0,patch);return;}
    }
    // Unlike &splat in C, a one-element array cannot read an unrelated pointer.
    console.warn(`Could not place patch on level ${n+1}`);
}
export function WI_initAnimatedBack():void {
    if(context.gamemode===GameMode_t.commercial||wbs.epsd>2)return;
    for(const a of anims[wbs.epsd]){
        a.ctr=-1;
        if(a.type===animenum_t.ANIM_ALWAYS)a.nexttic=bcnt+1+M_Random()%a.period;
        else if(a.type===animenum_t.ANIM_RANDOM)a.nexttic=bcnt+1+a.data2+M_Random()%a.data1;
        else a.nexttic=bcnt+1;
    }
}
export function WI_updateAnimatedBack():void {
    if(context.gamemode===GameMode_t.commercial||wbs.epsd>2)return;
    anims[wbs.epsd].forEach((a,i)=>{
        if(bcnt!==a.nexttic)return;
        switch(a.type){
            case animenum_t.ANIM_ALWAYS:if(++a.ctr>=a.nanims)a.ctr=0;a.nexttic=bcnt+a.period;break;
            case animenum_t.ANIM_RANDOM:a.ctr++;if(a.ctr===a.nanims){a.ctr=-1;a.nexttic=bcnt+a.data2+M_Random()%a.data1;}else a.nexttic=bcnt+a.period;break;
            case animenum_t.ANIM_LEVEL:if(!(state===ST.StatCount&&i===7)&&wbs.next===a.data1){a.ctr++;if(a.ctr===a.nanims)a.ctr--;a.nexttic=bcnt+a.period;}break;
        }
    });
}
export function WI_drawAnimatedBack():void {
    // Upstream tests the enum constant "commercial", not "gamemode". Its value
    // is 2, so this published Linux source never draws these animation patches.
    if(GameMode_t.commercial)return;
    if(wbs.epsd>2)return;
    for(const a of anims[wbs.epsd])if(a.ctr>=0)V_DrawPatch(a.loc.x,a.loc.y,0,a.p[a.ctr]);
}
export function WI_drawNum(x:number,y:number,n:number,digits:number):number {
    const fontwidth=width(cache('WINUM0'));
    if(digits<0){if(!n)digits=1;else{digits=0;let temp=n;while(temp){temp=Math.trunc(temp/10);digits++;}}}
    const neg=n<0;if(neg)n=-n;if(n===1994)return 0;
    while(digits--){x-=fontwidth;V_DrawPatch(x,y,0,cache(`WINUM${n%10}`));n=Math.trunc(n/10);}
    if(neg)V_DrawPatch(x-=8,y,0,cache('WIMINUS'));return x;
}
export function WI_drawPercent(x:number,y:number,p:number):void {if(p<0)return;V_DrawPatch(x,y,0,cache('WIPCNT'));WI_drawNum(x,y,p,-1);}
export function WI_drawTime(x:number,y:number,t:number):void {
    if(t<0)return;
    if(t<=61*59){let div=1;do{const n=Math.trunc(t/div)%60;x=WI_drawNum(x,y,n,2)-width(cache('WICOLON'));div*=60;if(div===60||Math.trunc(t/div))V_DrawPatch(x,y,0,cache('WICOLON'));}while(Math.trunc(t/div));}
    else {const sucks=cache('WISUCKS');V_DrawPatch(x-width(sucks),y,0,sucks);}
}
export function WI_drawStats():void {
    const lh=Math.trunc(3*height(cache('WINUM0'))/2);
    WI_slamBackground();WI_drawAnimatedBack();WI_drawLF();
    V_DrawPatch(50,50,0,cache('WIOSTK'));WI_drawPercent(270,50,cnt_kills[0]);
    V_DrawPatch(50,50+lh,0,cache('WIOSTI'));WI_drawPercent(270,50+lh,cnt_items[0]);
    V_DrawPatch(50,50+2*lh,0,cache('WISCRT2'));WI_drawPercent(270,50+2*lh,cnt_secret[0]);
    V_DrawPatch(16,168,0,cache('WITIME'));WI_drawTime(144,168,cnt_time);
    if(wbs.epsd<3){V_DrawPatch(176,168,0,cache('WIPAR'));WI_drawTime(304,168,cnt_par);}
}
export function WI_drawShowNextLoc():void {
    WI_slamBackground();WI_drawAnimatedBack();
    if(context.gamemode!==GameMode_t.commercial){
        if(wbs.epsd>2){WI_drawEL();return;}
        const last=wbs.last===8?wbs.next-1:wbs.last;
        for(let i=0;i<=last;i++)WI_drawOnLnode(i,[cache('WISPLAT')]);
        if(wbs.didsecret)WI_drawOnLnode(8,[cache('WISPLAT')]);
        if(snl_pointeron)WI_drawOnLnode(wbs.next,[cache('WIURH0'),cache('WIURH1')]);
    }
    if(context.gamemode!==GameMode_t.commercial||wbs.next!==30)WI_drawEL();
}
export function WI_drawNoState():void {snl_pointeron=true;WI_drawShowNextLoc();}
export function WI_Drawer():void {
    switch(state){case ST.StatCount:WI_drawStats();break;case ST.ShowNextLoc:WI_drawShowNextLoc();break;case ST.NoState:WI_drawNoState();break;}
}
