import { test } from 'node:test';
import assert from 'node:assert/strict';
import { decodeMus } from '../src/web/mus';
import { demoMusic } from '../src/web/music-demo';
import { MusTransport,MusSynth,WebMusicBackend,type MusicSink } from '../src/web/music';
import type { music_event_t,music_score_t } from '../src/linuxdoom-1.10/i_sound.h';
import * as I from '../src/linuxdoom-1.10/i_sound';
import * as S from '../src/linuxdoom-1.10/s_sound';
import { musicenum_t as MUS } from '../src/linuxdoom-1.10/sounds.h';
import { GameMode_t as MODE } from '../src/linuxdoom-1.10/doomdef.h';
import { S_music } from '../src/linuxdoom-1.10/sounds';
import { createHeadlessGame,MusicDevice } from './helpers/game-session';
import { buttoncode_t as BT } from '../src/linuxdoom-1.10/d_event.h';
const BT_USE=BT.BT_USE;
const cmd=(buttons=0)=>({forwardmove:0,sidemove:0,angleturn:0,consistancy:0,chatchar:0,buttons});
function mus(bytes:number[],instruments:number[]=[]){const data=new Uint8Array(16+instruments.length*2+bytes.length),v=new DataView(data.buffer);data.set([77,85,83,26]);v.setUint16(4,bytes.length,true);v.setUint16(6,16+instruments.length*2,true);v.setUint16(8,2,true);v.setUint16(12,instruments.length,true);instruments.forEach((n,i)=>v.setUint16(16+i*2,n,true));data.set(bytes,16+instruments.length*2);return data;}
test('MUS preserves simultaneous channels, per-channel velocity, instruments, VLQ time and percussion',()=>{
 const score=decodeMus(mus([0x10,188,99,0x91,64,0x81,0x0c,0x10,62,0x9f,166,80,35,0x80,60,0,0x60],[24,166]));
 assert.deepEqual(score,{instruments:[24,166],durationTicks:175,events:[{tick:0,channel:0,type:'noteOn',note:60,velocity:99},{tick:0,channel:1,type:'noteOn',note:64,velocity:127},{tick:140,channel:0,type:'noteOn',note:62,velocity:99},{tick:140,channel:15,type:'noteOn',note:38,velocity:80},{tick:175,channel:0,type:'noteOff',note:60}]});
});
test('MUS maps pitch, program, controllers and system events, clamping legacy volume',()=>{
 const bytes=[0x20,128,0x40,0,24];for(let i=1;i<10;i++)bytes.push(0x40,i,i===3?255:64);for(let i=10;i<15;i++)bytes.push(0x30,i);bytes.push(0x60);
 const score=decodeMus(mus(bytes));assert.deepEqual(score.events[0],{tick:0,channel:0,type:'pitch',value:8192});assert.deepEqual(score.events[1],{tick:0,channel:0,type:'program',value:24});
 assert.deepEqual(score.events.slice(2).map(e=>e.type==='control'?[e.controller,e.value]:null),[[32,64],[1,64],[7,127],[10,64],[11,64],[91,64],[93,64],[64,64],[67,64],[120,0],[123,0],[126,3],[127,0],[121,0]]);
});
test('MUS rejects malformed headers, missing terminator, unsupported events and truncated/oversized time',()=>{
 for(const bytes of [[0x10],[0x10,188,255],[0x50],[0x70],[0x30,9],[0x40,10,1],[0x90,60,128,128,128,128,0],[0x90,60,255,255,255,127],[0x10,60]])assert.throws(()=>decodeMus(mus(bytes)));
 const data=demoMusic();data[6]=1;assert.throws(()=>decodeMus(data),/Cabecera/);assert.throws(()=>decodeMus(new Uint8Array([77,84,104,100])),/MIDI/);
});
class Sink implements MusicSink {
 events:{event:music_event_t;when:number;silent:boolean}[]=[];resets:number[]=[];offs:number[]=[];resumes:number[]=[];disposed=0;
 event(event:music_event_t,when:number,silent:boolean){this.events.push({event,when,silent});}reset(t:number){this.resets.push(t);}allOff(t:number){this.offs.push(t);}resumeNotes(t:number){this.resumes.push(t);}dispose(){this.disposed++;}
}
const score:music_score_t={events:[{tick:0,channel:0,type:'noteOn',note:69,velocity:100},{tick:70,channel:0,type:'noteOff',note:69}],durationTicks:140,instruments:[]};
test('Transport schedules against the audio clock, loops at 140 Hz and disposes a finished song',()=>{
 let time=0;const sink=new Sink(),transport=new MusTransport(score,false,()=>time,sink);transport.pump();assert.equal(sink.events[0].when,0.025);assert.equal(sink.events.length,1);
 time=.41;transport.pump();assert.equal(sink.events[1].when,.525);time=.94;transport.pump();assert.deepEqual(sink.offs,[1.025]);assert.equal(transport.isPlaying(),true);time=1.03;assert.equal(transport.isPlaying(),false);time=1.3;transport.pump();assert.equal(sink.disposed,1);transport.stop();assert.equal(sink.disposed,1);
 const looping=new Sink(),loop=new MusTransport(score,true,()=>time,looping);loop.pump();time+=.41;loop.pump();time+=.54;loop.pump();assert.equal(looping.resets.length,1);assert.equal(looping.events.filter(e=>e.event.type==='noteOn').length,2);loop.stop();
});
test('Pause reconstructs only elapsed events, restores held notes and excludes scheduled future releases',()=>{
 let time=0;const sink=new Sink(),transport=new MusTransport(score,true,()=>time,sink);transport.pump();time=.44;transport.pump();assert.equal(sink.events.length,2);transport.pause();assert.equal(transport.isPlaying(),true);time=10;transport.pump();assert.equal(sink.events.length,2);transport.resume();
 assert.deepEqual(sink.events.filter(e=>e.silent).map(e=>e.event.type),['noteOn']);assert.deepEqual(sink.resumes,[10]);assert.equal(sink.events.at(-1)!.silent,false);assert.ok(Math.abs(sink.events.at(-1)!.when-10.085)<1e-9);transport.stop();
});
test('Delayed timers seek within a loop without replaying minutes of audible events',()=>{
 let time=0;const sink=new Sink(),transport=new MusTransport(score,true,()=>time,sink);transport.pump();time=600.2;transport.pump();assert.equal(sink.events.filter(e=>!e.silent).length,1);assert.equal(sink.events.filter(e=>e.silent).length,1);assert.equal(sink.resumes.length,1);transport.stop();
 const empty=new Sink(),zero=new MusTransport({events:[],durationTicks:0,instruments:[]},true,()=>time,empty);zero.pump();time+=1;zero.pump();assert.equal(zero.isFinished(),true);
});
test('Native music handles validate, pause, resume, replace, unregister and reset independently of effects',()=>{
 const backend=new MusicDevice();I.I_InstallMusicBackend(backend);I.I_InitMusic();I.I_SetMusicVolume(42);const h=I.I_RegisterSong(demoMusic());I.I_PlaySong(h,true);assert.equal(backend.volume,42);assert.equal(I.I_QrySongPlaying(h),true);I.I_PauseSong(h);assert.equal([...backend.handles.values()][0].paused,true);I.I_ResumeSong(h);assert.equal([...backend.handles.values()][0].paused,false);I.I_PlaySong(h,false);assert.equal(backend.handles.size,1);assert.equal([...backend.handles.values()][0].looping,false);I.I_UnRegisterSong(h);assert.equal(backend.handles.size,0);assert.equal(I.I_QrySongPlaying(h),false);assert.throws(()=>I.I_PlaySong(h,true),/Invalid/);assert.throws(()=>I.I_SetMusicVolume(128));const h2=I.I_RegisterSong(demoMusic());I.I_PlaySong(h2,true);I.I_ShutdownMusic();assert.equal(backend.handles.size,0);assert.equal(I.I_QrySongPlaying(h2),false);
});
test('Level music follows all episode and Doom II tables without restarting an identical descriptor',()=>{
 const {music}=createHeadlessGame();const context={gamemode:MODE.registered,gameepisode:1,gamemap:1};S.S_InitMusicContext(context);
 for(let ep=1;ep<=3;ep++)for(let map=1;map<=9;map++){context.gameepisode=ep;context.gamemap=map;S.S_Start();assert.equal(S.S_GetMusicState().name,`e${ep}m${map}`);assert.equal(music.handles.size,1);}
 context.gameepisode=4;for(const [index,name] of ['e3m4','e3m2','e3m3','e1m5','e2m7','e2m4','e2m6','e2m5','e1m9'].entries()){context.gamemap=index+1;S.S_Start();assert.equal(S.S_GetMusicState().name,name);}
 context.gamemode=MODE.commercial;for(let map=1;map<=32;map++){context.gamemap=map;S.S_Start();assert.equal(S.S_GetMusicState().name,S_music[MUS.mus_runnin+map-1].name);}
 const next=music.next;S.S_Start();assert.equal(music.next,next);S.S_SetMusicVolume(0);assert.equal(music.volume,0);S.S_PauseSound();S.S_PauseSound();assert.equal(S.S_GetMusicState().paused,true);S.S_ResumeSound();assert.equal(S.S_GetMusicState().paused,false);S.S_StopMusic();assert.equal(music.handles.size,0);
});
test('Game progression changes level music to intermission and episode finale themes',()=>{
 const {session,music}=createHeadlessGame(true);assert.equal(S.S_GetMusicState().name,'e1m1');session.step(cmd());session.step(cmd(BT_USE));session.step(cmd());assert.equal(S.S_GetMusicState().name,'inter');assert.equal(music.handles.size,1);
 const last=createHeadlessGame(true);last.session.state.gamemap=8;last.session.start(false);last.session.step(cmd());last.session.step(cmd(BT_USE));assert.equal(S.S_GetMusicState().name,'victor');S.S_StopMusic();
});
class Param {value=0;events:{method:string;value:number;time:number}[]=[];setValueAtTime(value:number,time:number){this.value=value;this.events.push({method:'set',value,time});}linearRampToValueAtTime(v:number,t:number){this.setValueAtTime(v,t);}exponentialRampToValueAtTime(v:number,t:number){this.setValueAtTime(v,t);}setTargetAtTime(v:number,t:number){this.setValueAtTime(v,t);}cancelScheduledValues(time:number){this.events=this.events.filter(e=>e.time<time);}}
class Node {disconnected=false;gain=new Param();pan=new Param();frequency=new Param();detune=new Param();type='';buffer:unknown=null;onended:(()=>void)|null=null;starts:number[]=[];stops:number[]=[];connect(_n:unknown){}disconnect(){this.disconnected=true;}start(t:number){this.starts.push(t);}stop(t:number){this.stops.push(t);}}
class Context {currentTime=0;state='running';sampleRate=8000;destination=new Node();nodes:Node[]=[];sources:Node[]=[];gains:Node[]=[];createGain(){const n=new Node();this.nodes.push(n);this.gains.push(n);return n;}createStereoPanner(){const n=new Node();this.nodes.push(n);return n;}createBiquadFilter(){return this.createStereoPanner();}createOscillator(){const n=new Node();this.sources.push(n);this.nodes.push(n);return n;}createBufferSource(){return this.createOscillator();}createBuffer(_c:number,n:number,_r:number){const data=new Float32Array(n);return {getChannelData:()=>data};}}
function event(synth:MusSynth,value:Omit<music_event_t,'tick'|'channel'>|Record<string,unknown>,channel=0){synth.event({tick:0,channel,...value} as music_event_t,0,false);}
test('Synth produces pitched notes, stereo control, sustain/release, percussion and disconnects every node',()=>{
 const ctx=new Context(),synth=new MusSynth(ctx as unknown as AudioContext,127);event(synth,{type:'program',value:24});event(synth,{type:'noteOn',note:69,velocity:100});const source=ctx.sources[0];assert.equal(source.frequency.value,440);assert.equal(source.type,'triangle');event(synth,{type:'pitch',value:12288});assert.equal(source.detune.value,100);event(synth,{type:'control',controller:10,value:0});assert.ok(ctx.nodes.some(n=>n.pan.value===-1));event(synth,{type:'control',controller:64,value:127});event(synth,{type:'noteOff',note:69});assert.equal(source.stops.length,0);event(synth,{type:'control',controller:64,value:0});assert.equal(source.stops[0],.08);event(synth,{type:'noteOn',note:38,velocity:90},15);assert.ok(ctx.sources[1].buffer);assert.equal(ctx.sources[1].stops[0],.25);synth.setVolume(0);assert.equal(ctx.gains[0].gain.value,0);synth.dispose();assert.ok(ctx.nodes.every(n=>n.disconnected));synth.dispose();
});
test('Synth limits polyphony, cancels future voices on pause and reconstructs channel state silently',()=>{
 const ctx=new Context(),synth=new MusSynth(ctx as unknown as AudioContext,100);for(let note=0;note<70;note++)event(synth,{type:'noteOn',note,velocity:80});assert.equal(ctx.sources.filter(s=>!s.disconnected).length,64);synth.reset(0);assert.ok(ctx.sources.every(s=>s.stops.length));const count=ctx.sources.length;synth.event({tick:0,channel:0,type:'program',value:32},0,true);synth.event({tick:0,channel:0,type:'noteOn',note:60,velocity:80},0,true);assert.equal(ctx.sources.length,count);synth.resumeNotes(1);assert.equal(ctx.sources.length,count+1);assert.equal(ctx.sources.at(-1)!.type,'sawtooth');synth.dispose();
});
test('Browser music backend cancels timers on natural completion, stop and shutdown',()=>{
 const ctx=new Context();let pump=()=>{},cancelled=0;const backend=new WebMusicBackend(()=>ctx as unknown as AudioContext,p=>{pump=p;return()=>cancelled++;});const id=backend.play(score,false,80);backend.pause(id);backend.resume(id);backend.setVolume(0);ctx.currentTime=1.5;pump();ctx.currentTime=1.8;pump();assert.equal(backend.isPlaying(id),false);assert.ok(cancelled);assert.ok(ctx.nodes.every(n=>n.disconnected));backend.reset();assert.equal(backend.isPlaying(id),false);ctx.state='suspended';assert.throws(()=>backend.play(score,true,80),/Activa/);
});

