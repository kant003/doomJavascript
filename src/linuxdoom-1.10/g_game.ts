// Copyright (C) 1993-1996 id Software, Inc. GPL-2.0-only.
// Partial g_game.c: player lifecycle and level completion; other game actions remain pending.
import { playerstate_t as PST,type player_t } from './d_player.h';
import { weapontype_t as WP,ammotype_t as AM,MAXPLAYERS } from './doomdef.h';
import { maxammo } from './p_inter';
import { MAXHEALTH } from './p_local.h';
import { GameMode_t,gamestate_t as GS } from './doomdef.h';
import { gameaction_t as GA } from './d_event.h';
import type { wbstartstruct_t } from './d_player.h';
import { mobjflag_t as MF } from './p_mobj.h';
import { W_CheckNumForName } from './w_wad';
import { leveltime } from './p_tick';
// Zero-initialized storage with the new-game reborn marker; original rebirth fills gameplay defaults.
export function G_CreatePlayer():player_t {
    return {mo:null,playerstate:PST.PST_REBORN,cmd:{forwardmove:0,sidemove:0,angleturn:0,consistancy:0,chatchar:0,buttons:0},
        viewz:0,viewheight:0,deltaviewheight:0,bob:0,health:0,armorpoints:0,armortype:0,powers:new Int32Array(6),cards:Array(6).fill(false),backpack:false,
        frags:new Int32Array(MAXPLAYERS),readyweapon:WP.wp_fist,pendingweapon:WP.wp_fist,weaponowned:Array(9).fill(false),ammo:new Int32Array(4),maxammo:new Int32Array(4),
        attackdown:0,usedown:0,cheats:0,refire:0,killcount:0,itemcount:0,secretcount:0,message:null,damagecount:0,bonuscount:0,attacker:null,
        extralight:0,fixedcolormap:0,colormap:0,psprites:Array.from({length:2},()=>({state:null,tics:0,sx:0,sy:0})),didsecret:false};
}
let players:player_t[]|null=null;
export function G_InitGameContext(context:{players:player_t[]}):void {players=context.players;}
export function G_PlayerReborn(index:number):void {
    const p=players?.[index];if(!p)throw new Error('G_PlayerReborn: invalid player or missing context');
    const frags=p.frags.slice(),killcount=p.killcount,itemcount=p.itemcount,secretcount=p.secretcount;
    Object.assign(p,G_CreatePlayer());p.frags.set(frags);p.killcount=killcount;p.itemcount=itemcount;p.secretcount=secretcount;
    p.usedown=p.attackdown=1;p.playerstate=PST.PST_LIVE;p.health=MAXHEALTH;
    p.readyweapon=p.pendingweapon=WP.wp_pistol;p.weaponowned[WP.wp_fist]=p.weaponowned[WP.wp_pistol]=true;
    p.ammo[AM.am_clip]=50;p.maxammo.set(maxammo);
}

