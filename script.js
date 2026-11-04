
const STORAGE_KEY = "taskflow_tasks_v2";
const THEME_KEY = "taskflow_theme_v1";
const HISTORY_KEY = "taskflow_completed_history_v1";

let completedHistory = loadHistory();

function loadHistory() {
  try {
    const saved = JSON.parse(localStorage.getItem(HISTORY_KEY) || "[]");
    return Array.isArray(saved) ? saved : [];
  } catch {
    return [];
  }
}

function saveHistory() {
  localStorage.setItem(HISTORY_KEY, JSON.stringify(completedHistory));
}

function addToHistory(task) {
  completedHistory = completedHistory.filter(item => item.id !== task.id);

  completedHistory.unshift({
    id: task.id,
    title: task.title,
    category: task.category,
    priority: task.priority,
    completedAt: task.completedAt || new Date().toISOString()
  });

  saveHistory();
}

function removeFromHistory(taskId) {
  completedHistory = completedHistory.filter(item => item.id !== taskId);
  saveHistory();
}

const $ = (selector) => document.querySelector(selector);

const taskForm = $("#taskForm");
const taskTitle = $("#taskTitle");
const taskCategory = $("#taskCategory");
const taskPriority = $("#taskPriority");
const taskDue = $("#taskDue");
const taskList = $("#taskList");
const emptyState = $("#emptyState");
const searchInput = $("#searchInput");
const celebration = $("#celebration");
const confettiLayer = $("#confettiLayer");
const editDialog = $("#editDialog");

let tasks = loadTasks();
let currentFilter = "all";
let currentCategory = "";
let editingTaskId = null;
let previousFocus = null;


function loadTasks() {
  try {
    const hasV2 = localStorage.getItem(STORAGE_KEY) !== null;

    const currentData = JSON.parse(
      localStorage.getItem(STORAGE_KEY) || "[]"
    );

    const oldData = JSON.parse(
      localStorage.getItem("taskflow_tasks_v1") || "[]"
    );

    // Use v2 whenever the key exists, even if it is empty.
    const saved = hasV2 ? currentData : oldData;

    const normalized = Array.isArray(saved)
      ? saved.filter(
          task =>
            task &&
            typeof task.id === "string" &&
            typeof task.title === "string"
        ).map(task => ({
          id: task.id,
          title: task.title.slice(0, 120),
          category: ["Work", "Personal", "Study"].includes(task.category)
            ? task.category
            : "Personal",
          priority: ["high", "medium", "low"].includes(task.priority)
            ? task.priority
            : "medium",
          due: typeof task.due === "string"
            ? task.due
            : typeof task.dueDate === "string"
              ? task.dueDate
              : "",
          completed: Boolean(task.completed),
          createdAt: task.createdAt
            ? new Date(task.createdAt).getTime() || Date.now()
            : Date.now(),
          completedAt: task.completedAt &&
            !Number.isNaN(new Date(task.completedAt).getTime())
              ? task.completedAt
              : null
        }))
      : [];

    // Save migrated data only when v2 does not exist.
    if (!hasV2) {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify(normalized)
      );
    }

    return normalized;

  } catch (error) {
    console.error("Failed to load tasks:", error);
    return [];
  }
}



function saveTasks() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(tasks));
  } catch {
    alert("Browser storage is unavailable. Your latest changes may not persist after refresh.");
  }
}