test('Commercial intermission, story, cast and bunny select native themes and one-shot policy',()=>{
 const {session,music}=createHeadlessGame(true);session.state.gamemode=MODE.commercial;session.state.gamemap=30;session.state.G_ExitLevel();session.step(cmd());session.step(cmd());assert.equal(S.S_GetMusicState().name,'dm2int');
 F.F_StartFinale();assert.equal(S.S_GetMusicState().name,'read_m');F.F_StartCast();assert.equal(S.S_GetMusicState().name,'evil');
 session.state.gamemode=MODE.registered;session.state.gameepisode=3;F.F_StartFinale();assert.equal(S.S_GetMusicState().name,'victor');for(let i=0;i<F.finaletext.length*3+251;i++)F.F_Ticker();assert.equal(S.S_GetMusicState().name,'bunny');assert.equal([...music.handles.values()][0].looping,false);S.S_StopMusic();
});
test('WAD changes discard cached music indices and failed registration leaves no active song',()=>{
 createHeadlessGame();S.S_StopMusic();
 for(const offset of [1,3]){W.W_InitFile({name:'music.wad',data:makeWad([...Array.from({length:offset},(_,i)=>({name:`PAD${i}`,data:new Uint8Array()})),{name:'D_E1M1',data:demoMusic()}])});I.I_InitMusic();S.S_Init(80,80);S.S_StartMusic(MUS.mus_e1m1);assert.equal(S_music[MUS.mus_e1m1].lumpnum,offset);assert.equal(S.S_GetMusicState().playing,true);S.S_StopMusic();}
 W.W_InitFile({name:'bad.wad',data:makeWad([{name:'PAD',data:new Uint8Array()},{name:'D_E1M1',data:new Uint8Array([0])}])});S.S_Init(80,80);assert.throws(()=>S.S_StartMusic(MUS.mus_e1m1),/Formato/);assert.equal(S.S_GetMusicState().name,null);assert.equal(S_music[MUS.mus_e1m1].data,null);
});
import * as F from '../src/linuxdoom-1.10/f_finale';
import * as W from '../src/linuxdoom-1.10/w_wad';
import { makeWad } from '../src/web/demo';
