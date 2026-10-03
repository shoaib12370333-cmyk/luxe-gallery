// Fetches gallery items, testimonials, and site settings from the backend
// and renders them into the page. Also drives the product detail modal.

let siteSettings = {};
let galleryItems = [];
let visibleItems = [];   // items currently shown (after category filter)
let currentModalIndex = -1;
let lastFocusedEl = null;

async function loadGallery() {
  const grid = document.getElementById('galleryGrid');
  const emptyMsg = document.getElementById('galleryEmpty');
  try {
    const res = await fetch('/api/gallery');
    galleryItems = await res.json();
    grid.querySelectorAll('.skeleton').forEach(s => s.remove());

    const stat = document.getElementById('statPieces');
    if (stat) stat.textContent = galleryItems.length;

    if (!galleryItems.length) {
      emptyMsg.style.display = 'block';
      return;
    }

    galleryItems.forEach((item, i) => {
      const el = document.createElement('article');
      el.className = 'gallery-item reveal';
      el.dataset.category = item.category || '';
      el.style.setProperty('--d', `${Math.min(i % 3, 2) * 0.08}s`);
      el.tabIndex = 0;
      el.setAttribute('role', 'button');
      el.setAttribute('aria-label', `View details for ${item.title}`);
      el.innerHTML = `
        <div class="frame">
          <img src="${item.image_path}" alt="${escapeHtml(item.title)}" loading="lazy">
          ${item.category ? `<span class="tag">${escapeHtml(item.category)}</span>` : ''}
          <span class="view" aria-hidden="true">&#8599;</span>
        </div>
        <div class="caption">
          <h3>${escapeHtml(item.title)}</h3>
          <span>${item.price ? escapeHtml(formatPrice(item.price)) : ''}</span>
        </div>
      `;
      const img = el.querySelector('img');
      if (img.complete) img.classList.add('loaded');
      else {
        img.addEventListener('load', () => img.classList.add('loaded'));
        img.addEventListener('error', () => img.classList.add('loaded'));
      }
      el.addEventListener('click', () => openProductModal(item));
      el.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openProductModal(item); }
      });
      item._el = el;
      grid.appendChild(el);
    });

    buildFilters();
    applyFilter('all', false);
    observeReveals();
  } catch (err) {
    console.error('Could not load gallery items:', err);
    grid.querySelectorAll('.skeleton').forEach(s => s.remove());
    emptyMsg.textContent = 'The collection could not be loaded right now.';
    emptyMsg.style.display = 'block';
  }
}

// ---- Category filters ----
function buildFilters() {
  const wrap = document.getElementById('galleryFilters');
  const cats = [...new Set(galleryItems.map(i => (i.category || '').trim()).filter(Boolean))];
  if (cats.length < 2) return; // nothing worth filtering
  wrap.style.display = 'flex';
  wrap.innerHTML = '';
  ['all', ...cats].forEach(cat => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'filter-chip' + (cat === 'all' ? ' active' : '');
    b.textContent = cat === 'all' ? 'All' : cat;
    b.dataset.cat = cat;
    b.setAttribute('role', 'tab');
    b.addEventListener('click', () => {
      wrap.querySelectorAll('.filter-chip').forEach(c => c.classList.toggle('active', c === b));
      applyFilter(cat);
    });
    wrap.appendChild(b);
  });
}

function applyFilter(cat, instant = true) {
  visibleItems = [];
  galleryItems.forEach(item => {
    const show = cat === 'all' || (item.category || '').trim() === cat;
    item._el.classList.toggle('is-hidden', !show);
    for (let s = 0; s < 4; s++) item._el.classList.remove('slot-' + s);
    if (show) {
      item._el.classList.add('slot-' + (visibleItems.length % 4));
      visibleItems.push(item);
      // cards revealed by a filter click show right away (no scroll trigger needed)
      if (instant) requestAnimationFrame(() => item._el.classList.add('is-visible'));
    }
  });
  const count = document.getElementById('workCount');
  if (count) count.textContent = `${visibleItems.length} ${visibleItems.length === 1 ? 'piece' : 'pieces'}`;
}

