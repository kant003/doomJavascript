// Copyright (C) 1993-1996 id Software, Inc. GPL-2.0-only.
// hu_stuff.c. Gameplay globals are supplied by context; network transport is external.
import { GameMode_t as MODE,MAXPLAYERS,KEY_ENTER,KEY_ESCAPE,KEY_RSHIFT,KEY_RALT,KEY_LALT } from './doomdef.h';
import { evtype_t as EV,type event_t } from './d_event.h';
import type { player_t } from './d_player.h';
import { sfxenum_t as SFX } from './sounds.h';
import * as T from './d_englsh.h';
import { W_GetNumForName,W_CheckNumForName,W_CacheLumpNum,lumpinfo,numlumps } from './w_wad';
import { V_PatchHeader } from './v_video';
import { HU_FONTSTART,HU_FONTSIZE,HU_BROADCAST,HU_MSGX,HU_MSGY,HU_MSGHEIGHT,HU_MSGREFRESH,HU_MSGTIMEOUT } from './hu_stuff.h';
import { HU_MAXLINELENGTH,type hu_textline_t,type hu_stext_t,type hu_itext_t } from './hu_lib.h';
import * as L from './hu_lib';
export interface headsup_context_t {
    gamemode:MODE;gameepisode:number;gamemap:number;players:player_t[];playeringame:boolean[];consoleplayer:number;
    netgame:boolean;automapactive:boolean;french:boolean;showMessages:boolean;S_StartSound(origin:null,sound:SFX):void;
}
let context:headsup_context_t,plr:player_t;
export const chat_macros=Array.from({length:10},(_,i)=>(T as Record<string,string|number>)[`HUSTR_CHATMACRO${i}`] as string);
export const player_names=[T.HUSTR_PLRGREEN,T.HUSTR_PLRINDIGO,T.HUSTR_PLRBROWN,T.HUSTR_PLRRED];
const names=T as Record<string,string|number>;
export const mapnames=[...Array.from({length:36},(_,i)=>names[`HUSTR_E${Math.trunc(i/9)+1}M${i%9+1}`] as string),...Array<string>(9).fill('NEWLEVEL')];
export const mapnames2=Array.from({length:32},(_,i)=>names[`HUSTR_${i+1}`] as string);
export const mapnamesp=Array.from({length:32},(_,i)=>names[`PHUSTR_${i+1}`] as string),mapnamest=Array.from({length:32},(_,i)=>names[`THUSTR_${i+1}`] as string);
export const hu_font:Uint8Array[]=[];
let fontDirectory:typeof lumpinfo|null=null,fontCount=-1,fontIndexes:number[]=[];
function refreshFont():void {if(fontDirectory===lumpinfo&&fontCount===numlumps)return;fontDirectory=lumpinfo;fontCount=numlumps;fontIndexes=Array.from({length:HU_FONTSIZE},(_,i)=>W_CheckNumForName(`STCFN${String(i+HU_FONTSTART).padStart(3,'0')}`));}
export function HU_CanLoad():boolean {refreshFont();return fontIndexes.every(i=>i>=0);}
export function HU_FontPatch(code:number):Uint8Array {refreshFont();if(code<HU_FONTSTART||code>=HU_FONTSTART+HU_FONTSIZE)throw new Error('HU font character out of range');return W_CacheLumpNum(fontIndexes[code-HU_FONTSTART],1);}
let shiftxform:Uint8Array;
const w_title={} as hu_textline_t,w_chat={} as hu_itext_t,w_message={} as hu_stext_t,w_inputbuffer:hu_itext_t[]=[];
let headsupactive=false,message_on=false,message_counter=0,message_nottobefuckedwith=false;
export let message_dontfuckwithme=false,chat_on=false;
const chat_dest=new Uint8Array(MAXPLAYERS),QUEUESIZE=128,chatchars=new Uint8Array(QUEUESIZE);
let head=0,tail=0,lastmessage='',shiftdown=false,altdown=false,num_nobrainers=0;
const destination_keys=[T.HUSTR_KEYGREEN,T.HUSTR_KEYINDIGO,T.HUSTR_KEYBROWN,T.HUSTR_KEYRED];
export function HU_InitContext(value:headsup_context_t):void {context=value;L.HUlib_InitContext(()=>context.automapactive);}
export function ForeignTranslation(ch:number):number {return ch<128?frenchKeyMap[ch]:ch;}
export function HU_Init():void {shiftxform=context.french?french_shiftxform:english_shiftxform;for(let i=0;i<HU_FONTSIZE;i++)hu_font[i]=W_CacheLumpNum(W_GetNumForName(`STCFN${String(i+HU_FONTSTART).padStart(3,'0')}`),1);}
export function HU_Stop():void {headsupactive=false;}
export function HU_Start():void {
    if(headsupactive)HU_Stop();plr=context.players[context.consoleplayer];message_on=message_dontfuckwithme=message_nottobefuckedwith=chat_on=false;
    L.HUlib_initSText(w_message,HU_MSGX,HU_MSGY,HU_MSGHEIGHT,hu_font,HU_FONTSTART,()=>message_on);
    L.HUlib_initTextLine(w_title,0,167-V_PatchHeader(hu_font[0]).height,hu_font,HU_FONTSTART);
    const title=context.gamemode===MODE.shareware||context.gamemode===MODE.registered||context.gamemode===MODE.retail?mapnames[(context.gameepisode-1)*9+context.gamemap-1]:mapnames2[context.gamemap-1];
    if(title===undefined)throw new Error('HU map title index out of range');for(let i=0;i<title.length;i++)L.HUlib_addCharToTextLine(w_title,title.charCodeAt(i));
    L.HUlib_initIText(w_chat,HU_MSGX,HU_MSGY+HU_MSGHEIGHT*(V_PatchHeader(hu_font[0]).height+1),hu_font,HU_FONTSTART,()=>chat_on);
    for(let i=0;i<MAXPLAYERS;i++){const it={} as hu_itext_t;L.HUlib_initIText(it,0,0,null,0,()=>false);w_inputbuffer[i]=it;}headsupactive=true;
}
export function HU_Drawer():void {L.HUlib_drawSText(w_message);L.HUlib_drawIText(w_chat);if(context.automapactive)L.HUlib_drawTextLine(w_title,false);}
export function HU_Erase():void {L.HUlib_eraseSText(w_message);L.HUlib_eraseIText(w_chat);L.HUlib_eraseTextLine(w_title);}
export function HU_Ticker():void {
    if(message_counter&&!--message_counter){message_on=false;message_nottobefuckedwith=false;}
    if(context.showMessages||message_dontfuckwithme){if(plr.message&&(!message_nottobefuckedwith||message_dontfuckwithme)){
        L.HUlib_addMessageToSText(w_message,null,plr.message);plr.message=null;message_on=true;message_counter=HU_MSGTIMEOUT;message_nottobefuckedwith=message_dontfuckwithme;message_dontfuckwithme=false;
    }}
    if(context.netgame)for(let i=0;i<MAXPLAYERS;i++){
        if(!context.playeringame[i])continue;let c=context.players[i].cmd.chatchar;
        if(i!==context.consoleplayer&&c){if(c<=HU_BROADCAST)chat_dest[i]=c;
            else {if(c>=97&&c<=122)c=shiftxform[c];const rc=L.HUlib_keyInIText(w_inputbuffer[i],c);
                if(rc&&c===KEY_ENTER){const it=w_inputbuffer[i];if(it.l.len&&(chat_dest[i]===context.consoleplayer+1||chat_dest[i]===HU_BROADCAST)){
                    L.HUlib_addMessageToSText(w_message,player_names[i],L.HUlib_Text(it.l));message_nottobefuckedwith=true;message_on=true;message_counter=HU_MSGTIMEOUT;context.S_StartSound(null,context.gamemode===MODE.commercial?SFX.sfx_radio:SFX.sfx_tink);
                }L.HUlib_resetIText(it);}
            }context.players[i].cmd.chatchar=0;
        }
    }
}
export function HU_queueChatChar(c:number):void {if(((head+1)&(QUEUESIZE-1))===tail)plr.message=T.HUSTR_MSGU;else {chatchars[head]=c;head=(head+1)&(QUEUESIZE-1);}}
export function HU_dequeueChatChar():number {if(head===tail)return 0;const c=chatchars[tail];tail=(tail+1)&(QUEUESIZE-1);return c;}
export function HU_Responder(ev:event_t):boolean {
    let eatkey=false;const numplayers=context.playeringame.reduce((n,on)=>n+Number(on),0);
    if(ev.data1===KEY_RSHIFT){shiftdown=ev.type===EV.ev_keydown;return false;}
    if(ev.data1===KEY_RALT||ev.data1===KEY_LALT){altdown=ev.type===EV.ev_keydown;return false;}
    if(ev.type!==EV.ev_keydown)return false;
    if(!chat_on){
        if(ev.data1===HU_MSGREFRESH){message_on=true;message_counter=HU_MSGTIMEOUT;eatkey=true;}
        else if(context.netgame&&ev.data1===116){eatkey=chat_on=true;L.HUlib_resetIText(w_chat);HU_queueChatChar(HU_BROADCAST);}
        else if(context.netgame&&numplayers>2)for(let i=0;i<MAXPLAYERS;i++)if(ev.data1===destination_keys[i]){
            if(context.playeringame[i]&&i!==context.consoleplayer){eatkey=chat_on=true;L.HUlib_resetIText(w_chat);HU_queueChatChar(i+1);break;}
            else if(i===context.consoleplayer){num_nobrainers++;plr.message=num_nobrainers<3?T.HUSTR_TALKTOSELF1:num_nobrainers<6?T.HUSTR_TALKTOSELF2:num_nobrainers<9?T.HUSTR_TALKTOSELF3:num_nobrainers<32?T.HUSTR_TALKTOSELF4:T.HUSTR_TALKTOSELF5;}
        }
    }else {
        let c=ev.data1&255;
        if(altdown){c=(c-48)&255;if(c>9)return false;HU_queueChatChar(KEY_ENTER);for(const ch of chat_macros[c])HU_queueChatChar(ch.charCodeAt(0));HU_queueChatChar(KEY_ENTER);chat_on=false;lastmessage=chat_macros[c];plr.message=lastmessage;eatkey=true;}
        else {if(context.french)c=ForeignTranslation(c);if(shiftdown||(c>=97&&c<=122)){
                // C indexes a 128-byte table with arbitrary key codes: ignore an
                // unmapped special key instead of reading outside the array.
                if(c>=shiftxform.length)return false;c=shiftxform[c];
            }
            eatkey=L.HUlib_keyInIText(w_chat,c);if(eatkey)HU_queueChatChar(c);
            if(c===KEY_ENTER){chat_on=false;if(w_chat.l.len){lastmessage=L.HUlib_Text(w_chat.l);plr.message=lastmessage;}}
            else if(c===KEY_ESCAPE)chat_on=false;
        }
    }return eatkey;
}
// Platform inspection/lifecycle adapters. They do not advance or fabricate messages.
export function HU_IsActive():boolean {return headsupactive;}
export function HU_GetState(){return {active:headsupactive,visible:message_on,text:w_message.l?.[w_message.cl]?L.HUlib_Text(w_message.l[w_message.cl]):'',counter:message_counter,protected:message_nottobefuckedwith,chat:chat_on,input:w_chat.l?L.HUlib_Text(w_chat.l):'',title:w_title.l?L.HUlib_Text(w_title):''};}
export function HU_ForceMessage(text:string):void {plr.message=text;message_dontfuckwithme=true;}
export function HU_Unload():void {HU_Stop();hu_font.length=0;w_inputbuffer.length=0;w_message.l=[];w_title.f=null;if(w_chat.l)w_chat.l.f=null;head=tail=0;shiftdown=altdown=false;}
// Literal 128-byte keyboard tables from hu_stuff.c.
export const french_shiftxform=new Uint8Array([0,1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,18,19,20,21,22,23,24,25,26,27,28,29,30,31,32,33,34,35,36,37,38,34,40,41,42,43,63,95,62,63,48,49,50,51,52,53,54,55,56,57,47,46,60,43,62,63,64,65,66,67,68,69,70,71,72,73,74,75,76,77,78,79,80,81,82,83,84,85,86,87,88,89,90,91,33,93,34,95,39,65,66,67,68,69,70,71,72,73,74,75,76,77,78,79,80,81,82,83,84,85,86,87,88,89,90,123,124,125,126,127]);
export const english_shiftxform=new Uint8Array([0,1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,18,19,20,21,22,23,24,25,26,27,28,29,30,31,32,33,34,35,36,37,38,34,40,41,42,43,60,95,62,63,41,33,64,35,36,37,94,38,42,40,58,58,60,43,62,63,64,65,66,67,68,69,70,71,72,73,74,75,76,77,78,79,80,81,82,83,84,85,86,87,88,89,90,91,33,93,34,95,39,65,66,67,68,69,70,71,72,73,74,75,76,77,78,79,80,81,82,83,84,85,86,87,88,89,90,123,124,125,126,127]);
export const frenchKeyMap=new Uint8Array([0,1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,18,19,20,21,22,23,24,25,26,27,28,29,30,31,32,33,34,35,36,37,38,37,40,41,42,43,59,45,58,33,48,49,50,51,52,53,54,55,56,57,58,77,60,61,62,63,64,81,66,67,68,69,70,71,72,73,74,75,76,44,78,79,80,65,82,83,84,85,86,90,88,89,87,94,92,36,94,95,64,81,66,67,68,69,70,71,72,73,74,75,76,44,78,79,80,65,82,83,84,85,86,90,88,89,87,94,92,36,94,127]);
