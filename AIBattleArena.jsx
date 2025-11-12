import React, { useMemo, useState, useEffect, useRef } from "react";

// --- Utility helpers ---
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const rand = (min, max) => Math.random() * (max - min) + min;
const randInt = (min, max) => Math.floor(rand(min, max + 1));
const choice = (arr) => arr[Math.floor(Math.random() * arr.length)];

// --- Core types ---
const BASE_POINTS = 20; // points to distribute
const STAT_KEYS = ["STR", "AGI", "INT", "VIT"]; // primary stats

const TRAITS = [
  {
    id: "aggressive",
    name: "Aggressive",
    desc: "+12% damage. -5% defense.",
    mod: (s) => ({ ...s, dmgMul: s.dmgMul * 1.12, defMul: s.defMul * 0.95 })
  },
  {
    id: "defensive",
    name: "Defensive",
    desc: "+12% defense. -5% crit.",
    mod: (s) => ({ ...s, defMul: s.defMul * 1.12, critMul: s.critMul * 0.95 })
  },
  {
    id: "precise",
    name: "Precise",
    desc: "+10% accuracy & crit.",
    mod: (s) => ({ ...s, accMul: s.accMul * 1.1, critMul: s.critMul * 1.1 })
  },
  {
    id: "unpredictable",
    name: "Unpredictable",
    desc: "Damage varies wildly (±25%), +5% evade",
    mod: (s) => ({ ...s, dmgVar: 0.25, evaMul: s.evaMul * 1.05 })
  },
  {
    id: "tactician",
    name: "Tactician",
    desc: "+12% skill/abilities. Small speed boost.",
    mod: (s) => ({ ...s, skillMul: s.skillMul * 1.12, spdMul: s.spdMul * 1.05 })
  },
  {
    id: "vampiric",
    name: "Vampiric",
    desc: "Heal 15% of damage dealt.",
    mod: (s) => ({ ...s, lifesteal: s.lifesteal + 0.15 })
  }
];

const DIFFICULTIES = {
  recruit: {
    id: "recruit",
    label: "Recruit",
    desc: "Forgiving foes with lighter builds and shaky accuracy.",
    bonusPoints: -2,
    hpMul: 0.92,
    dmgMul: 0.92,
    defMul: 0.9,
    accBonus: -0.05,
    evaBonus: -0.02
  },
  veteran: {
    id: "veteran",
    label: "Veteran",
    desc: "Balanced opponents. The classic arena experience.",
    bonusPoints: 0,
    hpMul: 1,
    dmgMul: 1,
    defMul: 1,
    accBonus: 0,
    evaBonus: 0
  },
  champion: {
    id: "champion",
    label: "Champion",
    desc: "Elite duelists with sharper instincts and tougher defenses.",
    bonusPoints: 3,
    hpMul: 1.12,
    dmgMul: 1.08,
    defMul: 1.05,
    accBonus: 0.05,
    evaBonus: 0.02,
    critBonus: 0.04,
    skillBonus: 0.03,
    spdMul: 1.04
  }
};

const PRESETS = {
  "Glass Cannon": { STR: 9, AGI: 6, INT: 3, VIT: 2, trait: "aggressive" },
  "Swift Duelist": { STR: 4, AGI: 10, INT: 3, VIT: 3, trait: "precise" },
  "Battle Mage": { STR: 3, AGI: 3, INT: 10, VIT: 4, trait: "tactician" },
  "Bruiser": { STR: 7, AGI: 4, INT: 2, VIT: 7, trait: "defensive" },
  "Leech": { STR: 6, AGI: 5, INT: 3, VIT: 6, trait: "vampiric" }
};

function deriveStats(base) {
  const STR = base.STR ?? 5;
  const AGI = base.AGI ?? 5;
  const INT = base.INT ?? 5;
  const VIT = base.VIT ?? 5;

  // Derived
  let hp = 80 + VIT * 12; // total hit points
  let atk = 10 + STR * 3.5; // physical attack
  let def = 8 + VIT * 2.5; // defense reduces damage
  let spd = 1 + AGI * 0.35; // speed/initiative
  let acc = 0.78 + AGI * 0.01 + INT * 0.003; // base accuracy
  let eva = 0.04 + AGI * 0.01; // evade chance
  let crit = 0.08 + INT * 0.008 + AGI * 0.005; // crit chance
  let skill = 0.08 + INT * 0.02; // special ability chance

  // Multipliers baseline
  let mods = {
    dmgMul: 1,
    defMul: 1,
    accMul: 1,
    evaMul: 1,
    critMul: 1,
    skillMul: 1,
    spdMul: 1,
    dmgVar: 0.1, // ±10% by default
    lifesteal: 0
  };

  return { STR, AGI, INT, VIT, hp, atk, def, spd, acc, eva, crit, skill, ...mods };
}

