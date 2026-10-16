import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as ST from '../src/linuxdoom-1.10/st_stuff';
import * as L from '../src/linuxdoom-1.10/st_lib';
import type { st_number_t,st_multicon_t,st_binicon_t,st_percent_t } from '../src/linuxdoom-1.10/st_lib.h';
import { W_InitFile,W_AddFile,W_GetNumForName } from '../src/linuxdoom-1.10/w_wad';
import { V_Init,screens } from '../src/linuxdoom-1.10/v_video';
import { makeWad,maskedPatch } from '../src/web/demo';
import { statusDemoAssets } from '../src/web/status-demo';
import { G_CreatePlayer } from '../src/linuxdoom-1.10/g_game';
import { weapontype_t as WP,powertype_t as PW,gamestate_t as GS } from '../src/linuxdoom-1.10/doomdef.h';
import { cheat_t as CF } from '../src/linuxdoom-1.10/d_player.h';
import { M_ClearRandom,rndindex,prndindex } from '../src/linuxdoom-1.10/m_random';
import { R_SetViewSize,R_ExecuteSetViewSize,R_RenderPlayerView,view } from '../src/linuxdoom-1.10/r_main';
import { buttoncode_t as BT } from '../src/linuxdoom-1.10/d_event.h';
import { createHeadlessGame } from './helpers/game-session';
const patch=(color:number,w=3,h=5,left=0,top=0)=>maskedPatch(w,h,()=>color,left,top),at=(x:number,y:number)=>screens[0][y*320+x];
const cmd=(buttons=0)=>({forwardmove:0,sidemove:0,angleturn:0,consistancy:0,chatchar:0,buttons});
function widgets(){V_Init();W_InitFile({name:'widgets.wad',data:makeWad([{name:'STTMINUS',data:patch(90)}])});L.STlib_init();screens[4].fill(7);screens[0].fill(7);return Array.from({length:10},(_,i)=>patch(20+i));}
test('Status numbers right-align digits, clear old values, draw zero and blank sentinel 1994',()=>{
 const digits=widgets();let value=123,on=true;const n={} as st_number_t;L.STlib_initNum(n,40,170,digits,()=>value,()=>on,3);L.STlib_updateNum(n,true);assert.deepEqual([at(31,170),at(34,170),at(37,170)],[21,22,23]);
 value=0;L.STlib_updateNum(n,false);assert.deepEqual([at(31,170),at(34,170),at(37,170)],[7,7,20]);value=1994;L.STlib_updateNum(n,false);assert.equal(at(37,170),7);value=1;on=false;L.STlib_updateNum(n,true);assert.equal(at(37,170),7);assert.equal(n.oldnum,1994);
});
test('Status numbers retain negative clamps, fixed minus offset and low digits on overflow',()=>{
 const digits=widgets();let value=-100;const n={} as st_number_t;L.STlib_initNum(n,40,170,digits,()=>value,()=>true,3);L.STlib_drawNum(n,true);assert.deepEqual([at(34,170),at(37,170),at(26,170)],[29,29,90]);assert.equal(n.oldnum,-100);
 L.STlib_initNum(n,40,170,digits,()=>value,()=>true,2);L.STlib_drawNum(n,true);assert.equal(at(37,170),29);value=12345;L.STlib_drawNum(n,true);assert.deepEqual([at(34,170),at(37,170)],[24,25]);
 n.y=160;assert.throws(()=>L.STlib_drawNum(n,true),/ST_Y/);
});
test('Percent sign refresh and enabled flag follow the original widget behavior',()=>{
 const digits=widgets(),p={} as st_percent_t;let on=true;L.STlib_initPercent(p,40,170,digits,()=>150,()=>on,patch(99));L.STlib_updatePercent(p,false);assert.equal(at(40,170),7);L.STlib_updatePercent(p,true);assert.equal(at(40,170),99);screens[0].fill(7);on=false;L.STlib_updatePercent(p,true);assert.equal(at(40,170),7);
});
test('Multiple icons erase the old offset rectangle, skip equal indices and preserve the -1 quirk',()=>{
 widgets();const m={} as st_multicon_t;let index=0;L.STlib_initMultIcon(m,40,175,[patch(80,6,7,2,3),patch(90)],()=>index,()=>true);L.STlib_updateMultIcon(m,true);assert.equal(at(38,172),80);index=1;L.STlib_updateMultIcon(m,false);assert.equal(at(38,172),7);assert.equal(at(40,175),90);screens[0][175*320+40]=33;L.STlib_updateMultIcon(m,false);assert.equal(at(40,175),33);index=-1;L.STlib_updateMultIcon(m,false);assert.equal(m.oldinum,1);assert.equal(at(40,175),33);
});
test('Binary icons restore the status background when switched off',()=>{
 widgets();const b={} as st_binicon_t;let value=true;L.STlib_initBinIcon(b,40,175,patch(80,4,6,2,2),()=>value,()=>true);L.STlib_updateBinIcon(b,false);assert.equal(at(38,173),80);value=false;L.STlib_updateBinIcon(b,false);assert.equal(at(38,173),7);
});
function fixture(){
 ST.ST_Stop();ST.ST_unloadData();V_Init();const palettes=Uint8Array.from({length:14*768},(_,i)=>Math.floor(i/768));W_InitFile({name:'status.wad',data:makeWad([{name:'PLAYPAL',data:palettes},...statusDemoAssets()])});
 const applied:Uint8Array[]=[],g:ST.status_context_t={players:Array.from({length:4},G_CreatePlayer),consoleplayer:0,deathmatch:0,netgame:false,automapactive:false,I_SetPalette:p=>applied.push(p.slice())};g.players[0].health=100;g.players[0].readyweapon=WP.wp_pistol;g.players[0].ammo[0]=50;
 ST.ST_InitContext(g);assert.equal(ST.ST_CanLoad(),true);ST.ST_Init();ST.ST_Start();const p=g.players[0];
 // Expire the C function-static face state, deliberately retained by ST_Start.
 p.attackdown=0;for(let i=0;i<80;i++)ST.ST_Ticker();return {g,p,applied};
}
test('Status layout draws a native 320x32 bar, leaves the world intact and respects fullscreen/automap',()=>{
 const {g}=fixture();screens[0].fill(11);ST.ST_Drawer(false,true);assert.equal(screens[4].length,320*32);assert.ok(screens[0].subarray(0,168*320).every(v=>v===11));assert.ok(screens[0].subarray(168*320).some(v=>v!==11));screens[0].fill(12);ST.ST_Drawer(true,true);assert.ok(screens[0].every(v=>v===12));g.automapactive=true;ST.ST_Drawer(true,true);assert.ok(screens[0].subarray(168*320).some(v=>v!==12));ST.ST_Stop();
});
test('Ready ammo handles fists/chainsaw; skulls override cards and frag sums subtract self-frags',()=>{
 const {g,p}=fixture();p.readyweapon=WP.wp_fist;p.cards[0]=true;p.cards[3]=true;p.cards[2]=true;p.frags.set([2,4,-1,5]);g.deathmatch=1;ST.ST_Ticker();assert.deepEqual(ST.ST_GetState().keyboxes,[3,-1,2]);assert.equal(ST.ST_GetState().readyammo,1994);assert.equal(ST.ST_GetState().frags,6);p.readyweapon=WP.wp_pistol;p.ammo[0]=31;ST.ST_Ticker();assert.equal(ST.ST_GetState().readyammo,31);ST.ST_Drawer(false,true);ST.ST_Stop();
});
test('Pain bands preserve integer boundaries and clamp overhealed players',()=>{
 const {p}=fixture();for(const [health,offset] of [[200,0],[100,0],[80,0],[79,8],[59,16],[39,24],[19,32],[0,32]]){p.health=health;assert.equal(ST.ST_calcPainOffset(),offset);}ST.ST_Stop();
});
test('Face priority preserves death, invulnerability, weapon grin and original timing',()=>{
 const {p}=fixture();p.cheats=CF.CF_GODMODE;ST.ST_Ticker();assert.equal(ST.ST_GetState().faceindex,40);p.weaponowned[WP.wp_shotgun]=true;p.bonuscount=5;ST.ST_Ticker();assert.equal(ST.ST_GetState().faceindex,6);assert.equal(ST.ST_GetState().facecount,69);p.health=0;ST.ST_Ticker();assert.equal(ST.ST_GetState().faceindex,41);assert.equal(ST.ST_GetState().priority,9);ST.ST_Stop();
});
test('Rapid fire waits 70 tics and consumes exactly one cosmetic random value per status tic',()=>{
 const {p}=fixture();M_ClearRandom();const before=prndindex;p.attackdown=1;for(let i=0;i<70;i++)ST.ST_Ticker();assert.notEqual(ST.ST_GetState().faceindex,7);ST.ST_Ticker();assert.equal(ST.ST_GetState().faceindex,7);assert.equal(rndindex,71);assert.equal(prndindex,before);ST.ST_Stop();
});
test('Large health losses preserve the C ouch sign error; self damage selects the rampage face',()=>{
 const {p}=fixture();p.health=100;ST.ST_Ticker();p.health=60;p.damagecount=30;p.attacker=null;ST.ST_Ticker();assert.equal(ST.ST_GetState().faceindex,8+7);ST.ST_Stop();
});
test('Damage, berserk, bonus and radiation palettes preserve priorities, limits and blink thresholds',()=>{
 const {p,applied}=fixture();const draw=()=>{ST.ST_doPaletteStuff();return applied.at(-1)![0];};assert.equal(draw(),0);p.damagecount=1;assert.equal(draw(),2);p.damagecount=100;assert.equal(draw(),8);p.bonuscount=100;assert.equal(draw(),8);p.damagecount=0;assert.equal(draw(),12);p.powers[PW.pw_strength]=1;assert.equal(draw(),3);p.powers[PW.pw_strength]=1024;p.bonuscount=0;p.powers[PW.pw_ironfeet]=129;assert.equal(draw(),13);p.powers[PW.pw_ironfeet]=128;assert.equal(draw(),0);p.powers[PW.pw_ironfeet]=8;assert.equal(draw(),13);const n=applied.length;draw();assert.equal(applied.length,n);ST.ST_Stop();assert.equal(applied.at(-1)![0],0);
});
test('Graphic reload uses WAD overrides and releases previous resources; incomplete assets are detected',()=>{
 const {applied}=fixture();ST.ST_Drawer(false,true);const before=screens[0].slice();ST.ST_Stop();ST.ST_unloadData();W_AddFile({name:'override.wad',data:makeWad([{name:'STBAR',data:patch(85,320,32)}])});ST.ST_Init();ST.ST_Start();ST.ST_Drawer(false,true);assert.notDeepEqual(screens[0],before);assert.equal(at(0,168),85);ST.ST_Stop();ST.ST_unloadData();assert.equal(applied.at(-1)![0],0);W_InitFile({name:'empty.wad',data:makeWad([{name:'PLAYPAL',data:new Uint8Array(768)}])});assert.equal(ST.ST_CanLoad(),false);
});
test('A short PLAYPAL keeps its base palette without reading outside the lump',()=>{
 const {p,applied}=fixture();ST.ST_Stop();W_AddFile({name:'palette.wad',data:makeWad([{name:'PLAYPAL',data:new Uint8Array(768).fill(77)}])});ST.ST_Init();ST.ST_Start();p.damagecount=100;ST.ST_doPaletteStuff();assert.equal(applied.at(-1)!.length,768);assert.equal(applied.at(-1)![0],77);ST.ST_Stop();
});
test('Native session ticks the HUD, draws with a 168px world and stops it at intermission',()=>{
 const {session}=createHeadlessGame(true);assert.equal(ST.ST_IsRunning(),true);const time=ST.ST_GetState().clock;session.step(cmd());assert.equal(ST.ST_GetState().clock,time+1);R_SetViewSize(10,0);R_ExecuteSetViewSize();assert.equal(view.viewheight,168);R_RenderPlayerView(session.player,()=>{});ST.ST_Drawer(false,true);assert.ok(screens[0].subarray(320*168).some(v=>v!==0));session.step(cmd(BT.BT_USE));assert.equal(session.state.gamestate,GS.GS_INTERMISSION);assert.equal(ST.ST_IsRunning(),false);const clock=ST.ST_GetState().clock;session.step(cmd());assert.equal(ST.ST_GetState().clock,clock);
});

