import { readdir, readFile, writeFile, stat } from 'node:fs/promises';
import { resolve, relative, join } from 'node:path';
import { createHash } from 'node:crypto';
const root = resolve(import.meta.dirname, '..');
const config = JSON.parse(await readFile(join(root, 'porting-status.json'), 'utf8'));
async function walk(dir) {
    const result = [];
    for (const entry of await readdir(dir, { withFileTypes: true })) {
        if (entry.name === '.git' || entry.name === 'CVS') continue;
        const path = join(dir, entry.name);
        if (entry.isDirectory()) result.push(...await walk(path));
        else if (/\.(c|h)$/i.test(entry.name)) result.push(path);
    }
    return result.sort();
}
const sourceFiles = await walk(join(root, 'original'));
const declared = new Set();
const entries = [];
for (const file of sourceFiles) {
    const source = relative(join(root, 'original'), file);
    const entry = config.modules[source];
    const target = 'src/' + source.replace(/\.c$/i, '.ts').replace(/\.h$/i, '.h.ts');
    if (entry) {
        if (!['translated', 'adapted', 'partial'].includes(entry.status)) throw new Error(`Invalid status: ${source}`);
        await stat(join(root, target)); declared.add(source);
    }
    const body = await readFile(file);
    entries.push({ source, target: entry ? target : null, plannedTarget: target, status: entry?.status ?? 'pending',
        notes: entry?.notes ?? '', lines: body.toString().split('\n').length - 1,
        sha256: createHash('sha256').update(body).digest('hex') });
}
for (const key of Object.keys(config.modules)) if (!declared.has(key)) throw new Error(`Unknown original: ${key}`);
const counts = Object.fromEntries(['translated','adapted','partial','pending'].map(status => [status, entries.filter(e=>e.status===status).length]));
const result = { upstream: config.upstream, commit: config.commit, completeEngine: false, counts, files: entries };
await writeFile(join(root, 'public/port-status.json'), JSON.stringify(result,null,2)+'\n');
const labels = { translated: 'Traducido', adapted: 'Adaptado a web', partial: 'Parcial', pending: 'Pendiente' };
const report = `# Estado de la conversión\n\nFuente: ${config.upstream}, commit \`${config.commit}\`.\n\n**El motor completo todavía no está convertido.** Este inventario registra ${entries.length} ficheros C/H del repositorio original, incluidos IPX, serie y el servidor de sonido. El estado es explícito; la existencia de un fichero no implica que el módulo esté terminado.\n\n${Object.entries(counts).map(([key,value])=>`${labels[key]}: **${value}**`).join(' · ')}\n\nEl conteo es por archivos, no un porcentaje de funcionalidad ni una prueba de equivalencia. Para regenerar: \`npm run inventory\`. SHA-256 de cada original en \`public/port-status.json\`.\n\n| Original | TypeScript | Estado | Observaciones |\n|---|---|---|---|\n` + entries.map(e=>`| \`${e.source}\` | ${e.target?'`'+e.target+'`':'—'} | ${labels[e.status]} | ${e.notes} |`).join('\n')+'\n';
await writeFile(join(root,'PORT_STATUS.md'), report);
console.log(`${entries.length} archivos originales: ${JSON.stringify(counts)}. Motor completo: pendiente.`);
