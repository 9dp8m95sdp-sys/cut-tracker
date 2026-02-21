// app/App.js
// Expo (iOS/Android/Web). PWA-ready via expo web export.
// Needs: react-navigation + async-storage + gesture handler

import "react-native-gesture-handler";

import React, { createContext, useContext, useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  Pressable,
  TextInput,
  ScrollView,
  StyleSheet,
  Modal,
  Alert,
  ActivityIndicator,
  Platform,
} from "react-native";

import AsyncStorage from "@react-native-async-storage/async-storage";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { NavigationContainer } from "@react-navigation/native";
import { createDrawerNavigator } from "@react-navigation/drawer";
import { createStackNavigator } from "@react-navigation/stack";

// -------------------- Context --------------------
const AppCtx = createContext(null);
const useApp = () => useContext(AppCtx);

// -------------------- STORAGE KEYS --------------------
const STORAGE_KEY = "CUT_LOGGER_V1";

// -------------------- Updated starter workouts (Push / Pull, no gym) --------------------
const SEED_WORKOUTS = [
  {
    id: "w_push",
    name: "PUSH (Home) — Chest / Shoulders / Triceps / Quads",
    items: [
      "Warm-up 3–5 min: arm circles + bodyweight squats + shoulder taps",
      "Incline push-ups (hands on bed/sofa) x10–20 (regress) OR normal x6–15",
      "Pike push-ups x6–12 (shoulders) OR wall pike hold 20–40s",
      "Chair dips x6–12 (triceps) OR bench dip with knees bent x8–15",
      "Split squats x8–15 each leg (slow)",
      "Wall sit 45–75s",
      "Optional finisher: slow push-ups AMRAP (stop 1–2 reps before failure)",
      "Rest 45–75s between exercises. 3–5 rounds total.",
    ],
  },
  {
    id: "w_pull",
    name: "PULL (Home) — Back / Biceps / Glutes / Hamstrings / Core",
    items: [
      "Warm-up 3–5 min: hip hinges + glute bridges + scap squeezes",
      "Backpack rows x10–20 (fill bag with books/water bottles)",
      "Towel rows (door-anchored carefully) x6–15 OR backpack row again",
      "Biceps curls (backpack or bottles) x10–20",
      "Romanian deadlift (backpack) x10–20 (slow hinge)",
      "Glute bridges x12–25 (pause at top 1s)",
      "Dead bug x10–16 total OR plank 45–75s",
      "Rest 45–75s between exercises. 3–5 rounds total.",
    ],
  },
];

// -------------------- Tips library (kept same idea) --------------------
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

// -------------------- Categories --------------------
const CATEGORIES = [
  { key: "protein", label: "Protein" },
  { key: "calories", label: "Calories" },
  { key: "salt", label: "Salt" },
  { key: "potassium", label: "Potassium" },
  { key: "sugar", label: "Sugar" },
  { key: "meal", label: "Meal" },
  { key: "snack", label: "Snack" },
];

