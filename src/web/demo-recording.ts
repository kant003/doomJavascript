// Authored command stream for the synthetic map, using LinuxDOOM's demo format.
import { VERSION } from '../linuxdoom-1.10/doomdef.h';
export function demoRecordingFixture():Uint8Array {
    const tics=350,data=new Uint8Array(13+tics*4+1);data.set([VERSION,2,1,1,0,0,0,0,0,1,0,0,0]);
    for(let i=0;i<tics;i++){data[13+i*4]=i>=140&&i<200?10:0;data[13+i*4+2]=i<140?1:i>=210&&i<280?255:0;}
    data[data.length-1]=0x80;return data;
}
