// Copyright (C) 1993-1996 id Software, Inc. GPL-2.0-only.
// Partial g_game.c: player lifecycle, progression, command building and demo streams.
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

// Deferred new games are processed outside event/render/actor traversal.
import { skill_t } from './doomdef.h';
import { M_ClearRandom } from './m_random';
import { states,mobjinfo } from './info';
import { statenum_t as ST,mobjtype_t as MT } from './info.h';
import { FRACUNIT } from './m_fixed.h';
export interface newgame_context_t extends completion_context_t {
    gameskill:skill_t;paused:boolean;demoplayback:boolean;netdemo:boolean;netgame:boolean;deathmatch:number;
    respawnparm:boolean;respawnmonsters:boolean;fastparm:boolean;nomonsters:boolean;usergame:boolean;
    S_ResumeSound():void;SetSkyForLevel(episode:number,map:number):void;
}
let newgame:newgame_context_t,d_skill:skill_t,d_episode:number,d_map:number;
export function G_InitNewContext(g:newgame_context_t):void {newgame=g;}
export function G_GetDeferredNewGame(){return {skill:d_skill,episode:d_episode,map:d_map};}
export function G_DeferedInitNew(skill:skill_t,episode:number,map:number):void {d_skill=skill;d_episode=episode;d_map=map;newgame.gameaction=GA.ga_newgame;}
export function G_DoNewGame():void {
    const g=newgame;g.demoplayback=g.netdemo=g.netgame=false;g.deathmatch=0;g.playeringame[1]=g.playeringame[2]=g.playeringame[3]=false;g.respawnparm=g.fastparm=g.nomonsters=false;g.consoleplayer=0;
    G_InitNew(d_skill,d_episode,d_map);g.gameaction=GA.ga_nothing;
}
export function G_InitNew(skill:skill_t,episode:number,map:number):void {
    const g=newgame;if(g.paused){g.paused=false;g.S_ResumeSound();}if(skill>skill_t.sk_nightmare)skill=skill_t.sk_nightmare;
    if(episode<1)episode=1;episode=Math.min(episode,g.gamemode===GameMode_t.retail?4:g.gamemode===GameMode_t.shareware?1:3);
    if(map<1)map=1;if(map>9&&g.gamemode!==GameMode_t.commercial)map=9;M_ClearRandom();g.respawnmonsters=skill===skill_t.sk_nightmare||g.respawnparm;
    if(g.fastparm||(skill===skill_t.sk_nightmare&&g.gameskill!==skill_t.sk_nightmare)){
        for(let i=ST.S_SARG_RUN1;i<=ST.S_SARG_PAIN2;i++)states[i].tics>>=1;
        for(const id of [MT.MT_BRUISERSHOT,MT.MT_HEADSHOT,MT.MT_TROOPSHOT])mobjinfo[id].speed=20*FRACUNIT;
    }else if(skill!==skill_t.sk_nightmare&&g.gameskill===skill_t.sk_nightmare){
        for(let i=ST.S_SARG_RUN1;i<=ST.S_SARG_PAIN2;i++)states[i].tics<<=1;
        mobjinfo[MT.MT_BRUISERSHOT].speed=15*FRACUNIT;mobjinfo[MT.MT_HEADSHOT].speed=mobjinfo[MT.MT_TROOPSHOT].speed=10*FRACUNIT;
    }
    for(const p of g.players)p.playerstate=PST.PST_REBORN;
    g.usergame=true;g.paused=g.demoplayback=g.automapactive=false;g.viewactive=true;g.gameepisode=episode;g.gamemap=map;g.gameskill=skill;
    g.SetSkyForLevel(episode,map);g.G_DoLoadLevel();
}

