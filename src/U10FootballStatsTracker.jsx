import React, { useEffect, useMemo, useState } from "react";

const DEFAULT_PLAYERS = ["Finn", "Anton", "Theo", "Noah", "Riley", "Jude", "Leo", "Mason", "Harry", "Oscar"];
const FORMATIONS = ["3-2-1", "2-3-1", "2-2-2", "3-1-2"];
const OWN_GOAL = "Own Goal";
const DEFAULT_TEAM_NAME = "Football Stats Tracker";
const DEFAULT_TEAM_SETTINGS = {
  primaryColor: "#0f172a",
  secondaryColor: "#ffffff",
  accentColor: "#e2e8f0",
  headerStyle: "Solid",
  logo: "",
};
const STORAGE_KEY = "u10-football-stats-tracker-v1";

const SAMPLE_OPPONENTS = [
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

const SAMPLE_SCORES = [
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

function numberOrNull(value) {
  if (value === "" || value === null || value === undefined) return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function format(value) {
  const number = numberOrNull(value);
  return number === null ? "—" : number.toFixed(1);
}

function clampRating(value) {
  const number = numberOrNull(value);
  if (number === null) return "";
  return Math.max(0, Math.min(10, Math.round(number)));
}

function cleanStatCount(value) {
  const number = numberOrNull(value);
  if (number === null) return 0;
  return Math.max(0, Math.floor(number));
}

function averageRating(records) {
  const ratings = (records || []).map((record) => numberOrNull(record.rating)).filter((rating) => rating !== null);
  if (!ratings.length) return null;
  return ratings.reduce((sum, rating) => sum + rating, 0) / ratings.length;
}

function getKickoffBand(kickoffTime) {
  if (!kickoffTime) return "Unknown";
  const hour = Number(String(kickoffTime).split(":")[0]);
  if (!Number.isFinite(hour)) return "Unknown";
  if (hour < 10) return "Early";
  if (hour < 12) return "Mid-Morning";
  if (hour < 15) return "Afternoon";
  return "Late";
}

function getOutcomeText(match) {
  const teamGoals = numberOrNull(match?.teamGoals);
  const opponentGoals = numberOrNull(match?.opponentGoals);
  if (teamGoals === null || opponentGoals === null) return "No Result Yet";
  if (teamGoals > opponentGoals) return "Win";
  if (teamGoals < opponentGoals) return "Loss";
  return "Draw";
}

function getScoreText(match) {
  const teamGoals = numberOrNull(match?.teamGoals);
  const opponentGoals = numberOrNull(match?.opponentGoals);
  if (teamGoals === null || opponentGoals === null) return "No Score Yet";
  return `${teamGoals}-${opponentGoals}`;
}

function getResultText(match) {
  const scoreText = getScoreText(match);
  return scoreText === "No Score Yet" ? "No Result Yet" : `${getOutcomeText(match)} ${scoreText}`;
}

function todayString() {
  return new Date().toISOString().slice(0, 10);
}

function isFutureMatch(match) {
  return String(match?.date || "") >= todayString();
}

function sortMatchesByDate(matches, direction = "asc") {
  return [...(matches || [])].sort((a, b) => {
    const aValue = `${a.date || "9999-12-31"} ${a.kickoffTime || "99:99"}`;
    const bValue = `${b.date || "9999-12-31"} ${b.kickoffTime || "99:99"}`;
    return direction === "desc" ? bValue.localeCompare(aValue) : aValue.localeCompare(bValue);
  });
}

function matchToPredictionInput(match) {
  return {
    opponent: match?.opponent || "Upcoming Opponent",
    venue: match?.venue || "Home",
    competition: match?.competition || "League",
    kickoffTime: match?.kickoffTime || "09:00",
    formation: match?.formation || "3-2-1",
    date: match?.date || todayString(),
  };
}

function playerPlayed(match, playerName) {
  return Boolean((match?.players || []).find((player) => player.name === playerName && player.played));
}

function makeGoalTimeline(teamGoals, opponentGoals) {
  const us = cleanStatCount(teamGoals);
  const opponent = cleanStatCount(opponentGoals);
  const totalGoals = us + opponent;
  const timeline = [];
  let usAdded = 0;
  let opponentAdded = 0;

  for (let index = 0; index < totalGoals; index += 1) {
    const half = index < Math.ceil(totalGoals / 2) ? "First Half" : "Second Half";
    const addUs = usAdded < us && (opponentAdded >= opponent || (index + us) % 3 !== 0);

    if (addUs) {
      usAdded += 1;
      timeline.push({ id: `goal-${index}`, team: "Us", scorer: "", assister: "", half });
    } else {
      opponentAdded += 1;
      timeline.push({ id: `goal-${index}`, team: "Opponent", scorer: "", assister: "", half });
    }
  }

  return timeline;
}

function normaliseGoal(goal, index, match) {
  const isOpponent = goal.team === "Opponent";
  let scorer = isOpponent ? "" : goal.scorer || "";
  let assister = isOpponent || scorer === OWN_GOAL ? "" : goal.assister || "";

  if (scorer && scorer !== OWN_GOAL && !playerPlayed(match, scorer)) scorer = "";
  if (assister && (!playerPlayed(match, assister) || assister === scorer)) assister = "";

  return {
    id: goal.id ?? `goal-${index}`,
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
    if (goal.team === "Us" && goal.scorer && goal.scorer !== OWN_GOAL) goals[goal.scorer] = (goals[goal.scorer] || 0) + 1;
    if (goal.team === "Us" && goal.assister && goal.scorer !== OWN_GOAL) assists[goal.assister] = (assists[goal.assister] || 0) + 1;
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

function canSaveMatch(match) {
  return !(match?.goalTimeline || []).some((goal) => goal.team === "Us" && !goal.scorer);
}

function groupAverage(records, key) {
  const groups = {};
  for (const record of records || []) {
    const groupName = record[key] || "Unknown";
    if (!groups[groupName]) groups[groupName] = [];
    groups[groupName].push(record);
  }

  return Object.entries(groups)
    .map(([name, groupRecords]) => ({ name, average: averageRating(groupRecords), count: groupRecords.length }))
    .sort((a, b) => (b.average || 0) - (a.average || 0) || String(a.name).localeCompare(String(b.name)));
}

function makeSeasonTrainingSessions() {
  return Array.from({ length: 20 }, (_, weekIndex) => ({
    id: weekIndex + 1,
    date: addDays("2026-04-30", weekIndex * 7),
    preparingForMatchId: weekIndex + 1,
    attendance: Object.fromEntries(DEFAULT_PLAYERS.map((player, playerIndex) => [player, (weekIndex + playerIndex) % 6 !== 0 && (weekIndex * 2 + playerIndex) % 11 !== 0])),
  }));
}

function makeSeasonMatches() {
  const trainingSessions = makeSeasonTrainingSessions();
  const kickoffTimes = ["09:00", "09:30", "10:15", "11:00", "11:30", "12:30", "13:00", "14:00"];
  const competitions = ["Grading", "Grading", "League", "League", "Cup"];
  const baseRatings = [7, 6, 8, 6, 7, 6, 5, 7, 6, 8];
  const scorerPool = ["Theo", "Oscar", "Finn", "Mason"];

  return Array.from({ length: 20 }, (_, weekIndex) => {
    const [teamGoals, opponentGoals] = SAMPLE_SCORES[weekIndex];
    const venue = weekIndex % 2 === 0 ? "Home" : "Away";
    const competition = competitions[Math.min(competitions.length - 1, Math.floor(weekIndex / 4))];
    const kickoffTime = kickoffTimes[weekIndex % kickoffTimes.length];
    const formation = FORMATIONS[weekIndex % FORMATIONS.length];
    const training = trainingSessions[weekIndex];

    const players = DEFAULT_PLAYERS.map((name, playerIndex) => {
      const played = (weekIndex + playerIndex) % 9 !== 0;
      const attendedTraining = Boolean(training.attendance[name]);
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
      const noise = ((weekIndex + playerIndex * 2) % 5) - 2;
      const rating = played ? clampRating(baseRatings[playerIndex] + venueBoost + earlyBoost + formationBoost + resultBoost + noise + (attendedTraining ? 0 : -1)) : "";
      return { name, played, rating, goals: 0, assists: 0 };
    });

    const playedNames = players.filter((player) => player.played).map((player) => player.name);

    return syncMatch({
      id: weekIndex + 1,
      opponent: SAMPLE_OPPONENTS[weekIndex],
      venue,
      competition,
      kickoffTime,
      formation,
      date: addDays("2026-05-03", weekIndex * 7),
      teamGoals,
      opponentGoals,
      goalTimeline: makeGoalTimeline(teamGoals, opponentGoals).map((goal, goalIndex) => {
        if (goal.team !== "Us") return goal;
        const availableScorers = scorerPool.filter((name) => playedNames.includes(name));
        const scorer = availableScorers[(weekIndex + goalIndex) % Math.max(1, availableScorers.length)] || playedNames[0] || OWN_GOAL;
        const possibleAssisters = playedNames.filter((name) => name !== scorer);
        const assister = goalIndex % 3 === 0 || scorer === OWN_GOAL ? "" : possibleAssisters[(weekIndex + goalIndex) % Math.max(1, possibleAssisters.length)] || "";
        return { ...goal, scorer, assister };
      }),
      players,
    });
  });
}

function defaultPredictorInput() {
  return {
    opponent: "Upcoming Opponent",
    venue: "Home",
    competition: "League",
    kickoffTime: "09:00",
    formation: "3-2-1",
    date: addDays(todayString(), 7),
  };
}

function defaultState() {
  return {
    teamName: DEFAULT_TEAM_NAME,
    teamSettings: DEFAULT_TEAM_SETTINGS,
    players: DEFAULT_PLAYERS,
    matches: makeSeasonMatches(),
    trainingSessions: makeSeasonTrainingSessions(),
    selectedPlayer: DEFAULT_PLAYERS[0],
    playerSummarySort: "avgRating",
    predictorInput: defaultPredictorInput(),
  };
}

function loadState() {
  const defaults = defaultState();
  if (typeof window === "undefined") return defaults;
  try {
    const saved = window.localStorage.getItem(STORAGE_KEY);
    if (!saved) return defaults;
    const parsed = JSON.parse(saved);
    const players = Array.isArray(parsed.players) ? parsed.players.filter(Boolean) : defaults.players;
    const matches = Array.isArray(parsed.matches) ? parsed.matches.map(syncMatch) : defaults.matches;
    const trainingSessions = Array.isArray(parsed.trainingSessions) ? parsed.trainingSessions.map((session) => ({ ...session, preparingForMatchId: session.preparingForMatchId ?? "" })) : defaults.trainingSessions;
    const selectedPlayer = players.includes(parsed.selectedPlayer) ? parsed.selectedPlayer : players[0] || "";

    return {
      teamName: parsed.teamName || DEFAULT_TEAM_NAME,
      teamSettings: { ...DEFAULT_TEAM_SETTINGS, ...(parsed.teamSettings || {}) },
      players,
      matches,
      trainingSessions,
      selectedPlayer,
      playerSummarySort: parsed.playerSummarySort || defaults.playerSummarySort,
      predictorInput: { ...defaultPredictorInput(), ...(parsed.predictorInput || {}) },
    };
  } catch {
    return defaults;
  }
}

function saveState(state) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function readImageAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

function makePlayerStats(players, matches, trainingSessions) {
  return (players || []).map((name) => {
    const records = (matches || [])
      .map((match) => {
        const player = (match.players || []).find((entry) => entry.name === name);
        return {
          matchId: match.id,
          opponent: match.opponent || "Opponent",
          venue: match.venue || "Unknown",
          competition: match.competition || "Unknown",
          kickoffTime: match.kickoffTime || "",
          kickoffBand: getKickoffBand(match.kickoffTime),
          formation: match.formation || "Unknown",
          result: getResultText(match),
          date: match.date || "",
          rating: numberOrNull(player?.rating),
          played: Boolean(player?.played),
          goals: cleanStatCount(player?.goals),
          assists: cleanStatCount(player?.assists),
        };
      })
      .filter((record) => record.played && record.rating !== null)
      .sort((a, b) => `${a.date} ${a.kickoffTime}`.localeCompare(`${b.date} ${b.kickoffTime}`));

    const avgRating = averageRating(records);
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
      trainingAttended: (trainingSessions || []).filter((session) => Boolean(session.attendance?.[name])).length,
      trainingTotal: (trainingSessions || []).length,
      homeAverage: averageRating(records.filter((record) => record.venue === "Home")),
      awayAverage: averageRating(records.filter((record) => record.venue === "Away")),
      bestKickoffBand: groupAverage(records, "kickoffBand")[0]?.name || "—",
      bestFormation: groupAverage(records, "formation")[0]?.name || "—",
    };
  });
}

function makeAllPlayerMatchRecords(playerStats) {
  return (playerStats || []).flatMap((player) => player.records.map((record) => ({ ...record, player: player.name })));
}

function sortPlayerSummary(playerStats, sortKey) {
  const stats = Array.isArray(playerStats) ? playerStats : [];
  if (sortKey === "name") return [...stats].sort((a, b) => String(a.name || "").localeCompare(String(b.name || "")));
  return [...stats].sort((a, b) => (numberOrNull(b[sortKey]) ?? -1) - (numberOrNull(a[sortKey]) ?? -1) || String(a.name || "").localeCompare(String(b.name || "")));
}

function calculateTrainingEffect(targetPlayers, matches, trainingSessions) {
  const sortedTraining = [...(trainingSessions || [])].sort((a, b) => String(a.date || "").localeCompare(String(b.date || "")));
  const records = [];

  for (const playerName of targetPlayers || []) {
    for (const match of matches || []) {
      const player = (match.players || []).find((entry) => entry.name === playerName);
      const rating = numberOrNull(player?.rating);
      if (!player?.played || rating === null) continue;

      const linkedTraining = sortedTraining.filter((session) => String(session.preparingForMatchId || "") === String(match.id));
      const previousTraining = [...sortedTraining].reverse().find((session) => String(session.date || "") < String(match.date || ""));
      const relevantTraining = linkedTraining.length ? linkedTraining : previousTraining ? [previousTraining] : [];
      if (!relevantTraining.length) continue;

      const attendedAny = relevantTraining.some((session) => Boolean(session.attendance?.[playerName]));
      records.push({ playerName, rating, attendedPreviousTraining: attendedAny, linkedTrainingCount: linkedTraining.length });
    }
  }

  const attended = records.filter((record) => record.attendedPreviousTraining);
  const missed = records.filter((record) => !record.attendedPreviousTraining);
  const avg = (items) => (items.length ? items.reduce((sum, record) => sum + record.rating, 0) / items.length : null);

  return { attendedAverage: avg(attended), missedAverage: avg(missed), attendedCount: attended.length, missedCount: missed.length, records };
}

function makeGoalComboStats(matches) {
  const combos = {};
  for (const match of matches || []) {
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

function getFirstGoalTeam(match) {
  return (match.goalTimeline || [])[0]?.team || "None";
}

function makeTeamSummary(matches, playerRecords, trainingEffect) {
  const completed = (matches || []).filter((match) => numberOrNull(match.teamGoals) !== null && numberOrNull(match.opponentGoals) !== null);
  const wins = completed.filter((match) => getOutcomeText(match) === "Win").length;
  const draws = completed.filter((match) => getOutcomeText(match) === "Draw").length;
  const losses = completed.filter((match) => getOutcomeText(match) === "Loss").length;
  const goalsFor = completed.reduce((sum, match) => sum + cleanStatCount(match.teamGoals), 0);
  const goalsAgainst = completed.reduce((sum, match) => sum + cleanStatCount(match.opponentGoals), 0);
  const firstHalfFor = completed.reduce((sum, match) => sum + (match.goalTimeline || []).filter((goal) => goal.half !== "Second Half" && goal.team === "Us").length, 0);
  const firstHalfAgainst = completed.reduce((sum, match) => sum + (match.goalTimeline || []).filter((goal) => goal.half !== "Second Half" && goal.team === "Opponent").length, 0);
  const secondHalfFor = completed.reduce((sum, match) => sum + (match.goalTimeline || []).filter((goal) => goal.half === "Second Half" && goal.team === "Us").length, 0);
  const secondHalfAgainst = completed.reduce((sum, match) => sum + (match.goalTimeline || []).filter((goal) => goal.half === "Second Half" && goal.team === "Opponent").length, 0);
  const scoredFirstMatches = completed.filter((match) => getFirstGoalTeam(match) === "Us");
  const concededFirstMatches = completed.filter((match) => getFirstGoalTeam(match) === "Opponent");
  const recordFor = (items) => ["Win", "Draw", "Loss"].map((outcome) => items.filter((match) => getOutcomeText(match) === outcome).length).join("-");
  const venueGroups = groupAverage(playerRecords, "venue");
  const competitionGroups = groupAverage(playerRecords, "competition");
  const kickoffGroups = groupAverage(playerRecords, "kickoffBand");
  const formationGroups = groupAverage(playerRecords, "formation");
  const firstHalfGoalDifference = firstHalfFor - firstHalfAgainst;
  const secondHalfGoalDifference = secondHalfFor - secondHalfAgainst;

  return {
    matches: matches.length,
    completedMatches: completed.length,
    wins,
    draws,
    losses,
    goalsFor,
    goalsAgainst,
    goalDifference: goalsFor - goalsAgainst,
    firstHalfGoalsFor: firstHalfFor,
    firstHalfGoalsAgainst: firstHalfAgainst,
    firstHalfGoalDifference,
    secondHalfGoalsFor: secondHalfFor,
    secondHalfGoalsAgainst: secondHalfAgainst,
    secondHalfGoalDifference,
    betterHalf: firstHalfGoalDifference > secondHalfGoalDifference ? "First Half" : secondHalfGoalDifference > firstHalfGoalDifference ? "Second Half" : "Even",
    matchesWithFirstGoal: completed.filter((match) => getFirstGoalTeam(match) !== "None").length,
    scoredFirst: scoredFirstMatches.length,
    concededFirst: concededFirstMatches.length,
    scoredFirstRecord: recordFor(scoredFirstMatches),
    concededFirstRecord: recordFor(concededFirstMatches),
    averageTeamRating: averageRating(playerRecords),
    bestVenue: venueGroups[0] || null,
    bestCompetition: competitionGroups[0] || null,
    bestKickoffBand: kickoffGroups[0] || null,
    bestFormation: formationGroups[0] || null,
    venueGroups,
    competitionGroups,
    kickoffGroups,
    formationGroups,
    goalCombos: makeGoalComboStats(matches),
    trainingEffect,
  };
}

function getAverageForValue(records, key, value) {
  return averageRating((records || []).filter((record) => record[key] === value));
}

function predictPlayerRating(playerStat, predictorInput, trainingSessions) {
  const records = playerStat?.records || [];
  const baseAverage = numberOrNull(playerStat?.avgRating);
  if (baseAverage === null) return null;

  const kickoffBand = getKickoffBand(predictorInput.kickoffTime);
  const latestTraining = [...(trainingSessions || [])].sort((a, b) => String(a.date || "").localeCompare(String(b.date || ""))).at(-1);
  const attendedLatestTraining = Boolean(latestTraining?.attendance?.[playerStat.name]);
  const factors = [
    { value: baseAverage, weight: 0.35 },
    { value: averageRating(records.slice(-3)), weight: 0.2 },
    { value: getAverageForValue(records, "venue", predictorInput.venue), weight: 0.15 },
    { value: getAverageForValue(records, "formation", predictorInput.formation), weight: 0.15 },
    { value: getAverageForValue(records, "kickoffBand", kickoffBand), weight: 0.1 },
    { value: getAverageForValue(records, "competition", predictorInput.competition), weight: 0.05 },
  ].filter((factor) => numberOrNull(factor.value) !== null);

  const weightedTotal = factors.reduce((sum, factor) => sum + factor.value * factor.weight, 0);
  const weightTotal = factors.reduce((sum, factor) => sum + factor.weight, 0);
  const predicted = Math.max(0, Math.min(10, weightedTotal / weightTotal + (attendedLatestTraining ? 0.2 : -0.4)));

  return {
    player: playerStat.name,
    predicted,
    latestTraining: latestTraining ? (attendedLatestTraining ? "Attended" : "Missed") : "Unknown",
    seasonAverage: baseAverage,
    recentAverage: averageRating(records.slice(-3)),
    venueAverage: getAverageForValue(records, "venue", predictorInput.venue),
    formationAverage: getAverageForValue(records, "formation", predictorInput.formation),
    kickoffAverage: getAverageForValue(records, "kickoffBand", kickoffBand),
    competitionAverage: getAverageForValue(records, "competition", predictorInput.competition),
    matchesUsed: records.length,
  };
}

function makePredictionRows(playerStats, predictorInput, trainingSessions) {
  return (playerStats || [])
    .map((playerStat) => predictPlayerRating(playerStat, predictorInput, trainingSessions))
    .filter(Boolean)
    .sort((a, b) => b.predicted - a.predicted || a.player.localeCompare(b.player));
}

function makeTrendChartData(records) {
  const safeRecords = Array.isArray(records) ? records : [];
  const width = 1000;
  const height = 260;
  const padding = { top: 24, right: 24, bottom: 58, left: 42 };
  const plotWidth = width - padding.left - padding.right;
  const plotHeight = height - padding.top - padding.bottom;
  const denominator = Math.max(1, safeRecords.length - 1);
  const points = safeRecords.map((record, index) => {
    const rating = numberOrNull(record.rating) ?? 0;
    const x = padding.left + (index / denominator) * plotWidth;
    const y = padding.top + ((10 - rating) / 10) * plotHeight;
    return { ...record, index, rating, x, y };
  });
  const linePath = points.map((point, index) => `${index === 0 ? "M" : "L"} ${point.x} ${point.y}`).join(" ");
  return { width, height, padding, plotWidth, plotHeight, points, linePath };
}

function runCalculationTests() {
  console.assert(numberOrNull("8") === 8, "numberOrNull should accept numeric strings");
  console.assert(numberOrNull("") === null, "numberOrNull should treat blanks as null");
  console.assert(format(7.25) === "7.3", "format should round to one decimal place");
  console.assert(clampRating(7.6) === 8, "clampRating should round ratings");
  console.assert(getOutcomeText({ teamGoals: 2, opponentGoals: 2 }) === "Draw", "getOutcomeText should detect draws");
  console.assert(matchToPredictionInput({ opponent: "Test", venue: "Away", competition: "Cup", kickoffTime: "10:00", formation: "2-3-1", date: "2026-08-01" }).opponent === "Test", "matchToPredictionInput should map match fields for predictions");
  console.assert(Array.isArray(sortMatchesByDate([{ date: "2026-01-02" }, { date: "2026-01-01" }])) === true, "sortMatchesByDate should return an array");
  console.assert(makeGoalTimeline(2, 1).length === 3, "makeGoalTimeline should create goal events");
  console.assert(canSaveMatch({ goalTimeline: [{ id: 1, team: "Us", scorer: "A" }] }) === true, "canSaveMatch should allow goals with scorers");
  console.assert(canSaveMatch({ goalTimeline: [{ id: 1, team: "Us", scorer: "" }] }) === false, "canSaveMatch should block goals without scorers");
  console.assert(defaultState().teamName === DEFAULT_TEAM_NAME, "defaultState should include default team name");
  console.assert(defaultState().teamSettings.primaryColor === DEFAULT_TEAM_SETTINGS.primaryColor, "defaultState should include default team settings");
  console.assert(typeof DEFAULT_TEAM_SETTINGS.logo === "string", "default team logo should be stored as a string");
  console.assert(makeSeasonTrainingSessions()[0].preparingForMatchId === 1, "sample training sessions should link to a preparation match");
  const testMatch = syncMatch({ goalTimeline: [{ id: 1, team: "Us", scorer: "A", assister: "B", half: "First Half" }], players: [{ name: "A", played: true }, { name: "B", played: true }] });
  console.assert(testMatch.players.find((player) => player.name === "A").goals === 1, "syncMatch should count goals");
  console.assert(testMatch.players.find((player) => player.name === "B").assists === 1, "syncMatch should count assists");
  console.assert(makeTrendChartData([]).linePath === "", "trend chart data should handle empty records");
}

runCalculationTests();

function Button({ children, onClick, variant = "primary", type = "button", disabled = false }) {
  const base = "rounded-xl px-4 py-2 text-sm font-semibold transition active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-40";
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
  const safeRecords = Array.isArray(records) ? records : [];
  const chart = makeTrendChartData(safeRecords);

  if (!safeRecords.length) {
    return <div className="flex h-56 items-center justify-center rounded-2xl bg-slate-100 text-sm text-slate-500 sm:h-72">No Match Ratings Yet For This Player.</div>;
  }

  return (
    <div className="rounded-2xl bg-slate-100 p-3 sm:p-4">
      <div className="mb-3 flex flex-wrap gap-2 text-xs text-slate-600">
        <span className="rounded-full bg-white px-3 py-1 font-semibold">Season Trend</span>
        <span className="rounded-full bg-white px-3 py-1">{safeRecords.length} Rated Matches</span>
        <span className="rounded-full bg-white px-3 py-1">Latest: {format(safeRecords.at(-1)?.rating)}</span>
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
          {chart.points.map((point) => (
            <g key={`${point.matchId}-${point.opponent}-point`}>
              <circle cx={point.x} cy={point.y} r="6" fill="#0f172a">
                <title>{`${point.opponent} · ${point.venue} · ${point.formation || "No Formation"} · ${point.kickoffTime || "No Time"} · ${point.result}: ${point.rating}/10`}</title>
              </circle>
              <text x={point.x} y={point.y - 10} textAnchor="middle" fontSize="11" fontWeight="700" fill="#334155">
                {point.rating}
              </text>
              {safeRecords.length <= 12 && (
                <text x={point.x} y={chart.height - 34} textAnchor="middle" fontSize="10" fill="#64748b">
                  W{point.index + 1}
                </text>
              )}
              {safeRecords.length <= 8 && (
                <text x={point.x} y={chart.height - 18} textAnchor="middle" fontSize="10" fill="#64748b">
                  {point.venue === "Home" ? "H" : "A"} {point.kickoffTime || ""}
                </text>
              )}
            </g>
          ))}
        </svg>
      </div>
      <div className="mt-3 grid gap-2 text-xs text-slate-600 sm:grid-cols-2 lg:grid-cols-4">
        {safeRecords.slice(-4).map((record) => (
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
  const safeGroups = Array.isArray(groups) ? groups : [];
  return (
    <Card>
      <div className="p-4 sm:p-5">
        <h2 className="text-xl font-bold">{title}</h2>
        <div className="mt-4 space-y-3">
          {safeGroups.length ? (
            safeGroups.map((group) => (
              <div key={group.name}>
                <div className="mb-1 flex justify-between gap-2 text-sm">
                  <span className="font-semibold">{group.name}</span>
                  <span className="text-right text-slate-500">
                    {format(group.average)} From {group.count} Ratings
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
  const safeCombos = Array.isArray(combos) ? combos : [];
  const topCount = safeCombos[0]?.count || 0;
  return (
    <Card>
      <div className="p-4 sm:p-5">
        <h2 className="text-xl font-bold">Common Goal Combos</h2>
        <div className="mt-4 space-y-3">
          {safeCombos.length ? (
            safeCombos.map((combo, index) => (
              <div key={combo.combo}>
                <div className="mb-1 flex justify-between gap-2 text-sm">
                  <span className="font-semibold">
                    {index + 1}. {combo.combo}
                  </span>
                  <span className="text-slate-500">{combo.count} Goals</span>
                </div>
                <div className="h-3 overflow-hidden rounded-full bg-slate-100">
                  <div className="h-full rounded-full bg-slate-900" style={{ width: topCount ? `${Math.max(4, (combo.count / topCount) * 100)}%` : "0%" }} />
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
  const sortedPlayers = [...(players || [])]
    .sort((a, b) => (numberOrNull(b[statKey]) ?? 0) - (numberOrNull(a[statKey]) ?? 0) || String(a.name || "").localeCompare(String(b.name || "")))
    .filter((player) => !hideZeroValues || (numberOrNull(player[statKey]) ?? 0) > 0);
  const topValue = numberOrNull(sortedPlayers[0]?.[statKey]) ?? 0;

  return (
    <Card>
      <div className="p-4 sm:p-5">
        <h2 className="text-xl font-bold">{title}</h2>
        <div className="mt-4 space-y-3">
          {!sortedPlayers.length && <p className="rounded-2xl bg-slate-100 p-4 text-sm text-slate-500">{emptyMessage}</p>}
          {sortedPlayers.map((player, index) => {
            const value = numberOrNull(player[statKey]) ?? 0;
            const width = topValue > 0 ? `${Math.max(4, (value / topValue) * 100)}%` : "0%";
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
        <StatLeaderboard title="Highest Average Rating" players={playerStats} statKey="avgRating" valueFormatter={(value) => format(value)} onSelectPlayer={onSelectPlayer} />
      </div>
    </main>
  );
}

function TeamSummaryPage({ teamSummary }) {
  const trainingDifference = teamSummary.trainingEffect.attendedAverage === null || teamSummary.trainingEffect.missedAverage === null ? null : teamSummary.trainingEffect.attendedAverage - teamSummary.trainingEffect.missedAverage;
  return (
    <main className="space-y-4">
      <Card>
        <div className="p-4 sm:p-5">
          <h2 className="text-2xl font-bold">Team Summary</h2>
        </div>
      </Card>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <SummaryCard label="Record" value={`${teamSummary.wins}-${teamSummary.draws}-${teamSummary.losses}`} detail={`W-D-L From ${teamSummary.completedMatches} Completed Matches`} />
        <SummaryCard label="Goals" value={`${teamSummary.goalsFor}-${teamSummary.goalsAgainst}`} detail={`GD ${teamSummary.goalDifference > 0 ? "+" : ""}${teamSummary.goalDifference}`} />
        <SummaryCard label="Average Team Rating" value={format(teamSummary.averageTeamRating)} detail="Across All Player Ratings" />
        <SummaryCard label="Matches Tracked" value={teamSummary.matches} detail="Including Incomplete Scores" />
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <SummaryCard label="Scored First" value={teamSummary.scoredFirst} detail={`Record ${teamSummary.scoredFirstRecord}`} />
        <SummaryCard label="Conceded First" value={teamSummary.concededFirst} detail={`Record ${teamSummary.concededFirstRecord}`} />
        <SummaryCard label="First Goal Logged" value={teamSummary.matchesWithFirstGoal} detail="Matches With A Goal Order" />
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <SummaryCard label="First Half" value={`${teamSummary.firstHalfGoalsFor}-${teamSummary.firstHalfGoalsAgainst}`} detail={`GD ${teamSummary.firstHalfGoalDifference > 0 ? "+" : ""}${teamSummary.firstHalfGoalDifference}`} />
        <SummaryCard label="Second Half" value={`${teamSummary.secondHalfGoalsFor}-${teamSummary.secondHalfGoalsAgainst}`} detail={`GD ${teamSummary.secondHalfGoalDifference > 0 ? "+" : ""}${teamSummary.secondHalfGoalDifference}`} />
        <SummaryCard label="Better Half" value={teamSummary.betterHalf} detail="Based On Goal Difference" />
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <SummaryCard label="Best Venue" value={teamSummary.bestVenue?.name || "—"} detail={`${format(teamSummary.bestVenue?.average)} Average Rating`} />
        <SummaryCard label="Best Kick-Off Time" value={teamSummary.bestKickoffBand?.name || "—"} detail={`${format(teamSummary.bestKickoffBand?.average)} Average Rating`} />
        <SummaryCard label="Best Competition" value={teamSummary.bestCompetition?.name || "—"} detail={`${format(teamSummary.bestCompetition?.average)} Average Rating`} />
        <SummaryCard label="Best Formation" value={teamSummary.bestFormation?.name || "—"} detail={`${format(teamSummary.bestFormation?.average)} Average Rating`} />
      </div>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <GroupAverageTable title="Home Vs Away" groups={teamSummary.venueGroups} />
        <GroupAverageTable title="Kick-Off Time" groups={teamSummary.kickoffGroups} />
        <GroupAverageTable title="Competition" groups={teamSummary.competitionGroups} />
        <GroupAverageTable title="Formation" groups={teamSummary.formationGroups} />
      </div>
      <GoalComboTable combos={teamSummary.goalCombos} />
      <Card>
        <div className="p-4 sm:p-5">
          <h2 className="text-xl font-bold">Training Effect</h2>
          <div className="mt-4 grid gap-4 md:grid-cols-3">
            <SummaryPanel label="After Attending Training" value={format(teamSummary.trainingEffect.attendedAverage)} detail={`${teamSummary.trainingEffect.attendedCount} Match Records`} />
            <SummaryPanel label="After Missing Training" value={format(teamSummary.trainingEffect.missedAverage)} detail={`${teamSummary.trainingEffect.missedCount} Match Records`} />
            <SummaryPanel label="Difference" value={format(trainingDifference)} detail="Attended Minus Missed" />
          </div>
        </div>
      </Card>
    </main>
  );
}

function PredictionPanel({ match, playerStats, trainingSessions }) {
  const rows = makePredictionRows(playerStats, matchToPredictionInput(match), trainingSessions);
  const topPrediction = rows[0] || null;

  return (
    <Card className="mb-4 border border-slate-200">
      <div className="p-4 sm:p-5">
        <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h3 className="text-lg font-bold">Match Predictions</h3>
            <p className="heading-label text-sm text-slate-500">Predictions Based On This Future Match's Venue, Competition, Kick-Off Time, Formation, Recent Form, And Training.</p>
          </div>
          <div className="rounded-2xl bg-slate-100 px-3 py-2 text-sm font-semibold text-slate-700">
            Top: {topPrediction?.player || "—"} {topPrediction ? `· ${format(topPrediction.predicted)}` : ""}
          </div>
        </div>
        <div className="grid gap-3">
          {rows.map((row) => (
            <div key={row.player} className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
              <div className="flex items-center justify-between gap-3">
                <p className="font-bold">{row.player}</p>
                <p className="rounded-full bg-white px-3 py-1 text-sm font-bold">{format(row.predicted)}</p>
              </div>
              <div className="mt-3 grid gap-2 text-xs text-slate-600 sm:grid-cols-2 lg:grid-cols-4">
                <p>Season Avg: {format(row.seasonAverage)}</p>
                <p>Recent Form: {format(row.recentAverage)}</p>
                <p>Home/Away Avg: {format(row.venueAverage)}</p>
                <p>Formation Avg: {format(row.formationAverage)}</p>
                <p>Kick-Off Avg: {format(row.kickoffAverage)}</p>
                <p>Competition Avg: {format(row.competitionAverage)}</p>
                <p>Latest Training: {row.latestTraining}</p>
                <p>Matches Used: {row.matchesUsed}</p>
              </div>
            </div>
          ))}
          {!rows.length && <p className="rounded-2xl bg-slate-100 p-4 text-center text-sm text-slate-500">No Player Ratings Available To Predict From Yet.</p>}
        </div>
      </div>
    </Card>
  );
}

function GoalTimelineEditor({ match, onAddGoal, onUpdateGoal, onRemoveGoal }) {
  const timeline = match.goalTimeline || [];
  const firstHalfGoals = timeline.filter((goal) => goal.half !== "Second Half");
  const secondHalfGoals = timeline.filter((goal) => goal.half === "Second Half");
  const playedPlayers = (match.players || []).filter((player) => player.played);

  const GoalSection = ({ title, half, goals }) => (
    <div className="rounded-2xl border border-slate-200 bg-white p-4">
      <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <h4 className="text-base font-bold">{title}</h4>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={() => onAddGoal("Us", half)}>+ Our Goal</Button>
          <Button variant="outline" onClick={() => onAddGoal("Opponent", half)}>+ Opp Goal</Button>
        </div>
      </div>
      {goals.length ? (
        <div className="space-y-2">
          {goals.map((goal, index) => {
            const missingScorer = goal.team === "Us" && !goal.scorer;
            return (
              <div key={goal.id} className={`rounded-2xl p-3 ${missingScorer ? "border border-red-200 bg-red-50" : "bg-slate-100"}`}>
                <div className="mb-2 flex items-center justify-between gap-3">
                  <div>
                    <div className="font-semibold">Goal {index + 1}</div>
                    {missingScorer && <p className="heading-label mt-1 text-xs font-semibold text-red-700">Scorer Required</p>}
                  </div>
                  <Button variant="outline" onClick={() => onRemoveGoal(goal.id)}>Remove</Button>
                </div>
                <div className="grid gap-2 sm:grid-cols-3">
                  <SelectInput value={goal.team} onChange={(event) => onUpdateGoal(goal.id, { team: event.target.value, scorer: event.target.value === "Opponent" ? "" : goal.scorer, assister: event.target.value === "Opponent" ? "" : goal.assister })}>
                    <option value="Us">Us</option>
                    <option value="Opponent">Opponent</option>
                  </SelectInput>
                  {goal.team === "Us" && (
                    <SelectInput value={goal.scorer || ""} onChange={(event) => onUpdateGoal(goal.id, { scorer: event.target.value, assister: event.target.value === OWN_GOAL ? "" : goal.assister })} className={missingScorer ? "border-red-400" : ""}>
                      <option value="">Pick Scorer</option>
                      <option value={OWN_GOAL}>{OWN_GOAL}</option>
                      {playedPlayers.map((player) => <option key={player.name} value={player.name}>{player.name}</option>)}
                    </SelectInput>
                  )}
                  {goal.team === "Us" && goal.scorer && goal.scorer !== OWN_GOAL && (
                    <SelectInput value={goal.assister || ""} onChange={(event) => onUpdateGoal(goal.id, { assister: event.target.value })}>
                      <option value="">No Assist</option>
                      {playedPlayers.filter((player) => player.name !== goal.scorer).map((player) => <option key={player.name} value={player.name}>{player.name}</option>)}
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
      <div className="p-4">
        <div className="mb-3">
          <h3 className="text-lg font-bold">Goal Order</h3>
          <p className="heading-label text-sm text-slate-500">Log Goals Under The Half They Were Scored In.</p>
        </div>
        <div className="grid gap-3 lg:grid-cols-2">
          <GoalSection title="First Half Goals" half="First Half" goals={firstHalfGoals} />
          <GoalSection title="Second Half Goals" half="Second Half" goals={secondHalfGoals} />
        </div>
      </div>
    </Card>
  );
}

function PlayerDashboard({ selectedStats, playerTrainingEffect }) {
  const selectedRecords = selectedStats?.records || [];
  const trainingDifference = playerTrainingEffect.attendedAverage === null || playerTrainingEffect.missedAverage === null ? null : playerTrainingEffect.attendedAverage - playerTrainingEffect.missedAverage;

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <SummaryCard label="Average Rating" value={format(selectedStats?.avgRating)} detail="Match Rating" />
        <SummaryCard label="Goals" value={selectedStats?.goals || 0} detail="Season Total" />
        <SummaryCard label="Assists" value={selectedStats?.assists || 0} detail="Season Total" />
        <SummaryCard label="Training Attended" value={`${selectedStats?.trainingAttended || 0}/${selectedStats?.trainingTotal || 0}`} detail="Sessions" />
      </div>
      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <div className="p-4 sm:p-5">
            <h2 className="text-xl font-bold">{selectedStats?.name || "Player"} Rating Trend</h2>
            <TrendChart records={selectedRecords} />
          </div>
        </Card>
        <Card>
          <div className="p-4 sm:p-5">
            <h2 className="text-xl font-bold">Training Effect</h2>
            <p className="heading-label mt-1 text-sm text-slate-500">This Only Uses {selectedStats?.name || "This Player"}'s Match Ratings.</p>
            <div className="mt-5 space-y-4">
              <SummaryPanel label="After Attending Training" value={format(playerTrainingEffect.attendedAverage)} detail={`${playerTrainingEffect.attendedCount} Match Records`} />
              <SummaryPanel label="After Missing Training" value={format(playerTrainingEffect.missedAverage)} detail={`${playerTrainingEffect.missedCount} Match Records`} />
              <p className="text-sm text-slate-600">Difference: <span className="font-bold">{format(trainingDifference)}</span></p>
            </div>
          </div>
        </Card>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <GroupAverageTable title="Home Vs Away" groups={groupAverage(selectedRecords, "venue")} />
        <GroupAverageTable title="Competition" groups={groupAverage(selectedRecords, "competition")} />
        <GroupAverageTable title="Kick-Off Time" groups={groupAverage(selectedRecords, "kickoffBand")} />
        <GroupAverageTable title="Formation" groups={groupAverage(selectedRecords, "formation")} />
      </div>
    </div>
  );
}

export default function U10FootballStatsTracker() {
  const [initialTrackerState] = useState(loadState);
  const [teamName, setTeamName] = useState(initialTrackerState.teamName || DEFAULT_TEAM_NAME);
  const [teamSettings, setTeamSettings] = useState(initialTrackerState.teamSettings || DEFAULT_TEAM_SETTINGS);
  const [players, setPlayers] = useState(initialTrackerState.players);
  const [newPlayer, setNewPlayer] = useState("");
  const [matches, setMatches] = useState(initialTrackerState.matches);
  const [trainingSessions, setTrainingSessions] = useState(initialTrackerState.trainingSessions);
  const [selectedPlayer, setSelectedPlayer] = useState(initialTrackerState.selectedPlayer);
  const [activeTab, setActiveTab] = useState("players");
  const [editingPlayer, setEditingPlayer] = useState(null);
  const [editingPlayerName, setEditingPlayerName] = useState("");
  const [playerToRemove, setPlayerToRemove] = useState(null);
  const [expandedMatchId, setExpandedMatchId] = useState(null);
  const [editingMatchDraft, setEditingMatchDraft] = useState(null);
  const [confirmClearData, setConfirmClearData] = useState(false);
  const [playerSummarySort, setPlayerSummarySort] = useState(initialTrackerState.playerSummarySort);
  const [predictorInput, setPredictorInput] = useState(initialTrackerState.predictorInput);

  useEffect(() => {
    saveState({ teamName, teamSettings, players, matches, trainingSessions, selectedPlayer, playerSummarySort, predictorInput });
  }, [teamName, teamSettings, players, matches, trainingSessions, selectedPlayer, playerSummarySort, predictorInput]);

  const playerStats = useMemo(() => makePlayerStats(players, matches, trainingSessions), [players, matches, trainingSessions]);
  const playerRecords = useMemo(() => makeAllPlayerMatchRecords(playerStats), [playerStats]);
  const selectedStats = playerStats.find((player) => player.name === selectedPlayer) || playerStats[0] || { records: [], name: "" };
  const overallTrainingEffect = useMemo(() => calculateTrainingEffect(players, matches, trainingSessions), [players, matches, trainingSessions]);
  const selectedPlayerTrainingEffect = useMemo(() => calculateTrainingEffect(selectedStats?.name ? [selectedStats.name] : [], matches, trainingSessions), [selectedStats?.name, matches, trainingSessions]);
  const leaderboard = useMemo(() => sortPlayerSummary(playerStats, playerSummarySort), [playerStats, playerSummarySort]);
  const teamSummary = useMemo(() => makeTeamSummary(matches, playerRecords, overallTrainingEffect), [matches, playerRecords, overallTrainingEffect]);
  const predictionRows = useMemo(() => makePredictionRows(playerStats, predictorInput, trainingSessions), [playerStats, predictorInput, trainingSessions]);
  const futureMatches = useMemo(() => sortMatchesByDate(matches.filter(isFutureMatch), "asc"), [matches]);
  const completedMatches = useMemo(() => sortMatchesByDate(matches.filter((match) => !isFutureMatch(match)), "desc"), [matches]);
  const tabs = ["Players", "Stats", "Team Summary", "Matches", "Training"];
  const trendSymbol = (trend) => (trend === null ? "—" : trend > 0 ? "↑" : trend < 0 ? "↓" : "→");
  const sortLabel = (key, label) => `${label}${playerSummarySort === key ? " ↓" : ""}`;
  const headerBackground = teamSettings.headerStyle === "Gradient" ? `linear-gradient(135deg, ${teamSettings.primaryColor}, ${teamSettings.accentColor})` : teamSettings.primaryColor;
  const headerTextColor = teamSettings.secondaryColor;
  const buttonAccentStyle = { backgroundColor: teamSettings.primaryColor, color: teamSettings.secondaryColor, borderColor: teamSettings.primaryColor };

  function clearAllData() {
    setTeamName(DEFAULT_TEAM_NAME);
    setTeamSettings(DEFAULT_TEAM_SETTINGS);
    setPlayers([]);
    setMatches([]);
    setTrainingSessions([]);
    setSelectedPlayer("");
    setNewPlayer("");
    setEditingPlayer(null);
    setEditingPlayerName("");
    setPlayerToRemove(null);
    setExpandedMatchId(null);
    setEditingMatchDraft(null);
    setConfirmClearData(false);
    setPredictorInput(defaultPredictorInput());
    setPlayerSummarySort("avgRating");
    if (typeof window !== "undefined") window.localStorage.removeItem(STORAGE_KEY);
    setActiveTab("team editor");
  }

  function addPlayer() {
    const cleanName = String(newPlayer || "").trim();
    if (!cleanName || players.some((player) => player.toLowerCase() === cleanName.toLowerCase())) return;
    setPlayers([...players, cleanName]);
    setMatches(matches.map((match) => syncMatch({ ...match, players: [...(match.players || []), { name: cleanName, played: false, rating: "", goals: 0, assists: 0 }] })));
    setTrainingSessions(trainingSessions.map((session) => ({ ...session, attendance: { ...(session.attendance || {}), [cleanName]: false } })));
    setSelectedPlayer(cleanName);
    setNewPlayer("");
  }

  function savePlayerRename(oldName) {
    const cleanName = String(editingPlayerName || "").trim();
    if (!cleanName || (cleanName !== oldName && players.some((player) => player.toLowerCase() === cleanName.toLowerCase()))) return;
    setPlayers(players.map((player) => (player === oldName ? cleanName : player)));
    setMatches(matches.map((match) => syncMatch({
      ...match,
      players: (match.players || []).map((player) => (player.name === oldName ? { ...player, name: cleanName } : player)),
      goalTimeline: (match.goalTimeline || []).map((goal) => ({ ...goal, scorer: goal.scorer === oldName ? cleanName : goal.scorer, assister: goal.assister === oldName ? cleanName : goal.assister })),
    })));
    setTrainingSessions(trainingSessions.map((session) => {
      const attendance = { ...(session.attendance || {}) };
      if (Object.prototype.hasOwnProperty.call(attendance, oldName)) {
        attendance[cleanName] = attendance[oldName];
        delete attendance[oldName];
      }
      return { ...session, attendance };
    }));
    setSelectedPlayer(selectedPlayer === oldName ? cleanName : selectedPlayer);
    setEditingPlayer(null);
    setEditingPlayerName("");
    setPlayerToRemove(null);
  }

  function removePlayer(playerName) {
    const nextPlayers = players.filter((player) => player !== playerName);
    setPlayers(nextPlayers);
    setMatches(matches.map((match) => syncMatch({
      ...match,
      players: (match.players || []).filter((player) => player.name !== playerName),
      goalTimeline: (match.goalTimeline || []).map((goal) => ({ ...goal, scorer: goal.scorer === playerName ? "" : goal.scorer, assister: goal.assister === playerName ? "" : goal.assister })),
    })));
    setTrainingSessions(trainingSessions.map((session) => {
      const attendance = { ...(session.attendance || {}) };
      delete attendance[playerName];
      return { ...session, attendance };
    }));
    setSelectedPlayer(selectedPlayer === playerName ? nextPlayers[0] || "" : selectedPlayer);
    setEditingPlayer(null);
    setEditingPlayerName("");
    setPlayerToRemove(null);
  }

  function addMatch() {
    const nextId = matches.length ? Math.max(...matches.map((match) => match.id)) + 1 : 1;
    const newMatch = {
      id: nextId,
      opponent: `Opponent ${nextId}`,
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
    setMatches([...matches, newMatch]);
    setExpandedMatchId(nextId);
    setEditingMatchDraft(JSON.parse(JSON.stringify(newMatch)));
  }

  function openMatchEditor(match) {
    setExpandedMatchId(match.id);
    setEditingMatchDraft(JSON.parse(JSON.stringify(match)));
  }

  function closeMatchEditor() {
    if (editingMatchDraft && !canSaveMatch(editingMatchDraft)) return;
    setExpandedMatchId(null);
    setEditingMatchDraft(null);
  }

  function cancelMatchEditor() {
    setExpandedMatchId(null);
    setEditingMatchDraft(null);
  }

  function updateEditingMatchDraft(patch) {
    setEditingMatchDraft((currentDraft) => (currentDraft ? syncMatch({ ...currentDraft, ...patch }) : currentDraft));
  }

  function addGoalToEditingMatch(team, half) {
    setEditingMatchDraft((currentDraft) => currentDraft ? syncMatch({
      ...currentDraft,
      goalTimeline: [...(currentDraft.goalTimeline || []), { id: Date.now() + Math.random(), team, scorer: "", assister: "", half }],
    }) : currentDraft);
  }

  function updateGoalInEditingMatch(goalId, patch) {
    setEditingMatchDraft((currentDraft) => currentDraft ? syncMatch({
      ...currentDraft,
      goalTimeline: (currentDraft.goalTimeline || []).map((goal) => (goal.id === goalId ? { ...goal, ...patch } : goal)),
    }) : currentDraft);
  }

  function removeGoalFromEditingMatch(goalId) {
    setEditingMatchDraft((currentDraft) => currentDraft ? syncMatch({
      ...currentDraft,
      goalTimeline: (currentDraft.goalTimeline || []).filter((goal) => goal.id !== goalId),
    }) : currentDraft);
  }

  function updatePlayerInEditingMatch(playerName, patch) {
    setEditingMatchDraft((currentDraft) => {
      if (!currentDraft) return currentDraft;
      let nextTimeline = currentDraft.goalTimeline || [];
      if (Object.prototype.hasOwnProperty.call(patch, "played") && !patch.played) {
        nextTimeline = nextTimeline.map((goal) => ({ ...goal, scorer: goal.scorer === playerName ? "" : goal.scorer, assister: goal.assister === playerName ? "" : goal.assister }));
      }
      return syncMatch({
        ...currentDraft,
        goalTimeline: nextTimeline,
        players: (currentDraft.players || []).map((player) => player.name === playerName ? {
          ...player,
          ...patch,
          rating: patch.played === false ? "" : Object.prototype.hasOwnProperty.call(patch, "rating") ? clampRating(patch.rating) : player.rating,
        } : player),
      });
    });
  }

  function saveEditingMatch() {
    if (!editingMatchDraft || !canSaveMatch(editingMatchDraft)) return;
    setMatches((currentMatches) => currentMatches.map((match) => match.id === editingMatchDraft.id ? syncMatch(editingMatchDraft) : match));
    setExpandedMatchId(null);
    setEditingMatchDraft(null);
  }

  function deleteMatch(matchId) {
    setMatches((currentMatches) => currentMatches.filter((match) => match.id !== matchId));
    if (expandedMatchId === matchId) cancelMatchEditor();
  }

  function addTrainingSession() {
    const nextId = trainingSessions.length ? Math.max(...trainingSessions.map((session) => session.id)) + 1 : 1;
    const upcomingMatch = [...matches].sort((a, b) => String(a.date || "").localeCompare(String(b.date || ""))).find((match) => String(match.date || "") >= new Date().toISOString().slice(0, 10));
    setTrainingSessions([...trainingSessions, { id: nextId, date: new Date().toISOString().slice(0, 10), preparingForMatchId: upcomingMatch?.id || "", attendance: Object.fromEntries(players.map((player) => [player, false])) }]);
  }

  function updateTrainingSession(sessionId, patch) {
    setTrainingSessions(trainingSessions.map((session) => session.id === sessionId ? { ...session, ...patch } : session));
  }

  function matchLabel(matchId) {
    const match = matches.find((item) => String(item.id) === String(matchId));
    return match ? `${match.date || "No Date"} · ${match.opponent || "Opponent"} · ${match.venue || "Home"}` : "No Match Selected";
  }

  function toggleAttendance(sessionId, playerName) {
    setTrainingSessions(trainingSessions.map((session) => session.id === sessionId ? { ...session, attendance: { ...(session.attendance || {}), [playerName]: !session.attendance?.[playerName] } } : session));
  }

  async function uploadTeamLogo(event) {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      const dataUrl = await readImageAsDataUrl(file);
      setTeamSettings({ ...teamSettings, logo: dataUrl });
    } catch {
      setTeamSettings({ ...teamSettings, logo: "" });
    }
  }

  function renderMatchCard(match) {
    const isExpanded = expandedMatchId === match.id;
    const draftMatch = isExpanded && editingMatchDraft?.id === match.id ? editingMatchDraft : match;
    const matchCanBeSaved = canSaveMatch(draftMatch);
    const missingScorerCount = (draftMatch.goalTimeline || []).filter((goal) => goal.team === "Us" && !goal.scorer).length;
    const playedCount = (match.players || []).filter((player) => player.played).length;
    const ratingCount = (match.players || []).filter((player) => player.played && numberOrNull(player.rating) !== null).length;
    const totalGoals = (match.players || []).reduce((sum, player) => sum + cleanStatCount(player.goals), 0);
    const totalAssists = (match.players || []).reduce((sum, player) => sum + cleanStatCount(player.assists), 0);
    const future = isFutureMatch(match);

    return (
      <Card key={match.id}>
        <div className="p-4 sm:p-5">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-xl font-bold">{match.opponent || "Opponent"}</h2>
                <span className={`rounded-full px-3 py-1 text-xs font-semibold ${future ? "bg-blue-50 text-blue-700" : "bg-emerald-50 text-emerald-700"}`}>{future ? "Future" : "Completed"}</span>
                <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">{match.venue || "Home"}</span>
                <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">{match.competition || "No Competition"}</span>
                <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">{match.formation || "No Formation"}</span>
              </div>
              <p className="mt-2 text-sm text-slate-500">{match.date || "No Date"} · {match.kickoffTime || "No Time"} · {future ? "Upcoming" : getResultText(match)}</p>
            </div>
            <div className="flex flex-wrap items-center gap-2 md:justify-end">
              {!future && <span className="rounded-2xl bg-slate-100 px-3 py-2 text-xs font-semibold text-slate-600">{playedCount} Played</span>}
              {!future && <span className="rounded-2xl bg-slate-100 px-3 py-2 text-xs font-semibold text-slate-600">{ratingCount} Ratings</span>}
              {!future && <span className="rounded-2xl bg-slate-100 px-3 py-2 text-xs font-semibold text-slate-600">G {totalGoals} · A {totalAssists}</span>}
              <Button variant="outline" onClick={() => (isExpanded ? closeMatchEditor() : openMatchEditor(match))}>{isExpanded ? "Close" : future ? "Open" : "Edit"}</Button>
            </div>
          </div>

          {isExpanded && (
            <div className="mt-5 border-t border-slate-200 pt-5">
              <div className="mb-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-6">
                <Input value={draftMatch.opponent || ""} onChange={(event) => updateEditingMatchDraft({ opponent: event.target.value })} placeholder="Opponent" />
                <SelectInput value={draftMatch.venue || "Home"} onChange={(event) => updateEditingMatchDraft({ venue: event.target.value })}>
                  <option value="Home">Home</option>
                  <option value="Away">Away</option>
                </SelectInput>
                <Input value={draftMatch.competition || ""} onChange={(event) => updateEditingMatchDraft({ competition: event.target.value })} placeholder="Competition" />
                <Input type="time" value={draftMatch.kickoffTime || ""} onChange={(event) => updateEditingMatchDraft({ kickoffTime: event.target.value })} />
                <SelectInput value={FORMATIONS.includes(draftMatch.formation) ? draftMatch.formation : "3-2-1"} onChange={(event) => updateEditingMatchDraft({ formation: event.target.value })}>
                  {FORMATIONS.map((formation) => <option key={formation} value={formation}>{formation}</option>)}
                </SelectInput>
                <Input type="date" value={draftMatch.date || ""} onChange={(event) => updateEditingMatchDraft({ date: event.target.value })} />
              </div>

              {future && <PredictionPanel match={draftMatch} playerStats={playerStats} trainingSessions={trainingSessions} />}

              {!future && <GoalTimelineEditor match={draftMatch} onAddGoal={addGoalToEditingMatch} onUpdateGoal={updateGoalInEditingMatch} onRemoveGoal={removeGoalFromEditingMatch} />}

              {!future && !matchCanBeSaved && <div className="mb-4 rounded-2xl border border-red-200 bg-red-50 p-3 text-sm font-semibold text-red-700">Select A Scorer For {missingScorerCount} Goal{missingScorerCount === 1 ? "" : "s"} Before Saving Or Closing This Match.</div>}

              <div className="mb-4 flex flex-wrap justify-end gap-2">
                <Button onClick={saveEditingMatch} disabled={!future && !matchCanBeSaved}>Save Match</Button>
                <Button variant="outline" onClick={cancelMatchEditor}>Cancel</Button>
                <Button variant="outline" onClick={() => deleteMatch(match.id)}>× Delete Match</Button>
              </div>

              {!future && <div className="grid gap-2">
                {(draftMatch.players || []).map((player) => (
                  <div key={player.name} className="rounded-2xl bg-slate-50 p-3">
                    <div className="flex items-center justify-between gap-3">
                      <p className="font-semibold">{player.name}</p>
                      <label className="flex items-center gap-2 text-sm">
                        <input type="checkbox" checked={Boolean(player.played)} onChange={(event) => updatePlayerInEditingMatch(player.name, { played: event.target.checked })} />
                        Played
                      </label>
                    </div>
                    <div className="mt-3 grid gap-3 sm:grid-cols-4">
                      <div className="sm:col-span-2">
                        <p className="mb-1 text-xs text-slate-500">Rating: {player.rating === "" ? "—" : player.rating}/10</p>
                        <input type="range" min="0" max="10" step="1" value={player.rating === "" ? 0 : player.rating} disabled={!player.played} onChange={(event) => updatePlayerInEditingMatch(player.name, { rating: event.target.value })} className="w-full accent-slate-900 disabled:opacity-40" />
                      </div>
                      <p className="text-sm">Goals: {player.goals}</p>
                      <p className="text-sm">Assists: {player.assists}</p>
                    </div>
                  </div>
                ))}
              </div>}
            </div>
          )}
        </div>
      </Card>
    );
  }

  return (
    <div className="title-case-ui min-h-screen bg-slate-200 p-3 text-slate-900 sm:p-4 md:p-8">
      <style>{`.title-case-ui h1,.title-case-ui h2,.title-case-ui h3,.title-case-ui h4,.title-case-ui th,.title-case-ui label,.title-case-ui nav button,.title-case-ui .heading-label{text-transform:capitalize}`}</style>
      <div className="mx-auto max-w-7xl space-y-4 sm:space-y-6">
        <header className="rounded-2xl p-4 shadow-sm sm:rounded-3xl sm:p-6" style={{ background: headerBackground, color: headerTextColor }}>
          <div className="flex items-center gap-3">
            <button onClick={() => setActiveTab("team editor")} className="shrink-0 rounded-xl border px-3 py-2 text-sm font-semibold shadow-sm transition hover:opacity-90" style={{ backgroundColor: teamSettings.secondaryColor, color: teamSettings.primaryColor, borderColor: teamSettings.secondaryColor }} aria-label="Edit Team">✎</button>
            {teamSettings.logo && <img src={teamSettings.logo} alt="Team Logo" className="h-12 w-12 shrink-0 rounded-2xl bg-white object-cover p-1 shadow-sm sm:h-16 sm:w-16" />}
            <h1 className="break-words text-2xl font-bold tracking-tight sm:text-3xl md:text-5xl">{teamName || DEFAULT_TEAM_NAME}</h1>
          </div>
        </header>

        <nav className="grid grid-cols-2 gap-1 rounded-2xl bg-white p-1 shadow-sm sm:grid-cols-3 lg:grid-cols-5" style={{ borderTop: `4px solid ${teamSettings.primaryColor}` }}>
          {tabs.map((tab) => (
            <button key={tab} onClick={() => setActiveTab(tab.toLowerCase())} className={`rounded-xl px-2 py-2 text-xs font-semibold transition sm:px-3 sm:text-sm ${activeTab === tab.toLowerCase() ? "text-white" : "text-slate-600 hover:bg-slate-100"}`} style={activeTab === tab.toLowerCase() ? buttonAccentStyle : undefined}>
              {tab}
            </button>
          ))}
        </nav>

        {activeTab === "team editor" && (
          <main className="space-y-4">
            <Card>
              <div className="p-4 sm:p-5">
                <h2 className="text-2xl font-bold">Team Editor</h2>
                <p className="heading-label mt-1 text-sm text-slate-500">Edit Your Team Name And Manage Tracker Settings.</p>
              </div>
            </Card>
            <Card>
              <div className="p-4 sm:p-5">
                <h2 className="mb-4 text-xl font-bold">Team Identity</h2>
                <div className="grid gap-4 lg:grid-cols-2">
                  <div className="space-y-3">
                    <div>
                      <label className="mb-1 block text-sm font-semibold text-slate-600">Team Name</label>
                      <Input value={teamName} onChange={(event) => setTeamName(event.target.value)} placeholder="Team Name" />
                    </div>
                    <div>
                      <label className="mb-1 block text-sm font-semibold text-slate-600">Team Logo</label>
                      <input type="file" accept="image/*" onChange={uploadTeamLogo} className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm file:mr-3 file:rounded-lg file:border-0 file:bg-slate-900 file:px-3 file:py-2 file:text-sm file:font-semibold file:text-white" />
                      <div className="mt-2 flex flex-wrap gap-2">
                        {teamSettings.logo && <button onClick={() => setTeamSettings({ ...teamSettings, logo: "" })} className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100">Remove Logo</button>}
                      </div>
                      <p className="mt-1 text-xs text-slate-500">Upload a logo from your device. It saves on this browser with your team settings.</p>
                    </div>
                    <Button onClick={() => setTeamName(teamName.trim() || DEFAULT_TEAM_NAME)}>Save Name</Button>
                  </div>
                  <div className="rounded-2xl border border-slate-200 p-4" style={{ background: headerBackground, color: headerTextColor }}>
                    <p className="heading-label mb-3 text-sm font-semibold opacity-80">Header Preview</p>
                    <div className="flex items-center gap-3">
                      {teamSettings.logo ? <img src={teamSettings.logo} alt="Team Logo Preview" className="h-14 w-14 rounded-2xl bg-white object-cover p-1 shadow-sm" /> : <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-white/90 text-xs font-bold" style={{ color: teamSettings.primaryColor }}>Logo</div>}
                      <p className="text-2xl font-bold">{teamName || DEFAULT_TEAM_NAME}</p>
                    </div>
                  </div>
                </div>
              </div>
            </Card>
            <Card>
              <div className="p-4 sm:p-5">
                <h2 className="mb-4 text-xl font-bold">Team Colours</h2>
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                  <div>
                    <label className="mb-1 block text-sm font-semibold text-slate-600">Primary Colour</label>
                    <input type="color" value={teamSettings.primaryColor} onChange={(event) => setTeamSettings({ ...teamSettings, primaryColor: event.target.value })} className="h-12 w-full rounded-xl border border-slate-300 bg-white p-1" />
                  </div>
                  <div>
                    <label className="mb-1 block text-sm font-semibold text-slate-600">Header Text Colour</label>
                    <input type="color" value={teamSettings.secondaryColor} onChange={(event) => setTeamSettings({ ...teamSettings, secondaryColor: event.target.value })} className="h-12 w-full rounded-xl border border-slate-300 bg-white p-1" />
                  </div>
                  <div>
                    <label className="mb-1 block text-sm font-semibold text-slate-600">Accent Colour</label>
                    <input type="color" value={teamSettings.accentColor} onChange={(event) => setTeamSettings({ ...teamSettings, accentColor: event.target.value })} className="h-12 w-full rounded-xl border border-slate-300 bg-white p-1" />
                  </div>
                  <div>
                    <label className="mb-1 block text-sm font-semibold text-slate-600">Header Style</label>
                    <SelectInput value={teamSettings.headerStyle} onChange={(event) => setTeamSettings({ ...teamSettings, headerStyle: event.target.value })}>
                      <option value="Solid">Solid</option>
                      <option value="Gradient">Gradient</option>
                    </SelectInput>
                  </div>
                </div>
                <div className="mt-4 flex flex-wrap gap-2">
                  <button onClick={() => setTeamSettings(DEFAULT_TEAM_SETTINGS)} className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-100">Reset Colours</button>
                </div>
              </div>
            </Card>
            <Card className="border border-red-200">
              <div className="p-4 sm:p-5">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <h2 className="text-xl font-bold text-red-700">Clear Data</h2>
                    <p className="mt-1 text-sm text-slate-600">Remove All Players, Matches, Trainings, Ratings, Goals, Assists, And Saved Selections From This Tracker.</p>
                  </div>
                  {!confirmClearData ? (
                    <button onClick={() => setConfirmClearData(true)} className="rounded-xl border border-red-300 bg-white px-4 py-2 text-sm font-semibold text-red-700 hover:bg-red-50">Clear Data</button>
                  ) : (
                    <div className="rounded-2xl border border-red-200 bg-red-50 p-3">
                      <p className="heading-label mb-3 text-sm font-semibold text-red-700">Are You Sure? This Cannot Be Undone.</p>
                      <div className="flex flex-wrap gap-2">
                        <button onClick={clearAllData} className="rounded-xl bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700">Yes, Clear Everything</button>
                        <button onClick={() => setConfirmClearData(false)} className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-100">Cancel</button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </Card>
          </main>
        )}

        {activeTab === "players" && (
          <main className="space-y-4">
            <Card>
              <div className="p-4 sm:p-5">
                <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                  <div>
                    <h2 className="text-xl font-bold">Manage Players</h2>
                    <p className="heading-label text-sm text-slate-500">Click A Player To Open Their Dashboard. Use Edit If You Need To Rename Or Delete Someone.</p>
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
                      <div key={player} onClick={() => !isEditing && setSelectedPlayer(player)} className={`rounded-2xl border p-3 transition ${isSelected ? "border-slate-900 bg-slate-900 text-white" : "border-slate-200 bg-slate-50 hover:bg-slate-100"} ${isEditing ? "cursor-default" : "cursor-pointer"}`}>
                        {!isEditing ? (
                          <div className="flex items-center justify-between gap-3">
                            <span className="font-semibold">{player}</span>
                            <button onClick={(event) => { event.stopPropagation(); setEditingPlayer(player); setEditingPlayerName(player); setPlayerToRemove(null); }} className="rounded-lg border border-slate-300 bg-white px-2 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-100">Edit</button>
                          </div>
                        ) : (
                          <div className="space-y-3 rounded-xl bg-white p-3 text-slate-900">
                            <Input value={editingPlayerName} onChange={(event) => setEditingPlayerName(event.target.value)} />
                            {duplicateName && <p className="text-xs text-red-600">That Player Name Already Exists.</p>}
                            <div className="flex gap-2">
                              <button onClick={(event) => { event.stopPropagation(); savePlayerRename(player); }} disabled={duplicateName || !editingPlayerName.trim()} className="flex-1 rounded-lg bg-slate-900 px-2 py-1 text-xs font-semibold text-white disabled:opacity-40">Save</button>
                              <button onClick={(event) => { event.stopPropagation(); setEditingPlayer(null); setEditingPlayerName(""); }} className="flex-1 rounded-lg border border-slate-300 bg-white px-2 py-1 text-xs font-semibold text-slate-700">Cancel</button>
                            </div>
                            {playerToRemove === player ? (
                              <div className="rounded-xl border border-red-100 bg-red-50 p-3">
                                <p className="heading-label text-xs text-red-700">Delete {player} From All Stats?</p>
                                <div className="mt-2 flex gap-2">
                                  <button onClick={(event) => { event.stopPropagation(); removePlayer(player); }} className="flex-1 rounded-lg bg-red-600 px-2 py-1 text-xs font-semibold text-white">Yes</button>
                                  <button onClick={(event) => { event.stopPropagation(); setPlayerToRemove(null); }} className="flex-1 rounded-lg border border-slate-300 bg-white px-2 py-1 text-xs font-semibold text-slate-700">Keep</button>
                                </div>
                              </div>
                            ) : (
                              <button onClick={(event) => { event.stopPropagation(); setPlayerToRemove(player); }} className="w-full rounded-lg border border-red-200 bg-white px-2 py-1 text-xs font-semibold text-red-600 hover:bg-red-50">Delete Player</button>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                  {!players.length && <p className="rounded-2xl bg-slate-100 p-4 text-sm text-slate-500">No Players Yet. Add One Above.</p>}
                </div>
              </div>
            </Card>

            <PlayerDashboard selectedStats={selectedStats} playerTrainingEffect={selectedPlayerTrainingEffect} />

            <Card>
              <div className="p-4 sm:p-5">
                <h2 className="mb-4 text-xl font-bold">Player Summary</h2>
                <div className="grid gap-3">
                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-5">
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
                  {leaderboard.map((player) => (
                    <button key={player.name} onClick={() => setSelectedPlayer(player.name)} className={`rounded-2xl border p-3 text-left transition ${selectedStats?.name === player.name ? "border-slate-900 bg-slate-100" : "border-slate-200 bg-slate-50 hover:bg-slate-100"}`}>
                      <div className="flex items-center justify-between gap-3">
                        <p className="font-bold">{player.name}</p>
                        <p className="text-sm font-bold">{format(player.avgRating)}</p>
                      </div>
                      <div className="mt-2 grid gap-1 text-xs text-slate-600 sm:grid-cols-2 lg:grid-cols-5">
                        <p>Last: {format(player.last)}</p>
                        <p>Trend: {trendSymbol(player.trend)} {player.trend === null ? "—" : `${player.trend > 0 ? "+" : ""}${player.trend.toFixed(1)}`}</p>
                        <p>Home: {format(player.homeAverage)}</p>
                        <p>Away: {format(player.awayAverage)}</p>
                        <p>Matches: {player.matchesPlayed}</p>
                        <p>Best Time: {player.bestKickoffBand}</p>
                        <p>Formation: {player.bestFormation}</p>
                        <p>Goals: {player.goals}</p>
                        <p>Assists: {player.assists}</p>
                        <p>Training: {player.trainingAttended}/{player.trainingTotal}</p>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            </Card>
          </main>
        )}

        {activeTab === "stats" && <StatsPage playerStats={playerStats} onSelectPlayer={(playerName) => { setSelectedPlayer(playerName); setActiveTab("players"); }} />}
        {activeTab === "team summary" && <TeamSummaryPage teamSummary={teamSummary} />}

        {activeTab === "matches" && (
          <main className="space-y-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="text-2xl font-bold">Matches</h2>
                <p className="heading-label text-sm text-slate-500">Future Matches Hold The Prediction Panel. Completed Matches Hold Scores, Goal Order, Ratings, And Player Stats.</p>
              </div>
              <Button onClick={addMatch}>+ Add Future Match</Button>
            </div>

            <section className="space-y-3">
              <div className="flex items-center justify-between gap-3">
                <h3 className="text-xl font-bold">Future Matches</h3>
                <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-slate-600">{futureMatches.length}</span>
              </div>
              {futureMatches.map((match) => renderMatchCard(match))}
              {!futureMatches.length && <Card><div className="p-4 text-sm text-slate-500 sm:p-5">No Future Matches Yet. Add One Above.</div></Card>}
            </section>

            <section className="space-y-3">
              <div className="flex items-center justify-between gap-3">
                <h3 className="text-xl font-bold">Completed Matches</h3>
                <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-slate-600">{completedMatches.length}</span>
              </div>
              {completedMatches.map((match) => renderMatchCard(match))}
              {!completedMatches.length && <Card><div className="p-4 text-sm text-slate-500 sm:p-5">No Completed Matches Yet.</div></Card>}
            </section>
          </main>
        )}

        {activeTab === "training" && (
          <main className="space-y-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="text-2xl font-bold">Training</h2>
                <p className="heading-label text-sm text-slate-500">Link Each Training Session To The Match It Is Preparing For, Or Leave It As No Match.</p>
              </div>
              <Button onClick={addTrainingSession}>+ Add Training</Button>
            </div>
            {trainingSessions.map((session) => (
              <Card key={session.id}>
                <div className="p-4 sm:p-5">
                  <div className="mb-4 grid gap-3 lg:grid-cols-[180px_1fr_auto] lg:items-end">
                    <div>
                      <label className="mb-1 block text-sm font-semibold text-slate-600">Training Date</label>
                      <Input type="date" value={session.date || ""} onChange={(event) => updateTrainingSession(session.id, { date: event.target.value })} />
                    </div>
                    <div>
                      <label className="mb-1 block text-sm font-semibold text-slate-600">Preparing For</label>
                      <SelectInput value={session.preparingForMatchId || ""} onChange={(event) => updateTrainingSession(session.id, { preparingForMatchId: event.target.value ? Number(event.target.value) : "" })}>
                        <option value="">No Match / General Training</option>
                        {matches
                          .slice()
                          .sort((a, b) => String(a.date || "").localeCompare(String(b.date || "")))
                          .map((match) => (
                            <option key={match.id} value={match.id}>
                              {match.date || "No Date"} · {match.opponent || "Opponent"} · {match.venue || "Home"}
                            </option>
                          ))}
                      </SelectInput>
                      <p className="mt-1 text-xs text-slate-500">Current: {matchLabel(session.preparingForMatchId)}</p>
                    </div>
                    <Button variant="outline" onClick={() => setTrainingSessions(trainingSessions.filter((existingSession) => existingSession.id !== session.id))}>× Delete Training</Button>
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5">
                    {players.map((player) => (
                      <button key={player} onClick={() => toggleAttendance(session.id, player)} className={`rounded-2xl border p-3 text-left transition ${session.attendance?.[player] ? "bg-slate-900 text-white" : "bg-white hover:bg-slate-100"}`}>
                        <p className="font-semibold">{player}</p>
                        <p className="text-xs opacity-75">{session.attendance?.[player] ? "Attended" : "Missed"}</p>
                      </button>
                    ))}
                    {!players.length && <p className="rounded-2xl bg-slate-100 p-4 text-sm text-slate-500">No Players To Track Yet.</p>}
                  </div>
                </div>
              </Card>
            ))}
            {!trainingSessions.length && <Card><div className="p-4 text-sm text-slate-500 sm:p-5">No Training Sessions Yet. Add One Above.</div></Card>}
          </main>
        )}
      </div>
    </div>
  );
}
