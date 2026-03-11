(() => {
  const STORAGE_KEY = "mintv_programs_v1";
  const SEEDED_KEY = "mintv_seeded_v1";
  const LIVE_WINDOW_MINUTES = 30;

  const WEEKDAYS = [
    { index: 1, name: "Mandag" },
    { index: 2, name: "Tirsdag" },
    { index: 3, name: "Onsdag" },
    { index: 4, name: "Torsdag" },
    { index: 5, name: "Fredag" },
    { index: 6, name: "Lørdag" },
    { index: 0, name: "Søndag" }
  ];

  const elements = {
    todayLabel: document.getElementById("todayLabel"),
    tabs: Array.from(document.querySelectorAll(".tab[data-view]")),
    views: Array.from(document.querySelectorAll(".view[data-view]")),
    todayList: document.getElementById("todayList"),
    todayEmpty: document.getElementById("todayEmpty"),
    weekList: document.getElementById("weekList"),
    quickAdd: document.getElementById("quickAdd"),
    programForm: document.getElementById("programForm"),
    formTitle: document.getElementById("formTitle"),
    name: document.getElementById("name"),
    service: document.getElementById("service"),
    weekday: document.getElementById("weekday"),
    time: document.getElementById("time"),
    link: document.getElementById("link"),
    saveBtn: document.getElementById("saveBtn"),
    cancelEdit: document.getElementById("cancelEdit"),
    deleteFromForm: document.getElementById("deleteFromForm"),
    programCardTemplate: document.getElementById("programCardTemplate")
  };

  let programs = [];
  let editingId = null;

  function getTodayIndex() {
    return new Date().getDay();
  }

  function formatTodayLabel(date) {
    const weekdayName = WEEKDAYS.find((d) => d.index === date.getDay())?.name ?? "";
    const day = String(date.getDate()).padStart(2, "0");
    const month = String(date.getMonth() + 1).padStart(2, "0");
    return `${weekdayName} ${day}.${month}.${date.getFullYear()}`;
  }

  function normalizeTime(value) {
    const match = /^(\d{1,2}):(\d{2})$/.exec(String(value).trim());
    if (!match) return null;
    const hours = Number(match[1]);
    const minutes = Number(match[2]);
    if (!Number.isFinite(hours) || !Number.isFinite(minutes)) return null;
    if (hours < 0 || hours > 23) return null;
    if (minutes < 0 || minutes > 59) return null;
    return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
  }

  function compareByTime(a, b) {
    return String(a.time).localeCompare(String(b.time));
  }

  function readStorage() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) return [];
      return parsed.filter(isProgramLike).map(sanitizeProgram);
    } catch {
      return [];
    }
  }

  function writeStorage(items) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  }

  function isProgramLike(item) {
    if (!item || typeof item !== "object") return false;
    return (
      typeof item.name === "string" &&
      typeof item.service === "string" &&
      (typeof item.weekday === "number" || typeof item.weekday === "string") &&
      typeof item.time === "string" &&
      typeof item.link === "string"
    );
  }

  function sanitizeProgram(item) {
    const weekday = Number(item.weekday);
    const time = normalizeTime(item.time) ?? "00:00";
    return {
      id: typeof item.id === "string" ? item.id : cryptoId(),
      name: String(item.name).trim(),
      service: String(item.service).trim(),
      weekday: Number.isFinite(weekday) ? weekday : 0,
      time,
      link: String(item.link).trim()
    };
  }

  function cryptoId() {
    if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
      return crypto.randomUUID();
    }
    return `${Date.now()}_${Math.random().toString(16).slice(2)}`;
  }

  async function seedFromJsonIfNeeded() {
    const alreadySeeded = localStorage.getItem(SEEDED_KEY) === "1";
    if (alreadySeeded) return;
    if (localStorage.getItem(STORAGE_KEY)) {
      localStorage.setItem(SEEDED_KEY, "1");
      return;
    }

    try {
      const res = await fetch("./data.json", { cache: "no-store" });
      if (!res.ok) throw new Error("fetch_failed");
      const json = await res.json();
      const items = Array.isArray(json?.programs) ? json.programs : [];
      const seeded = items.filter(isProgramLike).map(sanitizeProgram);
      if (seeded.length > 0) {
        writeStorage(seeded);
      }
      localStorage.setItem(SEEDED_KEY, "1");
    } catch {
      localStorage.setItem(SEEDED_KEY, "1");
    }
  }

  function setView(viewName) {
    elements.views.forEach((view) => {
      view.hidden = view.dataset.view !== viewName;
    });
    elements.tabs.forEach((tab) => {
      const isActive = tab.dataset.view === viewName;
      if (isActive) tab.setAttribute("aria-current", "page");
      else tab.removeAttribute("aria-current");
    });
    if (viewName === "add") {
      elements.name.focus();
    }
  }

  function parseHoursMinutes(time) {
    const normalized = normalizeTime(time);
    if (!normalized) return null;
    const [h, m] = normalized.split(":").map(Number);
    return { h, m };
  }

  function isLiveNowForToday(program, now) {
    if (program.weekday !== now.getDay()) return false;
    const parts = parseHoursMinutes(program.time);
    if (!parts) return false;
    const programTime = new Date(now);
    programTime.setHours(parts.h, parts.m, 0, 0);
    const diffMinutes = Math.abs(now.getTime() - programTime.getTime()) / 60000;
    return diffMinutes <= LIVE_WINDOW_MINUTES;
  }

  function renderToday(now = new Date()) {
    const todayIndex = now.getDay();
    const todays = programs.filter((p) => p.weekday === todayIndex).sort(compareByTime);

    elements.todayList.replaceChildren();
    if (todays.length === 0) {
      elements.todayEmpty.hidden = false;
      return;
    }
    elements.todayEmpty.hidden = true;

    const nodes = todays.map((p) => createProgramCard(p, { now, showWeekday: false }));
    elements.todayList.append(...nodes);
  }

  function renderWeek(now = new Date()) {
    elements.weekList.replaceChildren();
    const fragment = document.createDocumentFragment();

    WEEKDAYS.forEach((day) => {
      const section = document.createElement("section");
      section.className = "weekday";
      section.dataset.weekday = String(day.index);

      const title = document.createElement("h2");
      title.className = "weekday__title";
      title.textContent = day.name;

      const list = document.createElement("div");
      list.className = "weekday__list";

      const items = programs.filter((p) => p.weekday === day.index).sort(compareByTime);
      if (items.length === 0) {
        const empty = document.createElement("div");
        empty.className = "empty";
        empty.textContent = "Ingen programmer";
        list.appendChild(empty);
      } else {
        list.append(...items.map((p) => createProgramCard(p, { now, showWeekday: false })));
      }

      section.append(title, list);
      fragment.appendChild(section);
    });

    elements.weekList.appendChild(fragment);
  }

  function createProgramCard(program, { now }) {
    const node = elements.programCardTemplate.content.firstElementChild.cloneNode(true);
    node.dataset.id = program.id;

    node.querySelector(".card__time").textContent = program.time;
    node.querySelector(".card__title").textContent = program.name;
    node.querySelector(".card__meta").textContent = program.service;

    const badge = node.querySelector(".badge");
    badge.hidden = !isLiveNowForToday(program, now);

    const startBtn = node.querySelector('[data-action="start"]');
    startBtn.addEventListener("click", () => {
      openLink(program.link);
    });

    const editBtn = node.querySelector('[data-action="edit"]');
    editBtn.addEventListener("click", () => {
      startEdit(program.id);
    });

    const deleteBtn = node.querySelector('[data-action="delete"]');
    deleteBtn.addEventListener("click", () => {
      deleteProgram(program.id);
    });

    return node;
  }

  function openLink(url) {
    const link = String(url ?? "").trim();
    if (!link) return;
    window.open(link, "_blank", "noopener");
  }

  function fillWeekdayOptions() {
    elements.weekday.replaceChildren();
    WEEKDAYS.forEach((d) => {
      const option = document.createElement("option");
      option.value = String(d.index);
      option.textContent = d.name;
      elements.weekday.appendChild(option);
    });
  }

  function resetForm() {
    editingId = null;
    elements.programForm.reset();
    elements.formTitle.textContent = "Legg til program";
    elements.saveBtn.textContent = "Lagre";
    elements.cancelEdit.hidden = true;
    elements.deleteFromForm.hidden = true;
  }

  function startEdit(id) {
    const program = programs.find((p) => p.id === id);
    if (!program) return;

    editingId = id;
    elements.formTitle.textContent = "Rediger program";
    elements.saveBtn.textContent = "Oppdater";
    elements.cancelEdit.hidden = false;
    elements.deleteFromForm.hidden = false;

    elements.name.value = program.name;
    elements.service.value = program.service;
    elements.weekday.value = String(program.weekday);
    elements.time.value = program.time;
    elements.link.value = program.link;

    setView("add");
  }

  function deleteProgram(id) {
    const program = programs.find((p) => p.id === id);
    if (!program) return;
    const ok = window.confirm(`Slette "${program.name}"?`);
    if (!ok) return;

    programs = programs.filter((p) => p.id !== id);
    writeStorage(programs);
    if (editingId === id) resetForm();
    rerenderAll();
  }

  function upsertProgramFromForm() {
    const name = String(elements.name.value).trim();
    const service = String(elements.service.value).trim();
    const weekday = Number(elements.weekday.value);
    const time = normalizeTime(elements.time.value);
    const link = String(elements.link.value).trim();

    if (!name || !service || !Number.isFinite(weekday) || !time || !link) return;

    const next = {
      id: editingId ?? cryptoId(),
      name,
      service,
      weekday,
      time,
      link
    };

    const existingIndex = programs.findIndex((p) => p.id === next.id);
    if (existingIndex >= 0) {
      programs = programs.map((p) => (p.id === next.id ? next : p));
    } else {
      programs = [...programs, next];
    }

    writeStorage(programs);
    resetForm();
    rerenderAll();
    setView("today");
  }

  function rerenderAll() {
    const now = new Date();
    elements.todayLabel.textContent = formatTodayLabel(now);
    renderToday(now);
    renderWeek(now);
  }

  function setupTabs() {
    const tabRow = document.querySelector(".tabs");
    tabRow.addEventListener("keydown", (e) => {
      if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
      const currentIndex = elements.tabs.findIndex((t) => t === document.activeElement);
      if (currentIndex < 0) return;
      e.preventDefault();
      const dir = e.key === "ArrowRight" ? 1 : -1;
      const nextIndex = (currentIndex + dir + elements.tabs.length) % elements.tabs.length;
      elements.tabs[nextIndex].focus();
    });

    elements.tabs.forEach((tab) => {
      tab.addEventListener("click", () => setView(tab.dataset.view));
    });

    elements.quickAdd.addEventListener("click", () => {
      resetForm();
      setView("add");
    });
  }

  function setupForm() {
    elements.programForm.addEventListener("submit", (e) => {
      e.preventDefault();
      upsertProgramFromForm();
    });

    elements.cancelEdit.addEventListener("click", () => {
      resetForm();
      setView("today");
    });

    elements.deleteFromForm.addEventListener("click", () => {
      if (!editingId) return;
      deleteProgram(editingId);
      setView("today");
    });
  }

  function startLiveTicker() {
    setInterval(() => {
      rerenderAll();
    }, 30000);
  }

  async function init() {
    fillWeekdayOptions();
    elements.weekday.value = String(getTodayIndex());
    setupTabs();
    setupForm();

    await seedFromJsonIfNeeded();
    programs = readStorage();
    rerenderAll();
    startLiveTicker();
    setView("today");
  }

  init();
})();
