import React, { useMemo, useState } from "react";

const CATEGORIES = [
  { key: "protein", label: "Protein" },
  { key: "calories", label: "Calories" },
  { key: "salt", label: "Salt" },
  { key: "potassium", label: "Potassium" },
  { key: "sugar", label: "Sugar" },
  { key: "meal", label: "Meal" },
  { key: "snack", label: "Snack" },
];

const TIP_LIBRARY = [
  "Keep calories 1400–1500 (adjust if you feel weak).",
  "Hit 90g+ protein daily. 3 proper meals spaced out.",
  "Drink 3L water. Avoid fizzy drinks.",
  "Reduce salt to help debloat.",
  "Add potassium foods (bananas, potatoes, beans).",
  "Avoid sugar and processed foods.",
  "Move often indoors: stairs, chores, pacing, standing.",
  "Sleep 8–9 hours. Keep stress down.",
  "Black coffee pre-workout (max 2 cups).",
  "Slow reps. Quality > endless reps.",
  "Don’t overtrain. More isn’t always better.",
  "After 10 days + 15k steps: add 200–300 calories back.",
];

const SEED_WORKOUTS = [
  {
    id: "w_push",
    name: "PUSH (Home) — Chest / Shoulders / Triceps / Quads",
    items: [
      "Warm-up 3–5 min: arm circles + squats + shoulder taps",
      "Incline push-ups (hands on bed/sofa) x10–20 OR normal x6–15",
      "Pike push-ups x6–12 OR wall pike hold 20–40s",
      "Chair dips x6–12 OR bench dips x8–15",
      "Split squats x8–15 each leg (slow)",
      "Wall sit 45–75s",
      "Rest 45–75s between exercises. 3–5 rounds total.",
    ],
  },
  {
    id: "w_pull",
    name: "PULL (Home) — Back / Biceps / Glutes / Hamstrings / Core",
    items: [
      "Warm-up 3–5 min: hip hinges + glute bridges + scap squeezes",
      "Backpack rows x10–20 (fill bag with books/water bottles)",
      "Towel rows (door-anchored carefully) x6–15 OR backpack rows again",
      "Biceps curls (backpack or bottles) x10–20",
      "Romanian deadlift (backpack) x10–20 (slow hinge)",
      "Glute bridges x12–25 (pause 1s at top)",
      "Dead bug x10–16 total OR plank 45–75s",
      "Rest 45–75s between exercises. 3–5 rounds total.",
    ],
  },
];

const STORAGE_KEY = "CUT_TRACKER_WEB_V1";

