import { toast } from './utils.js';

// io.js receives callbacks so it can mutate state in script.js
export function exportData(data) {
    const blob = new Blob([JSON.stringify({ version: 2, data }, null, 2)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "goals-backup.json";
    a.click();
    URL.revokeObjectURL(a.href);
    toast("Exported!", "success");
}

export function importData(event, { onImport }) {
    const file = event.target.files[0];
    if (!file) return;
    const r = new FileReader();
    r.onload = ev => {
        try {
            const parsed = JSON.parse(ev.target.result);
            const imported = parsed.data || parsed;
            if (!Array.isArray(imported)) throw new Error("Invalid format");
            imported.forEach(cat => {
                if (!cat.notes) cat.notes = "";
                cat.tasks.forEach(t => {
                    if (!t.priority) t.priority = "";
                    if (!t.deadline) t.deadline = "";
                });
            });
            if (!confirm(`Import ${imported.length} categor${imported.length === 1 ? 'y' : 'ies'}? Current data will be replaced.`)) {
                event.target.value = "";
                return;
            }
            onImport(imported);
            toast("Imported!", "success");
        } catch {
            toast("Invalid file!", "error");
        }
        event.target.value = "";
    };
    r.readAsText(file);
}
