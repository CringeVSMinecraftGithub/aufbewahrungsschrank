// ========================
// FIREBASE INIT
// ========================
const firebaseConfig = {
  apiKey: "AIzaSyBsPILic3ZRMF6zk2AZQur5u97O_OjfjHM",
  authDomain: "aufbewahrungsschrank-1a75a.firebaseapp.com",
  projectId: "aufbewahrungsschrank-1a75a",
  storageBucket: "aufbewahrungsschrank-1a75a.appspot.com",
  messagingSenderId: "466103400824",
  appId: "1:466103400824:web:d5a736b170a7ad2b8c708d"
};

firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();

// ========================
// STORAGE & DATEN
// ========================
let products = [];

let categories = JSON.parse(localStorage.getItem("categories")) || [
    { name: "Lebensmittel", color: "#22c55e" },
    { name: "Getränke", color: "#3b82f6" },
    { name: "Haushalt", color: "#f59e0b" },
    { name: "Sonstiges", color: "#64748b" }
];

// Migration alte String-Kategorien
categories = categories.map(c =>
    typeof c === "string" ? { name: c, color: "#64748b" } : c
);

let editingProductId = null;
let draggedProductId = null;

// Mobile Drag State
let touchDragging = null;
let touchClone = null;

// ========================
// ELEMENTE
// ========================
const categorySelect = document.getElementById("category");
const editCategory = document.getElementById("edit-category");
const addCategoryBtn = document.getElementById("add-category-btn");

const categoryModal = document.getElementById("category-modal");
const newCategoryInput = document.getElementById("new-category-input");
const categoryList = document.getElementById("category-list");

const editModal = document.getElementById("edit-modal");
const editName = document.getElementById("edit-name");
const editFach = document.getElementById("edit-fach");
const editExpiry = document.getElementById("edit-expiry");
const editQuantity = document.getElementById("edit-quantity");

const toast = document.getElementById("toast");
const searchInput = document.getElementById("search-input");

// ========================
// INIT
// ========================
addCategoryBtn.onclick = openCategoryModal;
searchInput?.addEventListener("input", renderAll);

document.getElementById("storage")?.addEventListener(
    "change",
    updateFachDropdown
);

renderCategories();
updateFachDropdown();
renderAll();
initDragTargets();


// ========================
// KATEGORIEN
// ========================
function renderCategories() {
    categorySelect.innerHTML = `<option value="">Kategorie wählen</option>`;
    editCategory.innerHTML = "";

    categories.forEach(cat => {
        categorySelect.add(new Option(cat.name, cat.name));
        editCategory.add(new Option(cat.name, cat.name));
    });

    updateCategorySelectColor(categorySelect);
    updateCategorySelectColor(editCategory);

    renderCategoryManager();
    saveCategories();
}

function renderCategoryManager() {
    categoryList.innerHTML = "";

    let draggedIndex = null;

    categories.forEach((cat, index) => {
        const row = document.createElement("div");
        row.className = "category-row";
        row.draggable = true;
        row.dataset.index = index;

        row.innerHTML = `
            <span class="drag-handle">☰</span>
            <span style="border-left:6px solid ${cat.color}; padding-left:8px;">
                ${cat.name}
            </span>
            <button class="color-btn">🖌️</button>
            <input type="color" class="color-picker" value="${cat.color}">
            <button>✏️</button>
            <button>🗑️</button>
        `;

        const span = row.querySelectorAll("span")[1];
        const colorBtn = row.querySelector(".color-btn");
        const colorInput = row.querySelector(".color-picker");
        const editBtn = row.querySelectorAll("button")[1];
        const deleteBtn = row.querySelectorAll("button")[2];

        colorBtn.onclick = () => colorInput.click();
        colorInput.onchange = e => {
            cat.color = e.target.value;
            saveAndRender("✔️ Farbe gespeichert");
        };

        editBtn.onclick = () => inlineRename(cat, span);
        deleteBtn.onclick = () => removeCategory(cat.name);

        // ========================
        // DRAG SORT LOGIC
        // ========================
        row.addEventListener("dragstart", () => {
            draggedIndex = index;
            row.classList.add("dragging-category");
        });

        row.addEventListener("dragover", e => {
            e.preventDefault();
            row.classList.add("drag-over");
        });

        row.addEventListener("dragleave", () => {
            row.classList.remove("drag-over");
        });

        row.addEventListener("drop", () => {
            row.classList.remove("drag-over");
            if (draggedIndex === null || draggedIndex === index) return;

            const draggedItem = categories.splice(draggedIndex, 1)[0];
            categories.splice(index, 0, draggedItem);

            draggedIndex = null;
            saveAndRender("✔️ Reihenfolge gespeichert");
        });

        row.addEventListener("dragend", () => {
            row.classList.remove("dragging-category");
        });

        categoryList.appendChild(row);
    });
    enableMobileCategorySort();
}