function todayISO() {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function safeParse(raw, fallback) {
  try {
    return JSON.parse(raw);
  } catch {
    return fallback;
  }
}

function scoreFromLogs(logs) {
  let green = 0, yellow = 0, red = 0;
  for (const l of logs) {
    if (l.status === "good") green++;
    if (l.status === "mid") yellow++;
    if (l.status === "bad") red++;
  }
  const total = green + yellow + red;
  const points = green * 2 + yellow * 1 + red * 0;
  const pct = total === 0 ? 0 : Math.round((points / (total * 2)) * 100);
  return { green, yellow, red, total, points, pct };
}

function badgeColours(status) {
  if (status === "good") return { bg: "#0F5132", fg: "#D1E7DD", icon: "✅" };
  if (status === "mid") return { bg: "#664D03", fg: "#FFF3CD", icon: "⚠️" };
  return { bg: "#842029", fg: "#F8D7DA", icon: "❌" };
}

function evaluateFood({ categoryKey, foodName, calories, protein, sugar, salt }) {
  const name = (foodName || "").trim().toLowerCase();
  const cals = Number(calories || 0);
  const prot = Number(protein || 0);
  const sug = Number(sugar || 0);
  const sal = Number(salt || 0);

  let status = "mid";
  let title = "Decent, but tighten it";
  let why = [];
  let tipsDoing = [
    "Drink 3L water",
    "Aim 90g+ protein",
    "Avoid sugar/processed foods",
    "Reduce salt",
    "Move indoors often",
    "Sleep 8–9 hours",
  ];
  let tipsShould = [];

  if (categoryKey === "protein") {
    if (prot >= 20 && cals <= 350 && sug <= 8) {
      status = "good"; title = "Good choice"; why.push("High protein for the calories.");
    } else if (prot >= 10) {
      status = "mid"; title = "Okay, could be better"; why.push("Some protein, but not great per calorie.");
      tipsShould.push("Pick a leaner protein option next time.");
    } else {
      status = "bad"; title = "Not helping your protein goal"; why.push("Too low protein for your cut.");
      tipsShould.push("Swap to eggs, tuna, lentils, yoghurt, beans.");
      tipsShould.push("Make each meal protein-centred.");
    }
  }

  if (categoryKey === "calories") {
    if (cals <= 250) {
      status = "good"; title = "Low calorie win"; why.push("Easy to stay in deficit.");
    } else if (cals <= 450) {
      status = "mid"; title = "Manageable, watch the rest of the day"; why.push("This can fit, but don’t stack heavy foods.");
      tipsShould.push("Keep the next meal lighter.");
    } else {
      status = "bad"; title = "Too heavy for a tight cut"; why.push("High calories makes 1400–1500 harder.");
      tipsShould.push("Reduce portion or swap to higher-volume foods.");
      tipsShould.push("Avoid sugary/processed extras.");
    }
  }

  if (categoryKey === "sugar") {
    if (sug <= 5) {
      status = "good"; title = "Low sugar"; why.push("Helps debloat and keeps cravings down.");
    } else if (sug <= 15) {
      status = "mid"; title = "A bit sugary"; why.push("Okay sometimes, but keep it controlled.");
      tipsShould.push("Choose lower sugar options more often.");
    } else {
      status = "bad"; title = "Too much sugar"; why.push("Likely to spike cravings and add junk calories.");
      tipsShould.push("Swap to protein + fruit/veg instead.");
      tipsShould.push("Avoid fizzy drinks and sweets.");
    }
  }

  if (categoryKey === "salt") {
    if (sal <= 0.6) {
      status = "good"; title = "Low salt"; why.push("Better for debloating.");
    } else if (sal <= 1.5) {
      status = "mid"; title = "Moderate salt"; why.push("Fine, but don’t stack salty foods today.");
      tipsShould.push("Drink water and keep the next meal lower salt.");
    } else {
      status = "bad"; title = "High salt"; why.push("Can cause water retention and bloat.");
      tipsShould.push("Reduce salt for the rest of the day.");
      tipsShould.push("Add potassium foods + water.");
    }
  }

  if (categoryKey === "potassium") {
    const isPotassiumFood =
      name.includes("banana") ||
      name.includes("potato") ||
      name.includes("spinach") ||
      name.includes("beans") ||
      name.includes("yoghurt");

    if (isPotassiumFood) {
      status = "good"; title = "Potassium boost"; why.push("Supports debloat when salt is lower.");
    } else {
      status = "mid"; title = "Okay, add a potassium side"; why.push("Not clearly potassium-focused.");
      tipsShould.push("Add banana, potato, spinach, beans, yoghurt.");
    }
  }

  if (categoryKey === "meal") {
    if (prot >= 25 && cals <= 550 && sug <= 10) {
      status = "good"; title = "Good meal for the cut"; why.push("Protein-forward and controlled calories.");
    } else if (cals <= 700) {
      status = "mid"; title = "Meal is okay, tighten the balance"; why.push("Keep protein up and keep calories controlled.");
      tipsShould.push("Add lean protein. Reduce sauces/fats.");
    } else {
      status = "bad"; title = "Meal is too heavy"; why.push("Too high calorie for a tight deficit.");
      tipsShould.push("Smaller portion + add veg.");
      tipsShould.push("Keep next meal lighter.");
    }
  }

  if (categoryKey === "snack") {
    if (cals <= 200 && (prot >= 10 || sug <= 8)) {
      status = "good"; title = "Good snack"; why.push("Fits the cut without wrecking calories.");
    } else if (cals <= 300) {
      status = "mid"; title = "Snack is okay, but be careful"; why.push("Can fit, but don’t keep stacking snacks.");
      tipsShould.push("Prefer protein snacks (yoghurt, eggs, tuna).");
    } else {
      status = "bad"; title = "Snack is too big"; why.push("Too many calories for a snack on a cut.");
      tipsShould.push("Swap to higher-protein, lower-cal snack.");
    }
  }

  if (why.length === 0) why.push("Based on your cut targets.");
  if (status === "good") tipsShould = [];

  return { status, title, why, tipsDoing, tipsShould };
}

export default function App() {
  const initial = useMemo(() => {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return {
        workouts: SEED_WORKOUTS,
        dayState: { date: todayISO(), status: "LOCKED" },
        dayLogs: [],
        endedDays: [],
      };
    }
    const parsed = safeParse(raw, null);
    if (!parsed) {
      return {
        workouts: SEED_WORKOUTS,
        dayState: { date: todayISO(), status: "LOCKED" },
        dayLogs: [],
        endedDays: [],
      };
    }
    return {
      workouts: parsed.workouts?.length ? parsed.workouts : SEED_WORKOUTS,
      dayState: parsed.dayState || { date: todayISO(), status: "LOCKED" },
      dayLogs: Array.isArray(parsed.dayLogs) ? parsed.dayLogs : [],
      endedDays: Array.isArray(parsed.endedDays) ? parsed.endedDays : [],
    };
  }, []);

  const [workouts, setWorkouts] = useState(initial.workouts);
  const [dayState, setDayState] = useState(initial.dayState);
  const [dayLogs, setDayLogs] = useState(initial.dayLogs);
  const [endedDays, setEndedDays] = useState(initial.endedDays);

  const [sidebarOpen, setSidebarOpen] = useState(false);

  const [page, setPage] = useState("home"); // home | food | tips | end | workouts | allTips | ai
  const [pickedCategory, setPickedCategory] = useState(null);
  const [pickedFood, setPickedFood] = useState(null);

  const persist = (next) => localStorage.setItem(STORAGE_KEY, JSON.stringify(next));

  const saveAll = (next) => {
    setWorkouts(next.workouts);
    setDayState(next.dayState);
    setDayLogs(next.dayLogs);
    setEndedDays(next.endedDays);
    persist(next);
  };

  const startNewDay = () => {
    const next = { workouts, dayState: { date: todayISO(), status: "ACTIVE" }, dayLogs, endedDays };
    saveAll(next);
  };

  const addLog = (entry) => {
    const nextLogs = [...dayLogs, entry];
    const next = { workouts, dayState, dayLogs: nextLogs, endedDays };
    saveAll(next);
  };

  const endDay = () => {
    const summary = scoreFromLogs(dayLogs);
    const endedDay = { date: dayState.date, logs: [...dayLogs], summary };
    const nextEnded = [...endedDays, endedDay];

    const next = {
      workouts,
      dayState: { date: todayISO(), status: "LOCKED" },
      dayLogs: [],
      endedDays: nextEnded,
    };

    saveAll(next);

    setPage("end");
    setPickedFood({ endedDay });
  };

  const dayLocked = dayState.status === "LOCKED";
  const dayEnded = dayState.status === "ENDED";
  const summary = useMemo(() => scoreFromLogs(dayLogs), [dayLogs]);

  const goHome = () => {
    setPage("home");
    setPickedCategory(null);
    setPickedFood(null);
  };

  return (
    <>
      {sidebarOpen && (
        <>
          <div className="sidebarOverlay" onClick={() => setSidebarOpen(false)} />
          <div className="sidebar">
            <div className="sideTitle">Menu</div>
            <div className="sideItem" onClick={() => { setSidebarOpen(false); goHome(); }}>
              Home
            </div>
            <div className="sideItem" onClick={() => { setSidebarOpen(false); setPage("workouts"); }}>
              Workouts
            </div>
            <div className="sideItem" onClick={() => { setSidebarOpen(false); setPage("allTips"); }}>
              All tips
            </div>
            <div className="sideItem" onClick={() => { setSidebarOpen(false); setPage("ai"); }}>
              AI
            </div>
          </div>
        </>
      )}

      {dayLocked && page === "home" && (
        <div className="modalOverlay">
          <div className="modal">
            <div style={{ fontWeight: 900, fontSize: 18 }}>Ready to start?</div>
            <div className="subtle" style={{ marginTop: 6 }}>Press start to begin today.</div>
            <button className="btnPrimary" onClick={startNewDay}>Start new day</button>
          </div>
        </div>
      )}

      <div className="container">
        <div className="topbar">
          <div className="iconBtn" onClick={() => setSidebarOpen(true)}>☰</div>
          <div style={{ flex: 1 }}>
            <div className="h1">Cut Tracker</div>
            <div className="subtle">Today: {dayState.date}</div>
          </div>
          {page !== "home" && (
            <div className="iconBtn" onClick={goHome}>←</div>
          )}
        </div>

        {page === "home" && (
          <>
            <div className="sectionTitle">Categories</div>
            <div className="chips">
              {CATEGORIES.map((c) => (
                <div key={c.key} className="chip">{c.label}</div>
              ))}
            </div>

            <div className="sectionTitle">Pick one</div>
            {CATEGORIES.map((c) => (
              <div
                key={c.key}
                className="card"
                style={{ opacity: dayLocked ? 0.75 : 1, cursor: dayLocked ? "not-allowed" : "pointer" }}
                onClick={() => {
                  if (dayLocked) return;
                  setPickedCategory(c);
                  setPage("food");
                }}
              >
                <div className="cardTitle">{c.label}</div>
                <p className="cardSub">Log something for {c.label.toLowerCase()}.</p>
              </div>
            ))}

            <div className="scoreBox">
              <div className="cardTitle" style={{ marginBottom: 4 }}>Today so far</div>
              <div className="subtle">Green: {summary.green} · Yellow: {summary.yellow} · Red: {summary.red}</div>
              <div className="subtle">Score: {summary.pct}%</div>
            </div>

            <div className="sectionTitle">Previous days</div>
            {endedDays.length === 0 ? (
              <div className="subtle">No previous days yet.</div>
            ) : (
              [...endedDays].reverse().map((d) => (
                <div key={d.date} className="card">
                  <div className="cardTitle">{d.date}</div>
                  <div className="subtle">
                    Green {d.summary.green} · Yellow {d.summary.yellow} · Red {d.summary.red} · Score {d.summary.pct}%
                  </div>
                </div>
              ))
            )}

            <div className="bottomBar">
              <div
                className={`endBtn ${(dayLocked || dayLogs.length === 0) ? "disabled" : ""}`}
                onClick={() => {
                  if (dayLocked) return;
                  if (dayLogs.length === 0) return;
                  endDay();
                }}
              >
                {dayLocked ? "Start the day first" : (dayLogs.length === 0 ? "Log something first" : "End day")}
              </div>
            </div>
          </>
        )}

        {page === "food" && pickedCategory && <FoodPage
          category={pickedCategory}
          onContinue={(food) => { setPickedFood(food); setPage("tips"); }}
        />}

        {page === "tips" && pickedCategory && pickedFood && (
          <TipsPage
            category={pickedCategory}
            food={pickedFood}
            dayActive={dayState.status === "ACTIVE"}
            onYes={() => {
              const result = evaluateFood({ categoryKey: pickedCategory.key, ...pickedFood });
              addLog({
                id: String(Date.now()),
                ts: new Date().toISOString(),
                category: pickedCategory.label,
                categoryKey: pickedCategory.key,
                foodName: (pickedFood.foodName || "Unknown").trim() || "Unknown",
                calories: Number(pickedFood.calories || 0),
                protein: Number(pickedFood.protein || 0),
                sugar: Number(pickedFood.sugar || 0),
                salt: Number(pickedFood.salt || 0),
                status: result.status,
              });
              goHome();
            }}
            onNo={goHome}
          />
        )}

        {page === "end" && pickedFood?.endedDay && <EndPage endedDay={pickedFood.endedDay} />}

        {page === "workouts" && (
          <WorkoutsPage workouts={workouts} setWorkouts={(next) => {
            const nextAll = { workouts: next, dayState, dayLogs, endedDays };
            saveAll(nextAll);
          }} />
        )}

        {page === "allTips" && <AllTipsPage />}

        {page === "ai" && <AIPage />}
      </div>
    </>
  );
}