// Original command builder. Device events are collected by the platform adapter.
import * as KEY from './doomdef.h';
import { buttoncode_t as BT } from './d_event.h';
import type { ticcmd_t } from './d_ticcmd.h';
import { I_BaseTiccmd } from './i_system';
export interface controls_context_t {
    gamekeydown:Uint8Array;mousebuttons:boolean[];joybuttons:boolean[];mousex:number;mousey:number;joyxmove:number;joyymove:number;
    turnheld:number;dclicktime:number;dclickstate:boolean;dclicks:number;dclicktime2:number;dclickstate2:boolean;dclicks2:number;
    key_right:number;key_left:number;key_up:number;key_down:number;key_strafeleft:number;key_straferight:number;key_fire:number;key_use:number;key_strafe:number;key_speed:number;
    mousebfire:number;mousebstrafe:number;mousebforward:number;joybfire:number;joybstrafe:number;joybuse:number;joybspeed:number;
    ticdup:number;consoleplayer:number;maketic:number;consistancy:Int16Array[];sendpause:boolean;sendsave:boolean;savegameslot:number;
    HU_dequeueChatChar():number;
}
export function G_CreateControls():controls_context_t {
    return {gamekeydown:new Uint8Array(256),mousebuttons:[false,false,false],joybuttons:[false,false,false,false],mousex:0,mousey:0,joyxmove:0,joyymove:0,turnheld:0,
        dclicktime:0,dclickstate:false,dclicks:0,dclicktime2:0,dclickstate2:false,dclicks2:0,
        key_right:KEY.KEY_RIGHTARROW,key_left:KEY.KEY_LEFTARROW,key_up:KEY.KEY_UPARROW,key_down:KEY.KEY_DOWNARROW,key_strafeleft:44,key_straferight:46,key_fire:KEY.KEY_RCTRL,key_use:32,key_strafe:KEY.KEY_RALT,key_speed:KEY.KEY_RSHIFT,
        mousebfire:0,mousebstrafe:1,mousebforward:2,joybfire:0,joybstrafe:1,joybuse:3,joybspeed:2,
        ticdup:1,consoleplayer:0,maketic:0,consistancy:Array.from({length:4},()=>new Int16Array(12)),sendpause:false,sendsave:false,savegameslot:0,HU_dequeueChatChar:()=>0};
}
let controls:controls_context_t;
export function G_InitControlsContext(value:controls_context_t):void {controls=value;}
export const forwardmove=[0x19,0x32],sidemove=[0x18,0x28],angleturn=[640,1280,320];
export function G_CmdChecksum(cmd:ticcmd_t):number {return ((cmd.forwardmove&255)|((cmd.sidemove&255)<<8)|((cmd.angleturn&65535)<<16))|0;}
export function G_BuildTiccmd(cmd:ticcmd_t):void {
    const g=controls;if(!g)throw new Error('Command controls context is not linked');
    Object.assign(cmd,I_BaseTiccmd());cmd.consistancy=g.consistancy[g.consoleplayer][g.maketic%12];
    const down=(key:number)=>!!g.gamekeydown[key],mouse=(button:number)=>!!g.mousebuttons[button],joy=(button:number)=>!!g.joybuttons[button];
    const strafe=down(g.key_strafe)||mouse(g.mousebstrafe)||joy(g.joybstrafe),speed=Number(down(g.key_speed)||joy(g.joybspeed));
    let forward=0,side=0;
    if(g.joyxmove||down(g.key_right)||down(g.key_left))g.turnheld+=g.ticdup;else g.turnheld=0;
    const tspeed=g.turnheld<6?2:speed;
    if(strafe){if(down(g.key_right))side+=sidemove[speed];if(down(g.key_left))side-=sidemove[speed];if(g.joyxmove>0)side+=sidemove[speed];if(g.joyxmove<0)side-=sidemove[speed];}
    else {if(down(g.key_right))cmd.angleturn-=angleturn[tspeed];if(down(g.key_left))cmd.angleturn+=angleturn[tspeed];if(g.joyxmove>0)cmd.angleturn-=angleturn[tspeed];if(g.joyxmove<0)cmd.angleturn+=angleturn[tspeed];}
    if(down(g.key_up))forward+=forwardmove[speed];if(down(g.key_down))forward-=forwardmove[speed];if(g.joyymove<0)forward+=forwardmove[speed];if(g.joyymove>0)forward-=forwardmove[speed];
    if(down(g.key_straferight))side+=sidemove[speed];if(down(g.key_strafeleft))side-=sidemove[speed];
    cmd.chatchar=g.HU_dequeueChatChar();
    if(down(g.key_fire)||mouse(g.mousebfire)||joy(g.joybfire))cmd.buttons|=BT.BT_ATTACK;
    if(down(g.key_use)||joy(g.joybuse)){cmd.buttons|=BT.BT_USE;g.dclicks=0;}
    for(let i=0;i<KEY.weapontype_t.NUMWEAPONS-1;i++)if(down(49+i)){cmd.buttons|=BT.BT_CHANGE|(i<<BT.BT_WEAPONSHIFT);break;}
    const forwardButton=mouse(g.mousebforward);if(forwardButton)forward+=forwardmove[speed];
    if(forwardButton!==g.dclickstate&&g.dclicktime>1){g.dclickstate=forwardButton;if(g.dclickstate)g.dclicks++;if(g.dclicks===2){cmd.buttons|=BT.BT_USE;g.dclicks=0;}else g.dclicktime=0;}
    else {g.dclicktime+=g.ticdup;if(g.dclicktime>20){g.dclicks=0;g.dclickstate=false;}}
    const bstrafe=mouse(g.mousebstrafe)||joy(g.joybstrafe);
    if(bstrafe!==g.dclickstate2&&g.dclicktime2>1){g.dclickstate2=bstrafe;if(g.dclickstate2)g.dclicks2++;if(g.dclicks2===2){cmd.buttons|=BT.BT_USE;g.dclicks2=0;}else g.dclicktime2=0;}
    else {g.dclicktime2+=g.ticdup;if(g.dclicktime2>20){g.dclicks2=0;g.dclickstate2=false;}}
    forward+=g.mousey;if(strafe)side+=g.mousex*2;else cmd.angleturn-=g.mousex*8;g.mousex=g.mousey=0;
    forward=Math.max(-forwardmove[1],Math.min(forwardmove[1],forward));side=Math.max(-forwardmove[1],Math.min(forwardmove[1],side));
    cmd.forwardmove+=forward;cmd.sidemove+=side;
    // C assigns these fields to signed char / signed short storage.
    cmd.forwardmove=(cmd.forwardmove<<24)>>24;cmd.sidemove=(cmd.sidemove<<24)>>24;cmd.angleturn=(cmd.angleturn<<16)>>16;
    if(g.sendpause){g.sendpause=false;cmd.buttons=BT.BT_SPECIAL|BT.BTS_PAUSE;}
    if(g.sendsave){g.sendsave=false;cmd.buttons=BT.BT_SPECIAL|BT.BTS_SAVEGAME|(g.savegameslot<<BT.BTS_SAVESHIFT);}
}

