import React, { useEffect, useMemo, useState } from "react";

const DEFAULT_PLAYERS = ["Finn", "Anton", "Theo", "Noah", "Riley", "Jude", "Leo", "Mason", "Harry", "Oscar"];
const FORMATIONS = ["3-2-1", "2-3-1", "2-2-2", "3-1-2"];
const OWN_GOAL = "Own Goal";
const STORAGE_KEY = "u10-football-stats-tracker-v2";

const sampleOpponents = [
  "Hibiscus Coast",
  "Glenfield",
  "Takapuna",
  "Forrest Hill",
  "East Coast Bays",
  "North Shore United",
  "Birkenhead",
  "Waiheke",
  "Metro",
  "Fencibles",
  "Western Springs",
  "Bay Olympic",
  "Central United",
  "Onehunga Sports",
  "Ellerslie",
  "Bucklands Beach",
  "West Coast Rangers",
  "Manurewa",
  "Papakura City",
  "Albany United",
];

const sampleScores = [
  [5, 2],
  [3, 3],
  [4, 1],
  [2, 4],
  [6, 2],
  [1, 1],
  [3, 2],
  [2, 3],
  [5, 0],
  [4, 4],
  [2, 1],
  [1, 3],
  [6, 3],
  [3, 1],
  [0, 2],
  [4, 2],
  [2, 2],
  [5, 3],
  [3, 0],
  [4, 1],
];

function addDays(dateString, days) {
  const date = new Date(`${dateString}T00:00:00`);
  date.setDate(date.getDate() + days);
  return date.toISOString().slice(0, 10);
}

function n(value) {
  if (value === "" || value === null || value === undefined) return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function fmt(value) {
  const number = n(value);
  return number === null ? "—" : number.toFixed(1);
}

function clampRating(value) {
  const number = n(value);
  if (number === null) return "";
  return Math.max(0, Math.min(10, Math.round(number)));
}

function whole(value) {
  const number = n(value);
  if (number === null) return 0;
  return Math.max(0, Math.floor(number));
}

function average(records) {
  const values = (records || []).map((record) => n(record.rating)).filter((value) => value !== null);
  if (!values.length) return null;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function getKickoffBand(time) {
  if (!time) return "Unknown";
  const hour = Number(String(time).split(":")[0]);
  if (!Number.isFinite(hour)) return "Unknown";
  if (hour < 10) return "Early";
  if (hour < 12) return "Mid-Morning";
  if (hour < 15) return "Afternoon";
  return "Late";
}

function getOutcome(match) {
  const us = n(match?.teamGoals);
  const them = n(match?.opponentGoals);
  if (us === null || them === null) return "No Result Yet";
  if (us > them) return "Win";
  if (us < them) return "Loss";
  return "Draw";
}

function getScore(match) {
  const us = n(match?.teamGoals);
  const them = n(match?.opponentGoals);
  if (us === null || them === null) return "No Score Yet";
  return `${us}-${them}`;
}

function getResult(match) {
  const score = getScore(match);
  return score === "No Score Yet" ? "No Result Yet" : `${getOutcome(match)} ${score}`;
}

function playerPlayed(match, name) {
  return Boolean((match.players || []).find((player) => player.name === name && player.played));
}

function normaliseGoal(goal, index, match) {
  const isOpponent = goal.team === "Opponent";
  let scorer = isOpponent ? "" : goal.scorer || "";
  let assister = isOpponent || scorer === OWN_GOAL ? "" : goal.assister || "";

  if (scorer && scorer !== OWN_GOAL && !playerPlayed(match, scorer)) scorer = "";
  if (assister && (!playerPlayed(match, assister) || assister === scorer)) assister = "";

  return {
    id: goal.id || `${Date.now()}-${index}-${Math.random()}`,
    team: isOpponent ? "Opponent" : "Us",
    scorer,
    assister,
    half: goal.half === "Second Half" ? "Second Half" : "First Half",
  };
}

function syncMatch(match) {
  const timeline = (match.goalTimeline || []).map((goal, index) => normaliseGoal(goal, index, match));
  const goals = {};
  const assists = {};

  for (const goal of timeline) {
    if (goal.team === "Us" && goal.scorer && goal.scorer !== OWN_GOAL) {
      goals[goal.scorer] = (goals[goal.scorer] || 0) + 1;
    }
    if (goal.team === "Us" && goal.assister && goal.scorer !== OWN_GOAL) {
      assists[goal.assister] = (assists[goal.assister] || 0) + 1;
    }
  }

  return {
    ...match,
    goalTimeline: timeline,
    teamGoals: timeline.filter((goal) => goal.team === "Us").length,
    opponentGoals: timeline.filter((goal) => goal.team === "Opponent").length,
    players: (match.players || []).map((player) => ({
      ...player,
      goals: goals[player.name] || 0,
      assists: assists[player.name] || 0,
    })),
  };
}

function makeGoalTimeline(us, them) {
  const total = whole(us) + whole(them);
  let usAdded = 0;
  let themAdded = 0;
  const timeline = [];

  for (let i = 0; i < total; i += 1) {
    const half = i < Math.ceil(total / 2) ? "First Half" : "Second Half";
    const addUs = usAdded < whole(us) && (themAdded >= whole(them) || (i + whole(us)) % 3 !== 0);

    if (addUs) {
      usAdded += 1;
      timeline.push({ id: `g-${i}`, team: "Us", scorer: "", assister: "", half });
    } else {
      themAdded += 1;
      timeline.push({ id: `g-${i}`, team: "Opponent", scorer: "", assister: "", half });
    }
  }

  return timeline;
}

function makeTraining() {
  return Array.from({ length: 20 }, (_, week) => ({
    id: week + 1,
    date: addDays("2026-04-30", week * 7),
    attendance: Object.fromEntries(
      DEFAULT_PLAYERS.map((player, index) => [player, (week + index) % 6 !== 0 && (week * 2 + index) % 11 !== 0])
    ),
  }));
}

function makeMatches() {
  const training = makeTraining();
  const kickoffTimes = ["09:00", "09:30", "10:15", "11:00", "11:30", "12:30", "13:00", "14:00"];
  const competitions = ["Grading", "Grading", "League", "League", "Cup"];
  const baseRatings = [7, 6, 8, 6, 7, 6, 5, 7, 6, 8];
  const scorerPool = ["Theo", "Oscar", "Finn", "Mason"];

  return Array.from({ length: 20 }, (_, week) => {
    const [teamGoals, opponentGoals] = sampleScores[week];
    const venue = week % 2 === 0 ? "Home" : "Away";
    const competition = competitions[Math.min(competitions.length - 1, Math.floor(week / 4))];
    const kickoffTime = kickoffTimes[week % kickoffTimes.length];
    const formation = FORMATIONS[week % FORMATIONS.length];

    const players = DEFAULT_PLAYERS.map((name, index) => {
      const played = (week + index) % 9 !== 0;
      const attended = Boolean(training[week].attendance[name]);
      const venueBoost = venue === "Home" && ["Finn", "Theo", "Oscar"].includes(name) ? 1 : 0;
      const earlyBoost = kickoffTime < "10:00" && ["Mason", "Noah"].includes(name) ? 1 : 0;
      const formationBoost =
        (formation === "3-2-1" && ["Theo", "Oscar"].includes(name)) ||
        (formation === "2-3-1" && ["Mason", "Noah"].includes(name)) ||
        (formation === "2-2-2" && ["Finn", "Jude"].includes(name)) ||
        (formation === "3-1-2" && ["Anton", "Harry"].includes(name))
          ? 1
          : 0;
      const resultBoost = teamGoals > opponentGoals ? 1 : teamGoals < opponentGoals ? -1 : 0;
      const noise = ((week + index * 2) % 5) - 2;
      const rating = played ? clampRating(baseRatings[index] + venueBoost + earlyBoost + formationBoost + resultBoost + noise + (attended ? 0 : -1)) : "";
      return { name, played, rating, goals: 0, assists: 0 };
    });

    const playedNames = players.filter((player) => player.played).map((player) => player.name);

    const match = {
      id: week + 1,
      opponent: sampleOpponents[week],
      venue,
      competition,
      kickoffTime,
      formation,
      date: addDays("2026-05-03", week * 7),
      teamGoals,
      opponentGoals,
      goalTimeline: makeGoalTimeline(teamGoals, opponentGoals).map((goal, index) => {
        if (goal.team !== "Us") return goal;
        const availableScorers = scorerPool.filter((name) => playedNames.includes(name));
        const scorer = availableScorers[(week + index) % Math.max(1, availableScorers.length)] || playedNames[0] || OWN_GOAL;
        const possibleAssisters = playedNames.filter((name) => name !== scorer);
        const assister = index % 3 === 0 || scorer === OWN_GOAL ? "" : possibleAssisters[(week + index) % Math.max(1, possibleAssisters.length)] || "";
        return { ...goal, scorer, assister };
      }),
      players,
    };

    return syncMatch(match);
  });
}

function defaultPredictor() {
  return {
    opponent: "Upcoming Opponent",
    venue: "Home",
    competition: "League",
    kickoffTime: "09:00",
    formation: "3-2-1",
    date: new Date().toISOString().slice(0, 10),
  };
}

function defaultState() {
  return {
    players: DEFAULT_PLAYERS,
    matches: makeMatches(),
    trainingSessions: makeTraining(),
    selectedPlayer: DEFAULT_PLAYERS[0],
    playerSummarySort: "avgRating",
    predictorInput: defaultPredictor(),
  };
}

function loadState() {
  const defaults = defaultState();
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaults;
    const saved = JSON.parse(raw);
    const players = Array.isArray(saved.players) ? saved.players.filter(Boolean) : defaults.players;
    const matches = Array.isArray(saved.matches) ? saved.matches.map(syncMatch) : defaults.matches;
    const trainingSessions = Array.isArray(saved.trainingSessions) ? saved.trainingSessions : defaults.trainingSessions;
    const selectedPlayer = players.includes(saved.selectedPlayer) ? saved.selectedPlayer : players[0] || "";

    return {
      players,
      matches,
      trainingSessions,
      selectedPlayer,
      playerSummarySort: saved.playerSummarySort || "avgRating",
      predictorInput: { ...defaultPredictor(), ...(saved.predictorInput || {}) },
    };
  } catch {
    return defaults;
  }
}

function saveState(state) {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // ignored
  }
}

