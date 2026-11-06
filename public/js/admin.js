const defaultCategories = [
  "Apartment",
  "House",
  "Villa",
  "Studio",
  "Room",
  "Shared Housing"
];
const categoryStorageKey = "rentconnect.customCategories";
const sampleAccounts = [
  { name: "Abel Tesfaye", email: "abel.tesfaye@example.test", role: "Renter", status: "Active" },
  { name: "Mekdes Alemu", email: "mekdes.alemu@example.test", role: "Owner", status: "Active" },
  { name: "Dawit Bekele", email: "dawit.bekele@example.test", role: "Renter", status: "Pending" },
  { name: "Hana Girma", email: "hana.girma@example.test", role: "Owner", status: "Active" }
];
const sampleListings = [
  { title: "Modern 3 Bedroom Apartment", location: "Bole, Addis Ababa", rent: 35000, status: "Approved" },
  { title: "Spacious Family House", location: "Kazanchis, Addis Ababa", rent: 45000, status: "Approved" },
  { title: "Luxury Villa with Garden", location: "Mekanisa, Addis Ababa", rent: 120000, status: "Pending review" },
  { title: "Affordable Family House", location: "Adama", rent: 22000, status: "Approved" }
];
const sampleCategoryCounts = {
  Apartment: 1,
  House: 2,
  Villa: 1,
  Studio: 1,
  Room: 1,
  "Shared Housing": 1
};

const categoryRows = document.getElementById("categoryRows");
const categoryCount = document.getElementById("categoryCount");
const categoryStat = document.getElementById("categoryStat");
const categoryMessage = document.getElementById("categoryMessage");

function escapeHtml(value) {
  return value.replace(/[&<>"']/g, character => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  })[character]);
}

function loadCustomCategories() {
  try {
    const categories = JSON.parse(localStorage.getItem(categoryStorageKey) || "[]");
    if (!Array.isArray(categories) || categories.some(category => typeof category !== "string")) {
      throw new TypeError("Saved categories have an invalid format.");
    }

    const uniqueCategories = [];
    for (const value of categories) {
      const category = value.trim();
      if (category && !defaultCategories.some(
        defaultCategory => defaultCategory.toLowerCase() === category.toLowerCase()
      ) && !uniqueCategories.some(existing => existing.toLowerCase() === category.toLowerCase())) {
        uniqueCategories.push(category);
      }
    }
    return uniqueCategories;
  } catch (error) {
    console.error("Could not load saved categories:", error);
    showCategoryMessage("Could not read saved categories. Check browser storage and reload.", true);
    return [];
  }
}

function saveCustomCategories(categories) {
  try {
    localStorage.setItem(categoryStorageKey, JSON.stringify(categories));
    return true;
  } catch (error) {
    console.error("Could not save categories:", error);
    showCategoryMessage("Could not save this category. Browser storage may be unavailable.", true);
    return false;
  }
}

function showCategoryMessage(message, isError = false) {
  categoryMessage.textContent = message;
  categoryMessage.classList.toggle("error", isError);
}

function renderCategories() {
  const customCategories = loadCustomCategories();
  const allCategories = [...defaultCategories, ...customCategories];
  categoryCount.textContent = `${allCategories.length} ${allCategories.length === 1 ? "category" : "categories"}`;
  categoryStat.textContent = String(allCategories.length);
  categoryRows.innerHTML = [
    ...defaultCategories.map(category => `
      <tr>
        <td><strong>${escapeHtml(category)}</strong></td>
        <td><span class="role">Default</span></td>
        <td>${sampleCategoryCounts[category] || "—"}</td>
        <td><span class="muted-action">Built in</span></td>
      </tr>
    `),
    ...customCategories.map(category => `
      <tr>
        <td><strong>${escapeHtml(category)}</strong></td>
        <td><span class="role">Custom</span></td>
        <td>0</td>
        <td><button class="button-danger" type="button" data-remove-category="${escapeHtml(category)}">Remove</button></td>
      </tr>
    `)
  ].join("");

  categoryRows.querySelectorAll("[data-remove-category]").forEach(button => {
    button.addEventListener("click", () => {
      const next = loadCustomCategories().filter(
        category => category !== button.dataset.removeCategory
      );
      if (saveCustomCategories(next)) {
        showCategoryMessage(`Removed "${button.dataset.removeCategory}".`);
        renderCategories();
      }
    });
  });
}

document.getElementById("categoryForm").addEventListener("submit", event => {
  event.preventDefault();
  const input = document.getElementById("categoryName");
  const category = input.value.trim().replace(/\s+/g, " ");
  if (!category) {
    showCategoryMessage("Enter a category name.", true);
    return;
  }

  const existingCategories = [...defaultCategories, ...loadCustomCategories()];
  if (existingCategories.some(existing => existing.toLowerCase() === category.toLowerCase())) {
    showCategoryMessage("That category already exists.", true);
    input.focus();
    return;
  }

  if (saveCustomCategories([...loadCustomCategories(), category])) {
    input.value = "";
    showCategoryMessage(`Added "${category}" to this browser.`);
    renderCategories();
  }
});

function renderAccounts(search = "") {
  const query = search.trim().toLowerCase();
  const matches = sampleAccounts.filter(account =>
    `${account.name} ${account.email} ${account.role} ${account.status}`.toLowerCase().includes(query)
  );
  document.getElementById("accountRows").innerHTML = matches.length
    ? matches.map(account => `
      <tr>
        <td><strong>${escapeHtml(account.name)}</strong></td>
        <td>${escapeHtml(account.email)}</td>
        <td><span class="role">${escapeHtml(account.role)}</span></td>
        <td><span class="status ${account.status === "Active" ? "status-active" : "status-review"}">${escapeHtml(account.status)}</span></td>
      </tr>
    `).join("")
    : '<tr><td class="empty-row" colspan="4">No sample accounts match your search.</td></tr>';
}

function renderListings(search = "") {
  const query = search.trim().toLowerCase();
  const matches = sampleListings.filter(listing =>
    `${listing.title} ${listing.location} ${listing.status}`.toLowerCase().includes(query)
  );
  document.getElementById("listingRows").innerHTML = matches.length
    ? matches.map(listing => `
      <tr>
        <td><strong>${escapeHtml(listing.title)}</strong></td>
        <td>${escapeHtml(listing.location)}</td>
        <td>ETB ${listing.rent.toLocaleString()} / mo</td>
        <td><span class="status ${listing.status === "Approved" ? "status-approved" : "status-review"}">${escapeHtml(listing.status)}</span></td>
      </tr>
    `).join("")
    : '<tr><td class="empty-row" colspan="4">No sample listings match your search.</td></tr>';
}

document.getElementById("accountSearch").addEventListener("input", event => {
  renderAccounts(event.target.value);
});
document.getElementById("listingSearch").addEventListener("input", event => {
  renderListings(event.target.value);
});

renderCategories();
renderAccounts();
renderListings();
