import { DEFAULT_SETTINGS, getStoredData, updateSettings } from "./storage.js";

const form = document.getElementById("settings-form");
const saveStatus = document.getElementById("save-status");
const resetBtn = document.getElementById("reset-btn");

const FIELDS = [
  { id: "dailyGoalMl", type: "number" },
  { id: "drinkAmountMl", type: "number" },
  { id: "reminderMinutes", type: "number" },
  { id: "testingIntervalMinutes", type: "number" },
  { id: "testingMode", type: "checkbox" },
  { id: "avatarName", type: "text" }
];

function applySettingsToForm(settings) {
  for (const field of FIELDS) {
    const el = document.getElementById(field.id);
    if (!el) continue;
    if (field.type === "checkbox") {
      el.checked = Boolean(settings[field.id]);
    } else {
      el.value = settings[field.id] ?? "";
    }
  }
}

function readFormSettings() {
  const next = {};
  for (const field of FIELDS) {
    const el = document.getElementById(field.id);
    if (!el) continue;
    if (field.type === "checkbox") {
      next[field.id] = el.checked;
    } else if (field.type === "number") {
      const value = Number(el.value);
      if (!Number.isFinite(value)) continue;
      next[field.id] = value;
    } else {
      next[field.id] = el.value.trim();
    }
  }
  return next;
}

function flashSaved(message) {
  saveStatus.textContent = message;
  window.setTimeout(() => {
    saveStatus.textContent = "";
  }, 2200);
}

async function load() {
  const data = await getStoredData();
  applySettingsToForm(data.settings);
}

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  const next = readFormSettings();
  if (!next.avatarName) next.avatarName = "Aqua";
  await updateSettings(next);
  flashSaved("Saved.");
});

resetBtn.addEventListener("click", async () => {
  applySettingsToForm(DEFAULT_SETTINGS);
  await updateSettings({ ...DEFAULT_SETTINGS });
  flashSaved("Reset to defaults.");
});

load();
