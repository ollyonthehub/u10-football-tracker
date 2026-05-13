import React, { useEffect, useMemo, useState } from "react";

const defaultPlayers = ["Finn", "Anton", "Theo", "Noah", "Riley", "Jude", "Leo", "Mason", "Harry", "Oscar"];
const formationOptions = ["3-2-1", "2-3-1", "2-2-2", "3-1-2"];
const goalTeamOptions = ["Us", "Opponent"];
const ownGoalScorer = "Own Goal";

const seasonOpponents = [
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

const seasonScores = [
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

function normaliseName(value) {
  return String(value || "").trim();
}

function namesMatch(a, b) {
  return normaliseName(a).toLowerCase() === normaliseName(b).toLowerCase();
}

function getScoreText(match) {
  const teamGoals = numberOrNull(match?.teamGoals);
  const opponentGoals = numberOrNull(match?.opponentGoals);
  if (teamGoals === null || opponentGoals === null) return "No Score Yet";
  return `${teamGoals}-${opponentGoals}`;
}

function getOutcomeText(match) {
  const teamGoals = numberOrNull(match?.teamGoals);
  const opponentGoals = numberOrNull(match?.opponentGoals);
  if (teamGoals === null || opponentGoals === null) return "No Result Yet";
  if (teamGoals > opponentGoals) return "Win";
  if (teamGoals < opponentGoals) return "Loss";
  return "Draw";
}

function getResultText(match) {
  const scoreText = getScoreText(match);
  return scoreText === "No Score Yet" ? "No Result Yet" : `${getOutcomeText(match)} ${scoreText}`;
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
      timeline.push({ id: index + 1, team: "Us", scorer: "", assister: "", half });
    } else {
      opponentAdded += 1;
      timeline.push({ id: index + 1, team: "Opponent", scorer: "", assister: "", half });
    }
  }

  return timeline;
}

function getFirstGoalTeam(match) {
  return (match?.goalTimeline || [])[0]?.team || "None";
}

function getMissingScorerGoals(match) {
  return (match?.goalTimeline || []).filter((goal) => goal.team === "Us" && !goal.scorer);
}

function canSaveMatch(match) {
  return getMissingScorerGoals(match).length === 0;
}

function isPlayerAvailableForGoal(playerName, match) {
  return Boolean((match?.players || []).find((player) => player.name === playerName && player.played));
}

function normaliseGoal(goal, index, match) {
  const isOpponent = goal.team === "Opponent";
  const rawScorer = isOpponent ? "" : goal.scorer || "";
  const scorer = rawScorer && rawScorer !== ownGoalScorer && !isPlayerAvailableForGoal(rawScorer, match) ? "" : rawScorer;
  const rawAssister = isOpponent || scorer === ownGoalScorer ? "" : goal.assister || "";
  const assister = rawAssister && (!isPlayerAvailableForGoal(rawAssister, match) || rawAssister === scorer) ? "" : rawAssister;

  return {
    id: goal.id ?? index + 1,
    team: isOpponent ? "Opponent" : "Us",
    scorer,
    assister,
    half: goal.half === "Second Half" ? "Second Half" : "First Half",
  };
}

function syncMatchGoalsFromTimeline(match) {
  const timeline = (match.goalTimeline || []).map((goal, index) => normaliseGoal(goal, index, match));
  const goalCounts = {};
  const assistCounts = {};

  for (const goal of timeline) {
    if (goal.team === "Us" && goal.scorer && goal.scorer !== ownGoalScorer) goalCounts[goal.scorer] = (goalCounts[goal.scorer] || 0) + 1;
    if (goal.team === "Us" && goal.assister && goal.scorer !== ownGoalScorer) assistCounts[goal.assister] = (assistCounts[goal.assister] || 0) + 1;
  }

  return {
    ...match,
    goalTimeline: timeline,
    teamGoals: timeline.filter((goal) => goal.team === "Us").length,
    opponentGoals: timeline.filter((goal) => goal.team === "Opponent").length,
    players: (match.players || []).map((player) => ({ ...player, goals: goalCounts[player.name] || 0, assists: assistCounts[player.name] || 0 })),
  };
}

function addGoalEventToMatch(match, team = "Us", half = "First Half") {
  return syncMatchGoalsFromTimeline({
    ...match,
    goalTimeline: [
      ...(match.goalTimeline || []),
      { id: Date.now() + Math.random(), team: team === "Opponent" ? "Opponent" : "Us", scorer: "", assister: "", half: half === "Second Half" ? "Second Half" : "First Half" },
    ],
  });
}

function updateGoalEventInMatch(match, goalId, patch) {
  return syncMatchGoalsFromTimeline({
    ...match,
    goalTimeline: (match.goalTimeline || []).map((goal) => (goal.id === goalId ? { ...goal, ...patch } : goal)),
  });
}

function removeGoalEventFromMatch(match, goalId) {
  return syncMatchGoalsFromTimeline({
    ...match,
    goalTimeline: (match.goalTimeline || []).filter((goal) => goal.id !== goalId),
  });
}

function makeSeasonTrainingSessions() {
  return Array.from({ length: 20 }, (_, weekIndex) => ({
    id: weekIndex + 1,
    date: addDays("2026-04-30", weekIndex * 7),
    attendance: Object.fromEntries(defaultPlayers.map((player, playerIndex) => [player, (weekIndex + playerIndex) % 6 !== 0 && (weekIndex * 2 + playerIndex) % 11 !== 0])),
  }));
}

function makeSeasonMatches() {
  const trainingSessions = makeSeasonTrainingSessions();
  const kickoffTimes = ["09:00", "09:30", "10:15", "11:00", "11:30", "12:30", "13:00", "14:00"];
  const competitions = ["Grading", "Grading", "League", "League", "Cup"];
  const playerBaseRatings = [7, 6, 8, 6, 7, 6, 5, 7, 6, 8];
  const scorerPool = ["Theo", "Oscar", "Finn", "Mason"];

  return Array.from({ length: 20 }, (_, weekIndex) => {
    const [teamGoals, opponentGoals] = seasonScores[weekIndex];
    const venue = weekIndex % 2 === 0 ? "Home" : "Away";
    const competition = competitions[Math.min(competitions.length - 1, Math.floor(weekIndex / 4))];
    const kickoffTime = kickoffTimes[weekIndex % kickoffTimes.length];
    const formation = formationOptions[weekIndex % formationOptions.length];
    const training = trainingSessions[weekIndex];

    const players = defaultPlayers.map((name, playerIndex) => {
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
      const weekNoise = ((weekIndex + playerIndex * 2) % 5) - 2;
      const rating = played ? clampRating(playerBaseRatings[playerIndex] + venueBoost + earlyBoost + formationBoost + resultBoost + weekNoise + (attendedTraining ? 0 : -1)) : "";
      return { name, played, rating, goals: 0, assists: 0 };
    });
    const playedNames = players.filter((player) => player.played).map((player) => player.name);

    const match = {
      id: weekIndex + 1,
      opponent: seasonOpponents[weekIndex],
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
        const scorer = availableScorers[(weekIndex + goalIndex) % Math.max(1, availableScorers.length)] || playedNames[0] || ownGoalScorer;
        const possibleAssisters = playedNames.filter((player) => player !== scorer);
        const assister = goalIndex % 3 === 0 || scorer === ownGoalScorer ? "" : possibleAssisters[(weekIndex + goalIndex) % Math.max(1, possibleAssisters.length)] || "";
        return { ...goal, scorer, assister };
      }),
      players,
    };

    return syncMatchGoalsFromTimeline(match);
  });
}

const starterTraining = makeSeasonTrainingSessions();
const starterMatches = makeSeasonMatches();
const storageKey = "u10-football-stats-tracker-v1";

function makeDefaultPredictorInput() {
  return {
    opponent: "Upcoming Opponent",
    venue: "Home",
    competition: "League",
    kickoffTime: "09:00",
    formation: "3-2-1",
    date: new Date().toISOString().slice(0, 10),
  };
}

function makeDefaultTrackerState() {
  return {
    players: defaultPlayers,
    matches: starterMatches,
    trainingSessions: starterTraining,
    selectedPlayer: defaultPlayers[0],
    playerSummarySort: "avgRating",
    predictorInput: makeDefaultPredictorInput(),
  };
}

function loadTrackerState() {
  const defaults = makeDefaultTrackerState();
  if (typeof window === "undefined") return defaults;
  try {
    const saved = window.localStorage.getItem(storageKey);
    if (!saved) return defaults;
    const parsed = JSON.parse(saved);
    const savedPlayers = Array.isArray(parsed.players) ? parsed.players.filter(Boolean) : defaults.players;
    const savedMatches = Array.isArray(parsed.matches) ? parsed.matches.map(syncMatchGoalsFromTimeline) : defaults.matches;
    const savedTrainingSessions = Array.isArray(parsed.trainingSessions) ? parsed.trainingSessions : defaults.trainingSessions;
    const savedSelectedPlayer = savedPlayers.includes(parsed.selectedPlayer) ? parsed.selectedPlayer : savedPlayers[0] || "";
    return {
      players: savedPlayers,
      matches: savedMatches,
      trainingSessions: savedTrainingSessions,
      selectedPlayer: savedSelectedPlayer,
      playerSummarySort: parsed.playerSummarySort || defaults.playerSummarySort,
      predictorInput: { ...defaults.predictorInput, ...(parsed.predictorInput || {}) },
    };
  } catch {
    return defaults;
  }
}

function saveTrackerState(state) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(storageKey, JSON.stringify(state));
}

function clearSavedTrackerState() {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(storageKey);
}

function averageRating(records) {
  const validRatings = (records || []).map((record) => numberOrNull(record.rating)).filter((rating) => rating !== null);
  if (!validRatings.length) return null;
  return validRatings.reduce((sum, rating) => sum + rating, 0) / validRatings.length;
}