function formatPrice(price) {
  const trimmed = String(price).trim();
  if (!trimmed) return '';
  // If it's purely numeric, prefix with Rs.; otherwise show as entered.
  return /^[\d,]+$/.test(trimmed) ? `Rs. ${trimmed}` : trimmed;
}

// ================= PRODUCT MODAL =================

function openProductModal(item) {
  const modal = document.getElementById('productModal');
  if (!modal.classList.contains('is-open')) lastFocusedEl = document.activeElement;
  currentModalIndex = visibleItems.indexOf(item);
  const multi = visibleItems.length > 1;
  document.querySelector('.modal-nav').style.display = multi ? 'flex' : 'none';

  document.getElementById('modalImage').src = item.image_path;
  document.getElementById('modalImage').alt = item.title;
  document.getElementById('modalCategory').textContent = item.category || '';
  document.getElementById('modalTitle').textContent = item.title;
  document.getElementById('modalPrice').textContent = item.price ? formatPrice(item.price) : '';
  document.getElementById('modalPrice').style.display = item.price ? 'block' : 'none';
  document.getElementById('modalDescription').textContent = item.description || '';

  const dimWrap = document.getElementById('modalDimensionsWrap');
  const dimContainer = document.getElementById('modalDimensions');
  dimContainer.innerHTML = '';

  const dims = (item.dimensions || '').split(',').map(d => d.trim()).filter(Boolean);
  let selectedDim = '';
  if (dims.length) {
    dimWrap.style.display = 'block';
    dims.forEach((dim, i) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'dim-option' + (i === 0 ? ' selected' : '');
      btn.textContent = dim;
      btn.addEventListener('click', () => {
        dimContainer.querySelectorAll('.dim-option').forEach(b => b.classList.remove('selected'));
        btn.classList.add('selected');
        selectedDim = dim;
        updateModalWhatsappLink(item, selectedDim);
      });
      dimContainer.appendChild(btn);
    });
    selectedDim = dims[0];
  } else {
    dimWrap.style.display = 'none';
  }

  updateModalWhatsappLink(item, selectedDim);

  modal.classList.add('is-open');
  modal.setAttribute('aria-hidden', 'false');
  document.body.classList.add('modal-open');
  document.getElementById('productModalClose').focus({ preventScroll: true });
}

function stepModal(dir) {
  if (currentModalIndex < 0 || visibleItems.length < 2) return;
  const next = (currentModalIndex + dir + visibleItems.length) % visibleItems.length;
  openProductModal(visibleItems[next]);
}

function updateModalWhatsappLink(item, selectedDim) {
  const waBtn = document.getElementById('modalWhatsappBtn');
  const number = siteSettings.whatsapp_number ? siteSettings.whatsapp_number.replace(/[^0-9]/g, '') : '';

  let message = `Hi, I'm interested in "${item.title}"`;
  if (selectedDim) message += ` — ${selectedDim}`;
  if (item.price) message += `, ${formatPrice(item.price)}`;

  if (number) {
    waBtn.href = `https://wa.me/${number}?text=${encodeURIComponent(message)}`;
  } else {
    waBtn.href = '#contact';
    waBtn.title = 'WhatsApp number not set up yet';
  }
}

function closeProductModal() {
  const modal = document.getElementById('productModal');
  modal.classList.remove('is-open');
  modal.setAttribute('aria-hidden', 'true');
  document.body.classList.remove('modal-open');
  if (lastFocusedEl && lastFocusedEl.focus) lastFocusedEl.focus({ preventScroll: true });
  lastFocusedEl = null;
}

document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('productModalClose').addEventListener('click', closeProductModal);
  document.getElementById('productModalBackdrop').addEventListener('click', closeProductModal);
  document.getElementById('modalPrev').addEventListener('click', () => stepModal(-1));
  document.getElementById('modalNext').addEventListener('click', () => stepModal(1));
  document.addEventListener('keydown', (e) => {
    const open = document.getElementById('productModal').classList.contains('is-open');
    if (!open) return;
    if (e.key === 'Escape') closeProductModal();
    else if (e.key === 'ArrowLeft') stepModal(-1);
    else if (e.key === 'ArrowRight') stepModal(1);
    else if (e.key === 'Tab') {
      // keep keyboard focus inside the dialog
      const focusable = document.querySelectorAll('#productModal .product-modal-panel button, #productModal .product-modal-panel a[href]');
      const list = [...focusable].filter(el => el.offsetParent !== null);
      if (!list.length) return;
      const first = list[0], last = list[list.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    }
  });

  // swipe left/right on the modal image (touch devices)
  const panel = document.querySelector('.product-modal-image');
  let touchX = null;
  panel.addEventListener('touchstart', (e) => { touchX = e.touches[0].clientX; }, { passive: true });
  panel.addEventListener('touchend', (e) => {
    if (touchX === null) return;
    const dx = e.changedTouches[0].clientX - touchX;
    touchX = null;
    if (Math.abs(dx) > 50) stepModal(dx < 0 ? 1 : -1);
  }, { passive: true });
});