test('Face direction follows original head-on, left and right angle comparisons',()=>{
 const {session}=createHeadlessGame();const p=session.player;p.attackdown=0;for(let i=0;i<80;i++)ST.ST_Ticker();const mo=p.mo!;mo.angle=0;
 // An attacker can be a separate actor even when it has the same coordinates.
 p.attacker={...mo,x:mo.x+100*65536,y:mo.y};p.damagecount=1;ST.ST_Ticker();assert.equal(ST.ST_GetState().faceindex,7);
 p.attacker={...mo,x:mo.x,y:mo.y+100*65536};ST.ST_Ticker();assert.equal(ST.ST_GetState().faceindex,4);
 p.attacker={...mo,x:mo.x,y:mo.y-100*65536};ST.ST_Ticker();assert.equal(ST.ST_GetState().faceindex,3);ST.ST_Stop();
});
test('A WAD without status patches starts and simulates with the textual HUD fallback',()=>{
 const {session}=createHeadlessGame();ST.ST_Stop();ST.ST_unloadData();
 const count=W_GetNumForName('STBAR'); // Remove just the status background through a fresh test WAD.
 assert.ok(count>=0);const data=playableDemoWad(),view=new DataView(data.buffer),directory=view.getInt32(8,true),entries=view.getInt32(4,true);
 for(let i=0;i<entries;i++){const at=directory+i*16;const name=new TextDecoder().decode(data.subarray(at+8,at+16)).replace(/\0/g,'');if(name==='STBAR')data[at+8]='X'.charCodeAt(0);}
 W_InitFile({name:'no-status.wad',data});session.start();assert.equal(ST.ST_CanLoad(),false);assert.equal(ST.ST_IsRunning(),false);session.step(cmd());assert.ok(session.player.mo);
});
import { playableDemoWad } from '../src/web/playable-demo';