function calculateTrainingEffect(players, matches, trainingSessions) {
  return calculateTrainingEffectForPlayers(players, matches, trainingSessions);
}

function calculateTrainingEffectForPlayers(targetPlayers, matches, trainingSessions) {
  const sortedMatches = [...(matches || [])].sort((a, b) => `${a.date || ""} ${a.kickoffTime || ""}`.localeCompare(`${b.date || ""} ${b.kickoffTime || ""}`));
  const sortedTraining = [...(trainingSessions || [])].sort((a, b) => String(a.date || "").localeCompare(String(b.date || "")));
  const records = [];

  for (const player of targetPlayers || []) {
    for (const match of sortedMatches) {
      const playerMatch = (match.players || []).find((entry) => entry.name === player);
      const rating = numberOrNull(playerMatch?.rating);
      if (!playerMatch?.played || rating === null) continue;
      const previousTraining = [...sortedTraining].reverse().find((session) => String(session.date || "") < String(match.date || ""));
      if (!previousTraining) continue;
      records.push({ player, match: match.opponent, rating, attendedPreviousTraining: Boolean(previousTraining.attendance?.[player]) });
    }
  }

  const attended = records.filter((record) => record.attendedPreviousTraining);
  const missed = records.filter((record) => !record.attendedPreviousTraining);
  const average = (items) => (items.length ? items.reduce((sum, record) => sum + record.rating, 0) / items.length : null);

  return { attendedAverage: average(attended), missedAverage: average(missed), attendedCount: attended.length, missedCount: missed.length, records };
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

function makeGoalComboStats(matches) {
  const combos = {};
  for (const match of matches || []) {
    for (const goal of match.goalTimeline || []) {
      if (goal.team !== "Us" || !goal.scorer || !goal.assister || goal.scorer === ownGoalScorer) continue;
      const key = `${goal.assister} → ${goal.scorer}`;
      combos[key] = (combos[key] || 0) + 1;
    }
  }
  return Object.entries(combos)
    .map(([combo, count]) => ({ combo, count }))
    .sort((a, b) => b.count - a.count || a.combo.localeCompare(b.combo));
}

function makeTeamSummary(matches, allPlayerMatchRecords, trainingEffect) {
  const safeMatches = matches || [];
  const completedMatches = safeMatches.filter((match) => numberOrNull(match.teamGoals) !== null && numberOrNull(match.opponentGoals) !== null);
  const wins = completedMatches.filter((match) => getOutcomeText(match) === "Win").length;
  const draws = completedMatches.filter((match) => getOutcomeText(match) === "Draw").length;
  const losses = completedMatches.filter((match) => getOutcomeText(match) === "Loss").length;
  const goalsFor = completedMatches.reduce((sum, match) => sum + cleanStatCount(match.teamGoals), 0);
  const goalsAgainst = completedMatches.reduce((sum, match) => sum + cleanStatCount(match.opponentGoals), 0);
  const firstHalfGoalsFor = completedMatches.reduce((sum, match) => sum + (match.goalTimeline || []).filter((goal) => goal.half !== "Second Half" && goal.team === "Us").length, 0);
  const firstHalfGoalsAgainst = completedMatches.reduce((sum, match) => sum + (match.goalTimeline || []).filter((goal) => goal.half !== "Second Half" && goal.team === "Opponent").length, 0);
  const secondHalfGoalsFor = completedMatches.reduce((sum, match) => sum + (match.goalTimeline || []).filter((goal) => goal.half === "Second Half" && goal.team === "Us").length, 0);
  const secondHalfGoalsAgainst = completedMatches.reduce((sum, match) => sum + (match.goalTimeline || []).filter((goal) => goal.half === "Second Half" && goal.team === "Opponent").length, 0);
  const scoredFirstMatches = completedMatches.filter((match) => getFirstGoalTeam(match) === "Us");
  const concededFirstMatches = completedMatches.filter((match) => getFirstGoalTeam(match) === "Opponent");
  const recordFor = (items) => ["Win", "Draw", "Loss"].map((outcome) => items.filter((match) => getOutcomeText(match) === outcome).length).join("-");
  const venueGroups = groupAverage(allPlayerMatchRecords, "venue");
  const competitionGroups = groupAverage(allPlayerMatchRecords, "competition");
  const kickoffGroups = groupAverage(allPlayerMatchRecords, "kickoffBand");
  const formationGroups = groupAverage(allPlayerMatchRecords, "formation");

  return {
    matches: safeMatches.length,
    completedMatches: completedMatches.length,
    wins,
    draws,
    losses,
    goalsFor,
    goalsAgainst,
    goalDifference: goalsFor - goalsAgainst,
    firstHalfGoalsFor,
    firstHalfGoalsAgainst,
    firstHalfGoalDifference: firstHalfGoalsFor - firstHalfGoalsAgainst,
    secondHalfGoalsFor,
    secondHalfGoalsAgainst,
    secondHalfGoalDifference: secondHalfGoalsFor - secondHalfGoalsAgainst,
    betterHalf: firstHalfGoalsFor - firstHalfGoalsAgainst > secondHalfGoalsFor - secondHalfGoalsAgainst ? "First Half" : secondHalfGoalsFor - secondHalfGoalsAgainst > firstHalfGoalsFor - firstHalfGoalsAgainst ? "Second Half" : "Even",
    matchesWithFirstGoal: completedMatches.filter((match) => getFirstGoalTeam(match) !== "None").length,
    scoredFirst: scoredFirstMatches.length,
    concededFirst: concededFirstMatches.length,
    scoredFirstRecord: recordFor(scoredFirstMatches),
    concededFirstRecord: recordFor(concededFirstMatches),
    averageTeamRating: averageRating(allPlayerMatchRecords),
    bestVenue: venueGroups[0] || null,
    bestCompetition: competitionGroups[0] || null,
    bestKickoffBand: kickoffGroups[0] || null,
    bestFormation: formationGroups[0] || null,
    venueGroups,
    competitionGroups,
    kickoffGroups,
    formationGroups,
    goalCombos: makeGoalComboStats(safeMatches),
    trainingEffect,
  };
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

function sortPlayerStats(playerStats, statKey) {
  return [...(Array.isArray(playerStats) ? playerStats : [])].sort((a, b) => {
    const aValue = numberOrNull(a[statKey]) ?? 0;
    const bValue = numberOrNull(b[statKey]) ?? 0;
    return bValue - aValue || String(a.name || "").localeCompare(String(b.name || ""));
  });
}

function sortPlayerSummary(playerStats, sortKey) {
  const safeStats = Array.isArray(playerStats) ? playerStats : [];
  if (sortKey === "name") return [...safeStats].sort((a, b) => String(a.name || "").localeCompare(String(b.name || "")));
  return [...safeStats].sort((a, b) => {
    const aValue = numberOrNull(a[sortKey]) ?? -1;
    const bValue = numberOrNull(b[sortKey]) ?? -1;
    return bValue - aValue || String(a.name || "").localeCompare(String(b.name || ""));
  });
}

function getAverageForValue(records, key, value) {
  return averageRating((records || []).filter((record) => record[key] === value));
}

function predictPlayerRating(playerStat, predictorInput, trainingSessions) {
  const records = playerStat?.records || [];
  const baseAverage = numberOrNull(playerStat?.avgRating);
  if (baseAverage === null) return null;

  const kickoffBand = getKickoffBand(predictorInput.kickoffTime);
  const venueAverage = getAverageForValue(records, "venue", predictorInput.venue);
  const competitionAverage = getAverageForValue(records, "competition", predictorInput.competition);
  const formationAverage = getAverageForValue(records, "formation", predictorInput.formation);
  const kickoffAverage = getAverageForValue(records, "kickoffBand", kickoffBand);
  const recentAverage = averageRating(records.slice(-3));
  const latestTraining = [...(trainingSessions || [])].sort((a, b) => String(a.date || "").localeCompare(String(b.date || ""))).at(-1);
  const attendedLatestTraining = Boolean(latestTraining?.attendance?.[playerStat.name]);
  const trainingAdjustment = attendedLatestTraining ? 0.2 : -0.4;

  const factors = [
    { label: "Season Average", value: baseAverage, weight: 0.35 },
    { label: "Recent Form", value: recentAverage, weight: 0.2 },
    { label: "Home/Away", value: venueAverage, weight: 0.15 },
    { label: "Formation", value: formationAverage, weight: 0.15 },
    { label: "Kick-Off Time", value: kickoffAverage, weight: 0.1 },
    { label: "Competition", value: competitionAverage, weight: 0.05 },
  ].filter((factor) => numberOrNull(factor.value) !== null);

  const weightedTotal = factors.reduce((sum, factor) => sum + factor.value * factor.weight, 0);
  const weightTotal = factors.reduce((sum, factor) => sum + factor.weight, 0);
  const predicted = Math.max(0, Math.min(10, weightedTotal / weightTotal + trainingAdjustment));

  return {
    player: playerStat.name,
    predicted,
    latestTraining: latestTraining ? (attendedLatestTraining ? "Attended" : "Missed") : "Unknown",
    seasonAverage: baseAverage,
    recentAverage,
    venueAverage,
    formationAverage,
    kickoffAverage,
    competitionAverage,
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
  const width = Math.max(640, safeRecords.length * 70);
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

function addPlayerToData(playerName, players, matches, trainingSessions) {
  const cleanName = normaliseName(playerName);
  if (!cleanName || (players || []).some((player) => namesMatch(player, cleanName))) return { players, matches, trainingSessions, selectedPlayer: null, changed: false };
  return {
    players: [...players, cleanName],
    matches: matches.map((match) => syncMatchGoalsFromTimeline({ ...match, players: [...(match.players || []), { name: cleanName, played: false, rating: "", goals: 0, assists: 0 }] })),
    trainingSessions: trainingSessions.map((session) => ({ ...session, attendance: { ...(session.attendance || {}), [cleanName]: false } })),
    selectedPlayer: cleanName,
    changed: true,
  };
}

function removePlayerFromData(playerName, players, matches, trainingSessions, selectedPlayer) {
  const nextPlayers = players.filter((player) => player !== playerName);
  return {
    players: nextPlayers,
    matches: matches.map((match) => syncMatchGoalsFromTimeline({
      ...match,
      players: (match.players || []).filter((player) => player.name !== playerName),
      goalTimeline: (match.goalTimeline || []).map((goal) => ({ ...goal, scorer: goal.scorer === playerName ? "" : goal.scorer, assister: goal.assister === playerName ? "" : goal.assister })),
    })),
    trainingSessions: trainingSessions.map((session) => {
      const attendance = { ...(session.attendance || {}) };
      delete attendance[playerName];
      return { ...session, attendance };
    }),
    selectedPlayer: selectedPlayer === playerName ? nextPlayers[0] || "" : selectedPlayer,
  };
}

function renamePlayerInData(oldName, newName, players, matches, trainingSessions, selectedPlayer) {
  const cleanName = normaliseName(newName);
  if (!cleanName || cleanName === oldName || players.some((player) => player !== oldName && namesMatch(player, cleanName))) return { players, matches, trainingSessions, selectedPlayer, changed: false };
  return {
    players: players.map((player) => (player === oldName ? cleanName : player)),
    matches: matches.map((match) => syncMatchGoalsFromTimeline({
      ...match,
      players: (match.players || []).map((player) => (player.name === oldName ? { ...player, name: cleanName } : player)),
      goalTimeline: (match.goalTimeline || []).map((goal) => ({ ...goal, scorer: goal.scorer === oldName ? cleanName : goal.scorer, assister: goal.assister === oldName ? cleanName : goal.assister })),
    })),
    trainingSessions: trainingSessions.map((session) => {
      const attendance = { ...(session.attendance || {}) };
      if (Object.prototype.hasOwnProperty.call(attendance, oldName)) {
        attendance[cleanName] = attendance[oldName];
        delete attendance[oldName];
      }
      return { ...session, attendance };
    }),
    selectedPlayer: selectedPlayer === oldName ? cleanName : selectedPlayer,
    changed: true,
  };
}

function makeEmptyTrackerData() {
  return { players: [], matches: [], trainingSessions: [], selectedPlayer: "" };
}

function cloneMatchForEditing(match) {
  return { ...match, players: (match.players || []).map((player) => ({ ...player })), goalTimeline: (match.goalTimeline || []).map((goal) => ({ ...goal })) };
}

function updatePlayerInMatchObject(match, playerName, patch) {
  const cleanedPatch = { ...patch };
  let nextGoalTimeline = match.goalTimeline || [];
  if (Object.prototype.hasOwnProperty.call(cleanedPatch, "rating")) cleanedPatch.rating = clampRating(cleanedPatch.rating);
  if (Object.prototype.hasOwnProperty.call(cleanedPatch, "played") && !cleanedPatch.played) {
    cleanedPatch.rating = "";
    nextGoalTimeline = nextGoalTimeline.map((goal) => ({
      ...goal,
      scorer: goal.scorer === playerName ? "" : goal.scorer,
      assister: goal.assister === playerName ? "" : goal.assister,
    }));
  }
  return { ...match, goalTimeline: nextGoalTimeline, players: (match.players || []).map((player) => (player.name === playerName ? { ...player, ...cleanedPatch } : player)) };
}

function replaceMatchById(matches, nextMatch) {
  return (matches || []).map((match) => (match.id === nextMatch.id ? syncMatchGoalsFromTimeline(cloneMatchForEditing(nextMatch)) : match));
}

function runCalculationTests() {
  console.assert(numberOrNull("8") === 8, "numberOrNull should accept numeric strings");
  console.assert(numberOrNull("") === null, "numberOrNull should treat blanks as null");
  console.assert(format(7.25) === "7.3", "format should round to one decimal place");
  console.assert(clampRating(7.6) === 8, "clampRating should round ratings");
  console.assert(getOutcomeText({ teamGoals: 2, opponentGoals: 2 }) === "Draw", "getOutcomeText should detect draws");
  console.assert(makeGoalTimeline(2, 1).length === 3, "makeGoalTimeline should create goal events");
  console.assert(makeGoalTimeline(2, 1)[0].half === "First Half", "makeGoalTimeline should assign first-half goals");
  console.assert(makeGoalTimeline(2, 1).at(-1).half === "Second Half", "makeGoalTimeline should assign second-half goals");
  console.assert(canSaveMatch({ goalTimeline: [{ id: 1, team: "Us", scorer: "A" }] }) === true, "canSaveMatch should allow goals with scorers");
  console.assert(canSaveMatch({ goalTimeline: [{ id: 1, team: "Us", scorer: "" }] }) === false, "canSaveMatch should block goals without scorers");
  console.assert(canSaveMatch({ goalTimeline: [{ id: 1, team: "Us", scorer: ownGoalScorer }] }) === true, "canSaveMatch should allow own goals");
  console.assert(updateGoalEventInMatch({ goalTimeline: [{ id: 1, team: "Us" }], players: [{ name: "A", played: true, goals: 0, assists: 0 }, { name: "B", played: true, goals: 0, assists: 0 }] }, 1, { scorer: "A", assister: "B" }).players[1].assists === 1, "goal assists should sync to player assists");
  console.assert(updateGoalEventInMatch({ goalTimeline: [{ id: 1, team: "Us" }], players: [{ name: "A", played: true, goals: 0, assists: 0 }] }, 1, { scorer: ownGoalScorer, assister: "A" }).players[0].assists === 0, "own goals should not create assists");
  console.assert(syncMatchGoalsFromTimeline({ goalTimeline: [{ id: 1, team: "Us", scorer: "A", assister: "B" }], players: [{ name: "A", played: false }, { name: "B", played: true }] }).goalTimeline[0].scorer === "", "unplayed scorers should be cleared");
  console.assert(averageRating([{ rating: 6 }, { rating: "8" }, { rating: "" }]) === 7, "averageRating should ignore blanks");
  console.assert(getKickoffBand("11:30") === "Mid-Morning", "getKickoffBand should classify mid-morning");

  const testPlayers = ["A", "B"];
  const testTraining = [{ id: 1, date: "2026-01-01", attendance: { A: true, B: false } }];
  const testMatches = [
    { id: 1, opponent: "Home Test", venue: "Home", competition: "League", kickoffTime: "09:00", date: "2026-01-02", formation: "3-2-1", teamGoals: 2, opponentGoals: 1, goalTimeline: [{ id: 1, team: "Us", scorer: "A", assister: "B", half: "First Half" }, { id: 2, team: "Opponent", scorer: "", assister: "", half: "First Half" }, { id: 3, team: "Us", scorer: "A", assister: "", half: "Second Half" }], players: [{ name: "A", played: true, rating: 8, goals: 2, assists: 0 }, { name: "B", played: true, rating: 6, goals: 0, assists: 1 }] },
    { id: 2, opponent: "Away Test", venue: "Away", competition: "Grading", kickoffTime: "13:00", date: "2026-01-09", formation: "2-3-1", teamGoals: 1, opponentGoals: 3, goalTimeline: [{ id: 1, team: "Opponent", scorer: "", assister: "", half: "First Half" }, { id: 2, team: "Us", scorer: "A", assister: "B", half: "Second Half" }, { id: 3, team: "Opponent", scorer: "", assister: "", half: "Second Half" }, { id: 4, team: "Opponent", scorer: "", assister: "", half: "Second Half" }], players: [{ name: "A", played: true, rating: 5, goals: 1, assists: 0 }, { name: "B", played: false, rating: "", goals: 0, assists: 1 }] },
  ].map(syncMatchGoalsFromTimeline);

  const effect = calculateTrainingEffect(testPlayers, testMatches, testTraining);
  console.assert(effect.attendedAverage === 6.5, "training effect should average attended records");
  console.assert(effect.missedAverage === 6, "training effect should average missed records");
  const stats = makePlayerStats(testPlayers, testMatches, testTraining);
  console.assert(stats[0].goals === 3, "player stats should total goals");
  console.assert(stats[1].assists === 1, "player stats should only total assists for played rated records");
  const teamSummary = makeTeamSummary(testMatches, makeAllPlayerMatchRecords(stats), effect);
  console.assert(teamSummary.wins === 1 && teamSummary.losses === 1, "team summary should count results");
  console.assert(teamSummary.scoredFirst === 1 && teamSummary.concededFirst === 1, "team summary should count first goal direction");
  console.assert(teamSummary.goalCombos[0].combo === "B → A", "team summary should count goal combos");
  console.assert(sortPlayerStats(stats, "matchesPlayed")[0].name === "A", "sortPlayerStats should sort descending");
  console.assert(sortPlayerSummary(stats, "name")[0].name === "A", "sortPlayerSummary should sort names alphabetically");
  console.assert(sortPlayerSummary(stats, "avgRating")[0].name === "A", "sortPlayerSummary should sort numeric columns high to low");
  console.assert(makeTrendChartData([]).linePath === "", "trend chart data should handle empty records");
  console.assert(makeDefaultTrackerState().players.length === defaultPlayers.length, "makeDefaultTrackerState should include default players");
  console.assert(makeDefaultTrackerState().predictorInput.formation === "3-2-1", "makeDefaultTrackerState should include predictor defaults");
  console.assert(predictPlayerRating(stats[0], { venue: "Home", competition: "League", formation: "3-2-1", kickoffTime: "09:00" }, testTraining).predicted > 0, "predictPlayerRating should produce a predicted rating for players with records");
  console.assert(makePredictionRows(stats, { venue: "Home", competition: "League", formation: "3-2-1", kickoffTime: "09:00" }, testTraining)[0].predicted >= makePredictionRows(stats, { venue: "Home", competition: "League", formation: "3-2-1", kickoffTime: "09:00" }, testTraining).at(-1).predicted, "makePredictionRows should sort predictions high to low");
  console.assert(addPlayerToData("C", testPlayers, testMatches, testTraining).changed === true, "addPlayerToData should add players");
  console.assert(addPlayerToData("a", testPlayers, testMatches, testTraining).changed === false, "addPlayerToData should block duplicate names");
  const renamed = renamePlayerInData("A", "Alex", testPlayers, testMatches, testTraining, "A");
  console.assert(renamed.changed && renamed.matches[0].goalTimeline[0].scorer === "Alex", "renamePlayerInData should update scorers");
  const renamedAssister = renamePlayerInData("B", "Ben", testPlayers, testMatches, testTraining, "B");
  console.assert(renamedAssister.matches[0].goalTimeline[0].assister === "Ben", "renamePlayerInData should update assisters");
  const removed = removePlayerFromData("A", testPlayers, testMatches, testTraining, "A");
  console.assert(!removed.players.includes("A") && removed.selectedPlayer === "B", "removePlayerFromData should remove selected players");
  console.assert(removed.matches[0].goalTimeline[0].scorer === "", "removePlayerFromData should clear removed scorers");
  const clonedMatch = cloneMatchForEditing(testMatches[0]);
  clonedMatch.goalTimeline[0].scorer = "B";
  console.assert(testMatches[0].goalTimeline[0].scorer === "A", "cloneMatchForEditing should clone goal timeline");
  const notPlayed = updatePlayerInMatchObject(testMatches[0], "A", { rating: 9, played: false });
  console.assert(notPlayed.players[0].rating === "" && notPlayed.goalTimeline[0].scorer === "", "updatePlayerInMatchObject should clear rating and goal links when not played");
  console.assert(replaceMatchById(testMatches, { ...testMatches[0], opponent: "Saved Match" })[0].opponent === "Saved Match", "replaceMatchById should replace a match");
  const emptyData = makeEmptyTrackerData();
  console.assert(emptyData.players.length === 0 && emptyData.matches.length === 0 && emptyData.trainingSessions.length === 0, "makeEmptyTrackerData should clear data");
}

runCalculationTests();

function Button({ children, onClick, variant = "primary", type = "button", disabled = false }) {
  const base = "rounded-xl px-4 py-2 text-sm font-semibold transition active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-40";
  const styles = variant === "outline" ? "border border-slate-300 bg-white text-slate-800 hover:bg-slate-100" : "bg-slate-900 text-white hover:bg-slate-700";
  return <button type={type} onClick={onClick} disabled={disabled} className={`${base} ${styles}`}>{children}</button>;
}

function Input(props) {
  const { className = "", ...rest } = props;
  return <input {...rest} className={`rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-slate-900 ${className}`} />;
}

function SelectInput({ value, onChange, children, className = "" }) {
  return <select value={value} onChange={onChange} className={`rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-slate-900 ${className}`}>{children}</select>;
}

function Card({ children, className = "" }) {
  return <div className={`rounded-3xl bg-white shadow-sm ${className}`}>{children}</div>;
}

function SummaryCard({ label, value, detail }) {
  return <Card><div className="p-5"><p className="heading-label text-sm text-slate-500">{label}</p><p className="text-3xl font-bold">{value}</p><p className="heading-label text-xs text-slate-500">{detail}</p></div></Card>;
}

function SummaryPanel({ label, value, detail }) {
  return <div className="rounded-2xl bg-slate-100 p-4"><p className="heading-label text-sm text-slate-500">{label}</p><p className="text-3xl font-bold">{value}</p><p className="heading-label text-xs text-slate-500">{detail}</p></div>;
}

function TrendChart({ records }) {
  const safeRecords = Array.isArray(records) ? records : [];
  const chart = makeTrendChartData(safeRecords);
  if (!safeRecords.length) return <div className="flex h-72 items-center justify-center rounded-2xl bg-slate-100 text-sm text-slate-500">No Match Ratings Yet For This Player.</div>;
  return <div className="rounded-2xl bg-slate-100 p-4"><div className="mb-3 flex flex-wrap gap-2 text-xs text-slate-600"><span className="rounded-full bg-white px-3 py-1 font-semibold">Season Trend</span><span className="rounded-full bg-white px-3 py-1">{safeRecords.length} Rated Matches</span><span className="rounded-full bg-white px-3 py-1">Latest: {format(safeRecords.at(-1)?.rating)}</span></div><div className="overflow-x-auto rounded-2xl bg-white p-3"><svg width={chart.width} height={chart.height} viewBox={`0 0 ${chart.width} ${chart.height}`} role="img" aria-label="Player Rating Trend Chart">{[0, 2, 4, 6, 8, 10].map((tick) => { const y = chart.padding.top + ((10 - tick) / 10) * chart.plotHeight; return <g key={tick}><line x1={chart.padding.left} x2={chart.width - chart.padding.right} y1={y} y2={y} stroke="#e2e8f0" strokeWidth="1" /><text x={chart.padding.left - 10} y={y + 4} textAnchor="end" fontSize="11" fill="#64748b">{tick}</text></g>; })}<line x1={chart.padding.left} x2={chart.width - chart.padding.right} y1={chart.height - chart.padding.bottom} y2={chart.height - chart.padding.bottom} stroke="#94a3b8" strokeWidth="1" />{chart.linePath && <path d={chart.linePath} fill="none" stroke="#0f172a" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />}{chart.points.map((point) => <g key={`${point.matchId}-${point.opponent}-point`}><circle cx={point.x} cy={point.y} r="6" fill="#0f172a"><title>{`${point.opponent} · ${point.venue} · ${point.formation || "No Formation"} · ${point.kickoffTime || "No Time"} · ${point.result}: ${point.rating}/10`}</title></circle><text x={point.x} y={point.y - 10} textAnchor="middle" fontSize="11" fontWeight="700" fill="#334155">{point.rating}</text><text x={point.x} y={chart.height - 34} textAnchor="middle" fontSize="10" fill="#64748b">W{point.index + 1}</text><text x={point.x} y={chart.height - 18} textAnchor="middle" fontSize="10" fill="#64748b">{point.venue === "Home" ? "H" : "A"} {point.kickoffTime || ""}</text></g>)}</svg></div><div className="mt-3 grid gap-2 text-xs text-slate-600 md:grid-cols-2 lg:grid-cols-4">{safeRecords.slice(-4).map((record) => <div key={`${record.matchId}-${record.opponent}-summary`} className="rounded-xl bg-white p-3"><p className="font-semibold text-slate-900">{record.opponent}</p><p>{record.result} · {record.venue} · {record.formation} · {record.kickoffTime || "No Time"}</p><p>Rating: <span className="font-bold">{record.rating}/10</span></p></div>)}</div></div>;
}

function GroupAverageTable({ title, groups }) {
  const safeGroups = Array.isArray(groups) ? groups : [];
  return <Card><div className="p-5"><h2 className="text-xl font-bold">{title}</h2><div className="mt-4 space-y-3">{safeGroups.length ? safeGroups.map((group) => <div key={group.name}><div className="mb-1 flex justify-between text-sm"><span className="font-semibold">{group.name}</span><span className="text-slate-500">{format(group.average)} From {group.count} Ratings</span></div><div className="h-3 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-slate-900" style={{ width: `${Math.max(0, Math.min(100, (group.average || 0) * 10))}%` }} /></div></div>) : <p className="rounded-2xl bg-slate-100 p-4 text-sm text-slate-500">No Ratings Yet.</p>}</div></div></Card>;
}

function GoalComboTable({ combos }) {
  const safeCombos = Array.isArray(combos) ? combos : [];
  const topCount = safeCombos[0]?.count || 0;
  return <Card><div className="p-5"><h2 className="text-xl font-bold">Common Goal Combos</h2><div className="mt-4 space-y-3">{safeCombos.length ? safeCombos.map((combo, index) => <div key={combo.combo}><div className="mb-1 flex justify-between text-sm"><span className="font-semibold">{index + 1}. {combo.combo}</span><span className="text-slate-500">{combo.count} Goals</span></div><div className="h-3 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-slate-900" style={{ width: topCount ? `${Math.max(4, (combo.count / topCount) * 100)}%` : "0%" }} /></div></div>) : <p className="rounded-2xl bg-slate-100 p-4 text-sm text-slate-500">No Assisted Goals Recorded Yet.</p>}</div></div></Card>;
}

function StatLeaderboard({ title, players, statKey, valueFormatter, onSelectPlayer, hideZeroValues = false, emptyMessage = "No Stats Recorded Yet." }) {
  const sortedPlayers = sortPlayerStats(players, statKey).filter((player) => !hideZeroValues || (numberOrNull(player[statKey]) ?? 0) > 0);
  const topValue = numberOrNull(sortedPlayers[0]?.[statKey]) ?? 0;
  return <Card><div className="p-5"><h2 className="text-xl font-bold">{title}</h2><div className="mt-4 space-y-3">{!sortedPlayers.length && <p className="rounded-2xl bg-slate-100 p-4 text-sm text-slate-500">{emptyMessage}</p>}{sortedPlayers.map((player, index) => { const value = numberOrNull(player[statKey]) ?? 0; const width = topValue > 0 ? `${Math.max(4, (value / topValue) * 100)}%` : "0%"; return <button key={player.name} onClick={() => onSelectPlayer(player.name)} className="w-full rounded-2xl border border-slate-200 bg-slate-50 p-3 text-left transition hover:bg-slate-100"><div className="mb-2 flex items-center justify-between gap-3 text-sm"><span className="font-semibold">{index + 1}. {player.name}</span><span className="rounded-full bg-white px-3 py-1 text-xs font-bold text-slate-700">{valueFormatter ? valueFormatter(value, player) : value}</span></div><div className="h-3 overflow-hidden rounded-full bg-white"><div className="h-full rounded-full bg-slate-900" style={{ width }} /></div></button>; })}</div></div></Card>;
}

function StatsPage({ playerStats, onSelectPlayer }) {
  return <main className="space-y-4"><Card><div className="p-5"><h2 className="text-2xl font-bold">Season Stats</h2></div></Card><div className="grid gap-4 lg:grid-cols-2"><StatLeaderboard title="Top Goal Scorers" players={playerStats} statKey="goals" hideZeroValues={true} emptyMessage="No Goals Recorded Yet." onSelectPlayer={onSelectPlayer} /><StatLeaderboard title="Most Assists" players={playerStats} statKey="assists" hideZeroValues={true} emptyMessage="No Assists Recorded Yet." onSelectPlayer={onSelectPlayer} /><StatLeaderboard title="Most Matches Played" players={playerStats} statKey="matchesPlayed" valueFormatter={(value) => `${value} Matches`} onSelectPlayer={onSelectPlayer} /><StatLeaderboard title="Highest Average Rating" players={playerStats} statKey="avgRating" valueFormatter={(value) => format(value)} onSelectPlayer={onSelectPlayer} /></div></main>;
}

function PredictorPage({ predictorInput, setPredictorInput, predictionRows }) {
  const topPrediction = predictionRows[0] || null;
  return <main className="space-y-4"><Card><div className="p-5"><h2 className="text-2xl font-bold">Match Predictor</h2><p className="heading-label mt-1 text-sm text-slate-500">Enter The Upcoming Match Details To Predict Each Player Rating.</p></div></Card><Card><div className="p-5"><h2 className="mb-4 text-xl font-bold">Upcoming Match Details</h2><div className="grid gap-3 md:grid-cols-2 lg:grid-cols-6"><Input value={predictorInput.opponent} onChange={(event) => setPredictorInput({ ...predictorInput, opponent: event.target.value })} placeholder="Opponent" /><SelectInput value={predictorInput.venue} onChange={(event) => setPredictorInput({ ...predictorInput, venue: event.target.value })}><option value="Home">Home</option><option value="Away">Away</option></SelectInput><Input value={predictorInput.competition} onChange={(event) => setPredictorInput({ ...predictorInput, competition: event.target.value })} placeholder="Competition" /><Input type="time" value={predictorInput.kickoffTime} onChange={(event) => setPredictorInput({ ...predictorInput, kickoffTime: event.target.value })} /><SelectInput value={predictorInput.formation} onChange={(event) => setPredictorInput({ ...predictorInput, formation: event.target.value })}>{formationOptions.map((formation) => <option key={formation} value={formation}>{formation}</option>)}</SelectInput><Input type="date" value={predictorInput.date} onChange={(event) => setPredictorInput({ ...predictorInput, date: event.target.value })} /></div></div></Card><div className="grid gap-4 md:grid-cols-4"><SummaryCard label="Opponent" value={predictorInput.opponent || "—"} detail="Upcoming Match" /><SummaryCard label="Best Predicted Player" value={topPrediction?.player || "—"} detail={topPrediction ? `${format(topPrediction.predicted)} Predicted` : "No Prediction Yet"} /><SummaryCard label="Kick-Off Band" value={getKickoffBand(predictorInput.kickoffTime)} detail={predictorInput.kickoffTime || "No Time"} /><SummaryCard label="Formation" value={predictorInput.formation} detail={`${predictorInput.venue} · ${predictorInput.competition || "No Competition"}`} /></div><Card><div className="p-5"><h2 className="mb-4 text-xl font-bold">Predicted Player Ratings</h2><div className="overflow-x-auto"><table className="w-full min-w-[980px] text-left text-sm"><thead><tr className="border-b text-slate-500"><th className="py-2">Player</th><th>Predicted</th><th>Season Avg</th><th>Recent Form</th><th>Home/Away Avg</th><th>Formation Avg</th><th>Kick-Off Avg</th><th>Competition Avg</th><th>Latest Training</th><th>Matches Used</th></tr></thead><tbody>{predictionRows.map((row) => <tr key={row.player} className="border-b last:border-0 hover:bg-slate-50"><td className="py-3 font-semibold">{row.player}</td><td className="font-bold">{format(row.predicted)}</td><td>{format(row.seasonAverage)}</td><td>{format(row.recentAverage)}</td><td>{format(row.venueAverage)}</td><td>{format(row.formationAverage)}</td><td>{format(row.kickoffAverage)}</td><td>{format(row.competitionAverage)}</td><td>{row.latestTraining}</td><td>{row.matchesUsed}</td></tr>)}{!predictionRows.length && <tr><td colSpan="10" className="py-6 text-center text-slate-500">No Player Ratings Available To Predict From Yet.</td></tr>}</tbody></table></div></div></Card></main>;
}

function TeamSummaryPage({ teamSummary }) {
  const trainingDifference = teamSummary.trainingEffect.attendedAverage === null || teamSummary.trainingEffect.missedAverage === null ? null : teamSummary.trainingEffect.attendedAverage - teamSummary.trainingEffect.missedAverage;
  return <main className="space-y-4"><Card><div className="p-5"><h2 className="text-2xl font-bold">Team Summary</h2></div></Card><div className="grid gap-4 md:grid-cols-4"><SummaryCard label="Record" value={`${teamSummary.wins}-${teamSummary.draws}-${teamSummary.losses}`} detail={`W-D-L From ${teamSummary.completedMatches} Completed Matches`} /><SummaryCard label="Goals" value={`${teamSummary.goalsFor}-${teamSummary.goalsAgainst}`} detail={`GD ${teamSummary.goalDifference > 0 ? "+" : ""}${teamSummary.goalDifference}`} /><SummaryCard label="Average Team Rating" value={format(teamSummary.averageTeamRating)} detail="Across All Player Ratings" /><SummaryCard label="Matches Tracked" value={teamSummary.matches} detail="Including Incomplete Scores" /></div><div className="grid gap-4 md:grid-cols-3"><SummaryCard label="Scored First" value={teamSummary.scoredFirst} detail={`Record ${teamSummary.scoredFirstRecord}`} /><SummaryCard label="Conceded First" value={teamSummary.concededFirst} detail={`Record ${teamSummary.concededFirstRecord}`} /><SummaryCard label="First Goal Logged" value={teamSummary.matchesWithFirstGoal} detail="Matches With A Goal Order" /></div><div className="grid gap-4 md:grid-cols-3"><SummaryCard label="First Half" value={`${teamSummary.firstHalfGoalsFor}-${teamSummary.firstHalfGoalsAgainst}`} detail={`GD ${teamSummary.firstHalfGoalDifference > 0 ? "+" : ""}${teamSummary.firstHalfGoalDifference}`} /><SummaryCard label="Second Half" value={`${teamSummary.secondHalfGoalsFor}-${teamSummary.secondHalfGoalsAgainst}`} detail={`GD ${teamSummary.secondHalfGoalDifference > 0 ? "+" : ""}${teamSummary.secondHalfGoalDifference}`} /><SummaryCard label="Better Half" value={teamSummary.betterHalf} detail="Based On Goal Difference" /></div><div className="grid gap-4 md:grid-cols-4"><SummaryCard label="Best Venue" value={teamSummary.bestVenue?.name || "—"} detail={`${format(teamSummary.bestVenue?.average)} Average Rating`} /><SummaryCard label="Best Kick-Off Time" value={teamSummary.bestKickoffBand?.name || "—"} detail={`${format(teamSummary.bestKickoffBand?.average)} Average Rating`} /><SummaryCard label="Best Competition" value={teamSummary.bestCompetition?.name || "—"} detail={`${format(teamSummary.bestCompetition?.average)} Average Rating`} /><SummaryCard label="Best Formation" value={teamSummary.bestFormation?.name || "—"} detail={`${format(teamSummary.bestFormation?.average)} Average Rating`} /></div><div className="grid gap-4 lg:grid-cols-4"><GroupAverageTable title="Home Vs Away" groups={teamSummary.venueGroups} /><GroupAverageTable title="Kick-Off Time" groups={teamSummary.kickoffGroups} /><GroupAverageTable title="Competition" groups={teamSummary.competitionGroups} /><GroupAverageTable title="Formation" groups={teamSummary.formationGroups} /></div><GoalComboTable combos={teamSummary.goalCombos} /><Card><div className="p-5"><h2 className="text-xl font-bold">Training Effect</h2><div className="mt-4 grid gap-4 md:grid-cols-3"><SummaryPanel label="After Attending Training" value={format(teamSummary.trainingEffect.attendedAverage)} detail={`${teamSummary.trainingEffect.attendedCount} Match Records`} /><SummaryPanel label="After Missing Training" value={format(teamSummary.trainingEffect.missedAverage)} detail={`${teamSummary.trainingEffect.missedCount} Match Records`} /><SummaryPanel label="Difference" value={format(trainingDifference)} detail="Attended Minus Missed" /></div></div></Card></main>;
}

function GoalTimelineEditor({ match, players, onAddGoal, onUpdateGoal, onRemoveGoal }) {
  const timeline = match.goalTimeline || [];
  const firstHalfGoals = timeline.filter((goal) => goal.half !== "Second Half");
  const secondHalfGoals = timeline.filter((goal) => goal.half === "Second Half");
  const playedPlayers = (players || []).filter((player) => player.played);
  const GoalSection = ({ title, half, goals }) => <div className="rounded-2xl border border-slate-200 bg-white p-4"><div className="mb-3 flex flex-col gap-2 md:flex-row md:items-center md:justify-between"><h4 className="text-base font-bold">{title}</h4><div className="flex gap-2"><Button variant="outline" onClick={() => onAddGoal("Us", half)}>+ Our Goal</Button><Button variant="outline" onClick={() => onAddGoal("Opponent", half)}>+ Opp Goal</Button></div></div>{goals.length ? <div className="space-y-2">{goals.map((goal, index) => { const missingScorer = goal.team === "Us" && !goal.scorer; return <div key={goal.id} className={`flex flex-col gap-2 rounded-2xl p-3 md:flex-row md:items-center md:justify-between ${missingScorer ? "border border-red-200 bg-red-50" : "bg-slate-100"}`}><div><div className="font-semibold">Goal {index + 1}</div>{missingScorer && <p className="heading-label mt-1 text-xs font-semibold text-red-700">Scorer Required</p>}</div><div className="flex flex-wrap gap-2"><SelectInput value={goal.team} onChange={(event) => onUpdateGoal(goal.id, { team: event.target.value, scorer: event.target.value === "Opponent" ? "" : goal.scorer, assister: event.target.value === "Opponent" ? "" : goal.assister })} className="w-40">{goalTeamOptions.map((team) => <option key={team} value={team}>{team}</option>)}</SelectInput>{goal.team === "Us" && <SelectInput value={goal.scorer || ""} onChange={(event) => onUpdateGoal(goal.id, { scorer: event.target.value, assister: event.target.value === ownGoalScorer ? "" : goal.assister })} className={`w-44 ${missingScorer ? "border-red-400" : ""}`}><option value="">Pick Scorer</option><option value={ownGoalScorer}>{ownGoalScorer}</option>{playedPlayers.map((player) => <option key={player.name} value={player.name}>{player.name}</option>)}</SelectInput>}{goal.team === "Us" && goal.scorer && goal.scorer !== ownGoalScorer && <SelectInput value={goal.assister || ""} onChange={(event) => onUpdateGoal(goal.id, { assister: event.target.value })} className="w-44"><option value="">No Assist</option>{playedPlayers.filter((player) => player.name !== goal.scorer).map((player) => <option key={player.name} value={player.name}>{player.name}</option>)}</SelectInput>}<Button variant="outline" onClick={() => onRemoveGoal(goal.id)}>Remove</Button></div></div>; })}</div> : <p className="rounded-2xl bg-slate-100 p-4 text-sm text-slate-500">No Goals Logged In This Half Yet.</p>}</div>;
  return <Card className="mb-4 border border-slate-200"><div className="p-4"><div className="mb-3"><h3 className="text-lg font-bold">Goal Order</h3><p className="heading-label text-sm text-slate-500">Log Goals Under The Half They Were Scored In.</p></div><div className="grid gap-4 lg:grid-cols-2"><GoalSection title="First Half Goals" half="First Half" goals={firstHalfGoals} /><GoalSection title="Second Half Goals" half="Second Half" goals={secondHalfGoals} /></div></div></Card>;
}

function PlayerDashboard({ selectedStats, playerTrainingEffect }) {
  const selectedRecords = selectedStats?.records || [];
  const venueGroups = groupAverage(selectedRecords, "venue");
  const competitionGroups = groupAverage(selectedRecords, "competition");
  const kickoffGroups = groupAverage(selectedRecords, "kickoffBand");
  const formationGroups = groupAverage(selectedRecords, "formation");
  const trainingDifference = playerTrainingEffect.attendedAverage === null || playerTrainingEffect.missedAverage === null ? null : playerTrainingEffect.attendedAverage - playerTrainingEffect.missedAverage;
  return <div className="space-y-4"><div className="grid gap-4 md:grid-cols-4"><SummaryCard label="Average Rating" value={format(selectedStats?.avgRating)} detail="Match Rating" /><SummaryCard label="Goals" value={selectedStats?.goals || 0} detail="Season Total" /><SummaryCard label="Assists" value={selectedStats?.assists || 0} detail="Season Total" /><SummaryCard label="Training Attended" value={`${selectedStats?.trainingAttended || 0}/${selectedStats?.trainingTotal || 0}`} detail="Sessions" /></div><div className="grid gap-4 lg:grid-cols-3"><Card className="lg:col-span-2"><div className="p-5"><h2 className="text-xl font-bold">{selectedStats?.name || "Player"} Rating Trend</h2><TrendChart records={selectedRecords} /></div></Card><Card><div className="p-5"><h2 className="text-xl font-bold">Training Effect</h2><p className="heading-label mt-1 text-sm text-slate-500">This Only Uses {selectedStats?.name || "This Player"}'s Match Ratings.</p><div className="mt-5 space-y-4"><SummaryPanel label="After Attending Training" value={format(playerTrainingEffect.attendedAverage)} detail={`${playerTrainingEffect.attendedCount} Match Records`} /><SummaryPanel label="After Missing Training" value={format(playerTrainingEffect.missedAverage)} detail={`${playerTrainingEffect.missedCount} Match Records`} /><p className="text-sm text-slate-600">Difference: <span className="font-bold">{format(trainingDifference)}</span></p></div></div></Card></div><div className="grid gap-4 lg:grid-cols-4"><GroupAverageTable title="Home Vs Away" groups={venueGroups} /><GroupAverageTable title="Competition" groups={competitionGroups} /><GroupAverageTable title="Kick-Off Time" groups={kickoffGroups} /><GroupAverageTable title="Formation" groups={formationGroups} /></div></div>;
}

export default function U10FootballStatsTracker() {
  const [initialTrackerState] = useState(loadTrackerState);
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
    saveTrackerState({ players, matches, trainingSessions, selectedPlayer, playerSummarySort, predictorInput });
  }, [players, matches, trainingSessions, selectedPlayer, playerSummarySort, predictorInput]);

  function clearAllData() {
    const emptyData = makeEmptyTrackerData();
    setPlayers(emptyData.players);
    setMatches(emptyData.matches);
    setTrainingSessions(emptyData.trainingSessions);
    setSelectedPlayer(emptyData.selectedPlayer);
    setNewPlayer("");
    setEditingPlayer(null);
    setEditingPlayerName("");
    setPlayerToRemove(null);
    setExpandedMatchId(null);
    setEditingMatchDraft(null);
    setConfirmClearData(false);
    setPredictorInput(makeDefaultPredictorInput());
    setPlayerSummarySort("avgRating");
    clearSavedTrackerState();
    setActiveTab("players");
  }

  function addPlayer() {
    const nextData = addPlayerToData(newPlayer, players, matches, trainingSessions);
    if (!nextData.changed) return;
    setPlayers(nextData.players);
    setMatches(nextData.matches);
    setTrainingSessions(nextData.trainingSessions);
    setSelectedPlayer(nextData.selectedPlayer);
    setNewPlayer("");
  }

  function startEditingPlayer(playerName) {
    setEditingPlayer(playerName);
    setEditingPlayerName(playerName);
    setPlayerToRemove(null);
  }

  function cancelEditingPlayer() {
    setEditingPlayer(null);
    setEditingPlayerName("");
    setPlayerToRemove(null);
  }

  function savePlayerRename(oldName) {
    const nextData = renamePlayerInData(oldName, editingPlayerName, players, matches, trainingSessions, selectedPlayer);
    if (!nextData.changed) return;
    setPlayers(nextData.players);
    setMatches(nextData.matches);
    setTrainingSessions(nextData.trainingSessions);
    setSelectedPlayer(nextData.selectedPlayer);
    cancelEditingPlayer();
  }

  function removePlayer(playerName) {
    const nextData = removePlayerFromData(playerName, players, matches, trainingSessions, selectedPlayer);
    setPlayers(nextData.players);
    setMatches(nextData.matches);
    setTrainingSessions(nextData.trainingSessions);
    setSelectedPlayer(nextData.selectedPlayer);
    cancelEditingPlayer();
  }

  function addMatch() {
    const nextId = matches.length ? Math.max(...matches.map((match) => match.id)) + 1 : 1;
    const newMatch = { id: nextId, opponent: `Opponent ${nextId}`, venue: "Home", competition: "League", kickoffTime: "09:00", formation: "3-2-1", date: new Date().toISOString().slice(0, 10), teamGoals: 0, opponentGoals: 0, goalTimeline: [], players: players.map((name) => ({ name, played: false, rating: "", goals: 0, assists: 0 })) };
    setMatches([...matches, newMatch]);
    setExpandedMatchId(nextId);
    setEditingMatchDraft(cloneMatchForEditing(newMatch));
  }

  function openMatchEditor(match) {
    setExpandedMatchId(match.id);
    setEditingMatchDraft(cloneMatchForEditing(match));
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
    setEditingMatchDraft((currentDraft) => (currentDraft ? syncMatchGoalsFromTimeline({ ...currentDraft, ...patch }) : currentDraft));
  }

  function addGoalToEditingMatch(team, half) {
    setEditingMatchDraft((currentDraft) => (currentDraft ? addGoalEventToMatch(currentDraft, team, half) : currentDraft));
  }

  function updateGoalInEditingMatch(goalId, patch) {
    setEditingMatchDraft((currentDraft) => (currentDraft ? updateGoalEventInMatch(currentDraft, goalId, patch) : currentDraft));
  }

  function removeGoalFromEditingMatch(goalId) {
    setEditingMatchDraft((currentDraft) => (currentDraft ? removeGoalEventFromMatch(currentDraft, goalId) : currentDraft));
  }

  function updatePlayerInEditingMatch(playerName, patch) {
    setEditingMatchDraft((currentDraft) => (currentDraft ? syncMatchGoalsFromTimeline(updatePlayerInMatchObject(currentDraft, playerName, patch)) : currentDraft));
  }

  function saveEditingMatch() {
    if (!editingMatchDraft || !canSaveMatch(editingMatchDraft)) return;
    setMatches((currentMatches) => replaceMatchById(currentMatches, editingMatchDraft));
    setExpandedMatchId(null);
    setEditingMatchDraft(null);
  }

  function deleteMatch(matchId) {
    setMatches((currentMatches) => currentMatches.filter((match) => match.id !== matchId));
    if (expandedMatchId === matchId) cancelMatchEditor();
  }

  function addTrainingSession() {
    const nextId = trainingSessions.length ? Math.max(...trainingSessions.map((session) => session.id)) + 1 : 1;
    setTrainingSessions([...trainingSessions, { id: nextId, date: new Date().toISOString().slice(0, 10), attendance: Object.fromEntries(players.map((player) => [player, false])) }]);
  }

  function updateTrainingSession(sessionId, patch) {
    setTrainingSessions(trainingSessions.map((session) => (session.id === sessionId ? { ...session, ...patch } : session)));
  }

  function toggleAttendance(sessionId, playerName) {
    setTrainingSessions(trainingSessions.map((session) => (session.id === sessionId ? { ...session, attendance: { ...(session.attendance || {}), [playerName]: !session.attendance?.[playerName] } } : session)));
  }

  const playerStats = useMemo(() => makePlayerStats(players, matches, trainingSessions), [players, matches, trainingSessions]);
  const allPlayerMatchRecords = useMemo(() => makeAllPlayerMatchRecords(playerStats), [playerStats]);
  const selectedStats = playerStats.find((player) => player.name === selectedPlayer) || playerStats[0] || { records: [], name: "" };
  const trainingEffect = useMemo(() => calculateTrainingEffect(players, matches, trainingSessions), [players, matches, trainingSessions]);
  const selectedPlayerTrainingEffect = useMemo(() => calculateTrainingEffectForPlayers(selectedStats?.name ? [selectedStats.name] : [], matches, trainingSessions), [selectedStats?.name, matches, trainingSessions]);
  const leaderboard = useMemo(() => sortPlayerSummary(playerStats, playerSummarySort), [playerStats, playerSummarySort]);
  const teamSummary = useMemo(() => makeTeamSummary(matches, allPlayerMatchRecords, trainingEffect), [matches, allPlayerMatchRecords, trainingEffect]);
  const predictionRows = useMemo(() => makePredictionRows(playerStats, predictorInput, trainingSessions), [playerStats, predictorInput, trainingSessions]);
  const tabs = ["Players", "Stats", "Team Summary", "Predictor", "Matches", "Training"];
  const trendSymbol = (trend) => (trend === null ? "—" : trend > 0 ? "↑" : trend < 0 ? "↓" : "→");
  const sortLabel = (key, label) => `${label}${playerSummarySort === key ? " ↓" : ""}`;

  return <div className="title-case-ui min-h-screen bg-slate-200 p-4 text-slate-900 md:p-8"><style>{`.title-case-ui h1,.title-case-ui h2,.title-case-ui h3,.title-case-ui h4,.title-case-ui th,.title-case-ui label,.title-case-ui nav button,.title-case-ui .heading-label{text-transform:capitalize;}`}</style><div className="mx-auto max-w-7xl space-y-6"><header className="rounded-3xl bg-white p-6 shadow-sm"><h1 className="text-3xl font-bold tracking-tight md:text-5xl">Team Stats Tracker</h1></header><nav className="grid grid-cols-6 rounded-2xl bg-white p-1 shadow-sm">{tabs.map((tab) => <button key={tab} onClick={() => setActiveTab(tab.toLowerCase())} className={`rounded-xl px-3 py-2 text-sm font-semibold transition ${activeTab === tab.toLowerCase() ? "bg-slate-900 text-white" : "text-slate-600 hover:bg-slate-100"}`}>{tab}</button>)}</nav>{activeTab === "players" && <main className="space-y-4"><Card><div className="p-5"><div className="mb-4 flex flex-col gap-3 md:flex-row md:items-end md:justify-between"><div><h2 className="text-xl font-bold">Manage Players</h2><p className="heading-label text-sm text-slate-500">Click A Player To Open Their Dashboard. Use Edit If You Need To Rename Or Delete Someone.</p></div><div className="flex gap-2"><Input value={newPlayer} onChange={(event) => setNewPlayer(event.target.value)} placeholder="New Player Name" className="w-48" /><Button onClick={addPlayer}>+ Add Player</Button></div></div><div className="grid gap-3 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5">{players.map((player) => { const isEditing = editingPlayer === player; const isSelected = selectedStats?.name === player; const duplicateName = Boolean(editingPlayerName.trim() && editingPlayerName.trim() !== player && players.some((existing) => existing !== player && namesMatch(existing, editingPlayerName))); return <div key={player} onClick={() => !isEditing && setSelectedPlayer(player)} className={`rounded-2xl border p-3 transition ${isSelected ? "border-slate-900 bg-slate-900 text-white" : "border-slate-200 bg-slate-50 hover:bg-slate-100"} ${isEditing ? "cursor-default" : "cursor-pointer"}`}>{!isEditing ? <div className="flex items-center justify-between gap-3"><span className="font-semibold">{player}</span><button onClick={(event) => { event.stopPropagation(); startEditingPlayer(player); }} className="rounded-lg border border-slate-300 bg-white px-2 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-100">Edit</button></div> : <div className="space-y-3 rounded-xl bg-white p-3 text-slate-900"><div><label className="mb-1 block text-xs font-semibold text-slate-500">Player Name</label><Input value={editingPlayerName} onChange={(event) => setEditingPlayerName(event.target.value)} className="w-full" />{duplicateName && <p className="mt-1 text-xs text-red-600">That Player Name Already Exists.</p>}</div><div className="flex gap-2"><button onClick={(event) => { event.stopPropagation(); savePlayerRename(player); }} className="flex-1 rounded-lg bg-slate-900 px-2 py-1 text-xs font-semibold text-white hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-40" disabled={duplicateName || !editingPlayerName.trim()}>Save</button><button onClick={(event) => { event.stopPropagation(); cancelEditingPlayer(); }} className="flex-1 rounded-lg border border-slate-300 bg-white px-2 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-100">Cancel</button></div>{playerToRemove === player ? <div className="rounded-xl border border-red-100 bg-red-50 p-3"><p className="heading-label text-xs text-red-700">Delete {player} From All Matches, Training Sessions, And Stats?</p><div className="mt-2 flex gap-2"><button onClick={(event) => { event.stopPropagation(); removePlayer(player); }} className="flex-1 rounded-lg bg-red-600 px-2 py-1 text-xs font-semibold text-white hover:bg-red-700">Yes, Delete</button><button onClick={(event) => { event.stopPropagation(); setPlayerToRemove(null); }} className="flex-1 rounded-lg border border-slate-300 bg-white px-2 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-100">Keep</button></div></div> : <button onClick={(event) => { event.stopPropagation(); setPlayerToRemove(player); }} className="w-full rounded-lg border border-red-200 bg-white px-2 py-1 text-xs font-semibold text-red-600 hover:bg-red-50">Delete Player</button>}</div>}</div>; })}{!players.length && <p className="rounded-2xl bg-slate-100 p-4 text-sm text-slate-500">No Players Yet. Add One Above.</p>}</div></div></Card><PlayerDashboard selectedStats={selectedStats} playerTrainingEffect={selectedPlayerTrainingEffect} /><Card><div className="p-5"><h2 className="mb-4 text-xl font-bold">Player Summary</h2><div className="overflow-x-auto"><table className="w-full min-w-[1120px] text-left text-sm"><thead><tr className="border-b text-slate-500"><th className="py-2"><button onClick={() => setPlayerSummarySort("name")} className="font-bold hover:text-slate-900">{sortLabel("name", "Player")}</button></th><th><button onClick={() => setPlayerSummarySort("avgRating")} className="font-bold hover:text-slate-900">{sortLabel("avgRating", "Avg Rating")}</button></th><th><button onClick={() => setPlayerSummarySort("last")} className="font-bold hover:text-slate-900">{sortLabel("last", "Last Game")}</button></th><th><button onClick={() => setPlayerSummarySort("trend")} className="font-bold hover:text-slate-900">{sortLabel("trend", "Trend")}</button></th><th><button onClick={() => setPlayerSummarySort("homeAverage")} className="font-bold hover:text-slate-900">{sortLabel("homeAverage", "Home Avg")}</button></th><th><button onClick={() => setPlayerSummarySort("awayAverage")} className="font-bold hover:text-slate-900">{sortLabel("awayAverage", "Away Avg")}</button></th><th><button onClick={() => setPlayerSummarySort("matchesPlayed")} className="font-bold hover:text-slate-900">{sortLabel("matchesPlayed", "Matches")}</button></th><th>Best Time</th><th>Best Formation</th><th><button onClick={() => setPlayerSummarySort("goals")} className="font-bold hover:text-slate-900">{sortLabel("goals", "Goals")}</button></th><th><button onClick={() => setPlayerSummarySort("assists")} className="font-bold hover:text-slate-900">{sortLabel("assists", "Assists")}</button></th><th><button onClick={() => setPlayerSummarySort("trainingAttended")} className="font-bold hover:text-slate-900">{sortLabel("trainingAttended", "Training Attended")}</button></th></tr></thead><tbody>{leaderboard.map((player) => <tr key={player.name} onClick={() => setSelectedPlayer(player.name)} className={`cursor-pointer border-b last:border-0 ${selectedStats?.name === player.name ? "bg-slate-100" : "hover:bg-slate-50"}`}><td className="py-3 font-semibold">{player.name}</td><td>{format(player.avgRating)}</td><td>{format(player.last)}</td><td><div className="flex items-center gap-2"><span className="text-lg leading-none">{trendSymbol(player.trend)}</span><span>{player.trend === null ? "—" : `${player.trend > 0 ? "+" : ""}${player.trend.toFixed(1)}`}</span></div></td><td>{format(player.homeAverage)}</td><td>{format(player.awayAverage)}</td><td>{player.matchesPlayed}</td><td>{player.bestKickoffBand}</td><td>{player.bestFormation}</td><td>{player.goals}</td><td>{player.assists}</td><td>{player.trainingAttended}/{player.trainingTotal}</td></tr>)}</tbody></table></div></div></Card></main>}{activeTab === "stats" && <StatsPage playerStats={playerStats} onSelectPlayer={(playerName) => { setSelectedPlayer(playerName); setActiveTab("players"); }} />}{activeTab === "team summary" && <TeamSummaryPage teamSummary={teamSummary} />}{activeTab === "predictor" && <PredictorPage predictorInput={predictorInput} setPredictorInput={setPredictorInput} predictionRows={predictionRows} />}{activeTab === "matches" && <main className="space-y-4"><div className="flex justify-end"><Button onClick={addMatch}>+ Add Match</Button></div>{matches.map((match) => { const isExpanded = expandedMatchId === match.id; const draftMatch = isExpanded && editingMatchDraft?.id === match.id ? editingMatchDraft : match; const matchCanBeSaved = canSaveMatch(draftMatch); const missingScorerCount = getMissingScorerGoals(draftMatch).length; const playedCount = (match.players || []).filter((player) => player.played).length; const ratingCount = (match.players || []).filter((player) => player.played && numberOrNull(player.rating) !== null).length; const totalGoals = (match.players || []).reduce((sum, player) => sum + cleanStatCount(player.goals), 0); const totalAssists = (match.players || []).reduce((sum, player) => sum + cleanStatCount(player.assists), 0); return <Card key={match.id}><div className="p-5"><div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between"><div><div className="flex flex-wrap items-center gap-2"><h2 className="text-xl font-bold">{match.opponent || "Opponent"}</h2><span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">{match.venue || "Home"}</span><span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">{match.competition || "No Competition"}</span><span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">{match.formation || "No Formation"}</span></div><p className="mt-2 text-sm text-slate-500">{match.date || "No Date"} · {match.kickoffTime || "No Time"} · {getResultText(match)}</p></div><div className="flex flex-wrap items-center gap-2 md:justify-end"><span className="rounded-2xl bg-slate-100 px-3 py-2 text-xs font-semibold text-slate-600">{playedCount} Played</span><span className="rounded-2xl bg-slate-100 px-3 py-2 text-xs font-semibold text-slate-600">{ratingCount} Ratings</span><span className="rounded-2xl bg-slate-100 px-3 py-2 text-xs font-semibold text-slate-600">G {totalGoals} · A {totalAssists}</span><Button variant="outline" onClick={() => (isExpanded ? closeMatchEditor() : openMatchEditor(match))}>{isExpanded ? "Close" : "Edit"}</Button></div></div>{isExpanded && <div className="mt-5 border-t border-slate-200 pt-5"><div className="mb-4 grid gap-3 md:grid-cols-3 lg:grid-cols-8"><Input value={draftMatch.opponent || ""} onChange={(event) => updateEditingMatchDraft({ opponent: event.target.value })} placeholder="Opponent" /><SelectInput value={draftMatch.venue || "Home"} onChange={(event) => updateEditingMatchDraft({ venue: event.target.value })}><option value="Home">Home</option><option value="Away">Away</option></SelectInput><Input value={draftMatch.competition || ""} onChange={(event) => updateEditingMatchDraft({ competition: event.target.value })} placeholder="Competition" /><Input type="time" value={draftMatch.kickoffTime || ""} onChange={(event) => updateEditingMatchDraft({ kickoffTime: event.target.value })} /><SelectInput value={formationOptions.includes(draftMatch.formation) ? draftMatch.formation : "3-2-1"} onChange={(event) => updateEditingMatchDraft({ formation: event.target.value })}>{formationOptions.map((formation) => <option key={formation} value={formation}>{formation}</option>)}</SelectInput><Input type="date" value={draftMatch.date || ""} onChange={(event) => updateEditingMatchDraft({ date: event.target.value })} /><Input type="number" min="0" value={draftMatch.teamGoals} readOnly placeholder="Our Goals" /><Input type="number" min="0" value={draftMatch.opponentGoals} readOnly placeholder="Opp Goals" /></div><GoalTimelineEditor match={draftMatch} players={draftMatch.players || []} onAddGoal={addGoalToEditingMatch} onUpdateGoal={updateGoalInEditingMatch} onRemoveGoal={removeGoalFromEditingMatch} /><div className="mb-4 flex flex-col gap-2 rounded-2xl bg-slate-100 p-3 text-sm text-slate-600 md:flex-row md:justify-between"><span>{draftMatch.venue || "Home"} Vs {draftMatch.opponent || "Opponent"}</span><span>{draftMatch.competition || "No Competition"} · {draftMatch.formation || "No Formation"} · {draftMatch.kickoffTime || "No Time"} · {getResultText(draftMatch)}</span></div>{!matchCanBeSaved && <div className="mb-4 rounded-2xl border border-red-200 bg-red-50 p-3 text-sm font-semibold text-red-700">Select A Scorer For {missingScorerCount} Goal{missingScorerCount === 1 ? "" : "s"} Before Saving Or Closing This Match.</div>}<div className="mb-4 flex flex-wrap justify-end gap-2"><Button onClick={saveEditingMatch} disabled={!matchCanBeSaved}>Save Match</Button><Button variant="outline" onClick={cancelMatchEditor}>Cancel</Button><Button variant="outline" onClick={() => deleteMatch(match.id)}>× Delete Match</Button></div><div className="overflow-x-auto"><table className="w-full min-w-[760px] text-left text-sm"><thead><tr className="border-b text-slate-500"><th className="py-2">Player</th><th>Played</th><th>Rating /10</th><th>Goals</th><th>Assists</th></tr></thead><tbody>{(draftMatch.players || []).map((player) => <tr key={player.name} className="border-b last:border-0"><td className="py-2 font-medium">{player.name}</td><td><input type="checkbox" checked={Boolean(player.played)} onChange={(event) => updatePlayerInEditingMatch(player.name, { played: event.target.checked })} /></td><td><div className="flex min-w-48 items-center gap-3"><input type="range" min="0" max="10" step="1" value={player.rating === "" ? 0 : player.rating} disabled={!player.played} onChange={(event) => updatePlayerInEditingMatch(player.name, { rating: event.target.value })} className="w-36 accent-slate-900 disabled:opacity-40" /><span className="w-8 rounded-lg bg-slate-100 px-2 py-1 text-center font-semibold">{player.rating === "" ? "—" : player.rating}</span></div></td><td><Input className="w-24" type="number" min="0" value={player.goals} readOnly /></td><td><Input className="w-24" type="number" min="0" value={player.assists} readOnly /></td></tr>)}</tbody></table></div></div>}</div></Card>; })}{!matches.length && <Card><div className="p-5 text-sm text-slate-500">No Matches Yet. Add One Above.</div></Card>}</main>}{activeTab === "training" && <main className="space-y-4"><div className="flex justify-end"><Button onClick={addTrainingSession}>+ Add Training</Button></div>{trainingSessions.map((session) => <Card key={session.id}><div className="p-5"><div className="mb-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between"><Input className="max-w-xs" type="date" value={session.date || ""} onChange={(event) => updateTrainingSession(session.id, { date: event.target.value })} /><Button variant="outline" onClick={() => setTrainingSessions(trainingSessions.filter((existingSession) => existingSession.id !== session.id))}>× Delete Training</Button></div><div className="grid gap-3 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5">{players.map((player) => <button key={player} onClick={() => toggleAttendance(session.id, player)} className={`rounded-2xl border p-3 text-left transition ${session.attendance?.[player] ? "bg-slate-900 text-white" : "bg-white hover:bg-slate-100"}`}><p className="font-semibold">{player}</p><p className="text-xs opacity-75">{session.attendance?.[player] ? "Attended" : "Missed"}</p></button>)}{!players.length && <p className="rounded-2xl bg-slate-100 p-4 text-sm text-slate-500">No Players To Track Yet.</p>}</div></div></Card>)}{!trainingSessions.length && <Card><div className="p-5 text-sm text-slate-500">No Training Sessions Yet. Add One Above.</div></Card>}</main>}<Card className="border border-red-200"><div className="p-5"><div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between"><div><h2 className="text-xl font-bold text-red-700">Clear Data</h2><p className="mt-1 text-sm text-slate-600">Remove All Players, Matches, Trainings, Ratings, Goals, Assists, And Saved Selections From This Tracker.</p></div>{!confirmClearData ? <button onClick={() => setConfirmClearData(true)} className="rounded-xl border border-red-300 bg-white px-4 py-2 text-sm font-semibold text-red-700 hover:bg-red-50">Clear Data</button> : <div className="rounded-2xl border border-red-200 bg-red-50 p-3"><p className="heading-label mb-3 text-sm font-semibold text-red-700">Are You Sure? This Cannot Be Undone.</p><div className="flex gap-2"><button onClick={clearAllData} className="rounded-xl bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700">Yes, Clear Everything</button><button onClick={() => setConfirmClearData(false)} className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-100">Cancel</button></div></div>}</div></div></Card></div></div>;
}
