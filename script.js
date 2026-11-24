
const STORAGE_KEY = "dailyTrackerData_v2";
const THEME_KEY = "dailyTrackerTheme_v1";

const now = new Date();
let selectedYear = now.getFullYear();
let selectedMonth = now.getMonth();

const todayKey = formatDate(now.getFullYear(), now.getMonth(), now.getDate());

let data = loadData();

// -------------------- DATE HELPERS --------------------

function monthKey(year, month) {
  return `${year}-${String(month + 1).padStart(2, "0")}`;
}

function dateKey(year, month, day) {
  return `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function formatDate(year, month, day) {
  return `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function daysInMonth(year, month) {
  return new Date(year, month + 1, 0).getDate();
}

function getMonthStartKey() {
  return monthKey(selectedYear, selectedMonth);
}

function getSelectedMonthDays() {
  return daysInMonth(selectedYear, selectedMonth);
}

function getWeekday(year, month, day) {
  return new Date(year, month, day).getDay();
}

function getTodayDay() {
  return now.getDate();
}

// -------------------- STORAGE --------------------

function loadData() {
  const saved = localStorage.getItem(STORAGE_KEY);

  if (saved) {
    try {
      const parsed = JSON.parse(saved);
      if (parsed && parsed.months && parsed.completed) {
        normalizeData(parsed);
        return parsed;
      }
    } catch (error) {
      console.error("Error loading saved data:", error);
    }
  }

  // Try migrating Version 1 data if available
  const oldSaved = localStorage.getItem("dailyTrackerData_v1");

  if (oldSaved) {
    try {
      const oldData = JSON.parse(oldSaved);
      const migrated = migrateOldData(oldData);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(migrated));
      return migrated;
    } catch (error) {
      console.error("Migration error:", error);
    }
  }

  const initial = {
    months: {},
    completed: {}
  };

  initial.months[monthKey(now.getFullYear(), now.getMonth())] = {
    tasks: [
      { id: createId(), name: "Read / Learn", startDate: todayKey },
      { id: createId(), name: "Exercise", startDate: todayKey },
      { id: createId(), name: "Practice Coding", startDate: todayKey },
      { id: createId(), name: "Work on Project", startDate: todayKey },
      { id: createId(), name: "Review Day", startDate: todayKey }
    ]
  };

  saveDataToStorage(initial);
  return initial;
}

function normalizeData(source) {
  Object.keys(source.months).forEach(key => {
    const tasks = source.months[key]?.tasks || [];

    tasks.forEach(task => {
      if (!task.startDate) {
        // Existing V2 tasks are treated as started from the first day of their month.
        task.startDate = `${key}-01`;
      }
    });
  });
}

function migrateOldData(oldData) {
  const migrated = {
    months: {},
    completed: {}
  };

  // Old V1 tasks were global, so their exact individual starting dates
  // cannot be recovered. Preserve them from the first day of each month.
  const oldTasks = oldData.tasks || [];
  const oldCompleted = oldData.completed || {};

  const monthsWithHistory = new Set();

  Object.keys(oldCompleted).forEach(date => {
    monthsWithHistory.add(date.slice(0, 7));
  });

  monthsWithHistory.add(monthKey(now.getFullYear(), now.getMonth()));

  monthsWithHistory.forEach(key => {
    migrated.months[key] = {
      tasks: oldTasks.map(task => ({
        id: String(task.id),
        name: task.name,
        startDate: `${key}-01`
      }))
    };
  });

  // Preserve old completion data where possible
  Object.keys(oldCompleted).forEach(date => {
    migrated.completed[date] = Array.isArray(oldCompleted[date])
      ? oldCompleted[date].map(String)
      : [];
  });

  return migrated;
}

function saveDataToStorage(source = data) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(source));
}

