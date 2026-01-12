// ========================
// STATE
// ========================
let quantity = 1;
let selectedWeight = "";
let urgent = false;

const listEl = document.getElementById("shopping-list");

// ========================
// FORM LOGIC
// ========================
function changeQty(delta) {
    quantity = Math.max(1, quantity + delta);
    document.getElementById("quantity").textContent = quantity;
}

function setWeight(button, weight) {
    selectedWeight = weight;

    document.querySelectorAll(".weight-buttons button")
        .forEach(btn => btn.classList.remove("active"));

    button.classList.add("active");
}

function togglePriority() {
    urgent = !urgent;
    const btn = document.getElementById("priority-btn");

    btn.textContent = urgent ? "🚨 Dringend" : "🔥 Nicht dringend";
    btn.classList.toggle("urgent", urgent);
}

function resetForm() {
    document.getElementById("item-name").value = "";
    document.getElementById("item-brand").value = "";
    document.getElementById("quantity").textContent = "1";

    quantity = 1;
    selectedWeight = "";
    urgent = false;

    document.getElementById("priority-btn").textContent = "🔥 Nicht dringend";
    document.getElementById("priority-btn").classList.remove("urgent");

    document.querySelectorAll(".weight-buttons button")
        .forEach(btn => btn.classList.remove("active"));
}

// ========================
// ADD ITEM (FIREBASE)
// ========================
function addShoppingItem() {
    console.log("ADD BUTTON CLICKED");
    if (typeof db === "undefined") {
        alert("Datenbank nicht verbunden");
        return;
    }

    const name = document.getElementById("item-name").value.trim();
    const brand = document.getElementById("item-brand").value.trim();
    const category = document.getElementById("item-category").value;

    if (!name) {
        alert("Bitte Produktname eingeben");
        return;
    }

    db.collection("shopping_list").add({
        name,
        brand,
        category,
        quantity,
        weight: selectedWeight,
        urgent,
        createdAt: firebase.firestore.FieldValue.serverTimestamp()
    }).then(() => {
        resetForm();
    });
}

// ========================
// DELETE
// ========================
function deleteShoppingItem(id) {
    db.collection("shopping_list").doc(id).delete();
}

// ========================
// RENDER
// ========================
function renderShoppingList(items) {
    listEl.innerHTML = "";

    // Gruppieren nach Kategorie
    const grouped = {};

    items.forEach(item => {
        if (!grouped[item.category]) {
            grouped[item.category] = [];
        }
        grouped[item.category].push(item);
    });

    Object.keys(grouped).forEach(category => {
        // Kategorie-Überschrift
        const catHeader = document.createElement("h3");
        catHeader.className = "shopping-category";
        catHeader.textContent = category;
        listEl.appendChild(catHeader);

        grouped[category].forEach(item => {
            const div = document.createElement("div");
            div.className = "shopping-item-card";
                if (item.urgent) div.classList.add("urgent");


div.innerHTML = `
    <div class="shopping-item-main">
        <strong>${item.name}</strong>

        <div class="shopping-item-meta">
            ${item.quantity} × ${item.weight || "Stück"}
        </div>

        ${item.brand ? `
            <div class="shopping-item-meta brand">
                ${item.brand}
            </div>
        ` : ""}

        ${item.urgent ? `
            <div class="shopping-item-meta urgent-label">
                🚨 Dringend
            </div>
        ` : ""}
    </div>

    <button 
        class="delete-btn"
        onclick="deleteShoppingItem('${item.id}')"
        title="Produkt löschen"
    >
        🗑️
    </button>
`;


            listEl.appendChild(div);
        });
    });
}

// ========================
// LIVE FIREBASE SYNC
// ========================
db.collection("shopping_list")
    .orderBy("createdAt")
    .onSnapshot(snapshot => {
        const items = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        }));

        renderShoppingList(items);
    });

window.changeQty = changeQty;
window.setWeight = setWeight;
window.togglePriority = togglePriority;
window.addShoppingItem = addShoppingItem;
window.deleteShoppingItem = deleteShoppingItem;