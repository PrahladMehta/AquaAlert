import { addDrinkEntry, clearReminderWindowId, getStoredData } from "./storage.js";

const confirmBtnEl = document.getElementById("confirm-btn");
const laterBtnEl = document.getElementById("later-btn");
const statusTextEl = document.getElementById("status-text");

async function initializeReminder() {
  const data = await getStoredData();
  confirmBtnEl.textContent = `I Drank Water (+${data.settings.drinkAmountMl} ml)`;
}

window.setTimeout(() => {
  confirmBtnEl.classList.remove("hidden");
  statusTextEl.textContent = "Tap the button after you finish your glass of water.";
}, 2500);

confirmBtnEl.addEventListener("click", async () => {
  const data = await getStoredData();
  await addDrinkEntry(data.settings.drinkAmountMl);
  statusTextEl.textContent = "Nice work. Your water log has been updated.";

  const currentWindow = await chrome.windows.getCurrent();
  if (typeof currentWindow.id === "number") {
    await clearReminderWindowId();
    window.setTimeout(() => chrome.windows.remove(currentWindow.id), 900);
  }
});

laterBtnEl.addEventListener("click", async () => {
  await chrome.alarms.create("drink-water-reminder-snooze", { delayInMinutes: 15 });
  statusTextEl.textContent = "Okay, I will remind you again in 15 minutes.";

  const currentWindow = await chrome.windows.getCurrent();
  if (typeof currentWindow.id === "number") {
    await clearReminderWindowId();
    window.setTimeout(() => chrome.windows.remove(currentWindow.id), 700);
  }
});

initializeReminder();