function makePlayerStats(players, matches, trainingSessions) {
  return players.map((name) => {
    const records = matches
      .map((match) => {
        const player = match.players.find((p) => p.name === name);
        return {
          matchId: match.id,
          opponent: match.opponent,
          venue: match.venue,
          competition: match.competition,
          kickoffTime: match.kickoffTime,
          kickoffBand: getKickoffBand(match.kickoffTime),
          formation: match.formation,
          result: getResult(match),
          date: match.date,
          rating: n(player?.rating),
          played: Boolean(player?.played),
          goals: whole(player?.goals),
          assists: whole(player?.assists),
        };
      })
      .filter((record) => record.played && record.rating !== null)
      .sort((a, b) => `${a.date} ${a.kickoffTime}`.localeCompare(`${b.date} ${b.kickoffTime}`));

    const avgRating = average(records);
    const last = records.at(-1)?.rating ?? null;
    const previous = records.at(-2)?.rating ?? null;

    return {
      name,
      records,
      matchesPlayed: records.length,
      avgRating,
      last,
      previous,
      trend: last !== null && previous !== null ? last - previous : null,
      goals: records.reduce((sum, record) => sum + record.goals, 0),
      assists: records.reduce((sum, record) => sum + record.assists, 0),
      trainingAttended: trainingSessions.filter((session) => session.attendance?.[name]).length,
      trainingTotal: trainingSessions.length,
      homeAverage: average(records.filter((record) => record.venue === "Home")),
      awayAverage: average(records.filter((record) => record.venue === "Away")),
      bestKickoffBand: groupAverage(records, "kickoffBand")[0]?.name || "—",
      bestFormation: groupAverage(records, "formation")[0]?.name || "—",
    };
  });
}

function allRecords(playerStats) {
  return playerStats.flatMap((player) => player.records.map((record) => ({ ...record, player: player.name })));
}

function groupAverage(records, key) {
  const groups = {};
  for (const record of records || []) {
    const name = record[key] || "Unknown";
    if (!groups[name]) groups[name] = [];
    groups[name].push(record);
  }

  return Object.entries(groups)
    .map(([name, groupRecords]) => ({ name, average: average(groupRecords), count: groupRecords.length }))
    .sort((a, b) => (b.average || 0) - (a.average || 0) || a.name.localeCompare(b.name));
}

function trainingEffect(players, matches, trainingSessions) {
  const sortedMatches = [...matches].sort((a, b) => `${a.date} ${a.kickoffTime}`.localeCompare(`${b.date} ${b.kickoffTime}`));
  const sortedTraining = [...trainingSessions].sort((a, b) => String(a.date).localeCompare(String(b.date)));
  const records = [];

  for (const player of players) {
    for (const match of sortedMatches) {
      const playerMatch = match.players.find((p) => p.name === player);
      const rating = n(playerMatch?.rating);
      if (!playerMatch?.played || rating === null) continue;
      const previousTraining = [...sortedTraining].reverse().find((session) => String(session.date) < String(match.date));
      if (!previousTraining) continue;
      records.push({ player, rating, attended: Boolean(previousTraining.attendance?.[player]) });
    }
  }

  const attended = records.filter((record) => record.attended);
  const missed = records.filter((record) => !record.attended);
  const avg = (items) => (items.length ? items.reduce((sum, record) => sum + record.rating, 0) / items.length : null);

  return {
    attendedAverage: avg(attended),
    missedAverage: avg(missed),
    attendedCount: attended.length,
    missedCount: missed.length,
  };
}

function playerTrainingEffect(playerName, matches, trainingSessions) {
  if (!playerName) return { attendedAverage: null, missedAverage: null, attendedCount: 0, missedCount: 0 };
  return trainingEffect([playerName], matches, trainingSessions);
}

function goalCombos(matches) {
  const combos = {};
  for (const match of matches) {
    for (const goal of match.goalTimeline || []) {
      if (goal.team !== "Us" || !goal.scorer || !goal.assister || goal.scorer === OWN_GOAL) continue;
      const key = `${goal.assister} → ${goal.scorer}`;
      combos[key] = (combos[key] || 0) + 1;
    }
  }
  return Object.entries(combos)
    .map(([combo, count]) => ({ combo, count }))
    .sort((a, b) => b.count - a.count || a.combo.localeCompare(b.combo));
}

function teamSummary(matches, records, effect) {
  const completed = matches.filter((match) => n(match.teamGoals) !== null && n(match.opponentGoals) !== null);
  const wins = completed.filter((match) => getOutcome(match) === "Win").length;
  const draws = completed.filter((match) => getOutcome(match) === "Draw").length;
  const losses = completed.filter((match) => getOutcome(match) === "Loss").length;
  const goalsFor = completed.reduce((sum, match) => sum + whole(match.teamGoals), 0);
  const goalsAgainst = completed.reduce((sum, match) => sum + whole(match.opponentGoals), 0);

  const firstHalfFor = completed.reduce((sum, match) => sum + match.goalTimeline.filter((goal) => goal.half !== "Second Half" && goal.team === "Us").length, 0);
  const firstHalfAgainst = completed.reduce((sum, match) => sum + match.goalTimeline.filter((goal) => goal.half !== "Second Half" && goal.team === "Opponent").length, 0);
  const secondHalfFor = completed.reduce((sum, match) => sum + match.goalTimeline.filter((goal) => goal.half === "Second Half" && goal.team === "Us").length, 0);
  const secondHalfAgainst = completed.reduce((sum, match) => sum + match.goalTimeline.filter((goal) => goal.half === "Second Half" && goal.team === "Opponent").length, 0);

  const scoredFirst = completed.filter((match) => match.goalTimeline[0]?.team === "Us");
  const concededFirst = completed.filter((match) => match.goalTimeline[0]?.team === "Opponent");
  const recordFor = (items) => ["Win", "Draw", "Loss"].map((result) => items.filter((match) => getOutcome(match) === result).length).join("-");

  const firstHalfGD = firstHalfFor - firstHalfAgainst;
  const secondHalfGD = secondHalfFor - secondHalfAgainst;

  return {
    matches: matches.length,
    completedMatches: completed.length,
    wins,
    draws,
    losses,
    goalsFor,
    goalsAgainst,
    goalDifference: goalsFor - goalsAgainst,
    firstHalfFor,
    firstHalfAgainst,
    firstHalfGD,
    secondHalfFor,
    secondHalfAgainst,
    secondHalfGD,
    betterHalf: firstHalfGD > secondHalfGD ? "First Half" : secondHalfGD > firstHalfGD ? "Second Half" : "Even",
    scoredFirst: scoredFirst.length,
    concededFirst: concededFirst.length,
    scoredFirstRecord: recordFor(scoredFirst),
    concededFirstRecord: recordFor(concededFirst),
    firstGoalLogged: completed.filter((match) => match.goalTimeline.length).length,
    averageTeamRating: average(records),
    bestVenue: groupAverage(records, "venue")[0] || null,
    bestKickoffBand: groupAverage(records, "kickoffBand")[0] || null,
    bestCompetition: groupAverage(records, "competition")[0] || null,
    bestFormation: groupAverage(records, "formation")[0] || null,
    venueGroups: groupAverage(records, "venue"),
    kickoffGroups: groupAverage(records, "kickoffBand"),
    competitionGroups: groupAverage(records, "competition"),
    formationGroups: groupAverage(records, "formation"),
    goalCombos: goalCombos(matches),
    trainingEffect: effect,
  };
}