// ================= TESTIMONIALS =================

async function loadTestimonials() {
  const track = document.getElementById('testimonialsTrack');
  try {
    const res = await fetch('/api/testimonials');
    const items = await res.json();

    if (!items.length) {
      track.innerHTML = '<p class="testimonial-empty">Reviews will appear here soon.</p>';
      return;
    }

    items.forEach((t, i) => {
      const el = document.createElement('div');
      el.className = 'testimonial-card reveal';
      el.style.setProperty('--d', `${(i % 3) * 0.1}s`);
      const initial = escapeHtml((t.client_name || '?').trim().charAt(0).toUpperCase());
      el.innerHTML = `
        <div class="stars-display">${renderStars(t.rating || 5)}</div>
        <p class="quote">&ldquo;${escapeHtml(t.quote)}&rdquo;</p>
        <div class="who"><span class="avatar" aria-hidden="true">${initial}</span><p class="name">${escapeHtml(t.client_name)}</p></div>
      `;
      track.appendChild(el);
    });

    // average rating summary
    const summary = document.getElementById('ratingSummary');
    if (summary) {
      const avg = items.reduce((s, t) => s + (Number(t.rating) || 5), 0) / items.length;
      summary.innerHTML = `
        <strong>${avg.toFixed(1)}</strong>
        <div><div class="stars-display" style="margin:0">${renderStars(avg)}</div>
        <small>from ${items.length} ${items.length === 1 ? 'review' : 'reviews'}</small></div>`;
      summary.style.display = 'flex';
    }

    observeReveals();
  } catch (err) {
    console.error('Could not load testimonials:', err);
  }
}

function renderStars(rating) {
  const filled = Math.max(0, Math.min(5, Math.round(rating)));
  let html = '';
  for (let i = 1; i <= 5; i++) {
    html += `<span class="star ${i <= filled ? 'filled' : ''}">&#9733;</span>`;
  }
  return html;
}

// ================= REVIEW SUBMISSION FORM =================

document.addEventListener('DOMContentLoaded', () => {
  const starInput = document.getElementById('starInput');
  const ratingField = document.getElementById('reviewRating');
  const reviewForm = document.getElementById('reviewForm');
  const reviewFormError = document.getElementById('reviewFormError');

  if (starInput) {
    const starButtons = starInput.querySelectorAll('.star-btn');

    function setStars(value) {
      ratingField.value = value;
      starButtons.forEach(btn => {
        btn.classList.toggle('active', parseInt(btn.dataset.value, 10) <= value);
      });
    }

    starButtons.forEach(btn => {
      btn.addEventListener('click', () => setStars(parseInt(btn.dataset.value, 10)));
    });

    setStars(5); // default selection
  }

  if (reviewForm) {
    reviewForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      reviewFormError.textContent = '';

      const name = document.getElementById('reviewName').value.trim();
      const quote = document.getElementById('reviewText').value.trim();
      const rating = document.getElementById('reviewRating').value;

      const submitBtn = document.getElementById('reviewFormSubmit');
      submitBtn.disabled = true;
      submitBtn.textContent = 'Submitting...';

      try {
        const res = await fetch('/api/reviews', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ client_name: name, quote, rating })
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Could not submit your review.');

        reviewForm.reset();
        document.getElementById('starInput').querySelectorAll('.star-btn').forEach(btn => {
          btn.classList.toggle('active', parseInt(btn.dataset.value, 10) <= 5);
        });
        document.getElementById('reviewRating').value = 5;

        reviewFormError.style.color = 'var(--taupe)';
        reviewFormError.textContent = 'Thank you — your review has been submitted and will appear here once approved.';
      } catch (err) {
        reviewFormError.style.color = '#e0a99b';
        reviewFormError.textContent = err.message;
      } finally {
        submitBtn.disabled = false;
        submitBtn.textContent = 'Submit review';
      }
    });
  }
});

