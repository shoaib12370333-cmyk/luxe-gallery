// ---------- Auth guard ----------
(async function checkAuth() {
  try {
    const res = await fetch('/api/admin/check');
    const data = await res.json();
    if (!data.isAdmin) window.location.href = '/admin/index.html';
  } catch {
    window.location.href = '/admin/index.html';
  }
})();

function showToast(message, isError = false) {
  const toast = document.getElementById('toast');
  toast.textContent = message;
  toast.className = 'toast show' + (isError ? ' error' : '');
  setTimeout(() => toast.classList.remove('show'), 2800);
}

// ---------- Logout ----------
document.getElementById('logoutBtn').addEventListener('click', async () => {
  await fetch('/api/admin/logout', { method: 'POST' });
  window.location.href = '/admin/index.html';
});

// ================= SITE IMAGES (hero / about) =================
const siteImagesForm = document.getElementById('siteImagesForm');

async function loadSiteImagesAdmin() {
  const res = await fetch('/api/settings');
  const settings = await res.json();

  if (settings.hero_image) {
    document.getElementById('heroImagePreview').src = settings.hero_image;
    document.getElementById('heroImagePreviewWrap').style.display = 'block';
  }
  if (settings.about_image) {
    document.getElementById('aboutImagePreview').src = settings.about_image;
    document.getElementById('aboutImagePreviewWrap').style.display = 'block';
  }
}

siteImagesForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const heroFile = document.getElementById('heroImageInput').files[0];
  const aboutFile = document.getElementById('aboutImageInput').files[0];

  if (!heroFile && !aboutFile) {
    showToast('Choose at least one image to update.', true);
    return;
  }

  const formData = new FormData();
  if (heroFile) formData.append('hero_image', heroFile);
  if (aboutFile) formData.append('about_image', aboutFile);

  try {
    const res = await fetch('/api/admin/site-images', { method: 'POST', body: formData });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Could not update site images.');
    showToast('Site images updated.');
    siteImagesForm.reset();
    document.getElementById('heroImagePreviewWrap').style.display = 'none';
    document.getElementById('aboutImagePreviewWrap').style.display = 'none';
    loadSiteImagesAdmin();
  } catch (err) {
    showToast(err.message, true);
  }
});

// ================= GALLERY =================
const galleryForm = document.getElementById('galleryForm');
const galleryList = document.getElementById('galleryList');
const galleryFormBtn = document.getElementById('galleryFormBtn');
const editIdField = document.getElementById('editId');

async function loadGalleryAdmin() {
  const res = await fetch('/api/gallery');
  const items = await res.json();
  galleryList.innerHTML = '';

  if (!items.length) {
    galleryList.innerHTML = '<p class="empty-note">No pieces added yet. Use the form above to add your first one.</p>';
    return;
  }

  items.forEach(item => {
    const row = document.createElement('div');
    row.className = 'admin-list-row';
    row.innerHTML = `
      <img src="${item.image_path}" alt="">
      <div class="info">
        <strong>${escapeHtml(item.title)}</strong>
        <span>${escapeHtml(item.category || '')}${item.price ? ' · ' + escapeHtml(item.price) : ''}${item.dimensions ? ' · ' + escapeHtml(item.dimensions) : ''}</span>
      </div>
      <div class="row-actions">
        <button class="edit" data-id="${item.id}">Edit</button>
        <button class="delete" data-id="${item.id}">Delete</button>
      </div>
    `;
    row.querySelector('.edit').addEventListener('click', () => startEditGallery(item));
    row.querySelector('.delete').addEventListener('click', () => deleteGalleryItem(item.id));
    galleryList.appendChild(row);
  });
}