function addNewCategory() {
    const name = newCategoryInput.value.trim();
    if (!name || categories.some(c => c.name === name)) return;

    categories.push({ name, color: "#64748b" });
    newCategoryInput.value = "";
    saveAndRender("✔️ Kategorie hinzugefügt");
}

function inlineRename(cat, span) {
    const input = document.createElement("input");
    input.className = "inline-edit";
    input.value = cat.name;

    span.replaceWith(input);
    input.focus();
    input.select();

    const save = () => {
        const newName = input.value.trim();
        if (!newName || categories.some(c => c.name === newName)) {
            renderCategories();
            return;
        }

        products.forEach(p => {
            if (p.category === cat.name) p.category = newName;
        });

        cat.name = newName;
        saveAndRender("✔️ Kategorie umbenannt");
    };

    input.onblur = save;
    input.onkeydown = e => {
        if (e.key === "Enter") save();
        if (e.key === "Escape") renderCategories();
    };
}

function removeCategory(name) {
    if (
        products.some(p => p.category === name) &&
        !confirm("Kategorie wird verwendet. Trotzdem löschen?")
    ) return;

    categories = categories.filter(c => c.name !== name);
    products = products.filter(p => p.category !== name);

    db.collection("categories").doc(name).delete();
    saveAndRender("✔️ Kategorie gelöscht");
}

// ========================
// MODALS
// ========================
function openCategoryModal() {
    categoryModal.classList.remove("hidden");
}

function closeCategoryModal() {
    categoryModal.classList.add("hidden");
}

function openEditModal(product) {
    editingProductId = product.id;

    editName.value = product.name;
    editCategory.value = product.category;
    editExpiry.value = product.expiry;
    editQuantity.value = product.quantity ?? 1;

    // 🔧 FACH-DROPDOWN LEEREN
    editFach.innerHTML = "";

    // 🔧 RICHTIGE FÄCHER JE NACH STORAGE
    let max = 4;
    let label = "Fach";

    if (product.storage === "tk") {
        max = 3;
        label = "Tiefkühltruhe";
    }

    if (product.storage === "keller") {
        max = 4;
        label = "Kellerfach";
    }

    for (let i = 1; i <= max; i++) {
        const opt = document.createElement("option");
        opt.value = i;
        opt.textContent = `${label} ${i}`;
        editFach.appendChild(opt);
    }

    // 🔧 AKTUELLES FACH SETZEN
    editFach.value = String(product.fach);

    updateCategorySelectColor(editCategory);
    editModal.classList.remove("hidden");
}

function closeEditModal() {
    editModal.classList.add("hidden");
    editingProductId = null;
}

// ========================
// INFO MODAL
// ========================
const infoModal = document.getElementById("info-modal");
const infoName = document.getElementById("info-name");
const infoCategory = document.getElementById("info-category");
const infoExpiry = document.getElementById("info-expiry");
const infoQuantity = document.getElementById("info-quantity");

let infoProductId = null;
let infoCurrentQuantity = 1;

function openInfoModal(product) {
    infoProductId = product.id;
    infoCurrentQuantity = product.quantity ?? 1;

    infoName.textContent = product.name;
    infoCategory.textContent = product.category;
    infoQuantity.textContent = infoCurrentQuantity;

    const date = new Date(product.expiry);
    infoExpiry.textContent = date.toLocaleDateString("de-DE");

    infoModal.classList.remove("hidden");
}

function closeInfoModal() {
    infoModal.classList.add("hidden");
}