// ================= SETTINGS: WhatsApp, Announcement bar, Social links =================

async function loadSettings() {
  try {
    const res = await fetch('/api/settings');
    siteSettings = await res.json();

    // Hero and about images
    const heroImg = document.getElementById('heroImage');
    if (heroImg && siteSettings.hero_image) heroImg.src = siteSettings.hero_image;
    const aboutImg = document.getElementById('aboutImage');
    if (aboutImg && siteSettings.about_image) aboutImg.src = siteSettings.about_image;

    // Main contact WhatsApp button
    const waBtn = document.getElementById('whatsappBtn');
    if (siteSettings.whatsapp_number) {
      const digitsOnly = siteSettings.whatsapp_number.replace(/[^0-9]/g, '');
      waBtn.href = `https://wa.me/${digitsOnly}`;
    } else {
      waBtn.href = '#contact';
      waBtn.title = 'WhatsApp number not set up yet';
    }

    // Announcement bar
    const bar = document.getElementById('announcementBar');
    const text = document.getElementById('announcementText');
    if (siteSettings.announcement_enabled === '1' && siteSettings.announcement_text) {
      text.textContent = siteSettings.announcement_text;
      bar.style.display = 'block';
      document.body.classList.add('has-announcement');
    } else {
      bar.style.display = 'none';
      document.body.classList.remove('has-announcement');
    }

    // Social links (header + footer)
    renderSocialLinks('socialLinks');
    renderSocialLinks('footerSocialLinks');
    renderSocialLinks('mobileSocialLinks');

  } catch (err) {
    console.error('Could not load site settings:', err);
  }
}