function applyTrait(stats, traitId) {
  const t = TRAITS.find((x) => x.id === traitId);
  return t ? t.mod({ ...stats }) : stats;
}

function formatPct(x) {
  return Math.round(x * 100);
}

function allocateBonus(spread, points) {
  const sign = Math.sign(points);
  let remaining = Math.abs(points);
  while (remaining > 0) {
    const key = choice(STAT_KEYS);
    spread[key] = clamp(spread[key] + sign, 1, 15);
    remaining -= 1;
  }
}

function applyDifficulty(stats, difficultyId) {
  const diff = DIFFICULTIES[difficultyId] ?? DIFFICULTIES.veteran;
  const next = { ...stats };
  if (diff.hpMul && diff.hpMul !== 1) {
    next.hp = Math.round(next.hp * diff.hpMul);
  }
  if (diff.spdMul && diff.spdMul !== 1) {
    next.spd *= diff.spdMul;
  }
  if (diff.dmgMul && diff.dmgMul !== 1) {
    next.dmgMul *= diff.dmgMul;
  }
  if (diff.defMul && diff.defMul !== 1) {
    next.defMul *= diff.defMul;
  }
  if (diff.accBonus) {
    next.acc = clamp(next.acc + diff.accBonus, 0, 1.25);
  }
  if (diff.evaBonus) {
    next.eva = clamp(next.eva + diff.evaBonus, 0, 0.6);
  }
  if (diff.critBonus) {
    next.crit = clamp(next.crit + diff.critBonus, 0, 0.75);
  }
  if (diff.skillBonus) {
    next.skill = clamp(next.skill + diff.skillBonus, 0, 0.9);
  }
  return next;
}

function createAI(difficultyId = "veteran") {
  const diff = DIFFICULTIES[difficultyId] ?? DIFFICULTIES.veteran;
  // AI tries to counter player's stat skew
  const archetypes = Object.keys(PRESETS);
  const preset = PRESETS[choice(archetypes)];
  const name = choice([
    "Astra",
    "Nyx",
    "Kronos",
    "Bastion",
    "Valkyr",
    "Orion",
    "Mirage",
    "Cipher",
    "Helix"
  ]);
  // Small randomization based on level
  const spread = { ...preset };
  ["STR", "AGI", "INT", "VIT"].forEach((k) => {
    spread[k] = clamp(spread[k] + randInt(-1, 1), 1, 12);
  });
  if (diff.bonusPoints) {
    allocateBonus(spread, diff.bonusPoints);
  }
  return {
    name: name + " (CPU)",
    trait: spread.trait,
    build: { STR: spread.STR, AGI: spread.AGI, INT: spread.INT, VIT: spread.VIT },
    difficulty: diff.id
  };
}

function simulateTurn(attacker, defender) {
  // Returns {log, damage, isCrit, hit, ability}
  const atkAcc = attacker.acc * attacker.accMul;
  const defEva = defender.eva * defender.evaMul;
  const hitChance = clamp(atkAcc - defEva * 0.7, 0.1, 0.98);
  const hitRoll = Math.random();
  let events = { hit: false, damage: 0, isCrit: false, ability: null, lifesteal: 0 };

  if (hitRoll <= hitChance) {
    events.hit = true;
    // Base damage
    const base = attacker.atk * attacker.dmgMul;
    const variance = 1 + (attacker.dmgVar ?? 0.1) * (Math.random() * 2 - 1);
    let dmg = base * variance - defender.def * defender.defMul * 0.45;
    dmg = Math.max(4, dmg);

    // Crit check
    if (Math.random() < attacker.crit * attacker.critMul) {
      events.isCrit = true;
      dmg *= 1.8;
    }

    // Ability check
    if (Math.random() < attacker.skill * attacker.skillMul) {
      const ability = choice(["Armor Break", "Double Strike", "Arcane Surge", "Feint"]);
      events.ability = ability;
      if (ability === "Armor Break") {
        dmg *= 1.2;
        defender.defMul *= 0.9; // temporary debuff
      } else if (ability === "Double Strike") {
        const extra = dmg * 0.55;
        dmg += extra;
      } else if (ability === "Arcane Surge") {
        dmg *= 1.25;
        attacker.accMul *= 1.05;
      } else if (ability === "Feint") {
        defender.accMul *= 0.95;
      }
    }

    events.damage = Math.round(dmg);

    if ((attacker.lifesteal ?? 0) > 0) {
      events.lifesteal = Math.round(dmg * attacker.lifesteal);
    }
  }

  return { ...events };
}

