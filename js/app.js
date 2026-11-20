(function () {
  "use strict";

  /* =========================================================
     Storage helpers (localStorage)
     ========================================================= */
  var KEYS = {
    tasks: "tdl.tasks",
    links: "tdl.links",
    name: "tdl.name",
    theme: "tdl.theme",
  };

  function load(key, fallback) {
    try {
      var raw = localStorage.getItem(key);
      return raw === null ? fallback : JSON.parse(raw);
    } catch (err) {
      return fallback;
    }
  }
  function store(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch (err) { /* ignore quota errors */ }
  }
  function uid() {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  }

  /* =========================================================
     Theme (Light / Dark)
     ========================================================= */
  var themeToggle = document.getElementById("themeToggle");

  function applyTheme(theme) {
    document.documentElement.setAttribute("data-theme", theme);
    store(KEYS.theme, theme);
  }

  (function initTheme() {
    var saved = load(KEYS.theme, null);
    if (!saved) {
      var prefersDark =
        window.matchMedia &&
        window.matchMedia("(prefers-color-scheme: dark)").matches;
      saved = prefersDark ? "dark" : "light";
    }
    applyTheme(saved);
  })();

  themeToggle.addEventListener("click", function () {
    var current = document.documentElement.getAttribute("data-theme");
    applyTheme(current === "dark" ? "light" : "dark");
  });

  /* =========================================================
     Clock, Date & Greeting
     ========================================================= */
  var clockTime = document.getElementById("clockTime");
  var dateText = document.getElementById("dateText");
  var greetingWord = document.getElementById("greetingWord");

  function pad(n) { return n.toString().padStart(2, "0"); }

  function getGreeting(h) {
    if (h >= 5 && h < 12) return "Good Morning";
    if (h >= 12 && h < 17) return "Good Afternoon";
    if (h >= 17 && h < 21) return "Good Evening";
    return "Good Night";
  }

  function refreshTimeDate() {
    var now = new Date();
    clockTime.textContent =
      pad(now.getHours()) + ":" + pad(now.getMinutes()) + ":" + pad(now.getSeconds());
    dateText.textContent = now.toLocaleDateString("en-US", {
      weekday: "long",
      month: "long",
      day: "numeric",
      year: "numeric",
    });
    greetingWord.textContent = getGreeting(now.getHours());
  }

  refreshTimeDate();
  setInterval(refreshTimeDate, 1000);

  /* =========================================================
     Custom Name in Greeting
     ========================================================= */
  var nameDisplay = document.getElementById("nameDisplay");
  var nameInput = document.getElementById("nameInput");
  var editNameBtn = document.getElementById("editNameBtn");
  var userName = load(KEYS.name, "") || "";

  function renderName() {
    nameDisplay.textContent = userName.trim() || "Friend";
  }

  function startEditName() {
    nameDisplay.classList.add("hidden");
    editNameBtn.classList.add("hidden");
    nameInput.classList.remove("hidden");
    nameInput.value = userName;
    nameInput.focus();
    nameInput.select();
  }

  function commitName() {
    userName = nameInput.value.trim().slice(0, 24);
    store(KEYS.name, userName);
    renderName();
    nameInput.classList.add("hidden");
    nameDisplay.classList.remove("hidden");
    editNameBtn.classList.remove("hidden");
  }

  function cancelEditName() {
    nameInput.classList.add("hidden");
    nameDisplay.classList.remove("hidden");
    editNameBtn.classList.remove("hidden");
  }

  nameDisplay.addEventListener("click", startEditName);
  editNameBtn.addEventListener("click", startEditName);
  nameInput.addEventListener("keydown", function (e) {
    if (e.key === "Enter") { e.preventDefault(); commitName(); }
    else if (e.key === "Escape") { e.preventDefault(); cancelEditName(); }
  });
  nameInput.addEventListener("blur", commitName);
  renderName();

  /* =========================================================
     Focus Timer (Pomodoro) + Web Audio notification
     ========================================================= */
  var timerDisplay = document.getElementById("timerDisplay");
  var timerStartBtn = document.getElementById("timerStart");
  var timerStopBtn = document.getElementById("timerStop");
  var timerResetBtn = document.getElementById("timerReset");
  var timerHint = document.getElementById("timerHint");

  var TOTAL_SECONDS = 25 * 60;
  var remaining = TOTAL_SECONDS;
  var timerId = null;
  var running = false;
  var audioCtx = null;

  function formatTime(sec) {
    return pad(Math.floor(sec / 60)) + ":" + pad(sec % 60);
  }
  function renderTimer() { timerDisplay.textContent = formatTime(remaining); }

  function ensureAudio() {
    if (!audioCtx) {
      try {
        audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      } catch (err) { audioCtx = null; }
    }
    if (audioCtx && audioCtx.state === "suspended") { audioCtx.resume(); }
    return audioCtx;
  }

  function playBeep() {
    var ctx = ensureAudio();
    if (!ctx) return;
    var now = ctx.currentTime;
    // Three short beeps so the end of the session is unmistakable.
    [0, 0.28, 0.56].forEach(function (delay) {
      var osc = ctx.createOscillator();
      var gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.value = 880;
      osc.connect(gain);
      gain.connect(ctx.destination);
      var t = now + delay;
      gain.gain.setValueAtTime(0, t);
      gain.gain.linearRampToValueAtTime(0.3, t + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.22);
      osc.start(t);
      osc.stop(t + 0.24);
    });
  }

  function tick() {
    remaining -= 1;
    renderTimer();
    if (remaining <= 0) {
      stopTimer();
      playBeep();
      timerHint.textContent = "Time is up! Take a short break.";
    }
  }

  function startTimer() {
    if (running) return;
    ensureAudio(); // unlock audio on user gesture
    running = true;
    timerId = setInterval(tick, 1000);
    timerHint.textContent = "Stay focused. You can do it!";
  }

  function stopTimer() {
    var wasRunning = running;
    if (timerId) { clearInterval(timerId); timerId = null; }
    running = false;
    if (wasRunning && remaining < TOTAL_SECONDS) {
      timerHint.textContent = "Paused. Press Start to continue.";
    }
  }

  function resetTimer() {
    stopTimer();
    remaining = TOTAL_SECONDS;
    renderTimer();
    timerHint.textContent = "Ready when you are.";
  }

  timerStartBtn.addEventListener("click", startTimer);
  timerStopBtn.addEventListener("click", stopTimer);
  timerResetBtn.addEventListener("click", resetTimer);
  renderTimer();

  /* =========================================================
     Shared inline message (used by tasks & links)
     ========================================================= */
  function showMessage(el, text, type) {
    el.textContent = text;
    el.className = "task-message show " + (type || "");
    clearTimeout(el._timer);
    el._timer = setTimeout(function () {
      el.className = "task-message";
    }, 2600);
  }

  /* =========================================================
     Tasks
     ========================================================= */
  var taskForm = document.getElementById("taskForm");
  var taskInput = document.getElementById("taskInput");
  var taskList = document.getElementById("taskList");
  var taskMessage = document.getElementById("taskMessage");

  var tasks = load(KEYS.tasks, []);
  if (!Array.isArray(tasks)) tasks = [];
  tasks = tasks.map(function (t) {
    return {
      id: t.id || uid(),
      text: typeof t.text === "string" ? t.text : "",
      done: !!t.done,
    };
  });

  function saveTasks() { store(KEYS.tasks, tasks); }
  function showTaskMessage(text, type) { showMessage(taskMessage, text, type); }

  function isDuplicate(text, excludeId) {
    var low = text.toLowerCase();
    return tasks.some(function (t) {
      return t.id !== excludeId && t.text.toLowerCase() === low;
    });
  }

  function makeTaskSpan(task) {
    var span = document.createElement("span");
    span.className = "task-text";
    span.textContent = task.text;
    span.addEventListener("dblclick", function () { startEditTask(task.id); });
    return span;
  }

  function renderTasks() {
    taskList.innerHTML = "";
    if (tasks.length === 0) {
      var empty = document.createElement("li");
      empty.className = "task-empty";
      empty.textContent = "No tasks yet. Add one above!";
      taskList.appendChild(empty);
      return;
    }
    tasks.forEach(function (task) {
      var li = document.createElement("li");
      li.className = "task-item" + (task.done ? " done" : "");
      li.dataset.id = task.id;

      var check = document.createElement("input");
      check.type = "checkbox";
      check.checked = task.done;
      check.className = "task-check";
      check.addEventListener("change", function () { toggleTask(task.id); });

      var span = makeTaskSpan(task);

      var editBtn = document.createElement("button");
      editBtn.className = "icon-btn";
      editBtn.type = "button";
      editBtn.title = "Edit task";
      editBtn.textContent = "\u270E";
      editBtn.addEventListener("click", function () { startEditTask(task.id); });

      var delBtn = document.createElement("button");
      delBtn.className = "icon-btn danger";
      delBtn.type = "button";
      delBtn.title = "Delete task";
      delBtn.textContent = "\u2715";
      delBtn.addEventListener("click", function () { deleteTask(task.id); });

      var actions = document.createElement("div");
      actions.className = "task-actions";
      actions.appendChild(editBtn);
      actions.appendChild(delBtn);

      li.appendChild(check);
      li.appendChild(span);
      li.appendChild(actions);
      taskList.appendChild(li);
    });
  }

  function addTask(text) {
    var trimmed = text.trim();
    if (!trimmed) { showTaskMessage("Please type a task first.", "warn"); return false; }
    if (isDuplicate(trimmed)) { showTaskMessage("That task already exists.", "warn"); return false; }
    tasks.push({ id: uid(), text: trimmed, done: false });
    saveTasks();
    renderTasks();
    showTaskMessage("Task added.", "ok");
    return true;
  }

  function toggleTask(id) {
    var t = tasks.find(function (x) { return x.id === id; });
    if (!t) return;
    t.done = !t.done;
    saveTasks();
    var li = taskList.querySelector('[data-id="' + id + '"]');
    if (li) li.classList.toggle("done", t.done);
  }

  function deleteTask(id) {
    tasks = tasks.filter(function (t) { return t.id !== id; });
    saveTasks();
    renderTasks();
    showTaskMessage("Task deleted.", "ok");
  }

  function startEditTask(id) {
    var task = tasks.find(function (t) { return t.id === id; });
    if (!task) return;
    var li = taskList.querySelector('[data-id="' + id + '"]');
    if (!li || li.querySelector(".task-edit-input")) return;
    var span = li.querySelector(".task-text");
    if (!span) return;

    var input = document.createElement("input");
    input.type = "text";
    input.className = "task-edit-input";
    input.value = task.text;
    input.maxLength = 120;
    span.replaceWith(input);
    input.focus();
    input.select();

    var committed = false;

    function restore(text) {
      var fresh = makeTaskSpan({ id: id, text: text });
      input.replaceWith(fresh);
    }
    function commit() {
      if (committed) return;
      committed = true;
      var val = input.value.trim();
      if (!val) {
        showTaskMessage("Task cannot be empty.", "warn");
        restore(task.text);
        return;
      }
      if (val.toLowerCase() !== task.text.toLowerCase() && isDuplicate(val, id)) {
        showTaskMessage("Another task already has that name.", "warn");
        restore(task.text);
        return;
      }
      task.text = val;
      saveTasks();
      restore(val);
      showTaskMessage("Task updated.", "ok");
    }
    function cancel() {
      if (committed) return;
      committed = true;
      restore(task.text);
    }

    input.addEventListener("keydown", function (e) {
      if (e.key === "Enter") { e.preventDefault(); commit(); }
      else if (e.key === "Escape") { e.preventDefault(); cancel(); }
    });
    input.addEventListener("blur", commit);
  }

  taskForm.addEventListener("submit", function (e) {
    e.preventDefault();
    if (addTask(taskInput.value)) { taskInput.value = ""; }
    taskInput.focus();
  });

  renderTasks();

  /* =========================================================
     Quick Links
     ========================================================= */
  var linkForm = document.getElementById("linkForm");
  var linkName = document.getElementById("linkName");
  var linkUrl = document.getElementById("linkUrl");
  var linkList = document.getElementById("linkList");
  var linksMessage = document.getElementById("linksMessage");

  var links = load(KEYS.links, []);
  if (!Array.isArray(links)) links = [];
  links = links.map(function (l) {
    return { id: l.id || uid(), name: String(l.name || ""), url: String(l.url || "") };
  });

  function saveLinks() { store(KEYS.links, links); }
  function showLinksMessage(text, type) { showMessage(linksMessage, text, type); }

  function ensureHttp(url) {
    if (/^https?:\/\//i.test(url)) return url;
    return "https://" + url;
  }

  function addLink(name, url) {
    var n = name.trim();
    var u = url.trim();
    if (!n || !u) { showLinksMessage("Please fill in both name and URL.", "warn"); return false; }
    var finalUrl = ensureHttp(u);
    var valid = true;
    try { new URL(finalUrl); } catch (err) { valid = false; }
    if (!valid) { showLinksMessage("That URL looks invalid.", "warn"); return false; }
    links.push({ id: uid(), name: n, url: finalUrl });
    saveLinks();
    renderLinks();
    showLinksMessage("Link added.", "ok");
    return true;
  }

  function deleteLink(id) {
    links = links.filter(function (l) { return l.id !== id; });
    saveLinks();
    renderLinks();
  }

  function renderLinks() {
    linkList.innerHTML = "";
    if (links.length === 0) {
      var empty = document.createElement("p");
      empty.className = "links-empty";
      empty.textContent = "No quick links yet. Add your favorites!";
      linkList.appendChild(empty);
      return;
    }
    links.forEach(function (l) {
      var chip = document.createElement("div");
      chip.className = "link-chip";

      var a = document.createElement("a");
      a.href = l.url;
      a.target = "_blank";
      a.rel = "noopener noreferrer";
      a.title = l.url;
      a.textContent = l.name;

      var del = document.createElement("button");
      del.className = "link-remove";
      del.type = "button";
      del.title = "Remove link";
      del.setAttribute("aria-label", "Remove link");
      del.textContent = "\u00D7";
      del.addEventListener("click", function () { deleteLink(l.id); });

      chip.appendChild(a);
      chip.appendChild(del);
      linkList.appendChild(chip);
    });
  }

  linkForm.addEventListener("submit", function (e) {
    e.preventDefault();
    if (addLink(linkName.value, linkUrl.value)) {
      linkName.value = "";
      linkUrl.value = "";
    }
    linkName.focus();
  });

  renderLinks();
})();
