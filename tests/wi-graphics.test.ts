import { test,mock } from 'node:test';
import assert from 'node:assert/strict';
import * as WI from '../src/linuxdoom-1.10/wi_stuff';
import { GameMode_t as MODE } from '../src/linuxdoom-1.10/doomdef.h';
import { G_CreatePlayer,G_CreateIntermission } from '../src/linuxdoom-1.10/g_game';
import { V_Init,screens } from '../src/linuxdoom-1.10/v_video';
import { W_InitFile,W_CheckNumForName } from '../src/linuxdoom-1.10/w_wad';
import { M_ClearRandom,rndindex,prndindex } from '../src/linuxdoom-1.10/m_random';
import { makeWad,maskedPatch } from '../src/web/demo';
import { intermissionDemoAssets } from '../src/web/intermission-demo';
import { buttoncode_t as BT,evtype_t as EV } from '../src/linuxdoom-1.10/d_event.h';
const solid=(name:string,color:number,w=2,h=2,left=0,top=0)=>({name,data:maskedPatch(w,h,()=>color,left,top)});
function fixture(mode=MODE.shareware,episode=0,next=1){
 V_Init();M_ClearRandom();
 const assets=intermissionDemoAssets();
 assets.push(solid(mode===MODE.commercial||episode===3?'INTERPIC':`WIMAP${episode}`,7,320,200));
 for(let i=0;i<(mode===MODE.commercial?32:9);i++)assets.push(solid(mode===MODE.commercial?`CWILV${String(i).padStart(2,'0')}`:`WILV${episode}${i}`,50+i,20+i*2,8+i%2));
 if(episode===1||episode===2)for(let j=0;j<(episode===1?8:6);j++)for(let i=0;i<(episode===1&&j!==7?1:3);i++)assets.push(solid(`WIA${episode}${String(j).padStart(2,'0')}${String(i).padStart(2,'0')}`,100+i));
 for(let i=0;i<10;i++)assets.push(solid(`WINUM${i}`,20+i,4,6));
 for(const [name,color,w,h] of [['WIMINUS',30,8,6],['WIPCNT',31,3,6],['WICOLON',32,2,6],['WISUCKS',33,8,6],['WIOSTK',34,10,6],['WIOSTI',35,10,6],['WISCRT2',36,10,6],['WITIME',37,10,6],['WIPAR',38,10,6],['WIF',39,12,4],['WIENTER',40,10,4]] as const)assets.push(solid(name,color,w,h));
 assets.push(solid('WISPLAT',90,2,2,1,1),solid('WIURH0',91),solid('WIURH1',92));
 W_InitFile({name:'wi.wad',data:makeWad(assets)});
 const players=Array.from({length:4},G_CreatePlayer),info=G_CreateIntermission();info.epsd=episode;info.next=next;info.maxkills=10;info.maxitems=10;info.maxsecret=10;info.partime=30*35;
 info.plyr[0].skills=3;info.plyr[0].sitems=4;info.plyr[0].ssecret=5;info.plyr[0].stime=120*35;
 let done=0;WI.WI_InitContext({gamemode:mode,netgame:false,deathmatch:0,players,playeringame:[true,false,false,false],S_StartSound:()=>{},G_WorldDone:()=>done++});WI.WI_Start(info);
 return {info,players,tick:(n=1,buttons=0)=>{players[0].cmd.buttons=buttons;for(let i=0;i<n;i++)WI.WI_Ticker();},get done(){return done;}};
}
const at=(x:number,y:number)=>screens[0][y*320+x];
test('Loading copies the background to screen one; slam restores every pixel and unload releases ownership',()=>{
 const f=fixture();assert.equal(WI.WI_CanDraw(),true);assert.ok(screens[1].every(v=>v===7));screens[0].fill(99);WI.WI_slamBackground();assert.deepEqual(screens[0],screens[1]);
 WI.WI_End();assert.equal(WI.WI_CanDraw(),false);WI.WI_Start(f.info);assert.equal(WI.WI_CanDraw(),true);WI.WI_initNoState();f.tick(10);assert.equal(f.done,1);assert.equal(WI.WI_CanDraw(),false);
});
test('Number drawing preserves zero padding, fixed digit truncation, signed placement and the 1994 sentinel',()=>{
 fixture();screens[0].fill(7);assert.equal(WI.WI_drawNum(100,40,123,-1),88);assert.deepEqual([at(88,40),at(92,40),at(96,40)],[21,22,23]);
 assert.equal(WI.WI_drawNum(100,50,5,3),88);assert.deepEqual([at(88,50),at(92,50),at(96,50)],[20,20,25]);
 assert.equal(WI.WI_drawNum(100,60,123,2),92);assert.deepEqual([at(92,60),at(96,60)],[22,23]);
 assert.equal(WI.WI_drawNum(100,70,-7,-1),88);assert.equal(at(88,70),30);assert.equal(at(96,70),27);
 const before=screens[0].slice();assert.equal(WI.WI_drawNum(100,80,-1994,-1),0);assert.deepEqual(screens[0],before);
});
test('Percentages hide negative counters and retain values greater than 100',()=>{
 fixture();screens[0].fill(7);WI.WI_drawPercent(100,40,-1);assert.ok(screens[0].every(v=>v===7));
 WI.WI_drawPercent(100,40,133);assert.deepEqual([at(88,40),at(92,40),at(96,40),at(100,40)],[21,23,23,31]);
});
test('Time draws colon-separated integer groups and the original SUCKS threshold at 3600 seconds',()=>{
 fixture();screens[0].fill(7);WI.WI_drawTime(100,40,61);assert.deepEqual([at(82,40),at(86,40),at(90,40),at(92,40),at(96,40)],[20,21,32,20,21]);
 WI.WI_drawTime(100,50,0);assert.deepEqual([at(90,50),at(92,50),at(96,50)],[32,20,20]);
 WI.WI_drawTime(100,60,3599);assert.equal(at(96,60),29);assert.notEqual(at(92,60),33);
 WI.WI_drawTime(100,70,3600);assert.equal(at(92,70),33);const before=screens[0].slice();WI.WI_drawTime(100,80,-1);assert.deepEqual(screens[0],before);
});
test('Completed/entering title placement preserves centering and the original title-height spacing',()=>{
 const f=fixture();WI.WI_slamBackground();WI.WI_drawLF();assert.equal(at(150,2),50);assert.equal(at(154,12),39);
 WI.WI_slamBackground();WI.WI_drawEL();assert.equal(at(155,2),40);assert.equal(at(149,13),51); // next title height 9, not ENTER height 4.
 f.info.next=99;assert.throws(()=>WI.WI_drawEL(),/Invalid next/);
});
test('The native single-player layout shows counters and suppresses the par in retail episode four',()=>{
 const f=fixture();f.tick(1,BT.BT_ATTACK);WI.WI_Drawer();assert.equal(at(50,50),34);assert.equal(at(50,59),35);assert.equal(at(50,68),36);assert.equal(at(270,50),31);assert.equal(at(266,50),20);assert.equal(at(262,50),23);assert.equal(at(176,168),38);
 const retail=fixture(MODE.retail,3);retail.tick(1,BT.BT_ATTACK);WI.WI_Drawer();assert.equal(at(176,168),7);WI.WI_initShowNextLoc();WI.WI_Drawer();assert.equal(at(149,13),51);
});
test('World-map nodes show completed and secret locations and force the next pointer during NoState',()=>{
 const f=fixture();f.info.didsecret=true;WI.WI_initNoState();WI.WI_Drawer();assert.equal(at(184,163),90);assert.equal(at(70,23),90);assert.equal(at(148,143),91);assert.equal(WI.WI_GetState().snl_pointeron,true);
});
test('Node placement tries the alternate pointer and safely rejects an out-of-bounds single splat',()=>{
 fixture();screens[0].fill(7);WI.WI_drawOnLnode(0,[solid('BAD',1,135,1).data,solid('ALT',92,2,2,1,1).data]);assert.equal(at(184,163),92);
 const warn=mock.method(console,'warn',()=>{});const before=screens[0].slice();WI.WI_drawOnLnode(0,[solid('BAD',1,200,1).data]);assert.deepEqual(screens[0],before);assert.equal(warn.mock.callCount(),1);warn.mock.restore();
});
test('Commercial routing uses INTERPIC/CWILV and suppresses ENTERING for the MAP31 secret destination',()=>{
 fixture(MODE.commercial,0,30);assert.ok(WI.WI_CanDraw());WI.WI_initShowNextLoc();WI.WI_drawShowNextLoc();assert.ok(screens[0].every(v=>v===7));
 fixture(MODE.commercial,0,29);WI.WI_initShowNextLoc();WI.WI_Drawer();assert.equal(at(155,2),40);assert.equal(at(121,13),79);
});
test('Animation initialization consumes only cosmetic RNG and cycles with integer C periods',()=>{
 const f=fixture();assert.equal(rndindex,10);assert.equal(prndindex,0);assert.deepEqual(WI.WI_GetAnimations()[0],{type:0,period:11,nanims:3,nexttic:9,ctr:-1});
 f.tick(8);assert.equal(WI.WI_GetAnimations()[0].ctr,-1);f.tick();assert.equal(WI.WI_GetAnimations()[0].ctr,0);assert.equal(WI.WI_GetAnimations()[0].nexttic,20);
 f.tick(33);assert.equal(WI.WI_GetAnimations()[0].ctr,0);assert.equal(rndindex,10);WI.WI_initShowNextLoc();assert.equal(rndindex,20);assert.equal(prndindex,0);
});
test('Episode-two level animation preserves its aliased asset and the frame-seven stats hack',()=>{
 const f=fixture(MODE.registered,1,8);assert.equal(W_CheckNumForName('WIA10800'),-1);assert.equal(WI.WI_CanDraw(),true);assert.equal(rndindex,0);
 f.tick();assert.equal(WI.WI_GetAnimations()[7].ctr,-1);assert.equal(WI.WI_GetAnimations()[8].ctr,0);WI.WI_initShowNextLoc();f.tick();assert.equal(WI.WI_GetAnimations()[7].ctr,0);
 fixture(MODE.registered,2);assert.equal(WI.WI_GetAnimations()[5].period,8);assert.equal(rndindex,6);
});
test('Published Linux source animation-draw enum condition is retained instead of silently changing behavior',()=>{
 const f=fixture();f.tick(100);assert.ok(WI.WI_GetAnimations().some(a=>a.ctr>=0));screens[0].fill(99);WI.WI_drawAnimatedBack();assert.ok(screens[0].every(v=>v===99));
 assert.equal(WI.WI_Responder({type:EV.ev_keydown,data1:32,data2:0,data3:0}),false);
});
test('A WAD missing graphics keeps the native counters available for the HTML fallback',()=>{
 const f=fixture();W_InitFile({name:'minimal.wad',data:makeWad([{name:'EMPTY',data:new Uint8Array()}])});WI.WI_Start(f.info);assert.equal(WI.WI_CanDraw(),false);f.tick(1,BT.BT_USE);assert.equal(WI.WI_GetState().kills,30);
});