function BattleLog({ lines }) {
  const ref = useRef(null);
  useEffect(() => {
    if (ref.current) ref.current.scrollTop = ref.current.scrollHeight;
  }, [lines]);
  return (
    <div
      ref={ref}
      className="h-56 overflow-y-auto rounded-2xl border border-zinc-800 bg-zinc-950/70 p-3 text-sm"
    >
      {lines.length === 0 ? (
        <div className="text-zinc-400">Battle log will appear here…</div>
      ) : (
        lines.map((ln, i) => (
          <div key={i} className="mb-1 whitespace-pre-line">
            {ln}
          </div>
        ))
      )}
    </div>
  );
}

function StatBar({ label, value, max = 100, suffix = "" }) {
  const pct = clamp(Math.round((value / max) * 100), 0, 100);
  return (
    <div className="mb-2">
      <div className="mb-1 flex justify-between text-xs text-zinc-300">
        <span>{label}</span>
        <span>
          {value}
          {suffix}
        </span>
      </div>
      <div className="h-2 w-full rounded-full bg-zinc-800">
        <div
          className="h-2 rounded-full bg-white"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

function Card({ children, className = "" }) {
  return (
    <div className={`rounded-2xl border border-zinc-800 bg-zinc-950/60 p-4 ${className}`}>
      {children}
    </div>
  );
}

function Pill({ children }) {
  return (
    <span className="rounded-full border border-zinc-700 px-2 py-0.5 text-xs text-zinc-300">
      {children}
    </span>
  );
}

export default function AIBattleArena() {
  const [name, setName] = useState("Muna");
  const [points, setPoints] = useState(BASE_POINTS);
  const [stats, setStats] = useState({ STR: 5, AGI: 5, INT: 5, VIT: 5 });
  const [trait, setTrait] = useState("precise");
  const [difficulty, setDifficulty] = useState("veteran");
  const [ai, setAI] = useState(() => createAI("veteran"));
  const [battle, setBattle] = useState(null);
  const [log, setLog] = useState([]);
  const [autoFight, setAutoFight] = useState(false);

  const playerStats = useMemo(() => applyTrait(deriveStats(stats), trait), [stats, trait]);
  const aiStats = useMemo(() => applyDifficulty(applyTrait(deriveStats(ai.build), ai.trait), ai.difficulty), [ai]);

  function remainingPoints(next = stats) {
    const used = STAT_KEYS.reduce((acc, k) => acc + (next[k] - 5), 0);
    return BASE_POINTS - used;
  }

  function tweak(k, d) {
    const next = { ...stats, [k]: clamp(stats[k] + d, 1, 15) };
    const rem = remainingPoints(next);
    if (rem < 0) return; // can't overspend
    setStats(next);
    setPoints(rem);
  }

  function loadPreset(key) {
    const p = PRESETS[key];
    if (!p) return;
    const next = { STR: p.STR, AGI: p.AGI, INT: p.INT, VIT: p.VIT };
    setStats(next);
    setTrait(p.trait);
    setPoints(remainingPoints(next));
  }

  function startBattle() {
    const p = {
      name,
      hp: playerStats.hp,
      cur: playerStats.hp,
      ...playerStats
    };
    const e = {
      name: ai.name,
      hp: aiStats.hp,
      cur: aiStats.hp,
      ...aiStats
    };
    setBattle({ p, e, round: 1, over: false });
    const diffLabel = DIFFICULTIES[ai.difficulty]?.label ?? "Veteran";
    setLog([
      `⚔️ Battle started: ${name} (${trait}) vs ${ai.name} (${ai.trait}, ${diffLabel})`,
      `— ${name} HP ${p.cur}/${p.hp} | ${ai.name} HP ${e.cur}/${e.hp}`
    ]);
  }

  function nextTurn() {
    setBattle((prev) => {
      if (!prev || prev.over) return prev;
      let { p, e, round } = { ...prev };
      let lines = [];

      // Initiative
      const first = p.spd * p.spdMul >= e.spd * e.spdMul ? "p" : "e";
      const order = first === "p" ? ["p", "e"] : ["e", "p"];

      for (const who of order) {
        if (p.cur <= 0 || e.cur <= 0) break;
        const atk = who === "p" ? p : e;
        const def = who === "p" ? e : p;
        const res = simulateTurn(atk, def);
        if (!res.hit) {
          lines.push(`• ${atk.name} attacks → miss`);
        } else {
          let dmg = res.damage;
          def.cur = clamp(def.cur - dmg, 0, def.hp);
          let tag = res.isCrit ? " CRIT!" : "";
          if (res.ability) tag += ` [${res.ability}]`;
          lines.push(`• ${atk.name} hits for ${dmg}${tag}`);
          if (res.lifesteal > 0) {
            atk.cur = clamp(atk.cur + res.lifesteal, 0, atk.hp);
            lines.push(`  ↳ ${atk.name} lifesteals ${res.lifesteal}`);
          }
        }
      }

      // Check end
      let over = false;
      let result = "";
      if (p.cur <= 0 && e.cur <= 0) {
        over = true;
        result = "Draw";
        lines.push("🏁 Both fighters fall. It's a draw.");
      } else if (p.cur <= 0) {
        over = true;
        result = `${e.name} wins`;
        lines.push(`🏁 ${e.name} wins!`);
      } else if (e.cur <= 0) {
        over = true;
        result = `${p.name} wins`;
        lines.push(`🏁 ${p.name} wins!`);
      }

      const updated = { p, e, round: round + 1, over, result };
      setLog((L) => [...L, ...lines, `— HP ${p.cur}/${p.hp} vs ${e.cur}/${e.hp}`]);
      return updated;
    });
  }

  useEffect(() => {
    if (!autoFight) return;
    if (!battle || battle.over) return;
    const t = setTimeout(() => nextTurn(), 450);
    return () => clearTimeout(t);
  }, [autoFight, battle]);

  function resetAI() {
    setAI(() => createAI(difficulty));
    setBattle(null);
    setLog([]);
  }

  function resetBuild() {
    setStats({ STR: 5, AGI: 5, INT: 5, VIT: 5 });
    setTrait("precise");
    setPoints(BASE_POINTS);
  }

  const inBattle = !!battle;

  return (
    <div className="mx-auto max-w-5xl p-4 text-zinc-100">
      <h1 className="mb-1 text-2xl font-bold">AI Battle Arena</h1>
      <p className="mb-4 text-zinc-300">Build your fighter, select a trait, and battle a procedural AI. Optimize stats, read the log, toggle auto-fight, and iterate.</p>

      <div className="grid gap-4 md:grid-cols-3">
        {/* Builder */}
        <Card>
          <div className="mb-3 flex items-center justify-between">
            <input
              className="w-2/3 rounded-xl border border-zinc-700 bg-zinc-900/70 px-3 py-2 text-sm outline-none"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Fighter name"
            />
            <button
              onClick={resetBuild}
              className="rounded-xl border border-zinc-700 px-3 py-2 text-xs hover:bg-zinc-800"
            >
              Reset
            </button>
          </div>

          <div className="mb-2 text-sm text-zinc-300">Points remaining: <Pill>{points}</Pill></div>
          {STAT_KEYS.map((k) => (
            <div key={k} className="mb-2">
              <div className="mb-1 flex items-center justify-between text-sm">
                <span>{k}</span>
                <span className="text-zinc-400">{stats[k]}</span>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => tweak(k, -1)}
                  className="w-10 rounded-xl border border-zinc-700 py-1 hover:bg-zinc-800"
                >
                  −
                </button>
                <input
                  type="range"
                  min={1}
                  max={15}
                  value={stats[k]}
                  onChange={(e) => tweak(k, Math.sign(e.target.value - stats[k]))}
                  className="flex-1"
                />
                <button
                  onClick={() => tweak(k, +1)}
                  className="w-10 rounded-xl border border-zinc-700 py-1 hover:bg-zinc-800"
                >
                  +
                </button>
              </div>
            </div>
          ))}

          <div className="mt-4">
            <div className="mb-1 text-sm">Trait</div>
            <div className="grid grid-cols-2 gap-2">
              {TRAITS.map((t) => (
                <button
                  key={t.id}
                  onClick={() => setTrait(t.id)}
                  className={`rounded-xl border px-3 py-2 text-left text-xs hover:bg-zinc-800 ${
                    trait === t.id ? "border-white" : "border-zinc-700"
                  }`}
                >
                  <div className="font-semibold">{t.name}</div>
                  <div className="text-zinc-400">{t.desc}</div>
                </button>
              ))}
            </div>
          </div>

          <div className="mt-4">
            <div className="mb-1 text-sm">Presets</div>
            <div className="flex flex-wrap gap-2">
              {Object.keys(PRESETS).map((k) => (
                <button
                  key={k}
                  onClick={() => loadPreset(k)}
                  className="rounded-full border border-zinc-700 px-3 py-1 text-xs hover:bg-zinc-800"
                >
                  {k}
                </button>
              ))}
            </div>
          </div>
        </Card>

        {/* Stat panels */}
        <Card>
          <div className="mb-2 text-sm font-semibold">Your Build</div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <StatBar label="HP" value={playerStats.hp} max={200} />
              <StatBar label="ATK" value={Math.round(playerStats.atk)} max={80} />
              <StatBar label="DEF" value={Math.round(playerStats.def)} max={60} />
              <StatBar label="SPD" value={Math.round(playerStats.spd * 10)} max={60} />
            </div>
            <div>
              <div className="text-xs text-zinc-300">Acc {formatPct(playerStats.acc * playerStats.accMul)}%</div>
              <div className="text-xs text-zinc-300">Eva {formatPct(playerStats.eva * playerStats.evaMul)}%</div>
              <div className="text-xs text-zinc-300">Crit {formatPct(playerStats.crit * playerStats.critMul)}%</div>
              <div className="text-xs text-zinc-300">Skill {formatPct(playerStats.skill * playerStats.skillMul)}%</div>
              <div className="text-xs text-zinc-300">Trait: <Pill>{TRAITS.find(t=>t.id===trait)?.name}</Pill></div>
            </div>
          </div>
        </Card>

        <Card>
          <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
            <div className="text-sm font-semibold">Opponent</div>
            <div className="flex flex-wrap items-center gap-2">
              <label className="text-xs text-zinc-300">
                Difficulty
                <select
                  value={difficulty}
                  onChange={(e) => {
                    const next = e.target.value;
                    setDifficulty(next);
                    setAI(() => createAI(next));
                    setBattle(null);
                    setLog([]);
                  }}
                  className="ml-2 rounded-lg border border-zinc-700 bg-zinc-900/70 px-2 py-1 text-xs"
                >
                  {Object.values(DIFFICULTIES).map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.label}
                    </option>
                  ))}
                </select>
              </label>
              <button
                onClick={resetAI}
                className="rounded-xl border border-zinc-700 px-3 py-1 text-xs hover:bg-zinc-800"
              >
                New Opponent
              </button>
            </div>
          </div>
          <div className="text-sm font-semibold">{ai.name}</div>
          <div className="mb-1 text-xs text-zinc-400">Trait: {TRAITS.find(t=>t.id===ai.trait)?.name}</div>
          <div className="mb-3 text-xs text-zinc-400">{DIFFICULTIES[ai.difficulty]?.desc}</div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <StatBar label="HP" value={aiStats.hp} max={200} />
              <StatBar label="ATK" value={Math.round(aiStats.atk)} max={80} />
              <StatBar label="DEF" value={Math.round(aiStats.def)} max={60} />
              <StatBar label="SPD" value={Math.round(aiStats.spd * 10)} max={60} />
            </div>
            <div>
              <div className="text-xs text-zinc-300">Acc {formatPct(aiStats.acc * aiStats.accMul)}%</div>
              <div className="text-xs text-zinc-300">Eva {formatPct(aiStats.eva * aiStats.evaMul)}%</div>
              <div className="text-xs text-zinc-300">Crit {formatPct(aiStats.crit * aiStats.critMul)}%</div>
              <div className="text-xs text-zinc-300">Skill {formatPct(aiStats.skill * aiStats.skillMul)}%</div>
              <div className="text-xs text-zinc-300">Build: {STAT_KEYS.map(k=>`${k}${ai.build[k]}`).join("/")}</div>
              <div className="text-xs text-zinc-300">Difficulty: {DIFFICULTIES[ai.difficulty]?.label}</div>
            </div>
          </div>
        </Card>
      </div>

      {/* Battle zone */}
      <div className="mt-4 grid gap-4 md:grid-cols-3">
        <Card className="md:col-span-2">
          <div className="mb-3 flex items-center justify-between">
            <div className="text-sm font-semibold">Arena</div>
            <div className="flex items-center gap-2">
              <label className="flex items-center gap-2 text-xs text-zinc-300">
                <input type="checkbox" className="accent-white" checked={autoFight} onChange={(e)=>setAutoFight(e.target.checked)} />
                Auto-fight
              </label>
              {!battle || battle.over ? (
                <button
                  onClick={startBattle}
                  className="rounded-xl border border-zinc-700 px-3 py-1 text-xs hover:bg-zinc-800"
                >
                  Start
                </button>
              ) : (
                <button
                  onClick={nextTurn}
                  className="rounded-xl border border-zinc-700 px-3 py-1 text-xs hover:bg-zinc-800"
                >
                  Next Turn
                </button>
              )}
              <button
                onClick={() => { setBattle(null); setLog([]); }}
                className="rounded-xl border border-zinc-700 px-3 py-1 text-xs hover:bg-zinc-800"
              >
                Reset Battle
              </button>
            </div>
          </div>

          {/* Health bars if in battle */}
          {battle ? (
            <div className="mb-3 grid grid-cols-2 gap-4">
              <div>
                <div className="mb-1 flex justify-between text-sm"><span>{battle.p.name}</span><span>{battle.p.cur}/{battle.p.hp}</span></div>
                <div className="h-3 w-full rounded-full bg-zinc-800">
                  <div className="h-3 rounded-full bg-white" style={{ width: `${clamp((battle.p.cur / battle.p.hp) * 100,0,100)}%` }} />
                </div>
              </div>
              <div>
                <div className="mb-1 flex justify-between text-sm"><span>{battle.e.name}</span><span>{battle.e.cur}/{battle.e.hp}</span></div>
                <div className="h-3 w-full rounded-full bg-zinc-800">
                  <div className="h-3 rounded-full bg-white" style={{ width: `${clamp((battle.e.cur / battle.e.hp) * 100,0,100)}%` }} />
                </div>
              </div>
            </div>
          ) : (
            <div className="mb-3 rounded-xl border border-dashed border-zinc-700 p-6 text-center text-sm text-zinc-400">
              Configure your fighter and press <span className="text-zinc-200">Start</span> to battle.
            </div>
          )}

          <BattleLog lines={log} />

          {battle?.over && (
            <div className="mt-3 rounded-xl border border-zinc-700 p-3 text-center text-sm">
              <div className="mb-2 text-lg font-bold">{battle.result}</div>
              <div className="text-zinc-400">Tweak stats or trait, generate a new opponent, and run it back.</div>
            </div>
          )}
        </Card>

        {/* Tips */}
        <Card>
          <div className="mb-2 text-sm font-semibold">Tips</div>
          <ul className="list-disc space-y-1 pl-5 text-sm text-zinc-300">
            <li>AGI boosts accuracy, evasion, and speed (more turns and fewer enemy hits).</li>
            <li>INT boosts crit and ability rate; with Tactician it snowballs.</li>
            <li>VIT scales HP and defense; solid vs bursty builds.</li>
            <li>Unpredictable + high STR can delete or whiff — gamble build.</li>
            <li>Vampiric scales with damage — shines in longer fights.</li>
          </ul>
          <div className="mt-3 text-xs text-zinc-400">
            Made for supervised study: quiet UI, single-file, no external deps.
          </div>
        </Card>
      </div>

      <div className="mt-6 text-center text-xs text-zinc-400">v1.0 — tweakable combat simulator. Want tournaments, inventories, or multi-enemy waves next?</div>
    </div>
  );
}