// -------------------- Helpers --------------------
function todayISO() {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function scoreFromLogs(logs) {
  let green = 0,
    yellow = 0,
    red = 0;

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
  if (status === "good") return { bg: "#0F5132", fg: "#D1E7DD" };
  if (status === "mid") return { bg: "#664D03", fg: "#FFF3CD" };
  return { bg: "#842029", fg: "#F8D7DA" };
}

// -------------------- Food evaluation (same logic style) --------------------
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
      status = "good";
      title = "Good choice";
      why.push("High protein for the calories.");
    } else if (prot >= 10) {
      status = "mid";
      title = "Okay, could be better";
      why.push("Some protein, but not great per calorie.");
      tipsShould.push("Pick a leaner protein option next time.");
    } else {
      status = "bad";
      title = "Not helping your protein goal";
      why.push("Too low protein for your cut.");
      tipsShould.push("Swap to eggs, tuna, lentils, yoghurt, beans.");
      tipsShould.push("Make each meal protein-centred.");
    }
  }

  if (categoryKey === "calories") {
    if (cals <= 250) {
      status = "good";
      title = "Low calorie win";
      why.push("Easy to stay in deficit.");
    } else if (cals <= 450) {
      status = "mid";
      title = "Manageable, watch the rest of the day";
      why.push("This can fit, but don’t stack heavy foods.");
      tipsShould.push("Keep the next meal lighter.");
    } else {
      status = "bad";
      title = "Too heavy for a tight cut";
      why.push("High calories makes 1400–1500 harder.");
      tipsShould.push("Reduce portion or swap to higher-volume foods.");
      tipsShould.push("Avoid sugary/processed extras.");
    }
  }

  if (categoryKey === "sugar") {
    if (sug <= 5) {
      status = "good";
      title = "Low sugar";
      why.push("Helps debloat and keeps cravings down.");
    } else if (sug <= 15) {
      status = "mid";
      title = "A bit sugary";
      why.push("Okay sometimes, but keep it controlled.");
      tipsShould.push("Choose lower sugar options more often.");
    } else {
      status = "bad";
      title = "Too much sugar";
      why.push("Likely to spike cravings and add junk calories.");
      tipsShould.push("Swap to protein + fruit/veg instead.");
      tipsShould.push("Avoid fizzy drinks and sweets.");
    }
  }

  if (categoryKey === "salt") {
    if (sal <= 0.6) {
      status = "good";
      title = "Low salt";
      why.push("Better for debloating.");
    } else if (sal <= 1.5) {
      status = "mid";
      title = "Moderate salt";
      why.push("Fine, but don’t stack salty foods today.");
      tipsShould.push("Drink water and keep the next meal lower salt.");
    } else {
      status = "bad";
      title = "High salt";
      why.push("Can cause water retention and bloat.");
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
      status = "good";
      title = "Potassium boost";
      why.push("Supports debloat when salt is lower.");
    } else {
      status = "mid";
      title = "Okay, add a potassium side";
      why.push("Not clearly potassium-focused.");
      tipsShould.push("Add banana, potato, spinach, beans, yoghurt.");
    }
  }

  if (categoryKey === "meal") {
    if (prot >= 25 && cals <= 550 && sug <= 10) {
      status = "good";
      title = "Good meal for the cut";
      why.push("Protein-forward and controlled calories.");
    } else if (cals <= 700) {
      status = "mid";
      title = "Meal is okay, tighten the balance";
      why.push("Keep protein up and keep calories controlled.");
      tipsShould.push("Add lean protein. Reduce sauces/fats.");
    } else {
      status = "bad";
      title = "Meal is too heavy";
      why.push("Too high calorie for a tight deficit.");
      tipsShould.push("Smaller portion + add veg.");
      tipsShould.push("Keep next meal lighter.");
    }
  }

  if (categoryKey === "snack") {
    if (cals <= 200 && (prot >= 10 || sug <= 8)) {
      status = "good";
      title = "Good snack";
      why.push("Fits the cut without wrecking calories.");
    } else if (cals <= 300) {
      status = "mid";
      title = "Snack is okay, but be careful";
      why.push("Can fit, but don’t keep stacking snacks.");
      tipsShould.push("Prefer protein snacks (yoghurt, eggs, tuna).");
    } else {
      status = "bad";
      title = "Snack is too big";
      why.push("Too many calories for a snack on a cut.");
      tipsShould.push("Swap to higher-protein, lower-cal snack.");
    }
  }

  if (why.length === 0) why.push("Based on your cut targets.");
  if (status === "good") tipsShould = [];

  return { status, title, why, tipsDoing, tipsShould };
}

