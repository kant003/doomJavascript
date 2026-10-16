import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as F from '../src/linuxdoom-1.10/f_finale';
import { G_CreatePlayer } from '../src/linuxdoom-1.10/g_game';
import { GameMode_t as MODE,gamestate_t as GS } from '../src/linuxdoom-1.10/doomdef.h';
import { gameaction_t as GA,evtype_t as EV,buttoncode_t as BT } from '../src/linuxdoom-1.10/d_event.h';
import { sfxenum_t as SFX } from '../src/linuxdoom-1.10/sounds.h';
import { mobjinfo,states } from '../src/linuxdoom-1.10/info';
import { statenum_t as ST } from '../src/linuxdoom-1.10/info.h';
import * as texts from '../src/linuxdoom-1.10/d_englsh.h';
import { W_InitFile,W_AddFile,W_GetNumForName,W_Reload } from '../src/linuxdoom-1.10/w_wad';
import { V_Init,screens } from '../src/linuxdoom-1.10/v_video';
import { texturestate } from '../src/linuxdoom-1.10/r_data';
import { spritesState } from '../src/linuxdoom-1.10/r_things';
import { makeWad,maskedPatch } from '../src/web/demo';
import { finaleDemoAssets } from '../src/web/finale-demo';
import { createHeadlessGame } from './helpers/game-session';
import { leveltime } from '../src/linuxdoom-1.10/p_tick';
const event=(type=EV.ev_keydown)=>({type,data1:32,data2:0,data3:0});
const cmd=(buttons=0)=>({forwardmove:0,sidemove:0,angleturn:0,buttons,consistancy:0,chatchar:0});
function fixture(mode=MODE.shareware,episode=1,map=8){
 V_Init();W_InitFile({name:'finale.wad',data:makeWad(finaleDemoAssets())});
 const sounds:SFX[]=[],g:F.finale_context_t={gamemode:mode,gameepisode:episode,gamemap:map,gameaction:GA.ga_victory,gamestate:GS.GS_LEVEL,viewactive:true,automapactive:true,wipegamestate:GS.GS_LEVEL,players:Array.from({length:4},G_CreatePlayer),S_ChangeMusic:()=>{},S_StartMusic:()=>{},S_StartSound:(_origin,id)=>sounds.push(id)};
 F.F_InitContext(g);F.F_StartFinale();return {g,sounds,tick:(n:number)=>{for(let i=0;i<n;i++)F.F_Ticker();}};
}
const solid=(name:string,value:number,width=320,height=200)=>({name,data:maskedPatch(width,height,()=>value)});
function add(lumps:{name:string;data:Uint8Array}[]){W_AddFile({name:'assets.wad',data:makeWad(lumps)});}
test('Finale selects the exact text and flat for four episodes and six commercial story boundaries',()=>{
 for(const [mode,episode,map,text,flat] of [
  [MODE.shareware,1,8,texts.E1TEXT,'FLOOR4_8'],[MODE.registered,2,8,texts.E2TEXT,'SFLR6_1'],[MODE.registered,3,8,texts.E3TEXT,'MFLR8_4'],[MODE.retail,4,8,texts.E4TEXT,'MFLR8_3'],
  [MODE.commercial,1,6,texts.C1TEXT,'SLIME16'],[MODE.commercial,1,11,texts.C2TEXT,'RROCK14'],[MODE.commercial,1,20,texts.C3TEXT,'RROCK07'],[MODE.commercial,1,30,texts.C4TEXT,'RROCK17'],[MODE.commercial,1,15,texts.C5TEXT,'RROCK13'],[MODE.commercial,1,31,texts.C6TEXT,'RROCK19'],[MODE.indetermined,1,1,texts.C1TEXT,'F_SKY1']
 ] as const){const {g}=fixture(mode,episode,map);assert.equal(F.finaletext,text);assert.equal(F.finaleflat,flat);assert.equal(F.finalecount,0);assert.equal(F.finalestage,0);assert.equal(g.gameaction,GA.ga_nothing);assert.equal(g.gamestate,GS.GS_FINALE);assert.equal(g.viewactive,false);assert.equal(g.automapactive,false);}
 // The C switches have no default in a recognized mode; keep their previous values.
 const {g}=fixture(MODE.commercial,1,6);g.gamemap=7;F.F_StartFinale();assert.equal(F.finaletext,texts.C1TEXT);
});
test('Doom waits for the full original text duration then requests art and a wipe; buttons do not skip it',()=>{
 const {g,tick}=fixture();g.players[0].cmd.buttons=BT.BT_ATTACK;
 tick(texts.E1TEXT.length*3+250);assert.equal(F.finalestage,0);assert.equal(F.F_Responder(event()),false);
 tick(1);assert.equal(F.finalestage,1);assert.equal(F.finalecount,0);assert.equal(g.wipegamestate,-1);assert.equal(g.gameaction,GA.ga_nothing);
});
test('Commercial text only accepts buttons after 51 tics, even from an inactive player slot',()=>{
 const {g,tick}=fixture(MODE.commercial,1,6);g.players[3].cmd.buttons=BT.BT_USE;
 tick(51);assert.equal(g.gameaction,GA.ga_nothing);tick(1);assert.equal(g.gameaction,GA.ga_worlddone);
 const c=fixture(MODE.commercial,1,30);c.tick(10000);assert.equal(F.finalestage,0);c.g.players[0].cmd.buttons=BT.BT_USE;c.tick(1);assert.equal(F.finalestage,2);assert.equal(c.g.wipegamestate,-1);
});
test('Text rendering tiles the flat and preserves the ten-tic lead-in, three-tic glyph cadence and newlines',()=>{
 const {tick}=fixture();assert.equal(F.F_CanDraw(),true);tick(12);F.F_TextWrite();assert.ok(screens[0].every(v=>v===32||v===40));
 tick(1);F.F_TextWrite();assert.equal(screens[0][10*320+11],255);assert.equal(screens[0][10*320+16],32);
 const count=(texts.E1TEXT.indexOf('\n')+2)*3+10;tick(count-F.finalecount);F.F_TextWrite();assert.equal(screens[0][21*320+11],255);
 assert.equal(F.F_GetState().visibleText,texts.E1TEXT.slice(0,Math.trunc((count-10)/3)));
});
test('Text stops at the right edge instead of wrapping or drawing an oversized glyph',()=>{
 const {tick}=fixture();add([solid('STCFN079',255,311,7)]);tick(30);F.F_TextWrite();assert.ok(screens[0].every(v=>v===32||v===40));
});
test('Episode art uses HELP2, CREDIT, VICTORY2 and ENDPIC in their original modes',()=>{
 for(const [mode,episode,name,value] of [[MODE.shareware,1,'HELP2',101],[MODE.retail,1,'CREDIT',102],[MODE.registered,2,'VICTORY2',103],[MODE.retail,4,'ENDPIC',104]] as const){
  const f=fixture(mode,episode);add([solid(name,value)]);f.tick(F.finaletext.length*3+251);assert.ok(F.F_CanDraw());F.F_Drawer();assert.ok(screens[0].every(v=>v===value));
 }
});
test('Bunny panorama scrolling, END stages and pistol sounds retain their exact thresholds',()=>{
 const {tick,sounds}=fixture(MODE.registered,3);add([solid('PFUB2',20),solid('PFUB1',30),...Array.from({length:7},(_,i)=>solid(`END${i}`,50+i,104,64))]);
 tick(F.finaletext.length*3+251);assert.equal(F.finalecount,0);F.F_Drawer();assert.equal(screens[0][0],30);
 tick(232);F.F_Drawer();assert.equal(screens[0][0],20);assert.equal(screens[0][1],30);
 tick(870-F.finalecount);F.F_Drawer();assert.equal(screens[0][319],20);
 tick(1130-F.finalecount);F.F_Drawer();assert.equal(screens[0][100*320+160],50);assert.equal(sounds.length,0);
 tick(55);F.F_Drawer();F.F_Drawer();assert.equal(screens[0][100*320+160],51);assert.deepEqual(sounds,[SFX.sfx_pistol]);
 tick(25);F.F_Drawer();assert.equal(screens[0][100*320+160],56);assert.equal(sounds.length,2);
});
test('Finale column drawing handles transparent posts and rejects truncated data before painting',()=>{
 fixture();screens[0].fill(77);const patch=maskedPatch(2,8,(_x,y)=>y===1||y===5?90:null);F.F_DrawPatchCol(3,patch,0);
 assert.equal(screens[0][1*320+3],90);assert.equal(screens[0][5*320+3],90);assert.equal(screens[0][2*320+3],77);
 const bad=patch.slice();new DataView(bad.buffer).setUint32(8,bad.length,true);const before=screens[0].slice();assert.throws(()=>F.F_DrawPatchCol(3,bad,0),/Truncated/);assert.deepEqual(screens[0],before);assert.throws(()=>F.F_DrawPatchCol(320,patch,0),/Invalid/);
});
test('Cast animation enters attacks with native sound hacks without executing actor actions',()=>{
 const {sounds}=fixture(MODE.commercial,1,30);F.F_StartCast();
 assert.equal(F.castorder.length,17);assert.strictEqual(F.caststate,states[mobjinfo[F.castorder[0][1]].seestate]);
 for(let i=0;i<300;i++)F.F_CastTicker();assert.equal(F.castnum,0);assert.ok(sounds.includes(SFX.sfx_pistol));
});
test('Cast death input is consumed only on keydown, emits its sound once and cycles all 17 actors',()=>{
 const {sounds}=fixture(MODE.commercial,1,30);F.F_StartCast();assert.equal(F.F_Responder(event(EV.ev_keyup)),false);
 for(let n=0;n<17;n++){
  assert.equal(F.castnum,n);const before=sounds.length;assert.equal(F.F_Responder(event()),true);const deathSound=mobjinfo[F.castorder[n][1]].deathsound;assert.equal(sounds.length,before+Number(!!deathSound));
  const state=F.caststate;assert.equal(F.F_Responder(event()),true);assert.strictEqual(F.caststate,state);assert.equal(sounds.length,before+Number(!!deathSound));
  for(let i=0;i<500&&F.castnum===n;i++)F.F_CastTicker();assert.equal(F.castnum,(n+1)%17);
 }
 assert.equal(F.castdeath,false);
});
test('Cast drawing centers the real sprite frame and honors the rotation flip flag',()=>{
 fixture(MODE.commercial,1,30);add([solid('BOSSBACK',1),{name:'CASTPAT',data:maskedPatch(3,4,x=>4+x,1,4)}]);F.F_StartCast();
 texturestate.firstspritelump=W_GetNumForName('CASTPAT');const frame={rotate:false,lump:new Int16Array(8),flip:new Uint8Array(8)};
 spritesState.sprites=[];spritesState.sprites[F.caststate.sprite]={numframes:1,spriteframes:[frame]};assert.equal(F.F_CanDraw(),true);
 F.F_Drawer();assert.equal(screens[0][166*320+159],4);assert.equal(screens[0][166*320+161],6);
 frame.flip[0]=1;F.F_Drawer();assert.equal(screens[0][166*320+159],6);assert.equal(screens[0][166*320+161],4);
});
test('A synthetic E1M8 use exit reaches native text and final art while freezing the world',()=>{
 const {session}=createHeadlessGame(true);session.state.gamemap=8;session.start(false);session.step(cmd());session.step(cmd(BT.BT_USE));
 assert.equal(session.finale!.stage,0);assert.equal(session.finale!.drawable,true);const mo=session.player.mo!,time=leveltime,x=mo.x;
 for(let i=0;i<texts.E1TEXT.length*3+251;i++)session.step({...cmd(BT.BT_ATTACK),forwardmove:50});
 assert.equal(session.finale!.stage,1);assert.strictEqual(session.player.mo,mo);assert.equal(mo.x,x);assert.equal(leveltime,time);F.F_Drawer();assert.ok(screens[0].some(v=>v===255));
});
test('Commercial continuation waits for the finale ticker before loading the next level',()=>{
 const {session}=createHeadlessGame(true);const s=session.state;s.gamemode=MODE.commercial;s.gamemap=6;s.wminfo.next=6;
 add([{name:'MAP07',data:new Uint8Array()}]);let loads=0;s.G_DoLoadLevel=()=>{loads++;};s.F_StartFinale();
 // Entering via WorldDone normally already carries a level result.
 session.result={mapname:'MAP06',secret:false,terminal:false,kills:0,maxkills:0,items:0,maxitems:0,secrets:0,maxsecrets:0,tics:0};
 assert.equal(session.continueLevel(),true);for(let i=0;i<51;i++)session.step(cmd());assert.equal(loads,0);session.step(cmd());assert.equal(loads,1);assert.equal(s.gamemap,7);assert.equal(s.gamestate,GS.GS_LEVEL);
});

test('Font indexes follow PWAD overrides and reload bytes instead of retaining an old patch',()=>{
 const {tick}=fixture();tick(13);F.F_TextWrite();assert.equal(screens[0][10*320+10],40);
 add([solid('STCFN079',200,6,7)]);F.F_TextWrite();assert.equal(screens[0][10*320+10],200);
 W_Reload({name:'assets.wad',data:makeWad([solid('STCFN079',201,6,7)])});F.F_TextWrite();assert.equal(screens[0][10*320+10],201);
});
test('Missing finale font resources are reported without substituting game graphics',()=>{
 fixture();W_InitFile({name:'minimal.wad',data:makeWad([{name:'FLOOR4_8',data:new Uint8Array(4096)}])});assert.equal(F.F_CanDraw(),false);
 add(finaleDemoAssets());assert.equal(F.F_CanDraw(),true);
});