function makeId() {
  return globalThis.crypto?.randomUUID?.() ||
    `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function escapeHTML(value) {
  return String(value).replace(/[&<>"']/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;"
  })[character]);
}

function formatDate(dateString) {
  if (!dateString) return "";
  const date = new Date(`${dateString}T00:00:00`);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric"
  });
}

function getDateStatus(task) {
  if (!task.due || task.completed) return "";
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const due = new Date(`${task.due}T00:00:00`);
  if (Number.isNaN(due.getTime())) return "";
  if (due < today) return "overdue";
  if (due.getTime() === today.getTime()) return "today";
  return "";
}

function renderTasks() {
  const query = searchInput.value.trim().toLowerCase();

  const visibleTasks = tasks
    .filter((task) => {
      const matchesFilter =
        currentFilter === "all" ||
        (currentFilter === "active" && !task.completed) ||
        (currentFilter === "completed" && task.completed);

      const matchesCategory =
        !currentCategory || task.category === currentCategory;

      const matchesSearch =
        task.title.toLowerCase().includes(query) ||
        task.category.toLowerCase().includes(query) ||
        task.priority.toLowerCase().includes(query);

      return matchesFilter && matchesCategory && matchesSearch;
    })
    .sort((a, b) => {
      if (a.completed !== b.completed) return Number(a.completed) - Number(b.completed);

      const priorityOrder = { high: 0, medium: 1, low: 2 };
      const priorityDifference = priorityOrder[a.priority] - priorityOrder[b.priority];
      if (priorityDifference !== 0) return priorityDifference;

      if (a.due && b.due) return a.due.localeCompare(b.due);
      if (a.due) return -1;
      if (b.due) return 1;
      return b.createdAt - a.createdAt;
    });

  taskList.innerHTML = visibleTasks.map((task) => {
    const categoryClass = `cat-${task.category.toLowerCase()}`;
    const priorityLabel = {
      high: "▲ High",
      medium: "● Medium",
      low: "▽ Low"
    }[task.priority];

    const dateStatus = getDateStatus(task);
    const dateLabel = dateStatus === "overdue"
      ? "Overdue · " + formatDate(task.due)
      : dateStatus === "today"
        ? "Due today"
        : formatDate(task.due);

    return `
      <article class="task-item ${task.completed ? "completed" : ""}" data-id="${escapeHTML(task.id)}">
        <input
          class="task-check"
          type="checkbox"
          aria-label="Mark ${escapeHTML(task.title)} as ${task.completed ? "active" : "completed"}"
          ${task.completed ? "checked" : ""}
        >
        <div class="task-main">
          <p class="task-title">${escapeHTML(task.title)}</p>
          <div class="task-meta">
            <span class="pill ${categoryClass}">${escapeHTML(task.category)}</span>
            <span class="pill priority-${task.priority}">${priorityLabel}</span>
            ${task.due ? `<span class="due-date ${dateStatus}">◷ ${escapeHTML(dateLabel)}</span>` : ""}
          </div>
        </div>
        <div class="task-actions">
          <button class="icon-button edit-task" type="button" aria-label="Edit task" title="Edit">✎</button>
          <button class="icon-button delete delete-task" type="button" aria-label="Delete task" title="Delete">×</button>
        </div>
      </article>
    `;
  }).join("");

  const hasVisibleTasks = visibleTasks.length > 0;
  emptyState.hidden = hasVisibleTasks;

  if (!hasVisibleTasks) {
    if (query || currentCategory) {
      $("#emptyTitle").textContent = "No matching tasks";
      $("#emptyMessage").textContent = "Try another search or choose a different filter.";
    } else if (currentFilter === "completed") {
      $("#emptyTitle").textContent = "Your wins are waiting!";
      $("#emptyMessage").textContent = "Complete a task and it will appear here.";
    } else if (currentFilter === "active") {
      $("#emptyTitle").textContent = "All caught up!";
      $("#emptyMessage").textContent = "You've completed every task. Enjoy the progress!";
    } else {
      $("#emptyTitle").textContent = "A fresh start!";
      $("#emptyMessage").textContent = "Add your first task above and turn your plans into progress.";
    }
  }

  updateStats();
  updateFilterStyles();
}

function updateStats() {
  const total = tasks.length;
  const completed = tasks.filter((task) => task.completed).length;
  const active = total - completed;
  const overdue = tasks.filter((task) => getDateStatus(task) === "overdue").length;
  const percent = total ? Math.round((completed / total) * 100) : 0;

  $("#totalStat").textContent = total;
  $("#activeStat").textContent = active;
  $("#completedStat").textContent = completed;
  $("#overdueStat").textContent = overdue;

  $("#allCount").textContent = total;
  $("#activeCount").textContent = active;
  $("#completedCount").textContent = completed;

  $("#progressPercent").textContent = `${percent}%`;
  $("#progressBar").style.width = `${percent}%`;

  $("#progressTitle").textContent = total === 0
    ? "Ready when you are!"
    : percent === 100
      ? "Amazing! You did it all!"
      : percent >= 70
        ? "You're on a roll!"
        : percent >= 35
          ? "Look at your progress!"
          : "You're off to a great start!";

  $("#progressCaption").textContent = total === 0
    ? "Add a task and take the first step."
    : `${completed} of ${total} tasks completed. ${active} more to go!`;
}

function renderHistory() {
  const historyList = $("#historyList");
  const historyCount = $("#historyCount");
  const historyEmpty = $("#historyEmpty");

  if (!historyList || !historyCount || !historyEmpty) {
    console.error("History HTML elements are missing.");
    return;
  }

  historyCount.textContent = completedHistory.length;

  if (completedHistory.length === 0) {
    historyList.innerHTML = "";
    historyEmpty.hidden = false;
    return;
  }

  historyEmpty.hidden = true;

  historyList.innerHTML = completedHistory.map(item => {
    const date = new Date(item.completedAt);

    const formattedDate = date.toLocaleString("en-IN", {
      day: "numeric",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit"
    });

    return `
      <article class="history-item">
        <div class="history-check">✓</div>

        <div class="history-details">
          <p class="history-title">
            ${escapeHTML(item.title)}
          </p>

          <div class="history-meta">
            <span>${escapeHTML(item.category)}</span>
            <span>Completed ${escapeHTML(formattedDate)}</span>
          </div>
        </div>

        <span class="history-status">Completed</span>
      </article>
    `;
  }).join("");
}


function updateFilterStyles() {
  document.querySelectorAll("[data-filter]").forEach((button) => {
    button.classList.toggle(
      "active",
      button.dataset.filter === currentFilter && !currentCategory
    );
  });

  document.querySelectorAll("[data-category]").forEach((button) => {
    button.classList.toggle(
      "active",
      button.dataset.category === currentCategory
    );
  });
}
function refresh() {
  saveTasks();
  renderTasks();
  renderHistory();
  updateAnalytics();
}

taskForm.addEventListener("submit", (event) => {
  event.preventDefault();

  const title = taskTitle.value.trim();
  if (!title) {
    taskTitle.focus();
    return;
  }

  tasks.unshift({
    id: makeId(),
    title,
    category: taskCategory.value,
    priority: taskPriority.value,
    due: taskDue.value,
    completed: false,
    createdAt: Date.now(),
    completedAt: null
  });

  refresh();
  taskForm.reset();
  taskCategory.value = "Work";
  taskPriority.value = "medium";
  taskTitle.focus();
});

function showCelebration(taskName) {
  previousFocus = document.activeElement;

  $("#celebrationTitle").textContent = "Cheers! You did it! 🎉";

  $("#celebrationMessage").textContent =
    `"${taskName}" is complete! Every little win counts. Keep going!`;

  confettiLayer.replaceChildren();

  const colors = [
    "#FF7668",
    "#FFB36B",
    "#FFD85A",
    "#28B8A5"
  ];

  for (let i = 0; i < 85; i++) {
    const piece = document.createElement("span");

    piece.className = "confetti";
    piece.style.left = `${Math.random() * 100}%`;
    piece.style.backgroundColor = colors[i % colors.length];

    piece.style.setProperty(
      "--fall-duration",
      `${2 + Math.random() * 2.5}s`
    );

    piece.style.setProperty(
      "--delay",
      `${Math.random() * 0.8}s`
    );

    piece.style.setProperty(
      "--drift",
      `${Math.random() * 180 - 90}px`
    );

    confettiLayer.appendChild(piece);
  }

  celebration.hidden = false;
  celebration.classList.add("show");

  $("#celebrationOkay").focus();
}

function closeCelebration() {
  celebration.hidden = true;
  celebration.classList.remove("show");

  confettiLayer.replaceChildren();

  if (previousFocus && typeof previousFocus.focus === "function") {
    previousFocus.focus();
  }
}

function openEditDialog(task) {
  editingTaskId = task.id;
  $("#editTitle").value = task.title;
  $("#editCategory").value = task.category;
  $("#editPriority").value = task.priority;
  $("#editDue").value = task.due || "";

  if (typeof editDialog.showModal === "function") {
    editDialog.showModal();
    $("#editTitle").focus();
  } else {
    alert("Your browser doesn't support the edit dialog.");
  }
}

$("#editForm").addEventListener("submit", (event) => {
  event.preventDefault();

  const task = tasks.find((item) => item.id === editingTaskId);
  if (!task) return;

  const title = $("#editTitle").value.trim();
  if (!title) return;

  task.title = title;
  task.category = $("#editCategory").value;
  task.priority = $("#editPriority").value;
  task.due = $("#editDue").value;

  refresh();
  editDialog.close();
  editingTaskId = null;
});

function closeEditDialog() {
  editDialog.close();
  editingTaskId = null;
}

$("#closeEdit").addEventListener("click", closeEditDialog);
$("#cancelEdit").addEventListener("click", closeEditDialog);

editDialog.addEventListener("click", (event) => {
  if (event.target === editDialog) closeEditDialog();
});

$("#clearCompleted").addEventListener("click", () => {
  const completedCount = tasks.filter((task) => task.completed).length;

  if (!completedCount) {
    alert("No completed tasks to clear yet.");
    return;
  }

  if (confirm(`Remove all ${completedCount} completed task(s)?`)) {
    tasks = tasks.filter((task) => !task.completed);
    refresh();
  }
});

document.querySelectorAll("[data-filter]").forEach((button) => {
  button.addEventListener("click", () => {
    currentFilter = button.dataset.filter;
    currentCategory = "";
    renderTasks();
  });
});

document.querySelectorAll("[data-category]").forEach((button) => {
  button.addEventListener("click", () => {
    const category = button.dataset.category;
    currentCategory = currentCategory === category ? "" : category;
    currentFilter = "all";
    renderTasks();
  });
});

searchInput.addEventListener("input", renderTasks);

// Celebration popup and confetti
function showCelebration(taskName) {
  previousFocus = document.activeElement;

  $("#celebrationTitle").textContent = "Cheers! You did it! 🎉";

  $("#celebrationMessage").textContent =
    `"${taskName}" is complete! Every little win counts!`;

  confettiLayer.replaceChildren();

  const colors = [
    "#FF7668",
    "#FFB36B",
    "#FFD85A",
    "#28B8A5"
  ];

  for (let i = 0; i < 85; i++) {
    const piece = document.createElement("span");

    piece.className = "confetti";
    piece.style.left = `${Math.random() * 100}%`;
    piece.style.backgroundColor = colors[i % colors.length];

    piece.style.setProperty("--fall-duration", "3s");
    piece.style.setProperty("--delay", `${Math.random() * 0.5}s`);
    piece.style.setProperty("--drift", `${Math.random() * 180 - 90}px`);

    confettiLayer.appendChild(piece);
  }

  // Force popup to become visible
  celebration.hidden = false;
  celebration.style.display = "flex";
  celebration.classList.add("show");

  $("#celebrationOkay").focus();

  console.log("Celebration opened:", celebration.hidden, getComputedStyle(celebration).display);
}
function closeCelebration() {
  celebration.classList.remove("show");
  celebration.hidden = true;
  celebration.style.display = "none";

  confettiLayer.replaceChildren();

  if (previousFocus && typeof previousFocus.focus === "function") {
    previousFocus.focus();
  }
}

// TASK COMPLETION
taskList.addEventListener("change", (event) => {
  if (!event.target.matches(".task-check")) return;

  const card = event.target.closest(".task-item");
  const task = tasks.find(item => item.id === card?.dataset.id);

  if (!task) return;

  if (event.target.checked && !task.completed) {
    task.completed = true;
    task.completedAt = new Date().toISOString();

    addToHistory(task);
    refresh();
    showCelebration(task.title);

  } else if (!event.target.checked && task.completed) {
    task.completed = false;
    task.completedAt = null;

    removeFromHistory(task.id);
    refresh();
  }
});


// EDIT AND DELETE TASKS
taskList.addEventListener("click", (event) => {
  const editButton = event.target.closest(".edit-task");
  const deleteButton = event.target.closest(".delete-task");

  if (!editButton && !deleteButton) return;

  const card = event.target.closest(".task-item");
  const task = tasks.find(item => item.id === card?.dataset.id);

  if (!task) return;

  if (editButton) {
    openEditDialog(task);
    return;
  }

  if (deleteButton) {
    if (!confirm(`Delete "${task.title}"?`)) return;

    registerUndo(task);
    tasks = tasks.filter(item => item.id !== task.id);

    refresh();
  }
});

$("#closeCelebration").addEventListener("click", closeCelebration);
$("#celebrationOkay").addEventListener("click", closeCelebration);

celebration.addEventListener("click", (event) => {
  if (event.target === celebration) closeCelebration();
});

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && !celebration.hidden) {
    closeCelebration();
  }
});

// Dark / light mode
function setTheme(theme) {
  const isDark = theme === "dark";
  document.body.classList.toggle("dark-mode", isDark);
  $("#themeIcon").textContent = isDark ? "☀" : "☾";
  $("#themeLabel").textContent = isDark ? "Light mode" : "Dark mode";

  try {
    localStorage.setItem(THEME_KEY, isDark ? "dark" : "light");
  } catch {
    // Theme still works for this session if storage is unavailable.
  }
}

$("#themeToggle").addEventListener("click", () => {
  setTheme(document.body.classList.contains("dark-mode") ? "light" : "dark");
});

try {
  setTheme(localStorage.getItem(THEME_KEY) || "light");
} catch {
  setTheme("light");
}

// Today's date in the dashboard
$("#todayDate").textContent = new Date().toLocaleDateString("en-IN", {
  weekday: "long",
  day: "numeric",
  month: "long",
  year: "numeric"
});

// Initial render
renderTasks();

/* ===== TaskFlow: Analytics, Focus Timer, Undo & Backup ===== */

// Weekly productivity analytics
function localDateKey(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function updateAnalytics() {
  // Completed vs pending doughnut chart
  const canvas = document.getElementById("taskStatusChart");
  const summary = document.getElementById("taskStatusSummary");

  const completed = tasks.filter(task => task.completed).length;
  const pending = tasks.length - completed;

  if (summary) {
    summary.textContent =
      `${completed} completed · ${pending} pending · ${tasks.length} total`;
  }

  if (!canvas || typeof Chart === "undefined") {
    return;
  }

  if (window.taskStatusChartInstance) {
    window.taskStatusChartInstance.data.datasets[0].data = [
      completed,
      pending
    ];

    window.taskStatusChartInstance.update();
    return;
  }

  window.taskStatusChartInstance = new Chart(canvas, {
    type: "doughnut",

    data: {
      labels: ["Completed", "Pending"],

      datasets: [{
        data: [completed, pending],
        backgroundColor: ["#22a06b", "#e5a13d"],
        borderWidth: 0,
        hoverOffset: 6
      }]
    },

    options: {
      responsive: true,
      maintainAspectRatio: false,
      cutout: "68%",

      plugins: {
        legend: {
          position: "bottom"
        },

        tooltip: {
          callbacks: {
            label: context =>
              ` ${context.label}: ${context.raw}`
          }
        }
      }
    }
  });
}



// Pomodoro focus timer
let timerMode = "focus";
let timerDuration = 25 * 60;
let timerRemaining = timerDuration;
let timerInterval = null;
let timerRunning = false;

function renderTimer() {
  const minutes = Math.floor(timerRemaining / 60);
  const seconds = timerRemaining % 60;

  $("#timerDisplay").textContent =
    `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;

  const elapsedPercent = timerDuration
    ? ((timerDuration - timerRemaining) / timerDuration) * 100
    : 0;

  $("#timerRing").style.setProperty("--timer-progress", `${elapsedPercent}%`);

  $("#timerStart").textContent = timerRunning
    ? "Ⅱ Pause timer"
    : timerRemaining === 0
      ? "↻ Start again"
      : "▶ Start focus";

  $("#timerStatus").textContent = timerRemaining === 0
    ? "SESSION COMPLETE"
    : timerRunning
      ? (timerMode === "focus" ? "FOCUS IN PROGRESS" : "BREAK IN PROGRESS")
      : "READY WHEN YOU ARE";
}

