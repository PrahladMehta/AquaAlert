import {
  clearReminderWindowId,
  getStoredData,
  setReminderWindowId
} from "./storage.js";

const ALARM_NAME = "drink-water-reminder";
const SNOOZE_ALARM_NAME = "drink-water-reminder-snooze";

async function scheduleReminderAlarm() {
  const data = await getStoredData();
  const delayMinutes = Math.max(1, data.settings.reminderHours * 60);

  await chrome.alarms.clear(ALARM_NAME);
  await chrome.alarms.clear(SNOOZE_ALARM_NAME);
  await chrome.alarms.create(ALARM_NAME, {
    delayInMinutes: delayMinutes,
    periodInMinutes: delayMinutes
  });
}

async function openReminderWindow() {
  const data = await getStoredData();

  if (data.reminderWindowId) {
    try {
      await chrome.windows.update(data.reminderWindowId, { focused: true });
      return;
    } catch (error) {
      await clearReminderWindowId();
    }
  }

  const url = chrome.runtime.getURL("reminder.html");
  const windowInfo = await chrome.windows.create({
    url,
    type: "popup",
    width: 420,
    height: 540,
    focused: true
  });

  if (typeof windowInfo.id === "number") {
    await setReminderWindowId(windowInfo.id);
  }
}

chrome.runtime.onInstalled.addListener(() => {
  scheduleReminderAlarm();
});

chrome.runtime.onStartup.addListener(() => {
  scheduleReminderAlarm();
});

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === ALARM_NAME || alarm.name === SNOOZE_ALARM_NAME) {
    openReminderWindow();
  }
});

chrome.windows.onRemoved.addListener(async (windowId) => {
  const data = await getStoredData();
  if (data.reminderWindowId === windowId) {
    await clearReminderWindowId();
  }
});
