import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as G from '../src/linuxdoom-1.10/g_game';
import * as K from '../src/linuxdoom-1.10/doomdef.h';
import { buttoncode_t as BT } from '../src/linuxdoom-1.10/d_event.h';
import type { ticcmd_t } from '../src/linuxdoom-1.10/d_ticcmd.h';
import { GameInput } from '../src/web/game-input';
function fixture(){const g=G.G_CreateControls();G.G_InitControlsContext(g);const step=()=>{const cmd={} as ticcmd_t;G.G_BuildTiccmd(cmd);g.maketic++;return cmd;};return {g,step};}
test('Native keyboard turning uses five slow tics then walking or running turn speed',()=>{
 const {g,step}=fixture();g.gamekeydown[K.KEY_RIGHTARROW]=1;for(let i=0;i<5;i++)assert.equal(step().angleturn,-320);assert.equal(step().angleturn,-640);g.gamekeydown[K.KEY_RSHIFT]=1;assert.equal(step().angleturn,-1280);g.gamekeydown[K.KEY_RIGHTARROW]=0;assert.equal(step().angleturn,0);g.gamekeydown[K.KEY_LEFTARROW]=1;assert.equal(step().angleturn,320);
});
test('Tic duplication advances slow-turn timing by original ticdup and input directions cancel',()=>{
 const {g,step}=fixture();g.ticdup=2;g.gamekeydown[K.KEY_LEFTARROW]=1;assert.equal(step().angleturn,320);assert.equal(step().angleturn,320);assert.equal(step().angleturn,640);g.gamekeydown[K.KEY_RIGHTARROW]=1;assert.equal(step().angleturn,0);g.gamekeydown[K.KEY_UPARROW]=g.gamekeydown[K.KEY_DOWNARROW]=1;assert.equal(step().forwardmove,0);
});
test('Alt and native mouse/joystick strafe modifiers convert turn inputs into side movement',()=>{
 const {g,step}=fixture();g.gamekeydown[K.KEY_RIGHTARROW]=g.gamekeydown[K.KEY_RALT]=1;assert.equal(step().sidemove,24);assert.equal(step().angleturn,0);g.gamekeydown[K.KEY_RALT]=0;g.mousebuttons[1]=true;assert.equal(step().sidemove,24);g.mousebuttons[1]=false;g.joybuttons[1]=true;g.gamekeydown[K.KEY_RSHIFT]=1;assert.equal(step().sidemove,40);
});
test('Joystick axes repeat and default buttons fire, run and use without losing the keyboard',()=>{
 const {g,step}=fixture();g.joyxmove=-1;g.joyymove=-1;g.joybuttons[0]=g.joybuttons[2]=g.joybuttons[3]=true;for(let i=0;i<6;i++){const c=step();assert.equal(c.forwardmove,50);assert.ok(c.buttons&BT.BT_ATTACK);assert.ok(c.buttons&BT.BT_USE);assert.equal(c.angleturn,i<5?320:1280);}g.joyymove=1;assert.equal(step().forwardmove,-50);
});
test('The two native mouse double-click detectors trigger use and time out after twenty tics',()=>{
 for(const button of [1,2]){
  const {g,step}=fixture();step();step();g.mousebuttons[button]=true;assert.equal(step().buttons&BT.BT_USE,0);step();step();g.mousebuttons[button]=false;step();step();step();g.mousebuttons[button]=true;assert.ok(step().buttons&BT.BT_USE);
  g.mousebuttons[button]=false;for(let i=0;i<25;i++)step();assert.equal(button===1?g.dclicks2:g.dclicks,0);
 }
});
test('Explicit use clears the forward double-click accumulator as published in C',()=>{
 const {g,step}=fixture();g.dclicks=1;g.gamekeydown[32]=1;assert.ok(step().buttons&BT.BT_USE);assert.equal(g.dclicks,0);g.dclicks2=1;step();assert.equal(g.dclicks2,1);
});
test('Weapon selection scans 1..8 in order and chat/consistency fields use native hooks and ring',()=>{
 const {g,step}=fixture();g.gamekeydown[56]=1;g.gamekeydown[51]=1;g.HU_dequeueChatChar=()=>65;g.consoleplayer=2;g.maketic=13;g.consistancy[2][1]=-1234;const c=step();assert.equal((c.buttons&BT.BT_WEAPONMASK)>>BT.BT_WEAPONSHIFT,2);assert.equal(c.chatchar,65);assert.equal(c.consistancy,-1234);g.gamekeydown[51]=0;assert.equal((step().buttons&BT.BT_WEAPONMASK)>>BT.BT_WEAPONSHIFT,7);
});
test('Pause and save specials replace normal buttons, with the original save precedence',()=>{
 const {g,step}=fixture();g.gamekeydown[K.KEY_RCTRL]=1;g.sendpause=true;assert.equal(step().buttons,BT.BT_SPECIAL|BT.BTS_PAUSE);assert.equal(g.sendpause,false);g.sendpause=g.sendsave=true;g.savegameslot=5;assert.equal(step().buttons,BT.BT_SPECIAL|BT.BTS_SAVEGAME|(5<<BT.BTS_SAVESHIFT));assert.equal(g.sendpause,false);assert.equal(g.sendsave,false);assert.equal(step().buttons,BT.BT_ATTACK);
});
test('Native checksum covers the first four bytes of the original eight-byte ticcmd layout',()=>{
 const cmd={forwardmove:-25,sidemove:-40,angleturn:-321,buttons:255,consistancy:999,chatchar:90},bytes=new Uint8Array(8),view=new DataView(bytes.buffer);view.setInt8(0,cmd.forwardmove);view.setInt8(1,cmd.sidemove);view.setInt16(2,cmd.angleturn,true);assert.equal(G.G_CmdChecksum(cmd),view.getInt32(0,true));assert.equal(G.G_CmdChecksum({...cmd,buttons:0,consistancy:0}),G.G_CmdChecksum(cmd));
});
test('Browser WASD aliases share native acceleration, strafe modifiers and short tap preservation',()=>{
 const input=new GameInput();input.keyDown(100);assert.equal(input.command().angleturn,-320);for(let i=0;i<4;i++)assert.equal(input.command().angleturn,-320);assert.equal(input.command().angleturn,-640);input.keyDown(K.KEY_RALT);assert.equal(input.command().sidemove,24);input.keyUp(100);input.keyUp(K.KEY_RALT);input.keyDown(102);input.keyUp(102);assert.ok(input.command().buttons&BT.BT_USE);assert.equal(input.command().buttons&BT.BT_USE,0);input.clear();input.keyDown(56);assert.equal((input.command().buttons&BT.BT_WEAPONMASK)>>BT.BT_WEAPONSHIFT,7);
});