function renderSocialLinks(containerId) {
  const container = document.getElementById(containerId);
  if (!container) return;
  container.innerHTML = '';

  const links = [];
  if (siteSettings.whatsapp_number) {
    links.push({
      url: `https://wa.me/${siteSettings.whatsapp_number.replace(/[^0-9]/g, '')}`,
      label: 'WhatsApp',
      icon: `<svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor"><path d="M12.04 2C6.58 2 2.13 6.45 2.13 11.91c0 1.75.46 3.48 1.32 4.99L2 22l5.25-1.38a9.9 9.9 0 0 0 4.79 1.22h.01c5.46 0 9.91-4.45 9.91-9.91 0-2.65-1.03-5.14-2.9-7.01A9.86 9.86 0 0 0 12.04 2zm0 1.67c2.2 0 4.27.86 5.82 2.42a8.18 8.18 0 0 1 2.41 5.82c0 4.54-3.7 8.24-8.24 8.24a8.24 8.24 0 0 1-4.2-1.15l-.3-.18-3.12.82.83-3.04-.2-.32a8.2 8.2 0 0 1-1.26-4.38c0-4.54 3.7-8.23 8.26-8.23zm-4.53 4.6c-.16 0-.42.06-.64.3-.22.24-.85.83-.85 2.02s.87 2.35.99 2.51c.12.16 1.7 2.72 4.2 3.7 2.08.82 2.5.66 2.95.62.45-.04 1.45-.59 1.65-1.16.2-.57.2-1.06.14-1.16-.06-.1-.22-.16-.46-.28-.24-.12-1.45-.72-1.67-.8-.22-.08-.39-.12-.55.12-.16.24-.63.8-.78.96-.14.16-.28.18-.52.06-.24-.12-1.02-.38-1.94-1.2-.72-.64-1.2-1.44-1.34-1.68-.14-.24-.01-.37.11-.49.11-.11.24-.28.36-.42.12-.14.16-.24.24-.4.08-.16.04-.3-.02-.42-.06-.12-.55-1.35-.76-1.84-.2-.48-.4-.42-.55-.42h-.36z"/></svg>`
    });
  }
  if (siteSettings.facebook_url) {
    links.push({
      url: siteSettings.facebook_url,
      label: 'Facebook',
      icon: `<svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor"><path d="M22 12.06C22 6.5 17.52 2 12 2S2 6.5 2 12.06c0 5 3.66 9.15 8.44 9.94v-7.03H7.9v-2.9h2.54V9.85c0-2.51 1.49-3.9 3.77-3.9 1.09 0 2.24.2 2.24.2v2.46h-1.26c-1.24 0-1.63.77-1.63 1.56v1.88h2.78l-.44 2.9h-2.34V22c4.78-.79 8.44-4.94 8.44-9.94z"/></svg>`
    });
  }
  if (siteSettings.instagram_url) {
    links.push({
      url: siteSettings.instagram_url,
      label: 'Instagram',
      icon: `<svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor"><path d="M12 2c2.72 0 3.06.01 4.12.06 1.06.05 1.79.22 2.43.47.66.26 1.21.6 1.76 1.15.55.55.9 1.1 1.15 1.76.25.64.42 1.37.47 2.43.05 1.06.06 1.4.06 4.12s-.01 3.06-.06 4.12c-.05 1.06-.22 1.79-.47 2.43-.26.66-.6 1.21-1.15 1.76-.55.55-1.1.9-1.76 1.15-.64.25-1.37.42-2.43.47-1.06.05-1.4.06-4.12.06s-3.06-.01-4.12-.06c-1.06-.05-1.79-.22-2.43-.47-.66-.26-1.21-.6-1.76-1.15-.55-.55-.9-1.1-1.15-1.76-.25-.64-.42-1.37-.47-2.43C2.01 15.06 2 14.72 2 12s.01-3.06.06-4.12c.05-1.06.22-1.79.47-2.43.26-.66.6-1.21 1.15-1.76.55-.55 1.1-.9 1.76-1.15.64-.25 1.37-.42 2.43-.47C8.94 2.01 9.28 2 12 2zm0 1.8c-2.67 0-2.99.01-4.04.06-.87.04-1.34.18-1.65.3-.42.16-.71.35-1.02.66-.31.31-.5.6-.66 1.02-.12.31-.26.78-.3 1.65C4.28 8.5 4.27 8.82 4.27 11.5v1c0 2.67.01 2.99.06 4.04.04.87.18 1.34.3 1.65.16.42.35.71.66 1.02.31.31.6.5 1.02.66.31.12.78.26 1.65.3 1.05.05 1.37.06 4.04.06s2.99-.01 4.04-.06c.87-.04 1.34-.18 1.65-.3.42-.16.71-.35 1.02-.66.31-.31.5-.6.66-1.02.12-.31.26-.78.3-1.65.05-1.05.06-1.37.06-4.04s-.01-2.99-.06-4.04c-.04-.87-.18-1.34-.3-1.65a2.76 2.76 0 0 0-.66-1.02 2.76 2.76 0 0 0-1.02-.66c-.31-.12-.78-.26-1.65-.3C14.99 3.81 14.67 3.8 12 3.8zm0 3.2a5 5 0 1 1 0 10 5 5 0 0 1 0-10zm0 1.8a3.2 3.2 0 1 0 0 6.4 3.2 3.2 0 0 0 0-6.4zm5.2-2.1a1.17 1.17 0 1 1-2.34 0 1.17 1.17 0 0 1 2.34 0z"/></svg>`
    });
  }

  links.forEach(link => {
    const a = document.createElement('a');
    a.href = link.url;
    a.target = '_blank';
    a.rel = 'noopener';
    a.className = 'social-icon';
    a.setAttribute('aria-label', link.label);
    a.innerHTML = link.icon;
    container.appendChild(a);
  });
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str || '';
  return div.innerHTML;
}

function observeReveals() {
  const items = document.querySelectorAll('.reveal:not(.observed)');
  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('is-visible');
        observer.unobserve(entry.target);
      }
    });
  }, { threshold: 0.15 });

  items.forEach(item => {
    item.classList.add('observed');
    observer.observe(item);
  });
}

document.addEventListener('DOMContentLoaded', () => {
  observeReveals(); // static sections (about, process, contact) — dynamic ones re-observe after loading
  loadSettings().then(() => {
    loadGallery();
  });
  loadTestimonials();
});