function startEditGallery(item) {
  editIdField.value = item.id;
  document.getElementById('itemTitle').value = item.title;
  document.getElementById('itemCategory').value = item.category || '';
  document.getElementById('itemPrice').value = item.price || '';
  document.getElementById('itemDimensions').value = item.dimensions || '';
  document.getElementById('itemDescription').value = item.description || '';
  document.getElementById('imageHint').textContent = '(leave empty to keep current image)';
  galleryFormBtn.textContent = 'Update piece';
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function resetGalleryForm() {
  galleryForm.reset();
  editIdField.value = '';
  document.getElementById('imageHint').textContent = '(JPG, PNG, or WEBP — required for new pieces)';
  galleryFormBtn.textContent = 'Add piece';
}

galleryForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const id = editIdField.value;
  const formData = new FormData();
  formData.append('title', document.getElementById('itemTitle').value);
  formData.append('category', document.getElementById('itemCategory').value);
  formData.append('price', document.getElementById('itemPrice').value);
  formData.append('dimensions', document.getElementById('itemDimensions').value);
  formData.append('description', document.getElementById('itemDescription').value);
  const fileInput = document.getElementById('itemImage');
  if (fileInput.files[0]) formData.append('image', fileInput.files[0]);

  if (!id && !fileInput.files[0]) {
    showToast('Please choose an image for a new piece.', true);
    return;
  }

  try {
    const url = id ? `/api/admin/gallery/${id}` : '/api/admin/gallery';
    const method = id ? 'PUT' : 'POST';
    const res = await fetch(url, { method, body: formData });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Something went wrong');

    showToast(id ? 'Piece updated.' : 'Piece added.');
    resetGalleryForm();
    loadGalleryAdmin();
  } catch (err) {
    showToast(err.message, true);
  }
});

async function deleteGalleryItem(id) {
  if (!confirm('Delete this piece? This cannot be undone.')) return;
  try {
    const res = await fetch(`/api/admin/gallery/${id}`, { method: 'DELETE' });
    if (!res.ok) throw new Error('Could not delete this piece.');
    showToast('Piece deleted.');
    loadGalleryAdmin();
  } catch (err) {
    showToast(err.message, true);
  }
}

// ================= REVIEWS =================
const testimonialForm = document.getElementById('testimonialForm');
const testimonialsList = document.getElementById('testimonialsList');
const testimonialFormBtn = document.getElementById('testimonialFormBtn');
const editTestimonialIdField = document.getElementById('editTestimonialId');
const pendingReviewsList = document.getElementById('pendingReviewsList');
const pendingReviewsEmpty = document.getElementById('pendingReviewsEmpty');

function starsLabel(rating) {
  const n = rating || 5;
  return '★'.repeat(n) + '☆'.repeat(5 - n);
}

async function loadTestimonialsAdmin() {
  const res = await fetch('/api/admin/testimonials');
  const items = await res.json();

  const pending = items.filter(t => t.status === 'pending');
  const approved = items.filter(t => t.status !== 'pending');

  // Pending reviews (awaiting approval)
  pendingReviewsList.innerHTML = '';
  if (!pending.length) {
    pendingReviewsEmpty.style.display = 'block';
  } else {
    pendingReviewsEmpty.style.display = 'none';
    pending.forEach(t => {
      const row = document.createElement('div');
      row.className = 'admin-list-row';
      row.innerHTML = `
        <div class="info">
          <strong>${escapeHtml(t.client_name)} <span style="font-weight:400;">(${starsLabel(t.rating)})</span></strong>
          <span>${escapeHtml(t.quote)}</span>
        </div>
        <div class="row-actions">
          <button class="edit approve-btn" data-id="${t.id}">Approve</button>
          <button class="delete" data-id="${t.id}">Reject</button>
        </div>
      `;
      row.querySelector('.approve-btn').addEventListener('click', () => approveReview(t.id));
      row.querySelector('.delete').addEventListener('click', () => rejectReview(t.id));
      pendingReviewsList.appendChild(row);
    });
  }

  // Approved reviews (already live on the site)
  testimonialsList.innerHTML = '';
  if (!approved.length) {
    testimonialsList.innerHTML = '<p class="empty-note">No reviews added yet.</p>';
    return;
  }

  approved.forEach(t => {
    const row = document.createElement('div');
    row.className = 'admin-list-row';
    row.innerHTML = `
      <div class="info">
        <strong>${escapeHtml(t.client_name)} <span style="font-weight:400;">(${starsLabel(t.rating)})</span></strong>
        <span>${escapeHtml(t.quote)}</span>
      </div>
      <div class="row-actions">
        <button class="edit" data-id="${t.id}">Edit</button>
        <button class="delete" data-id="${t.id}">Delete</button>
      </div>
    `;
    row.querySelector('.edit').addEventListener('click', () => startEditTestimonial(t));
    row.querySelector('.delete').addEventListener('click', () => deleteTestimonial(t.id));
    testimonialsList.appendChild(row);
  });
}

