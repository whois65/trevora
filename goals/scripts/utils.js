const $ = x => document.getElementById(x);

export function toast(msg, type = "default") {
    const el = $("toast");
    el.textContent = msg;
    el.className = "toast show" + (type === "error" ? " error" : type === "success" ? " success" : "");
    clearTimeout(el._timer);
    el._timer = setTimeout(() => el.classList.remove("show"), 2800);
}
