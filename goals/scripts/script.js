import { toast } from './utils.js';
import { exportData, importData } from './io.js';

const $ = x => document.getElementById(x);

const COLORS = [
    { bg: "#EEEDFE", fill: "#7F77DD" }, { bg: "#E1F5EE", fill: "#1D9E75" }, { bg: "#FAECE7", fill: "#D85A30" },
    { bg: "#E6F1FB", fill: "#378ADD" }, { bg: "#FAEEDA", fill: "#BA7517" }, { bg: "#FBEAF0", fill: "#D4537E" },
    { bg: "#EAF3DE", fill: "#639922" }, { bg: "#F1EFE8", fill: "#888780" }, { bg: "#FCEBEB", fill: "#E24B4A" }
];

const DARK_COLORS = [
    { bg: "#2a2850", fill: "#a89ef0" }, { bg: "#0e2e22", fill: "#34c98a" }, { bg: "#2e1a10", fill: "#f07548" },
    { bg: "#102340", fill: "#62aaf0" }, { bg: "#2a1e04", fill: "#e09a30" }, { bg: "#2a1020", fill: "#e87aaa" },
    { bg: "#182b08", fill: "#88cc30" }, { bg: "#242420", fill: "#b0aea8" }, { bg: "#2e1010", fill: "#f07070" }
];

const AVAILABLE_ICONS = [
    "ti-book", "ti-math-symbols", "ti-atom", "ti-code", "ti-brand-python",
    "ti-terminal", "ti-brain", "ti-world", "ti-language", "ti-device-laptop",
    "ti-school", "ti-rocket", "ti-trophy", "ti-target", "ti-heart",
    "ti-music", "ti-palette", "ti-camera", "ti-dumbbell", "ti-plane"
];

// ── State ────────────────────────────────────────────────────────────────────

let stored;
try { stored = JSON.parse(localStorage.getItem("goals_v2")); } catch (e) { }

export let data = stored ? stored.data : [];
let openCats = new Set(stored ? stored.openCats : []);
let showNotes = new Set(stored ? stored.showNotes : []);

// Migrate old data
data.forEach(cat => {
    if (!cat.notes) cat.notes = "";
    cat.tasks.forEach(t => {
        if (!t.priority) t.priority = "";
        if (!t.deadline) t.deadline = "";
    });
});

function save() {
    try {
        localStorage.setItem("goals_v2", JSON.stringify({
            data,
            openCats: [...openCats],
            showNotes: [...showNotes]
        }));
    } catch (e) { console.warn("Save failed", e); }
}

// ── Dark mode ────────────────────────────────────────────────────────────────

let darkMode = localStorage.getItem("goals_dark") === "true" ||
    (localStorage.getItem("goals_dark") === null && window.matchMedia("(prefers-color-scheme: dark)").matches);

function applyDark() {
    document.documentElement.classList.toggle("dark", darkMode);
    $("darkToggle").querySelector("i").className = "ti " + (darkMode ? "ti-sun" : "ti-moon");
}

$("darkToggle").onclick = () => {
    darkMode = !darkMode;
    localStorage.setItem("goals_dark", darkMode);
    applyDark();
};

applyDark();

// ── Helpers ──────────────────────────────────────────────────────────────────

function getColors(ci) {
    return darkMode ? DARK_COLORS[ci % DARK_COLORS.length] : COLORS[ci % COLORS.length];
}

function deadlineStatus(dl) {
    if (!dl) return null;
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const d = new Date(dl);
    const diff = Math.round((d - today) / 86400000);
    if (diff < 0) return { cls: "overdue", label: `${Math.abs(diff)}d late` };
    if (diff === 0) return { cls: "soon", label: "Today" };
    if (diff <= 3) return { cls: "soon", label: `${diff}d left` };
    return { cls: "", label: d.toLocaleDateString("id-ID", { day: "numeric", month: "short" }) };
}

