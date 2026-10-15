import { test } from 'node:test';
import assert from 'node:assert/strict';
import { WebAudioBackend } from '../src/web/audio';
import type { sound_params_t } from '../src/linuxdoom-1.10/i_sound.h';
class Node {
 connections:{target:Node;output:number;input:number}[]=[];disconnected=false;
 connect(target:Node,output=0,input=0){this.connections.push({target,output,input});}
 disconnect(){this.disconnected=true;}
}
class Source extends Node {buffer:unknown=null;playbackRate={value:1};onended:(()=>void)|null=null;started=false;stopped=false;start(){this.started=true;}stop(){this.stopped=true;}}
class Gain extends Node {gain={value:1};}
class Context {
 state='suspended';sources:Source[]=[];gains:Gain[]=[];mergers:Node[]=[];destination=new Node();buffers:{data:Float32Array;sampleRate:number}[]=[];resumes=0;closed=false;
 async resume(){this.resumes++;this.state='running';}
 async close(){this.state='closed';this.closed=true;}
 createBuffer(channels:number,length:number,sampleRate:number){assert.equal(channels,1);const data=new Float32Array(length);this.buffers.push({data,sampleRate});return {copyToChannel:(input:Float32Array)=>data.set(input)};}
 createBufferSource(){const n=new Source();this.sources.push(n);return n;}
 createGain(){const n=new Gain();this.gains.push(n);return n;}
 createChannelMerger(channels:number){assert.equal(channels,2);const n=new Node();this.mergers.push(n);return n;}
}
const sample={sampleRate:11025,samples:new Float32Array([-1,0,0.5])},params:sound_params_t={volume:127,separation:0,pitch:128,priority:64};
test('Browser device defers AudioContext creation until explicitly resumed',async()=>{
 const ctx=new Context();let created=0;const audio=new WebAudioBackend(()=>{created++;return ctx as unknown as AudioContext;});
 assert.equal(created,0);assert.throws(()=>audio.start(sample,params),/Activa el audio/);await audio.resume();assert.equal(created,1);assert.equal(ctx.resumes,1);await audio.resume();assert.equal(ctx.resumes,1);await audio.close();assert.equal(ctx.closed,true);
});
test('Browser device copies PCM, caches buffers, routes separate stereo gains and applies pitch',async()=>{
 const ctx=new Context(),audio=new WebAudioBackend(()=>ctx as unknown as AudioContext);await audio.resume();
 const first=audio.start(sample,params),second=audio.start(sample,{...params,pitch:192,separation:255});assert.equal(ctx.buffers.length,1);assert.deepEqual(ctx.buffers[0].data,sample.samples);assert.equal(ctx.buffers[0].sampleRate,11025);
 assert.equal(ctx.sources[0].started,true);assert.equal(ctx.sources[1].playbackRate.value,2);assert.equal(ctx.gains[0].gain.value,1);assert.equal(ctx.gains[1].gain.value,0);assert.equal(ctx.gains[2].gain.value,0);assert.equal(ctx.gains[3].gain.value,1);
 assert.equal(ctx.gains[0].connections[0].input,0);assert.equal(ctx.gains[1].connections[0].input,1);assert.strictEqual(ctx.mergers[0].connections[0].target,ctx.destination);assert.ok(audio.isPlaying(first));assert.ok(audio.isPlaying(second));
 audio.update(first,{...params,pitch:64,separation:255});assert.equal(ctx.sources[0].playbackRate.value,0.5);assert.equal(ctx.gains[0].gain.value,0);assert.equal(ctx.gains[1].gain.value,1);await audio.close();
});
test('Completed and stopped browser voices release all nodes and handles',async()=>{
 const ctx=new Context(),audio=new WebAudioBackend(()=>ctx as unknown as AudioContext);await audio.resume();const ended=audio.start(sample,params);ctx.sources[0].onended!();
 assert.equal(audio.isPlaying(ended),false);assert.ok(ctx.sources[0].disconnected);assert.ok(ctx.gains[0].disconnected);assert.ok(ctx.gains[1].disconnected);assert.ok(ctx.mergers[0].disconnected);
 const stopped=audio.start(sample,params);audio.stop(stopped);assert.equal(ctx.sources[1].stopped,true);assert.equal(audio.isPlaying(stopped),false);audio.stop(stopped);await audio.close();
});
test('Reset clears voices and cached PCM buffers while keeping the unlocked context',async()=>{
 const ctx=new Context(),audio=new WebAudioBackend(()=>ctx as unknown as AudioContext);await audio.resume();const handle=audio.start(sample,params);audio.reset();assert.equal(audio.isPlaying(handle),false);assert.equal(ctx.sources[0].stopped,true);
 audio.start(sample,params);assert.equal(ctx.buffers.length,2);assert.equal(ctx.resumes,1);await audio.close();
});
test('Resume rejection propagates and does not allocate a sound source',async()=>{
 const ctx=new Context();ctx.resume=async()=>{throw new Error('blocked');};const audio=new WebAudioBackend(()=>ctx as unknown as AudioContext);await assert.rejects(audio.resume(),/blocked/);assert.equal(ctx.sources.length,0);await audio.close();
});