async function approveReview(id) {
  try {
    const res = await fetch(`/api/admin/testimonials/${id}/approve`, { method: 'POST' });
    if (!res.ok) throw new Error('Could not approve this review.');
    showToast('Review approved and now live.');
    loadTestimonialsAdmin();
  } catch (err) {
    showToast(err.message, true);
  }
}

async function rejectReview(id) {
  if (!confirm('Reject and delete this review? This cannot be undone.')) return;
  try {
    const res = await fetch(`/api/admin/testimonials/${id}/reject`, { method: 'POST' });
    if (!res.ok) throw new Error('Could not reject this review.');
    showToast('Review rejected.');
    loadTestimonialsAdmin();
  } catch (err) {
    showToast(err.message, true);
  }
}

function startEditTestimonial(t) {
  editTestimonialIdField.value = t.id;
  document.getElementById('clientName').value = t.client_name;
  document.getElementById('clientRating').value = String(t.rating || 5);
  document.getElementById('clientQuote').value = t.quote;
  testimonialFormBtn.textContent = 'Update review';
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

testimonialForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const id = editTestimonialIdField.value;
  const payload = {
    client_name: document.getElementById('clientName').value,
    rating: document.getElementById('clientRating').value,
    quote: document.getElementById('clientQuote').value
  };

  try {
    const url = id ? `/api/admin/testimonials/${id}` : '/api/admin/testimonials';
    const method = id ? 'PUT' : 'POST';
    const res = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Something went wrong');

    showToast(id ? 'Review updated.' : 'Review added.');
    testimonialForm.reset();
    editTestimonialIdField.value = '';
    testimonialFormBtn.textContent = 'Add review';
    loadTestimonialsAdmin();
  } catch (err) {
    showToast(err.message, true);
  }
});

async function deleteTestimonial(id) {
  if (!confirm('Delete this review?')) return;
  try {
    const res = await fetch(`/api/admin/testimonials/${id}`, { method: 'DELETE' });
    if (!res.ok) throw new Error('Could not delete this review.');
    showToast('Review deleted.');
    loadTestimonialsAdmin();
  } catch (err) {
    showToast(err.message, true);
  }
}

// ================= SETTINGS =================
const settingsForm = document.getElementById('settingsForm');
const announcementForm = document.getElementById('announcementForm');

async function loadSettingsAdmin() {
  const res = await fetch('/api/settings');
  const settings = await res.json();
  document.getElementById('whatsappNumber').value = settings.whatsapp_number || '';
  document.getElementById('facebookUrl').value = settings.facebook_url || '';
  document.getElementById('instagramUrl').value = settings.instagram_url || '';
  document.getElementById('announcementText').value = settings.announcement_text || '';
  document.getElementById('announcementEnabled').checked = settings.announcement_enabled === '1';
}

settingsForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  try {
    const res = await fetch('/api/admin/settings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        whatsapp_number: document.getElementById('whatsappNumber').value,
        facebook_url: document.getElementById('facebookUrl').value,
        instagram_url: document.getElementById('instagramUrl').value
      })
    });
    if (!res.ok) throw new Error('Could not save settings.');
    showToast('Settings saved.');
  } catch (err) {
    showToast(err.message, true);
  }
});

announcementForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  try {
    const res = await fetch('/api/admin/settings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        announcement_text: document.getElementById('announcementText').value,
        announcement_enabled: document.getElementById('announcementEnabled').checked ? '1' : '0'
      })
    });
    if (!res.ok) throw new Error('Could not save announcement bar.');
    showToast('Announcement bar saved.');
  } catch (err) {
    showToast(err.message, true);
  }
});

// ================= PASSWORD =================
document.getElementById('passwordForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const currentPassword = document.getElementById('currentPassword').value;
  const newPassword = document.getElementById('newPassword').value;

  try {
    const res = await fetch('/api/admin/change-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ currentPassword, newPassword })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Could not update password.');
    showToast('Password updated.');
    e.target.reset();
  } catch (err) {
    showToast(err.message, true);
  }
});

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str || '';
  return div.innerHTML;
}

// ---------- Init ----------
loadSiteImagesAdmin();
loadGalleryAdmin();
loadTestimonialsAdmin();
loadSettingsAdmin();
