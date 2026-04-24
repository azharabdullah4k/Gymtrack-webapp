import { useState, useEffect, useRef, useCallback } from “react”;

const FONT_LINK = “https://fonts.googleapis.com/css2?family=Bebas+Neue&family=DM+Sans:wght@300;400;500;600&display=swap”;

const RANKS = [
{ name: “Rookie”,   minXP: 0,    color: “#94a3b8”, emoji: “🥋” },
{ name: “Iron”,     minXP: 100,  color: “#78716c”, emoji: “⚙️” },
{ name: “Bronze”,   minXP: 300,  color: “#cd7f32”, emoji: “🥉” },
{ name: “Silver”,   minXP: 600,  color: “#c0c0c0”, emoji: “🥈” },
{ name: “Gold”,     minXP: 1000, color: “#f59e0b”, emoji: “🥇” },
{ name: “Platinum”, minXP: 1500, color: “#22d3ee”, emoji: “💎” },
{ name: “Diamond”,  minXP: 2500, color: “#a78bfa”, emoji: “💠” },
];

const DEFAULT_EXERCISES = [
{ id: “pushup”,   name: “Push-ups”,     icon: “💪”, xp: 2, cal: 7,  custom: false },
{ id: “squat”,    name: “Squats”,        icon: “🦵”, xp: 2, cal: 8,  custom: false },
{ id: “pullup”,   name: “Pull-ups”,      icon: “🏋️”, xp: 3, cal: 9,  custom: false },
{ id: “situp”,    name: “Sit-ups”,       icon: “🔥”, xp: 1, cal: 5,  custom: false },
{ id: “burpee”,   name: “Burpees”,       icon: “⚡”, xp: 4, cal: 12, custom: false },
{ id: “lunge”,    name: “Lunges”,        icon: “🚶”, xp: 2, cal: 7,  custom: false },
{ id: “plank”,    name: “Plank (secs)”,  icon: “🧱”, xp: 1, cal: 3,  custom: false },
{ id: “jumpjack”, name: “Jumping Jacks”, icon: “🤸”, xp: 1, cal: 4,  custom: false },
];

const MEAL_PRESETS = [
{ name: “Rice + Chicken”, cal: 520 },
{ name: “Eggs (3) + Toast”, cal: 380 },
{ name: “Dal Chawal”, cal: 450 },
{ name: “Roti + Sabzi”, cal: 340 },
{ name: “Oatmeal Bowl”, cal: 310 },
{ name: “Fruit Bowl”, cal: 180 },
{ name: “Protein Shake”, cal: 250 },
{ name: “Paratha + Yogurt”, cal: 480 },
];

const NOTIF_HOURS = [8, 13, 19];
const WATER_GOAL = 8; // glasses

function todayStr() { return new Date().toISOString().split(“T”)[0]; }
function yesterdayStr() { const d = new Date(); d.setDate(d.getDate() - 1); return d.toISOString().split(“T”)[0]; }
function getRank(xp) { return […RANKS].reverse().find(r => xp >= r.minXP) || RANKS[0]; }
function getNextRank(xp) { return RANKS.find(r => r.minXP > xp) || null; }
function msUntilHour(h) {
const now = new Date(), t = new Date();
t.setHours(h, 0, 0, 0);
if (t <= now) t.setDate(t.getDate() + 1);
return t - now;
}
function getWeekDates() {
return Array.from({ length: 7 }, (*, i) => {
const d = new Date(); d.setDate(d.getDate() - (6 - i));
return d.toISOString().split(“T”)[0];
});
}
function getLast14() {
return Array.from({ length: 14 }, (*, i) => {
const d = new Date(); d.setDate(d.getDate() - (13 - i));
return d.toISOString().split(“T”)[0];
});
}

async function sGet(k) {
try { const r = await window.storage.get(k); return r ? JSON.parse(r.value) : null; } catch { return null; }
}
async function sSet(k, v) { try { await window.storage.set(k, JSON.stringify(v)); } catch {} }

// Confetti burst
function spawnConfetti(container) {
if (!container) return;
const colors = [”#f59e0b”,”#10b981”,”#818cf8”,”#ef4444”,”#22d3ee”,”#a78bfa”];
for (let i = 0; i < 48; i++) {
const el = document.createElement(“div”);
const color = colors[Math.floor(Math.random() * colors.length)];
const size = 6 + Math.random() * 7;
el.style.cssText = `position:absolute;width:${size}px;height:${size}px;background:${color};border-radius:${Math.random()>0.5?"50%":"2px"};pointer-events:none;z-index:999;left:${20+Math.random()*60}%;top:40%;`;
container.appendChild(el);
const angle = (Math.random() - 0.5) * 360;
const dist = 60 + Math.random() * 120;
const dur = 600 + Math.random() * 600;
el.animate([
{ transform: “translate(0,0) rotate(0deg)”, opacity: 1 },
{ transform: `translate(${Math.cos(angle)*dist}px,${Math.sin(angle)*dist - 80}px) rotate(${angle*2}deg)`, opacity: 0 }
], { duration: dur, easing: “ease-out”, fill: “forwards” });
setTimeout(() => el.remove(), dur + 50);
}
}

// ── App ────────────────────────────────────────────────────────────────────────
export default function App() {
const [screen, setScreen] = useState(“home”);
const [loaded, setLoaded] = useState(false);
const [darkMode, setDarkMode] = useState(true);

// Global
const [xp, setXp] = useState(0);
const [streak, setStreak] = useState(0);
const [goal, setGoal] = useState(null);
const [exercises, setExercises] = useState(DEFAULT_EXERCISES);
const [weightLog, setWeightLog] = useState([]); // [{ date, kg }]

// Today
const [sets, setSets] = useState({}); // { exId: [{reps, done}] }
const [mealLog, setMealLog] = useState([]);
const [caloriesEaten, setCalEaten] = useState(0);
const [caloriesBurned, setCalBurned] = useState(0);
const [workoutDoneToday, setWorkoutDoneToday] = useState(false);
const [isRestDay, setIsRestDay] = useState(false);
const [waterGlasses, setWaterGlasses] = useState(0);
const [history, setHistory] = useState({});

// UI
const [toast, setToast] = useState(null);
const [notifOn, setNotifOn] = useState(false);
const [mealInput, setMealInput] = useState({ name: “”, cal: “” });
const [setupDraft, setSetupDraft] = useState({ calGoal: 2000, workoutGoal: 50, days: 30, waterGoal: 8 });
const [expandedEx, setExpandedEx] = useState(null);
const [showAddEx, setShowAddEx] = useState(false);
const [newEx, setNewEx] = useState({ name: “”, icon: “🏃”, xp: 2, cal: 6 });
const [showWeightInput, setShowWeightInput] = useState(false);
const [weightInput, setWeightInput] = useState(””);
const [confettiTarget, setConfettiTarget] = useState(null);
const [prevGoalsMet, setPrevGoalsMet] = useState({ workout: false, cal: false, water: false });

const notifTimers = useRef([]);
const notifStateRef = useRef({});
const confettiRef = useRef(null);
const today = todayStr();
const yesterday = yesterdayStr();

useEffect(() => {
notifStateRef.current = {
caloriesEaten, workoutDoneToday, isRestDay,
calGoal: goal?.calGoal || 2000,
waterGlasses, waterGoal: goal?.waterGoal || WATER_GOAL
};
}, [caloriesEaten, workoutDoneToday, isRestDay, goal, waterGlasses]);

// ── Load ───────────────────────────────────────────────────────────────────
useEffect(() => {
const link = document.createElement(“link”);
link.rel = “stylesheet”; link.href = FONT_LINK;
document.head.appendChild(link);
(async () => {
const g = await sGet(“global”) || { xp: 0, streak: 0, lastWorkoutDay: “” };
const savedGoal = await sGet(“goal”);
const savedExercises = await sGet(“exercises”);
const day = await sGet(`day:${today}`) || {};
const hist = await sGet(“history”) || {};
const wlog = await sGet(“weightLog”) || [];
const dm = await sGet(“darkMode”);

```
  let computedStreak = g.streak;
  if (g.lastWorkoutDay && g.lastWorkoutDay !== today && g.lastWorkoutDay !== yesterday) {
    // Check if yesterday was rest day before resetting
    const yest = await sGet(`day:${yesterday}`) || {};
    if (!yest.isRestDay) {
      computedStreak = 0;
      await sSet("global", { ...g, streak: 0 });
    }
  }

  setXp(g.xp); setStreak(computedStreak); setGoal(savedGoal);
  if (savedExercises) setExercises(savedExercises);
  setSets(day.sets || {});
  setMealLog(day.mealLog || []);
  setCalEaten(day.caloriesEaten || 0);
  setCalBurned(day.caloriesBurned || 0);
  setWorkoutDoneToday(day.workoutDone || false);
  setIsRestDay(day.isRestDay || false);
  setWaterGlasses(day.waterGlasses || 0);
  setHistory(hist);
  setWeightLog(wlog);
  if (dm !== null) setDarkMode(dm !== false);
  if (savedGoal) setSetupDraft({ calGoal: savedGoal.calGoal, workoutGoal: savedGoal.workoutGoal, days: savedGoal.days, waterGoal: savedGoal.waterGoal || WATER_GOAL });
  setLoaded(true);
  if (!savedGoal) setScreen("setup");
})();
```

}, []);

// ── Confetti trigger when goals hit ───────────────────────────────────────
useEffect(() => {
if (!loaded) return;
const calGoal = goal?.calGoal || 2000;
const wGoal = goal?.waterGoal || WATER_GOAL;
const workoutGoalReps = goal?.workoutGoal || 50;
const totalReps = Object.values(sets).reduce((a, exSets) => a + exSets.reduce((b, s) => b + (s.done ? s.reps : 0), 0), 0);
const wMet = totalReps >= workoutGoalReps && !isRestDay;
const cMet = caloriesEaten >= calGoal;
const waMet = waterGlasses >= wGoal;
if ((wMet && !prevGoalsMet.workout) || (cMet && !prevGoalsMet.cal) || (waMet && !prevGoalsMet.water)) {
spawnConfetti(confettiRef.current);
showToast(wMet && !prevGoalsMet.workout ? “🎉 Workout goal reached!” : cMet && !prevGoalsMet.cal ? “🎉 Calorie goal reached!” : “🎉 Hydration goal reached!”);
}
setPrevGoalsMet({ workout: wMet, cal: cMet, water: waMet });
}, [sets, caloriesEaten, waterGlasses]);

// ── Persist helpers ────────────────────────────────────────────────────────
async function saveGlobal(newXp, newStreak, lastDay) {
await sSet(“global”, { xp: newXp, streak: newStreak, lastWorkoutDay: lastDay });
}
async function saveDay(patch) {
const prev = await sGet(`day:${today}`) || {};
const merged = { …prev, …patch };
await sSet(`day:${today}`, merged);
const hist = await sGet(“history”) || {};
const cg = goal?.calGoal || 2000;
const wg = goal?.waterGoal || WATER_GOAL;
const totalReps = Object.values(merged.sets || {}).reduce((a, exSets) => a + exSets.reduce((b, s) => b + (s.done ? s.reps : 0), 0), 0);
hist[today] = {
workoutDone: merged.workoutDone || false,
isRestDay: merged.isRestDay || false,
calGoalMet: (merged.caloriesEaten || 0) >= cg,
waterGoalMet: (merged.waterGlasses || 0) >= wg,
totalReps,
caloriesEaten: merged.caloriesEaten || 0,
};
setHistory({ …hist });
await sSet(“history”, hist);
}

// ── Goal ───────────────────────────────────────────────────────────────────
async function saveGoal() {
const existing = await sGet(“goal”);
const g = { …setupDraft, startDate: existing?.startDate || today };
setGoal(g); await sSet(“goal”, g);
showToast(“✅ Goal saved!”); setScreen(“home”);
}

// ── Sets / Workout ─────────────────────────────────────────────────────────
function getExSets(exId) { return sets[exId] || []; }

async function addSet(ex) {
const exSets = getExSets(ex.id);
const newSet = { reps: 10, done: false };
const newSets = { …sets, [ex.id]: […exSets, newSet] };
setSets(newSets);
await saveDay({ sets: newSets });
}

async function toggleSet(ex, idx) {
const exSets = […getExSets(ex.id)];
const wasDone = exSets[idx].done;
exSets[idx] = { …exSets[idx], done: !wasDone };
const newSets = { …sets, [ex.id]: exSets };
const reps = exSets[idx].reps;
const newBurned = wasDone ? Math.max(0, caloriesBurned - ex.cal * reps) : caloriesBurned + ex.cal * reps;
const newXp = wasDone ? Math.max(0, xp - ex.xp * reps) : xp + ex.xp * reps;
const prevRank = getRank(xp); const newRank = getRank(newXp);
setSets(newSets); setCalBurned(newBurned); setXp(newXp);
if (newRank.name !== prevRank.name && !wasDone) showToast(`🎉 Rank Up! ${newRank.emoji} ${newRank.name}`);
let newStreak = streak;
if (!workoutDoneToday && !wasDone) { setWorkoutDoneToday(true); newStreak = streak + 1; setStreak(newStreak); }
await saveGlobal(newXp, newStreak, today);
await saveDay({ sets: newSets, caloriesBurned: newBurned, workoutDone: true });
}

async function updateSetReps(exId, idx, val) {
const exSets = […getExSets(exId)];
const reps = Math.max(1, Number(val) || 1);
exSets[idx] = { …exSets[idx], reps };
const newSets = { …sets, [exId]: exSets };
setSets(newSets);
await saveDay({ sets: newSets });
}

async function removeSet(ex, idx) {
const exSets = […getExSets(ex.id)];
const s = exSets[idx];
if (s.done) {
const newBurned = Math.max(0, caloriesBurned - ex.cal * s.reps);
const newXp = Math.max(0, xp - ex.xp * s.reps);
setCalBurned(newBurned); setXp(newXp);
await saveGlobal(newXp, streak, workoutDoneToday ? today : “”);
}
exSets.splice(idx, 1);
const newSets = { …sets, [ex.id]: exSets };
setSets(newSets);
await saveDay({ sets: newSets });
}

async function toggleRestDay() {
const next = !isRestDay;
setIsRestDay(next);
if (next) showToast(“😴 Rest day marked”);
else showToast(“💪 Back to training!”);
await saveDay({ isRestDay: next });
}

// ── Custom exercises ───────────────────────────────────────────────────────
async function addCustomExercise() {
if (!newEx.name.trim()) return;
const ex = { …newEx, id: `custom_${Date.now()}`, custom: true };
const updated = […exercises, ex];
setExercises(updated);
await sSet(“exercises”, updated);
setNewEx({ name: “”, icon: “🏃”, xp: 2, cal: 6 });
setShowAddEx(false);
showToast(`✅ ${ex.name} added`);
}
async function removeCustomExercise(id) {
const updated = exercises.filter(e => e.id !== id);
setExercises(updated);
await sSet(“exercises”, updated);
}

// ── Meals ──────────────────────────────────────────────────────────────────
async function logMeal(name, cal) {
const entry = { id: Date.now(), name, cal: Number(cal), t: new Date().toLocaleTimeString([], { hour: “2-digit”, minute: “2-digit” }) };
const newLog = […mealLog, entry];
const newEaten = caloriesEaten + Number(cal);
setMealLog(newLog); setCalEaten(newEaten);
await saveDay({ mealLog: newLog, caloriesEaten: newEaten });
showToast(`🍽 ${name} logged`);
}
async function deleteMeal(id) {
const entry = mealLog.find(m => m.id === id);
if (!entry) return;
const newLog = mealLog.filter(m => m.id !== id);
const newEaten = Math.max(0, caloriesEaten - entry.cal);
setMealLog(newLog); setCalEaten(newEaten);
await saveDay({ mealLog: newLog, caloriesEaten: newEaten });
showToast(`🗑 Removed ${entry.name}`);
}

// ── Water ──────────────────────────────────────────────────────────────────
async function addWater(n) {
const wg = goal?.waterGoal || WATER_GOAL;
const next = Math.min(wg + 2, Math.max(0, waterGlasses + n));
setWaterGlasses(next);
await saveDay({ waterGlasses: next });
}

// ── Weight log ─────────────────────────────────────────────────────────────
async function logWeight() {
const kg = parseFloat(weightInput);
if (!kg || kg < 20 || kg > 300) { showToast(“Enter a valid weight”); return; }
const entry = { date: today, kg };
const existing = weightLog.filter(w => w.date !== today);
const updated = […existing, entry].sort((a, b) => a.date.localeCompare(b.date));
setWeightLog(updated); await sSet(“weightLog”, updated);
setWeightInput(””); setShowWeightInput(false);
showToast(`⚖️ ${kg} kg logged`);
}

// ── Notifications ──────────────────────────────────────────────────────────
function clearNotifTimers() { notifTimers.current.forEach(clearTimeout); notifTimers.current = []; }
function scheduleHour(h) {
const t = setTimeout(() => { fireNotif(); scheduleHour(h); }, msUntilHour(h));
notifTimers.current.push(t);
}
function fireNotif() {
if (Notification.permission !== “granted”) return;
const { caloriesEaten, calGoal, workoutDoneToday, isRestDay, waterGlasses, waterGoal } = notifStateRef.current;
const calLeft = calGoal - caloriesEaten;
const wLeft = waterGoal - waterGlasses;
const parts = [];
if (isRestDay) parts.push(“Rest day 😴”);
else parts.push(workoutDoneToday ? “Workout ✅” : “Workout pending ⚡”);
parts.push(calLeft > 0 ? `${calLeft} kcal left` : “Calories ✅”);
parts.push(wLeft > 0 ? `${wLeft} glasses water left` : “Hydrated ✅”);
new Notification(“GymTrack 💪”, { body: parts.join(” · “) });
}
async function toggleNotif() {
if (notifOn) { clearNotifTimers(); setNotifOn(false); showToast(“🔕 Reminders off”); return; }
if (!(“Notification” in window)) { showToast(“Not supported”); return; }
const p = await Notification.requestPermission();
if (p !== “granted”) { showToast(“Permission denied”); return; }
setNotifOn(true);
NOTIF_HOURS.forEach(h => scheduleHour(h));
fireNotif();
showToast(“🔔 Set for 8am, 1pm & 7pm”);
}

// ── Dark mode ──────────────────────────────────────────────────────────────
async function toggleDark() {
const next = !darkMode; setDarkMode(next); await sSet(“darkMode”, next);
}

// ── Export CSV ─────────────────────────────────────────────────────────────
function exportCSV() {
const rows = [[“Date”,“WorkoutDone”,“RestDay”,“CaloriesEaten”,“CalGoalMet”,“WaterGlasses”,“WaterGoalMet”,“TotalReps”]];
Object.entries(history).sort().forEach(([d, h]) => {
rows.push([d, h.workoutDone, h.isRestDay||false, h.caloriesEaten, h.calGoalMet, h.waterGoalMet||0, h.waterGoalMet, h.totalReps]);
});
const csv = rows.map(r => r.join(”,”)).join(”\n”);
const blob = new Blob([csv], { type: “text/csv” });
const a = document.createElement(“a”);
a.href = URL.createObjectURL(blob); a.download = “gymtrack_history.csv”; a.click();
showToast(“📥 CSV downloaded”);
}

// ── Derived ────────────────────────────────────────────────────────────────
const rank = getRank(xp);
const nextRank = getNextRank(xp);
const xpProgress = nextRank ? ((xp - rank.minXP) / (nextRank.minXP - rank.minXP)) * 100 : 100;
const calGoal = goal?.calGoal || 2000;
const waterGoal = goal?.waterGoal || WATER_GOAL;
const workoutGoalReps = goal?.workoutGoal || 50;
const totalReps = Object.values(sets).reduce((a, exSets) => a + exSets.reduce((b, s) => b + (s.done ? s.reps : 0), 0), 0);
const totalSets = Object.values(sets).reduce((a, exSets) => a + exSets.filter(s => s.done).length, 0);
const workoutPct = isRestDay ? 100 : Math.min((totalReps / workoutGoalReps) * 100, 100);
const calPct = Math.min((caloriesEaten / calGoal) * 100, 100);
const waterPct = Math.min((waterGlasses / waterGoal) * 100, 100);
const netCal = caloriesEaten - caloriesBurned;
const goalDays = goal?.days || 30;
const daysSinceStart = goal?.startDate ? Math.max(1, Math.floor((new Date(today) - new Date(goal.startDate)) / 86400000) + 1) : 1;

// Weekly summary
const weekDates = getWeekDates();
const weekStats = weekDates.reduce((acc, d) => {
const h = history[d] || {};
return {
reps: acc.reps + (h.totalReps || 0),
cal: acc.cal + (h.caloriesEaten || 0),
daysHit: acc.daysHit + (h.workoutDone || h.isRestDay ? 1 : 0),
bothDone: acc.bothDone + (h.workoutDone && h.calGoalMet ? 1 : 0),
};
}, { reps: 0, cal: 0, daysHit: 0, bothDone: 0 });

const theme = darkMode ? DK : LT;

function showToast(msg) { setToast(msg); setTimeout(() => setToast(null), 3000); }

if (!loaded) return (
<div style={{ background: “#0c0c10”, height: “100vh”, display: “flex”, alignItems: “center”, justifyContent: “center”, color: “#64748b”, fontFamily: “DM Sans, sans-serif”, fontSize: 12, letterSpacing: 2 }}>LOADING…</div>
);

// ── SETUP ──────────────────────────────────────────────────────────────────
if (screen === “setup”) return (
<div style={{ …C.page, background: theme.bg, color: theme.text }}>
<style>{GS}</style>
<div style={{ padding: 20 }}>
<div style={{ paddingTop: 24, paddingBottom: 24 }}>
<div style={{ fontFamily: “Bebas Neue, sans-serif”, fontSize: 44, lineHeight: 1.1, letterSpacing: 2 }}>
SET YOUR<br /><span style={{ color: “#f59e0b” }}>GOAL</span>
</div>
<p style={{ fontSize: 13, color: theme.muted, marginTop: 8 }}>
{goal ? “Editing won’t reset your timeline.” : “Configure your plan to get started.”}
</p>
</div>
<div style={{ background: theme.card, border: `1px solid ${theme.border}`, borderRadius: 16, padding: 20, marginBottom: 20 }}>
<SliderField label=“Daily Calorie Goal” value={setupDraft.calGoal} min={1000} max={4000} step={50} unit=“kcal” theme={theme} onChange={v => setSetupDraft(p => ({ …p, calGoal: v }))} />
<SliderField label=“Daily Rep Goal” value={setupDraft.workoutGoal} min={10} max={300} step={5} unit=“reps” theme={theme} onChange={v => setSetupDraft(p => ({ …p, workoutGoal: v }))} style={{ marginTop: 22 }} />
<SliderField label=“Daily Water Goal” value={setupDraft.waterGoal} min={4} max={16} step={1} unit=“glasses” theme={theme} onChange={v => setSetupDraft(p => ({ …p, waterGoal: v }))} style={{ marginTop: 22 }} />
<div style={{ marginTop: 22 }}>
<span style={{ fontSize: 11, color: theme.muted, letterSpacing: 1, fontWeight: 600 }}>Program Duration</span>
<div style={{ display: “flex”, gap: 8, flexWrap: “wrap”, marginTop: 10 }}>
{[7, 14, 21, 30, 60, 90].map(d => (
<button key={d} style={{ background: setupDraft.days === d ? “#f59e0b20” : theme.card2, border: `1px solid ${setupDraft.days === d ? "#f59e0b60" : theme.border}`, color: setupDraft.days === d ? “#f59e0b” : theme.muted, borderRadius: 8, padding: “6px 14px”, fontSize: 13, cursor: “pointer”, fontFamily: “DM Sans, sans-serif” }}
onClick={() => setSetupDraft(p => ({ …p, days: d }))}>{d}d</button>
))}
</div>
</div>
</div>
<button style={C.primaryBtn} onClick={saveGoal}>{goal ? “Save Changes” : “Start Program →”}</button>
{goal && <button style={{ …C.ghostBtn, color: theme.muted, borderColor: theme.border }} onClick={() => setScreen(“home”)}>← Cancel</button>}
</div>
</div>
);

// ── MAIN ───────────────────────────────────────────────────────────────────
return (
<div style={{ …C.page, background: theme.bg, color: theme.text }} ref={confettiRef}>
<style>{GS}</style>
<div style={{ …C.titleBar, background: theme.bg, borderColor: theme.border }}>
<span style={{ fontFamily: “Bebas Neue, sans-serif”, fontSize: 22, letterSpacing: 3, color: theme.text }}>GYM<span style={{ color: “#f59e0b” }}>TRACK</span></span>
<div style={{ display: “flex”, gap: 10, alignItems: “center” }}>
<span style={{ fontSize: 11, color: rank.color, fontWeight: 600 }}>{rank.emoji} {rank.name}</span>
<button onClick={toggleDark} style={{ background: “none”, border: `1px solid ${theme.border}`, borderRadius: 6, padding: “3px 8px”, cursor: “pointer”, fontSize: 14, color: theme.muted }}>
{darkMode ? “☀️” : “🌙”}
</button>
</div>
</div>

```
  {screen === "home" && <HomeScreen rank={rank} nextRank={nextRank} xpProgress={xpProgress} streak={streak}
    workoutPct={workoutPct} totalReps={totalReps} totalSets={totalSets} workoutGoalReps={workoutGoalReps}
    calPct={calPct} caloriesEaten={caloriesEaten} calGoal={calGoal}
    waterPct={waterPct} waterGlasses={waterGlasses} waterGoal={waterGoal}
    isRestDay={isRestDay} toggleRestDay={toggleRestDay}
    daysSinceStart={daysSinceStart} goalDays={goalDays}
    notifOn={notifOn} toggleNotif={toggleNotif}
    weekStats={weekStats}
    setScreen={setScreen} theme={theme} workoutDoneToday={workoutDoneToday} xp={xp} />}

  {screen === "workout" && <WorkoutScreen exercises={exercises} sets={sets}
    totalReps={totalReps} totalSets={totalSets} workoutGoalReps={workoutGoalReps}
    workoutPct={workoutPct} caloriesBurned={caloriesBurned} isRestDay={isRestDay}
    expandedEx={expandedEx} setExpandedEx={setExpandedEx}
    addSet={addSet} toggleSet={toggleSet} updateSetReps={updateSetReps} removeSet={removeSet}
    showAddEx={showAddEx} setShowAddEx={setShowAddEx}
    newEx={newEx} setNewEx={setNewEx} addCustomExercise={addCustomExercise} removeCustomExercise={removeCustomExercise}
    setScreen={setScreen} theme={theme} />}

  {screen === "calories" && <CaloriesScreen caloriesEaten={caloriesEaten} caloriesBurned={caloriesBurned}
    netCal={netCal} calGoal={calGoal} calPct={calPct}
    waterGlasses={waterGlasses} waterGoal={waterGoal} waterPct={waterPct} addWater={addWater}
    mealLog={mealLog} mealInput={mealInput} setMealInput={setMealInput}
    logMeal={logMeal} deleteMeal={deleteMeal} setScreen={setScreen} theme={theme} />}

  {screen === "progress" && <ProgressScreen xp={xp} streak={streak} totalReps={totalReps}
    caloriesEaten={caloriesEaten} caloriesBurned={caloriesBurned} netCal={netCal}
    daysSinceStart={daysSinceStart} goalDays={goalDays}
    history={history} today={today} weekStats={weekStats}
    weightLog={weightLog} showWeightInput={showWeightInput} setShowWeightInput={setShowWeightInput}
    weightInput={weightInput} setWeightInput={setWeightInput} logWeight={logWeight}
    exportCSV={exportCSV} setScreen={setScreen} theme={theme} />}

  {toast && <div style={C.toast}>{toast}</div>}
</div>
```

);
}

// ── HOME ───────────────────────────────────────────────────────────────────────
function HomeScreen({ rank, nextRank, xpProgress, streak, workoutPct, totalReps, totalSets,
workoutGoalReps, calPct, caloriesEaten, calGoal, waterPct, waterGlasses, waterGoal,
isRestDay, toggleRestDay, daysSinceStart, goalDays, notifOn, toggleNotif,
weekStats, setScreen, theme, workoutDoneToday, xp }) {
return (
<div>
{/* Hero */}
<div style={{ margin: 16, background: theme.hero, border: `1px solid ${theme.border}`, borderRadius: 16, padding: 20 }}>
<div style={{ display: “flex”, justifyContent: “space-between”, alignItems: “flex-start” }}>
<div>
<div style={{ fontSize: 28, lineHeight: 1, marginBottom: 4 }}>{rank.emoji}</div>
<div style={{ fontFamily: “Bebas Neue, sans-serif”, fontSize: 28, color: rank.color, letterSpacing: 2, lineHeight: 1 }}>{rank.name}</div>
<div style={{ fontSize: 11, color: theme.muted, marginTop: 4 }}>
{nextRank ? `${nextRank.minXP - xp} XP to ${nextRank.name}` : “Max Rank!”}
</div>
</div>
<div style={{ textAlign: “right” }}>
<div style={{ fontFamily: “Bebas Neue, sans-serif”, fontSize: 38, color: “#f59e0b”, lineHeight: 1 }}>{streak}</div>
<div style={{ fontSize: 10, color: theme.muted, letterSpacing: 1 }}>STREAK 🔥</div>
</div>
</div>
<div style={{ height: 4, background: theme.track, borderRadius: 2, marginTop: 16, overflow: “hidden” }}>
<div style={{ height: “100%”, width: `${xpProgress}%`, background: `linear-gradient(90deg,${rank.color}77,${rank.color})`, borderRadius: 2, transition: “width 0.5s” }} />
</div>
</div>

```
  {/* 3 rings */}
  <div style={{ display: "flex", gap: 8, padding: "0 16px 4px" }}>
    <RingCard label="Workout" pct={workoutPct} val={isRestDay ? "Rest" : `${totalReps}r ${totalSets}s`} color="#f59e0b" done={workoutPct >= 100} theme={theme} size={56} />
    <RingCard label="Calories" pct={calPct} val={`${caloriesEaten}/${calGoal}`} color="#10b981" done={calPct >= 100} theme={theme} size={56} />
    <RingCard label="Water" pct={waterPct} val={`${waterGlasses}/${waterGoal}g`} color="#22d3ee" done={waterPct >= 100} theme={theme} size={56} />
  </div>

  {/* Weekly summary */}
  <div style={{ margin: "10px 16px 0", background: theme.card, border: `1px solid ${theme.border}`, borderRadius: 12, padding: "12px 16px" }}>
    <div style={{ fontSize: 10, letterSpacing: 2, color: theme.muted, marginBottom: 10, fontWeight: 600 }}>THIS WEEK</div>
    <div style={{ display: "flex", justifyContent: "space-between" }}>
      {[["📅", weekStats.daysHit + "/7", "days hit"], ["💪", weekStats.reps, "total reps"], ["🔥", Math.round(weekStats.cal / 7), "avg kcal"], ["✅", weekStats.bothDone, "full days"]].map(([ic, v, lb]) => (
        <div key={lb} style={{ textAlign: "center" }}>
          <div style={{ fontSize: 11 }}>{ic}</div>
          <div style={{ fontFamily: "Bebas Neue, sans-serif", fontSize: 18, color: "#f59e0b" }}>{v}</div>
          <div style={{ fontSize: 9, color: theme.muted }}>{lb}</div>
        </div>
      ))}
    </div>
  </div>

  {/* Quick actions */}
  <div style={{ padding: "12px 16px 8px" }}>
    <div style={{ fontSize: 10, letterSpacing: 2, color: theme.muted2, marginBottom: 10, fontWeight: 600 }}>TODAY</div>
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
      <QuickBtn icon="💪" label="Workout" sub={isRestDay ? "Rest day 😴" : workoutDoneToday ? "Done ✅" : `${Math.max(0, workoutGoalReps - totalReps)} reps left`} onClick={() => setScreen("workout")} color="#f59e0b" theme={theme} />
      <QuickBtn icon="🥗" label="Calories" sub={calGoal - caloriesEaten > 0 ? `${calGoal - caloriesEaten} kcal left` : "Goal met! 🎉"} onClick={() => setScreen("calories")} color="#10b981" theme={theme} />
      <QuickBtn icon="📈" label="Progress" sub={`Day ${daysSinceStart}/${goalDays}`} onClick={() => setScreen("progress")} color="#818cf8" theme={theme} />
      <QuickBtn icon="⚙️" label="Edit Goal" sub="Adjust plan" onClick={() => setScreen("setup")} color="#94a3b8" theme={theme} />
    </div>
  </div>

  {/* Rest day + notif */}
  <div style={{ padding: "4px 16px 20px", display: "flex", flexDirection: "column", gap: 8 }}>
    <button style={{ display: "flex", alignItems: "center", gap: 12, width: "100%", background: isRestDay ? "#818cf820" : theme.card, border: `1px solid ${isRestDay ? "#818cf840" : theme.border}`, borderRadius: 12, padding: "12px 16px", cursor: "pointer", fontFamily: "DM Sans, sans-serif", color: theme.text, textAlign: "left" }}
      onClick={toggleRestDay}>
      <span style={{ fontSize: 20 }}>{isRestDay ? "😴" : "🔄"}</span>
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 13, fontWeight: 600 }}>{isRestDay ? "Rest Day Active" : "Mark as Rest Day"}</div>
        <div style={{ fontSize: 11, color: theme.muted }}>Streak won't break on rest days</div>
      </div>
      <span style={{ fontSize: 11, color: isRestDay ? "#818cf8" : theme.muted2, fontWeight: 700 }}>{isRestDay ? "ON" : "OFF"}</span>
    </button>
    <button style={{ display: "flex", alignItems: "center", gap: 12, width: "100%", background: notifOn ? "#f59e0b08" : theme.card, border: `1px solid ${notifOn ? "#f59e0b40" : theme.border}`, borderRadius: 12, padding: "12px 16px", cursor: "pointer", fontFamily: "DM Sans, sans-serif", color: theme.text, textAlign: "left" }}
      onClick={toggleNotif}>
      <span style={{ fontSize: 20 }}>{notifOn ? "🔔" : "🔕"}</span>
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 13, fontWeight: 600 }}>{notifOn ? "Reminders Active" : "Enable Reminders"}</div>
        <div style={{ fontSize: 11, color: theme.muted }}>8am, 1pm & 7pm · calories + workout + water</div>
      </div>
      <span style={{ fontSize: 11, color: notifOn ? "#f59e0b" : theme.muted2, fontWeight: 700 }}>{notifOn ? "ON" : "OFF"}</span>
    </button>
  </div>
</div>
```

);
}

// ── WORKOUT ────────────────────────────────────────────────────────────────────
function WorkoutScreen({ exercises, sets, totalReps, totalSets, workoutGoalReps, workoutPct,
caloriesBurned, isRestDay, expandedEx, setExpandedEx,
addSet, toggleSet, updateSetReps, removeSet,
showAddEx, setShowAddEx, newEx, setNewEx, addCustomExercise, removeCustomExercise,
setScreen, theme }) {

const ICONS = [“🏃”,“🤸”,“🏊”,“🚴”,“🏌️”,“🧘”,“🤼”,“🥊”,“🏈”,“⛹️”,“🎿”,“🛹”];

return (
<div>
<div style={{ …C.screenHeader, borderColor: theme.border }}>
<button style={{ …C.backBtn, color: theme.muted }} onClick={() => setScreen(“home”)}>← Back</button>
<div style={{ fontFamily: “Bebas Neue, sans-serif”, fontSize: 20, letterSpacing: 3, flex: 1, color: theme.text }}>WORKOUT</div>
</div>

```
  {/* Session bar */}
  <div style={{ margin: "0 16px 14px", background: theme.card, border: `1px solid ${theme.border}`, borderRadius: 12, padding: "12px 16px" }}>
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
      <div>
        <span style={{ fontFamily: "Bebas Neue, sans-serif", fontSize: 26, color: "#f59e0b" }}>{totalReps}</span>
        <span style={{ fontSize: 11, color: theme.muted, marginLeft: 4 }}>reps</span>
        <span style={{ fontFamily: "Bebas Neue, sans-serif", fontSize: 20, color: "#818cf8", marginLeft: 10 }}>{totalSets}</span>
        <span style={{ fontSize: 11, color: theme.muted, marginLeft: 4 }}>sets · {caloriesBurned} kcal</span>
      </div>
      <span style={{ fontSize: 11, color: theme.muted }}>goal: {workoutGoalReps}r</span>
    </div>
    <div style={{ height: 5, background: theme.track, borderRadius: 3, overflow: "hidden" }}>
      <div style={{ height: "100%", width: `${workoutPct}%`, background: "linear-gradient(90deg,#f59e0b,#fbbf24)", borderRadius: 3, transition: "width 0.4s" }} />
    </div>
    {isRestDay && <div style={{ fontSize: 11, color: "#818cf8", marginTop: 6 }}>😴 Rest day — tracking paused</div>}
  </div>

  {isRestDay && (
    <div style={{ margin: "0 16px 14px", background: "#818cf810", border: "1px solid #818cf830", borderRadius: 12, padding: 16, textAlign: "center", color: "#818cf8", fontSize: 13 }}>
      Rest day is active. Enjoy your recovery!
    </div>
  )}

  <div style={{ padding: "0 16px" }}>
    {exercises.map(ex => {
      const exSets = sets[ex.id] || [];
      const open = expandedEx === ex.id;
      const exReps = exSets.filter(s => s.done).reduce((a, s) => a + s.reps, 0);
      return (
        <div key={ex.id} style={{ background: theme.card2, border: `1px solid ${exReps > 0 ? "#f59e0b25" : theme.border}`, borderRadius: 12, marginBottom: 8, overflow: "hidden" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 14px", cursor: "pointer" }} onClick={() => setExpandedEx(open ? null : ex.id)}>
            <span style={{ fontSize: 22 }}>{ex.icon}</span>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 14, fontWeight: 600, color: theme.text }}>{ex.name}</div>
              <div style={{ fontSize: 11, color: theme.muted }}>+{ex.xp} XP · {ex.cal} kcal/rep</div>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              {exReps > 0 && <span style={{ fontFamily: "Bebas Neue, sans-serif", fontSize: 18, color: "#f59e0b" }}>{exReps}r</span>}
              <span style={{ color: theme.muted2, fontSize: 13 }}>{open ? "▲" : "▼"}</span>
            </div>
          </div>
          {open && (
            <div style={{ borderTop: `1px solid ${theme.border}`, padding: "10px 14px", background: theme.expand }}>
              {exSets.map((s, i) => (
                <div key={i} style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                  <button onClick={() => toggleSet(ex, i)}
                    style={{ width: 28, height: 28, borderRadius: 6, border: `1px solid ${s.done ? "#10b98160" : theme.border}`, background: s.done ? "#10b98120" : theme.card, color: s.done ? "#10b981" : theme.muted, fontSize: 14, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                    {s.done ? "✓" : "○"}
                  </button>
                  <span style={{ fontSize: 12, color: theme.muted, minWidth: 40 }}>Set {i + 1}</span>
                  <input type="number" value={s.reps} min={1} max={999}
                    onChange={e => updateSetReps(ex.id, i, e.target.value)}
                    style={{ width: 54, background: theme.card, border: `1px solid ${theme.border}`, borderRadius: 6, padding: "4px 8px", color: theme.text, fontFamily: "DM Sans, sans-serif", fontSize: 13, outline: "none", textAlign: "center" }} />
                  <span style={{ fontSize: 12, color: theme.muted }}>reps</span>
                  <button onClick={() => removeSet(ex, i)} style={{ marginLeft: "auto", background: "none", border: "none", color: "#ef4444", cursor: "pointer", fontSize: 16, padding: 0 }}>×</button>
                </div>
              ))}
              <button onClick={() => addSet(ex)}
                style={{ fontSize: 12, color: "#f59e0b", background: "#f59e0b10", border: "1px solid #f59e0b30", borderRadius: 6, padding: "5px 12px", cursor: "pointer", fontFamily: "DM Sans, sans-serif", marginTop: 2 }}>
                + Add Set
              </button>
              {ex.custom && (
                <button onClick={() => removeCustomExercise(ex.id)}
                  style={{ fontSize: 12, color: "#ef4444", background: "none", border: "1px solid #ef444430", borderRadius: 6, padding: "5px 12px", cursor: "pointer", fontFamily: "DM Sans, sans-serif", marginLeft: 8 }}>
                  Remove Exercise
                </button>
              )}
            </div>
          )}
        </div>
      );
    })}

    {/* Add custom exercise */}
    {!showAddEx ? (
      <button onClick={() => setShowAddEx(true)}
        style={{ width: "100%", background: theme.card, border: `1px dashed ${theme.border}`, borderRadius: 12, padding: "12px", cursor: "pointer", color: theme.muted, fontFamily: "DM Sans, sans-serif", fontSize: 13, marginBottom: 8 }}>
        + Add Custom Exercise
      </button>
    ) : (
      <div style={{ background: theme.card, border: `1px solid ${theme.border}`, borderRadius: 12, padding: 16, marginBottom: 8 }}>
        <div style={{ fontSize: 11, color: theme.muted, letterSpacing: 1, marginBottom: 12, fontWeight: 600 }}>NEW EXERCISE</div>
        <input style={{ ...C.input, background: theme.input, borderColor: theme.border, color: theme.text, width: "100%", marginBottom: 8 }} placeholder="Exercise name"
          value={newEx.name} onChange={e => setNewEx(p => ({ ...p, name: e.target.value }))} />
        <div style={{ fontSize: 11, color: theme.muted, marginBottom: 6 }}>Pick an icon</div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 10 }}>
          {ICONS.map(ic => (
            <button key={ic} onClick={() => setNewEx(p => ({ ...p, icon: ic }))}
              style={{ fontSize: 18, background: newEx.icon === ic ? "#f59e0b20" : theme.card2, border: `1px solid ${newEx.icon === ic ? "#f59e0b60" : theme.border}`, borderRadius: 6, padding: "4px 6px", cursor: "pointer" }}>{ic}</button>
          ))}
        </div>
        <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 10, color: theme.muted, marginBottom: 4 }}>XP per rep</div>
            <input type="number" min={1} max={10} value={newEx.xp}
              onChange={e => setNewEx(p => ({ ...p, xp: +e.target.value }))}
              style={{ ...C.input, background: theme.input, borderColor: theme.border, color: theme.text, width: "100%" }} />
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 10, color: theme.muted, marginBottom: 4 }}>kcal per rep</div>
            <input type="number" min={1} max={50} value={newEx.cal}
              onChange={e => setNewEx(p => ({ ...p, cal: +e.target.value }))}
              style={{ ...C.input, background: theme.input, borderColor: theme.border, color: theme.text, width: "100%" }} />
          </div>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button style={C.primaryBtn} onClick={addCustomExercise}>Add</button>
          <button style={{ ...C.ghostBtn, color: theme.muted, borderColor: theme.border }} onClick={() => setShowAddEx(false)}>Cancel</button>
        </div>
      </div>
    )}
  </div>
  <div style={{ height: 24 }} />
</div>
```

);
}

// ── CALORIES ───────────────────────────────────────────────────────────────────
function CaloriesScreen({ caloriesEaten, caloriesBurned, netCal, calGoal, calPct,
waterGlasses, waterGoal, waterPct, addWater,
mealLog, mealInput, setMealInput, logMeal, deleteMeal, setScreen, theme }) {
return (
<div>
<div style={{ …C.screenHeader, borderColor: theme.border }}>
<button style={{ …C.backBtn, color: theme.muted }} onClick={() => setScreen(“home”)}>← Back</button>
<div style={{ fontFamily: “Bebas Neue, sans-serif”, fontSize: 20, letterSpacing: 3, flex: 1, color: theme.text }}>CALORIES & WATER</div>
</div>

```
  {/* Calorie summary */}
  <div style={{ padding: "0 16px 14px" }}>
    <div style={{ display: "flex", background: theme.card, border: `1px solid ${theme.border}`, borderRadius: 12, padding: "14px 0", marginBottom: 10 }}>
      <CalStat label="Eaten" val={caloriesEaten} color="#10b981" theme={theme} />
      <div style={{ width: 1, background: theme.border }} />
      <CalStat label="Burned" val={caloriesBurned} color="#f59e0b" theme={theme} />
      <div style={{ width: 1, background: theme.border }} />
      <CalStat label="Net" val={netCal} color={netCal >= calGoal ? "#10b981" : theme.text} theme={theme} />
    </div>
    <div style={{ height: 7, background: theme.track, borderRadius: 4, overflow: "hidden" }}>
      <div style={{ height: "100%", width: `${calPct}%`, background: calPct >= 100 ? "linear-gradient(90deg,#10b981,#34d399)" : "linear-gradient(90deg,#f59e0b,#fbbf24)", borderRadius: 4, transition: "width 0.4s" }} />
    </div>
    <div style={{ fontSize: 11, color: theme.muted, marginTop: 5 }}>
      {calPct >= 100 ? "✅ Calorie goal reached!" : `${calGoal - caloriesEaten} kcal remaining`}
    </div>
  </div>

  {/* Water tracker */}
  <div style={{ padding: "0 16px 14px" }}>
    <div style={{ background: theme.card, border: `1px solid ${theme.border}`, borderRadius: 12, padding: "14px 16px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
        <div>
          <div style={{ fontSize: 13, fontWeight: 600, color: theme.text }}>💧 Water Intake</div>
          <div style={{ fontSize: 11, color: theme.muted }}>{waterGlasses} / {waterGoal} glasses</div>
        </div>
        <div style={{ display: "flex", gap: 6 }}>
          <button onClick={() => addWater(-1)} style={{ width: 32, height: 32, background: theme.card2, border: `1px solid ${theme.border}`, borderRadius: 8, color: theme.muted, fontSize: 16, cursor: "pointer" }}>−</button>
          <button onClick={() => addWater(1)} style={{ width: 32, height: 32, background: "#22d3ee15", border: "1px solid #22d3ee40", borderRadius: 8, color: "#22d3ee", fontSize: 16, cursor: "pointer", fontWeight: 700 }}>+</button>
        </div>
      </div>
      {/* Glass icons */}
      <div style={{ display: "flex", gap: 5, flexWrap: "wrap", marginBottom: 10 }}>
        {Array.from({ length: waterGoal }, (_, i) => (
          <span key={i} onClick={() => addWater(i < waterGlasses ? -(waterGlasses - i) : i + 1 - waterGlasses)}
            style={{ fontSize: 18, cursor: "pointer", opacity: i < waterGlasses ? 1 : 0.25, transition: "opacity 0.2s" }}>🥤</span>
        ))}
      </div>
      <div style={{ height: 5, background: theme.track, borderRadius: 3, overflow: "hidden" }}>
        <div style={{ height: "100%", width: `${waterPct}%`, background: "linear-gradient(90deg,#22d3ee,#67e8f9)", borderRadius: 3, transition: "width 0.4s" }} />
      </div>
      {waterPct >= 100 && <div style={{ fontSize: 11, color: "#22d3ee", marginTop: 5 }}>✅ Hydration goal reached!</div>}
    </div>
  </div>

  {/* Presets */}
  <div style={{ padding: "0 16px 12px" }}>
    <div style={{ fontSize: 10, letterSpacing: 2, color: theme.muted2, marginBottom: 10, fontWeight: 600 }}>QUICK ADD</div>
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
      {MEAL_PRESETS.map(m => (
        <button key={m.name} style={{ background: theme.card, border: `1px solid ${theme.border}`, borderRadius: 10, padding: "10px 12px", cursor: "pointer", textAlign: "left", fontFamily: "DM Sans, sans-serif" }} onClick={() => logMeal(m.name, m.cal)}>
          <div style={{ fontSize: 12, fontWeight: 600, color: theme.text }}>{m.name}</div>
          <div style={{ fontSize: 10, color: "#f59e0b", marginTop: 2 }}>{m.cal} kcal</div>
        </button>
      ))}
    </div>
  </div>

  {/* Custom meal */}
  <div style={{ padding: "0 16px 16px" }}>
    <div style={{ fontSize: 10, letterSpacing: 2, color: theme.muted2, marginBottom: 10, fontWeight: 600 }}>CUSTOM MEAL</div>
    <div style={{ display: "flex", gap: 8 }}>
      <input style={{ ...C.input, background: theme.input, borderColor: theme.border, color: theme.text, flex: 1 }} placeholder="Meal name"
        value={mealInput.name} onChange={e => setMealInput(p => ({ ...p, name: e.target.value }))} />
      <input style={{ ...C.input, background: theme.input, borderColor: theme.border, color: theme.text, width: 78 }} placeholder="kcal" type="number"
        value={mealInput.cal} onChange={e => setMealInput(p => ({ ...p, cal: e.target.value }))} />
      <button style={C.addBtn} onClick={() => { if (!mealInput.name || !mealInput.cal) return; logMeal(mealInput.name, mealInput.cal); setMealInput({ name: "", cal: "" }); }}>+</button>
    </div>
  </div>

  {mealLog.length > 0 && (
    <div style={{ padding: "0 16px" }}>
      <div style={{ fontSize: 10, letterSpacing: 2, color: theme.muted2, marginBottom: 10, fontWeight: 600 }}>TODAY'S LOG</div>
      <div style={{ background: theme.card, border: `1px solid ${theme.border}`, borderRadius: 12, overflow: "hidden" }}>
        {[...mealLog].reverse().map(m => (
          <div key={m.id} style={{ display: "flex", alignItems: "center", padding: "10px 14px", borderBottom: `1px solid ${theme.border}` }}>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 13, color: theme.text }}>{m.name}</div>
              <div style={{ fontSize: 10, color: theme.muted }}>{m.t}</div>
            </div>
            <span style={{ fontSize: 13, color: "#f59e0b", fontWeight: 600, marginRight: 12 }}>{m.cal} kcal</span>
            <button onClick={() => deleteMeal(m.id)} style={{ background: "none", border: "none", color: "#ef4444", cursor: "pointer", fontSize: 18, padding: "0 2px", lineHeight: 1 }}>×</button>
          </div>
        ))}
      </div>
    </div>
  )}
  <div style={{ height: 24 }} />
</div>
```

);
}

// ── PROGRESS ───────────────────────────────────────────────────────────────────
function ProgressScreen({ xp, streak, totalReps, caloriesEaten, caloriesBurned, netCal,
daysSinceStart, goalDays, history, today, weekStats,
weightLog, showWeightInput, setShowWeightInput, weightInput, setWeightInput, logWeight,
exportCSV, setScreen, theme }) {
const rank = getRank(xp);
const progressPct = Math.min((daysSinceStart / goalDays) * 100, 100);
const last14 = getLast14();

// Weight chart data
const last8Weight = weightLog.slice(-8);

return (
<div>
<div style={{ …C.screenHeader, borderColor: theme.border }}>
<button style={{ …C.backBtn, color: theme.muted }} onClick={() => setScreen(“home”)}>← Back</button>
<div style={{ fontFamily: “Bebas Neue, sans-serif”, fontSize: 20, letterSpacing: 3, flex: 1, color: theme.text }}>PROGRESS</div>
<button onClick={exportCSV} style={{ fontSize: 11, color: “#818cf8”, background: “#818cf810”, border: “1px solid #818cf830”, borderRadius: 6, padding: “4px 10px”, cursor: “pointer”, fontFamily: “DM Sans, sans-serif” }}>📥 CSV</button>
</div>
<div style={{ padding: “0 16px” }}>

```
    {/* Timeline */}
    <div style={{ background: theme.card, border: `1px solid ${theme.border}`, borderRadius: 14, padding: 16, marginBottom: 12 }}>
      <div style={{ fontSize: 10, color: theme.muted, letterSpacing: 2, marginBottom: 6 }}>PROGRAM TIMELINE</div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
        <span style={{ fontFamily: "Bebas Neue, sans-serif", fontSize: 32, color: theme.text }}>Day {daysSinceStart}</span>
        <span style={{ fontSize: 12, color: theme.muted }}>of {goalDays}</span>
      </div>
      <div style={{ height: 6, background: theme.track, borderRadius: 3, marginTop: 10, overflow: "hidden" }}>
        <div style={{ height: "100%", width: `${progressPct}%`, background: "linear-gradient(90deg,#818cf8,#a78bfa)", borderRadius: 3, transition: "width 0.5s" }} />
      </div>
      <div style={{ fontSize: 11, color: theme.muted, marginTop: 5 }}>{Math.max(0, goalDays - daysSinceStart)} days remaining</div>
    </div>

    {/* Weekly summary */}
    <div style={{ background: theme.card, border: `1px solid ${theme.border}`, borderRadius: 12, padding: "14px 16px", marginBottom: 12 }}>
      <div style={{ fontSize: 10, color: theme.muted, letterSpacing: 2, marginBottom: 10 }}>THIS WEEK SUMMARY</div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
        {[["Days Active", `${weekStats.daysHit}/7`,"#10b981"], ["Total Reps", weekStats.reps,"#f59e0b"], ["Avg Calories", Math.round(weekStats.cal/7),"#22d3ee"], ["Full Goal Days", weekStats.bothDone,"#818cf8"]].map(([k,v,c]) => (
          <div key={k} style={{ background: theme.card2, borderRadius: 10, padding: "10px 12px" }}>
            <div style={{ fontFamily: "Bebas Neue, sans-serif", fontSize: 22, color: c }}>{v}</div>
            <div style={{ fontSize: 10, color: theme.muted }}>{k}</div>
          </div>
        ))}
      </div>
    </div>

    {/* 14-day grid */}
    <div style={{ fontSize: 10, letterSpacing: 2, color: theme.muted2, marginBottom: 10, fontWeight: 600 }}>LAST 14 DAYS</div>
    <div style={{ display: "grid", gridTemplateColumns: "repeat(7,1fr)", gap: 5, marginBottom: 8 }}>
      {last14.map(d => {
        const h = history[d];
        const isToday = d === today;
        const dayNum = d.split("-")[2];
        const bg = !h ? theme.card : h.isRestDay ? "#818cf818" : h.workoutDone && h.calGoalMet ? "#10b98120" : h.workoutDone ? "#f59e0b18" : h.calGoalMet ? "#22d3ee18" : "#ef444415";
        const icon = !h ? "·" : h.isRestDay ? "😴" : h.workoutDone && h.calGoalMet ? "✅" : h.workoutDone ? "💪" : h.calGoalMet ? "🥗" : "❌";
        return (
          <div key={d} style={{ background: bg, border: `1px solid ${isToday ? "#f59e0b50" : "transparent"}`, borderRadius: 8, padding: "6px 2px", textAlign: "center" }}>
            <div style={{ fontSize: 11, color: isToday ? "#f59e0b" : theme.muted, fontWeight: isToday ? 700 : 400 }}>{dayNum}</div>
            <div style={{ fontSize: 10, marginTop: 2 }}>{icon}</div>
          </div>
        );
      })}
    </div>
    <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 16 }}>
      {[["✅","Both"],["💪","Workout"],["🥗","Calories"],["😴","Rest"],["❌","Missed"],["·","No data"]].map(([ic,lb]) => (
        <span key={lb} style={{ fontSize: 10, color: theme.muted }}>{ic} {lb}</span>
      ))}
    </div>

    {/* Body weight log */}
    <div style={{ fontSize: 10, letterSpacing: 2, color: theme.muted2, marginBottom: 10, fontWeight: 600 }}>BODY WEIGHT</div>
    <div style={{ background: theme.card, border: `1px solid ${theme.border}`, borderRadius: 12, padding: 16, marginBottom: 12 }}>
      {last8Weight.length > 1 ? (
        <MiniWeightChart data={last8Weight} theme={theme} />
      ) : (
        <div style={{ fontSize: 12, color: theme.muted, textAlign: "center", padding: "8px 0" }}>
          {last8Weight.length === 1 ? `Last: ${last8Weight[0].kg} kg on ${last8Weight[0].date}` : "No weight logged yet"}
        </div>
      )}
      {!showWeightInput ? (
        <button onClick={() => setShowWeightInput(true)} style={{ marginTop: 12, width: "100%", fontSize: 12, color: "#f59e0b", background: "#f59e0b10", border: "1px solid #f59e0b30", borderRadius: 8, padding: "8px", cursor: "pointer", fontFamily: "DM Sans, sans-serif" }}>
          ⚖️ Log Today's Weight
        </button>
      ) : (
        <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
          <input type="number" placeholder="kg" value={weightInput} onChange={e => setWeightInput(e.target.value)}
            style={{ ...C.input, background: theme.input, borderColor: theme.border, color: theme.text, flex: 1 }} />
          <button style={{ ...C.primaryBtn, width: "auto", padding: "0 16px", marginBottom: 0 }} onClick={logWeight}>Save</button>
          <button style={{ ...C.ghostBtn, width: "auto", padding: "0 12px", borderColor: theme.border, color: theme.muted }} onClick={() => setShowWeightInput(false)}>✕</button>
        </div>
      )}
    </div>

    {/* Rank ladder */}
    <div style={{ fontSize: 10, letterSpacing: 2, color: theme.muted2, marginBottom: 10, fontWeight: 600 }}>RANK LADDER</div>
    {RANKS.map(r => {
      const achieved = xp >= r.minXP, current = rank.name === r.name;
      return (
        <div key={r.name} style={{ display: "flex", alignItems: "center", gap: 12, background: theme.card2, border: `1px solid ${current ? r.color + "40" : theme.border}`, borderRadius: 12, padding: "11px 14px", marginBottom: 7, opacity: achieved ? 1 : 0.35 }}>
          <span style={{ fontSize: 18 }}>{r.emoji}</span>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: current ? r.color : theme.text }}>{r.name}</div>
            <div style={{ fontSize: 10, color: theme.muted }}>{r.minXP} XP</div>
          </div>
          {current && <span style={{ fontSize: 10, color: r.color, fontWeight: 700 }}>CURRENT</span>}
          {achieved && !current && <span>✅</span>}
        </div>
      );
    })}

    {/* Stats grid */}
    <div style={{ fontSize: 10, letterSpacing: 2, color: theme.muted2, marginTop: 16, marginBottom: 10, fontWeight: 600 }}>STATS</div>
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, marginBottom: 24 }}>
      {[["XP",xp],["Streak",`${streak}d`],["Reps",totalReps],["Eaten",caloriesEaten],["Burned",caloriesBurned],["Net",netCal]].map(([k,v]) => (
        <div key={k} style={{ background: theme.card, border: `1px solid ${theme.border}`, borderRadius: 12, padding: "12px 10px", textAlign: "center" }}>
          <div style={{ fontFamily: "Bebas Neue, sans-serif", fontSize: 20, color: "#f59e0b" }}>{v}</div>
          <div style={{ fontSize: 9, color: theme.muted, letterSpacing: 1, textTransform: "uppercase" }}>{k}</div>
        </div>
      ))}
    </div>
  </div>
</div>
```

);
}

// ── Mini weight chart (SVG) ────────────────────────────────────────────────────
function MiniWeightChart({ data, theme }) {
const W = 300, H = 80, PAD = 16;
const vals = data.map(d => d.kg);
const min = Math.min(…vals) - 1, max = Math.max(…vals) + 1;
const xs = data.map((_, i) => PAD + (i / (data.length - 1)) * (W - PAD * 2));
const ys = vals.map(v => H - PAD - ((v - min) / (max - min)) * (H - PAD * 2));
const path = xs.map((x, i) => `${i === 0 ? "M" : "L"}${x},${ys[i]}`).join(” “);
return (
<div>
<svg viewBox={`0 0 ${W} ${H}`} style={{ width: “100%”, height: 80 }}>
<path d={path} fill="none" stroke="#f59e0b" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
{xs.map((x, i) => (
<g key={i}>
<circle cx={x} cy={ys[i]} r={3} fill="#f59e0b" />
<text x={x} y={ys[i] - 6} textAnchor=“middle” fontSize={9} fill={theme.muted} fontFamily=“DM Sans, sans-serif”>{vals[i]}</text>
</g>
))}
</svg>
<div style={{ fontSize: 10, color: theme.muted, textAlign: “right” }}>
{data[data.length-1].date} · {data[data.length-1].kg} kg
</div>
</div>
);
}

// ── Shared components ──────────────────────────────────────────────────────────
function RingCard({ label, pct, val, color, done, theme, size = 60 }) {
const r = size / 2 - 6, circ = 2 * Math.PI * r, cx = size / 2, cy = size / 2;
return (
<div style={{ flex: 1, background: theme.card, border: `1px solid ${theme.border}`, borderRadius: 12, padding: “10px 8px”, display: “flex”, flexDirection: “column”, alignItems: “center”, gap: 4 }}>
<svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
<circle cx={cx} cy={cy} r={r} fill="none" stroke={theme.track} strokeWidth={5} />
<circle cx={cx} cy={cy} r={r} fill=“none” stroke={done ? “#10b981” : color}
strokeWidth={5} strokeDasharray={circ} strokeDashoffset={circ - (circ * Math.min(pct, 100)) / 100}
strokeLinecap=“round” transform={`rotate(-90 ${cx} ${cy})`} style={{ transition: “stroke-dashoffset 0.5s” }} />
<text x={cx} y={cy + 4} textAnchor=“middle” fontSize={9} fontWeight={700}
fill={done ? “#10b981” : theme.text} fontFamily=“DM Sans, sans-serif”>{Math.round(pct)}%</text>
</svg>
<div style={{ fontSize: 9, color: theme.muted, letterSpacing: 1, textTransform: “uppercase”, textAlign: “center” }}>{label}</div>
<div style={{ fontSize: 10, fontWeight: 600, color: theme.text, textAlign: “center”, lineHeight: 1.2 }}>{val}</div>
</div>
);
}

function QuickBtn({ icon, label, sub, onClick, color, theme }) {
const [p, setP] = useState(false);
return (
<button onClick={onClick} onMouseEnter={() => setP(true)} onMouseLeave={() => setP(false)}
onTouchStart={() => setP(true)} onTouchEnd={() => setTimeout(() => setP(false), 150)}
style={{ background: p ? theme.cardHover : theme.card, border: `1px solid ${theme.border}`, borderRadius: 12, padding: “14px 12px”, cursor: “pointer”, textAlign: “left”, fontFamily: “DM Sans, sans-serif”, transition: “background 0.12s”, width: “100%” }}>
<div style={{ fontSize: 22, marginBottom: 6 }}>{icon}</div>
<div style={{ fontSize: 13, fontWeight: 600, color: theme.text }}>{label}</div>
<div style={{ fontSize: 11, color, marginTop: 3 }}>{sub}</div>
</button>
);
}

function CalStat({ label, val, color, theme }) {
return (
<div style={{ flex: 1, textAlign: “center” }}>
<div style={{ fontFamily: “Bebas Neue, sans-serif”, fontSize: 22, color }}>{val}</div>
<div style={{ fontSize: 10, color: theme.muted, letterSpacing: 1 }}>{label.toUpperCase()}</div>
</div>
);
}

function SliderField({ label, value, min, max, step, onChange, unit, theme, style: extra }) {
return (
<div style={extra}>
<span style={{ fontSize: 11, color: theme.muted, letterSpacing: 1, fontWeight: 600 }}>{label}</span>
<div style={{ display: “flex”, alignItems: “center”, gap: 12, marginTop: 10 }}>
<input type=“range” min={min} max={max} step={step} value={value} onChange={e => onChange(+e.target.value)} style={{ flex: 1 }} />
<span style={{ fontFamily: “Bebas Neue, sans-serif”, fontSize: 22, color: “#f59e0b”, minWidth: 70, textAlign: “right” }}>
{value}<span style={{ fontSize: 11, color: theme.muted }}> {unit}</span>
</span>
</div>
</div>
);
}

// ── Themes ─────────────────────────────────────────────────────────────────────
const DK = {
bg: “#0c0c10”, text: “#e2e8f0”, muted: “#64748b”, muted2: “#475569”,
card: “#ffffff06”, card2: “#ffffff04”, cardHover: “#ffffff0e”,
hero: “linear-gradient(135deg,#16161f,#1c1728)”,
border: “#ffffff0a”, track: “#ffffff10”, input: “#ffffff08”, expand: “#ffffff03”,
};
const LT = {
bg: “#f8fafc”, text: “#0f172a”, muted: “#64748b”, muted2: “#94a3b8”,
card: “#ffffff”, card2: “#f1f5f9”, cardHover: “#e2e8f0”,
hero: “linear-gradient(135deg,#e0e7ff,#f0fdf4)”,
border: “#e2e8f0”, track: “#e2e8f0”, input: “#f1f5f9”, expand: “#f8fafc”,
};

// ── Global styles ──────────────────────────────────────────────────────────────
const GS = `input[type=range]{-webkit-appearance:none;appearance:none;height:4px;background:#ffffff15;border-radius:2px;outline:none;cursor:pointer;} input[type=range]::-webkit-slider-thumb{-webkit-appearance:none;width:18px;height:18px;background:#f59e0b;border-radius:50%;cursor:pointer;} *{box-sizing:border-box;-webkit-tap-highlight-color:transparent;} ::-webkit-scrollbar{width:3px;}::-webkit-scrollbar-thumb{background:#ffffff15;border-radius:2px;} button:active{opacity:0.82;}`;

const C = {
page: { minHeight: “100vh”, fontFamily: “DM Sans, sans-serif”, maxWidth: 480, margin: “0 auto”, paddingBottom: 32, position: “relative”, overflow: “hidden” },
titleBar: { display: “flex”, justifyContent: “space-between”, alignItems: “center”, padding: “14px 20px 12px”, borderBottom: “1px solid”, position: “sticky”, top: 0, zIndex: 20 },
screenHeader: { display: “flex”, alignItems: “center”, gap: 12, padding: “14px 16px 16px”, borderBottom: “1px solid”, marginBottom: 16 },
backBtn: { background: “none”, border: “none”, cursor: “pointer”, fontFamily: “DM Sans, sans-serif”, fontSize: 13, padding: 0 },
input: { border: “1px solid”, borderRadius: 10, padding: “10px 14px”, fontFamily: “DM Sans, sans-serif”, fontSize: 13, outline: “none” },
addBtn: { background: “#f59e0b20”, border: “1px solid #f59e0b40”, color: “#f59e0b”, borderRadius: 10, padding: “0 16px”, fontSize: 22, cursor: “pointer”, fontFamily: “DM Sans, sans-serif”, fontWeight: 700 },
toast: { position: “fixed”, bottom: 24, left: “50%”, transform: “translateX(-50%)”, background: “#1a1a24”, border: “1px solid #f59e0b30”, color: “#f59e0b”, borderRadius: 10, padding: “10px 20px”, fontSize: 13, zIndex: 100, whiteSpace: “nowrap”, boxShadow: “0 8px 32px #00000080” },
primaryBtn: { width: “100%”, padding: 13, background: “#f59e0b”, border: “none”, borderRadius: 12, fontSize: 14, fontWeight: 700, cursor: “pointer”, fontFamily: “DM Sans, sans-serif”, color: “#0c0c10”, marginBottom: 10, display: “block” },
ghostBtn: { width: “100%”, padding: 11, background: “none”, border: “1px solid”, borderRadius: 12, fontSize: 13, cursor: “pointer”, fontFamily: “DM Sans, sans-serif”, display: “block” },
};