// ========================
// PRODUKTE
// ========================
function addProduct() {
    const name = document.getElementById("name").value;
    const category = categorySelect.value;
    const fach = document.getElementById("fach").value;
    const expiry = document.getElementById("expiry").value;

    if (!name || !category || !fach || !expiry) {
        alert("Bitte alle Felder ausfüllen!");
        return;
    }

    db.collection("products").add({
    name,
    category,
    fach,
storage: document.getElementById("storage").value,
    expiry,
    quantity: 1,
    createdAt: firebase.firestore.FieldValue.serverTimestamp()
});


    clearForm();
}

function saveEdit() {
    if (!editingProductId) return;

    db.collection("products").doc(editingProductId).update({
    name: editName.value,
    category: editCategory.value,
    fach: editFach.value,
    expiry: editExpiry.value,
    quantity: Number(editQuantity.value) || 1
});


    closeEditModal();
}

function deleteProduct(id) {
    db.collection("products").doc(id).delete();
}

// ========================
// RENDER
// ========================
function renderAll() {
    clearFaecher();
    renderProducts();
}

function renderProducts() {
    renderStorage("schrank", 4);
    renderStorage("tk", 3);
    renderStorage("keller", 4);
}

function renderStorage(storage, maxFach) {
    const query = searchInput ? searchInput.value.toLowerCase() : "";

    for (let fachNr = 0; fachNr <= maxFach; fachNr++) {
        const fachId =
    storage === "schrank"
        ? `fach-${fachNr}`
        : storage === "tk"
        ? `tk-fach-${fachNr}`
        : `keller-fach-${fachNr}`;


        const fachEl = document.getElementById(fachId);
        if (!fachEl) continue;

        const fachProducts = products.filter(p => {
            const status = getExpiryStatus(p.expiry);

            if (p.storage !== storage) return false;

            const matchesSearch =
                p.name.toLowerCase().includes(query) ||
                p.category.toLowerCase().includes(query);

            if (!matchesSearch) return false;

            if (fachNr === 0) return status === "expired";
            return status !== "expired" && String(p.fach) === String(fachNr);
        });

        // ========================
        // SCHRITT 5 – KATEGORIEN-GRUPPIERUNG
        // ========================
        categories.forEach(cat => {
            const catProducts = fachProducts.filter(p => p.category === cat.name);
            if (catProducts.length === 0) return;

            // Kategorie-Überschrift
            const header = document.createElement("div");
            header.className = "category-header";
            header.innerHTML = `
                <span style="
                    border-left:6px solid ${cat.color};
                    padding-left:8px;
                    font-weight:600;
                ">
                    ${cat.name}
                </span>
            `;
            fachEl.appendChild(header);

            // Produkte dieser Kategorie
            catProducts.forEach(p => {
const div = document.createElement("div");
div.className = "product";
div.dataset.id = p.id;
div.dataset.storage = storage;

// 🔥 Ablauf-Status setzen
const status = getExpiryStatus(p.expiry);
if (status === "expired") div.classList.add("expired");
if (status === "soon") div.classList.add("soon");

div.innerHTML = `
    <div class="product-main">
        <strong>
    ${p.name}
    ${
        getExpiryStatus(p.expiry) === "expired"
            ? '<span class="status-icon">❌</span>'
            : getExpiryStatus(p.expiry) === "soon"
            ? '<span class="status-icon">⚠️</span>'
            : ''
    }
</strong>

<span class="quantity">x${p.quantity ?? 1}</span>

    </div>

    <div class="actions">
        <button class="edit-btn">✏️</button>
        <button class="delete-btn">🗑️</button>
    </div>
`;

// Popup nur bei Klick auf Produkt (nicht Buttons / Drag)
div.addEventListener("click", e => {
    if (e.target.closest("button")) return;
    openInfoModal(p);
});

// Buttons separat binden
div.querySelector(".edit-btn").onclick = e => {
    e.stopPropagation();
    openEditModal(p);
};

div.querySelector(".delete-btn").onclick = e => {
    e.stopPropagation();
    deleteProduct(p.id);
};




                // Drag nur bei nicht abgelaufen
                if (fachNr !== 0) {
                    enableDesktopDrag(div, p.id);
                    enableMobileDrag(div, p.id);
                }

                fachEl.appendChild(div);
            });
        });
    }
}

// ========================
// DESKTOP DRAG
// ========================
function enableDesktopDrag(div, id) {
    div.draggable = true;

    div.addEventListener("dragstart", e => {
        draggedProductId = id;
        e.dataTransfer.setData("text/plain", id);
        div.classList.add("dragging");
    });

    div.addEventListener("dragend", () => {
        draggedProductId = null;
        div.classList.remove("dragging");
    });
}

