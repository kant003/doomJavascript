import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
// A fresh process matters: importing the implementation first can conceal a
// circular enum initialization when a browser instead reaches the header first.
test('Intermission initializes with the header imported before its implementation',()=>{
 const result=spawnSync(process.execPath,['--import','tsx','--input-type=module','-e',`
   import assert from 'node:assert/strict';
   const header=await import('./src/linuxdoom-1.10/wi_stuff.h.ts');
   const wi=await import('./src/linuxdoom-1.10/wi_stuff.ts');
   assert.equal(header.stateenum_t.StatCount,0);
   assert.equal(typeof wi.WI_Start,'function');
   assert.equal(typeof wi.WI_Drawer,'function');
 `],{cwd:fileURLToPath(new URL('../',import.meta.url)),encoding:'utf8',timeout:10000});
 assert.ifError(result.error);assert.equal(result.status,0,result.stderr);
});