// -------------------- Screens --------------------
function CategoryScreen({ navigation }) {
  const { dayState, startNewDay, endDay, dayLogs, endedDays } = useApp();
  const dayEnded = dayState.status === "ENDED";
  const dayLocked = dayState.status === "LOCKED";
  const summary = useMemo(() => scoreFromLogs(dayLogs), [dayLogs]);

  return (
    <View style={styles.screen}>
      <View style={styles.headerRow}>
        <Pressable onPress={() => navigation.openDrawer()} style={styles.iconBtn}>
          <Text style={styles.iconText}>☰</Text>
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text style={styles.h1}>Cut Logger</Text>
          <Text style={styles.subtle}>Today: {dayState.date}</Text>
        </View>
      </View>

      <Modal visible={dayLocked} transparent animationType="fade">
        <View style={styles.lockOverlay}>
          <View style={styles.lockCard}>
            <Text style={styles.h2}>Ready to start?</Text>
            <Text style={styles.p}>Press start to begin today.</Text>
            <Pressable onPress={startNewDay} style={[styles.primaryBtn, { width: "100%" }]}>
              <Text style={styles.primaryBtnText}>Start new day</Text>
            </Pressable>
          </View>
        </View>
      </Modal>

      <Text style={styles.sectionTitle}>Categories</Text>
      <View style={styles.chipsWrap}>
        {CATEGORIES.map((c) => (
          <View key={c.key} style={styles.chip}>
            <Text style={styles.chipText}>{c.label}</Text>
          </View>
        ))}
      </View>

      <Text style={styles.sectionTitle}>Pick one</Text>
      <ScrollView contentContainerStyle={{ paddingBottom: 140 }}>
        {CATEGORIES.map((c) => (
          <Pressable
            key={c.key}
            style={[styles.card, dayEnded && styles.cardDisabled]}
            disabled={dayEnded}
            onPress={() => navigation.navigate("Food", { category: c })}
          >
            <Text style={styles.cardTitle}>{c.label}</Text>
            <Text style={styles.cardSub}>Log something for {c.label.toLowerCase()}.</Text>
          </Pressable>
        ))}

        <View style={styles.scoreBox}>
          <Text style={styles.scoreTitle}>Today so far</Text>
          <Text style={styles.scoreLine}>
            Green: {summary.green} · Yellow: {summary.yellow} · Red: {summary.red}
          </Text>
          <Text style={styles.scoreLine}>Score: {summary.pct}%</Text>
        </View>

        <Text style={styles.sectionTitle}>Previous days</Text>
        {endedDays.length === 0 ? (
          <Text style={styles.subtle}>No previous days yet.</Text>
        ) : (
          endedDays
            .slice()
            .reverse()
            .map((d) => (
              <View key={d.date} style={styles.prevDayCard}>
                <Text style={styles.prevDayTitle}>{d.date}</Text>
                <Text style={styles.prevDaySub}>
                  Green {d.summary.green} · Yellow {d.summary.yellow} · Red {d.summary.red} · Score{" "}
                  {d.summary.pct}%
                </Text>
              </View>
            ))
        )}
      </ScrollView>

      <View style={styles.bottomBar}>
        <Pressable
          style={[styles.endDayBtn, (dayEnded || dayLocked) && styles.endDayBtnDisabled]}
          disabled={dayEnded || dayLocked}
          onPress={() => {
            if (dayLogs.length === 0) {
              Alert.alert("Nothing logged yet", "Log at least one thing before ending the day.");
              return;
            }
            endDay(navigation);
          }}
        >
          <Text style={styles.endDayBtnText}>
            {dayLocked ? "Start the day first" : dayEnded ? "Day ended" : "End day"}
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

function FoodScreen({ navigation, route }) {
  const { category } = route.params;

  const [foodName, setFoodName] = useState("");
  const [calories, setCalories] = useState("");
  const [protein, setProtein] = useState("");
  const [sugar, setSugar] = useState("");
  const [salt, setSalt] = useState("");

  return (
    <View style={styles.screen}>
      <View style={styles.headerRow}>
        <Pressable onPress={() => navigation.goBack()} style={styles.iconBtn}>
          <Text style={styles.iconText}>←</Text>
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text style={styles.h1}>Pick food</Text>
          <Text style={styles.subtle}>Category: {category.label}</Text>
        </View>
      </View>

      <View style={styles.foodBar}>
        <Text style={styles.label}>Food</Text>
        <TextInput
          value={foodName}
          onChangeText={setFoodName}
          placeholder="e.g. tuna, eggs, banana"
          placeholderTextColor="#7A7A7A"
          style={styles.input}
        />

        <View style={styles.row2}>
          <View style={styles.col}>
            <Text style={styles.label}>Calories</Text>
            <TextInput
              value={calories}
              onChangeText={setCalories}
              keyboardType="numeric"
              placeholder="e.g. 250"
              placeholderTextColor="#7A7A7A"
              style={styles.input}
            />
          </View>
          <View style={styles.col}>
            <Text style={styles.label}>Protein (g)</Text>
            <TextInput
              value={protein}
              onChangeText={setProtein}
              keyboardType="numeric"
              placeholder="e.g. 25"
              placeholderTextColor="#7A7A7A"
              style={styles.input}
            />
          </View>
        </View>

        <View style={styles.row2}>
          <View style={styles.col}>
            <Text style={styles.label}>Sugar (g)</Text>
            <TextInput
              value={sugar}
              onChangeText={setSugar}
              keyboardType="numeric"
              placeholder="e.g. 5"
              placeholderTextColor="#7A7A7A"
              style={styles.input}
            />
          </View>
          <View style={styles.col}>
            <Text style={styles.label}>Salt (g)</Text>
            <TextInput
              value={salt}
              onChangeText={setSalt}
              keyboardType="numeric"
              placeholder="e.g. 0.6"
              placeholderTextColor="#7A7A7A"
              style={styles.input}
            />
          </View>
        </View>

        <Pressable
          style={styles.primaryBtn}
          onPress={() =>
            navigation.navigate("Tips", {
              category,
              food: { foodName, calories, protein, sugar, salt },
            })
          }
        >
          <Text style={styles.primaryBtnText}>Continue</Text>
        </Pressable>
      </View>
    </View>
  );
}

function TipsScreen({ navigation, route }) {
  const { category, food } = route.params;
  const { addLog, dayState } = useApp();

  const result = useMemo(
    () => evaluateFood({ categoryKey: category.key, ...food }),
    [category.key, food]
  );

  const colours = badgeColours(result.status);
  const icon = result.status === "good" ? "✅" : result.status === "mid" ? "⚠️" : "❌";

  const finalise = (yes) => {
    if (!yes) {
      navigation.popToTop();
      return;
    }

    if (dayState.status !== "ACTIVE") {
      Alert.alert("Day not active", "Press Start new day first.");
      navigation.popToTop();
      return;
    }

    addLog({
      id: String(Date.now()),
      ts: new Date().toISOString(),
      category: category.label,
      categoryKey: category.key,
      foodName: (food.foodName || "Unknown").trim() || "Unknown",
      calories: Number(food.calories || 0),
      protein: Number(food.protein || 0),
      sugar: Number(food.sugar || 0),
      salt: Number(food.salt || 0),
      status: result.status,
    });

    navigation.popToTop();
  };

  return (
    <View style={styles.screen}>
      <View style={styles.headerRow}>
        <Pressable onPress={() => navigation.goBack()} style={styles.iconBtn}>
          <Text style={styles.iconText}>←</Text>
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text style={styles.h1}>Tips</Text>
          <Text style={styles.subtle}>
            {category.label} · {food.foodName || "Food"}
          </Text>
        </View>
      </View>

      <View style={[styles.banner, { backgroundColor: colours.bg }]}>
        <Text style={[styles.bannerText, { color: colours.fg }]}>
          {icon} {result.title}
        </Text>
      </View>

      <ScrollView contentContainerStyle={{ paddingBottom: 140 }}>
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Why</Text>
          {result.why.map((w, i) => (
            <Text key={i} style={styles.bullet}>
              • {w}
            </Text>
          ))}
        </View>

        {result.status === "good" && (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Tips you’re doing</Text>
            {result.tipsDoing.map((t, i) => (
              <Text key={i} style={styles.bullet}>
                • {t}
              </Text>
            ))}
          </View>
        )}

        {result.status === "mid" && (
          <>
            <View style={styles.card}>
              <Text style={styles.cardTitle}>Tips you’re doing</Text>
              {result.tipsDoing.map((t, i) => (
                <Text key={i} style={styles.bullet}>
                  • {t}
                </Text>
              ))}
            </View>
            <View style={styles.card}>
              <Text style={styles.cardTitle}>Tips you should do</Text>
              {(result.tipsShould.length ? result.tipsShould : ["Tighten the next choice."]).map(
                (t, i) => (
                  <Text key={i} style={styles.bullet}>
                    • {t}
                  </Text>
                )
              )}
            </View>
          </>
        )}

        {result.status === "bad" && (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>What you need to do</Text>
            {(result.tipsShould.length ? result.tipsShould : ["Swap to a better option."]).map(
              (t, i) => (
                <Text key={i} style={styles.bullet}>
                  • {t}
                </Text>
              )
            )}
          </View>
        )}

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Final validation</Text>
          <Text style={styles.p}>Log this for today?</Text>

          <View style={{ flexDirection: "row", gap: 10, marginTop: 10 }}>
            <Pressable style={[styles.primaryBtn, { flex: 1 }]} onPress={() => finalise(true)}>
              <Text style={styles.primaryBtnText}>Yes</Text>
            </Pressable>
            <Pressable style={[styles.ghostBtn, { flex: 1 }]} onPress={() => finalise(false)}>
              <Text style={styles.ghostBtnText}>No</Text>
            </Pressable>
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

function EndOfDayScreen({ route, navigation }) {
  const { endedDay } = route.params;

  return (
    <View style={styles.screen}>
      <View style={styles.headerRow}>
        <Pressable onPress={() => navigation.popToTop()} style={styles.iconBtn}>
          <Text style={styles.iconText}>←</Text>
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text style={styles.h1}>Good night</Text>
          <Text style={styles.subtle}>Day ended: {endedDay.date}</Text>
        </View>
      </View>

      <View style={styles.scoreBox}>
        <Text style={styles.scoreTitle}>Your score</Text>
        <Text style={styles.scoreLine}>
          Green: {endedDay.summary.green} · Yellow: {endedDay.summary.yellow} · Red:{" "}
          {endedDay.summary.red}
        </Text>
        <Text style={styles.scoreLine}>Score: {endedDay.summary.pct}%</Text>
      </View>

      <Text style={styles.sectionTitle}>What you logged</Text>
      <ScrollView contentContainerStyle={{ paddingBottom: 120 }}>
        {endedDay.logs
          .slice()
          .reverse()
          .map((l) => {
            const c = badgeColours(l.status);
            const icon = l.status === "good" ? "✅" : l.status === "mid" ? "⚠️" : "❌";
            return (
              <View key={l.id} style={[styles.card, { borderLeftWidth: 6, borderLeftColor: c.bg }]}>
                <Text style={styles.cardTitle}>
                  {icon} {l.category} · {l.foodName}
                </Text>
                <Text style={styles.subtle}>
                  {l.calories} kcal · {l.protein}g protein · {l.sugar}g sugar · {l.salt}g salt
                </Text>
              </View>
            );
          })}
      </ScrollView>
    </View>
  );
}

function WorkoutsScreen() {
  const { workouts, setWorkouts } = useApp();
  const [name, setName] = useState("");
  const [itemLine, setItemLine] = useState("");
  const [items, setItems] = useState([]);

  const addItem = () => {
    const t = itemLine.trim();
    if (!t) return;
    setItems((prev) => [...prev, t]);
    setItemLine("");
  };

  const addWorkout = () => {
    const n = name.trim();
    if (!n || items.length === 0) {
      Alert.alert("Missing info", "Add a name and at least one line.");
      return;
    }
    setWorkouts((prev) => [...prev, { id: `w_${Date.now()}`, name: n, items: items.slice() }]);
    setName("");
    setItems([]);
    setItemLine("");
  };

  const removeWorkout = (id) => setWorkouts((prev) => prev.filter((w) => w.id !== id));

  return (
    <View style={styles.screen}>
      <Text style={styles.h1}>Workouts</Text>
      <Text style={styles.subtle}>Add or delete workouts.</Text>

      <ScrollView contentContainerStyle={{ paddingBottom: 120 }}>
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Add workout</Text>

          <Text style={styles.label}>Name</Text>
          <TextInput
            value={name}
            onChangeText={setName}
            style={styles.input}
            placeholder="Workout name"
            placeholderTextColor="#7A7A7A"
          />

          <Text style={styles.label}>Add lines</Text>
          <View style={{ flexDirection: "row", gap: 10 }}>
            <TextInput
              value={itemLine}
              onChangeText={setItemLine}
              style={[styles.input, { flex: 1 }]}
              placeholder="e.g. Push-ups x12"
              placeholderTextColor="#7A7A7A"
            />
            <Pressable style={styles.smallBtn} onPress={addItem}>
              <Text style={styles.smallBtnText}>Add</Text>
            </Pressable>
          </View>

          {items.map((it, i) => (
            <Text key={i} style={styles.bullet}>
              • {it}
            </Text>
          ))}

          <Pressable style={[styles.primaryBtn, { marginTop: 12 }]} onPress={addWorkout}>
            <Text style={styles.primaryBtnText}>Save workout</Text>
          </Pressable>
        </View>

        <Text style={styles.sectionTitle}>Saved</Text>
        {workouts.map((w) => (
          <View key={w.id} style={styles.card}>
            <View style={{ flexDirection: "row", justifyContent: "space-between", gap: 10 }}>
              <Text style={[styles.cardTitle, { flex: 1 }]}>{w.name}</Text>
              <Pressable onPress={() => removeWorkout(w.id)} style={styles.deleteBtn}>
                <Text style={styles.deleteBtnText}>Delete</Text>
              </Pressable>
            </View>
            {w.items.map((it, i) => (
              <Text key={i} style={styles.bullet}>
                • {it}
              </Text>
            ))}
          </View>
        ))}
      </ScrollView>
    </View>
  );
}

function TipsLibraryScreen() {
  return (
    <View style={styles.screen}>
      <Text style={styles.h1}>All tips</Text>
      <Text style={styles.subtle}>Quick reminders for your cut.</Text>

      <ScrollView contentContainerStyle={{ paddingBottom: 120 }}>
        {TIP_LIBRARY.map((t, i) => (
          <View key={i} style={styles.card}>
            <Text style={styles.bullet}>• {t}</Text>
          </View>
        ))}
      </ScrollView>
    </View>
  );
}

// -------------------- AI Screen (NEW) --------------------
// Calls your backend proxy: EXPO_PUBLIC_AI_BASE_URL (e.g. https://your-api.example.com)
function AIScreen() {
  const [mode, setMode] = useState("workout"); // workout | food
  const [input, setInput] = useState("");
  const [constraints, setConstraints] = useState("No gym. Home only. Quiet options if possible.");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState("");

  const baseUrl =
    process.env.EXPO_PUBLIC_AI_BASE_URL ||
    (Platform.OS === "web" ? "http://localhost:8787" : "http://10.0.2.2:8787"); // android emulator hint

  const run = async () => {
    const text = input.trim();
    if (!text) {
      Alert.alert("Missing", "Type something first.");
      return;
    }
    setLoading(true);
    setResult("");

    try {
      const res = await fetch(`${baseUrl}/ai`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode,
          input: text,
          constraints: constraints.trim(),
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "AI request failed");
      setResult(data.output || "");
    } catch (e) {
      setResult(`Error: ${e.message}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.screen}>
      <Text style={styles.h1}>AI</Text>
      <Text style={styles.subtle}>Simple substitutions + regressions.</Text>

      <View style={[styles.card, { marginTop: 10 }]}>
        <Text style={styles.cardTitle}>Pick</Text>

        <View style={{ flexDirection: "row", gap: 10 }}>
          <Pressable
            onPress={() => setMode("workout")}
            style={[
              styles.toggleBtn,
              mode === "workout" ? styles.toggleBtnActive : null,
            ]}
          >
            <Text style={styles.toggleText}>Workout</Text>
          </Pressable>

          <Pressable
            onPress={() => setMode("food")}
            style={[styles.toggleBtn, mode === "food" ? styles.toggleBtnActive : null]}
          >
            <Text style={styles.toggleText}>Food</Text>
          </Pressable>
        </View>

        <Text style={styles.label}>{mode === "workout" ? "Workout / Exercise" : "Food item"}</Text>
        <TextInput
          value={input}
          onChangeText={setInput}
          placeholder={mode === "workout" ? "e.g. Push-ups hurt wrists" : "e.g. chocolate bar"}
          placeholderTextColor="#7A7A7A"
          style={styles.input}
        />

        <Text style={styles.label}>Constraints (optional)</Text>
        <TextInput
          value={constraints}
          onChangeText={setConstraints}
          placeholder="e.g. knee pain, no jumping, vegetarian"
          placeholderTextColor="#7A7A7A"
          style={styles.input}
        />

        <Pressable style={styles.primaryBtn} onPress={run} disabled={loading}>
          {loading ? (
            <ActivityIndicator />
          ) : (
            <Text style={styles.primaryBtnText}>Get suggestions</Text>
          )}
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={{ paddingBottom: 120 }}>
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Output</Text>
          <Text style={[styles.p, { marginTop: 6 }]}>{result || "—"}</Text>
        </View>
      </ScrollView>
    </View>
  );
}

// -------------------- Navigation --------------------
const Drawer = createDrawerNavigator();
const Stack = createStackNavigator();

function HomeStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="Category" component={CategoryScreen} />
      <Stack.Screen name="Food" component={FoodScreen} />
      <Stack.Screen name="Tips" component={TipsScreen} />
      <Stack.Screen name="EndOfDay" component={EndOfDayScreen} />
    </Stack.Navigator>
  );
}

// -------------------- App --------------------
export default function App() {
  const [hydrated, setHydrated] = useState(false);

  const [workouts, setWorkouts] = useState(SEED_WORKOUTS);
  const [dayState, setDayState] = useState({ date: todayISO(), status: "LOCKED" }); // LOCKED -> ACTIVE
  const [dayLogs, setDayLogs] = useState([]);
  const [endedDays, setEndedDays] = useState([]);

  // Load persisted state
  useEffect(() => {
    (async () => {
      try {
        const raw = await AsyncStorage.getItem(STORAGE_KEY);
        if (raw) {
          const parsed = JSON.parse(raw);

          if (parsed?.workouts) setWorkouts(parsed.workouts);
          if (parsed?.dayState) setDayState(parsed.dayState);
          if (parsed?.dayLogs) setDayLogs(parsed.dayLogs);
          if (parsed?.endedDays) setEndedDays(parsed.endedDays);
        }
      } catch (e) {
        // ignore
      } finally {
        setHydrated(true);
      }
    })();
  }, []);

  // Persist on change
  useEffect(() => {
    if (!hydrated) return;
    const payload = { workouts, dayState, dayLogs, endedDays };
    AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(payload)).catch(() => {});
  }, [hydrated, workouts, dayState, dayLogs, endedDays]);

  const startNewDay = () => setDayState({ date: todayISO(), status: "ACTIVE" });
  const addLog = (entry) => setDayLogs((prev) => [...prev, entry]);

  const endDay = (navigation) => {
    const summary = scoreFromLogs(dayLogs);
    const endedDay = { date: dayState.date, logs: dayLogs.slice(), summary };

    setEndedDays((prev) => [...prev, endedDay]);
    setDayLogs([]);

    // Lock next day immediately
    setDayState({ date: todayISO(), status: "LOCKED" });

    navigation.navigate("EndOfDay", { endedDay });
  };

  const value = {
    workouts,
    setWorkouts,
    dayState,
    setDayState,
    dayLogs,
    setDayLogs,
    endedDays,
    setEndedDays,
    startNewDay,
    addLog,
    endDay,
  };

  if (!hydrated) {
    return (
      <View style={[styles.screen, { alignItems: "center", justifyContent: "center" }]}>
        <ActivityIndicator />
        <Text style={[styles.subtle, { marginTop: 10 }]}>Loading…</Text>
      </View>
    );
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <AppCtx.Provider value={value}>
        <NavigationContainer>
          <Drawer.Navigator
            screenOptions={{
              headerShown: false,
              drawerType: "front",
              overlayColor: "rgba(0,0,0,0.45)",
              drawerStyle: { width: 280 },
            }}
          >
            <Drawer.Screen name="Home" component={HomeStack} />
            <Drawer.Screen name="Workouts" component={WorkoutsScreen} />
            <Drawer.Screen name="All tips" component={TipsLibraryScreen} />
            <Drawer.Screen name="AI" component={AIScreen} />
          </Drawer.Navigator>
        </NavigationContainer>
      </AppCtx.Provider>
    </GestureHandlerRootView>
  );
}

// -------------------- Styles --------------------
const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: "#0B0F14",
    paddingTop: 54,
    paddingHorizontal: 16,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginBottom: 12,
  },
  iconBtn: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: "#121A23",
    alignItems: "center",
    justifyContent: "center",
  },
  iconText: { color: "#E8EEF5", fontSize: 18, fontWeight: "700" },
  h1: { color: "#E8EEF5", fontSize: 22, fontWeight: "800" },
  h2: { color: "#E8EEF5", fontSize: 18, fontWeight: "800", marginBottom: 6 },
  p: { color: "#B8C2CF", fontSize: 14, lineHeight: 20 },
  subtle: { color: "#94A3B8", fontSize: 13, marginTop: 2 },
  sectionTitle: {
    color: "#E8EEF5",
    fontSize: 14,
    fontWeight: "800",
    marginTop: 14,
    marginBottom: 8,
  },

  chipsWrap: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: {
    backgroundColor: "#121A23",
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 999,
  },
  chipText: { color: "#C9D4E2", fontSize: 12, fontWeight: "700" },

  card: {
    backgroundColor: "#121A23",
    borderRadius: 16,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: "#1E2A3A",
  },
  cardDisabled: { opacity: 0.45 },
  cardTitle: { color: "#E8EEF5", fontSize: 15, fontWeight: "800", marginBottom: 6 },
  cardSub: { color: "#B8C2CF", fontSize: 13 },

  bullet: { color: "#C9D4E2", fontSize: 13, lineHeight: 20, marginTop: 4 },

  foodBar: {
    backgroundColor: "#121A23",
    borderRadius: 18,
    padding: 14,
    borderWidth: 1,
    borderColor: "#1E2A3A",
  },
  label: { color: "#9FB0C5", fontSize: 12, fontWeight: "800", marginTop: 10, marginBottom: 6 },
  input: {
    backgroundColor: "#0B0F14",
    borderWidth: 1,
    borderColor: "#223146",
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: "#E8EEF5",
    fontSize: 14,
  },
  row2: { flexDirection: "row", gap: 10, marginTop: 10 },
  col: { flex: 1 },

  primaryBtn: {
    backgroundColor: "#2563EB",
    borderRadius: 14,
    paddingVertical: 12,
    alignItems: "center",
    marginTop: 14,
  },
  primaryBtnText: { color: "#E8EEF5", fontSize: 14, fontWeight: "900" },

  ghostBtn: {
    backgroundColor: "transparent",
    borderRadius: 14,
    paddingVertical: 12,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#223146",
    marginTop: 14,
  },
  ghostBtnText: { color: "#C9D4E2", fontSize: 14, fontWeight: "900" },

  banner: {
    borderRadius: 16,
    padding: 12,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
  },
  bannerText: { fontSize: 14, fontWeight: "900" },

  bottomBar: {
    position: "absolute",
    left: 16,
    right: 16,
    bottom: 18,
  },
  endDayBtn: {
    backgroundColor: "#111827",
    borderRadius: 16,
    paddingVertical: 14,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#223146",
  },
  endDayBtnDisabled: { opacity: 0.55 },
  endDayBtnText: { color: "#E8EEF5", fontSize: 14, fontWeight: "900" },

  scoreBox: {
    backgroundColor: "#0E1520",
    borderRadius: 18,
    padding: 14,
    borderWidth: 1,
    borderColor: "#1E2A3A",
    marginTop: 12,
    marginBottom: 8,
  },
  scoreTitle: { color: "#E8EEF5", fontSize: 15, fontWeight: "900", marginBottom: 6 },
  scoreLine: { color: "#B8C2CF", fontSize: 13, marginTop: 2 },

  prevDayCard: {
    backgroundColor: "#0E1520",
    borderRadius: 16,
    padding: 12,
    borderWidth: 1,
    borderColor: "#1E2A3A",
    marginBottom: 8,
  },
  prevDayTitle: { color: "#E8EEF5", fontSize: 14, fontWeight: "900" },
  prevDaySub: { color: "#B8C2CF", fontSize: 12, marginTop: 4 },

  lockOverlay: {
    flex: 1,
    backgroundColor: "rgba(10,14,20,0.85)",
    alignItems: "center",
    justifyContent: "center",
    padding: 20,
  },
  lockCard: {
    width: "100%",
    maxWidth: 380,
    backgroundColor: "#121A23",
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    borderColor: "#223146",
  },

  smallBtn: {
    backgroundColor: "#2563EB",
    borderRadius: 14,
    paddingHorizontal: 14,
    justifyContent: "center",
  },
  smallBtnText: { color: "#E8EEF5", fontWeight: "900" },

  deleteBtn: {
    backgroundColor: "#2A0F14",
    borderWidth: 1,
    borderColor: "#4A1B24",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 12,
    alignSelf: "flex-start",
  },
  deleteBtnText: { color: "#F8D7DA", fontWeight: "900", fontSize: 12 },

  toggleBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 14,
    backgroundColor: "#0B0F14",
    borderWidth: 1,
    borderColor: "#223146",
    alignItems: "center",
  },
  toggleBtnActive: {
    backgroundColor: "#16223A",
    borderColor: "#2B4B85",
  },
  toggleText: { color: "#E8EEF5", fontWeight: "900" },
});
