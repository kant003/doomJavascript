// Copyright (C) 1993-1996 id Software, Inc. GPL-2.0-only.
// f_finale.c: native text/art, bunny scroll and Doom II cast. Music and the
// D_Display wipe driver remain pending; wipegamestate requests are preserved.
import { GameMode_t as MODE,gamestate_t as GS,MAXPLAYERS,SCREENWIDTH as SW,SCREENHEIGHT as SH } from './doomdef.h';
import { gameaction_t as GA,evtype_t,type event_t } from './d_event.h';
import type { player_t } from './d_player.h';
import * as strings from './d_englsh.h';
import { states,mobjinfo } from './info';
import { mobjtype_t as MT,statenum_t as ST,type state_t } from './info.h';
import { sfxenum_t as SFX } from './sounds.h';
import { W_CacheLumpName,W_CacheLumpNum,W_CheckNumForName,lumpinfo,numlumps } from './w_wad';
import { screens,V_MarkRect,V_DrawPatch,V_DrawPatchFlipped,V_PatchHeader } from './v_video';
import { spritesState } from './r_things';
import { texturestate } from './r_data';
import { FF_FRAMEMASK } from './p_pspr.h';
export interface finale_context_t {
    gamemode:MODE;gameepisode:number;gamemap:number;gameaction:GA;gamestate:GS;viewactive:boolean;automapactive:boolean;wipegamestate:number;players:player_t[];
    S_StartSound(origin:null,sound:SFX):void;
}
let context:finale_context_t;
export function F_InitContext(value:finale_context_t):void {context=value;}
export let finalestage=0,finalecount=0,finaletext='',finaleflat='';
export const TEXTSPEED=3,TEXTWAIT=250;
export const castorder=[
    [strings.CC_ZOMBIE,MT.MT_POSSESSED],[strings.CC_SHOTGUN,MT.MT_SHOTGUY],[strings.CC_HEAVY,MT.MT_CHAINGUY],
    [strings.CC_IMP,MT.MT_TROOP],[strings.CC_DEMON,MT.MT_SERGEANT],[strings.CC_LOST,MT.MT_SKULL],[strings.CC_CACO,MT.MT_HEAD],
    [strings.CC_HELL,MT.MT_KNIGHT],[strings.CC_BARON,MT.MT_BRUISER],[strings.CC_ARACH,MT.MT_BABY],[strings.CC_PAIN,MT.MT_PAIN],
    [strings.CC_REVEN,MT.MT_UNDEAD],[strings.CC_MANCU,MT.MT_FATSO],[strings.CC_ARCH,MT.MT_VILE],
    [strings.CC_SPIDER,MT.MT_SPIDER],[strings.CC_CYBER,MT.MT_CYBORG],[strings.CC_HERO,MT.MT_PLAYER]
] as const;
export let castnum=0,casttics=0,caststate:state_t=states[ST.S_NULL],castdeath=false,castframes=0,castonmelee=0,castattacking=false;
let laststage=0;
export function F_StartFinale():void {
    if(!context)throw new Error('Finale context is not linked');
    const g=context;g.gameaction=GA.ga_nothing;g.gamestate=GS.GS_FINALE;g.viewactive=false;g.automapactive=false;
    switch(g.gamemode){
        case MODE.shareware:case MODE.registered:case MODE.retail:
            switch(g.gameepisode){
                case 1:finaleflat='FLOOR4_8';finaletext=strings.E1TEXT;break;
                case 2:finaleflat='SFLR6_1';finaletext=strings.E2TEXT;break;
                case 3:finaleflat='MFLR8_4';finaletext=strings.E3TEXT;break;
                case 4:finaleflat='MFLR8_3';finaletext=strings.E4TEXT;break;
            }break;
        case MODE.commercial:
            switch(g.gamemap){
                case 6:finaleflat='SLIME16';finaletext=strings.C1TEXT;break;
                case 11:finaleflat='RROCK14';finaletext=strings.C2TEXT;break;
                case 20:finaleflat='RROCK07';finaletext=strings.C3TEXT;break;
                case 30:finaleflat='RROCK17';finaletext=strings.C4TEXT;break;
                case 15:finaleflat='RROCK13';finaletext=strings.C5TEXT;break;
                case 31:finaleflat='RROCK19';finaletext=strings.C6TEXT;break;
            }break;
        default:finaleflat='F_SKY1';finaletext=strings.C1TEXT;
    }
    finalestage=0;finalecount=0;
}
export function F_Responder(event:event_t):boolean {return finalestage===2?F_CastResponder(event):false;}
export function F_Ticker():void {
    if(context.gamemode===MODE.commercial&&finalecount>50){
        if(context.players.slice(0,MAXPLAYERS).some(p=>p.cmd.buttons)){
            if(context.gamemap===30)F_StartCast();else context.gameaction=GA.ga_worlddone;
        }
    }
    finalecount++;
    if(finalestage===2){F_CastTicker();return;}
    if(context.gamemode===MODE.commercial)return;
    if(!finalestage&&finalecount>finaletext.length*TEXTSPEED+TEXTWAIT){finalecount=0;finalestage=1;context.wipegamestate=-1;}
}
const fontCode=(c:number)=>c>=33&&c<=95;
// hu_stuff is not yet ported. Resolve its original STCFN font names once per
// WAD directory, retaining lump indexes so W_Reload still invalidates the bytes.
let fontDirectory:typeof lumpinfo|null=null,fontCount=-1,hu_font:number[]=[];
function loadFont():void {
    if(fontDirectory===lumpinfo&&fontCount===numlumps)return;
    fontDirectory=lumpinfo;fontCount=numlumps;hu_font=Array.from({length:63},(_,i)=>W_CheckNumForName(`STCFN${String(i+33).padStart(3,'0')}`));
}
const font=(c:number)=>{loadFont();return W_CacheLumpNum(hu_font[c-33],1);};
export function F_TextWrite():void {
    const src=W_CacheLumpName(finaleflat,1);
    if(src.length<4096)throw new Error('Finale background flat is truncated');
    for(let y=0;y<SH;y++)for(let x=0;x<SW;x++)screens[0][y*SW+x]=src[((y&63)<<6)+(x&63)];
    V_MarkRect(0,0,SW,SH);
    let cx=10,cy=10,count=Math.max(0,Math.trunc((finalecount-10)/TEXTSPEED));
    for(let i=0;i<count&&i<finaletext.length;i++){
        const ch=finaletext[i];if(ch==='\n'){cx=10;cy+=11;continue;}
        const c=ch.toUpperCase().charCodeAt(0);if(!fontCode(c)){cx+=4;continue;}
        const patch=font(c),w=V_PatchHeader(patch).width;if(cx+w>SW)break;
        V_DrawPatch(cx,cy,0,patch);cx+=w;
    }
}
export function F_StartCast():void {
    context.wipegamestate=-1;castnum=0;caststate=states[mobjinfo[castorder[0][1]].seestate];casttics=caststate.tics;
    castdeath=false;finalestage=2;castframes=0;castonmelee=0;castattacking=false;
}
const castSounds=new Map<number,SFX>([
    [ST.S_PLAY_ATK1,SFX.sfx_dshtgn],[ST.S_POSS_ATK2,SFX.sfx_pistol],[ST.S_SPOS_ATK2,SFX.sfx_shotgn],
    [ST.S_VILE_ATK2,SFX.sfx_vilatk],[ST.S_SKEL_FIST2,SFX.sfx_skeswg],[ST.S_SKEL_FIST4,SFX.sfx_skepch],[ST.S_SKEL_MISS2,SFX.sfx_skeatk],
    [ST.S_FATT_ATK8,SFX.sfx_firsht],[ST.S_FATT_ATK5,SFX.sfx_firsht],[ST.S_FATT_ATK2,SFX.sfx_firsht],
    [ST.S_CPOS_ATK2,SFX.sfx_shotgn],[ST.S_CPOS_ATK3,SFX.sfx_shotgn],[ST.S_CPOS_ATK4,SFX.sfx_shotgn],
    [ST.S_TROO_ATK3,SFX.sfx_claw],[ST.S_SARG_ATK2,SFX.sfx_sgtatk],[ST.S_BOSS_ATK2,SFX.sfx_firsht],[ST.S_BOS2_ATK2,SFX.sfx_firsht],
    [ST.S_HEAD_ATK2,SFX.sfx_firsht],[ST.S_SKULL_ATK2,SFX.sfx_sklatk],[ST.S_SPID_ATK2,SFX.sfx_shotgn],[ST.S_SPID_ATK3,SFX.sfx_shotgn],
    [ST.S_BSPI_ATK2,SFX.sfx_plasma],[ST.S_CYBER_ATK2,SFX.sfx_rlaunc],[ST.S_CYBER_ATK4,SFX.sfx_rlaunc],[ST.S_CYBER_ATK6,SFX.sfx_rlaunc],[ST.S_PAIN_ATK3,SFX.sfx_sklatk]
]);
export function F_CastTicker():void {
    if(--casttics>0)return;
    let stopattack=false;
    if(caststate.tics===-1||caststate.nextstate===ST.S_NULL){
        castnum=(castnum+1)%castorder.length;castdeath=false;
        const info=mobjinfo[castorder[castnum][1]];if(info.seesound)context.S_StartSound(null,info.seesound);
        caststate=states[info.seestate];castframes=0;
    }else if(caststate===states[ST.S_PLAY_ATK1])stopattack=true;
    else {
        const st=caststate.nextstate;caststate=states[st];castframes++;
        const sound=castSounds.get(st);if(sound)context.S_StartSound(null,sound);
    }
    const info=mobjinfo[castorder[castnum][1]];
    if(!stopattack&&castframes===12){
        castattacking=true;caststate=states[castonmelee?info.meleestate:info.missilestate];castonmelee^=1;
        if(caststate===states[ST.S_NULL])caststate=states[castonmelee?info.meleestate:info.missilestate];
    }
    if(stopattack||(castattacking&&(castframes===24||caststate===states[info.seestate]))){castattacking=false;castframes=0;caststate=states[info.seestate];}
    casttics=caststate.tics;if(casttics===-1)casttics=15;
}
export function F_CastResponder(event:event_t):boolean {
    if(event.type!==evtype_t.ev_keydown)return false;
    if(castdeath)return true;
    const info=mobjinfo[castorder[castnum][1]];castdeath=true;caststate=states[info.deathstate];casttics=caststate.tics;castframes=0;castattacking=false;
    if(info.deathsound)context.S_StartSound(null,info.deathsound);return true;
}
export function F_CastPrint(text:string):void {
    let width=0;for(const ch of text){const c=ch.toUpperCase().charCodeAt(0);width+=fontCode(c)?V_PatchHeader(font(c)).width:4;}
    let cx=160-Math.trunc(width/2);
    for(const ch of text){const c=ch.toUpperCase().charCodeAt(0);if(!fontCode(c)){cx+=4;continue;}const patch=font(c);V_DrawPatch(cx,180,0,patch);cx+=V_PatchHeader(patch).width;}
}
export function F_CastDrawer():void {
    V_DrawPatch(0,0,0,W_CacheLumpName('BOSSBACK',1));F_CastPrint(castorder[castnum][0]);
    const frame=spritesState.sprites[caststate.sprite]?.spriteframes[caststate.frame&FF_FRAMEMASK];
    if(!frame)throw new Error('Missing cast sprite frame');
    const patch=W_CacheLumpNum(frame.lump[0]+texturestate.firstspritelump,1);
    if(frame.flip[0])V_DrawPatchFlipped(160,170,0,patch);else V_DrawPatch(160,170,0,patch);
}
export function F_DrawPatchCol(x:number,patch:Uint8Array,col:number):void {
    const h=V_PatchHeader(patch);if(!Number.isInteger(x)||x<0||x>=SW||!Number.isInteger(col)||col<0||col>=h.width)throw new Error('Invalid finale patch column');
    const v=new DataView(patch.buffer,patch.byteOffset,patch.byteLength),posts:{top:number;pixels:Uint8Array}[]=[];
    let at=v.getUint32(8+col*4,true);
    while(true){
        if(at>=patch.length)throw new Error('Truncated finale patch column');if(patch[at]===255)break;
        if(at+4>patch.length)throw new Error('Truncated finale patch post');
        const top=patch[at],len=patch[at+1];if(top+len>SH||top+len>h.height||at+len+4>patch.length)throw new Error('Invalid finale patch post');
        posts.push({top,pixels:patch.subarray(at+3,at+3+len)});at+=len+4;
    }
    for(const post of posts){let dest=post.top*SW+x;for(const pixel of post.pixels){screens[0][dest]=pixel;dest+=SW;}}
}
export function F_BunnyScroll():void {
    const p1=W_CacheLumpName('PFUB2',50),p2=W_CacheLumpName('PFUB1',50);V_MarkRect(0,0,SW,SH);
    const scrolled=Math.max(0,Math.min(320,320-Math.trunc((finalecount-230)/2)));
    for(let x=0;x<SW;x++)if(x+scrolled<320)F_DrawPatchCol(x,p1,x+scrolled);else F_DrawPatchCol(x,p2,x+scrolled-320);
    if(finalecount<1130)return;
    if(finalecount<1180){V_DrawPatch((SW-13*8)/2,(SH-8*8)/2,0,W_CacheLumpName('END0',1));laststage=0;return;}
    const stage=Math.min(6,Math.trunc((finalecount-1180)/5));
    if(stage>laststage){context.S_StartSound(null,SFX.sfx_pistol);laststage=stage;}
    V_DrawPatch((SW-13*8)/2,(SH-8*8)/2,0,W_CacheLumpName(`END${stage}`,1));
}
function artName():string|null {return context.gameepisode===1?(context.gamemode===MODE.retail?'CREDIT':'HELP2'):context.gameepisode===2?'VICTORY2':context.gameepisode===4?'ENDPIC':null;}
export function F_Drawer():void {
    if(finalestage===2){F_CastDrawer();return;}
    if(!finalestage){F_TextWrite();return;}
    if(context.gameepisode===3)F_BunnyScroll();else {const art=artName();if(art)V_DrawPatch(0,0,0,W_CacheLumpName(art,1));}
}
// Platform inspection adapters: no substitute art or fabricated cast frames.
export function F_GetState(){return {stage:finalestage,count:finalecount,text:finaletext,visibleText:finaletext.slice(0,Math.max(0,Math.trunc((finalecount-10)/TEXTSPEED))),flat:finaleflat,castName:castorder[castnum][0],castdeath};}
export function F_CanDraw():boolean {
    const has=(name:string)=>W_CheckNumForName(name)>=0;
    if(finalestage===1)return context.gameepisode===3?['PFUB1','PFUB2',...Array.from({length:7},(_,i)=>`END${i}`)].every(has):!!artName()&&has(artName()!);
    loadFont();if(hu_font.some(index=>index<0))return false;
    if(finalestage===0)return has(finaleflat);
    return has('BOSSBACK')&&!!spritesState.sprites[caststate.sprite]?.spriteframes[caststate.frame&FF_FRAMEMASK];
}