// Original four-byte demo stream. Host callbacks replace file writes and title/process exit.
import { VERSION } from './doomdef.h';
import { W_CacheLumpName } from './w_wad';
export const DEMOMARKER=0x80;
export interface demo_header_t {version:number;skill:skill_t;episode:number;map:number;deathmatch:number;respawnparm:boolean;fastparm:boolean;nomonsters:boolean;consoleplayer:number;playeringame:boolean[];tics:number;end:number}
export function G_ReadDemoHeader(data:Uint8Array,allowVersion109=false):demo_header_t {
    if(data.length<14)throw new Error('Demo truncada: falta la cabecera o el marcador final.');
    if(data[0]!==VERSION&&!(allowVersion109&&data[0]===109))throw new Error(`Versión de demo ${data[0]} no compatible (se admite ${allowVersion109?'109 o ':''}${VERSION}).`);
    if(data[1]>skill_t.sk_nightmare||!data[2]||!data[3]||data[4]>2||data[8]>=MAXPLAYERS||[...data.subarray(5,8),...data.subarray(9,13)].some(value=>value>1))throw new Error('Cabecera de demo inválida.');
    const playeringame=Array.from(data.subarray(9,13),Boolean),count=playeringame.filter(Boolean).length;
    if(!count||!playeringame[data[8]])throw new Error('La demo no tiene un jugador de vista activo.');
    let offset=13,commands=0;
    while(offset<data.length&&data[offset]!==DEMOMARKER){if(offset+4>data.length)throw new Error('Comando de demo truncado.');offset+=4;commands++;}
    if(offset>=data.length)throw new Error('La demo no contiene un marcador final.');
    if(commands%count)throw new Error('La demo termina a mitad de un tic multijugador.');
    return {version:data[0],skill:data[1],episode:data[2],map:data[3],deathmatch:data[4],respawnparm:!!data[5],fastparm:!!data[6],nomonsters:!!data[7],consoleplayer:data[8],playeringame,tics:commands/count,end:offset+1};
}
export interface demo_context_t extends newgame_context_t {
    demorecording:boolean;singledemo:boolean;netdemo:boolean;
    allowDemo109?:boolean;readDemo?(name:string):Uint8Array;
    writeDemo(name:string,data:Uint8Array):void;demoEnded():void;
}
let demo:demo_context_t,demobuffer=new Uint8Array(),demo_p=0,demoname='',defdemoname='',demoTics=0,demoTotal=0,lastDemo:Uint8Array|null=null;
export function G_InitDemoContext(value:demo_context_t):void {demo=value;}
export function G_ResetDemo():void {if(demo){demo.demoplayback=demo.demorecording=false;}demobuffer=new Uint8Array();demo_p=demoTics=demoTotal=0;lastDemo=null;}
export function G_GetDemoState(){return {recording:demo?.demorecording??false,playing:demo?.demoplayback??false,name:demoname,tics:demoTics,total:demoTotal,bytes:demo_p};}
export function G_GetRecordedDemo():Uint8Array|null {return lastDemo?.slice()??null;}
export function G_ReadDemoTiccmd(cmd:ticcmd_t):boolean {
    if(demo_p>=demobuffer.length)throw new Error('Comando de demo fuera del buffer.');
    if(demobuffer[demo_p]===DEMOMARKER){G_CheckDemoStatus();return false;}
    if(demo_p+4>demobuffer.length)throw new Error('Comando de demo truncado.');
    cmd.forwardmove=(demobuffer[demo_p++]<<24)>>24;cmd.sidemove=(demobuffer[demo_p++]<<24)>>24;
    cmd.angleturn=(demobuffer[demo_p++]<<24)>>16;cmd.buttons=demobuffer[demo_p++];return true;
}
export function G_WriteDemoTiccmd(cmd:ticcmd_t):boolean {
    if(controls?.gamekeydown[113]){G_CheckDemoStatus();return false;}
    if(demo_p+4>demobuffer.length)throw new Error('Buffer de grabación agotado.');
    demobuffer[demo_p++]=cmd.forwardmove;demobuffer[demo_p++]=cmd.sidemove;demobuffer[demo_p++]=(cmd.angleturn+128)>>8;demobuffer[demo_p++]=cmd.buttons;demo_p-=4;
    if(demo_p>demobuffer.length-16){G_CheckDemoStatus();return false;}
    // The simulation MUST use the quantized command too, as in the original.
    return G_ReadDemoTiccmd(cmd);
}
export function G_RecordDemo(name:string,maxsize=0x20000):void {
    if(!Number.isInteger(maxsize)||maxsize<32||maxsize>16*1024*1024)throw new Error('Tamaño de grabación inválido.');
    if(demo.demoplayback||demo.demorecording)throw new Error('Ya hay una demo activa.');
    demo.usergame=false;demoname=name.endsWith('.lmp')?name:`${name}.lmp`;demobuffer=new Uint8Array(maxsize);demo_p=demoTics=demoTotal=0;lastDemo=null;demo.demorecording=true;
}
export function G_BeginRecording():void {
    if(!demo.demorecording)throw new Error('G_RecordDemo debe preceder a G_BeginRecording.');
    demo_p=0;demobuffer.set([VERSION,demo.gameskill,demo.gameepisode,demo.gamemap,demo.deathmatch,Number(demo.respawnparm),Number(demo.fastparm),Number(demo.nomonsters),demo.consoleplayer,...demo.playeringame.map(Number)]);demo_p=13;
}
export function G_DeferedPlayDemo(name:string):void {defdemoname=name;demo.gameaction=GA.ga_playdemo;}
export function G_DoPlayDemo():void {
    const g=demo;g.gameaction=GA.ga_nothing;
    const bytes=(g.readDemo?.(defdemoname)??W_CacheLumpName(defdemoname,1)).slice(),header=G_ReadDemoHeader(bytes,g.allowDemo109);
    demobuffer=bytes.subarray(0,header.end);demo_p=13;demoTics=0;demoTotal=header.tics;demoname=defdemoname;
    g.deathmatch=header.deathmatch;g.respawnparm=header.respawnparm;g.fastparm=header.fastparm;g.nomonsters=header.nomonsters;g.consoleplayer=header.consoleplayer;
    for(let i=0;i<MAXPLAYERS;i++)g.playeringame[i]=header.playeringame[i];
    g.netgame=g.netdemo=header.playeringame[1];
    G_InitNew(header.skill,header.episode,header.map);g.usergame=false;g.demoplayback=true;
}
export function G_CheckDemoStatus():boolean {
    const g=demo;
    if(g.demoplayback){
        g.demoplayback=g.netdemo=g.netgame=false;g.deathmatch=0;g.playeringame[1]=g.playeringame[2]=g.playeringame[3]=false;
        g.respawnparm=g.fastparm=g.nomonsters=false;g.consoleplayer=0;g.demoEnded();return true;
    }
    if(g.demorecording){
        demobuffer[demo_p++]=DEMOMARKER;lastDemo=demobuffer.slice(0,demo_p);g.demorecording=false;g.writeDemo(demoname,lastDemo.slice());return false;
    }return false;
}
// The driver calls this once per whole tic, after all participating commands.
export function G_DemoTic():void {demoTics++;}