function FoodPage({ category, onContinue }) {
  const [foodName, setFoodName] = useState("");
  const [calories, setCalories] = useState("");
  const [protein, setProtein] = useState("");
  const [sugar, setSugar] = useState("");
  const [salt, setSalt] = useState("");

  return (
    <>
      <div className="sectionTitle">Pick food</div>
      <div className="card">
        <div className="cardTitle">Category: {category.label}</div>

        <div className="label">Food</div>
        <input className="input" value={foodName} onChange={(e) => setFoodName(e.target.value)} placeholder="e.g. tuna, eggs, banana" />

        <div className="row2">
          <div className="col">
            <div className="label">Calories</div>
            <input className="input" value={calories} onChange={(e) => setCalories(e.target.value)} placeholder="e.g. 250" />
          </div>
          <div className="col">
            <div className="label">Protein (g)</div>
            <input className="input" value={protein} onChange={(e) => setProtein(e.target.value)} placeholder="e.g. 25" />
          </div>
        </div>

        <div className="row2">
          <div className="col">
            <div className="label">Sugar (g)</div>
            <input className="input" value={sugar} onChange={(e) => setSugar(e.target.value)} placeholder="e.g. 5" />
          </div>
          <div className="col">
            <div className="label">Salt (g)</div>
            <input className="input" value={salt} onChange={(e) => setSalt(e.target.value)} placeholder="e.g. 0.6" />
          </div>
        </div>

        <button
          className="btnPrimary"
          onClick={() => onContinue({ foodName, calories, protein, sugar, salt })}
        >
          Continue
        </button>
      </div>
    </>
  );
}