function stopTimer() {
  if (timerInterval !== null) {
    clearInterval(timerInterval);
    timerInterval = null;
  }
  timerRunning = false;
}

function startTimer() {
  if (timerRunning) {
    stopTimer();
    $("#timerNote").textContent = "Timer paused. Resume whenever you're ready.";
    renderTimer();
    return;
  }

  if (timerRemaining <= 0) {
    timerRemaining = timerDuration;
  }

  timerRunning = true;
  $("#timerNote").textContent = timerMode === "focus"
    ? "One task at a time. Stay focused!"
    : "Relax, stretch, and recharge.";

  renderTimer();

  timerInterval = setInterval(() => {
    timerRemaining -= 1;

    if (timerRemaining <= 0) {
      timerRemaining = 0;
      stopTimer();
      renderTimer();

      $("#timerNote").textContent = timerMode === "focus"
        ? "Focus session complete! Take a short break."
        : "Break complete! You're ready for another session.";

      $("#timerStatus").textContent = "SESSION COMPLETE";

      if ("Notification" in window && Notification.permission === "granted") {
        new Notification(
          timerMode === "focus" ? "Focus session complete!" : "Break time is over!",
          { body: timerMode === "focus"
              ? "Great work. Take a short break."
              : "Ready to get back to your tasks?" }
        );
      } else {
        // Reliable fallback when desktop notifications aren't enabled.
        alert(timerMode === "focus"
          ? "Focus session complete! 🎉 Time for a short break."
          : "Break complete! Ready to focus again?");
      }

      return;
    }

    renderTimer();
  }, 1000);
}