// ========================
// MOBILE DRAG (LONG PRESS)
// ========================
function enableMobileDrag(div, id) {
    let pressTimer;

    div.addEventListener("touchstart", e => {
        if (e.target.closest("button")) return;

        pressTimer = setTimeout(() => {
            touchDragging = id;

            touchClone = div.cloneNode(true);
            touchClone.style.position = "fixed";
            touchClone.style.pointerEvents = "none";
            touchClone.style.opacity = "0.85";
            touchClone.style.zIndex = "9999";
            document.body.appendChild(touchClone);
        }, 250);
    });

    div.addEventListener("touchmove", e => {
        if (!touchDragging || !touchClone) return;
        e.preventDefault();

        const touch = e.touches[0];
        touchClone.style.left = touch.clientX - 50 + "px";
        touchClone.style.top = touch.clientY - 30 + "px";
    });

    div.addEventListener("touchend", e => {
        clearTimeout(pressTimer);

        if (!touchDragging || !touchClone) return;

        const touch = e.changedTouches[0];
        const target = document.elementFromPoint(touch.clientX, touch.clientY);
        const fach = target?.closest(".fach");

        document.body.removeChild(touchClone);
        touchClone = null;

        if (!fach) {
    touchDragging = null;
    return;
}

if (
    fach.id === "fach-0" ||
    fach.id === "tk-fach-0" ||
    fach.id === "keller-fach-0"
) {
    showToast(
        "Sie können keine Produkte manuell in Abgelaufen verschieben",
        "error"
    );
    touchDragging = null;
    return;
} else {

let storage = "schrank";
if (fach.id.startsWith("tk-")) storage = "tk";
if (fach.id.startsWith("keller-")) storage = "keller";

db.collection("products").doc(touchDragging).update({
    fach: fach.id.split("-").pop(),
    storage
});



    showToast("Produkt verschoben", "success");
}

touchDragging = null;


        touchDragging = null;
    });
}

// ========================
// DRAG TARGETS (DESKTOP)
// ========================
function initDragTargets() {
    document.querySelectorAll(".fach").forEach(fach => {
        fach.addEventListener("dragover", e => {
            e.preventDefault();
            fach.classList.add("drag-over");
        });

        fach.addEventListener("dragleave", () => {
            fach.classList.remove("drag-over");
        });

        fach.addEventListener("drop", e => {
    e.preventDefault();
    fach.classList.remove("drag-over");

    const id = draggedProductId || e.dataTransfer.getData("text/plain");
    if (!id) return;

    // ❌ NICHT in Abgelaufen (Schrank + Tiefkühltruhe)
if (
    fach.id === "fach-0" ||
    fach.id === "tk-fach-0" ||
    fach.id === "keller-fach-0"
) {
    showToast(
        "Sie können keine Produkte manuell in Abgelaufen verschieben",
        "error"
    );
    return;
}



let storage = "schrank";
if (fach.id.startsWith("tk-")) storage = "tk";
if (fach.id.startsWith("keller-")) storage = "keller";

db.collection("products").doc(id).update({
    fach: fach.id.split("-").pop(),
    storage
});

    showToast("Produkt verschoben", "success");
});

    });
}

// ========================
// STATUS
// ========================
function getExpiryStatus(date) {
    const diff = Math.ceil((new Date(date) - new Date()) / 86400000);
    if (diff < 0) return "expired";
    if (diff <= 7) return "soon";
    return "ok";
}

// ========================
// HELPER
// ========================
function clearFaecher() {
    // ========================
    // AUFBEWAHRUNGSSCHRANK
    // ========================
    document.getElementById("fach-0").innerHTML = "<h3>📦 Abgelaufen</h3>";
    for (let i = 1; i <= 4; i++) {
        document.getElementById(`fach-${i}`).innerHTML =
            `<h3>Fach ${i}</h3>`;
    }

    // ========================
    // TIEFKÜHLTRUHE
    // ========================
    document.getElementById("tk-fach-0").innerHTML = "<h3>📦 Abgelaufen</h3>";
    for (let i = 1; i <= 3; i++) {
        document.getElementById(`tk-fach-${i}`).innerHTML =
            `<h3>Tiefkühltruhe ${i}</h3>`;
    }

    // ========================
    // KELLERSCHRANK ✅ NEU
    // ========================
    document.getElementById("keller-fach-0").innerHTML =
        "<h3>📦 Abgelaufen</h3>";
    for (let i = 1; i <= 4; i++) {
        document.getElementById(`keller-fach-${i}`).innerHTML =
            `<h3>Kellerfach ${i}</h3>`;
    }
}


