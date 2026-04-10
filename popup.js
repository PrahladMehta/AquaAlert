import { addDrinkEntry, getAnalytics, getStoredData } from "./storage.js";

const todayTotalEl = document.getElementById("today-total");
const goalTextEl = document.getElementById("goal-text");
const progressFillEl = document.getElementById("progress-fill");
const weekTotalEl = document.getElementById("week-total");
const weekAverageEl = document.getElementById("week-average");
const monthTotalEl = document.getElementById("month-total");
const monthAverageEl = document.getElementById("month-average");
const weekChartEl = document.getElementById("week-chart");
const historyListEl = document.getElementById("history-list");
const quickLogBtnEl = document.getElementById("quick-log-btn");

function formatMl(amount) {
  return `${amount} ml`;
}

function renderBars(series) {
  const max = Math.max(...series.map((item) => item.amountMl), 500);

  weekChartEl.innerHTML = series
    .map((item) => {
      const height = Math.max(10, Math.round((item.amountMl / max) * 110));
      const dayLabel = new Date(item.key).toLocaleDateString(undefined, { weekday: "short" });
      return `
        <div class="bar-col">
          <span class="bar-value">${item.amountMl}</span>
          <div class="bar" style="height:${height}px"></div>
          <span class="bar-label">${dayLabel}</span>
        </div>
      `;
    })
    .join("");
}

function renderHistory(entries) {
  if (!entries.length) {
    historyListEl.innerHTML = `<p class="empty-state">No water logs yet. Start with your first 500 ml.</p>`;
    return;
  }

  historyListEl.innerHTML = entries
    .map((entry) => {
      const date = new Date(entry.timestamp);
      return `
        <article class="history-item">
          <div>
            <strong>${formatMl(entry.amountMl)}</strong>
            <div class="history-meta">${date.toLocaleDateString()} at ${date.toLocaleTimeString([], {
              hour: "2-digit",
              minute: "2-digit"
            })}</div>
          </div>
          <span class="label">Logged</span>
        </article>
      `;
    })
    .join("");
}

async function render() {
  const data = await getStoredData();
  const analytics = getAnalytics(data);

  todayTotalEl.textContent = formatMl(analytics.today.totalMl);
  goalTextEl.textContent = `${analytics.today.percent}% of ${formatMl(analytics.today.goalMl)} goal`;
  progressFillEl.style.width = `${analytics.today.percent}%`;
  quickLogBtnEl.textContent = `I Drank Water (+${data.settings.drinkAmountMl} ml)`;

  weekTotalEl.textContent = formatMl(analytics.week.totalMl);
  weekAverageEl.textContent = `Avg ${formatMl(analytics.week.averageMl)}/day`;
  monthTotalEl.textContent = formatMl(analytics.month.totalMl);
  monthAverageEl.textContent = `Avg ${formatMl(analytics.month.averageMl)}/day`;

  renderBars(analytics.week.series);
  renderHistory(analytics.recentEntries);
}

quickLogBtnEl.addEventListener("click", async () => {
  const data = await getStoredData();
  await addDrinkEntry(data.settings.drinkAmountMl);
  await render();
});

chrome.storage.onChanged.addListener((changes, areaName) => {
  if (areaName === "local" && changes.drinkWaterData) {
    render();
  }
});

render();
