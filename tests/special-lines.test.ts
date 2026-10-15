import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as spec from '../src/linuxdoom-1.10/p_spec';
import * as switches from '../src/linuxdoom-1.10/p_switch';
import { buttonlist,P_InitSwitchList,P_StartButton,P_ChangeSwitchTexture,P_UseSpecialLine,alphSwitchList,switchlist,numswitches } from '../src/linuxdoom-1.10/p_switch';
import { P_InitSectorContext,P_SpawnSpecials,P_InitPicAnims,P_UpdateSpecials,P_CrossSpecialLine,P_ShootSpecialLine,P_PlayerInSpecialSector,EV_DoDonut } from '../src/linuxdoom-1.10/p_spec';
import { bwhere_e as BW,floor_e as FT,type floormove_t,type vldoor_t,type strobe_t } from '../src/linuxdoom-1.10/p_spec.h';
import { GameMode_t,powertype_t as PW,card_t as CARD } from '../src/linuxdoom-1.10/doomdef.h';
import { cheat_t as CF } from '../src/linuxdoom-1.10/d_player.h';
import { createCombatWorld } from './helpers/combat-world';
import { mapstate as m } from '../src/linuxdoom-1.10/r_state.h';
import { P_InitMapContext,P_UseLines,P_TryMove,P_LineAttack } from '../src/linuxdoom-1.10/p_map';
import { P_DamageMobj,P_TouchSpecialThing } from '../src/linuxdoom-1.10/p_inter';
import { P_RunThinkers,P_Ticker } from '../src/linuxdoom-1.10/p_tick';
import { P_SpawnMobj } from '../src/linuxdoom-1.10/p_mobj';
import { P_SetThingPosition,P_UnsetThingPosition } from '../src/linuxdoom-1.10/p_maputl';
import { mobjtype_t as MT } from '../src/linuxdoom-1.10/info.h';
import { slopetype_t as ST,type line_t,type sector_t,type degenmobj_t } from '../src/linuxdoom-1.10/r_defs.h';
import type { mobj_t } from '../src/linuxdoom-1.10/p_mobj.h';
import { ML_TWOSIDED,ML_SECRET } from '../src/linuxdoom-1.10/doomdata.h';
import { FRACUNIT as F } from '../src/linuxdoom-1.10/m_fixed.h';
import { ONFLOORZ } from '../src/linuxdoom-1.10/p_local.h';
import { texturestate,R_InitTextures,R_InitFlats,R_TextureNumForName } from '../src/linuxdoom-1.10/r_data';
import { W_AddFile } from '../src/linuxdoom-1.10/w_wad';
import { makeWad } from '../src/web/demo';
import { M_SetArgv } from '../src/linuxdoom-1.10/m_argv';
import { M_ClearRandom,prndindex } from '../src/linuxdoom-1.10/m_random';
import { sfxenum_t as SFX } from '../src/linuxdoom-1.10/sounds.h';
function addTextures(names:string[]){
 const bytes=new Uint8Array(4+names.length*36),v=new DataView(bytes.buffer);v.setInt32(0,names.length,true);
 names.forEach((name,i)=>{const p=4+names.length*4+i*32;v.setInt32(4+i*4,p,true);bytes.set(new TextEncoder().encode(name),p);v.setInt16(p+12,128,true);v.setInt16(p+14,128,true);v.setInt16(p+20,1,true);});
 W_AddFile({name:'switches.wad',data:makeWad([{name:'TEXTURE2',data:bytes}])});R_InitTextures();
}
function init(){
 const f=createCombatWorld(),root=m.sectors[0];root.tag=1;M_SetArgv(['doom']);
 const sounds:{origin:mobj_t|degenmobj_t|null;sound:SFX}[]=[],exits:string[]=[];
 const game:spec.specials_game_t={gamemode:GameMode_t.commercial,deathmatch:0,totalsecret:0,G_ExitLevel:()=>exits.push('normal'),G_SecretExitLevel:()=>exits.push('secret')};
 P_InitSectorContext({gameplay:game,S_StartSound:(origin,sound)=>sounds.push({origin,sound})});
 P_SpawnSpecials();P_InitPicAnims();
 addTextures(alphSwitchList.filter(p=>p.episode).flatMap(p=>[p.name1,p.name2]));P_InitSwitchList();
 P_InitMapContext({gamemap:1,P_DamageMobj,P_TouchSpecialThing,P_CrossSpecialLine,P_ShootSpecialLine,P_UseSpecialLine,S_StartSound:f.context.S_StartSound});
 function neighbor(floor=0,from=root):sector_t {
  const sec:sector_t={...root,floorheight:floor,thinglist:null,specialdata:null,tag:0,lines:[],linecount:0,blockbox:root.blockbox.slice(),soundorg:{...root.soundorg}};
  m.sectors.push(sec);m.numsectors=m.sectors.length;const side=m.sides.length;m.sides.push({...m.sides[0],sector:from},{...m.sides[0],sector:sec});
  const line:line_t={...m.lines[0],sidenum:[side,side+1],frontsector:from,backsector:sec,flags:ML_TWOSIDED,tag:1,special:0};
  m.lines.push(line);m.numlines=m.lines.length;from.lines.push(line);from.linecount=from.lines.length;sec.lines.push(line);sec.linecount=1;return sec;
 }
 function line(code:number):line_t {const l={...m.lines[0],sidenum:[0,0] as [number,number],special:code,tag:1};m.sides[0].toptexture=R_TextureNumForName('SW1BRCOM');m.sides[0].midtexture=m.sides[0].bottomtexture=-1;return l;}
 function tick(n:number){for(let i=0;i<n;i++)P_Ticker({paused:false,netgame:false,menuactive:false,demoplayback:false,players:f.g.players,consoleplayer:0,playeringame:[false,false,false,false],P_PlayerThink:()=>assert.fail('no active player'),P_UpdateSpecials,P_RespawnSpecials:()=>{}});}
 return {...f,root,neighbor,line,tick,game,sounds,exits};
}
function run(n:number){for(let i=0;i<n;i++)P_RunThinkers();}
test('All original switch and sector-special definitions are available',()=>{
 for(const [file,module,count] of [['p_switch.c',switches,4],['p_spec.c',spec,18]] as const){
  const c=readFileSync(`original/linuxdoom-1.10/${file}`,'utf8');
  const names=[...c.matchAll(/^(?:(?:void|int|boolean|fixed_t|sector_t\*|side_t\*)[ \t]+)?((?:P|EV)_\w+|getSide|getSector|twoSided|getNextSector)\s*\([^;{}]*\)\s*\{/gm)].map(r=>r[1]);
  assert.equal(names.length,count,file);for(const name of names)assert.equal(typeof (module as Record<string,unknown>)[name],'function',name);
 }
});
test('Switch pairs resolve actual WAD textures, filter episodes and retain the retail behavior of C',()=>{
 const {game}=init();assert.equal(numswitches,40);assert.equal(switchlist[80],-1);
 for(const [mode,count] of [[GameMode_t.shareware,19],[GameMode_t.registered,29],[GameMode_t.retail,19],[GameMode_t.commercial,40]]){game.gamemode=mode;P_InitSwitchList();assert.equal(numswitches,count);}
 texturestate.textures=texturestate.textures.filter(t=>t.name!=='SW1BRCOM');assert.throws(P_InitSwitchList,/SW1BRCOM/);
});
test('Each switch pair changes in both directions and scans pair order before wall tiers',()=>{
 const {line}=init();for(const pair of alphSwitchList.filter(p=>p.episode))for(const [start,end] of [[pair.name1,pair.name2],[pair.name2,pair.name1]]){
  const l=line(42);m.sides[0].toptexture=R_TextureNumForName(start);P_ChangeSwitchTexture(l,0);assert.equal(m.sides[0].toptexture,R_TextureNumForName(end));assert.equal(l.special,0);
 }
 const l=line(42);m.sides[0].toptexture=R_TextureNumForName('SW1WOOD');m.sides[0].midtexture=R_TextureNumForName('SW1BRCOM');P_ChangeSwitchTexture(l,0);
 assert.equal(m.sides[0].toptexture,R_TextureNumForName('SW1WOOD'));assert.equal(m.sides[0].midtexture,R_TextureNumForName('SW2BRCOM'));
});
test('Top, middle and bottom buttons restore after exactly 35 updates and clear all slot fields',()=>{
 for(const where of [BW.top,BW.middle,BW.bottom]){
  const {line,sounds}=init(),l=line(42),side=m.sides[0],field=(['toptexture','midtexture','bottomtexture'] as const)[where];
  side.toptexture=side.midtexture=side.bottomtexture=-1;side[field]=R_TextureNumForName('SW1BRCOM');P_ChangeSwitchTexture(l,1);
  assert.equal(l.special,42);assert.equal(buttonlist[0].where,where);assert.equal(sounds[0].origin,null);
  for(let i=0;i<34;i++)P_UpdateSpecials();assert.equal(side[field],R_TextureNumForName('SW2BRCOM'));P_UpdateSpecials();
  assert.equal(side[field],R_TextureNumForName('SW1BRCOM'));assert.deepEqual(buttonlist[0],{line:null,where:BW.top,btexture:0,btimer:0,soundorg:null});assert.strictEqual(sounds.at(-1)!.origin,l.frontsector!.soundorg);
 }
});
test('Buttons reject overflow, keep the first countdown on repeated use and preserve exit switch sound order',()=>{
 const {line,sounds,root}=init(),l=line(11);P_ChangeSwitchTexture(l,0);assert.equal(sounds[0].sound,SFX.sfx_swtchn);
 P_StartButton(l,BW.top,1,35);P_StartButton(l,BW.bottom,2,99);assert.equal(buttonlist[0].btimer,35);assert.equal(buttonlist[0].where,BW.top);
 for(let i=1;i<16;i++)P_StartButton({...l},BW.top,1,35);assert.throws(()=>P_StartButton({...l},BW.top,1,35),/no button slots/);
 assert.strictEqual(buttonlist[0].soundorg,root.soundorg);
});
test('Use-only switches require an event to start; cross and impact triggers consume even on a busy sector',()=>{
 const {root,line,a}=init();root.specialdata={};const used=line(101);assert.equal(P_UseSpecialLine(a,used,0),true);assert.equal(used.special,101);
 const cross=line(5);m.lines.push(cross);P_CrossSpecialLine(m.lines.length-1,0,a);assert.equal(cross.special,0);
 const shot=line(24);P_ShootSpecialLine(a,shot);assert.equal(shot.special,0);
});
test('Use dispatch starts real floors, manual doors and locked doors',()=>{
 const {root,neighbor,line,a,p}=init();neighbor(24*F);const l=line(18);P_UseSpecialLine(a,l,0);assert.equal(l.special,0);assert.equal((root.specialdata as floormove_t).type,FT.raiseFloorToNearest);run(25);assert.equal(a.z,24*F);
 const f=init(),back=f.neighbor(0);back.ceilingheight=64*F;const manual=f.root.lines.at(-1)!;manual.special=26;
 P_UseSpecialLine(f.a,manual,0);assert.equal(back.specialdata,null);f.p.cards[CARD.it_bluecard]=true;P_UseSpecialLine(f.a,manual,0);assert.ok(back.specialdata);assert.equal((back.specialdata as vldoor_t).direction,1);
});
test('Back sides, secret doors and monster restrictions retain the original return values',()=>{
 const {line,a}=init();assert.equal(P_UseSpecialLine(a,line(18),1),false);assert.equal(P_UseSpecialLine(a,line(124),1),true);assert.equal(P_UseSpecialLine(a,line(999),0),true);
 const monster=P_SpawnMobj(64*F,0,ONFLOORZ,MT.MT_TROOP);assert.equal(P_UseSpecialLine(monster,line(18),0),false);
 const secret=line(1);secret.flags|=ML_SECRET;assert.equal(P_UseSpecialLine(monster,secret,0),false);
});
test('Crossing activates one-shot and repeatable floors with distinct clearing behavior',()=>{
 for(const [code,cleared] of [[58,true],[92,false]]){
  const {root,line,a}=init(),l=line(code as number);m.lines.push(l);P_CrossSpecialLine(m.lines.length-1,0,a);assert.equal(l.special,cleared?0:code);run(25);assert.equal(root.floorheight,24*F);
 }
});
test('Crossing rejects the original six projectile types and ordinary monsters on player-only lines',()=>{
 for(const type of [MT.MT_ROCKET,MT.MT_PLASMA,MT.MT_BFG,MT.MT_TROOPSHOT,MT.MT_HEADSHOT,MT.MT_BRUISERSHOT,MT.MT_TROOP]){
  const {line}=init(),l=line(58);m.lines.push(l);const thing=P_SpawnMobj(64*F,0,ONFLOORZ,type);P_CrossSpecialLine(m.lines.length-1,0,thing);assert.equal(l.special,58);
 }
});
test('Monster teleport lines ignore players and preserve one-shot versus retrigger flags',()=>{
 for(const code of [125,126]){
  const {line,a}=init(),l=line(code);m.lines.push(l);P_CrossSpecialLine(m.lines.length-1,0,a);assert.equal(l.special,code);
  P_SpawnMobj(64*F,0,ONFLOORZ,MT.MT_TELEPORTMAN);const monster=P_SpawnMobj(-64*F,0,ONFLOORZ,MT.MT_TROOP);P_CrossSpecialLine(m.lines.length-1,0,monster);assert.equal(monster.x,64*F);assert.equal(l.special,code===125?0:126);
 }
});
test('Normal and secret exits dispatch from use and cross with the original line clearing',()=>{
 const {line,a,exits}=init();for(const code of [11,51]){const l=line(code);P_UseSpecialLine(a,l,0);assert.equal(l.special,0);}
 for(const code of [52,124]){const l=line(code);m.lines.push(l);P_CrossSpecialLine(m.lines.length-1,0,a);assert.equal(l.special,code);}
 assert.deepEqual(exits,['normal','secret','normal','secret']);
});
test('Donut spawns two real floor thinkers and transfers outer texture to its ring',()=>{
 const {root,neighbor,a}=init();root.floorheight=24*F;a.z=24*F;const ring=neighbor(0),outer=neighbor(16*F,ring);outer.floorpic=7;ring.special=5;
 // C chooses s1.lines[0], so place the inner/ring edge before the room boundary lines.
 const edge=root.lines.at(-1)!;edge.frontsector=ring;edge.backsector=root;edge.sidenum.reverse();root.lines=[edge];root.linecount=1;
 assert.equal(EV_DoDonut({tag:1}),1);assert.equal((ring.specialdata as floormove_t).type,FT.donutRaise);assert.equal((root.specialdata as floormove_t).direction,-1);
 run(33);assert.equal(root.floorheight,16*F);assert.equal(ring.floorheight,16*F);assert.equal(ring.floorpic,7);assert.equal(ring.special,0);assert.equal(root.specialdata,null);assert.equal(ring.specialdata,null);
});
test('Special-sector damage respects ground contact, suits and its 32-tic cadence',()=>{
 for(const [special,damage] of [[5,10],[7,5],[4,20],[16,20]]){
  const {root,p,a,tick}=init();root.special=special;a.z=F;P_PlayerInSpecialSector(p);assert.equal(p.health,100);a.z=0;P_PlayerInSpecialSector(p);assert.equal(p.health,100-damage);
  tick(1);P_PlayerInSpecialSector(p);assert.equal(p.health,100-damage);p.powers[PW.pw_ironfeet]=100;M_ClearRandom();P_PlayerInSpecialSector(p);assert.equal(p.health,100-damage);assert.equal(prndindex,special===4||special===16?1:0);
 }
});
test('Secrets count once and the damaging exit clears god mode and exits at low health',()=>{
 const {root,p,exits}=init();root.special=9;P_PlayerInSpecialSector(p);assert.equal(p.secretcount,1);assert.equal(root.special,0);
 root.special=11;p.health=p.mo!.health=25;p.cheats|=CF.CF_GODMODE;P_PlayerInSpecialSector(p);assert.equal(p.cheats&CF.CF_GODMODE,0);assert.equal(p.health,5);assert.deepEqual(exits,['normal']);
 root.special=999;assert.throws(()=>P_PlayerInSpecialSector(p),/unknown special 999/);
});
test('Level setup spawns sector effects, counts secrets, preserves damaging strobe and resets active buttons',()=>{
 const {root,neighbor,line,game}=init();root.special=4;const secret=neighbor();secret.special=9;
 const timed=neighbor();timed.special=10;const glowing=neighbor();glowing.special=8;
 P_StartButton(line(42),BW.top,2,35);P_SpawnSpecials();assert.equal(root.special,4);assert.equal(secret.special,9);assert.equal(game.totalsecret,1);
 assert.ok(timed.specialdata);assert.equal((timed.specialdata as vldoor_t).topcountdown,30*35);assert.equal(glowing.special,0);assert.equal(buttonlist[0].btimer,0);
});
test('Scroller setup and tick retain fixed point wrapping; level timer respects deathmatch and numeric prefixes',()=>{
 const {root,game,tick,exits}=init();m.lines[0].special=48;P_SpawnSpecials();assert.equal(spec.numlinespecials,1);m.sides[0].textureoffset=0x7fffffff;P_UpdateSpecials();assert.equal(m.sides[0].textureoffset,(0x7fffffff+F)|0);
 M_SetArgv(['doom','-avg']);P_SpawnSpecials();assert.equal(spec.levelTimer,false);game.deathmatch=1;P_SpawnSpecials();assert.equal(spec.levelTimeCount,20*60*35);
 M_SetArgv(['doom','-timer','1minute']);P_SpawnSpecials();assert.equal(spec.levelTimeCount,60*35);tick(60*35-1);assert.deepEqual(exits,[]);tick(1);assert.deepEqual(exits,['normal']);
 M_SetArgv(['doom','-timer']);assert.throws(P_SpawnSpecials,/needs a value/);
});
test('Picture animations resolve texture and flat frame ranges and use absolute index phase offsets',()=>{
 const {tick}=init();
 addTextures(['UNUSED','BLODGR1','BLODGR2','BLODGR3','BLODGR4']);
 W_AddFile({name:'flats.wad',data:makeWad(['F_START','TESTFLAT','NUKAGE1','NUKAGE2','NUKAGE3','F_END'].map(name=>({name,data:new Uint8Array(name.startsWith('F_')?0:4096)})))});R_InitFlats();
 P_InitPicAnims();assert.equal(spec.lastanim,2);const flat=spec.anims.find(a=>!a.istexture)!,tex=spec.anims.find(a=>a.istexture)!;
 assert.equal(flat.basepic,1);assert.equal(flat.numpics,3);assert.equal(tex.basepic,3);assert.equal(tex.numpics,4);
 P_UpdateSpecials();assert.equal(texturestate.flattranslation[1],2);assert.equal(texturestate.texturetranslation[3],6);
 tick(8);P_UpdateSpecials();assert.equal(texturestate.flattranslation[1],3);assert.equal(texturestate.texturetranslation[3],3);
});
test('Animation initialization rejects missing end frames and invalid frame ordering',()=>{
 init();addTextures(['BLODGR1']);assert.throws(P_InitPicAnims,/BLODGR4/);
 init();addTextures(['BLODGR4','BLODGR1']);assert.throws(P_InitPicAnims,/bad cycle/);
});
test('Native use trace opens a manual door and native hitscan activates an impact switch',()=>{
 const f=init(),back=f.neighbor();back.ceilingheight=64*F;
 // Face the east room wall from within use distance; its back sector is a door.
 const wall=m.lines.find(l=>l.v1.x===128*F&&l.v2.x===128*F)!;
 wall.backsector=back;wall.flags|=ML_TWOSIDED;wall.sidenum[1]=m.sides.length;m.sides.push({...m.sides[0],sector:back});wall.special=1;
 P_UnsetThingPosition(f.a);f.a.x=100*F;P_SetThingPosition(f.a);f.a.angle=0;P_UseLines(f.p);assert.ok(back.specialdata);assert.equal((back.specialdata as vldoor_t).direction,1);
 const second=init();second.neighbor(24*F);const target=m.lines.find(l=>l.v1.x===128*F&&l.v2.x===128*F)!;target.special=24;target.tag=1;
 m.sides[target.sidenum[0]].toptexture=R_TextureNumForName('SW1BRCOM');P_LineAttack(second.a,0,256*F,0,5);
 assert.equal(target.special,0);assert.ok(second.root.specialdata);assert.equal((second.root.specialdata as floormove_t).type,FT.raiseFloor);
});
test('Native movement across a special line starts its real tagged floor',()=>{
 const {a,root}=init();const line:line_t={...m.lines[0],v1:{x:0,y:-128*F},v2:{x:0,y:128*F},dx:0,dy:256*F,slopetype:ST.ST_VERTICAL,
  bbox:new Int32Array([128*F,-128*F,0,0]),flags:ML_TWOSIDED,backsector:root,frontsector:root,sidenum:[0,0],special:58,tag:1,validcount:-1};m.lines.push(line);
 for(let i=4+m.bmapwidth*m.bmapheight;i<m.blockmaplump.length;i++)if(m.blockmaplump[i]===0)m.blockmaplump[i]=m.lines.length-1;
 P_UnsetThingPosition(a);a.x=-8*F;P_SetThingPosition(a);assert.equal(P_TryMove(a,8*F,0),true);assert.equal(line.special,0);assert.ok(root.specialdata);run(25);assert.equal(root.floorheight,24*F);assert.equal(a.z,24*F);
});
