// The storage key never changes: every build reads the same save. SAVE_VERSION
// counts changes to what a save holds; restore() upgrades older ones and keeps
// any fields it doesn't know (written by a newer build), so nothing is lost
// going forwards or back.
export const KEY='pocket-kitten-companion-v1';
export const SAVE_VERSION=2;
// How many Moments are kept (12 until phase 17).
export const JOURNAL_MAX=40;
const UNSAFE=new Set(['__proto__','constructor','prototype']);
export const clamp=v=>Math.max(0,Math.min(100,Number.isFinite(v)?v:0));
export function fresh(now=Date.now()){return {v:SAVE_VERSION,name:'Mochi',food:82,water:85,happiness:88,energy:78,cleanliness:92,bond:0,cuddles:0,sleeping:false,born:now,updated:now,sound:false,catVolume:.8,roomVolume:.4,music:'',musicVolume:.3,journal:[{text:'A little friendship begins.',icon:'♡',time:now}]};}
export function restore(raw,now=Date.now()){const d=fresh(now);if(!raw||typeof raw!=='object'||Array.isArray(raw))return d;for(const key of Object.keys(raw))if(!(key in d)&&!UNSAFE.has(key))d[key]=raw[key];for(const key of ['food','water','happiness','energy','cleanliness'])if(Number.isFinite(raw[key]))d[key]=clamp(raw[key]);for(const key of ['bond','cuddles'])if(Number.isFinite(raw[key]))d[key]=Math.max(0,raw[key]);if(typeof raw.name==='string'&&raw.name.trim())d.name=raw.name.trim().slice(0,24);d.sleeping=raw.sleeping===true;d.sound=raw.sound===true;if(typeof raw.music==='string'&&/^[a-z]{0,12}$/.test(raw.music))d.music=raw.music;for(const key of ['catVolume','roomVolume','musicVolume'])if(Number.isFinite(raw[key]))d[key]=Math.min(1,Math.max(0,raw[key]));if(Number.isFinite(raw.born)&&raw.born<=now)d.born=raw.born;if(Number.isFinite(raw.updated))d.updated=Math.min(now,raw.updated);if(Array.isArray(raw.journal))d.journal=raw.journal.filter(x=>x&&typeof x.text==='string'&&Number.isFinite(x.time)).slice(0,JOURNAL_MAX);d.v=Math.max(SAVE_VERSION,Number.isFinite(raw.v)?raw.v:0);return advance(d,now);}
// Stress-free care: needs ease down slowly, and time alone never takes any of
// them below FLOOR, so a forgotten kitten is a little hungry or sleepy and
// missing you, never in trouble. (Care actions can still move them freely.)
export const FLOOR=30;
const ease=(v,d)=>v>FLOOR?Math.max(FLOOR,v-d):v;
// How fast each need eases down, in points an hour (phase 17b: left overnight
// she is a little hungry and thirsty in the morning, left a whole day she is
// missing you too; before, nothing ever asked). Time away counts for a day
// at most.
const DROP={food:5.5,water:6,waterAsleep:2.5,happiness:3,happinessAsleep:1.5,cleanliness:1.5,energy:1.5};
const AWAY_MAX_HOURS=24;
export function advance(p,now=Date.now()){const hours=Math.max(0,Math.min(AWAY_MAX_HOURS,(now-p.updated)/3600000));p.food=clamp(ease(p.food,hours*DROP.food));p.water=clamp(ease(Number.isFinite(p.water)?p.water:85,hours*(p.sleeping?DROP.waterAsleep:DROP.water)));p.happiness=clamp(ease(p.happiness,hours*(p.sleeping?DROP.happinessAsleep:DROP.happiness)));p.cleanliness=clamp(ease(p.cleanliness,hours*DROP.cleanliness));p.energy=clamp(p.sleeping?p.energy+hours*120:ease(p.energy,hours*DROP.energy));p.updated=now;return p;}
// Friendship is earned over days (phase 17b). Each kind of care counts in
// full a few times a day (DAY_FULL), then a tenth, and the tenths stop at
// DAY_EXTRA more a day. She reacts to every touch as ever; only the number
// slows. The day turns at 4 in the morning by the phone's clock; a clock set
// backwards (by up to a day) does not start a second day; a day further off
// than that, either way, or one that is not a date, is dropped, so a save
// from a phone whose clock ran ahead is never left earning nothing. `p.day` = {key, n: times each care
// was given today, extra: tenths earned, wish, wishDone, last: yesterday's
// wish} (the wish: wish.js).
export const DAY_FULL={pet:10,brush:2,feed:3,drink:3,play:3};
export const DAY_EXTRA=5;
export const WORTH={feed:3,drink:1,play:6,brush:3,pet:1};
const two=n=>String(n).padStart(2,'0');
export function dayKey(now=Date.now()){const d=new Date(now-4*3600000);return `${d.getFullYear()}-${two(d.getMonth()+1)}-${two(d.getDate())}`;}
const tenth=v=>Math.round(v*10)/10;
export function today(p,now=Date.now()){const key=dayKey(now);let d=p.day;const ok=d&&typeof d==='object'&&!Array.isArray(d)&&typeof d.key==='string'&&/^\d{4}-\d\d-\d\d$/.test(d.key);if(!ok||d.key<key||d.key>dayKey(now+86400000))d=p.day={key,n:{},extra:0,...(ok&&typeof d.wish==='string'?{last:d.wish}:{})};if(!d.n||typeof d.n!=='object'||Array.isArray(d.n))d.n={};if(!(d.extra>=0))d.extra=0;return d;}
// Adds the friendship one care is worth today and returns what it added.
function earn(p,action,now=Date.now()){const worth=WORTH[action]||0,d=today(p,now),n=Number.isFinite(d.n[action])?d.n[action]:0;d.n[action]=n+1;let gain=worth;if(n>=(DAY_FULL[action]??0)){gain=tenth(Math.max(0,Math.min(worth/10,DAY_EXTRA-d.extra)));d.extra=tenth(d.extra+gain);}p.bond=tenth(p.bond+gain);return gain;}
// The main kinds of care (the ones nothing else holds back) have all counted
// in full today: "more tomorrow".
export function dayFull(p,now=Date.now()){const d=today(p,now);return ['pet','brush','play'].every(a=>(d.n[a]||0)>=DAY_FULL[a]);}
// `o.auto`: she did it by herself (a drink at her fountain): no friendship.
export function care(p,action,snack='kibble',o={}){const now=o.now??Date.now(),add=()=>{if(!o.auto)earn(p,action,now);};if(p.sleeping&&action!=='sleep')return {ok:false,message:'A little sleepy. Wake your kitten first.'};if(action==='feed'){if(p.food>94)return {ok:false,message:'That tummy is full. Save a snack for later.'};p.food=clamp(p.food+({kibble:24,salmon:30,chicken:27}[snack]??24));p.happiness=clamp(p.happiness+5);p.cleanliness=clamp(p.cleanliness-2);add();}else if(action==='drink'){if(p.water>94)return {ok:false,message:'Not thirsty right now.'};p.water=clamp(p.water+35);p.happiness=clamp(p.happiness+2);add();}else if(action==='play'){if(p.energy<15)return {ok:false,message:'A little rest first. Playtime can wait.'};p.happiness=clamp(p.happiness+18);p.energy=clamp(p.energy-10);p.food=clamp(p.food-3);add();}else if(action==='brush'){p.cleanliness=clamp(p.cleanliness+30);p.happiness=clamp(p.happiness+5);add();}else if(action==='pet'){p.happiness=clamp(p.happiness+3);p.cuddles++;add();}else if(action==='sleep'){p.sleeping=!p.sleeping;}else return {ok:false,message:'Unknown action'};return {ok:true};}
export function mood(p){if(p.sleeping)return 'Dreaming softly';if(p.food<40)return 'A little hungry';if(p.water<40)return 'A little thirsty';if(p.energy<35)return 'Ready for a nap';if(p.cleanliness<40)return 'Needs a little brush';if(p.happiness<45)return 'Missing you';return 'Feeling lovely';}