function selectTimerMode(mode, minutes) {
  stopTimer();
  timerMode = mode;
  timerDuration = minutes * 60;
  timerRemaining = timerDuration;

  document.querySelectorAll(".timer-mode-btn").forEach((button) => {
    button.classList.toggle("active", button.dataset.mode === mode);
  });

  $("#timerNote").textContent = mode === "focus"
    ? "Take a deep breath. You've got this."
    : "Step away from the screen for a moment.";

  renderTimer();
}

document.querySelectorAll(".timer-mode-btn").forEach((button) => {
  button.addEventListener("click", () => {
    selectTimerMode(button.dataset.mode, Number(button.dataset.minutes));
  });
});

$("#timerStart").addEventListener("click", startTimer);

$("#timerReset").addEventListener("click", () => {
  stopTimer();
  timerRemaining = timerDuration;
  $("#timerNote").textContent = "Timer reset. Start whenever you're ready.";
  renderTimer();
});

// Optional browser notifications; only request permission after user action.
$("#timerStart").addEventListener("click", () => {
  if ("Notification" in window && Notification.permission === "default") {
    Notification.requestPermission().catch(() => {});
  }
});

renderTimer();

// Undo deleted task
let deletedTaskForUndo = null;
let undoTimeout = null;

function registerUndo(task) {
  deletedTaskForUndo = { ...task };
  $("#undoToast").hidden = false;

  if (undoTimeout !== null) clearTimeout(undoTimeout);

  undoTimeout = setTimeout(() => {
    deletedTaskForUndo = null;
    $("#undoToast").hidden = true;
    undoTimeout = null;
  }, 7000);
}

