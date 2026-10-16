import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as L from '../src/linuxdoom-1.10/hu_lib';
import * as HU from '../src/linuxdoom-1.10/hu_stuff';
import type { hu_textline_t,hu_stext_t,hu_itext_t } from '../src/linuxdoom-1.10/hu_lib.h';
import { HU_MSGTIMEOUT } from '../src/linuxdoom-1.10/hu_stuff.h';
import { KEY_ENTER,KEY_BACKSPACE,KEY_ESCAPE,KEY_RALT,KEY_RSHIFT,GameMode_t as MODE } from '../src/linuxdoom-1.10/doomdef.h';
import { evtype_t as EV,buttoncode_t as BT } from '../src/linuxdoom-1.10/d_event.h';
import { sfxenum_t as SFX } from '../src/linuxdoom-1.10/sounds.h';
import { G_CreatePlayer } from '../src/linuxdoom-1.10/g_game';
import { V_Init,screens } from '../src/linuxdoom-1.10/v_video';
import { R_InitBuffer } from '../src/linuxdoom-1.10/r_draw';
import { makeWad,maskedPatch } from '../src/web/demo';
import { W_InitFile,W_AddFile,W_Reload } from '../src/linuxdoom-1.10/w_wad';
import { createHeadlessGame } from './helpers/game-session';
import { P_TeleportMove,P_TryMove } from '../src/linuxdoom-1.10/p_map';
import { M_ClearRandom,rndindex,prndindex } from '../src/linuxdoom-1.10/m_random';
import * as TEXT from '../src/linuxdoom-1.10/d_englsh.h';
const event=(key:number,type=EV.ev_keydown)=>({type,data1:key,data2:0,data3:0});
const font=()=>Array.from({length:63},(_,i)=>maskedPatch(3,5,()=>i+33));
const pixel=(x:number,y:number)=>screens[0][y*320+x];
const cmd=(buttons=0)=>({forwardmove:0,sidemove:0,angleturn:0,consistancy:0,chatchar:0,buttons});
function line(){const t={} as hu_textline_t;L.HUlib_initTextLine(t,0,0,font(),33);return t;}
function type(text:string,t:hu_textline_t){for(const c of text)L.HUlib_addCharToTextLine(t,c.charCodeAt(0));}
function assets(color?:number){return font().map((data,i)=>({name:`STCFN${String(i+33).padStart(3,'0')}`,data:color===undefined?data:maskedPatch(3,5,()=>color)}));}
function fixture(netgame=false,french=false){
 HU.HU_Unload();V_Init();R_InitBuffer(320,168);W_InitFile({name:'hud.wad',data:makeWad(assets())});
 const sounds:SFX[]=[],g:HU.headsup_context_t={gamemode:MODE.shareware,gameepisode:1,gamemap:1,players:Array.from({length:4},G_CreatePlayer),playeringame:[true,true,true,true],consoleplayer:0,netgame,automapactive:false,french,showMessages:true,S_StartSound:(_o,s)=>sounds.push(s)};
 HU.HU_InitContext(g);assert.equal(HU.HU_CanLoad(),true);HU.HU_Init();HU.HU_Start();return {g,p:g.players[0],sounds,tick:(n=1)=>{for(let i=0;i<n;i++)HU.HU_Ticker();}};
}
function firstPixel(patch:Uint8Array){return patch[new DataView(patch.buffer,patch.byteOffset,patch.byteLength).getUint32(8,true)+3];}
function drain(){const values:number[]=[];let c:number;while((c=HU.HU_dequeueChatChar()))values.push(c);return values;}
test('HU byte lines enforce 80 characters, null termination, deletion and dirty counters',()=>{
 const t=line();assert.equal(t.needsupdate,1);for(let i=0;i<80;i++)assert.equal(L.HUlib_addCharToTextLine(t,65),true);assert.equal(t.l[80],0);assert.equal(L.HUlib_addCharToTextLine(t,66),false);assert.equal(t.len,80);assert.equal(L.HUlib_delCharFromTextLine(t),true);assert.equal(t.l[79],0);assert.equal(t.needsupdate,4);L.HUlib_clearTextLine(t);assert.equal(L.HUlib_delCharFromTextLine(t),false);assert.equal(L.HUlib_Text(t),'');
});
test('HU draw uppercases ASCII, advances unsupported glyphs four pixels and clips at screen width',()=>{
 V_Init();const t=line();type('a z~',t);L.HUlib_drawTextLine(t,true);assert.equal(pixel(0,0),65);assert.equal(pixel(3,0),0);assert.equal(pixel(7,0),90);assert.equal(pixel(14,0),95);screens[0].fill(0);t.x=318;L.HUlib_drawTextLine(t,true);assert.ok(screens[0].every(v=>v===0));t.x=317;t.len=1;L.HUlib_drawTextLine(t,true);assert.equal(pixel(319,0),65);
});
test('Scrolling windows rotate bounded lines, append prefixes and preserve on/laston erasure',()=>{
 V_Init();R_InitBuffer(320,168);let on=true;const s={} as hu_stext_t;L.HUlib_initSText(s,0,24,4,font(),33,()=>on);for(const text of ['A','B','C','D','E'])L.HUlib_addMessageToSText(s,'P:',text);assert.equal(s.cl,1);assert.equal(L.HUlib_Text(s.l[1]),'P:E');assert.equal(L.HUlib_Text(s.l[2]),'P:B');L.HUlib_drawSText(s);assert.equal(pixel(0,18),80);screens[0].fill(0);on=false;L.HUlib_drawSText(s);assert.ok(screens[0].every(v=>v===0));L.HUlib_eraseSText(s);assert.ok(s.l.every(l=>l.needsupdate===3));assert.equal(s.laston,false);assert.throws(()=>L.HUlib_initSText(s,0,0,5,font(),33,()=>on));
});
test('HU erasure restores full rows outside a reduced view and only side borders inside it',()=>{
 V_Init();let automap=false;L.HUlib_InitContext(()=>automap);R_InitBuffer(200,100);const t=line();screens[1].fill(8);screens[0].fill(9);t.needsupdate=4;L.HUlib_eraseTextLine(t);assert.ok(screens[0].subarray(0,6*320).every(v=>v===8));assert.equal(t.needsupdate,3);screens[0].fill(9);t.y=40;L.HUlib_eraseTextLine(t);assert.equal(pixel(0,40),8);assert.equal(pixel(59,40),8);assert.equal(pixel(60,40),9);assert.equal(pixel(259,40),9);assert.equal(pixel(260,40),8);screens[0].fill(9);automap=true;L.HUlib_eraseTextLine(t);assert.ok(screens[0].every(v=>v===9));assert.equal(t.needsupdate,1);automap=false;R_InitBuffer(320,168);L.HUlib_eraseTextLine(t);assert.ok(screens[0].every(v=>v===9));assert.equal(t.needsupdate,0);
});
test('Input editing enforces a prefix, preserves accepted-key behavior at capacity and draws its cursor',()=>{
 V_Init();let on=true;const it={} as hu_itext_t;L.HUlib_initIText(it,0,0,font(),33,()=>on);L.HUlib_addPrefixToIText(it,'P:');L.HUlib_delCharFromIText(it);assert.equal(L.HUlib_Text(it.l),'P:');assert.equal(L.HUlib_keyInIText(it,65),true);L.HUlib_eraseLineFromIText(it);assert.equal(it.l.len,2);for(let i=0;i<90;i++)assert.equal(L.HUlib_keyInIText(it,66),true);assert.equal(it.l.len,80);assert.equal(L.HUlib_keyInIText(it,KEY_ENTER),true);assert.equal(L.HUlib_keyInIText(it,KEY_ESCAPE),false);L.HUlib_resetIText(it);assert.equal(it.lm,0);L.HUlib_keyInIText(it,65);L.HUlib_drawIText(it);assert.equal(pixel(3,0),95);on=false;L.HUlib_eraseIText(it);assert.equal(it.laston,false);assert.equal(it.l.needsupdate,3);
});
test('HU displays a pickup message for exactly 140 tics, consumes player.message and refreshes with Enter',()=>{
 const {p,tick}=fixture();p.message=TEXT.GOTCLIP;tick();assert.equal(p.message,null);assert.equal(HU.HU_GetState().text,TEXT.GOTCLIP);assert.equal(HU.HU_GetState().counter,HU_MSGTIMEOUT);tick(139);assert.equal(HU.HU_GetState().visible,true);tick();assert.equal(HU.HU_GetState().visible,false);assert.equal(HU.HU_Responder(event(KEY_ENTER,EV.ev_keyup)),false);assert.equal(HU.HU_Responder(event(KEY_ENTER)),true);assert.equal(HU.HU_GetState().visible,true);assert.equal(HU.HU_GetState().counter,140);HU.HU_Drawer();assert.ok(screens[0].subarray(0,320*5).some(v=>v!==0));
});
test('HU honors disabled messages, forced notices and protected-message replacement priority',()=>{
 const {g,p,tick}=fixture();g.showMessages=false;p.message='WAIT';tick();assert.equal(p.message,'WAIT');assert.equal(HU.HU_GetState().visible,false);HU.HU_ForceMessage('FORCED');tick();assert.equal(HU.HU_GetState().protected,true);g.showMessages=true;p.message='NORMAL';tick();assert.equal(HU.HU_GetState().text,'FORCED');HU.HU_ForceMessage('REPLACED');tick();assert.equal(HU.HU_GetState().text,'REPLACED');p.message='LATER';tick(139);assert.equal(HU.HU_GetState().text,'REPLACED');tick();assert.equal(HU.HU_GetState().text,'LATER');assert.equal(HU.HU_GetState().counter,140);
});
test('HU names retain all DOOM, Doom II, Plutonia, TNT and NEWLEVEL tables; title only draws in automap',()=>{
 const {g}=fixture();assert.equal(HU.HU_GetState().title,TEXT.HUSTR_E1M1);assert.equal(HU.mapnames.length,45);assert.equal(HU.mapnames[44],'NEWLEVEL');assert.equal(HU.mapnamesp[31],TEXT.PHUSTR_32);assert.equal(HU.mapnamest[31],TEXT.THUSTR_32);g.gamemode=MODE.commercial;g.gamemap=32;HU.HU_Start();assert.equal(HU.HU_GetState().title,TEXT.HUSTR_32);HU.HU_Drawer();assert.ok(screens[0].every(v=>v===0));g.automapactive=true;HU.HU_Drawer();assert.ok(screens[0].subarray(162*320,167*320).some(v=>v!==0));
});
test('HU outgoing chat queues broadcast, shifted text, deletion and Enter without enabling networking',()=>{
 const {p,tick}=fixture(true);assert.equal(HU.HU_Responder(event(116)),true);assert.equal(HU.HU_GetState().chat,true);HU.HU_Responder(event(97));HU.HU_Responder(event(KEY_RSHIFT));HU.HU_Responder(event(49));HU.HU_Responder(event(KEY_RSHIFT,EV.ev_keyup));HU.HU_Responder(event(KEY_BACKSPACE));HU.HU_Responder(event(98));HU.HU_Responder(event(KEY_ENTER));assert.deepEqual(drain(),[5,65,33,127,66,13]);assert.equal(p.message,'AB');tick();assert.equal(HU.HU_GetState().text,'AB');assert.equal(HU.HU_GetState().chat,false);
});
test('HU macros flush pending chat and report the original local text; Escape leaves chat',()=>{
 const {p}=fixture(true);HU.HU_Responder(event(116));HU.HU_Responder(event(KEY_RALT));HU.HU_Responder(event(52));assert.deepEqual(drain(),[5,13,...Array.from(TEXT.HUSTR_CHATMACRO4,c=>c.charCodeAt(0)),13]);assert.equal(p.message,TEXT.HUSTR_CHATMACRO4);assert.equal(HU.HU_GetState().chat,false);HU.HU_Responder(event(KEY_RALT,EV.ev_keyup));HU.HU_Responder(event(116));assert.equal(HU.HU_Responder(event(KEY_ESCAPE)),false);assert.equal(HU.HU_GetState().chat,false);
});
test('HU chat ring holds 127 bytes, reports overflow and wraps without losing order',()=>{
 const {p}=fixture();for(let i=0;i<127;i++)HU.HU_queueChatChar(i+1);HU.HU_queueChatChar(255);assert.equal(p.message,TEXT.HUSTR_MSGU);for(let i=0;i<60;i++)assert.equal(HU.HU_dequeueChatChar(),i+1);for(let i=0;i<60;i++)HU.HU_queueChatChar(150+i);assert.deepEqual(drain(),[...Array.from({length:67},(_,i)=>i+61),...Array.from({length:60},(_,i)=>150+i)]);
});
test('HU incoming chat respects destinations, active players, case conversion, receive sound and protection',()=>{
 const {g,sounds,tick}=fixture(true);const send=(player:number,c:number)=>{g.players[player].cmd.chatchar=c;tick();assert.equal(g.players[player].cmd.chatchar,0);};send(1,1);for(const ch of 'hi')send(1,ch.charCodeAt(0));send(1,KEY_ENTER);assert.equal(HU.HU_GetState().text,'Indigo: HI');assert.deepEqual(sounds,[SFX.sfx_tink]);send(2,2);send(2,65);send(2,KEY_ENTER);assert.equal(sounds.length,1);g.gamemode=MODE.commercial;send(1,5);send(1,66);send(1,KEY_ENTER);assert.equal(sounds.at(-1),SFX.sfx_radio);g.playeringame[2]=false;g.players[2].cmd.chatchar=65;tick();assert.equal(g.players[2].cmd.chatchar,65);
});
test('HU destinations, self-chat thresholds and French keyboard tables match the source',()=>{
 const {p}=fixture(true,true);assert.equal(HU.french_shiftxform.length,128);assert.equal(HU.english_shiftxform[49],33);assert.equal(HU.ForeignTranslation(97),81);assert.equal(HU.ForeignTranslation(200),200);for(let i=0;i<3;i++)HU.HU_Responder(event(TEXT.HUSTR_KEYGREEN));assert.equal(p.message,TEXT.HUSTR_TALKTOSELF2);HU.HU_Responder(event(TEXT.HUSTR_KEYRED));assert.equal(HU.HU_dequeueChatChar(),4);HU.HU_Responder(event(97));assert.equal(HU.HU_GetState().input,'Q');HU.HU_Responder(event(KEY_RSHIFT));assert.equal(HU.HU_Responder(event(0xac)),false);
});
test('Shared HU font lookup follows WAD overrides, reloads and missing resources',()=>{
 fixture();assert.equal(firstPixel(HU.HU_FontPatch(65)),65);const replacement=assets(77);W_AddFile({name:'override.wad',data:makeWad(replacement)});assert.ok(HU.HU_CanLoad());assert.equal(firstPixel(HU.HU_FontPatch(65)),77);W_Reload({name:'override.wad',data:makeWad(assets(88))});assert.equal(firstPixel(HU.HU_FontPatch(65)),88);HU.HU_Unload();W_InitFile({name:'empty.wad',data:makeWad([{name:'NOTFONT',data:new Uint8Array()}])});assert.equal(HU.HU_CanLoad(),false);assert.throws(()=>HU.HU_FontPatch(1),/range/);assert.equal(HU.HU_IsActive(),false);
});
test('Native sessions consume a real pickup, render its HU glyphs and freeze message time outside the level',()=>{
 const {session}=createHeadlessGame();assert.equal(HU.HU_IsActive(),true);assert.ok(P_TeleportMove(session.player.mo!,-24*65536,-64*65536));assert.ok(P_TryMove(session.player.mo!,0,-64*65536));session.step(cmd());assert.equal(session.player.message,null);assert.equal(session.headsUp!.text,TEXT.GOTCLIP);screens[0].fill(0);HU.HU_Drawer();assert.ok(screens[0].subarray(0,320*7).some(v=>v!==0));const counter=session.headsUp!.counter;session.state.G_ExitLevel();session.step(cmd());assert.equal(HU.HU_IsActive(),false);session.step(cmd());assert.equal(HU.HU_GetState().counter,counter);assert.equal(session.headsUp,null);
});
test('HU ticks and drawing do not consume gameplay or cosmetic RNG',()=>{
 const {p,tick}=fixture();M_ClearRandom();p.message='TEST';tick(140);HU.HU_Drawer();HU.HU_Erase();assert.equal(rndindex,0);assert.equal(prndindex,0);
});

