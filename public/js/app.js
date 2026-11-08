const properties = [];

let selectedCategory = "";

function escapeHtml(value) {
  return String(value == null ? "" : value).replace(/[&<>"']/g, character => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  })[character]);
}

async function renderCategoryButtons() {
  const categoryButtons = document.getElementById("categoryButtons");
  let categories;
  try {
    const response = await fetch("/api/categories");
    if (!response.ok) throw new Error("Could not load property categories.");
    categories = await response.json();
    if (!Array.isArray(categories) || categories.some(category => typeof category.name !== "string")) {
      throw new TypeError("The categories response has an invalid format.");
    }
  } catch (error) {
    console.error("Could not load property categories:", error);
    return;
  }
  categoryButtons.innerHTML = [
    '<button class="category active" data-category="">All Properties</button>',
    ...categories.map(category =>
      `<button class="category" data-category="${escapeHtml(category.name)}">${escapeHtml(category.name)}</button>`
    )
  ].join("");

  categoryButtons.querySelectorAll(".category").forEach(button => {
    button.addEventListener("click", () => {
      selectedCategory = button.dataset.category;
      updateCategoryButtons();
      renderProperties();
    });
  });
  updateCategoryButtons();
}

function getOptionalNumber(id) {
  const value = document.getElementById(id).value;
  return value === "" ? null : Number(value);
}

function applyFilters() {
  renderProperties();
}

function renderProperties() {
  const minValue = getOptionalNumber("minFilter");
  const maxValue = getOptionalNumber("maxFilter");
  const min = minValue === null ? 0 : minValue;
  const max = maxValue === null ? Infinity : maxValue;
  const city = document.getElementById("cityFilter").value.trim().toLowerCase();
  const area = document.getElementById("areaFilter").value.trim().toLowerCase();
  const beds = Number(document.getElementById("bedFilter").value) || 0;

  let filtered = properties.filter(p =>
    p.price >= min && p.price <= max &&
    (!city || String(p.city).trim().toLowerCase() === city) &&
    (!selectedCategory || p.category === selectedCategory) &&
    (!area || String(p.area).toLowerCase().includes(area)) &&
    p.beds >= beds
  );

  const sort = document.getElementById("sort").value;
  if(sort==="low") filtered.sort((a,b)=>a.price-b.price);
  if(sort==="high") filtered.sort((a,b)=>b.price-a.price);
  if(sort==="newest") filtered.sort((a,b)=>b.id-a.id);

  document.getElementById("resultCount").textContent =
    `${filtered.length} results`;
  const grid = document.getElementById("propertyGrid");

  if(!filtered.length) {
    grid.innerHTML = '<div class="empty"><h3>No properties found</h3><p>Try changing your category, location or price filters.</p></div>';
    return;
  }

  grid.innerHTML = filtered.map(p=>`
    <article class="property-card">
      <img src="${escapeHtml(p.image)}" alt="${escapeHtml(p.title)}" loading="lazy">
      <div class="property-info">
        <h3>${escapeHtml(p.title)}</h3>
        <div class="address">📍 ${escapeHtml(p.city)}, ${escapeHtml(p.area)}</div>
        <div class="price">ETB ${p.price.toLocaleString()} <small>/ month</small></div>
        <div class="details">
          <span>🛏 ${p.beds} Beds</span>
          <span>🛁 ${p.baths} Baths</span>
          <span>▱ ${p.size} m²</span>
        </div>
        <div class="card-bottom">
          <button class="btn btn-outline" onclick="alert('Property details page coming soon')">View Details →</button>
        </div>
      </div>
    </article>
  `).join("");
}

function updateCategoryButtons() {
  document.querySelectorAll(".category").forEach(button => {
    button.classList.toggle("active", button.dataset.category === selectedCategory);
  });
}

document.getElementById("cityFilter").addEventListener("change", renderProperties);

["minFilter", "maxFilter", "areaFilter"].forEach(id => {
  document.getElementById(id).addEventListener("input", renderProperties);
});

document.getElementById("bedFilter").addEventListener("change", renderProperties);

let areFiltersVisible = false;

function syncFilterToggle() {
  const content = document.querySelector(".content");
  const filters = document.getElementById("filters");
  const toggle = document.getElementById("filterToggle");
  const isMobile = window.matchMedia("(max-width: 650px)").matches;

  if (isMobile) {
    content.classList.remove("filters-hidden");
    filters.classList.toggle("open", areFiltersVisible);
  } else {
    content.classList.toggle("filters-hidden", !areFiltersVisible);
    filters.classList.remove("open");
  }

  toggle.setAttribute("aria-expanded", String(areFiltersVisible));
}

function toggleFilters() {
  areFiltersVisible = !areFiltersVisible;
  syncFilterToggle();
}

window.addEventListener("resize", syncFilterToggle);

function resetFilters() {
  ["minFilter","maxFilter","areaFilter"].forEach(id=>document.getElementById(id).value="");
  ["cityFilter","bedFilter"].forEach(id=>document.getElementById(id).value="");
  renderProperties();
}

renderCategoryButtons();
syncFilterToggle();
renderProperties();