function updateFachDropdown() {
    const storageSelect = document.getElementById("storage");
    const fachSelect = document.getElementById("fach");

    if (!storageSelect || !fachSelect) return;

    const storage = storageSelect.value;

    fachSelect.innerHTML = `<option value="">Fach wählen</option>`;

    if (storage === "schrank") {
        for (let i = 1; i <= 4; i++) {
            const opt = document.createElement("option");
            opt.value = i;
            opt.textContent = `Fach ${i}`;
            fachSelect.appendChild(opt);
        }
    }

    if (storage === "tk") {
        for (let i = 1; i <= 3; i++) {
            const opt = document.createElement("option");
            opt.value = i;
            opt.textContent = `Tiefkühltruhe ${i}`;
            fachSelect.appendChild(opt);
        }
    }

    if (storage === "keller") {
    for (let i = 1; i <= 4; i++) {
        const opt = document.createElement("option");
        opt.value = i;
        opt.textContent = `Kellerfach ${i}`;
        fachSelect.appendChild(opt);
    }
}

}


function clearForm() {
    document.getElementById("name").value = "";
    categorySelect.value = "";
    document.getElementById("fach").value = "";
    document.getElementById("expiry").value = "";
    updateCategorySelectColor(categorySelect);
    updateFachDropdown();
}

function saveCategories() {
    localStorage.setItem("categories", JSON.stringify(categories));
    categories.forEach(cat => {
        db.collection("categories").doc(cat.name).set(cat);
    });
}

function saveAndRender(msg) {
    saveCategories();
    renderAll();
    renderCategories();
    showToast(msg);
}

function showToast(text, type = "success") {
    toast.innerHTML = `
        <span class="toast-icon">
            ${type === "success" ? "✔️" : "❌"}
        </span>
        <span class="toast-text">${text}</span>
    `;

    toast.className = `toast ${type}`;
    toast.classList.remove("hidden");

    clearTimeout(toast._timer);
    toast._timer = setTimeout(() => {
        toast.classList.add("hidden");
    }, 3000);
}

// ========================
// DROPDOWN FARBE
// ========================
function updateCategorySelectColor(selectEl) {
    const cat = categories.find(c => c.name === selectEl.value);
    selectEl.style.borderLeft = cat ? `8px solid ${cat.color}` : "none";
}

categorySelect.onchange = () => updateCategorySelectColor(categorySelect);
editCategory.onchange = () => updateCategorySelectColor(editCategory);

// ========================
// FIRESTORE LIVE SYNC
// ========================
db.collection("products")
  .orderBy("expiry")
  .onSnapshot(snapshot => {
      products = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
      }));
      renderAll();
  });

db.collection("categories")
  .onSnapshot(snapshot => {
      if (!snapshot.empty) {
          categories = snapshot.docs.map(doc => doc.data());
          renderCategories();
      }
  });

  function saveCategoriesOrder() {
    const rows = [...categoryList.children];
    categories = rows.map(row => {
        const name = row.querySelectorAll("span")[1].innerText.trim();
        return categories.find(c => c.name === name);
    });

    saveCategories();
    renderCategories();
}

// ========================
// MOBILE CATEGORY SORT
// ========================
let touchCatIndex = null;
let touchCatClone = null;
let placeholder = null;

