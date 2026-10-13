/* Test oracle compiled from the untouched upstream implementation. */
#include <stdio.h>
#include <stdlib.h>
#include <stdint.h>
#include <stdarg.h>
#include <string.h>
#define rcsid m_fixed_rcsid
#include "../original/linuxdoom-1.10/m_fixed.c"
#undef rcsid
#define rcsid m_random_rcsid
#include "../original/linuxdoom-1.10/m_random.c"
#undef rcsid
#define rcsid m_bbox_rcsid
#include "../original/linuxdoom-1.10/m_bbox.c"
#undef rcsid
#define rcsid m_swap_rcsid
#include "../original/linuxdoom-1.10/m_swap.c"
#undef rcsid
#define rcsid tables_rcsid
#include "../original/linuxdoom-1.10/tables.c"
#undef rcsid
#define rcsid f_wipe_rcsid
#include "../original/linuxdoom-1.10/f_wipe.c"
#undef rcsid

byte *screens[5];
int dirtybox[4];
void I_Error(char *error, ...) { fprintf(stderr, "%s\n", error); exit(2); }
void *Z_Malloc(int size, int tag, void *ptr) { (void)tag; (void)ptr; return calloc(1, size); }
void Z_Free(void *ptr) { free(ptr); }
void I_ReadScreen(byte *dest) { memcpy(dest, screens[0], SCREENWIDTH*SCREENHEIGHT); }
void V_MarkRect(int x, int y, int w, int h) { (void)x; (void)y; (void)w; (void)h; }
void V_DrawBlock(int x, int y, int scrn, int w, int h, byte *src) {
    for (int row=0; row<h; row++) memcpy(screens[scrn]+(row+y)*SCREENWIDTH+x, src+row*w, w);
}
static uint32_t hash(const byte *data, int size) {
    uint32_t h=2166136261u;
    for(int i=0;i<size;i++) { h^=data[i]; h*=16777619u; }
    return h;
}
int main(int argc, char **argv) {
    if(argc < 2) return 1;
    if(!strcmp(argv[1], "fixed")) {
        int a,b;
        while(scanf("%d %d", &a, &b)==2) printf("%d %d\n", FixedMul(a,b), FixedDiv(a,b));
    } else if(!strcmp(argv[1], "random")) {
        M_ClearRandom(); for(int i=0;i<520;i++) printf("%d %d\n", M_Random(), P_Random());
    } else if(!strcmp(argv[1], "slope")) {
        unsigned a,b;
        while(scanf("%u %u", &a, &b)==2) printf("%d\n", SlopeDiv(a,b));
    } else if(!strcmp(argv[1], "bbox")) {
        fixed_t box[4]; int a,b; M_ClearBox(box);
        while(scanf("%d %d", &a, &b)==2) { M_AddToBox(box,a,b); printf("%d %d %d %d\n",box[0],box[1],box[2],box[3]); }
    } else if(!strcmp(argv[1], "wipe")) {
        for(int i=0;i<5;i++) screens[i]=calloc(SCREENWIDTH*SCREENHEIGHT,1);
        for(int i=0;i<SCREENWIDTH*SCREENHEIGHT;i++) screens[0][i]=(byte)(i*7);
        wipe_StartScreen(0,0,SCREENWIDTH,SCREENHEIGHT);
        for(int i=0;i<SCREENWIDTH*SCREENHEIGHT;i++) screens[0][i]=(byte)(i*17+3);
        wipe_EndScreen(0,0,SCREENWIDTH,SCREENHEIGHT);
        int type=argc>2?atoi(argv[2]):1;
        M_ClearRandom();
        for(int i=0;i<1000;i++) {
            int done=wipe_ScreenWipe(type,0,0,SCREENWIDTH,SCREENHEIGHT,1);
            printf("%u %d\n", hash(screens[0],SCREENWIDTH*SCREENHEIGHT),done);
            if(done) break;
        }
    } else return 1;
    return 0;
}