function sortSummary(players, key) {
  const safe = [...players];
  if (key === "name") return safe.sort((a, b) => a.name.localeCompare(b.name));
  return safe.sort((a, b) => (n(b[key]) ?? -1) - (n(a[key]) ?? -1) || a.name.localeCompare(b.name));
}

function getAverageFor(records, key, value) {
  return average(records.filter((record) => record[key] === value));
}

function predictRows(playerStats, input, trainingSessions) {
  return playerStats
    .map((player) => {
      if (n(player.avgRating) === null) return null;
      const records = player.records;
      const latestTraining = [...trainingSessions].sort((a, b) => String(a.date).localeCompare(String(b.date))).at(-1);
      const attended = Boolean(latestTraining?.attendance?.[player.name]);
      const kickoffBand = getKickoffBand(input.kickoffTime);
      const factors = [
        { value: player.avgRating, weight: 0.35 },
        { value: average(records.slice(-3)), weight: 0.2 },
        { value: getAverageFor(records, "venue", input.venue), weight: 0.15 },
        { value: getAverageFor(records, "formation", input.formation), weight: 0.15 },
        { value: getAverageFor(records, "kickoffBand", kickoffBand), weight: 0.1 },
        { value: getAverageFor(records, "competition", input.competition), weight: 0.05 },
      ].filter((factor) => n(factor.value) !== null);

      const total = factors.reduce((sum, factor) => sum + factor.value * factor.weight, 0);
      const weights = factors.reduce((sum, factor) => sum + factor.weight, 0);
      const predicted = Math.max(0, Math.min(10, total / weights + (attended ? 0.2 : -0.4)));

      return {
        player: player.name,
        predicted,
        seasonAverage: player.avgRating,
        recentAverage: average(records.slice(-3)),
        venueAverage: getAverageFor(records, "venue", input.venue),
        formationAverage: getAverageFor(records, "formation", input.formation),
        kickoffAverage: getAverageFor(records, "kickoffBand", kickoffBand),
        competitionAverage: getAverageFor(records, "competition", input.competition),
        latestTraining: latestTraining ? (attended ? "Attended" : "Missed") : "Unknown",
        matchesUsed: records.length,
      };
    })
    .filter(Boolean)
    .sort((a, b) => b.predicted - a.predicted || a.player.localeCompare(b.player));
}

function chartData(records) {
  const safe = Array.isArray(records) ? records : [];
  const width = 1000;
  const height = 260;
  const padding = { top: 24, right: 24, bottom: 52, left: 42 };
  const plotWidth = width - padding.left - padding.right;
  const plotHeight = height - padding.top - padding.bottom;
  const denominator = Math.max(1, safe.length - 1);

  const points = safe.map((record, index) => {
    const rating = n(record.rating) ?? 0;
    const x = padding.left + (index / denominator) * plotWidth;
    const y = padding.top + ((10 - rating) / 10) * plotHeight;
    return { ...record, index, rating, x, y };
  });

  return {
    width,
    height,
    padding,
    plotWidth,
    plotHeight,
    points,
    linePath: points.map((point, index) => `${index === 0 ? "M" : "L"} ${point.x} ${point.y}`).join(" "),
  };
}

function Button({ children, onClick, variant = "primary", type = "button", disabled = false }) {
  const base = "rounded-xl px-3 py-2 text-sm font-semibold transition active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-40";
  const styles = variant === "outline" ? "border border-slate-300 bg-white text-slate-800 hover:bg-slate-100" : "bg-slate-900 text-white hover:bg-slate-700";
  return (
    <button type={type} onClick={onClick} disabled={disabled} className={`${base} ${styles}`}>
      {children}
    </button>
  );
}

function Input(props) {
  const { className = "", ...rest } = props;
  return <input {...rest} className={`w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-slate-900 ${className}`} />;
}

function SelectInput({ value, onChange, children, className = "" }) {
  return (
    <select value={value} onChange={onChange} className={`w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-slate-900 ${className}`}>
      {children}
    </select>
  );
}

function Card({ children, className = "" }) {
  return <div className={`rounded-2xl bg-white shadow-sm sm:rounded-3xl ${className}`}>{children}</div>;
}

function SummaryCard({ label, value, detail }) {
  return (
    <Card>
      <div className="p-4 sm:p-5">
        <p className="heading-label text-sm text-slate-500">{label}</p>
        <p className="break-words text-2xl font-bold sm:text-3xl">{value}</p>
        <p className="heading-label text-xs text-slate-500">{detail}</p>
      </div>
    </Card>
  );
}

function SummaryPanel({ label, value, detail }) {
  return (
    <div className="rounded-2xl bg-slate-100 p-4">
      <p className="heading-label text-sm text-slate-500">{label}</p>
      <p className="text-2xl font-bold sm:text-3xl">{value}</p>
      <p className="heading-label text-xs text-slate-500">{detail}</p>
    </div>
  );
}

