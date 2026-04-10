import {
  addDrinkEntry,
  addSkipEntry,
  clearReminderWindowId,
  computeStreak,
  getStoredData
} from "./storage.js";

const confirmBtnEl = document.getElementById("confirm-btn");
const laterBtnEl = document.getElementById("later-btn");
const statusTextEl = document.getElementById("status-text");
const avatarSceneEl = document.getElementById("avatar-scene");
const avatarNameEl = document.getElementById("avatar-name");
const headlineEl = document.getElementById("headline");
const copyEl = document.getElementById("copy");

const THIRSTY_LINES = [
  "Take a short break and drink one glass of water with me.",
  "I could really use a sip — care to join me?",
  "A quick glass of water keeps us both feeling great."
];

function pickRandom(list) {
  return list[Math.floor(Math.random() * list.length)];
}

async function initializeReminder() {
  const data = await getStoredData();
  const name = data.settings.avatarName || "Aqua";
  avatarNameEl.textContent = name;
  headlineEl.textContent = `${name} is thirsty`;
  copyEl.textContent = pickRandom(THIRSTY_LINES);
  confirmBtnEl.textContent = `I Drank Water (+${data.settings.drinkAmountMl} ml)`;
}

window.setTimeout(() => {
  confirmBtnEl.classList.remove("hidden");
  statusTextEl.textContent = "Tap once you've finished your glass.";
}, 1800);

confirmBtnEl.addEventListener("click", async () => {
  confirmBtnEl.disabled = true;
  laterBtnEl.disabled = true;

  const data = await getStoredData();
  const name = data.settings.avatarName || "Aqua";

  // Sip transition: show drinking animation before hydrated state
  avatarSceneEl.classList.remove("thirsty");
  avatarSceneEl.classList.add("sipping");
  headlineEl.textContent = `${name} is sipping...`;
  copyEl.textContent = "Glug glug glug.";

  await new Promise((resolve) => window.setTimeout(resolve, 1200));

  const updated = await addDrinkEntry(data.settings.drinkAmountMl);
  const streak = computeStreak(updated.entries, updated.settings.dailyGoalMl);

  avatarSceneEl.classList.remove("sipping");
  avatarSceneEl.classList.add("hydrated");
  headlineEl.textContent = `${name} feels great!`;
  copyEl.textContent = "Logged. Thanks for taking care of us.";
  statusTextEl.textContent = streak > 0
    ? `Streak: ${streak} day${streak === 1 ? "" : "s"} on goal.`
    : "Keep it up to start a streak!";

  const currentWindow = await chrome.windows.getCurrent();
  if (typeof currentWindow.id === "number") {
    await clearReminderWindowId();
    window.setTimeout(() => chrome.windows.remove(currentWindow.id), 1600);
  }
});

laterBtnEl.addEventListener("click", async () => {
  laterBtnEl.disabled = true;
  confirmBtnEl.disabled = true;
  await addSkipEntry("not-now");
  await chrome.alarms.create("drink-water-reminder-snooze", { delayInMinutes: 15 });
  statusTextEl.textContent = "Okay, I'll check in again in 15 minutes.";

  const currentWindow = await chrome.windows.getCurrent();
  if (typeof currentWindow.id === "number") {
    await clearReminderWindowId();
    window.setTimeout(() => chrome.windows.remove(currentWindow.id), 700);
  }
});

initializeReminder();
