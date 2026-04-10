const STORAGE_KEY = "drinkWaterData";
const DEFAULT_SETTINGS = {
  dailyGoalMl: 2000,
  drinkAmountMl: 500,
  reminderHours: 1 / 60
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

async function getStoredData() {
  const stored = await chrome.storage.local.get(STORAGE_KEY);
  const data = stored[STORAGE_KEY] || {};

  return {
    settings: {
      ...DEFAULT_SETTINGS,
      ...(data.settings || {})
    },
    entries: Array.isArray(data.entries) ? data.entries : [],
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

function getTotalForDate(entries, date) {
  const key = formatDateKey(date);
  return entries
    .filter((entry) => formatDateKey(new Date(entry.timestamp)) === key)
    .reduce((sum, entry) => sum + entry.amountMl, 0);
}

function summarizeRange(entries, dates) {
  return dates.map((date) => ({
    key: formatDateKey(date),
    label: date.toLocaleDateString(undefined, { month: "short", day: "numeric" }),
    amountMl: getTotalForDate(entries, date)
  }));
}

function getAnalytics(data) {
  const today = new Date();
  const todayTotal = getTotalForDate(data.entries, today);
  const weekSeries = summarizeRange(data.entries, getDateRange(7));
  const monthSeries = summarizeRange(data.entries, getDateRange(30));
  const weekTotal = weekSeries.reduce((sum, item) => sum + item.amountMl, 0);
  const monthTotal = monthSeries.reduce((sum, item) => sum + item.amountMl, 0);

  return {
    today: {
      totalMl: todayTotal,
      goalMl: data.settings.dailyGoalMl,
      percent: Math.min(100, Math.round((todayTotal / data.settings.dailyGoalMl) * 100) || 0)
    },
    week: {
      totalMl: weekTotal,
      averageMl: Math.round(weekTotal / 7),
      series: weekSeries
    },
    month: {
      totalMl: monthTotal,
      averageMl: Math.round(monthTotal / 30),
      series: monthSeries
    },
    recentEntries: [...data.entries].reverse().slice(0, 10)
  };
}

export {
  DEFAULT_SETTINGS,
  addDrinkEntry,
  clearReminderWindowId,
  formatDateKey,
  getAnalytics,
  getStoredData,
  saveStoredData,
  setReminderWindowId,
  updateSettings
};
