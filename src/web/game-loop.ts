import { AM_Drawer,AM_ResetLevel } from '../linuxdoom-1.10/am_map';
import { HU_Drawer,HU_Erase,HU_IsActive,HU_Unload } from '../linuxdoom-1.10/hu_stuff';
import { ST_Drawer,ST_IsRunning,ST_Stop,ST_unloadData } from '../linuxdoom-1.10/st_stuff';
import { GameSession,type game_presentation_t } from './game-session';
import { GameInput } from './game-input';
import { I_StartTic,I_FinishUpdate } from '../linuxdoom-1.10/i_video';
import { evtype_t } from '../linuxdoom-1.10/d_event.h';
import { R_SetViewSize,R_ExecuteSetViewSize,R_RenderPlayerView } from '../linuxdoom-1.10/r_main';
import { WI_Drawer,WI_CanDraw,WI_End } from '../linuxdoom-1.10/wi_stuff';
import { F_Drawer,F_CanDraw } from '../linuxdoom-1.10/f_finale';
import { gamestate_t as GS } from '../linuxdoom-1.10/doomdef.h';
import { KEY_ESCAPE } from '../linuxdoom-1.10/doomdef.h';
import { channels,S_StopChannel,S_StopMusic,S_PauseSound,S_ResumeSound } from '../linuxdoom-1.10/s_sound';
import { screens } from '../linuxdoom-1.10/v_video';
export class BrowserGame {
    private animation=0;
    private input=new GameInput();
    session:GameSession|null=null;
    paused=false;
    togglePause():void {if(this.session?.completed)return;this.paused=!this.paused;if(this.session)this.session.state.paused=this.paused;if(this.paused)S_PauseSound();else S_ResumeSound();this.input.clear();}
    continueLevel():boolean {this.input.clear();this.paused=false;return this.session?.continueLevel()??false;}
    constructor(private present:(game:GameSession)=>void,private onError:(error:unknown)=>void,private presentation:game_presentation_t){}
    stop():void {cancelAnimationFrame(this.animation);this.animation=0;this.input.clear();if(this.session)for(let i=0;i<channels.length;i++)if(channels[i].sfxinfo)S_StopChannel(i);if(this.session){WI_End();AM_ResetLevel();HU_Unload();ST_Stop();ST_unloadData();S_StopMusic();}this.session=null;this.paused=false;}
    private poll=():void=>{for(const e of I_StartTic()){if(this.session?.respond(e))continue;if(e.type===evtype_t.ev_keydown){if(e.data1===KEY_ESCAPE)this.togglePause();else this.input.keyDown(e.data1);}else if(e.type===evtype_t.ev_keyup)this.input.keyUp(e.data1);}};
    start(mapname:string):void {
        this.stop();const session=new GameSession(mapname,this.presentation);this.session=session;
        try{session.start();R_SetViewSize(ST_IsRunning()?10:11,0);R_ExecuteSetViewSize();I_StartTic();}catch(error){this.stop();throw error;}
        let previous:number|null=null,accumulator=0;
        const render=()=>{if(session.state.gamestate===GS.GS_LEVEL&&HU_IsActive())HU_Erase();screens[0].fill(0);if(session.state.gamestate===GS.GS_FINALE){if(F_CanDraw())F_Drawer();}else if(session.state.gamestate===GS.GS_INTERMISSION&&WI_CanDraw())WI_Drawer();else if(session.state.automapactive)AM_Drawer();else R_RenderPlayerView(session.player,this.poll);if(session.state.gamestate===GS.GS_LEVEL&&ST_IsRunning())ST_Drawer(false,true);if(session.state.gamestate===GS.GS_LEVEL&&HU_IsActive())HU_Drawer();I_FinishUpdate();this.present(session);};
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