function TipsPage({ category, food, dayActive, onYes, onNo }) {
  const result = useMemo(() => evaluateFood({ categoryKey: category.key, ...food }), [category.key, food]);
  const colours = badgeColours(result.status);

  return (
    <>
      <div className="banner" style={{ background: colours.bg, color: colours.fg }}>
        {colours.icon} {result.title}
      </div>

      <div className="card">
        <div className="cardTitle">Why</div>
        {result.why.map((w, i) => <div key={i} className="bullet">• {w}</div>)}
      </div>

      {result.status !== "bad" && (
        <div className="card">
          <div className="cardTitle">Tips you’re doing</div>
          {result.tipsDoing.map((t, i) => <div key={i} className="bullet">• {t}</div>)}
        </div>
      )}

      {result.status !== "good" && (
        <div className="card">
          <div className="cardTitle">{result.status === "mid" ? "Tips you should do" : "What you need to do"}</div>
          {(result.tipsShould.length ? result.tipsShould : ["Tighten the next choice."]).map((t, i) => (
            <div key={i} className="bullet">• {t}</div>
          ))}
        </div>
      )}

      <div className="card">
        <div className="cardTitle">Final validation</div>
        <div className="subtle">Log this for today?</div>

        {!dayActive && (
          <div className="subtle" style={{ marginTop: 8 }}>
            Day not active. Go Home and press “Start new day”.
          </div>
        )}

        <div className="row2" style={{ marginTop: 10 }}>
          <button className="btnPrimary" onClick={() => dayActive && onYes()} disabled={!dayActive}>
            Yes
          </button>
          <button className="btnGhost" onClick={onNo}>No</button>
        </div>
      </div>
    </>
  );
}

