import { M_StartControlPanel,M_ClearMenus,M_Drawer,M_Ticker,menuactive,screenblocks,detailLevel } from '../linuxdoom-1.10/m_menu';
import { R_FillBackScreen,R_DrawViewBorder,draw } from '../linuxdoom-1.10/r_draw';
import { W_CheckNumForName } from '../linuxdoom-1.10/w_wad';
import { AM_Drawer,AM_ResetLevel } from '../linuxdoom-1.10/am_map';
import { HU_Drawer,HU_Erase,HU_IsActive,HU_Unload } from '../linuxdoom-1.10/hu_stuff';
import { ST_Drawer,ST_IsRunning,ST_Stop,ST_unloadData } from '../linuxdoom-1.10/st_stuff';
import { GameSession,type game_presentation_t } from './game-session';
import { GameInput } from './game-input';
import { I_StartTic,I_FinishUpdate } from '../linuxdoom-1.10/i_video';
import { evtype_t,gameaction_t as GA } from '../linuxdoom-1.10/d_event.h';
import { R_SetViewSize,R_ExecuteSetViewSize,R_RenderPlayerView,view } from '../linuxdoom-1.10/r_main';
import { WI_Drawer,WI_CanDraw,WI_End } from '../linuxdoom-1.10/wi_stuff';
import { F_Drawer,F_CanDraw } from '../linuxdoom-1.10/f_finale';
import { gamestate_t as GS,GameMode_t } from '../linuxdoom-1.10/doomdef.h';
import { KEY_PAUSE } from '../linuxdoom-1.10/doomdef.h';
import { channels,S_StopChannel,S_StopMusic,S_PauseSound,S_ResumeSound } from '../linuxdoom-1.10/s_sound';
import { screens } from '../linuxdoom-1.10/v_video';
export class BrowserGame {
    private animation=0;
    private input=new GameInput();
    session:GameSession|null=null;
    paused=false;
    togglePause():void {if(this.session?.completed&&!this.session.state.demoplayback&&!this.session.state.demorecording)return;this.paused=!this.paused;if(this.session&&!this.session.state.demoplayback)this.session.state.paused=this.paused;if(this.paused||this.session?.state.paused)S_PauseSound();else S_ResumeSound();this.input.clear();}
    openMenu():void {if(!this.session)return;this.input.clear();M_StartControlPanel();}
    playDemo(data:Uint8Array,name:string):void {this.input.clear();this.session?.playDemo(data,name);this.paused=false;}
    recordDemo():void {this.input.clear();this.session?.recordDemo();this.paused=false;}
    continueLevel():boolean {this.input.clear();this.paused=false;return this.session?.continueLevel()??false;}
    constructor(private present:(game:GameSession)=>void,private onError:(error:unknown)=>void,private presentation:game_presentation_t){}
    stop():void {if(document.pointerLockElement)document.exitPointerLock();cancelAnimationFrame(this.animation);this.animation=0;this.input.clear();this.session?.finishRecording();if(this.session)for(let i=0;i<channels.length;i++)if(channels[i].sfxinfo)S_StopChannel(i);if(this.session){WI_End();AM_ResetLevel();HU_Unload();ST_Stop();ST_unloadData();S_StopMusic();}M_ClearMenus();this.session=null;this.paused=false;}
    private poll=():void=>{for(const e of I_StartTic()){if(this.session?.respond(e)){if(menuactive)this.input.clear();continue;}if(menuactive)continue;if(e.type===evtype_t.ev_mouse){this.input.mouse(e.data1,e.data2,e.data3);continue;}if(e.type===evtype_t.ev_joystick){this.input.joystick(e.data1,e.data2,e.data3);continue;}if(e.type===evtype_t.ev_keydown){if(e.data1===KEY_PAUSE)this.togglePause();else this.input.keyDown(e.data1);}else if(e.type===evtype_t.ev_keyup)this.input.keyUp(e.data1);}};
    start(mapname:string):void {
        this.stop();const session=new GameSession(mapname,this.presentation);this.session=session;
        try{session.start();R_SetViewSize(ST_IsRunning()?screenblocks:11,detailLevel);R_ExecuteSetViewSize();I_StartTic();}catch(error){this.stop();throw error;}
        let previous:number|null=null,accumulator=0;
        const render=()=>{
            if(view.setsizeneeded)R_ExecuteSetViewSize();
            if(session.state.gamestate===GS.GS_LEVEL&&HU_IsActive())HU_Erase();screens[0].fill(0);
            if(session.state.gamestate===GS.GS_FINALE){if(F_CanDraw())F_Drawer();}
            else if(session.state.gamestate===GS.GS_INTERMISSION&&WI_CanDraw())WI_Drawer();
            else if(session.state.automapactive)AM_Drawer();
            else {
                draw.gamemode=session.state.gamemode;
                const border=['BRDR_T','BRDR_B','BRDR_L','BRDR_R','BRDR_TL','BRDR_TR','BRDR_BL','BRDR_BR',draw.gamemode===GameMode_t.commercial?'GRNROCK':'FLOOR7_2'].every(name=>W_CheckNumForName(name)>=0);
                if(border){R_FillBackScreen();R_DrawViewBorder();}
                R_RenderPlayerView(session.player,this.poll);
            }
            if(session.state.gamestate===GS.GS_LEVEL&&ST_IsRunning())ST_Drawer(view.viewheight===200,true);
            if(session.state.gamestate===GS.GS_LEVEL&&HU_IsActive())HU_Drawer();M_Drawer();I_FinishUpdate();this.present(session);
        };
        render();
        const frame=(now:number)=>{
            if(this.session!==session)return;
            try {
                accumulator+=previous===null?0:Math.min(200,now-previous);previous=now;this.poll();if(this.session!==session)return;
                while(accumulator>=1000/35){accumulator-=1000/35;M_Ticker();if(!this.paused||session.state.gameaction===GA.ga_newgame||session.state.gameaction===GA.ga_playdemo){session.step(this.input.command());if(!session.state.paused&&!session.state.demoplayback)this.paused=false;}}
                render();this.animation=requestAnimationFrame(frame);
            }catch(error){this.stop();this.onError(error);}
        };
        this.animation=requestAnimationFrame(frame);
    }
}