function esc(str) {
    return String(str).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

// ── Icon modal ───────────────────────────────────────────────────────────────

function modalIcon() {
    const modal = $("modalIcon");
    modal.style.display = "flex";
    const container = $("iconContainer");
    container.innerHTML = "";
    AVAILABLE_ICONS.forEach(icon => {
        const btn = document.createElement("button");
        btn.className = "icon-option";
        btn.innerHTML = `<i class="ti ${icon}"></i>`;
        btn.title = icon.replace("ti-", "");
        btn.onclick = () => {
            $("catIconSelector").className = "ti " + icon;
            modal.style.display = "none";
        };
        container.appendChild(btn);
    });
    modal.onclick = e => { if (e.target === modal) modal.style.display = "none"; };
}

// ── Category actions ─────────────────────────────────────────────────────────

function toggleAddCat() {
    const row = $("addCatRow");
    row.classList.toggle("visible");
    if (row.classList.contains("visible")) $("catInput").focus();
}

function cancelAddCat() {
    $("addCatRow").classList.remove("visible");
    $("catIconSelector").className = "ti ti-mood-edit";
    $("catInput").value = "";
}

function addCat() {
    const v = $("catInput").value.trim();
    if (!v) { $("catInput").focus(); return; }
    const icon = $("catIconSelector").className.split(" ")[1] || "ti-target";
    data.push({ icon, title: v, notes: "", tasks: [] });
    const newIdx = data.length - 1;
    openCats.add(newIdx);
    $("catIconSelector").className = "ti ti-mood-edit";
    $("catInput").value = "";
    $("addCatRow").classList.remove("visible");
    save(); render();
    toast("Category added!", "success");
}

function toggleCat(i) {
    openCats.has(i) ? openCats.delete(i) : openCats.add(i);
    save(); render();
}

function deleteCat(ci) {
    if (!confirm(`Delete category "${data[ci].title}"?`)) return;
    data.splice(ci, 1);
    openCats = new Set([...openCats].filter(x => x !== ci).map(x => x > ci ? x - 1 : x));
    showNotes = new Set([...showNotes].filter(x => x !== ci).map(x => x > ci ? x - 1 : x));
    save(); render();
    toast("Category deleted.");
}

function toggleNotes(ci, e) {
    e.stopPropagation();
    showNotes.has(ci) ? showNotes.delete(ci) : showNotes.add(ci);
    save(); render();
}

function saveNote(ci, val) {
    data[ci].notes = val;
    save();
}

// ── Task actions ─────────────────────────────────────────────────────────────

function toggleTask(ci, ti) {
    data[ci].tasks[ti].done = !data[ci].tasks[ti].done;
    save(); render();
}

function deleteTask(ci, ti) {
    data[ci].tasks.splice(ti, 1);
    save(); render();
}

function addTask(ci) {
    const input = $("add_" + ci);
    const dateInput = $("addDate_" + ci);
    const prioInput = $("addPrio_" + ci);
    const v = input.value.trim();
    if (!v) { input.focus(); return; }
    data[ci].tasks.push({ t: v, done: false, priority: prioInput.value, deadline: dateInput.value });
    input.value = ""; dateInput.value = ""; prioInput.value = "";
    save(); render();
    setTimeout(() => { const el = $("add_" + ci); if (el) el.focus(); }, 50);
}

// ── Task modal ───────────────────────────────────────────────────────────────

let _editCi = -1, _editTi = -1;

function openTaskModal(ci, ti, e) {
    e.stopPropagation();
    _editCi = ci; _editTi = ti;
    const t = data[ci].tasks[ti];
    $("modalTaskName").value = t.t;
    $("modalPriority").value = t.priority || "";
    $("modalDeadline").value = t.deadline || "";
    $("taskModal").classList.add("show");
    setTimeout(() => $("modalTaskName").focus(), 50);
}

function closeTaskModal() { $("taskModal").classList.remove("show"); }

function saveTaskModal() {
    const t = data[_editCi].tasks[_editTi];
    const name = $("modalTaskName").value.trim();
    if (name) t.t = name;
    t.priority = $("modalPriority").value;
    t.deadline = $("modalDeadline").value;
    closeTaskModal(); save(); render();
    toast("Goal updated!", "success");
}

$("taskModal").addEventListener("click", e => { if (e.target === $("taskModal")) closeTaskModal(); });
$("taskModal").addEventListener("keydown", e => { if (e.key === "Escape") closeTaskModal(); });

// ── Drag: categories ─────────────────────────────────────────────────────────

let dragSrcCat = null;

function catDragStart(e, ci) {
    dragSrcCat = ci;
    e.dataTransfer.effectAllowed = "move";
    e.currentTarget.classList.add("dragging");
}

function catDragOver(e, ci) {
    e.preventDefault();
    document.querySelectorAll(".cat-card").forEach(c => c.classList.remove("drag-over"));
    e.currentTarget.classList.add("drag-over");
}

function catDrop(e, ci) {
    e.preventDefault();
    document.querySelectorAll(".cat-card").forEach(c => {
        c.classList.remove("drag-over");
        c.classList.remove("dragging");
    });
    if (dragSrcCat === null || dragSrcCat === ci) return;
    const moved = data.splice(dragSrcCat, 1)[0];
    data.splice(ci, 0, moved);
    function remap(set, from, to) {
        return new Set([...set].map(x => {
            if (x === from) return to > from ? to - 1 : to;
            if (from < to && x > from && x <= to) return x - 1;
            if (from > to && x >= to && x < from) return x + 1;
            return x;
        }));
    }
    openCats = remap(openCats, dragSrcCat, ci);
    showNotes = remap(showNotes, dragSrcCat, ci);
    dragSrcCat = null;
    save(); render();
}

function catDragEnd() {
    document.querySelectorAll(".cat-card").forEach(c => {
        c.classList.remove("dragging");
        c.classList.remove("drag-over");
    });
}

// ── Drag: tasks ───────────────────────────────────────────────────────────────

let dragSrcTask = null, dragSrcTaskCat = null;

function taskDragStart(e, ci, ti) {
    e.stopPropagation();
    dragSrcTask = ti; dragSrcTaskCat = ci;
    e.dataTransfer.effectAllowed = "move";
}

function taskDragOver(e, ci, ti) { e.preventDefault(); e.stopPropagation(); }

function taskDrop(e, ci, ti) {
    e.preventDefault(); e.stopPropagation();
    if (dragSrcTaskCat !== ci || dragSrcTask === null || dragSrcTask === ti) return;
    const moved = data[ci].tasks.splice(dragSrcTask, 1)[0];
    data[ci].tasks.splice(ti, 0, moved);
    dragSrcTask = null; dragSrcTaskCat = null;
    save(); render();
}

// ── Render ───────────────────────────────────────────────────────────────────

function render() {
    const q = ($("searchInput").value || "").toLowerCase();
    const totalTasks = data.reduce((a, c) => a + c.tasks.length, 0);
    const doneTasks = data.reduce((a, c) => a + c.tasks.filter(t => t.done).length, 0);
    const overdueCount = data.reduce((a, c) =>
        a + c.tasks.filter(t => !t.done && t.deadline && deadlineStatus(t.deadline)?.cls === "overdue").length, 0);
    const pct = totalTasks ? Math.round(doneTasks / totalTasks * 100) : 0;

    $("statsRow").innerHTML =
        `<div class="stat-card"><div class="num">${data.length}</div><div class="lbl">Categories</div></div>` +
        `<div class="stat-card"><div class="num">${totalTasks}</div><div class="lbl">Total goals</div></div>` +
        `<div class="stat-card"><div class="num">${doneTasks}</div><div class="lbl">Completed</div></div>` +
        `<div class="stat-card"><div class="num">${pct}%</div><div class="lbl">Progress</div></div>` +
        `<div class="stat-card"><div class="num" style="color:${overdueCount > 0 ? '#e24b4a' : 'inherit'}">${overdueCount}</div><div class="lbl">Overdue</div></div>`;

    const list = $("catList");
    list.innerHTML = "";
    let anyVisible = false;

    data.forEach((cat, ci) => {
        const matchCat = !q || cat.title.toLowerCase().includes(q);
        const filtered = cat.tasks.filter(t => !q || t.t.toLowerCase().includes(q) || matchCat);
        if (q && !filtered.length && !matchCat) return;
        anyVisible = true;

        const shown = q ? filtered : cat.tasks;
        const done = shown.filter(t => t.done).length;
        const pctC = shown.length ? Math.round(done / shown.length * 100) : 0;
        const col = getColors(ci);
        const isOpen = openCats.has(ci);
        const isNotes = showNotes.has(ci);

        const card = document.createElement("div");
        card.className = "cat-card";
        card.draggable = true;
        card.addEventListener("dragstart", e => catDragStart(e, ci));
        card.addEventListener("dragover", e => catDragOver(e, ci));
        card.addEventListener("drop", e => catDrop(e, ci));
        card.addEventListener("dragend", catDragEnd);

        // Tasks HTML
        let tasksHTML = "";
        if (isOpen) {
            shown.forEach((t, idx) => {
                const realIdx = q ? cat.tasks.indexOf(t) : idx;
                const ds = deadlineStatus(t.deadline);
                const prioClass = t.priority ? "p-" + t.priority : "";
                const prioLabel = { high: "High", medium: "Med", low: "Low" }[t.priority] || "";

                tasksHTML += `<div class="task-item${t.done ? ' task-done' : ''}" draggable="true"
                    ondragstart="taskDragStart(event,${ci},${realIdx})"
                    ondragover="taskDragOver(event,${ci},${realIdx})"
                    ondrop="taskDrop(event,${ci},${realIdx})">
                    <i class="ti ti-grip-vertical task-drag"></i>
                    <input type="checkbox" ${t.done ? "checked" : ""} onchange="toggleTask(${ci},${realIdx})" id="t${ci}_${realIdx}">
                    <label class="task-label${t.done ? " done" : ""}" for="t${ci}_${realIdx}">${esc(t.t)}</label>
                    <div class="task-meta">
                        ${prioLabel ? `<span class="priority-badge ${prioClass}">${prioLabel}</span>` : ""}
                        ${ds ? `<span class="deadline-badge ${ds.cls}"><i class="ti ti-calendar" style="font-size:11px"></i>${ds.label}</span>` : ""}
                        <button class="icon-btn" onclick="openTaskModal(${ci},${realIdx},event)" title="Edit"><i class="ti ti-pencil"></i></button>
                        <button class="task-del" onclick="deleteTask(${ci},${realIdx})" title="Delete"><i class="ti ti-trash" style="font-size:13px"></i></button>
                    </div>
                </div>`;
            });
        }

        const notePreview = cat.notes && !isNotes
            ? `<div class="cat-note-preview"><i class="ti ti-notes" style="font-size:11px"></i> ${esc(cat.notes)}</div>`
            : "";

        card.innerHTML =
            `<div class="cat-header" onclick="toggleCat(${ci})">
                <i class="ti ti-grip-vertical drag-handle" onclick="event.stopPropagation()" title="Drag to reorder"></i>
                <div class="cat-icon" style="background:${col.bg}"><i class="ti ${esc(cat.icon || "ti-target")}" style="color:${col.fill}"></i></div>
                <div class="cat-title-wrap">
                    <div class="cat-title">${esc(cat.title)}</div>
                    ${notePreview}
                </div>
                <span class="cat-meta">${done}/${shown.length}</span>
                <div class="cat-actions" onclick="event.stopPropagation()">
                    <button class="icon-btn" onclick="toggleNotes(${ci},event)" title="${isNotes ? "Hide" : "Show"} notes">
                        <i class="ti ${isNotes ? "ti-notes-off" : "ti-notes"}"></i>
                    </button>
                    <button class="icon-btn danger" onclick="deleteCat(${ci})" title="Delete category">
                        <i class="ti ti-trash"></i>
                    </button>
                </div>
                <i class="ti ti-chevron-down chevron ${isOpen ? "open" : ""}"></i>
            </div>
            <div class="progress-bar">
                <div class="progress-fill" style="width:${pctC}%;background:${col.fill}"></div>
            </div>
            ${isNotes ? `<div class="cat-notes-area">
                <div class="notes-label"><i class="ti ti-notes" style="font-size:12px"></i> Notes</div>
                <textarea placeholder="Write notes..." onchange="saveNote(${ci},this.value)" oninput="data[${ci}].notes=this.value">${esc(cat.notes || "")}</textarea>
            </div>` : ""}
            ${isOpen ? `<div class="cat-body">${tasksHTML}
                <div class="add-row">
                    <input type="text" placeholder="Add a goal..." id="add_${ci}" onkeydown="if(event.key==='Enter')addTask(${ci})">
                    <select id="addPrio_${ci}" title="Priority">
                        <option value="">Priority</option>
                        <option value="high">🔴 High</option>
                        <option value="medium">🟡 Medium</option>
                        <option value="low">🟢 Low</option>
                    </select>
                    <input type="date" id="addDate_${ci}" title="Deadline">
                    <button onclick="addTask(${ci})" title="Add goal"><i class="ti ti-plus"></i></button>
                </div>
            </div>` : ""}`;

        list.appendChild(card);
    });

    if (!anyVisible) {
        list.innerHTML = data.length === 0
            ? `<div class="empty">
                <i class="ti ti-clipboard-list"></i>
                <p>No categories yet</p>
                <span>Click <strong>+</strong> to add your first category</span>
               </div>`
            : `<div class="empty">
                <i class="ti ti-search"></i>
                <p>No results for "${esc(q)}"</p>
               </div>`;
    }
}

// ── Global exposure (for inline handlers) ────────────────────────────────────

Object.assign(window, {
    toggleCat, deleteCat, toggleNotes, saveNote,
    toggleTask, deleteTask, addTask,
    openTaskModal, closeTaskModal, saveTaskModal,
    catDragStart, catDragOver, catDrop, catDragEnd,
    taskDragStart, taskDragOver, taskDrop,
    data
});

// ── Event bindings ───────────────────────────────────────────────────────────

$("addCat").onclick = toggleAddCat;                                   // BUG FIX: was toggleAddCat()
$("searchInput").oninput = render;
$("import").onclick = () => $("importFile").click();
$("export").onclick = () => exportData(data);
$("importFile").onchange = e => importData(e, {
    onImport(imported) {
        data.length = 0;
        imported.forEach(item => data.push(item));
        openCats = new Set([0]);
        showNotes = new Set();
        window.data = data;
        save(); render();
    }
});
$("iconPicker").onclick = modalIcon;
$("addCatBtn").onclick = addCat;
$("cancelAddCat").onclick = cancelAddCat;
$("catInput").onkeydown = e => { if (e.key === "Enter") addCat(); };
$("closeTaskModal").onclick = closeTaskModal;
$("saveTaskModal").onclick = saveTaskModal;

render();