function EndPage({ endedDay }) {
  return (
    <>
      <div className="sectionTitle">Good night</div>
      <div className="scoreBox">
        <div className="cardTitle">Your score</div>
        <div className="subtle">
          Green: {endedDay.summary.green} · Yellow: {endedDay.summary.yellow} · Red: {endedDay.summary.red}
        </div>
        <div className="subtle">Score: {endedDay.summary.pct}%</div>
      </div>

      <div className="sectionTitle">What you logged</div>
      {[...endedDay.logs].reverse().map((l) => {
        const c = badgeColours(l.status);
        return (
          <div key={l.id} className="card" style={{ borderLeft: `6px solid ${c.bg}` }}>
            <div className="cardTitle">{c.icon} {l.category} · {l.foodName}</div>
            <div className="subtle">{l.calories} kcal · {l.protein}g protein · {l.sugar}g sugar · {l.salt}g salt</div>
          </div>
        );
      })}
    </>
  );
}

function WorkoutsPage({ workouts, setWorkouts }) {
  const [name, setName] = useState("");
  const [line, setLine] = useState("");
  const [items, setItems] = useState([]);

  const addLine = () => {
    const t = line.trim();
    if (!t) return;
    setItems((p) => [...p, t]);
    setLine("");
  };

  const saveWorkout = () => {
    const n = name.trim();
    if (!n || items.length === 0) return;
    setWorkouts([...workouts, { id: `w_${Date.now()}`, name: n, items: [...items] }]);
    setName(""); setItems([]); setLine("");
  };

  const del = (id) => setWorkouts(workouts.filter((w) => w.id !== id));

  return (
    <>
      <div className="sectionTitle">Workouts</div>

      <div className="card">
        <div className="cardTitle">Add workout</div>

        <div className="label">Name</div>
        <input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="Workout name" />

        <div className="label">Add lines</div>
        <div className="row2">
          <div className="col">
            <input className="input" value={line} onChange={(e) => setLine(e.target.value)} placeholder="e.g. Push-ups x12" />
          </div>
          <div style={{ width: 110 }}>
            <button className="btnPrimary" onClick={addLine} style={{ marginTop: 0 }}>Add</button>
          </div>
        </div>

        {items.map((it, i) => <div key={i} className="bullet">• {it}</div>)}

        <button className="btnPrimary" onClick={saveWorkout}>Save workout</button>
      </div>

      <div className="sectionTitle">Saved</div>
      {workouts.map((w) => (
        <div className="card" key={w.id}>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
            <div className="cardTitle" style={{ marginBottom: 0 }}>{w.name}</div>
            <button className="btnGhost" onClick={() => del(w.id)} style={{ width: 110, marginTop: 0 }}>
              Delete
            </button>
          </div>
          {w.items.map((it, i) => <div key={i} className="bullet">• {it}</div>)}
        </div>
      ))}
    </>
  );
}

