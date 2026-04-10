const STORAGE_KEY = "drinkWaterData";

const DEFAULT_SETTINGS = {
  dailyGoalMl: 2000,
  drinkAmountMl: 250,
  reminderMinutes: 120,
  testingMode: false,
  testingIntervalMinutes: 1,
  avatarName: "Aqua",
  onboarded: false
};

function formatDateKey(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function startOfDay(date) {
  const copy = new Date(date);
  copy.setHours(0, 0, 0, 0);
  return copy;
}

function getDateRange(days) {
  const today = startOfDay(new Date());
  return Array.from({ length: days }, (_, index) => {
    const date = new Date(today);
    date.setDate(today.getDate() - (days - 1 - index));
    return date;
  });
}

function migrateSettings(rawSettings) {
  const settings = { ...rawSettings };
  if (typeof settings.reminderMinutes !== "number" && typeof settings.reminderHours === "number") {
    settings.reminderMinutes = Math.max(1, Math.round(settings.reminderHours * 60));
  }
  delete settings.reminderHours;
  return settings;
}

async function getStoredData() {
  const stored = await chrome.storage.local.get(STORAGE_KEY);
  const data = stored[STORAGE_KEY] || {};

  return {
    settings: {
      ...DEFAULT_SETTINGS,
      ...migrateSettings(data.settings || {})
    },
    entries: Array.isArray(data.entries) ? data.entries : [],
    skips: Array.isArray(data.skips) ? data.skips : [],
    reminderWindowId: typeof data.reminderWindowId === "number" ? data.reminderWindowId : null
  };
}

async function saveStoredData(data) {
  await chrome.storage.local.set({
    [STORAGE_KEY]: data
  });
}

async function addDrinkEntry(amountMl) {
  const data = await getStoredData();
  const entry = {
    id: crypto.randomUUID(),
    amountMl,
    timestamp: new Date().toISOString()
  };

  const entries = [...data.entries, entry].sort((a, b) =>
    a.timestamp.localeCompare(b.timestamp)
  );

  const updated = {
    ...data,
    entries
  };

  await saveStoredData(updated);
  return updated;
}

async function addSkipEntry(reason) {
  const data = await getStoredData();
  const skip = {
    id: crypto.randomUUID(),
    reason: reason || "not-now",
    timestamp: new Date().toISOString()
  };
  const updated = {
    ...data,
    skips: [...data.skips, skip].slice(-200)
  };
  await saveStoredData(updated);
  return updated;
}

async function updateSettings(partialSettings) {
  const data = await getStoredData();
  const updated = {
    ...data,
    settings: {
      ...data.settings,
      ...partialSettings
    }
  };

  await saveStoredData(updated);
  return updated;
}

async function setReminderWindowId(windowId) {
  const data = await getStoredData();
  await saveStoredData({
    ...data,
    reminderWindowId: windowId
  });
}

async function clearReminderWindowId() {
  const data = await getStoredData();
  await saveStoredData({
    ...data,
    reminderWindowId: null
  });
}

function getEffectiveIntervalMinutes(settings) {
  if (settings.testingMode) {
    return Math.max(1, settings.testingIntervalMinutes || 1);
  }
  return Math.max(1, settings.reminderMinutes || 120);
}

function getTotalForDate(entries, date) {
  const key = formatDateKey(date);
  return entries
    .filter((entry) => formatDateKey(new Date(entry.timestamp)) === key)
    .reduce((sum, entry) => sum + entry.amountMl, 0);
}

function summarizeRange(entries, dates, goalMl) {
  return dates.map((date) => {
    const amountMl = getTotalForDate(entries, date);
    return {
      key: formatDateKey(date),
      label: date.toLocaleDateString(undefined, { month: "short", day: "numeric" }),
      amountMl,
      goalHit: amountMl >= goalMl
    };
  });
}

function computeStreak(entries, goalMl) {
  let streak = 0;
  const today = startOfDay(new Date());
  for (let offset = 0; offset < 365; offset += 1) {
    const date = new Date(today);
    date.setDate(today.getDate() - offset);
    const total = getTotalForDate(entries, date);
    if (total >= goalMl) {
      streak += 1;
    } else if (offset === 0) {
      // today doesn't count against streak yet
      continue;
    } else {
      break;
    }
  }
  return streak;
}

function getHydrationStatus(percent) {
  if (percent >= 100) return { label: "Excellent", tone: "excellent" };
  if (percent >= 70) return { label: "Good", tone: "good" };
  if (percent >= 35) return { label: "Okay", tone: "okay" };
  return { label: "Low", tone: "low" };
}

function getMilestoneMessage(todayMl, goalMl, drinkMl) {
  if (todayMl === 0) {
    return "Let's start your day with a glass of water.";
  }
  if (todayMl >= goalMl) {
    return `You hit your ${goalMl} ml goal. Keep the streak alive!`;
  }
  const remaining = goalMl - todayMl;
  if (remaining <= drinkMl) {
    return `Just ${remaining} ml to reach your goal.`;
  }
  const glasses = Math.ceil(remaining / drinkMl);
  return `${glasses} more glasses to hit your goal.`;
}

function getAnalytics(data) {
  const today = new Date();
  const goalMl = data.settings.dailyGoalMl;
  const drinkMl = data.settings.drinkAmountMl;
  const todayTotal = getTotalForDate(data.entries, today);
  const weekSeries = summarizeRange(data.entries, getDateRange(7), goalMl);
  const monthSeries = summarizeRange(data.entries, getDateRange(30), goalMl);
  const weekTotal = weekSeries.reduce((sum, item) => sum + item.amountMl, 0);
  const monthTotal = monthSeries.reduce((sum, item) => sum + item.amountMl, 0);
  const percent = Math.min(100, Math.round((todayTotal / goalMl) * 100) || 0);

  return {
    today: {
      totalMl: todayTotal,
      goalMl,
      percent,
      status: getHydrationStatus(percent),
      milestone: getMilestoneMessage(todayTotal, goalMl, drinkMl),
      glassesToday: data.entries.filter(
        (entry) => formatDateKey(new Date(entry.timestamp)) === formatDateKey(today)
      ).length
    },
    streak: computeStreak(data.entries, goalMl),
    week: {
      totalMl: weekTotal,
      averageMl: Math.round(weekTotal / 7),
      goalDays: weekSeries.filter((item) => item.goalHit).length,
      series: weekSeries
    },
    month: {
      totalMl: monthTotal,
      averageMl: Math.round(monthTotal / 30),
      goalDays: monthSeries.filter((item) => item.goalHit).length,
      series: monthSeries
    },
    recentEntries: [...data.entries].reverse().slice(0, 10)
  };
}

export {
  DEFAULT_SETTINGS,
  addDrinkEntry,
  addSkipEntry,
  clearReminderWindowId,
  computeStreak,
  formatDateKey,
  getAnalytics,
  getEffectiveIntervalMinutes,
  getHydrationStatus,
  getMilestoneMessage,
  getStoredData,
  saveStoredData,
  setReminderWindowId,
  updateSettings
};
