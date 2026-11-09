const token = localStorage.getItem('token');
const categoryRows = document.getElementById('categoryRows');
const categoryMessage = document.getElementById('categoryMessage');
const dashboardMessage = document.getElementById('dashboardMessage');
const sections = document.querySelectorAll('.dashboard-section');
let dashboardData = null;

function escapeHtml(value) {
  return String(value == null ? '' : value).replace(/[&<>"']/g, character => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  })[character]);
}

function showDashboardMessage(message, isError = true) {
  dashboardMessage.hidden = false;
  dashboardMessage.querySelector('strong').textContent = isError ? 'Dashboard unavailable' : 'Access denied';
  document.getElementById('dashboardMessageText').textContent = message;
}

function showCategoryMessage(message, isError = false) {
  categoryMessage.textContent = message;
  categoryMessage.classList.toggle('error', isError);
}

async function request(url, options = {}) {
  const response = await fetch(url, {
    ...options,
    headers: {
      ...(options.body ? { 'Content-Type': 'application/json' } : {}),
      Authorization: 'Bearer ' + token,
      ...options.headers
    }
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(result.error || 'Could not complete the request.');
    error.status = response.status;
    throw error;
  }
  return result;
}

function renderCategories() {
  const categories = dashboardData.categories;
  document.getElementById('categoryCount').textContent =
    `${categories.length} ${categories.length === 1 ? 'category' : 'categories'}`;
  document.getElementById('categoryStat').textContent = String(categories.length);
  categoryRows.innerHTML = categories.length
    ? categories.map(category => `
      <tr>
        <td><strong>${escapeHtml(category.name)}</strong></td>
        <td><span class="role">${category.isDefault ? 'Default' : 'Custom'}</span></td>
        <td>${category.listingCount}</td>
        <td>${category.isDefault
          ? '<span class="muted-action">Built in</span>'
          : `<button class="button-danger" type="button" data-remove-category="${category.id}">Remove</button>`}</td>
      </tr>
    `).join('')
    : '<tr><td class="empty-row" colspan="4">No categories are available.</td></tr>';

  categoryRows.querySelectorAll('[data-remove-category]').forEach(button => {
    button.addEventListener('click', async () => {
      button.disabled = true;
      try {
        await request(`/api/admin/categories/${button.dataset.removeCategory}`, { method: 'DELETE' });
        await loadDashboard();
        showCategoryMessage('Category removed.');
      } catch (error) {
        showCategoryMessage(error.message, true);
        button.disabled = false;
      }
    });
  });
}

function renderAccounts(search = '') {
  const query = search.trim().toLowerCase();
  const accounts = dashboardData.accounts.filter(account =>
    `${account.name} ${account.phone} ${account.role}`.toLowerCase().includes(query)
  );
  document.getElementById('accountRows').innerHTML = accounts.length
    ? accounts.map(account => `
      <tr>
        <td><strong>${escapeHtml(account.name)}</strong></td>
        <td>${escapeHtml(account.phone)}</td>
        <td><span class="role">${escapeHtml(account.role)}</span></td>
        <td><span class="status ${account.verified ? 'status-active' : 'status-review'}">${account.verified ? 'Verified' : 'Unverified'}</span></td>
        <td>${account.listingCount}</td>
      </tr>
    `).join('')
    : '<tr><td class="empty-row" colspan="5">No accounts match your search.</td></tr>';
}

function renderListings(search = '') {
  const query = search.trim().toLowerCase();
  const listings = dashboardData.listings.filter(listing =>
    `${listing.title} ${listing.category} ${listing.city} ${listing.area} ${listing.status} ${listing.ownerName || ''}`.toLowerCase().includes(query)
  );
  document.getElementById('listingRows').innerHTML = listings.length
    ? listings.map(listing => `
      <tr>
        <td><strong>${escapeHtml(listing.title)}</strong></td>
        <td>${escapeHtml(listing.category)}</td>
        <td>${escapeHtml(listing.city)}, ${escapeHtml(listing.area)}</td>
        <td>ETB ${Number(listing.price).toLocaleString()} / mo</td>
        <td><span class="status ${listing.status === 'active' ? 'status-approved' : 'status-review'}">${escapeHtml(listing.status)}</span></td>
        <td>${escapeHtml(listing.ownerName || 'Unknown')}</td>
<td>${listedDate(listing.createdAt)}</td>
      </tr>
    `).join('')
    : '<tr><td class="empty-row" colspan="7">No listings match your search.</td></tr>';
}

async function loadDashboard() {
  dashboardData = await request('/api/admin/dashboard');
  document.getElementById('adminName').textContent = dashboardData.adminName;
  document.getElementById('listingStat').textContent = String(dashboardData.stats.listings);
  document.getElementById('categoryStat').textContent = String(dashboardData.stats.categories);
  document.getElementById('accountStat').textContent = String(dashboardData.stats.accounts);
  document.getElementById('pendingStat').textContent = String(dashboardData.stats.unverified);
  renderCategories();
  renderAccounts(document.getElementById('accountSearch').value);
  renderListings(document.getElementById('listingSearch').value);
  sections.forEach(section => { section.hidden = false; });
  dashboardMessage.hidden = true;
}

document.getElementById('categoryForm').addEventListener('submit', async event => {
  event.preventDefault();
  const input = document.getElementById('categoryName');
  const button = event.currentTarget.querySelector('button[type="submit"]');
  const name = input.value.trim().replace(/\s+/g, ' ');
  if (!name) {
    showCategoryMessage('Enter a category name.', true);
    return;
  }
  button.disabled = true;
  try {
    await request('/api/admin/categories', { method: 'POST', body: JSON.stringify({ name }) });
    input.value = '';
    await loadDashboard();
    showCategoryMessage(`Added "${name}".`);
  } catch (error) {
    showCategoryMessage(error.message, true);
  } finally {
    button.disabled = false;
  }
});

document.getElementById('accountSearch').addEventListener('input', event => {
  if (dashboardData) renderAccounts(event.target.value);
});
document.getElementById('listingSearch').addEventListener('input', event => {
  if (dashboardData) renderListings(event.target.value);
});

sections.forEach(section => { section.hidden = true; });
if (!token) {
  location.replace('login.html?next=admin.html');
} else {
  loadDashboard().catch(error => {
    if (error.status === 401) {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      location.replace('login.html?next=admin.html');
      return;
    }
    showDashboardMessage(error.message, error.status !== 403);
  });
}


function listedDate(v) {
  var n = Number(v);
  if (!n) return '-';
  var d = new Date(n < 1e12 ? n * 1000 : n);
  return isNaN(d) ? '-' : d.toLocaleDateString();
}

