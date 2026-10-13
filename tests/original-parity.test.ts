import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { FixedMul, FixedDiv } from '../src/linuxdoom-1.10/m_fixed';
import { M_ClearRandom, M_Random, P_Random } from '../src/linuxdoom-1.10/m_random';
import { SlopeDiv } from '../src/linuxdoom-1.10/tables';
import { M_ClearBox, M_AddToBox } from '../src/linuxdoom-1.10/m_bbox';
import { V_Init, screens } from '../src/linuxdoom-1.10/v_video';
import { wipe_StartScreen, wipe_EndScreen, wipe_ScreenWipe } from '../src/linuxdoom-1.10/f_wipe';
const hasClang = spawnSync('clang', ['--version']).status === 0;
let dir: string, binary: string;
before(() => {
    if (!hasClang) return;
    dir = mkdtempSync(join(tmpdir(), 'doom-parity-')); binary = join(dir, 'oracle');
    const result = spawnSync('clang', ['-std=c99', '-Wno-incompatible-pointer-types', '-I', resolve('tests/c-compat'), resolve('tests/original-oracle.c'), '-o', binary], { encoding: 'utf8' });
    assert.equal(result.status, 0, result.stderr);
});
after(() => { if (dir) rmSync(dir, { recursive: true, force: true }); });
function oracle(mode: string, input = '', extra: string[] = []): string {
    const result = spawnSync(binary, [mode, ...extra], { input, encoding: 'utf8', maxBuffer: 2_000_000 });
    assert.equal(result.status, 0, result.stderr); return result.stdout.trim();
}
// A repeatable set spanning the signed 32-bit range, not Math.random.
function pairs(): [number, number][] {
    const edges = [0, 1, -1, 65535, 65536, -65536, 1073741824, -1073741824, 2147483647, -2147483647];
    const values: [number, number][] = edges.flatMap(a => edges.map(b => [a, b] as [number, number]));
    let seed = 0x12345678;
    const next = (): number => { seed = (Math.imul(seed, 1664525) + 1013904223) | 0; return seed; };
    for (let i = 0; i < 1500; i++) values.push([next(), next()]);
    return values;
}
const options = { skip: hasClang ? false : 'clang is required for comparison with original C' };
test('FixedMul and FixedDiv match original C across 1600 signed pairs', options, () => {
    // abs(INT_MIN) is undefined in upstream C, so test it separately rather than invent a C oracle result.
    const values = pairs(), input = values.map(v => v.join(' ')).join('\n');
    assert.equal(values.map(([a,b]) => `${FixedMul(a,b)} ${FixedDiv(a,b)}`).join('\n'), oracle('fixed', input));
});
test('Both RNG streams match original C through two wraparounds', options, () => {
    M_ClearRandom();
    assert.equal(Array.from({ length: 520 }, () => `${M_Random()} ${P_Random()}`).join('\n'), oracle('random'));
});
test('SlopeDiv preserves unsigned overflow and cutoff in original C', options, () => {
    const values: [number, number][] = [[0, 0], [0, 511], [1, 512], [2048, 2048], [0xffffffff, 0xffffffff], ...pairs().map(([a,b]) => [a>>>0,b>>>0] as [number,number])];
    assert.equal(values.map(([a,b]) => SlopeDiv(a,b)).join('\n'), oracle('slope', values.map(v => v.join(' ')).join('\n')));
});
test('Bounding boxes preserve original comparison order', options, () => {
    const box = new Int32Array(4); M_ClearBox(box);
    const values = pairs();
    assert.equal(values.map(([x,y]) => { M_AddToBox(box,x,y); return [...box].join(' '); }).join('\n'), oracle('bbox', values.map(v => v.join(' ')).join('\n')));
});
function hash(bytes: Uint8Array): number {
    let h = 2166136261; for (const b of bytes) h = Math.imul(h ^ b, 16777619) >>> 0; return h;
}
for (const type of [0, 1]) test(`Wipe ${type} matches every original C frame until completion`, options, () => {
    V_Init();
    for (let i = 0; i < screens[0].length; i++) screens[0][i] = i * 7;
    wipe_StartScreen(0,0,320,200);
    for (let i = 0; i < screens[0].length; i++) screens[0][i] = i * 17 + 3;
    wipe_EndScreen(0,0,320,200); M_ClearRandom();
    const result: string[] = [];
    for (let i = 0; i < 1000; i++) {
        const done = wipe_ScreenWipe(type,0,0,320,200,1);
        result.push(`${hash(screens[0])} ${Number(done)}`); if (done) break;
    }
    assert.equal(result.join('\n'), oracle('wipe', '', [String(type)]));
});
