import type { music_backend_t,music_score_t,music_event_t } from '../linuxdoom-1.10/i_sound.h';
export interface MusicSink {event(event:music_event_t,when:number,silent:boolean):void;reset(when:number):void;resumeNotes(when:number):void;allOff(when:number):void;dispose():void}
// Audio-clock transport, independent of render frames and gameplay RNG.
export class MusTransport {
    private origin:number;private epoch:number;private index=0;private elapsed=0;private finishedAt:number|null=null;
    private active=true;private paused=false;
    constructor(private score:music_score_t,private looping:boolean,private clock:()=>number,private sink:MusicSink){this.origin=this.epoch=clock()+0.025;}
    isFinished():boolean {return !this.active;}
    isPlaying():boolean {return this.active&&(this.paused||this.finishedAt===null||this.clock()<this.finishedAt);}
    pump():void {
        if(!this.active||this.paused)return;const now=this.clock();
        if(this.finishedAt!==null){if(now>=this.finishedAt+0.2)this.stop();return;}
        const duration=this.score.durationTicks/140;
        if(duration<=0){this.finishedAt=now;this.sink.allOff(now);return;}
        if(now>this.epoch+duration+0.25){this.seek(Math.max(0,now-this.origin),now);if(this.finishedAt!==null)return;}
        const horizon=now+0.12;let budget=10000;
        while(budget-->0){
            const event=this.score.events[this.index];
            if(event){const when=this.epoch+event.tick/140;if(when<now-0.25){this.seek(Math.max(0,now-this.origin),now);if(this.finishedAt!==null)return;continue;}if(when>horizon)return;this.sink.event(event,Math.max(now,when),false);this.index++;continue;}
            const boundary=this.epoch+duration;if(boundary>horizon)return;
            if(!this.looping){this.sink.allOff(Math.max(now,boundary));this.finishedAt=boundary;return;}
            this.sink.reset(Math.max(now,boundary));this.epoch=boundary;this.index=0;
        }
    }
    pause():void {if(!this.isPlaying()||this.paused)return;this.elapsed=Math.max(0,this.clock()-this.origin);this.paused=true;this.sink.reset(this.clock());}
    private seek(elapsed:number,now:number):void {
        const duration=this.score.durationTicks/140;
        if(!this.looping&&elapsed>=duration){this.sink.allOff(now);this.finishedAt=now;return;}
        const cycle=this.looping&&duration>0?Math.floor(elapsed/duration):0,position=elapsed-cycle*duration;
        this.epoch=this.origin+cycle*duration;this.index=0;this.finishedAt=null;this.sink.reset(now);
        while(this.index<this.score.events.length&&this.score.events[this.index].tick/140<=position)this.sink.event(this.score.events[this.index++],now,true);
        this.sink.resumeNotes(now);
    }
    resume():void {
        if(!this.active||!this.paused)return;const now=this.clock();this.origin=now-this.elapsed;this.seek(this.elapsed,now);this.paused=false;this.pump();
    }
    stop():void {if(!this.active)return;this.active=false;this.sink.dispose();}
}
interface Voice {source:OscillatorNode|AudioBufferSourceNode;gain:GainNode;filter:BiquadFilterNode;channel:number;release:number;ended:boolean}
interface Note {channel:number;note:number;velocity:number;program:number;held:boolean;voice?:Voice}
interface Channel {program:number;volume:number;expression:number;pan:number;bend:number;sustain:boolean;soft:boolean;mono:boolean;gain:GainNode;panner:StereoPannerNode}
const waves:OscillatorType[]=['triangle','sine','square','triangle','sawtooth','sawtooth','sawtooth','sawtooth','square','sine','square','triangle','sine','triangle','sine','sine'];
// Basic procedural GM-family timbres. No claim of OPL/DMX or SoundFont fidelity.
// Bank/modulation/reverb/chorus events are parsed, but their timbres remain pending.
export class MusSynth implements MusicSink {
    private channels:Channel[];private notes=new Map<number,Note>();private voices=new Set<Voice>();private master:GainNode;private noise:AudioBuffer|null=null;private closed=false;
    constructor(private context:AudioContext,volume:number){
        this.master=context.createGain();this.master.connect(context.destination);this.setVolume(volume);
        this.channels=Array.from({length:16},()=>{const gain=context.createGain(),panner=context.createStereoPanner();gain.connect(panner);panner.connect(this.master);return {program:0,volume:100,expression:127,pan:64,bend:8192,sustain:false,soft:false,mono:false,gain,panner};});
        this.reset(context.currentTime);
    }
    setVolume(volume:number):void {this.master.gain.setValueAtTime(volume/127*0.22,this.context.currentTime);}
    private gains(c:Channel,time:number):void {c.gain.gain.setValueAtTime(c.volume/127*c.expression/127*(c.soft?0.6:1),time);c.panner.pan.setValueAtTime((c.pan-64)/(c.pan<64?64:63),time);}
    private bend(c:Channel,time:number,channel:number):void {for(const voice of this.voices)if(voice.channel===channel&&'frequency' in voice.source)voice.source.detune.setValueAtTime((c.bend-8192)/8192*200,time);}
    private release(note:Note,time:number,force=false):void {
        const voice=note.voice;if(!voice||voice.ended)return;const end=time+(force?0.008:voice.release);
        voice.gain.gain.cancelScheduledValues(time);voice.gain.gain.setTargetAtTime(0,time,force?0.002:voice.release/4);
        try {voice.source.stop(end);}catch{/* Source may already have ended naturally. */}note.voice=undefined;
    }
    private remove(voice:Voice):void {if(voice.ended)return;voice.ended=true;this.voices.delete(voice);voice.source.onended=null;voice.source.disconnect();voice.gain.disconnect();voice.filter.disconnect();}
    private noiseBuffer():AudioBuffer {
        if(!this.noise){const buffer=this.context.createBuffer(1,Math.ceil(this.context.sampleRate*0.5),this.context.sampleRate),samples=buffer.getChannelData(0);let seed=0x1234567;
            for(let i=0;i<samples.length;i++){seed=(Math.imul(seed,1664525)+1013904223)>>>0;samples[i]=seed/0x80000000-1;}this.noise=buffer;}
        return this.noise;
    }
    private start(note:Note,time:number):void {
        const c=this.channels[note.channel],drum=note.channel===15,family=note.program>>3;
        while(this.voices.size>=64){const oldest=this.voices.values().next().value!;try{oldest.source.stop(this.context.currentTime);}catch{}this.remove(oldest);}
        const noisy=drum&&note.note!==35&&note.note!==36&&!(note.note>=41&&note.note<=50&&note.note%2===1);
        let source:OscillatorNode|AudioBufferSourceNode;
        if(noisy){const s=this.context.createBufferSource();s.buffer=this.noiseBuffer();source=s;}
        else {const s=this.context.createOscillator();s.type=drum?'sine':waves[family];s.frequency.setValueAtTime(drum?120:440*2**((note.note-69)/12),time);s.detune.setValueAtTime((c.bend-8192)/8192*200,time);if(drum)s.frequency.exponentialRampToValueAtTime(45,time+0.15);source=s;}
        const gain=this.context.createGain(),filter=this.context.createBiquadFilter();filter.type=noisy?'highpass':'lowpass';filter.frequency.value=noisy?(note.note===42||note.note===46?5000:900):family===4?1400:6000;
        source.connect(filter);filter.connect(gain);gain.connect(c.gain);
        const attack=drum?0.002:family===5||family===6||family===11?0.05:0.006,amplitude=(note.velocity/127)**2*0.18;
        gain.gain.setValueAtTime(0,time);gain.gain.linearRampToValueAtTime(amplitude,time+attack);gain.gain.setTargetAtTime(amplitude*(family===0||family===3?0.35:0.75),time+attack,0.15);
        const voice:Voice={source,gain,filter,channel:note.channel,release:0.08,ended:false};note.voice=voice;this.voices.add(voice);source.onended=()=>this.remove(voice);
        try {source.start(time);if(drum){const length=note.note===42?0.075:0.25;gain.gain.setTargetAtTime(0,time+0.02,length/5);source.stop(time+length);}}catch(error){this.remove(voice);throw error;}
    }
    event(event:music_event_t,time:number,silent:boolean):void {
        const c=this.channels[event.channel],key=event.channel*128+('note' in event?event.note:0);
        if(event.type==='noteOn'&&event.velocity>0){
            if(c.mono)for(const [id,note] of this.notes)if(note.channel===event.channel){this.release(note,time);this.notes.delete(id);}
            const previous=this.notes.get(key);if(previous)this.release(previous,time);
            const note:Note={channel:event.channel,note:event.note,velocity:event.velocity,program:c.program,held:true};this.notes.set(key,note);if(!silent)this.start(note,time);
        }else if(event.type==='noteOff'||event.type==='noteOn'){
            const note=this.notes.get(key);if(note){note.held=false;if(!c.sustain){this.release(note,time);this.notes.delete(key);}}
        }else if(event.type==='program')c.program=event.value;
        else if(event.type==='pitch'){c.bend=event.value;if(!silent)this.bend(c,time,event.channel);}
        else if(event.type==='control'){
            const {controller,value}=event;
            if(controller===7)c.volume=value;else if(controller===11)c.expression=value;else if(controller===10)c.pan=value;else if(controller===67)c.soft=value>=64;
            else if(controller===64){c.sustain=value>=64;if(!c.sustain)for(const [id,note] of this.notes)if(note.channel===event.channel&&!note.held){this.release(note,time);this.notes.delete(id);}}
            else if(controller===120||controller===123){for(const [id,note] of this.notes)if(note.channel===event.channel){note.held=false;if(controller===120||!c.sustain){this.release(note,time,controller===120);this.notes.delete(id);}}}
            else if(controller===126||controller===127)c.mono=controller===126;
            else if(controller===121){c.volume=100;c.expression=127;c.pan=64;c.bend=8192;c.soft=false;c.sustain=false;for(const [id,note] of this.notes)if(note.channel===event.channel&&!note.held){this.release(note,time);this.notes.delete(id);}if(!silent)this.bend(c,time,event.channel);}
            if(!silent)this.gains(c,time);
        }
    }
    resumeNotes(time:number):void {this.channels.forEach((c,i)=>{this.gains(c,time);this.bend(c,time,i);});for(const note of this.notes.values())this.start(note,time);}
    allOff(time:number):void {for(const voice of this.voices){voice.gain.gain.cancelScheduledValues(time);voice.gain.gain.setTargetAtTime(0,time,0.002);try{voice.source.stop(time+0.008);}catch{}}this.notes.clear();}
    reset(time:number):void {
        this.allOff(time);
        for(const c of this.channels){Object.assign(c,{program:0,volume:100,expression:127,pan:64,bend:8192,sustain:false,soft:false,mono:false});c.gain.gain.cancelScheduledValues(time);c.panner.pan.cancelScheduledValues(time);this.gains(c,time);}
    }
    dispose():void {if(this.closed)return;this.closed=true;for(const voice of [...this.voices]){try{voice.source.stop(this.context.currentTime);}catch{}this.remove(voice);}this.notes.clear();for(const c of this.channels){c.gain.disconnect();c.panner.disconnect();}this.master.disconnect();}
}
export class WebMusicBackend implements music_backend_t {
    private next=1;private players=new Map<number,{transport:MusTransport;synth:MusSynth;cancel:()=>void}>();
    constructor(private getContext:()=>AudioContext,private schedule:(pump:()=>void)=>()=>void=pump=>{const timer=setInterval(pump,25);return()=>clearInterval(timer);}){}
    play(score:music_score_t,looping:boolean,volume:number):number {
        const context=this.getContext();if(context.state!=='running')throw new Error('Activa el audio antes de reproducir música');
        const synth=new MusSynth(context,volume),transport=new MusTransport(score,looping,()=>context.currentTime,synth),handle=this.next++;
        let cancel=()=>{};
        try {cancel=this.schedule(()=>{try{transport.pump();}catch{transport.stop();}if(transport.isFinished())cancel();});}catch(error){transport.stop();throw error;}
        this.players.set(handle,{transport,synth,cancel});
        try {transport.pump();}catch(error){this.stop(handle);throw error;}return handle;
    }
    stop(handle:number):void {const player=this.players.get(handle);if(player){player.cancel();player.transport.stop();this.players.delete(handle);}}
    pause(handle:number):void {this.players.get(handle)?.transport.pause();}
    resume(handle:number):void {this.players.get(handle)?.transport.resume();}
    isPlaying(handle:number):boolean {return this.players.get(handle)?.transport.isPlaying()??false;}
    setVolume(volume:number):void {for(const player of this.players.values())player.synth.setVolume(volume);}
    reset():void {for(const id of this.players.keys())this.stop(id);}
}