function TrendChart({ records }) {
  const safe = Array.isArray(records) ? records : [];
  const chart = chartData(safe);

  if (!safe.length) {
    return <div className="flex h-56 items-center justify-center rounded-2xl bg-slate-100 text-sm text-slate-500 sm:h-72">No Match Ratings Yet For This Player.</div>;
  }

  return (
    <div className="rounded-2xl bg-slate-100 p-3 sm:p-4">
      <div className="mb-3 flex flex-wrap gap-2 text-xs text-slate-600">
        <span className="rounded-full bg-white px-3 py-1 font-semibold">Season Trend</span>
        <span className="rounded-full bg-white px-3 py-1">{safe.length} Rated Matches</span>
        <span className="rounded-full bg-white px-3 py-1">Latest: {fmt(safe.at(-1)?.rating)}</span>
      </div>

      <div className="rounded-2xl bg-white p-2 sm:p-3">
        <svg className="h-auto w-full" viewBox={`0 0 ${chart.width} ${chart.height}`} role="img" aria-label="Player Rating Trend Chart">
          {[0, 2, 4, 6, 8, 10].map((tick) => {
            const y = chart.padding.top + ((10 - tick) / 10) * chart.plotHeight;
            return (
              <g key={tick}>
                <line x1={chart.padding.left} x2={chart.width - chart.padding.right} y1={y} y2={y} stroke="#e2e8f0" strokeWidth="1" />
                <text x={chart.padding.left - 10} y={y + 4} textAnchor="end" fontSize="11" fill="#64748b">
                  {tick}
                </text>
              </g>
            );
          })}

          <line x1={chart.padding.left} x2={chart.width - chart.padding.right} y1={chart.height - chart.padding.bottom} y2={chart.height - chart.padding.bottom} stroke="#94a3b8" strokeWidth="1" />

          {chart.linePath && <path d={chart.linePath} fill="none" stroke="#0f172a" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />}

          {chart.points.map((point) => {
            const showWeek = safe.length <= 12;
            const showVenue = safe.length <= 8;

            return (
              <g key={`${point.matchId}-${point.opponent}-point`}>
                <circle cx={point.x} cy={point.y} r="6" fill="#0f172a">
                  <title>{`${point.opponent} · ${point.venue} · ${point.formation || "No Formation"} · ${point.kickoffTime || "No Time"} · ${point.result}: ${point.rating}/10`}</title>
                </circle>
                <text x={point.x} y={point.y - 10} textAnchor="middle" fontSize="11" fontWeight="700" fill="#334155">
                  {point.rating}
                </text>
                {showWeek && (
                  <text x={point.x} y={chart.height - 32} textAnchor="middle" fontSize="10" fill="#64748b">
                    W{point.index + 1}
                  </text>
                )}
                {showVenue && (
                  <text x={point.x} y={chart.height - 17} textAnchor="middle" fontSize="10" fill="#64748b">
                    {point.venue === "Home" ? "H" : "A"} {point.kickoffTime || ""}
                  </text>
                )}
              </g>
            );
          })}
        </svg>
      </div>

      <div className="mt-3 grid gap-2 text-xs text-slate-600 sm:grid-cols-2 lg:grid-cols-4">
        {safe.slice(-4).map((record) => (
          <div key={`${record.matchId}-${record.opponent}-summary`} className="rounded-xl bg-white p-3">
            <p className="font-semibold text-slate-900">{record.opponent}</p>
            <p>
              {record.result} · {record.venue} · {record.formation} · {record.kickoffTime || "No Time"}
            </p>
            <p>
              Rating: <span className="font-bold">{record.rating}/10</span>
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}

function GroupAverageTable({ title, groups }) {
  const safe = Array.isArray(groups) ? groups : [];

  return (
    <Card>
      <div className="p-4 sm:p-5">
        <h2 className="text-lg font-bold sm:text-xl">{title}</h2>
        <div className="mt-4 space-y-3">
          {safe.length ? (
            safe.map((group) => (
              <div key={group.name}>
                <div className="mb-1 flex justify-between gap-2 text-sm">
                  <span className="font-semibold">{group.name}</span>
                  <span className="text-right text-slate-500">
                    {fmt(group.average)} From {group.count} Ratings
                  </span>
                </div>
                <div className="h-3 overflow-hidden rounded-full bg-slate-100">
                  <div className="h-full rounded-full bg-slate-900" style={{ width: `${Math.max(0, Math.min(100, (group.average || 0) * 10))}%` }} />
                </div>
              </div>
            ))
          ) : (
            <p className="rounded-2xl bg-slate-100 p-4 text-sm text-slate-500">No Ratings Yet.</p>
          )}
        </div>
      </div>
    </Card>
  );
}

function GoalComboTable({ combos }) {
  const safe = Array.isArray(combos) ? combos : [];
  const top = safe[0]?.count || 0;

  return (
    <Card>
      <div className="p-4 sm:p-5">
        <h2 className="text-lg font-bold sm:text-xl">Common Goal Combos</h2>
        <div className="mt-4 space-y-3">
          {safe.length ? (
            safe.map((combo, index) => (
              <div key={combo.combo}>
                <div className="mb-1 flex justify-between gap-2 text-sm">
                  <span className="font-semibold">
                    {index + 1}. {combo.combo}
                  </span>
                  <span className="text-slate-500">{combo.count} Goals</span>
                </div>
                <div className="h-3 overflow-hidden rounded-full bg-slate-100">
                  <div className="h-full rounded-full bg-slate-900" style={{ width: top ? `${Math.max(4, (combo.count / top) * 100)}%` : "0%" }} />
                </div>
              </div>
            ))
          ) : (
            <p className="rounded-2xl bg-slate-100 p-4 text-sm text-slate-500">No Assisted Goals Recorded Yet.</p>
          )}
        </div>
      </div>
    </Card>
  );
}

function StatLeaderboard({ title, players, statKey, valueFormatter, onSelectPlayer, hideZeroValues = false, emptyMessage = "No Stats Recorded Yet." }) {
  const sorted = [...players].sort((a, b) => (n(b[statKey]) ?? 0) - (n(a[statKey]) ?? 0) || a.name.localeCompare(b.name)).filter((player) => !hideZeroValues || (n(player[statKey]) ?? 0) > 0);
  const top = n(sorted[0]?.[statKey]) ?? 0;

  return (
    <Card>
      <div className="p-4 sm:p-5">
        <h2 className="text-lg font-bold sm:text-xl">{title}</h2>
        <div className="mt-4 space-y-3">
          {!sorted.length && <p className="rounded-2xl bg-slate-100 p-4 text-sm text-slate-500">{emptyMessage}</p>}
          {sorted.map((player, index) => {
            const value = n(player[statKey]) ?? 0;
            const width = top > 0 ? `${Math.max(4, (value / top) * 100)}%` : "0%";

            return (
              <button key={player.name} onClick={() => onSelectPlayer(player.name)} className="w-full rounded-2xl border border-slate-200 bg-slate-50 p-3 text-left transition hover:bg-slate-100">
                <div className="mb-2 flex items-center justify-between gap-3 text-sm">
                  <span className="font-semibold">
                    {index + 1}. {player.name}
                  </span>
                  <span className="rounded-full bg-white px-3 py-1 text-xs font-bold text-slate-700">{valueFormatter ? valueFormatter(value, player) : value}</span>
                </div>
                <div className="h-3 overflow-hidden rounded-full bg-white">
                  <div className="h-full rounded-full bg-slate-900" style={{ width }} />
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </Card>
  );
}

function StatsPage({ playerStats, onSelectPlayer }) {
  return (
    <main className="space-y-4">
      <Card>
        <div className="p-4 sm:p-5">
          <h2 className="text-2xl font-bold">Season Stats</h2>
        </div>
      </Card>

      <div className="grid gap-3 lg:grid-cols-2">
        <StatLeaderboard title="Top Goal Scorers" players={playerStats} statKey="goals" hideZeroValues emptyMessage="No Goals Recorded Yet." onSelectPlayer={onSelectPlayer} />
        <StatLeaderboard title="Most Assists" players={playerStats} statKey="assists" hideZeroValues emptyMessage="No Assists Recorded Yet." onSelectPlayer={onSelectPlayer} />
        <StatLeaderboard title="Most Matches Played" players={playerStats} statKey="matchesPlayed" valueFormatter={(value) => `${value} Matches`} onSelectPlayer={onSelectPlayer} />
        <StatLeaderboard title="Highest Average Rating" players={playerStats} statKey="avgRating" valueFormatter={(value) => fmt(value)} onSelectPlayer={onSelectPlayer} />
      </div>
    </main>
  );
}

function TeamSummaryPage({ summary }) {
  const diff = summary.trainingEffect.attendedAverage === null || summary.trainingEffect.missedAverage === null ? null : summary.trainingEffect.attendedAverage - summary.trainingEffect.missedAverage;

  return (
    <main className="space-y-4">
      <Card>
        <div className="p-4 sm:p-5">
          <h2 className="text-2xl font-bold">Team Summary</h2>
        </div>
      </Card>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <SummaryCard label="Record" value={`${summary.wins}-${summary.draws}-${summary.losses}`} detail={`W-D-L From ${summary.completedMatches} Completed Matches`} />
        <SummaryCard label="Goals" value={`${summary.goalsFor}-${summary.goalsAgainst}`} detail={`GD ${summary.goalDifference > 0 ? "+" : ""}${summary.goalDifference}`} />
        <SummaryCard label="Average Team Rating" value={fmt(summary.averageTeamRating)} detail="Across All Player Ratings" />
        <SummaryCard label="Matches Tracked" value={summary.matches} detail="Including Incomplete Scores" />
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <SummaryCard label="Scored First" value={summary.scoredFirst} detail={`Record ${summary.scoredFirstRecord}`} />
        <SummaryCard label="Conceded First" value={summary.concededFirst} detail={`Record ${summary.concededFirstRecord}`} />
        <SummaryCard label="First Goal Logged" value={summary.firstGoalLogged} detail="Matches With A Goal Order" />
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <SummaryCard label="First Half" value={`${summary.firstHalfFor}-${summary.firstHalfAgainst}`} detail={`GD ${summary.firstHalfGD > 0 ? "+" : ""}${summary.firstHalfGD}`} />
        <SummaryCard label="Second Half" value={`${summary.secondHalfFor}-${summary.secondHalfAgainst}`} detail={`GD ${summary.secondHalfGD > 0 ? "+" : ""}${summary.secondHalfGD}`} />
        <SummaryCard label="Better Half" value={summary.betterHalf} detail="Based On Goal Difference" />
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <GroupAverageTable title="Home Vs Away" groups={summary.venueGroups} />
        <GroupAverageTable title="Kick-Off Time" groups={summary.kickoffGroups} />
        <GroupAverageTable title="Competition" groups={summary.competitionGroups} />
        <GroupAverageTable title="Formation" groups={summary.formationGroups} />
      </div>

      <GoalComboTable combos={summary.goalCombos} />

      <Card>
        <div className="p-4 sm:p-5">
          <h2 className="text-xl font-bold">Training Effect</h2>
          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <SummaryPanel label="After Attending Training" value={fmt(summary.trainingEffect.attendedAverage)} detail={`${summary.trainingEffect.attendedCount} Match Records`} />
            <SummaryPanel label="After Missing Training" value={fmt(summary.trainingEffect.missedAverage)} detail={`${summary.trainingEffect.missedCount} Match Records`} />
            <SummaryPanel label="Difference" value={fmt(diff)} detail="Attended Minus Missed" />
          </div>
        </div>
      </Card>
    </main>
  );
}

function PredictorPage({ input, setInput, rows }) {
  const top = rows[0] || null;

  return (
    <main className="space-y-4">
      <Card>
        <div className="p-4 sm:p-5">
          <h2 className="text-2xl font-bold">Match Predictor</h2>
          <p className="heading-label mt-1 text-sm text-slate-500">Enter The Upcoming Match Details To Predict Each Player Rating.</p>
        </div>
      </Card>

      <Card>
        <div className="p-4 sm:p-5">
          <h2 className="mb-4 text-xl font-bold">Upcoming Match Details</h2>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-6">
            <Input value={input.opponent} onChange={(event) => setInput({ ...input, opponent: event.target.value })} placeholder="Opponent" />
            <SelectInput value={input.venue} onChange={(event) => setInput({ ...input, venue: event.target.value })}>
              <option value="Home">Home</option>
              <option value="Away">Away</option>
            </SelectInput>
            <Input value={input.competition} onChange={(event) => setInput({ ...input, competition: event.target.value })} placeholder="Competition" />
            <Input type="time" value={input.kickoffTime} onChange={(event) => setInput({ ...input, kickoffTime: event.target.value })} />
            <SelectInput value={input.formation} onChange={(event) => setInput({ ...input, formation: event.target.value })}>
              {FORMATIONS.map((formation) => (
                <option key={formation} value={formation}>
                  {formation}
                </option>
              ))}
            </SelectInput>
            <Input type="date" value={input.date} onChange={(event) => setInput({ ...input, date: event.target.value })} />
          </div>
        </div>
      </Card>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <SummaryCard label="Opponent" value={input.opponent || "—"} detail="Upcoming Match" />
        <SummaryCard label="Best Predicted Player" value={top?.player || "—"} detail={top ? `${fmt(top.predicted)} Predicted` : "No Prediction Yet"} />
        <SummaryCard label="Kick-Off Band" value={getKickoffBand(input.kickoffTime)} detail={input.kickoffTime || "No Time"} />
        <SummaryCard label="Formation" value={input.formation} detail={`${input.venue} · ${input.competition || "No Competition"}`} />
      </div>

      <Card>
        <div className="p-4 sm:p-5">
          <h2 className="mb-4 text-xl font-bold">Predicted Player Ratings</h2>
          <div className="grid gap-3">
            {rows.map((row) => (
              <div key={row.player} className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
                <div className="flex items-center justify-between gap-3">
                  <p className="font-bold">{row.player}</p>
                  <p className="rounded-full bg-white px-3 py-1 text-sm font-bold">{fmt(row.predicted)}</p>
                </div>
                <div className="mt-3 grid gap-2 text-xs text-slate-600 sm:grid-cols-2 lg:grid-cols-4">
                  <p>Season Avg: {fmt(row.seasonAverage)}</p>
                  <p>Recent Form: {fmt(row.recentAverage)}</p>
                  <p>Home/Away Avg: {fmt(row.venueAverage)}</p>
                  <p>Formation Avg: {fmt(row.formationAverage)}</p>
                  <p>Kick-Off Avg: {fmt(row.kickoffAverage)}</p>
                  <p>Competition Avg: {fmt(row.competitionAverage)}</p>
                  <p>Latest Training: {row.latestTraining}</p>
                  <p>Matches Used: {row.matchesUsed}</p>
                </div>
              </div>
            ))}
            {!rows.length && <p className="rounded-2xl bg-slate-100 p-4 text-center text-sm text-slate-500">No Player Ratings Available To Predict From Yet.</p>}
          </div>
        </div>
      </Card>
    </main>
  );
}

function GoalTimelineEditor({ match, onAddGoal, onUpdateGoal, onRemoveGoal }) {
  const firstHalf = (match.goalTimeline || []).filter((goal) => goal.half !== "Second Half");
  const secondHalf = (match.goalTimeline || []).filter((goal) => goal.half === "Second Half");
  const playedPlayers = (match.players || []).filter((player) => player.played);

  const GoalSection = ({ title, half, goals }) => (
    <div className="rounded-2xl border border-slate-200 bg-white p-3 sm:p-4">
      <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <h4 className="text-base font-bold">{title}</h4>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={() => onAddGoal("Us", half)}>
            + Our Goal
          </Button>
          <Button variant="outline" onClick={() => onAddGoal("Opponent", half)}>
            + Opp Goal
          </Button>
        </div>
      </div>

      {goals.length ? (
        <div className="space-y-2">
          {goals.map((goal, index) => {
            const missingScorer = goal.team === "Us" && !goal.scorer;

            return (
              <div key={goal.id} className={`rounded-2xl p-3 ${missingScorer ? "border border-red-200 bg-red-50" : "bg-slate-100"}`}>
                <div className="mb-2 flex items-center justify-between">
                  <div>
                    <p className="font-semibold">Goal {index + 1}</p>
                    {missingScorer && <p className="heading-label mt-1 text-xs font-semibold text-red-700">Scorer Required</p>}
                  </div>
                  <Button variant="outline" onClick={() => onRemoveGoal(goal.id)}>
                    Remove
                  </Button>
                </div>

                <div className="grid gap-2 sm:grid-cols-3">
                  <SelectInput
                    value={goal.team}
                    onChange={(event) =>
                      onUpdateGoal(goal.id, {
                        team: event.target.value,
                        scorer: event.target.value === "Opponent" ? "" : goal.scorer,
                        assister: event.target.value === "Opponent" ? "" : goal.assister,
                      })
                    }
                  >
                    <option value="Us">Us</option>
                    <option value="Opponent">Opponent</option>
                  </SelectInput>

                  {goal.team === "Us" && (
                    <SelectInput
                      value={goal.scorer || ""}
                      onChange={(event) =>
                        onUpdateGoal(goal.id, {
                          scorer: event.target.value,
                          assister: event.target.value === OWN_GOAL ? "" : goal.assister,
                        })
                      }
                      className={missingScorer ? "border-red-400" : ""}
                    >
                      <option value="">Pick Scorer</option>
                      <option value={OWN_GOAL}>{OWN_GOAL}</option>
                      {playedPlayers.map((player) => (
                        <option key={player.name} value={player.name}>
                          {player.name}
                        </option>
                      ))}
                    </SelectInput>
                  )}

                  {goal.team === "Us" && goal.scorer && goal.scorer !== OWN_GOAL && (
                    <SelectInput value={goal.assister || ""} onChange={(event) => onUpdateGoal(goal.id, { assister: event.target.value })}>
                      <option value="">No Assist</option>
                      {playedPlayers
                        .filter((player) => player.name !== goal.scorer)
                        .map((player) => (
                          <option key={player.name} value={player.name}>
                            {player.name}
                          </option>
                        ))}
                    </SelectInput>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <p className="rounded-2xl bg-slate-100 p-4 text-sm text-slate-500">No Goals Logged In This Half Yet.</p>
      )}
    </div>
  );

  return (
    <Card className="mb-4 border border-slate-200">
      <div className="p-4 sm:p-5">
        <div className="mb-3">
          <h3 className="text-lg font-bold">Goal Order</h3>
          <p className="heading-label text-sm text-slate-500">Log Goals Under The Half They Were Scored In.</p>
        </div>
        <div className="grid gap-3 lg:grid-cols-2">
          <GoalSection title="First Half Goals" half="First Half" goals={firstHalf} />
          <GoalSection title="Second Half Goals" half="Second Half" goals={secondHalf} />
        </div>
      </div>
    </Card>
  );
}

function PlayerDashboard({ stats, effect }) {
  const records = stats?.records || [];
  const diff = effect.attendedAverage === null || effect.missedAverage === null ? null : effect.attendedAverage - effect.missedAverage;

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <SummaryCard label="Average Rating" value={fmt(stats?.avgRating)} detail="Match Rating" />
        <SummaryCard label="Goals" value={stats?.goals || 0} detail="Season Total" />
        <SummaryCard label="Assists" value={stats?.assists || 0} detail="Season Total" />
        <SummaryCard label="Training Attended" value={`${stats?.trainingAttended || 0}/${stats?.trainingTotal || 0}`} detail="Sessions" />
      </div>

      <div className="grid gap-3 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <div className="p-4 sm:p-5">
            <h2 className="text-xl font-bold">{stats?.name || "Player"} Rating Trend</h2>
            <TrendChart records={records} />
          </div>
        </Card>

        <Card>
          <div className="p-4 sm:p-5">
            <h2 className="text-xl font-bold">Training Effect</h2>
            <p className="heading-label mt-1 text-sm text-slate-500">This Only Uses {stats?.name || "This Player"}'s Match Ratings.</p>
            <div className="mt-5 space-y-4">
              <SummaryPanel label="After Attending Training" value={fmt(effect.attendedAverage)} detail={`${effect.attendedCount} Match Records`} />
              <SummaryPanel label="After Missing Training" value={fmt(effect.missedAverage)} detail={`${effect.missedCount} Match Records`} />
              <p className="text-sm text-slate-600">
                Difference: <span className="font-bold">{fmt(diff)}</span>
              </p>
            </div>
          </div>
        </Card>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <GroupAverageTable title="Home Vs Away" groups={groupAverage(records, "venue")} />
        <GroupAverageTable title="Competition" groups={groupAverage(records, "competition")} />
        <GroupAverageTable title="Kick-Off Time" groups={groupAverage(records, "kickoffBand")} />
        <GroupAverageTable title="Formation" groups={groupAverage(records, "formation")} />
      </div>
    </div>
  );
}

export default function U10FootballStatsTracker() {
  const [initial] = useState(loadState);
  const [players, setPlayers] = useState(initial.players);
  const [matches, setMatches] = useState(initial.matches);
  const [trainingSessions, setTrainingSessions] = useState(initial.trainingSessions);
  const [selectedPlayer, setSelectedPlayer] = useState(initial.selectedPlayer);
  const [activeTab, setActiveTab] = useState("players");
  const [newPlayer, setNewPlayer] = useState("");
  const [editingPlayer, setEditingPlayer] = useState(null);
  const [editingPlayerName, setEditingPlayerName] = useState("");
  const [playerToRemove, setPlayerToRemove] = useState(null);
  const [expandedMatchId, setExpandedMatchId] = useState(null);
  const [editingMatchDraft, setEditingMatchDraft] = useState(null);
  const [confirmClearData, setConfirmClearData] = useState(false);
  const [playerSummarySort, setPlayerSummarySort] = useState(initial.playerSummarySort);
  const [predictorInput, setPredictorInput] = useState(initial.predictorInput);

  useEffect(() => {
    saveState({ players, matches, trainingSessions, selectedPlayer, playerSummarySort, predictorInput });
  }, [players, matches, trainingSessions, selectedPlayer, playerSummarySort, predictorInput]);

  const playerStats = useMemo(() => makePlayerStats(players, matches, trainingSessions), [players, matches, trainingSessions]);
  const records = useMemo(() => allRecords(playerStats), [playerStats]);
  const selectedStats = playerStats.find((player) => player.name === selectedPlayer) || playerStats[0] || { name: "", records: [] };
  const overallTrainingEffect = useMemo(() => trainingEffect(players, matches, trainingSessions), [players, matches, trainingSessions]);
  const selectedTrainingEffect = useMemo(() => playerTrainingEffect(selectedStats.name, matches, trainingSessions), [selectedStats.name, matches, trainingSessions]);
  const summary = useMemo(() => teamSummary(matches, records, overallTrainingEffect), [matches, records, overallTrainingEffect]);
  const predictionRows = useMemo(() => predictRows(playerStats, predictorInput, trainingSessions), [playerStats, predictorInput, trainingSessions]);
  const sortedPlayers = useMemo(() => sortSummary(playerStats, playerSummarySort), [playerStats, playerSummarySort]);

  const tabs = ["Players", "Stats", "Team Summary", "Predictor", "Matches", "Training"];

  function clearAllData() {
    const empty = { players: [], matches: [], trainingSessions: [], selectedPlayer: "" };
    setPlayers(empty.players);
    setMatches(empty.matches);
    setTrainingSessions(empty.trainingSessions);
    setSelectedPlayer(empty.selectedPlayer);
    setNewPlayer("");
    setEditingPlayer(null);
    setEditingPlayerName("");
    setPlayerToRemove(null);
    setExpandedMatchId(null);
    setEditingMatchDraft(null);
    setPredictorInput(defaultPredictor());
    setPlayerSummarySort("avgRating");
    setConfirmClearData(false);
    window.localStorage.removeItem(STORAGE_KEY);
    setActiveTab("players");
  }

  function addPlayer() {
    const name = String(newPlayer || "").trim();
    if (!name || players.some((player) => player.toLowerCase() === name.toLowerCase())) return;

    setPlayers([...players, name]);
    setMatches(matches.map((match) => syncMatch({ ...match, players: [...match.players, { name, played: false, rating: "", goals: 0, assists: 0 }] })));
    setTrainingSessions(trainingSessions.map((session) => ({ ...session, attendance: { ...(session.attendance || {}), [name]: false } })));
    setSelectedPlayer(name);
    setNewPlayer("");
  }

  function savePlayerRename(oldName) {
    const name = String(editingPlayerName || "").trim();
    if (!name || (name !== oldName && players.some((player) => player.toLowerCase() === name.toLowerCase()))) return;

    setPlayers(players.map((player) => (player === oldName ? name : player)));
    setMatches(
      matches.map((match) =>
        syncMatch({
          ...match,
          players: match.players.map((player) => (player.name === oldName ? { ...player, name } : player)),
          goalTimeline: match.goalTimeline.map((goal) => ({
            ...goal,
            scorer: goal.scorer === oldName ? name : goal.scorer,
            assister: goal.assister === oldName ? name : goal.assister,
          })),
        })
      )
    );
    setTrainingSessions(
      trainingSessions.map((session) => {
        const attendance = { ...(session.attendance || {}) };
        if (Object.prototype.hasOwnProperty.call(attendance, oldName)) {
          attendance[name] = attendance[oldName];
          delete attendance[oldName];
        }
        return { ...session, attendance };
      })
    );
    setSelectedPlayer(selectedPlayer === oldName ? name : selectedPlayer);
    setEditingPlayer(null);
    setEditingPlayerName("");
    setPlayerToRemove(null);
  }

  function removePlayer(name) {
    const nextPlayers = players.filter((player) => player !== name);
    setPlayers(nextPlayers);
    setMatches(
      matches.map((match) =>
        syncMatch({
          ...match,
          players: match.players.filter((player) => player.name !== name),
          goalTimeline: match.goalTimeline.map((goal) => ({
            ...goal,
            scorer: goal.scorer === name ? "" : goal.scorer,
            assister: goal.assister === name ? "" : goal.assister,
          })),
        })
      )
    );
    setTrainingSessions(
      trainingSessions.map((session) => {
        const attendance = { ...(session.attendance || {}) };
        delete attendance[name];
        return { ...session, attendance };
      })
    );
    setSelectedPlayer(selectedPlayer === name ? nextPlayers[0] || "" : selectedPlayer);
    setEditingPlayer(null);
    setEditingPlayerName("");
    setPlayerToRemove(null);
  }

  function addMatch() {
    const id = matches.length ? Math.max(...matches.map((match) => match.id)) + 1 : 1;
    const match = {
      id,
      opponent: `Opponent ${id}`,
      venue: "Home",
      competition: "League",
      kickoffTime: "09:00",
      formation: "3-2-1",
      date: new Date().toISOString().slice(0, 10),
      teamGoals: 0,
      opponentGoals: 0,
      goalTimeline: [],
      players: players.map((name) => ({ name, played: false, rating: "", goals: 0, assists: 0 })),
    };
    setMatches([...matches, match]);
    setExpandedMatchId(id);
    setEditingMatchDraft(match);
  }

  function openMatch(match) {
    setExpandedMatchId(match.id);
    setEditingMatchDraft(JSON.parse(JSON.stringify(match)));
  }

  function closeMatch() {
    if (editingMatchDraft && editingMatchDraft.goalTimeline.some((goal) => goal.team === "Us" && !goal.scorer)) return;
    setExpandedMatchId(null);
    setEditingMatchDraft(null);
  }

  function cancelMatch() {
    setExpandedMatchId(null);
    setEditingMatchDraft(null);
  }

  function updateDraft(patch) {
    setEditingMatchDraft((draft) => (draft ? syncMatch({ ...draft, ...patch }) : draft));
  }

  function updateDraftPlayer(name, patch) {
    setEditingMatchDraft((draft) => {
      if (!draft) return draft;
      let nextTimeline = draft.goalTimeline || [];
      if (Object.prototype.hasOwnProperty.call(patch, "played") && !patch.played) {
        nextTimeline = nextTimeline.map((goal) => ({
          ...goal,
          scorer: goal.scorer === name ? "" : goal.scorer,
          assister: goal.assister === name ? "" : goal.assister,
        }));
      }

      return syncMatch({
        ...draft,
        goalTimeline: nextTimeline,
        players: draft.players.map((player) =>
          player.name === name
            ? {
                ...player,
                ...patch,
                rating: patch.played === false ? "" : Object.prototype.hasOwnProperty.call(patch, "rating") ? clampRating(patch.rating) : player.rating,
              }
            : player
        ),
      });
    });
  }

  function addGoal(team, half) {
    setEditingMatchDraft((draft) =>
      draft
        ? syncMatch({
            ...draft,
            goalTimeline: [...draft.goalTimeline, { id: `${Date.now()}-${Math.random()}`, team, scorer: "", assister: "", half }],
          })
        : draft
    );
  }

  function updateGoal(id, patch) {
    setEditingMatchDraft((draft) =>
      draft
        ? syncMatch({
            ...draft,
            goalTimeline: draft.goalTimeline.map((goal) => (goal.id === id ? { ...goal, ...patch } : goal)),
          })
        : draft
    );
  }

  function removeGoal(id) {
    setEditingMatchDraft((draft) =>
      draft
        ? syncMatch({
            ...draft,
            goalTimeline: draft.goalTimeline.filter((goal) => goal.id !== id),
          })
        : draft
    );
  }

  function saveMatch() {
    if (!editingMatchDraft || editingMatchDraft.goalTimeline.some((goal) => goal.team === "Us" && !goal.scorer)) return;
    setMatches(matches.map((match) => (match.id === editingMatchDraft.id ? syncMatch(editingMatchDraft) : match)));
    setExpandedMatchId(null);
    setEditingMatchDraft(null);
  }

  function deleteMatch(id) {
    setMatches(matches.filter((match) => match.id !== id));
    if (expandedMatchId === id) cancelMatch();
  }

  function addTrainingSession() {
    const id = trainingSessions.length ? Math.max(...trainingSessions.map((session) => session.id)) + 1 : 1;
    setTrainingSessions([...trainingSessions, { id, date: new Date().toISOString().slice(0, 10), attendance: Object.fromEntries(players.map((player) => [player, false])) }]);
  }

  function toggleAttendance(id, player) {
    setTrainingSessions(
      trainingSessions.map((session) =>
        session.id === id ? { ...session, attendance: { ...(session.attendance || {}), [player]: !session.attendance?.[player] } } : session
      )
    );
  }

  function sortLabel(key, label) {
    return `${label}${playerSummarySort === key ? " ↓" : ""}`;
  }

  function trendSymbol(trend) {
    if (trend === null) return "—";
    if (trend > 0) return "↑";
    if (trend < 0) return "↓";
    return "→";
  }

  return (
    <div className="title-case-ui min-h-screen bg-slate-200 p-3 text-slate-900 sm:p-4 md:p-8">
      <style>{`.title-case-ui h1,.title-case-ui h2,.title-case-ui h3,.title-case-ui h4,.title-case-ui th,.title-case-ui label,.title-case-ui nav button,.title-case-ui .heading-label{text-transform:capitalize}`}</style>

      <div className="mx-auto max-w-7xl space-y-4 sm:space-y-6">
        <header className="rounded-2xl bg-white p-4 shadow-sm sm:rounded-3xl sm:p-6">
          <h1 className="text-2xl font-bold tracking-tight sm:text-3xl md:text-5xl">Team Stats Tracker</h1>
        </header>

        <nav className="grid grid-cols-2 gap-1 rounded-2xl bg-white p-1 shadow-sm sm:grid-cols-3 lg:grid-cols-6">
          {tabs.map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab.toLowerCase())}
              className={`rounded-xl px-2 py-2 text-xs font-semibold transition sm:px-3 sm:text-sm ${
                activeTab === tab.toLowerCase() ? "bg-slate-900 text-white" : "text-slate-600 hover:bg-slate-100"
              }`}
            >
              {tab}
            </button>
          ))}
        </nav>

        {activeTab === "players" && (
          <main className="space-y-4">
            <Card>
              <div className="p-4 sm:p-5">
                <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                  <div>
                    <h2 className="text-xl font-bold">Manage Players</h2>
                    <p className="heading-label text-sm text-slate-500">Click A Player To Open Their Dashboard. Use Edit To Rename Or Delete.</p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Input value={newPlayer} onChange={(event) => setNewPlayer(event.target.value)} placeholder="New Player Name" className="sm:w-48" />
                    <Button onClick={addPlayer}>+ Add Player</Button>
                  </div>
                </div>

                <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5">
                  {players.map((player) => {
                    const isEditing = editingPlayer === player;
                    const isSelected = selectedStats?.name === player;
                    const duplicateName = Boolean(editingPlayerName.trim() && editingPlayerName.trim() !== player && players.some((existing) => existing !== player && existing.toLowerCase() === editingPlayerName.trim().toLowerCase()));

                    return (
                      <div
                        key={player}
                        onClick={() => !isEditing && setSelectedPlayer(player)}
                        className={`rounded-2xl border p-3 transition ${
                          isSelected ? "border-slate-900 bg-slate-900 text-white" : "border-slate-200 bg-slate-50 hover:bg-slate-100"
                        } ${isEditing ? "cursor-default" : "cursor-pointer"}`}
                      >
                        {!isEditing ? (
                          <div className="flex items-center justify-between gap-3">
                            <span className="font-semibold">{player}</span>
                            <button
                              onClick={(event) => {
                                event.stopPropagation();
                                setEditingPlayer(player);
                                setEditingPlayerName(player);
                                setPlayerToRemove(null);
                              }}
                              className="rounded-lg border border-slate-300 bg-white px-2 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-100"
                            >
                              Edit
                            </button>
                          </div>
                        ) : (
                          <div className="space-y-3 rounded-xl bg-white p-3 text-slate-900">
                            <Input value={editingPlayerName} onChange={(event) => setEditingPlayerName(event.target.value)} />
                            {duplicateName && <p className="text-xs text-red-600">That Player Name Already Exists.</p>}
                            <div className="flex gap-2">
                              <button
                                onClick={(event) => {
                                  event.stopPropagation();
                                  savePlayerRename(player);
                                }}
                                disabled={duplicateName || !editingPlayerName.trim()}
                                className="flex-1 rounded-lg bg-slate-900 px-2 py-1 text-xs font-semibold text-white disabled:opacity-40"
                              >
                                Save
                              </button>
                              <button
                                onClick={(event) => {
                                  event.stopPropagation();
                                  setEditingPlayer(null);
                                  setEditingPlayerName("");
                                }}
                                className="flex-1 rounded-lg border border-slate-300 bg-white px-2 py-1 text-xs font-semibold text-slate-700"
                              >
                                Cancel
                              </button>
                            </div>
                            {playerToRemove === player ? (
                              <div className="rounded-xl border border-red-100 bg-red-50 p-3">
                                <p className="heading-label text-xs text-red-700">Delete {player} From All Stats?</p>
                                <div className="mt-2 flex gap-2">
                                  <button
                                    onClick={(event) => {
                                      event.stopPropagation();
                                      removePlayer(player);
                                    }}
                                    className="flex-1 rounded-lg bg-red-600 px-2 py-1 text-xs font-semibold text-white"
                                  >
                                    Yes
                                  </button>
                                  <button
                                    onClick={(event) => {
                                      event.stopPropagation();
                                      setPlayerToRemove(null);
                                    }}
                                    className="flex-1 rounded-lg border border-slate-300 bg-white px-2 py-1 text-xs font-semibold text-slate-700"
                                  >
                                    Keep
                                  </button>
                                </div>
                              </div>
                            ) : (
                              <button
                                onClick={(event) => {
                                  event.stopPropagation();
                                  setPlayerToRemove(player);
                                }}
                                className="w-full rounded-lg border border-red-200 bg-white px-2 py-1 text-xs font-semibold text-red-600 hover:bg-red-50"
                              >
                                Delete Player
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </Card>

            <PlayerDashboard stats={selectedStats} effect={selectedTrainingEffect} />

            <Card>
              <div className="p-4 sm:p-5">
                <h2 className="mb-4 text-xl font-bold">Player Summary</h2>

                <div className="grid gap-3">
                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-8">
                    {[
                      ["name", "Player"],
                      ["avgRating", "Avg Rating"],
                      ["last", "Last Game"],
                      ["trend", "Trend"],
                      ["homeAverage", "Home Avg"],
                      ["awayAverage", "Away Avg"],
                      ["matchesPlayed", "Matches"],
                      ["goals", "Goals"],
                      ["assists", "Assists"],
                      ["trainingAttended", "Training"],
                    ].map(([key, label]) => (
                      <button key={key} onClick={() => setPlayerSummarySort(key)} className="rounded-xl bg-slate-100 px-3 py-2 text-xs font-bold hover:bg-slate-200">
                        {sortLabel(key, label)}
                      </button>
                    ))}
                  </div>

                  {sortedPlayers.map((player) => (
                    <button
                      key={player.name}
                      onClick={() => setSelectedPlayer(player.name)}
                      className={`rounded-2xl border p-3 text-left transition ${selectedStats?.name === player.name ? "border-slate-900 bg-slate-100" : "border-slate-200 bg-slate-50 hover:bg-slate-100"}`}
                    >
                      <div className="flex items-center justify-between gap-3">
                        <p className="font-bold">{player.name}</p>
                        <p className="text-sm font-bold">{fmt(player.avgRating)}</p>
                      </div>
                      <div className="mt-2 grid gap-1 text-xs text-slate-600 sm:grid-cols-2 lg:grid-cols-5">
                        <p>Last: {fmt(player.last)}</p>
                        <p>
                          Trend: {trendSymbol(player.trend)} {player.trend === null ? "—" : `${player.trend > 0 ? "+" : ""}${player.trend.toFixed(1)}`}
                        </p>
                        <p>Home: {fmt(player.homeAverage)}</p>
                        <p>Away: {fmt(player.awayAverage)}</p>
                        <p>Matches: {player.matchesPlayed}</p>
                        <p>Best Time: {player.bestKickoffBand}</p>
                        <p>Formation: {player.bestFormation}</p>
                        <p>Goals: {player.goals}</p>
                        <p>Assists: {player.assists}</p>
                        <p>
                          Training: {player.trainingAttended}/{player.trainingTotal}
                        </p>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            </Card>
          </main>
        )}

        {activeTab === "stats" && (
          <StatsPage
            playerStats={playerStats}
            onSelectPlayer={(player) => {
              setSelectedPlayer(player);
              setActiveTab("players");
            }}
          />
        )}

        {activeTab === "team summary" && <TeamSummaryPage summary={summary} />}

        {activeTab === "predictor" && <PredictorPage input={predictorInput} setInput={setPredictorInput} rows={predictionRows} />}

        {activeTab === "matches" && (
          <main className="space-y-4">
            <div className="flex justify-end">
              <Button onClick={addMatch}>+ Add Match</Button>
            </div>

            {matches.map((match) => {
              const isExpanded = expandedMatchId === match.id;
              const draft = isExpanded && editingMatchDraft?.id === match.id ? editingMatchDraft : match;
              const missingScorers = draft.goalTimeline.filter((goal) => goal.team === "Us" && !goal.scorer).length;
              const canSave = missingScorers === 0;

              return (
                <Card key={match.id}>
                  <div className="p-4 sm:p-5">
                    <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <h2 className="text-xl font-bold">{match.opponent || "Opponent"}</h2>
                          <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">{match.venue}</span>
                          <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">{match.competition}</span>
                          <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">{match.formation}</span>
                        </div>
                        <p className="mt-2 text-sm text-slate-500">
                          {match.date} · {match.kickoffTime} · {getResult(match)}
                        </p>
                      </div>
                      <Button variant="outline" onClick={() => (isExpanded ? closeMatch() : openMatch(match))}>
                        {isExpanded ? "Close" : "Edit"}
                      </Button>
                    </div>

                    {isExpanded && (
                      <div className="mt-5 border-t border-slate-200 pt-5">
                        <div className="mb-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-6">
                          <Input value={draft.opponent || ""} onChange={(event) => updateDraft({ opponent: event.target.value })} placeholder="Opponent" />
                          <SelectInput value={draft.venue || "Home"} onChange={(event) => updateDraft({ venue: event.target.value })}>
                            <option value="Home">Home</option>
                            <option value="Away">Away</option>
                          </SelectInput>
                          <Input value={draft.competition || ""} onChange={(event) => updateDraft({ competition: event.target.value })} placeholder="Competition" />
                          <Input type="time" value={draft.kickoffTime || ""} onChange={(event) => updateDraft({ kickoffTime: event.target.value })} />
                          <SelectInput value={FORMATIONS.includes(draft.formation) ? draft.formation : "3-2-1"} onChange={(event) => updateDraft({ formation: event.target.value })}>
                            {FORMATIONS.map((formation) => (
                              <option key={formation} value={formation}>
                                {formation}
                              </option>
                            ))}
                          </SelectInput>
                          <Input type="date" value={draft.date || ""} onChange={(event) => updateDraft({ date: event.target.value })} />
                        </div>

                        <GoalTimelineEditor match={draft} onAddGoal={addGoal} onUpdateGoal={updateGoal} onRemoveGoal={removeGoal} />

                        {!canSave && (
                          <div className="mb-4 rounded-2xl border border-red-200 bg-red-50 p-3 text-sm font-semibold text-red-700">
                            Select A Scorer For {missingScorers} Goal{missingScorers === 1 ? "" : "s"} Before Saving Or Closing This Match.
                          </div>
                        )}

                        <div className="mb-4 flex flex-wrap justify-end gap-2">
                          <Button onClick={saveMatch} disabled={!canSave}>
                            Save Match
                          </Button>
                          <Button variant="outline" onClick={cancelMatch}>
                            Cancel
                          </Button>
                          <Button variant="outline" onClick={() => deleteMatch(match.id)}>
                            × Delete Match
                          </Button>
                        </div>

                        <div className="grid gap-2">
                          {draft.players.map((player) => (
                            <div key={player.name} className="rounded-2xl bg-slate-50 p-3">
                              <div className="flex items-center justify-between gap-3">
                                <p className="font-semibold">{player.name}</p>
                                <label className="flex items-center gap-2 text-sm">
                                  <input type="checkbox" checked={Boolean(player.played)} onChange={(event) => updateDraftPlayer(player.name, { played: event.target.checked })} />
                                  Played
                                </label>
                              </div>
                              <div className="mt-3 grid gap-3 sm:grid-cols-4">
                                <div className="sm:col-span-2">
                                  <p className="mb-1 text-xs text-slate-500">Rating: {player.rating === "" ? "—" : player.rating}/10</p>
                                  <input
                                    type="range"
                                    min="0"
                                    max="10"
                                    step="1"
                                    value={player.rating === "" ? 0 : player.rating}
                                    disabled={!player.played}
                                    onChange={(event) => updateDraftPlayer(player.name, { rating: event.target.value })}
                                    className="w-full accent-slate-900 disabled:opacity-40"
                                  />
                                </div>
                                <p className="text-sm">Goals: {player.goals}</p>
                                <p className="text-sm">Assists: {player.assists}</p>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </Card>
              );
            })}

            {!matches.length && (
              <Card>
                <div className="p-4 text-sm text-slate-500 sm:p-5">No Matches Yet. Add One Above.</div>
              </Card>
            )}
          </main>
        )}

        {activeTab === "training" && (
          <main className="space-y-4">
            <div className="flex justify-end">
              <Button onClick={addTrainingSession}>+ Add Training</Button>
            </div>

            {trainingSessions.map((session) => (
              <Card key={session.id}>
                <div className="p-4 sm:p-5">
                  <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <Input className="max-w-xs" type="date" value={session.date || ""} onChange={(event) => setTrainingSessions(trainingSessions.map((s) => (s.id === session.id ? { ...s, date: event.target.value } : s)))} />
                    <Button variant="outline" onClick={() => setTrainingSessions(trainingSessions.filter((s) => s.id !== session.id))}>
                      × Delete Training
                    </Button>
                  </div>

                  <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5">
                    {players.map((player) => (
                      <button
                        key={player}
                        onClick={() => toggleAttendance(session.id, player)}
                        className={`rounded-2xl border p-3 text-left transition ${session.attendance?.[player] ? "bg-slate-900 text-white" : "bg-white hover:bg-slate-100"}`}
                      >
                        <p className="font-semibold">{player}</p>
                        <p className="text-xs opacity-75">{session.attendance?.[player] ? "Attended" : "Missed"}</p>
                      </button>
                    ))}
                  </div>
                </div>
              </Card>
            ))}

            {!trainingSessions.length && (
              <Card>
                <div className="p-4 text-sm text-slate-500 sm:p-5">No Training Sessions Yet. Add One Above.</div>
              </Card>
            )}
          </main>
        )}

        <Card className="border border-red-200">
          <div className="p-4 sm:p-5">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="text-xl font-bold text-red-700">Clear Data</h2>
                <p className="mt-1 text-sm text-slate-600">Remove All Players, Matches, Trainings, Ratings, Goals, Assists, And Saved Selections From This Tracker.</p>
              </div>

              {!confirmClearData ? (
                <button onClick={() => setConfirmClearData(true)} className="rounded-xl border border-red-300 bg-white px-4 py-2 text-sm font-semibold text-red-700 hover:bg-red-50">
                  Clear Data
                </button>
              ) : (
                <div className="rounded-2xl border border-red-200 bg-red-50 p-3">
                  <p className="heading-label mb-3 text-sm font-semibold text-red-700">Are You Sure? This Cannot Be Undone.</p>
                  <div className="flex flex-wrap gap-2">
                    <button onClick={clearAllData} className="rounded-xl bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700">
                      Yes, Clear Everything
                    </button>
                    <button onClick={() => setConfirmClearData(false)} className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-100">
                      Cancel
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}