export interface completion_context_t {
    players:player_t[];playeringame:boolean[];consoleplayer:number;gamemode:GameMode_t;gameepisode:number;gamemap:number;
    gameaction:GA;gamestate:GS;secretexit:boolean;automapactive:boolean;viewactive:boolean;
    totalkills:number;totalitems:number;totalsecret:number;wminfo:wbstartstruct_t;
    AM_Stop():void;WI_Start(info:wbstartstruct_t):void;F_StartFinale():void;G_DoLoadLevel():void;
}
let completion:completion_context_t|null=null;
export function G_InitCompletionContext(context:completion_context_t):void {completion=context;}
function flow():completion_context_t {if(!completion)throw new Error('Game completion context is not linked');return completion;}
export function G_CreateIntermission():wbstartstruct_t {
    return {epsd:0,didsecret:false,last:0,next:0,maxkills:0,maxitems:0,maxsecret:0,maxfrags:0,partime:0,pnum:0,
        plyr:Array.from({length:MAXPLAYERS},()=>({in:false,skills:0,sitems:0,ssecret:0,stime:0,frags:new Int32Array(MAXPLAYERS),score:0}))};
}
export const pars=[ Array(10).fill(0), [0,30,75,120,90,165,180,180,30,165], [0,90,90,90,120,90,360,240,30,170], [0,90,45,90,150,90,90,165,30,135] ];
export const cpars=[30,90,120,120,90,150,120,120,270,90,210,150,150,150,210,150,420,150,210,150,240,150,180,150,150,300,330,420,300,180,120,30];
export function G_PlayerFinishLevel(index:number):void {
    const p=players?.[index];if(!p?.mo)throw new Error('G_PlayerFinishLevel: player has no actor');
    p.powers.fill(0);p.cards.fill(false);p.mo.flags&=~MF.MF_SHADOW;
    p.extralight=p.fixedcolormap=p.damagecount=p.bonuscount=0;
}
export function G_ExitLevel():void {const g=flow();g.secretexit=false;g.gameaction=GA.ga_completed;}
export function G_SecretExitLevel():void {const g=flow();g.secretexit=!(g.gamemode===GameMode_t.commercial&&W_CheckNumForName('MAP31')<0);g.gameaction=GA.ga_completed;}
export function G_DoCompleted():void {
    const g=flow(),w=g.wminfo;g.gameaction=GA.ga_nothing;
    for(let i=0;i<MAXPLAYERS;i++)if(g.playeringame[i])G_PlayerFinishLevel(i);
    if(g.automapactive)g.AM_Stop();
    if(g.gamemode!==GameMode_t.commercial){
        if(g.gamemap===8){g.gameaction=GA.ga_victory;return;}
        if(g.gamemap===9)for(const player of g.players)player.didsecret=true;
    }
    w.didsecret=g.players[g.consoleplayer].didsecret;w.epsd=g.gameepisode-1;w.last=g.gamemap-1;
    if(g.gamemode===GameMode_t.commercial){
        if(g.secretexit){switch(g.gamemap){case 15:w.next=30;break;case 31:w.next=31;break;}}
        else {switch(g.gamemap){case 31:case 32:w.next=15;break;default:w.next=g.gamemap;}}
    } else {
        if(g.secretexit)w.next=8;
        else if(g.gamemap===9){switch(g.gameepisode){case 1:w.next=3;break;case 2:w.next=5;break;case 3:w.next=6;break;case 4:w.next=2;break;}}
        else w.next=g.gamemap;
    }
    w.maxkills=g.totalkills;w.maxitems=g.totalitems;w.maxsecret=g.totalsecret;w.maxfrags=0;
    // The original has no episode-four row in pars. Do not read beyond the array.
    w.partime=35*(g.gamemode===GameMode_t.commercial?cpars[g.gamemap-1]??0:pars[g.gameepisode]?.[g.gamemap]??0);
    w.pnum=g.consoleplayer;
    for(let i=0;i<MAXPLAYERS;i++){
        const p=g.players[i],entry=w.plyr[i];entry.in=g.playeringame[i];entry.skills=p.killcount;entry.sitems=p.itemcount;entry.ssecret=p.secretcount;entry.stime=leveltime;entry.frags.set(p.frags);
    }
    g.gamestate=GS.GS_INTERMISSION;g.viewactive=false;g.automapactive=false;g.WI_Start(w);
}
export function G_WorldDone():void {
    const g=flow();g.gameaction=GA.ga_worlddone;
    if(g.secretexit)g.players[g.consoleplayer].didsecret=true;
    if(g.gamemode===GameMode_t.commercial){
        switch(g.gamemap){case 15:case 31:if(!g.secretexit)break;
            case 6:case 11:case 20:case 30:g.F_StartFinale();break;}
    }
}
export function G_DoWorldDone():void {
    const g=flow();g.gamestate=GS.GS_LEVEL;g.gamemap=g.wminfo.next+1;g.G_DoLoadLevel();g.gameaction=GA.ga_nothing;g.viewactive=true;
}
