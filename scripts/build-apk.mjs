// Costruisce l'APK dell'app Android senza Gradle: node scripts/build-apk.mjs [--install]
// Serve l'SDK Android (build-tools + una piattaforma) e Java 17. Se nel file .env c'è MYBANK_SERVER, l'indirizzo finisce nell'APK
// (android/build/, escluso da Git: non va mai nel codice); altrimenti l'app lo chiede alla prima apertura.
// Le pagine di public/ vengono incluse nell'APK (assets/www): la grafica dell'app è quella dell'APK, la logica quella del server.
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const android = path.join(root, 'android');
const build = path.join(android, 'build');
const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));

try { process.loadEnvFile(path.join(root, '.env')); } catch { /* .env facoltativo */ }
const server = (process.env.MYBANK_SERVER ?? '').trim().replace(/\/+$/, '');

// Posti dove di norma sta l'SDK: ~/Android/Sdk e, su Windows, %LOCALAPPDATA%/Android/Sdk (percorso di Android Studio).
const candidates = [path.join(os.homedir(), 'Android', 'Sdk'), ...(process.env.LOCALAPPDATA ? [path.join(process.env.LOCALAPPDATA, 'Android', 'Sdk')] : [])];
const sdk = process.env.ANDROID_HOME ?? process.env.ANDROID_SDK_ROOT ?? candidates.find((d) => fs.existsSync(path.join(d, 'build-tools'))) ?? candidates[0];
const newest = (dir) => fs.readdirSync(dir).sort((a, b) => a.localeCompare(b, undefined, { numeric: true })).at(-1);
const tools = path.join(sdk, 'build-tools', newest(path.join(sdk, 'build-tools')));
const androidJar = path.join(sdk, 'platforms', newest(path.join(sdk, 'platforms')), 'android.jar');
const exe = (n) => path.join(tools, process.platform === 'win32' ? `${n}.exe` : n);
const run = (cmd, args) => execFileSync(cmd, args, { stdio: ['ignore', 'inherit', 'inherit'] });

const [major, minor, patch] = pkg.version.split('.').map(Number);
const versionCode = major * 10000 + minor * 100 + patch;

fs.rmSync(build, { recursive: true, force: true });
for (const d of ['assets', 'classes', 'dex', 'gen']) fs.mkdirSync(path.join(build, d), { recursive: true });
fs.writeFileSync(path.join(build, 'assets', 'config.json'), JSON.stringify({ server, version: pkg.version }));
// Il frontend (pagine, script, stile, icona) sta nell'APK: l'app mostra sempre la grafica della sua versione; i dati e la logica restano sul server.
fs.cpSync(path.join(root, 'public'), path.join(build, 'assets', 'www'), { recursive: true });

// Risorse e manifest.
run(exe('aapt2'), ['compile', '--dir', path.join(android, 'res'), '-o', path.join(build, 'res.zip')]);
run(exe('aapt2'), [
  'link', '-o', path.join(build, 'base.apk'), '-I', androidJar, '--manifest', path.join(android, 'AndroidManifest.xml'),
  '--min-sdk-version', '29', '--target-sdk-version', '34', '--version-code', String(versionCode), '--version-name', pkg.version,
  '--java', path.join(build, 'gen'), path.join(build, 'res.zip'),
]);

// Codice Java → classi → dex.
const walk = (dir, ext, out = []) => {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, ext, out); else if (p.endsWith(ext)) out.push(p);
  }
  return out;
};
const sources = [...walk(path.join(android, 'src'), '.java'), path.join(build, 'gen', 'app', 'mybank', 'mobile', 'R.java')];
run('javac', ['--release', '8', '-Xlint:-options', '-encoding', 'UTF-8', '-classpath', androidJar, '-d', path.join(build, 'classes'), ...sources]);
run('java', ['-cp', path.join(tools, 'lib', 'd8.jar'), 'com.android.tools.r8.D8', '--min-api', '29', '--lib', androidJar, '--output', path.join(build, 'dex'), ...walk(path.join(build, 'classes'), '.class')]);
// Asset e dex si aggiungono con jar: aapt2 su Windows scriverebbe i percorsi degli asset con il backslash.
run('jar', ['uMf', path.join(build, 'base.apk'), '-C', path.join(build, 'dex'), 'classes.dex', '-C', build, 'assets']);

// Allineamento e firma (chiave di debug dell'SDK, creata se manca: serve sempre la stessa per aggiornare l'app installata).
const keystore = path.join(os.homedir(), '.android', 'debug.keystore');
if (!fs.existsSync(keystore)) {
  fs.mkdirSync(path.dirname(keystore), { recursive: true });
  run('keytool', ['-genkeypair', '-keystore', keystore, '-storepass', 'android', '-keypass', 'android', '-alias', 'androiddebugkey', '-keyalg', 'RSA', '-keysize', '2048', '-validity', '10000', '-dname', 'CN=Android Debug,O=Android,C=US']);
}
const aligned = path.join(build, 'aligned.apk');
const apk = path.join(build, `MyBank-${pkg.version}.apk`);
run(exe('zipalign'), ['-f', '-p', '4', path.join(build, 'base.apk'), aligned]);
run('java', ['-jar', path.join(tools, 'lib', 'apksigner.jar'), 'sign', '--ks', keystore, '--ks-pass', 'pass:android', '--key-pass', 'pass:android', '--out', apk, aligned]);
console.log(`APK pronto: ${path.relative(root, apk)} (${(fs.statSync(apk).size / 1024).toFixed(0)} KB)${server ? '' : ' · senza indirizzo del server: lo chiede all\'apertura'}`);

if (process.argv.includes('--install')) {
  const adb = path.join(sdk, 'platform-tools', process.platform === 'win32' ? 'adb.exe' : 'adb');
  const devices = execFileSync(adb, ['devices'], { encoding: 'utf8' }).split('\n').slice(1).map((l) => l.trim()).filter((l) => /\tdevice$/.test(l));
  if (!devices.length) throw new Error('Nessun telefono collegato (adb devices è vuoto): riattiva il debug wireless.');
  run(adb, ['-s', devices[0].split('\t')[0], 'install', '-r', apk]);
  console.log('Installato sul telefono.');
}