function AllTipsPage() {
  return (
    <>
      <div className="sectionTitle">All tips</div>
      {TIP_LIBRARY.map((t, i) => (
        <div className="card" key={i}>
          <div className="bullet">• {t}</div>
        </div>
      ))}
    </>
  );
}

function AIPage() {
  const [mode, setMode] = useState("workout");
  const [input, setInput] = useState("");
  const [constraints, setConstraints] = useState("No gym. Home only. Quiet options if possible.");
  const [loading, setLoading] = useState(false);
  const [output, setOutput] = useState("");

  const run = async () => {
    const text = input.trim();
    if (!text) return;

    setLoading(true);
    setOutput("");

    try {
      const res = await fetch("/api/ai", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode, input: text, constraints }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "AI request failed");
      setOutput(data.output || "");
    } catch (e) {
      setOutput(`Error: ${e.message}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <div className="sectionTitle">AI</div>

      <div className="card">
        <div className="cardTitle">Pick</div>

        <div className="row2" style={{ marginTop: 0 }}>
          <button
            className="btnGhost"
            onClick={() => setMode("workout")}
            style={{ marginTop: 0, borderColor: mode === "workout" ? "#2B4B85" : undefined }}
          >
            Workout
          </button>
          <button
            className="btnGhost"
            onClick={() => setMode("food")}
            style={{ marginTop: 0, borderColor: mode === "food" ? "#2B4B85" : undefined }}
          >
            Food
          </button>
        </div>

        <div className="label">{mode === "workout" ? "Workout / Exercise" : "Food item"}</div>
        <input
          className="input"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={mode === "workout" ? "e.g. Push-ups hurt wrists" : "e.g. chocolate bar"}
        />

        <div className="label">Constraints (optional)</div>
        <input
          className="input"
          value={constraints}
          onChange={(e) => setConstraints(e.target.value)}
          placeholder="e.g. knee pain, no jumping, vegetarian"
        />

        <button className="btnPrimary" onClick={run} disabled={loading}>
          {loading ? "Thinking…" : "Get suggestions"}
        </button>
      </div>

      <div className="card">
        <div className="cardTitle">Output</div>
        <div className="bullet" style={{ whiteSpace: "pre-wrap" }}>
          {output || "—"}
        </div>
      </div>
    </>
  );
}