test('Literal keyboard tables match every byte in the original C arrays',()=>{
 const source=readFileSync(new URL('../original/linuxdoom-1.10/hu_stuff.c',import.meta.url),'utf8');
 for(const name of ['french_shiftxform','english_shiftxform','frenchKeyMap'] as const){const body=new RegExp('\\b'+name+'\\[[^\\]]*\\]\\s*=\\s*\\{([\\s\\S]*?)\\};').exec(source)![1].replace(/\/\/[^\n]*/g,'');
  const values=[...body.matchAll(/'(?:\\.|[^'\\])*'|\d+/g)].map(([token])=>token.startsWith("'")?token.slice(1,-1).replace(/\\(.)/g,'$1').charCodeAt(0):Number(token));assert.deepEqual([...HU[name]],values,name);
 }
});
import { readFileSync } from 'node:fs';

test('A missing HU glyph keeps the textual fallback while the native status bar and simulation remain active',()=>{
 const {session}=createHeadlessGame();const data=playableDemoWad(),v=new DataView(data.buffer),directory=v.getInt32(8,true);
 for(let i=0;i<v.getInt32(4,true);i++){const at=directory+i*16,name=new TextDecoder().decode(data.subarray(at+8,at+16)).replace(/\0/g,'');if(name==='STCFN033')data[at+8]=88;}
 HU.HU_Unload();W_InitFile({name:'missing-font.wad',data});session.start();assert.equal(HU.HU_CanLoad(),false);assert.equal(session.headsUp,null);session.player.message='FALLBACK';session.step(cmd());assert.equal(session.player.message,'FALLBACK');assert.ok(session.player.mo);
});
import { playableDemoWad } from '../src/web/playable-demo';