function createId() {
  return `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

// -------------------- MONTH DATA --------------------


function getMonthData(year = selectedYear, month = selectedMonth) {
  const key = monthKey(year, month);

  // If this month has never been initialized,
  // copy tasks from the previous month.
  if (!data.months[key]) {
    data.months[key] = {
      tasks: [],
      initialized: false
    };
  }

  const monthData = data.months[key];

  // Existing months that already have tasks remain unchanged.
  // Legacy empty months are initialized with previous month's tasks.
  if (!monthData.initialized) {
    if (monthData.tasks.length === 0) {
      const previousDate = new Date(year, month - 1, 1);
      const previousYear = previousDate.getFullYear();
      const previousMonth = previousDate.getMonth();
      const previousKey = monthKey(previousYear, previousMonth);

      const previousTasks = data.months[previousKey]?.tasks || [];

      monthData.tasks = previousTasks.map(task => ({
        id: createId(),
        name: task.name,
        startDate: `${key}-01`
      }));
    }

    monthData.initialized = true;
    saveDataToStorage();
  }

  return monthData;
}


function getTasksForDate(year, month, day) {
  const key = monthKey(year, month);
  const tasks = data.months[key]?.tasks || [];
  const date = dateKey(year, month, day);

  return tasks.filter(task => task.startDate <= date);
}

function getCompletedForDate(date) {
  if (!data.completed[date]) {
    data.completed[date] = [];
  }

  return data.completed[date];
}

function isTaskCompleted(date, taskId) {
  return getCompletedForDate(date).includes(String(taskId));
}

// -------------------- RENDER TABLE --------------------

function renderTracker() {
  const table = document.getElementById("trackerTable");
  const tasks = getMonthData().tasks;
  const totalDays = getSelectedMonthDays();

  let html = `<thead><tr><th>Task</th>`;

  for (let day = 1; day <= totalDays; day++) {
    const weekday = getWeekday(selectedYear, selectedMonth, day);
    const date = dateKey(selectedYear, selectedMonth, day);
    const isToday = date === todayKey;

    html += `
      <th class="${isToday ? "today-column" : ""} ${weekday === 0 || weekday === 6 ? "weekend" : ""}">
        <div class="day-header">
          <span class="day-number">${day}</span>
          <span class="day-weekday">${["S", "M", "T", "W", "T", "F", "S"][weekday]}</span>
        </div>
      </th>
    `;
  }

  html += `<th>%</th></tr></thead><tbody>`;

  if (tasks.length === 0) {
    html += `
      <tr>
        <td colspan="${totalDays + 2}" class="empty-message">
          No tasks for this month. Add your first task above.
        </td>
      </tr>
    `;
  } else {
    tasks.forEach(task => {
      const activeDays = tasksDaysActive(task, totalDays);
      let checkedCount = 0;

      for (let day = 1; day <= totalDays; day++) {
        const date = dateKey(selectedYear, selectedMonth, day);

        if (task.startDate <= date && isTaskCompleted(date, task.id)) {
          checkedCount++;
        }
      }

      const taskPercent = activeDays > 0
        ? Math.round((checkedCount / activeDays) * 100)
        : 0;

      html += `<tr><td>
        <div class="task-name">
          <span class="task-name-text" title="Started ${task.startDate}">
            ${escapeHTML(task.name)}
          </span>
          <button class="delete-task" data-id="${task.id}" title="Delete task">×</button>
        </div>
      </td>`;

      for (let day = 1; day <= totalDays; day++) {
        const date = dateKey(selectedYear, selectedMonth, day);
        const active = task.startDate <= date;
        const completed = isTaskCompleted(date, task.id);
        const weekday = getWeekday(selectedYear, selectedMonth, day);

        if (!active) {
          html += `<td class="not-started" title="Task not started yet">—</td>`;
        } else {
          html += `
            <td class="${date === todayKey ? "today-column" : ""} ${weekday === 0 || weekday === 6 ? "weekend" : ""}">
              <input
                type="checkbox"
                class="task-checkbox"
                data-date="${date}"
                data-task="${task.id}"
                ${completed ? "checked" : ""}
                aria-label="${escapeHTML(task.name)} on ${date}"
              />
            </td>
          `;
        }
      }

      html += `<td class="task-percent">${taskPercent}%</td></tr>`;
    });

    // Daily progress row
    html += `<tr class="progress-row"><td>Daily Progress</td>`;

    for (let day = 1; day <= totalDays; day++) {
      const date = dateKey(selectedYear, selectedMonth, day);
      const activeTasks = getTasksForDate(selectedYear, selectedMonth, day);
      const completedCount = activeTasks.filter(task =>
        isTaskCompleted(date, task.id)
      ).length;

      const percent = activeTasks.length
        ? Math.round((completedCount / activeTasks.length) * 100)
        : 0;

      html += `<td class="${date === todayKey ? "today-column" : ""}">${activeTasks.length ? percent + "%" : "—"}</td>`;
    }

    html += `<td>—</td></tr>`;
  }

  html += `</tbody>`;
  table.innerHTML = html;

  attachCheckboxEvents();
  attachDeleteEvents();
}

function tasksDaysActive(task, totalDays) {
  let count = 0;

  for (let day = 1; day <= totalDays; day++) {
    const date = dateKey(selectedYear, selectedMonth, day);
    if (task.startDate <= date) count++;
  }

  return count;
}

// -------------------- CHECKBOX EVENTS --------------------

function attachCheckboxEvents() {
  document.querySelectorAll(".task-checkbox").forEach(checkbox => {
    checkbox.addEventListener("change", () => {
      const date = checkbox.dataset.date;
      const taskId = checkbox.dataset.task;

      const completed = getCompletedForDate(date);
      const id = String(taskId);

      if (checkbox.checked) {
        if (!completed.includes(id)) completed.push(id);
      } else {
        data.completed[date] = completed.filter(item => item !== id);
      }

      saveDataToStorage();
      updateStats();
      renderHeatmap();
      renderDailyProgressRow();
    });
  });
}

function renderDailyProgressRow() {
  // Re-render table to refresh daily percentages.
  renderTracker();
}

// -------------------- DELETE TASK --------------------

function attachDeleteEvents() {
  document.querySelectorAll(".delete-task").forEach(button => {
    button.addEventListener("click", () => {
      deleteTask(button.dataset.id);
    });
  });
}

function deleteTask(taskId) {
  const confirmDelete = confirm("Delete this task from this month?");

  if (!confirmDelete) return;

  const key = getMonthStartKey();
  const tasks = getMonthData().tasks;

  data.months[key].tasks = tasks.filter(task => String(task.id) !== String(taskId));

  // Remove only this task's completion records from this month
  Object.keys(data.completed).forEach(date => {
    if (date.startsWith(key)) {
      data.completed[date] = data.completed[date].filter(
        id => String(id) !== String(taskId)
      );
    }
  });

  saveDataToStorage();
  renderTracker();
  updateStats();
  renderHeatmap();
}

// -------------------- ADD TASK --------------------

function addTask() {
  const input = document.getElementById("newTask");
  const name = input.value.trim();

  if (!name) {
    alert("Please enter a task name.");
    return;
  }

  const monthData = getMonthData();

  const duplicate = monthData.tasks.some(task =>
    task.name.toLowerCase() === name.toLowerCase()
  );

  if (duplicate) {
    alert("This task already exists in the selected month.");
    return;
  }

  // For the current month, start from today's date.
  // For other selected months, start from the first day of that month.
  const selectedKey = monthKey(selectedYear, selectedMonth);
  const currentKey = monthKey(now.getFullYear(), now.getMonth());

  const startDate = selectedKey === currentKey
    ? todayKey
    : `${selectedKey}-01`;

  monthData.tasks.push({
    id: createId(),
    name,
    startDate
  });

  input.value = "";

  saveDataToStorage();
  renderTracker();
  updateStats();
  renderHeatmap();
}

// -------------------- STATISTICS --------------------

function updateStats() {
  const tasks = getMonthData().tasks;
  const totalDays = getSelectedMonthDays();

  let completedSlots = 0;
  let totalSlots = 0;

  for (let day = 1; day <= totalDays; day++) {
    const date = dateKey(selectedYear, selectedMonth, day);
    const activeTasks = getTasksForDate(selectedYear, selectedMonth, day);

    totalSlots += activeTasks.length;
    completedSlots += activeTasks.filter(task =>
      isTaskCompleted(date, task.id)
    ).length;
  }

  const monthPercent = totalSlots
    ? Math.round((completedSlots / totalSlots) * 100)
    : 0;

  document.getElementById("monthlyPercent").textContent = `${monthPercent}%`;
  document.getElementById("monthlyBar").style.width = `${monthPercent}%`;
  document.getElementById("monthlySubtitle").textContent =
    `${completedSlots} of ${totalSlots} available checklists completed`;

  // Today's progress is shown only if the current month is selected
  const isCurrentMonth = monthKey(selectedYear, selectedMonth) ===
    monthKey(now.getFullYear(), now.getMonth());

  const todayTasks = isCurrentMonth
    ? getTasksForDate(now.getFullYear(), now.getMonth(), now.getDate())
    : [];

  const todayCompleted = isCurrentMonth
    ? todayTasks.filter(task => isTaskCompleted(todayKey, task.id)).length
    : 0;

  const todayPercent = todayTasks.length
    ? Math.round((todayCompleted / todayTasks.length) * 100)
    : 0;

  document.getElementById("todayCount").textContent =
    isCurrentMonth ? `${todayCompleted}/${todayTasks.length}` : "—";

  document.getElementById("todayBar").style.width =
    isCurrentMonth ? `${todayPercent}%` : "0%";

  document.getElementById("todaySubtitle").textContent =
    isCurrentMonth ? "Tasks completed today" : "Select the current month to see today's progress";

  // Completed checkbox total within selected month
  let completedTotal = 0;

  for (let day = 1; day <= totalDays; day++) {
    const date = dateKey(selectedYear, selectedMonth, day);
    completedTotal += getTasksForDate(selectedYear, selectedMonth, day)
      .filter(task => isTaskCompleted(date, task.id)).length;
  }

  document.getElementById("completedTotal").textContent = completedTotal;
  document.getElementById("completedSubtitle").textContent =
    "Completed checklists this month";

  document.getElementById("streakCount").textContent =
    `${calculateStreak()} days`;
}

// -------------------- STREAK --------------------

function calculateStreak() {
  let streak = 0;
  const cursor = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  // If today is not complete, start checking from yesterday
  const todaysTasks = getTasksForDate(cursor.getFullYear(), cursor.getMonth(), cursor.getDate());

  if (!todaysTasks.length ||
      !todaysTasks.every(task => isTaskCompleted(todayKey, task.id))) {
    cursor.setDate(cursor.getDate() - 1);
  }

  while (true) {
    const year = cursor.getFullYear();
    const month = cursor.getMonth();
    const day = cursor.getDate();
    const date = dateKey(year, month, day);
    const activeTasks = getTasksForDate(year, month, day);

    if (!activeTasks.length) break;

    const allDone = activeTasks.every(task => isTaskCompleted(date, task.id));

    if (!allDone) break;

    streak++;
    cursor.setDate(cursor.getDate() - 1);
  }

  return streak;
}

// -------------------- HEATMAP --------------------

function renderHeatmap() {
  const heatmap = document.getElementById("heatmap");
  const totalDays = getSelectedMonthDays();
  const firstWeekday = getWeekday(selectedYear, selectedMonth, 1);

  const weekdays = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

  let html = "";

  weekdays.forEach(day => {
    html += `<div class="heatmap-weekday">${day}</div>`;
  });

  for (let i = 0; i < firstWeekday; i++) {
    html += `<div class="heat-cell empty"></div>`;
  }

  for (let day = 1; day <= totalDays; day++) {
    const date = dateKey(selectedYear, selectedMonth, day);
    const activeTasks = getTasksForDate(selectedYear, selectedMonth, day);
    const completedCount = activeTasks.filter(task =>
      isTaskCompleted(date, task.id)
    ).length;

    const percent = activeTasks.length
      ? Math.round((completedCount / activeTasks.length) * 100)
      : 0;

    const level = getHeatLevel(percent, activeTasks.length);

    html += `
      <div
        class="heat-cell level-${level}"
        title="${date}: ${activeTasks.length ? percent + "% completed" : "No active tasks"}"
      ></div>
    `;
  }

  heatmap.innerHTML = html;
}

function getHeatLevel(percent, taskCount) {
  if (!taskCount || percent === 0) return 0;
  if (percent < 25) return 1;
  if (percent < 50) return 2;
  if (percent < 75) return 3;
  return 4;
}

// -------------------- MONTH NAVIGATION --------------------

function renderMonthLabel() {
  const date = new Date(selectedYear, selectedMonth, 1);

  document.getElementById("monthLabel").textContent =
    date.toLocaleDateString("en-US", {
      month: "long",
      year: "numeric"
    });
}

function changeMonth(amount) {
  selectedMonth += amount;

  if (selectedMonth > 11) {
    selectedMonth = 0;
    selectedYear++;
  } else if (selectedMonth < 0) {
    selectedMonth = 11;
    selectedYear--;
  }

  getMonthData();
  renderAll();
}

function goToToday() {
  selectedYear = now.getFullYear();
  selectedMonth = now.getMonth();
  renderAll();
}

// -------------------- THEME --------------------

function applyTheme(theme) {
  document.body.classList.toggle("dark", theme === "dark");

  const icon = document.getElementById("themeIcon");
  const text = document.getElementById("themeText");

  if (theme === "dark") {
    icon.textContent = "☀";
    text.textContent = "Light Mode";
  } else {
    icon.textContent = "☾";
    text.textContent = "Dark Mode";
  }

  localStorage.setItem(THEME_KEY, theme);
}

function initializeTheme() {
  const savedTheme = localStorage.getItem(THEME_KEY) || "light";
  applyTheme(savedTheme);
}

// -------------------- UTILITIES --------------------

function escapeHTML(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function renderAll() {
  renderMonthLabel();
  renderTracker();
  updateStats();
  renderHeatmap();
}

// -------------------- EVENT LISTENERS --------------------

document.getElementById("prevMonth").addEventListener("click", () => changeMonth(-1));
document.getElementById("nextMonth").addEventListener("click", () => changeMonth(1));
document.getElementById("goToday").addEventListener("click", goToToday);

document.getElementById("addTaskBtn").addEventListener("click", addTask);

document.getElementById("newTask").addEventListener("keydown", event => {
  if (event.key === "Enter") addTask();
});

document.getElementById("themeToggle").addEventListener("click", () => {
  const isDark = document.body.classList.contains("dark");
  applyTheme(isDark ? "light" : "dark");
});

// -------------------- INITIALIZATION --------------------

initializeTheme();
renderAll();
