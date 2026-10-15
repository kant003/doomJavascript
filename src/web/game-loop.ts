import { GameSession,type game_presentation_t } from './game-session';
import { GameInput } from './game-input';
import { I_StartTic,I_FinishUpdate } from '../linuxdoom-1.10/i_video';
import { evtype_t } from '../linuxdoom-1.10/d_event.h';
import { R_RenderPlayerView } from '../linuxdoom-1.10/r_main';
import { KEY_ESCAPE } from '../linuxdoom-1.10/doomdef.h';
import { channels,S_StopChannel } from '../linuxdoom-1.10/s_sound';
import { screens } from '../linuxdoom-1.10/v_video';
export class BrowserGame {
    private animation=0;
    private input=new GameInput();
    session:GameSession|null=null;
    paused=false;
    togglePause():void {this.paused=!this.paused;this.input.clear();}
    constructor(private present:(game:GameSession)=>void,private onError:(error:unknown)=>void,private presentation:game_presentation_t){}
    stop():void {cancelAnimationFrame(this.animation);this.animation=0;this.input.clear();if(this.session)for(let i=0;i<channels.length;i++)if(channels[i].sfxinfo)S_StopChannel(i);this.session=null;this.paused=false;}
    private poll=():void=>{for(const e of I_StartTic())if(e.type===evtype_t.ev_keydown){if(e.data1===KEY_ESCAPE)this.togglePause();else this.input.keyDown(e.data1);}else if(e.type===evtype_t.ev_keyup)this.input.keyUp(e.data1);};
    start(mapname:string):void {
        this.stop();const session=new GameSession(mapname,this.presentation);session.start();this.session=session;I_StartTic();
        let previous:number|null=null,accumulator=0;
        const render=()=>{screens[0].fill(0);R_RenderPlayerView(session.player,this.poll);I_FinishUpdate();this.present(session);};
        render();
        const frame=(now:number)=>{
            if(this.session!==session)return;
            try {
                accumulator+=previous===null?0:Math.min(200,now-previous);previous=now;this.poll();
                while(accumulator>=1000/35){accumulator-=1000/35;if(!this.paused)session.step(this.input.command());}
                render();this.animation=requestAnimationFrame(frame);
            }catch(error){this.stop();this.onError(error);}
        };
        this.animation=requestAnimationFrame(frame);
    }
}
