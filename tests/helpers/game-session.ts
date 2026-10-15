import { GameSession } from '../../src/web/game-session';
import { playableDemoWad } from '../../src/web/playable-demo';
import { W_InitFile } from '../../src/linuxdoom-1.10/w_wad';
import { R_InitData } from '../../src/linuxdoom-1.10/r_data';
import { I_InstallSoundBackend,I_InitSound } from '../../src/linuxdoom-1.10/i_sound';
import type { sound_backend_t,sound_params_t,sound_sample_t } from '../../src/linuxdoom-1.10/i_sound.h';
import { S_Init } from '../../src/linuxdoom-1.10/s_sound';
import { R_InitLightTables,R_SetViewSize,R_ExecuteSetViewSize } from '../../src/linuxdoom-1.10/r_main';
import { R_InitTranslationTables } from '../../src/linuxdoom-1.10/r_draw';
import { R_InitSkyMap } from '../../src/linuxdoom-1.10/r_sky';
import { V_Init } from '../../src/linuxdoom-1.10/v_video';
export class Device implements sound_backend_t {
    handles=new Set<number>();next=1;starts=0;
    start(_sample:sound_sample_t,_params:sound_params_t){this.starts++;this.handles.add(this.next);return this.next++;}
    stop(h:number){this.handles.delete(h);}isPlaying(h:number){return this.handles.has(h);}update(){}reset(){this.handles.clear();}
}
export function createHeadlessGame(campaign=false){
    W_InitFile({name:'test.wad',data:playableDemoWad(campaign)});R_InitData();V_Init();const device=new Device();I_InstallSoundBackend(device);I_InitSound();S_Init(80,0);
    const events:string[]=[];const session=new GameSession('E1M1',{resetStatus:()=>events.push('status'),resetMessages:()=>events.push('messages'),closeAutomap:()=>events.push('map'),tactile:()=>events.push('hurt'),onExit:secret=>events.push(secret?'secret':'exit')});
    session.start();R_InitTranslationTables();R_InitLightTables();R_SetViewSize(11,0);R_ExecuteSetViewSize();R_InitSkyMap();return {session,device,events};
}
