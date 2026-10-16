import type { sound_backend_t,sound_sample_t,sound_params_t } from '../linuxdoom-1.10/i_sound.h';
import { I_StereoGains } from '../linuxdoom-1.10/i_sound';
interface Voice {source:AudioBufferSourceNode;left:GainNode;right:GainNode;merger:ChannelMergerNode}
// Device adapter: no context or playback is created before an explicit user gesture.
export class WebAudioBackend implements sound_backend_t {
    private context:AudioContext|null=null;
    private buffers=new WeakMap<sound_sample_t,AudioBuffer>();
    private voices=new Map<number,Voice>();
    private nextHandle=1;
    constructor(private createContext:()=>AudioContext=()=>new AudioContext()){}
    async resume():Promise<void> {
        this.context??=this.createContext();
        if(this.context.state!=='running')await this.context.resume();
        if(this.context.state!=='running')throw new Error('El navegador no ha activado el audio');
    }
    getContext():AudioContext {if(!this.context||this.context.state!=='running')throw new Error('Activa el audio antes de reproducir música');return this.context;}
    start(sample:sound_sample_t,params:sound_params_t):number {
        const context=this.context;
        if(!context||context.state!=='running')throw new Error('Activa el audio antes de reproducir un sonido');
        const gains=I_StereoGains(params);
        let buffer=this.buffers.get(sample);
        if(!buffer){buffer=context.createBuffer(1,sample.samples.length,sample.sampleRate);buffer.copyToChannel(sample.samples as Float32Array<ArrayBuffer>,0);this.buffers.set(sample,buffer);}
        const source=context.createBufferSource(),left=context.createGain(),right=context.createGain(),merger=context.createChannelMerger(2);
        source.buffer=buffer;source.playbackRate.value=2**((params.pitch-128)/64);
        left.gain.value=gains[0];right.gain.value=gains[1];
        source.connect(left);source.connect(right);left.connect(merger,0,0);right.connect(merger,0,1);merger.connect(context.destination);
        const handle=this.nextHandle++,voice={source,left,right,merger};
        source.onended=()=>this.release(handle,voice);this.voices.set(handle,voice);
        try {source.start();}catch(error){this.release(handle,voice);throw error;}
        return handle;
    }
    private release(handle:number,voice:Voice):void {
        this.voices.delete(handle);voice.source.onended=null;voice.source.disconnect();voice.left.disconnect();voice.right.disconnect();voice.merger.disconnect();
    }
    stop(handle:number):void {const voice=this.voices.get(handle);if(!voice)return;voice.source.stop();this.release(handle,voice);}
    isPlaying(handle:number):boolean {return this.voices.has(handle);}
    update(handle:number,params:sound_params_t):void {
        const voice=this.voices.get(handle);if(!voice)return;
        const gains=I_StereoGains(params);voice.left.gain.value=gains[0];voice.right.gain.value=gains[1];voice.source.playbackRate.value=2**((params.pitch-128)/64);
    }
    reset():void {for(const handle of this.voices.keys())this.stop(handle);this.buffers=new WeakMap();}
    async close():Promise<void> {this.reset();const context=this.context;this.context=null;if(context&&context.state!=='closed')await context.close();}
}
