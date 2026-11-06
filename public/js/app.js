const properties = [
  {id:1,title:"Modern 3 Bedroom Apartment",category:"Apartment",city:"Addis Ababa",area:"Bole",price:35000,beds:3,baths:2,size:120,features:["Parking","Balcony"],image:"https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?w=700"},
  {id:2,title:"Spacious Family House",category:"House",city:"Addis Ababa",area:"Kazanchis",price:45000,beds:4,baths:3,size:200,features:["Parking","Furnished"],image:"https://images.unsplash.com/photo-1600585154340-be6161a56a0c?w=700"},
  {id:3,title:"Luxury Villa with Garden",category:"Villa",city:"Addis Ababa",area:"Mekanisa",price:120000,beds:5,baths:4,size:350,features:["Parking","Balcony","Generator"],image:"https://images.unsplash.com/photo-1600607687920-4e2a09cf159d?w=700"},
  {id:4,title:"Modern Studio Apartment",category:"Studio",city:"Addis Ababa",area:"Bole",price:18000,beds:1,baths:1,size:40,features:["Furnished","Internet"],image:"https://images.unsplash.com/photo-1616486338812-3dadae4b4ace?w=700"},
  {id:5,title:"Comfortable Room for Rent",category:"Room",city:"Addis Ababa",area:"Piassa",price:8000,beds:1,baths:1,size:25,features:["Furnished","Internet"],image:"https://images.unsplash.com/photo-1611892440504-42a792e24d32?w=700"},
  {id:6,title:"Shared Room in Apartment",category:"Shared Housing",city:"Addis Ababa",area:"CMC",price:6000,beds:1,baths:1,size:20,features:["Internet"],image:"https://images.unsplash.com/photo-1522708323590-d24dbb6b0267?w=700"},
  {id:7,title:"Affordable Family House",category:"House",city:"Adama",area:"Bole Area",price:22000,beds:3,baths:2,size:140,features:["Parking"],image:"https://images.unsplash.com/photo-1600047509807-ba8f99d2cdde?w=700"}
];

let selectedCategory = "";

const defaultCategories = [
  "Apartment",
  "House",
  "Villa",
  "Studio",
  "Room",
  "Shared Housing"
];

function getCustomCategories() {
  try {
    const stored = JSON.parse(localStorage.getItem("rentconnect.customCategories") || "[]");
    if (!Array.isArray(stored)) {
      throw new TypeError("Saved categories must be an array.");
    }

    return [...new Set(stored
      .filter(category => typeof category === "string")
      .map(category => category.trim())
      .filter(category => category && !defaultCategories.some(
        defaultCategory => defaultCategory.toLowerCase() === category.toLowerCase()
      )))];
  } catch (error) {
    console.error("Could not load custom property categories:", error);
    return [];
  }
}

function renderCategoryButtons() {
  const categoryButtons = document.getElementById("categoryButtons");
  const categories = [...defaultCategories, ...getCustomCategories()];
  categoryButtons.innerHTML = [
    '<button class="category active" data-category="">All Properties</button>',
    ...categories.map(category =>
      `<button class="category" data-category="${category.replace(/[&<>"']/g, character => ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;"
      })[character])}">${category.replace(/[&<>"']/g, character => ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;"
      })[character])}</button>`
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
  const city = document.getElementById("cityFilter").value;
  const area = document.getElementById("areaFilter").value.trim().toLowerCase();
  const beds = Number(document.getElementById("bedFilter").value) || 0;

  let filtered = properties.filter(p =>
    p.price >= min && p.price <= max &&
    (!city || p.city === city) &&
    (!selectedCategory || p.category === selectedCategory) &&
    (!area || `${p.area} ${p.city} ${p.title}`.toLowerCase().includes(area)) &&
    p.beds >= beds
  );

  const sort = document.getElementById("sort").value;
  if(sort==="low") filtered.sort((a,b)=>a.price-b.price);
  if(sort==="high") filtered.sort((a,b)=>b.price-a.price);
  if(sort==="newest") filtered.sort((a,b)=>b.id-a.id);

  const categoryLabel = selectedCategory ? ` ${selectedCategory}` : "";
  const propertyLabel = filtered.length === 1 ? "property" : "properties";
  document.getElementById("resultCount").textContent =
    `Found ${filtered.length}${categoryLabel} ${propertyLabel}`;
  const grid = document.getElementById("propertyGrid");

  if(!filtered.length) {
    grid.innerHTML = '<div class="empty"><h3>No properties found</h3><p>Try changing your category, location or price filters.</p></div>';
    return;
  }

  grid.innerHTML = filtered.map(p=>`
    <article class="property-card">
      <img src="${p.image}" alt="${p.title}" loading="lazy">
      <div class="property-info">
        <h3>${p.title}</h3>
        <div class="address">📍 ${p.area}, ${p.city}</div>
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
