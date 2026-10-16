// MUS platform decoder. Event/controller definitions checked against Chocolate
// Doom's GPL mus2mid.c; see PORTING.md. This is not code from Linux's empty mixer.
import type { music_score_t,music_event_t } from '../linuxdoom-1.10/i_sound.h';
const controllers=[0,32,1,7,10,11,91,93,64,67,120,123,126,127,121];
export function decodeMus(data:Uint8Array):music_score_t {
    if(data.length<16||data[0]!==77||data[1]!==85||data[2]!==83||data[3]!==26)throw new Error('Formato musical no soportado: se necesita un MUS clásico. MIDI pendiente.');
    const v=new DataView(data.buffer,data.byteOffset,data.byteLength),length=v.getUint16(4,true),start=v.getUint16(6,true),channels=v.getUint16(8,true),secondary=v.getUint16(10,true),count=v.getUint16(12,true);
    if(channels>15||secondary>15||start<16+count*2||!length||start+length>data.length)throw new Error('Cabecera MUS inválida o truncada');
    const instruments=Array.from({length:count},(_,i)=>v.getUint16(16+i*2,true)),events:music_event_t[]=[],velocities=new Uint8Array(16).fill(127);
    let at=start,tick=0;const end=start+length;
    const byte=()=>{if(at>=end)throw new Error('Evento MUS truncado');return data[at++];};
    const seven=()=>{const value=byte();if(value>127)throw new Error('Valor MUS fuera de rango');return value;};
    while(at<end){
        if(events.length>=200000)throw new Error('Demasiados eventos MUS');
        const descriptor=byte(),channel=descriptor&15,type=(descriptor>>4)&7;
        switch(type){
            case 0:events.push({tick,channel,type:'noteOff',note:byte()&127});break;
            case 1:{const key=byte();if(key&128)velocities[channel]=seven();events.push({tick,channel,type:'noteOn',note:key&127,velocity:velocities[channel]});break;}
            case 2:events.push({tick,channel,type:'pitch',value:byte()*64});break;
            case 3:{const control=seven();if(control<10||control>14)throw new Error('Control de sistema MUS inválido');events.push({tick,channel,type:'control',controller:controllers[control],value:control===12?channels+1:0});break;}
            case 4:{const control=seven(),value=Math.min(127,byte());if(control>9)throw new Error('Control MUS inválido');events.push(control===0?{tick,channel,type:'program',value}:{tick,channel,type:'control',controller:controllers[control],value});break;}
            case 6:return {events,durationTicks:tick,instruments};
            default:throw new Error(`Tipo de evento MUS no soportado: ${type}`);
        }
        if(descriptor&128){
            let delay=0,n=0,value:number;
            do {value=byte();if(++n>4)throw new Error('Espera MUS demasiado larga');delay=delay*128+(value&127);}while(value&128);
            tick+=delay;if(tick>140*60*60)throw new Error('El MUS supera una hora');
        }
    }
    throw new Error('Falta el final de la partitura MUS');
}