function enableMobileCategorySort() {
    const rows = document.querySelectorAll(".category-row");

    rows.forEach(row => {
        let pressTimer;

        row.addEventListener("touchstart", e => {
            if (!e.target.classList.contains("drag-handle")) return;

            pressTimer = setTimeout(() => {
                touchCatIndex = Number(row.dataset.index);

                touchCatClone = row.cloneNode(true);
                touchCatClone.style.position = "fixed";
                touchCatClone.style.pointerEvents = "none";
                touchCatClone.style.opacity = "0.85";
                touchCatClone.style.zIndex = "9999";
                touchCatClone.style.width = row.offsetWidth + "px";
                document.body.appendChild(touchCatClone);

                placeholder = document.createElement("div");
                placeholder.className = "drag-placeholder";
                row.after(placeholder);
                row.style.display = "none";
            }, 300);
        });

        row.addEventListener("touchmove", e => {
            if (!touchCatClone) return;
            e.preventDefault();

            const touch = e.touches[0];
            touchCatClone.style.top = touch.clientY - 20 + "px";
            touchCatClone.style.left = "10px";

            const target = document.elementFromPoint(touch.clientX, touch.clientY);
            const targetRow = target?.closest(".category-row");

            if (targetRow && targetRow !== row) {
                const targetIndex = Number(targetRow.dataset.index);
                if (targetIndex > touchCatIndex) {
                    targetRow.after(placeholder);
                } else {
                    targetRow.before(placeholder);
                }
            }
        }, { passive: false });

        row.addEventListener("touchend", () => {
            clearTimeout(pressTimer);

            if (touchCatClone && placeholder) {
                const newIndex = [...categoryList.children].indexOf(placeholder);

                if (newIndex >= 0 && newIndex !== touchCatIndex) {
                    const moved = categories.splice(touchCatIndex, 1)[0];
                    categories.splice(newIndex, 0, moved);
                    saveAndRender("✔️ Reihenfolge gespeichert");
                }

                placeholder.remove();
                touchCatClone.remove();
            }

            document.querySelectorAll(".category-row").forEach(r => {
                r.style.display = "";
            });

            touchCatClone = null;
            placeholder = null;
            touchCatIndex = null;
        });
    });
}

function changeInfoQuantity(diff) {
    infoCurrentQuantity = Math.max(1, infoCurrentQuantity + diff);
    infoQuantity.textContent = infoCurrentQuantity;
}

function saveInfoQuantity() {
    if (!infoProductId) return;

    db.collection("products").doc(infoProductId).update({
        quantity: infoCurrentQuantity
    });

    closeInfoModal();
    showToast("Anzahl gespeichert");
}

function renderStatistics() {
    renderStatForStorage("schrank", "📦 Aufbewahrungsschrank", "stats-schrank-modal");
    renderStatForStorage("tk", "❄️ Tiefkühltruhe", "stats-tk-modal");
    renderStatForStorage("keller", "🧱 Kellerschrank", "stats-keller-modal");
}

function renderStatForStorage(storage, title, elementId) {
    const el = document.getElementById(elementId);
    if (!el) return;

    // 🔹 ALLE Produkte dieses Schranks
    const allItems = products.filter(p => p.storage === storage);

    // 🔹 NICHT abgelaufen
    const activeItems = allItems.filter(
        p => getExpiryStatus(p.expiry) !== "expired"
    );

    // 🔹 Statistiken
    const totalProducts = activeItems.length;

    const totalQuantity = activeItems.reduce(
        (sum, p) => sum + (p.quantity ?? 1),
        0
    );

    const categoryCount = new Set(
        activeItems.map(p => p.category)
    ).size;

    const expired = allItems.filter(
        p => getExpiryStatus(p.expiry) === "expired"
    ).length;

    const soon = activeItems.filter(
        p => getExpiryStatus(p.expiry) === "soon"
    ).length;

    // 🔹 Render
    el.innerHTML = `
        <h3>${title}</h3>

        <div class="stat-row">
            <span>Produkte</span>
            <strong>${totalProducts}</strong>
        </div>

        <div class="stat-row">
            <span>Gesamtmenge</span>
            <strong>${totalQuantity}</strong>
        </div>

        <div class="stat-row">
            <span>Kategorien</span>
            <strong>${categoryCount}</strong>
        </div>

        <div class="stat-row">
            <span>⛔ Abgelaufen</span>
            <strong>${expired}</strong>
        </div>

        <div class="stat-row">
            <span>⚠️ Läuft bald abut</span>
            <strong>${soon}</strong>
        </div>
    `;
}

const statsModal = document.getElementById("stats-modal");

function openStatsModal() {
    renderStatistics(); // IMMER aktuell
    statsModal.classList.remove("hidden");
}

function closeStatsModal() {
    statsModal.classList.add("hidden");
}


function closeStatsModal() {
    statsModal.classList.add("hidden");
}

document.getElementById("shopping-btn")?.addEventListener("click", () => {
    window.location.href = "shopping.html";
});