$("#undoDelete").addEventListener("click", () => {
  if (!deletedTaskForUndo) return;

  // Restore only if the task hasn't already been recreated.
  if (!tasks.some((task) => task.id === deletedTaskForUndo.id)) {
    tasks.unshift(deletedTaskForUndo);
  }

  deletedTaskForUndo = null;
  $("#undoToast").hidden = true;

  if (undoTimeout !== null) clearTimeout(undoTimeout);
  undoTimeout = null;

  refresh();
});

// Export task backup as JSON
$("#exportTasks").addEventListener("click", () => {
  const backup = {
    app: "TaskFlow",
    version: 1,
    exportedAt: new Date().toISOString(),
    tasks
  };

  const blob = new Blob([JSON.stringify(backup, null, 2)], {
    type: "application/json"
  });

  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `taskflow-backup-${localDateKey(new Date())}.json`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
});

// Import task backup
$("#importTasksButton").addEventListener("click", () => {
  $("#importTasksFile").click();
});

$("#importTasksFile").addEventListener("change", async (event) => {
  const file = event.target.files?.[0];
  if (!file) return;

  try {
    if (file.size > 5 * 1024 * 1024) {
      throw new Error("File is too large. Choose a backup under 5 MB.");
    }

    const imported = JSON.parse(await file.text());
    const incomingTasks = Array.isArray(imported)
      ? imported
      : imported?.tasks;

    if (!Array.isArray(incomingTasks)) {
      throw new Error("This file doesn't contain a valid TaskFlow task list.");
    }

    if (incomingTasks.length > 5000) {
      throw new Error("This backup has too many tasks to import.");
    }

    const validTasks = incomingTasks.filter((task) =>
      task &&
      typeof task.title === "string" &&
      task.title.trim().length > 0 &&
      task.title.length <= 120
    ).map((task) => ({
      id: makeId(),
      title: task.title.trim(),
      category: ["Work", "Personal", "Study"].includes(task.category)
        ? task.category : "Personal",
      priority: ["high", "medium", "low"].includes(task.priority)
        ? task.priority : "medium",
      due: typeof task.due === "string" &&
        /^\d{4}-\d{2}-\d{2}$/.test(task.due) ? task.due : "",
      completed: Boolean(task.completed),
      createdAt: Number(task.createdAt) || Date.now(),
      completedAt: task.completed && Number(task.completedAt)
        ? Number(task.completedAt) : null
    }));

    if (!validTasks.length && incomingTasks.length) {
      throw new Error("No valid tasks were found in this backup.");
    }

    const replace = confirm(
      `Import ${validTasks.length} tasks?\n\nOK = replace current tasks\nCancel = keep current tasks and merge`
    );

    if (replace) {
      tasks = validTasks;
    } else {
      // Merge without overwriting existing tasks.
      tasks = [...validTasks, ...tasks];
    }

    currentFilter = "all";
    currentCategory = "";
    searchInput.value = "";
    refresh();

    alert(`Backup imported successfully: ${validTasks.length} tasks.`);
  } catch (error) {
    alert(error instanceof Error ? error.message : "Could not import this backup.");
  } finally {
    event.target.value = "";
  }
});

// Update analytics on first page load too.
updateAnalytics();
