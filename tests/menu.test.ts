import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as M from '../src/linuxdoom-1.10/m_menu';
import * as K from '../src/linuxdoom-1.10/doomdef.h';
import { evtype_t as EV,gameaction_t as GA } from '../src/linuxdoom-1.10/d_event.h';
import { createHeadlessGame } from './helpers/game-session';
import { leveltime } from '../src/linuxdoom-1.10/p_tick';
import { screens,V_PatchHeader,V_SetGamma,usegamma } from '../src/linuxdoom-1.10/v_video';
import { W_CacheLumpName,W_CheckNumForName } from '../src/linuxdoom-1.10/w_wad';
import { HU_GetState } from '../src/linuxdoom-1.10/hu_stuff';
import { R_ExecuteSetViewSize,R_RenderPlayerView,view } from '../src/linuxdoom-1.10/r_main';
import { R_FillBackScreen,R_DrawViewBorder,draw } from '../src/linuxdoom-1.10/r_draw';
import { statenum_t as STATE,mobjtype_t as MT } from '../src/linuxdoom-1.10/info.h';
import { states,mobjinfo } from '../src/linuxdoom-1.10/info';
const event=(data1:number,type=EV.ev_keydown)=>({type,data1,data2:0,data3:0});
const cmd=()=>({forwardmove:0,sidemove:0,angleturn:0,buttons:0,consistancy:0,chatchar:0});
function key(value:number|string){return M.M_Responder(event(typeof value==='string'?value.charCodeAt(0):value));}
function fixture(){const f=createHeadlessGame();while(M.screenblocks>10)M.M_SizeDisplay(0);while(M.screenblocks<10)M.M_SizeDisplay(1);if(M.detailLevel)M.M_ChangeDetail(0);if(!M.showMessages)M.M_ChangeMessages(0);M.M_SetVolumes(10,8);M.M_Init();return f;}
test('Escape opens native main menu; keyup does not act and cursor retains its selection',()=>{
 fixture();assert.equal(key(K.KEY_ESCAPE),true);assert.equal(M.M_GetState().menu,'main');assert.equal(M.M_Responder(event(K.KEY_DOWNARROW,EV.ev_keyup)),false);key(K.KEY_DOWNARROW);assert.equal(M.M_GetState().itemOn,1);key(K.KEY_ESCAPE);assert.equal(M.menuactive,false);key(K.KEY_ESCAPE);assert.equal(M.M_GetState().itemOn,1);key(K.KEY_BACKSPACE);assert.equal(M.menuactive,true);
});
test('Original navigation skips spacer rows, wraps and cycles duplicate hotkeys',()=>{
 fixture();key(K.KEY_ESCAPE);key('o');key(K.KEY_ENTER);key('s');assert.equal(M.M_GetState().itemOn,3);key('s');assert.equal(M.M_GetState().itemOn,7);key(K.KEY_DOWNARROW);assert.equal(M.M_GetState().itemOn,0);key(K.KEY_UPARROW);assert.equal(M.M_GetState().itemOn,7);key(K.KEY_UPARROW);assert.equal(M.M_GetState().itemOn,5);key(K.KEY_UPARROW);assert.equal(M.M_GetState().itemOn,3);key(K.KEY_BACKSPACE);assert.equal(M.M_GetState().menu,'main');
});
test('New game traverses episode and skill, defers a real restart and resets player inventory',()=>{
 const {session}=fixture();session.player.health=20;session.player.ammo[0]=1;key(K.KEY_ESCAPE);key(K.KEY_ENTER);assert.equal(M.M_GetState().menu,'episode');key(K.KEY_ENTER);assert.equal(M.M_GetState().menu,'skill');assert.equal(M.M_GetState().itemOn,2);key('u');key(K.KEY_ENTER);assert.equal(M.menuactive,false);assert.equal(session.state.gameaction,GA.ga_newgame);session.step(cmd());assert.equal(session.state.gameskill,K.skill_t.sk_hard);assert.equal(session.player.health,100);assert.equal(session.player.ammo[0],50);assert.equal(leveltime,1);
});
test('Nightmare confirmation rejects other keys and cancellation preserves the current game',()=>{
 const {session}=fixture();M.M_ChooseSkill(K.skill_t.sk_nightmare);assert.match(M.M_GetState().message!,/fair/);assert.equal(key('x'),false);assert.ok(M.menuactive);key('n');assert.equal(M.menuactive,false);assert.equal(session.state.gameaction,GA.ga_nothing);assert.equal(session.state.gameskill,K.skill_t.sk_medium);
});
test('Nightmare acceptance activates native fast states and respawning on a tic boundary',()=>{
 const tics=states.map(s=>s.tics),speeds=mobjinfo.map(m=>m.speed);
 try{const {session}=fixture();M.M_ChooseSkill(K.skill_t.sk_nightmare);key('y');assert.equal(session.state.gameaction,GA.ga_newgame);session.step(cmd());assert.equal(session.state.gameskill,K.skill_t.sk_nightmare);assert.equal(session.state.respawnmonsters,true);}finally{states.forEach((s,i)=>s.tics=tics[i]);mobjinfo.forEach((m,i)=>m.speed=speeds[i]);}
});
test('Shareware rejects later episodes and informs without replacing the level',()=>{
 const {session}=fixture();M.M_NewGame(0);M.M_Episode(1);assert.match(M.M_GetState().message!,/shareware/);assert.equal(M.M_GetState().menu,'help1');key(' ');assert.equal(M.menuactive,false);assert.equal(session.mapname,'E1M1');assert.equal(session.state.gameaction,GA.ga_nothing);
});
test('Menu initialization rebuilds version-dependent definitions without cumulative mutations',()=>{
 const {session}=fixture();session.state.gamemode=K.GameMode_t.commercial;M.M_Init();M.M_StartControlPanel();M.M_NewGame(0);assert.equal(M.M_GetState().menu,'skill');key(K.KEY_BACKSPACE);assert.equal(M.M_GetState().menu,'main');key('q');assert.equal(M.M_GetState().itemOn,4);M.M_Init();key(K.KEY_ESCAPE);key('q');assert.equal(M.M_GetState().itemOn,4);session.state.gamemode=K.GameMode_t.retail;M.M_Init();M.M_StartControlPanel();M.M_NewGame(0);for(let i=0;i<3;i++)key(K.KEY_DOWNARROW);assert.equal(M.M_GetState().itemOn,3);
});
test('World physics pauses under the menu while skull ticker continues and resumes on close',()=>{
 const {session}=fixture();const x=session.player.mo!.x,t=leveltime;session.respond(event(K.KEY_ESCAPE));for(let i=0;i<10;i++){M.M_Ticker();session.step({...cmd(),forwardmove:25});}assert.equal(leveltime,t);assert.equal(session.player.mo!.x,x);assert.equal(M.M_GetState().whichSkull,1);assert.equal(M.M_GetState().skullAnimCounter,8);key(K.KEY_ESCAPE);session.step({...cmd(),forwardmove:25});assert.equal(leveltime,t+1);assert.notEqual(session.player.mo!.x,x);
});
test('Message switch forces its OFF notice through HU and suppresses subsequent ordinary messages',()=>{
 const {session}=fixture();key(K.KEY_F8);session.step(cmd());assert.equal(M.showMessages,false);assert.equal(HU_GetState().text,'Messages OFF');session.player.message='HIDDEN';session.step(cmd());assert.equal(HU_GetState().text,'Messages OFF');key(K.KEY_F8);session.step(cmd());assert.equal(HU_GetState().text,'Messages ON');assert.equal(M.showMessages,true);
});
test('Sound menu uses original 16-step limits, skips blanks and drives real music backend volume',()=>{
 const {music}=fixture();key(K.KEY_F4);assert.equal(M.M_GetState().menu,'sound');for(let i=0;i<25;i++)key(K.KEY_LEFTARROW);assert.equal(M.snd_SfxVolume,0);key(K.KEY_DOWNARROW);assert.equal(M.M_GetState().itemOn,2);for(let i=0;i<25;i++)key(K.KEY_RIGHTARROW);assert.equal(M.snd_MusicVolume,15);assert.equal(music.volume,127);for(let i=0;i<25;i++)key(K.KEY_LEFTARROW);assert.equal(music.volume,0);key(K.KEY_ENTER);assert.equal(M.snd_MusicVolume,1);assert.equal(music.volume,8);
});
test('Screen size clamps to 3..11; reduced views draw native border patches around the rendered world',()=>{
 const {session}=fixture();for(let i=0;i<20;i++)M.M_SizeDisplay(0);assert.equal(M.screenblocks,3);R_ExecuteSetViewSize();assert.equal(view.viewheight,48);draw.gamemode=session.state.gamemode;R_FillBackScreen();screens[0].fill(0);R_DrawViewBorder();assert.ok(screens[0][0]>0);const outside=screens[0][0];R_RenderPlayerView(session.player,()=>{});assert.equal(screens[0][0],outside);for(let i=0;i<20;i++)M.M_SizeDisplay(1);assert.equal(M.screenblocks,11);R_ExecuteSetViewSize();assert.equal(view.viewheight,200);
});
test('Automap retains +/- zoom instead of the screen-size shortcuts and detail matches upstream early return',()=>{
 const {session}=fixture();session.state.automapactive=true;const blocks=M.screenblocks;assert.equal(key('='),false);assert.equal(M.screenblocks,blocks);session.state.automapactive=false;assert.equal(key('-'),true);assert.equal(M.screenblocks,blocks-1);const before=view.setdetail;key(K.KEY_F5);assert.equal(M.detailLevel,1);assert.equal(view.setdetail,before);M.M_ChangeDetail(0);
});
test('Menu drawer uses WAD patches, font metrics, animation and centered multiline prompts',()=>{
 fixture();screens[0].fill(77);key(K.KEY_ESCAPE);M.M_Drawer();const width=V_PatchHeader(W_CacheLumpName('STCFN065',1)).width;assert.equal(M.M_StringWidth('A A'),2*width+4);assert.equal(M.M_StringHeight('A\nB'),14);assert.ok(screens[0].some(p=>p===255));const before=screens[0].slice();for(let i=0;i<10;i++)M.M_Ticker();M.M_Drawer();assert.notDeepEqual(screens[0],before);screens[0].fill(0);M.M_StartMessage('HELLO\nWORLD',null,false);M.M_Drawer();assert.ok(screens[0].subarray(90*320,110*320).some(p=>p===255));M.M_StopMessage();assert.equal(M.menuactive,true);
});
test('Help pages and unsupported saves remain explicit; F11 cycles gamma without changing gameplay',()=>{
 const {session}=fixture();key(K.KEY_F1);assert.equal(M.M_GetState().menu,'help1');M.M_Drawer();key(K.KEY_ENTER);assert.equal(M.M_GetState().menu,'help2');M.M_Drawer();key(K.KEY_ENTER);assert.equal(M.M_GetState().menu,'main');key(K.KEY_ESCAPE);key(K.KEY_F2);assert.match(M.M_GetState().message!,/NO ESTA IMPLEMENTADO/);key(' ');V_SetGamma(4);key(K.KEY_F11);assert.equal(usegamma,0);assert.match(session.player.message!,/OFF/);assert.equal(session.state.gameaction,GA.ga_nothing);assert.ok(W_CheckNumForName('M_SKULL1')>=0);
});
test('End-game requires confirmation and netgames retain their original guard messages',()=>{
 const {session}=fixture();let ended=0;M.M_InitContext({...session.state,R_SetViewSize:()=>{},setVolumes:()=>{},endGame:()=>ended++});M.M_EndGame(0);key('n');assert.equal(ended,0);M.M_EndGame(0);key('y');assert.equal(ended,1);M.M_InitContext({...session.state,netgame:true,R_SetViewSize:()=>{},setVolumes:()=>{},endGame:()=>ended++});M.M_NewGame(0);assert.match(M.M_GetState().message!,/network/);key(' ');M.M_EndGame(0);assert.match(M.M_GetState().message!,/netgame/);
});
test('Sensitivity clamps and mouse/joystick navigation preserve thresholds, throttles and button precedence',t=>{
 fixture();for(let i=0;i<30;i++)M.M_ChangeSensitivity(0);assert.equal(M.mouseSensitivity,0);for(let i=0;i<30;i++)M.M_ChangeSensitivity(1);assert.equal(M.mouseSensitivity,9);for(let i=0;i<4;i++)M.M_ChangeSensitivity(0);M.M_StartControlPanel();
 let now=1e9;t.mock.method(performance,'now',()=>now);
 assert.equal(M.M_Responder({type:EV.ev_mouse,data1:0,data2:0,data3:-30}),false);assert.equal(M.M_GetState().itemOn,0);
 assert.equal(M.M_Responder({type:EV.ev_mouse,data1:0,data2:0,data3:-1}),true);assert.equal(M.M_GetState().itemOn,1);
 assert.equal(M.M_Responder({type:EV.ev_mouse,data1:0,data2:0,data3:-31}),false);assert.equal(M.M_GetState().itemOn,1);now+=1000;
 assert.equal(M.M_Responder({type:EV.ev_joystick,data1:1,data2:0,data3:1}),true);assert.equal(M.M_GetState().menu,'options');
 assert.equal(M.M_Responder({type:EV.ev_joystick,data1:2,data2:0,data3:0}),false);now+=1000;
 assert.equal(M.M_Responder({type:EV.ev_joystick,data1:2,data2:0,data3:0}),true);assert.equal(M.M_GetState().menu,'main');
});

test('A fresh browser session after Nightmare restores baseline actor tables and normal difficulty',()=>{
 const {session}=fixture(),tics=states[STATE.S_SARG_RUN1].tics,speed=mobjinfo[MT.MT_TROOPSHOT].speed;M.M_ChooseSkill(K.skill_t.sk_nightmare);key('y');session.step(cmd());assert.equal(states[STATE.S_SARG_RUN1].tics,tics>>1);const fresh=createHeadlessGame().session;assert.equal(fresh.state.gameskill,K.skill_t.sk_medium);assert.equal(states[STATE.S_SARG_RUN1].tics,tics);assert.equal(mobjinfo[MT.MT_TROOPSHOT].speed,speed);
});
