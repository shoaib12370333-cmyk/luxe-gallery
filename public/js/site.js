/* =====================================================================
   LUXE GALLERY — public site behaviour
   Data comes from the same API as before:
   /api/settings, /api/gallery, /api/testimonials, POST /api/reviews
   ===================================================================== */
(() => {
  'use strict';

  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
  const pad2 = (n) => String(n).padStart(2, '0');
  const esc = (s) => { const d = document.createElement('div'); d.textContent = s == null ? '' : String(s); return d.innerHTML; };
  const safe = (fn) => { try { return fn(); } catch (e) { return null; } };

  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const fine = matchMedia('(hover: hover) and (pointer: fine)').matches;
  const body = document.body;

  const state = { settings: {}, items: [], visible: [], cur: -1, selectedDim: '' };

  /* ------------------------------------------------------------------
     LOADER
     ------------------------------------------------------------------ */
  function startLoader() {
    const loader = $('#loader');
    const ready = () => {
      if (body.classList.contains('is-ready')) return;
      body.classList.remove('is-loading');
      body.classList.add('is-ready');
      safe(() => sessionStorage.setItem('lg-seen', '1'));
      setTimeout(() => { loader.style.display = 'none'; }, 1300);
    };

    const seen = safe(() => sessionStorage.getItem('lg-seen'));
    if (reduce) { loader.style.display = 'none'; ready(); return; }
    if (seen) {
      loader.style.display = 'none';
      requestAnimationFrame(() => requestAnimationFrame(ready)); // let first paint happen so the hero animates in
      setTimeout(ready, 700); // rAF is paused in background tabs — don't depend on it alone
      return;
    }

    const countEl = $('#loaderCount');
    const bar = $('#loaderBar');
    const MIN = 1500;
    const t0 = performance.now();
    let fontsReady = false;
    (document.fonts && document.fonts.ready ? document.fonts.ready : Promise.resolve()).then(() => { fontsReady = true; });

    function tick(now) {
      const elapsed = now - t0;
      let p = clamp(elapsed / MIN, 0, 1);
      p = 1 - Math.pow(1 - p, 3);
      if (!fontsReady && p > 0.9) p = 0.9; // hold near the end until fonts are in
      countEl.textContent = Math.round(p * 100);
      bar.style.transform = `scaleX(${p})`;
      if (p >= 1 || elapsed > 4000) { countEl.textContent = '100'; bar.style.transform = 'scaleX(1)'; setTimeout(ready, 250); return; }
      requestAnimationFrame(tick);
    }
    requestAnimationFrame(tick);
    setTimeout(ready, 5000); // failsafe — never trap the visitor behind the loader
  }

  /* ------------------------------------------------------------------
     REVEAL ON SCROLL
     ------------------------------------------------------------------ */
  let revealIO = null;
  function observeReveals() {
    const els = $$('.rv:not([data-obs])');
    if (!('IntersectionObserver' in window)) { els.forEach(e => e.classList.add('is-in')); return; }
    if (!revealIO) {
      revealIO = new IntersectionObserver((entries) => {
        entries.forEach(en => { if (en.isIntersecting) { en.target.classList.add('is-in'); revealIO.unobserve(en.target); } });
      }, { threshold: 0.12, rootMargin: '0px 0px -6% 0px' });
    }
    els.forEach(e => { e.setAttribute('data-obs', '1'); revealIO.observe(e); });
  }

  /* ------------------------------------------------------------------
     CURSOR + MAGNETIC BUTTONS (fine pointers only)
     ------------------------------------------------------------------ */
  const mouse = { x: -100, y: -100, cx: -100, cy: -100, nx: 0, ny: 0, hx: 0, hy: 0 };
  const cursorEl = $('#cursor');
  const cursorLabel = $('#cursorLabel');

  function initPointer() {
    if (!fine) return;
    document.documentElement.classList.add('has-cursor');

    window.addEventListener('pointermove', (e) => {
      mouse.x = e.clientX; mouse.y = e.clientY;
      mouse.nx = (e.clientX / innerWidth - 0.5) * 2;
      mouse.ny = (e.clientY / innerHeight - 0.5) * 2;
      cursorEl.classList.remove('is-hidden');
    }, { passive: true });
    document.addEventListener('mouseleave', () => cursorEl.classList.add('is-hidden'));
    window.addEventListener('pointerdown', () => cursorEl.classList.add('is-down'));
    window.addEventListener('pointerup', () => cursorEl.classList.remove('is-down'));

    document.addEventListener('mouseover', (e) => {
      const t = e.target.closest ? e.target : null;
      if (!t) return;
      const labelEl = t.closest('[data-cursor], .card');
      if (labelEl) {
        cursorLabel.textContent = labelEl.dataset.cursor || 'View';
        cursorEl.classList.add('has-label');
        cursorEl.classList.remove('is-hover');
      } else {
        cursorEl.classList.remove('has-label');
        cursorEl.classList.toggle('is-hover', !!t.closest('a, button, label, [data-magnetic]'));
      }
    });

    // magnetic pull
    $$('[data-magnetic]').forEach(el => {
      el.addEventListener('pointermove', (e) => {
        const r = el.getBoundingClientRect();
        const dx = (e.clientX - (r.left + r.width / 2)) * 0.32;
        const dy = (e.clientY - (r.top + r.height / 2)) * 0.32;
        el.style.setProperty('--mx', dx.toFixed(1) + 'px');
        el.style.setProperty('--my', dy.toFixed(1) + 'px');
      });
      el.addEventListener('pointerleave', () => { el.style.setProperty('--mx', '0px'); el.style.setProperty('--my', '0px'); });
    });
  }

  /* ------------------------------------------------------------------
     HEADER, PROGRESS, HERO PARALLAX, MANIFESTO
     ------------------------------------------------------------------ */
  const header = $('#siteHeader');
  const progressEl = $('#progress');
  const hero = $('#hero');
  const manifesto = $('#manifestoText');
  let mWords = [];
  let mLit = -1;
  let lastY = scrollY;
  const lightSecs = [$('#about'), $('#contact')].filter(Boolean);

  function initManifesto() {
    if (!manifesto) return;
    const words = manifesto.textContent.trim().split(/\s+/);
    manifesto.innerHTML = words.map(w => `<span class="mw">${esc(w)}</span>`).join(' ');
    mWords = $$('.mw', manifesto);
  }

  function updateManifesto() {
    if (!mWords.length || reduce) return;
    const r = manifesto.getBoundingClientRect();
    const p = clamp((innerHeight * 0.9 - r.top) / (r.height + innerHeight * 0.4), 0, 1);
    const n = Math.round(p * mWords.length);
    if (n === mLit) return;
    mWords.forEach((w, i) => w.classList.toggle('on', i < n));
    mLit = n;
  }

  /* ------------------------------------------------------------------
     SHOWCASE (pinned horizontal scroller on wide screens, native swipe on small)
     ------------------------------------------------------------------ */
  const sc = $('#work');
  const track = $('#galleryTrack');
  const scBar = $('#showcaseBar');
  const scIndex = $('#workIndex');
  const scTotal = $('#workTotal');
  const scHint = $('#showcaseHint');
  let pinned = false;
  let dist = 0;
  let pTarget = 0;
  let pCur = 0;

  function measure() {
    const want = innerWidth > 900 && innerHeight >= 540 && !reduce && state.visible.length > 0;
    sc.classList.toggle('is-pinned', want);
    if (!want) { pinned = false; sc.style.height = ''; track.style.transform = ''; return; }
    dist = Math.max(0, track.scrollWidth - innerWidth);
    if (dist < 40) { sc.classList.remove('is-pinned'); pinned = false; sc.style.height = ''; track.style.transform = ''; return; }
    sc.style.height = (innerHeight + dist) + 'px';
    pinned = true;
    if (scHint) scHint.firstChild.textContent = 'Scroll to explore ';
  }

  let measureQueued = false;
  function queueMeasure() {
    if (measureQueued) return;
    measureQueued = true;
    requestAnimationFrame(() => { measureQueued = false; measure(); readScroll(); });
  }

  function updateShowcaseCounter(p) {
    const n = state.visible.length;
    if (!n) { scIndex.textContent = '00'; return; }
    scIndex.textContent = pad2(clamp(Math.round(p * (n - 1)) + 1, 1, n));
    scBar.style.transform = `scaleX(${clamp(p, 0, 1)})`;
  }

  function readScroll() {
    if (pinned) {
      const top = sc.getBoundingClientRect().top;
      pTarget = dist > 0 ? clamp(-top / dist, 0, 1) : 0;
    } else {
      const max = track.scrollWidth - track.clientWidth;
      pTarget = max > 0 ? clamp(track.scrollLeft / max, 0, 1) : 0;
      pCur = pTarget;
      updateShowcaseCounter(pCur);
    }
  }

  // scroll a card into view (keyboard focus / filter changes)
  function revealCard(el) {
    if (!pinned) { el.scrollIntoView({ inline: 'center', block: 'nearest', behavior: reduce ? 'auto' : 'smooth' }); return; }
    const center = el.offsetLeft + el.offsetWidth / 2;
    const t = clamp(center - innerWidth / 2, 0, dist);
    window.scrollTo({ top: sc.offsetTop + t, behavior: 'auto' });
  }

  /* ------------------------------------------------------------------
     MAIN FRAME LOOP (one rAF handles every smoothed effect)
     ------------------------------------------------------------------ */
  function onScroll() {
    const y = scrollY;
    const max = document.documentElement.scrollHeight - innerHeight;
    progressEl.style.transform = `scaleX(${max > 0 ? clamp(y / max, 0, 1) : 0})`;

    if (!body.classList.contains('menu-open') && !body.classList.contains('viewer-open')) {
      const d = y - lastY;
      if (d > 6 && y > 240) header.classList.add('is-hidden');
      else if (d < -6 || y <= 240) header.classList.remove('is-hidden');
    }
    lastY = y;

    // header turns dark while it sits over a light section
    const probe = header.getBoundingClientRect().top + header.offsetHeight / 2;
    header.classList.toggle('on-light', lightSecs.some(s => { const r = s.getBoundingClientRect(); return r.top <= probe && r.bottom >= probe; }));

    if (!reduce && y < innerHeight * 1.3) hero.style.setProperty('--py', (y * 0.2).toFixed(1) + 'px');
    updateManifesto();
    readScroll();
  }

  function frame() {
    // cursor
    if (fine) {
      mouse.cx += (mouse.x - mouse.cx) * 0.2;
      mouse.cy += (mouse.y - mouse.cy) * 0.2;
      cursorEl.style.transform = `translate3d(${mouse.cx.toFixed(1)}px, ${mouse.cy.toFixed(1)}px, 0) translate(-50%, -50%)`;
      if (!reduce && scrollY < innerHeight) {
        mouse.hx += (mouse.nx - mouse.hx) * 0.06;
        mouse.hy += (mouse.ny - mouse.hy) * 0.06;
        hero.style.setProperty('--hx', mouse.hx.toFixed(3));
        hero.style.setProperty('--hy', mouse.hy.toFixed(3));
      }
    }
    // showcase smoothing
    if (pinned) {
      const diff = pTarget - pCur;
      if (Math.abs(diff) > 0.0002) {
        pCur += diff * 0.12;
        track.style.transform = `translate3d(${(-pCur * dist).toFixed(1)}px, 0, 0)`;
        updateShowcaseCounter(pCur);
      }
    }
    requestAnimationFrame(frame);
  }

  /* ------------------------------------------------------------------
     DATA: settings
     ------------------------------------------------------------------ */
  const WA_PATH = 'M12.04 2C6.58 2 2.13 6.45 2.13 11.91c0 1.75.46 3.48 1.32 4.99L2 22l5.25-1.38a9.9 9.9 0 0 0 4.79 1.22h.01c5.46 0 9.91-4.45 9.91-9.91 0-2.65-1.03-5.14-2.9-7.01A9.86 9.86 0 0 0 12.04 2zm0 1.67c2.2 0 4.27.86 5.82 2.42a8.18 8.18 0 0 1 2.41 5.82c0 4.54-3.7 8.24-8.24 8.24a8.24 8.24 0 0 1-4.2-1.15l-.3-.18-3.12.82.83-3.04-.2-.32a8.2 8.2 0 0 1-1.26-4.38c0-4.54 3.7-8.23 8.26-8.23zm-4.53 4.6c-.16 0-.42.06-.64.3-.22.24-.85.83-.85 2.02s.87 2.35.99 2.51c.12.16 1.7 2.72 4.2 3.7 2.08.82 2.5.66 2.95.62.45-.04 1.45-.59 1.65-1.16.2-.57.2-1.06.14-1.16-.06-.1-.22-.16-.46-.28-.24-.12-1.45-.72-1.67-.8-.22-.08-.39-.12-.55.12-.16.24-.63.8-.78.96-.14.16-.28.18-.52.06-.24-.12-1.02-.38-1.94-1.2-.72-.64-1.2-1.44-1.34-1.68-.14-.24-.01-.37.11-.49.11-.11.24-.28.36-.42.12-.14.16-.24.24-.4.08-.16.04-.3-.02-.42-.06-.12-.55-1.35-.76-1.84-.2-.48-.4-.42-.55-.42h-.36z';
  const FB_PATH = 'M22 12.06C22 6.5 17.52 2 12 2S2 6.5 2 12.06c0 5 3.66 9.15 8.44 9.94v-7.03H7.9v-2.9h2.54V9.85c0-2.51 1.49-3.9 3.77-3.9 1.09 0 2.24.2 2.24.2v2.46h-1.26c-1.24 0-1.63.77-1.63 1.56v1.88h2.78l-.44 2.9h-2.34V22c4.78-.79 8.44-4.94 8.44-9.94z';
  const IG_PATH = 'M12 2c2.72 0 3.06.01 4.12.06 1.06.05 1.79.22 2.43.47.66.26 1.21.6 1.76 1.15.55.55.9 1.1 1.15 1.76.25.64.42 1.37.47 2.43.05 1.06.06 1.4.06 4.12s-.01 3.06-.06 4.12c-.05 1.06-.22 1.79-.47 2.43-.26.66-.6 1.21-1.15 1.76-.55.55-1.1.9-1.76 1.15-.64.25-1.37.42-2.43.47-1.06.05-1.4.06-4.12.06s-3.06-.01-4.12-.06c-1.06-.05-1.79-.22-2.43-.47-.66-.26-1.21-.6-1.76-1.15-.55-.55-.9-1.1-1.15-1.76-.25-.64-.42-1.37-.47-2.43C2.01 15.06 2 14.72 2 12s.01-3.06.06-4.12c.05-1.06.22-1.79.47-2.43.26-.66.6-1.21 1.15-1.76.55-.55 1.1-.9 1.76-1.15.64-.25 1.37-.42 2.43-.47C8.94 2.01 9.28 2 12 2zm0 1.8c-2.67 0-2.99.01-4.04.06-.87.04-1.34.18-1.65.3-.42.16-.71.35-1.02.66-.31.31-.5.6-.66 1.02-.12.31-.26.78-.3 1.65C4.28 8.5 4.27 8.82 4.27 11.5v1c0 2.67.01 2.99.06 4.04.04.87.18 1.34.3 1.65.16.42.35.71.66 1.02.31.31.6.5 1.02.66.31.12.78.26 1.65.3 1.05.05 1.37.06 4.04.06s2.99-.01 4.04-.06c.87-.04 1.34-.18 1.65-.3.42-.16.71-.35 1.02-.66.31-.31.5-.6.66-1.02.12-.31.26-.78.3-1.65.05-1.05.06-1.37.06-4.04s-.01-2.99-.06-4.04c-.04-.87-.18-1.34-.3-1.65a2.76 2.76 0 0 0-.66-1.02 2.76 2.76 0 0 0-1.02-.66c-.31-.12-.78-.26-1.65-.3C14.99 3.81 14.67 3.8 12 3.8zm0 3.2a5 5 0 1 1 0 10 5 5 0 0 1 0-10zm0 1.8a3.2 3.2 0 1 0 0 6.4 3.2 3.2 0 0 0 0-6.4zm5.2-2.1a1.17 1.17 0 1 1-2.34 0 1.17 1.17 0 0 1 2.34 0z';

  const waNumber = () => (state.settings.whatsapp_number || '').replace(/[^0-9]/g, '');

  function renderSocials(id) {
    const box = document.getElementById(id);
    if (!box) return;
    box.innerHTML = '';
    const s = state.settings;
    const links = [];
    if (waNumber()) links.push({ url: `https://wa.me/${waNumber()}`, label: 'WhatsApp', path: WA_PATH });
    if (s.facebook_url) links.push({ url: s.facebook_url, label: 'Facebook', path: FB_PATH });
    if (s.instagram_url) links.push({ url: s.instagram_url, label: 'Instagram', path: IG_PATH });
    links.forEach(l => {
      const a = document.createElement('a');
      a.className = 'social-icon';
      a.href = l.url; a.target = '_blank'; a.rel = 'noopener';
      a.setAttribute('aria-label', l.label);
      a.innerHTML = `<svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor" aria-hidden="true"><path d="${l.path}"/></svg>`;
      box.appendChild(a);
    });
  }

  async function loadSettings() {
    try {
      const res = await fetch('/api/settings');
      state.settings = await res.json();
    } catch (err) { console.error('Could not load site settings:', err); return; }
    const s = state.settings;

    const heroImg = $('#heroImage');
    if (heroImg && s.hero_image) heroImg.src = s.hero_image;
    const aboutImg = $('#aboutImage');
    if (aboutImg && s.about_image) aboutImg.src = s.about_image;

    const wa = $('#whatsappBtn');
    if (waNumber()) wa.href = `https://wa.me/${waNumber()}`;
    else { wa.href = '#contact'; wa.title = 'WhatsApp number not set up yet'; }

    const bar = $('#announcementBar');
    if (s.announcement_enabled === '1' && s.announcement_text) {
      $('#announcementText').textContent = s.announcement_text;
      bar.style.display = 'block';
      body.classList.add('has-announcement');
    } else {
      bar.style.display = 'none';
      body.classList.remove('has-announcement');
    }

    renderSocials('menuSocials');
    renderSocials('footerSocials');
  }

  /* ------------------------------------------------------------------
     DATA: gallery
     ------------------------------------------------------------------ */
  function formatPrice(price) {
    const t = String(price == null ? '' : price).trim();
    if (!t) return '';
    return /^[\d,]+$/.test(t) ? `Rs. ${t}` : t;
  }

  async function loadGallery() {
    const emptyMsg = $('#galleryEmpty');
    try {
      const res = await fetch('/api/gallery');
      state.items = await res.json();
    } catch (err) {
      console.error('Could not load gallery items:', err);
      $$('.card.skeleton', track).forEach(s => s.remove());
      emptyMsg.textContent = 'The collection could not be loaded right now.';
      emptyMsg.style.display = 'block';
      return;
    }

    $$('.card.skeleton', track).forEach(s => s.remove());
    const statEl = $('#statPieces');
    if (statEl) countUp(statEl, state.items.length);

    if (!state.items.length) { emptyMsg.style.display = 'block'; scTotal.textContent = '00'; return; }

    state.items.forEach((item) => {
      const el = document.createElement('article');
      el.className = 'card';
      el.tabIndex = 0;
      el.setAttribute('role', 'button');
      el.setAttribute('aria-label', `View ${item.title}`);
      el.innerHTML = `
        <div class="card-media">
          ${item.category ? `<span class="card-tag">${esc(item.category)}</span>` : ''}
          <img src="${esc(item.image_path)}" alt="${esc(item.title)}" decoding="async" draggable="false">
        </div>
        <div class="card-meta">
          <h3><small></small>${esc(item.title)}</h3>
          <span>${esc(formatPrice(item.price))}</span>
        </div>`;
      const img = $('img', el);
      const media = $('.card-media', el);
      const loaded = () => {
        if (img.naturalWidth && img.naturalHeight) el.style.setProperty('--ar', (img.naturalWidth / img.naturalHeight).toFixed(4));
        img.classList.add('loaded'); media.classList.add('is-loaded'); queueMeasure();
      };
      if (img.complete && img.naturalWidth) loaded();
      else { img.addEventListener('load', loaded); img.addEventListener('error', loaded); }

      el.addEventListener('click', () => {
        const i = state.visible.indexOf(item);
        if (i > -1) openViewer(i, img);
      });
      el.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); el.click(); }
      });
      el.addEventListener('focus', () => revealCard(el));
      item._el = el;
      track.insertBefore(el, emptyMsg);
    });

    buildFilters();
    applyFilter('all', false);
  }

  function buildFilters() {
    const wrap = $('#galleryFilters');
    const cats = Array.from(new Set(state.items.map(i => (i.category || '').trim()).filter(Boolean)));
    if (cats.length < 2) return;
    wrap.style.display = 'flex';
    wrap.innerHTML = '';
    ['all', ...cats].forEach(cat => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'filter-chip' + (cat === 'all' ? ' active' : '');
      b.textContent = cat === 'all' ? 'All' : cat;
      b.setAttribute('role', 'tab');
      b.addEventListener('click', () => {
        $$('.filter-chip', wrap).forEach(c => c.classList.toggle('active', c === b));
        applyFilter(cat, true);
      });
      wrap.appendChild(b);
    });
  }

  function applyFilter(cat, userAction) {
    state.visible = [];
    state.items.forEach(item => {
      const show = cat === 'all' || (item.category || '').trim() === cat;
      item._el.classList.toggle('is-hidden', !show);
      if (show) {
        state.visible.push(item);
        $('small', item._el).textContent = pad2(state.visible.length);
      }
    });
    scTotal.textContent = pad2(state.visible.length);
    pCur = 0; pTarget = 0;
    track.scrollLeft = 0;
    track.style.transform = '';
    measure();
    if (userAction && pinned) window.scrollTo({ top: sc.offsetTop, behavior: reduce ? 'auto' : 'smooth' });
    readScroll();
    updateShowcaseCounter(0);
  }

  /* ------------------------------------------------------------------
     VIEWER
     ------------------------------------------------------------------ */
  const viewer = $('#viewer');
  const vStage = $('#viewerStage');
  const vImg = $('#viewerImg');
  let lastFocus = null;
  let zoomed = false;

  function sizeViewerImg() {
    const cs = getComputedStyle(vStage);
    const aw = vStage.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight);
    const ah = vStage.clientHeight - parseFloat(cs.paddingTop) - parseFloat(cs.paddingBottom);
    const r = (vImg.naturalWidth && vImg.naturalHeight) ? vImg.naturalWidth / vImg.naturalHeight : 0.8;
    const w = Math.max(40, Math.min(aw, ah * r));
    vImg.style.width = w + 'px';
    vImg.style.height = (w / r) + 'px';
  }

  function setZoom(on, e) {
    zoomed = on && fine;
    vStage.classList.toggle('is-zoomed', zoomed);
    if (zoomed) {
      moveZoom(e);
      vImg.style.transform = 'scale(2.3)';
    } else {
      vImg.style.transform = '';
    }
  }
  function moveZoom(e) {
    if (!zoomed || !e) return;
    const r = vImg.getBoundingClientRect();
    // r is the scaled rect — map the pointer back to the un-scaled image
    const px = clamp((e.clientX - r.left) / r.width, 0, 1) * 100;
    const py = clamp((e.clientY - r.top) / r.height, 0, 1) * 100;
    vImg.style.transformOrigin = `${px}% ${py}%`;
  }

  function waMessage(item) {
    let m = `Hi, I'm interested in "${item.title}"`;
    if (state.selectedDim) m += ` — ${state.selectedDim}`;
    if (item.price) m += `, ${formatPrice(item.price)}`;
    return m;
  }
  function updateViewerLink(item) {
    const a = $('#viewerWhatsapp');
    if (waNumber()) { a.href = `https://wa.me/${waNumber()}?text=${encodeURIComponent(waMessage(item))}`; a.removeAttribute('title'); }
    else { a.href = '#contact'; a.title = 'WhatsApp number not set up yet'; }
  }

  function fillViewer(i, opts) {
    const item = state.visible[i];
    if (!item) return;
    state.cur = i;
    $('#viewerIdx').textContent = pad2(i + 1);
    $('#viewerTotal').textContent = pad2(state.visible.length);
    $('#viewerCat').textContent = item.category || '';
    $('#viewerTitle').textContent = item.title;
    const price = $('#viewerPrice');
    price.textContent = item.price ? formatPrice(item.price) : '';
    price.style.display = item.price ? 'block' : 'none';
    $('#viewerDesc').textContent = item.description || '';

    const dims = String(item.dimensions || '').split(',').map(d => d.trim()).filter(Boolean);
    const wrap = $('#viewerDimsWrap');
    const box = $('#viewerDims');
    box.innerHTML = '';
    state.selectedDim = dims[0] || '';
    wrap.style.display = dims.length ? 'block' : 'none';
    dims.forEach((d, n) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'dim-option' + (n === 0 ? ' selected' : '');
      b.textContent = d;
      b.addEventListener('click', () => {
        $$('.dim-option', box).forEach(x => x.classList.remove('selected'));
        b.classList.add('selected');
        state.selectedDim = d;
        updateViewerLink(item);
      });
      box.appendChild(b);
    });
    updateViewerLink(item);
    $('.viewer-nav').style.display = state.visible.length > 1 ? 'flex' : 'none';
    $('.viewer-info').scrollTop = 0;
    $('.viewer-panel').scrollTop = 0;

    setZoom(false);
    vImg.alt = item.title;
    vImg.classList.remove('is-in');
    if (opts.dir) { vImg.style.setProperty('--dir', (opts.dir * 50) + 'px'); vImg.classList.add('is-swap'); }

    let placed = false;
    const place = () => {
      if (placed) return;
      placed = true;
      sizeViewerImg();
      if (opts.flipFrom && !reduce) {
        const L = vImg.getBoundingClientRect();
        const F = opts.flipFrom;
        if (F.width > 0 && L.width > 0) {
          vStage.classList.add('is-flip');
          const s = F.width / L.width;
          const dx = (F.left + F.width / 2) - (L.left + L.width / 2);
          const dy = (F.top + F.height / 2) - (L.top + L.height / 2);
          const anim = vImg.animate(
            [{ transform: `translate(${dx}px, ${dy}px) scale(${s})` }, { transform: 'none' }],
            { duration: 950, easing: 'cubic-bezier(0.16, 1, 0.3, 1)' }
          );
          anim.onfinish = anim.oncancel = () => vStage.classList.remove('is-flip');
        }
      } else if (opts.dir) {
        requestAnimationFrame(() => { vImg.classList.add('is-in'); vImg.classList.remove('is-swap'); });
      }
    };
    vImg.onload = place;
    vImg.src = item.image_path;
    if (vImg.complete && vImg.naturalWidth) place();
  }

  function openViewer(index, fromImg) {
    lastFocus = document.activeElement;
    viewer.classList.add('is-open');
    viewer.setAttribute('aria-hidden', 'false');
    body.classList.add('viewer-open');
    header.classList.add('is-hidden');
    const flipFrom = fromImg ? fromImg.getBoundingClientRect() : null;
    fillViewer(index, { flipFrom });
    requestAnimationFrame(() => viewer.classList.add('is-shown'));
    $('#viewerClose').focus({ preventScroll: true });
  }

  function closeViewer() {
    if (!viewer.classList.contains('is-open')) return;
    setZoom(false);
    viewer.classList.remove('is-shown');
    viewer.setAttribute('aria-hidden', 'true');
    body.classList.remove('viewer-open');
    setTimeout(() => { viewer.classList.remove('is-open'); }, reduce ? 0 : 600);
    const item = state.visible[state.cur];
    if (lastFocus && lastFocus.focus) lastFocus.focus({ preventScroll: true });
    if (item && item._el && pinned) revealCard(item._el);
    lastFocus = null;
  }

  function stepViewer(dir) {
    const n = state.visible.length;
    if (n < 2) return;
    fillViewer((state.cur + dir + n) % n, { dir });
  }

  function initViewer() {
    $('#viewerClose').addEventListener('click', closeViewer);
    $('#viewerBackdrop').addEventListener('click', closeViewer);
    $('#viewerPrev').addEventListener('click', () => stepViewer(-1));
    $('#viewerNext').addEventListener('click', () => stepViewer(1));

    vStage.addEventListener('click', (e) => { if (fine) setZoom(!zoomed, e); });
    vStage.addEventListener('pointermove', moveZoom);

    document.addEventListener('keydown', (e) => {
      if (!viewer.classList.contains('is-open')) return;
      if (e.key === 'Escape') closeViewer();
      else if (e.key === 'ArrowLeft') stepViewer(-1);
      else if (e.key === 'ArrowRight') stepViewer(1);
      else if (e.key === 'Tab') {
        const list = $$('#viewer button, #viewer a[href]').filter(el => el.offsetParent !== null || el === document.activeElement);
        if (!list.length) return;
        const first = list[0], last = list[list.length - 1];
        if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
        else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
      }
    });

    let tx = null;
    vStage.addEventListener('touchstart', (e) => { tx = e.touches[0].clientX; }, { passive: true });
    vStage.addEventListener('touchend', (e) => {
      if (tx === null) return;
      const dx = e.changedTouches[0].clientX - tx; tx = null;
      if (Math.abs(dx) > 55) stepViewer(dx < 0 ? 1 : -1);
    }, { passive: true });

    window.addEventListener('resize', () => { if (viewer.classList.contains('is-open')) sizeViewerImg(); });
  }

  /* ------------------------------------------------------------------
     REVIEWS
     ------------------------------------------------------------------ */
  const starsHtml = (rating) => {
    const f = clamp(Math.round(rating), 0, 5);
    let h = '';
    for (let i = 1; i <= 5; i++) h += `<span class="${i <= f ? 'on' : ''}">&#9733;</span>`;
    return `<span class="stars" aria-label="${f} out of 5">${h}</span>`;
  };

  let quoteIdx = 0;
  let quoteTimer = null;
  let quoteCount = 0;

  function showQuote(i) {
    const slides = $$('#quotes .quote');
    if (!slides.length) return;
    quoteIdx = (i + slides.length) % slides.length;
    slides.forEach((s, n) => s.classList.toggle('is-active', n === quoteIdx));
    $$('#quoteDots button').forEach((d, n) => { d.classList.toggle('is-active', n === quoteIdx); d.setAttribute('aria-current', n === quoteIdx ? 'true' : 'false'); });
  }
  function startQuoteTimer() {
    clearInterval(quoteTimer);
    if (reduce || quoteCount < 2) return;
    quoteTimer = setInterval(() => { if (!document.hidden) showQuote(quoteIdx + 1); }, 7500);
  }

  async function loadTestimonials() {
    let items = [];
    try { const res = await fetch('/api/testimonials'); items = await res.json(); }
    catch (err) { console.error('Could not load testimonials:', err); return; }
    if (!items.length) return;

    const box = $('#quotes');
    $('#quotesEmpty').remove();
    quoteCount = items.length;
    items.forEach((t, n) => {
      const fig = document.createElement('figure');
      fig.className = 'quote' + (n === 0 ? ' is-active' : '');
      fig.innerHTML = `
        ${starsHtml(t.rating || 5)}
        <blockquote>&ldquo;${esc(t.quote)}&rdquo;</blockquote>
        <figcaption><span class="avatar" aria-hidden="true">${esc((t.client_name || '?').trim().charAt(0).toUpperCase())}</span>${esc(t.client_name)}</figcaption>`;
      box.appendChild(fig);
    });

    const avg = items.reduce((s, t) => s + (Number(t.rating) || 5), 0) / items.length;
    const sum = $('#ratingSummary');
    sum.innerHTML = `<strong>${avg.toFixed(1)}</strong><div>${starsHtml(avg)}<small>from ${items.length} ${items.length === 1 ? 'review' : 'reviews'}</small></div>`;
    sum.style.display = 'flex';

    if (items.length > 1) {
      $('#quotesCtrl').style.display = 'flex';
      const dots = $('#quoteDots');
      items.forEach((_, n) => {
        const b = document.createElement('button');
        b.type = 'button';
        b.setAttribute('aria-label', `Show review ${n + 1}`);
        b.className = n === 0 ? 'is-active' : '';
        b.addEventListener('click', () => { showQuote(n); startQuoteTimer(); });
        dots.appendChild(b);
      });
      $('#quotePrev').addEventListener('click', () => { showQuote(quoteIdx - 1); startQuoteTimer(); });
      $('#quoteNext').addEventListener('click', () => { showQuote(quoteIdx + 1); startQuoteTimer(); });
      let qx = null;
      box.addEventListener('touchstart', (e) => { qx = e.touches[0].clientX; }, { passive: true });
      box.addEventListener('touchend', (e) => {
        if (qx === null) return;
        const dx = e.changedTouches[0].clientX - qx; qx = null;
        if (Math.abs(dx) > 50) { showQuote(quoteIdx + (dx < 0 ? 1 : -1)); startQuoteTimer(); }
      }, { passive: true });
      box.addEventListener('mouseenter', () => clearInterval(quoteTimer));
      box.addEventListener('mouseleave', startQuoteTimer);
      showQuote(0);
      startQuoteTimer();
    }
  }

  function initReviewForm() {
    const starInput = $('#starInput');
    const ratingField = $('#reviewRating');
    const form = $('#reviewForm');
    const errEl = $('#reviewFormError');
    const btns = $$('.star-btn', starInput);

    const setStars = (v) => { ratingField.value = v; btns.forEach(b => b.classList.toggle('active', +b.dataset.value <= v)); };
    btns.forEach(b => b.addEventListener('click', () => setStars(+b.dataset.value)));
    setStars(5);

    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      errEl.textContent = '';
      const btn = $('#reviewFormSubmit');
      const label = $('span', btn);
      btn.disabled = true; label.textContent = 'Submitting...';
      try {
        const res = await fetch('/api/reviews', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ client_name: $('#reviewName').value.trim(), quote: $('#reviewText').value.trim(), rating: ratingField.value })
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Could not submit your review.');
        form.reset(); setStars(5);
        errEl.style.color = 'var(--bronze)';
        errEl.textContent = 'Thank you — your review has been submitted and will appear here once approved.';
      } catch (err) {
        errEl.style.color = '#e0a99b';
        errEl.textContent = err.message;
      } finally {
        btn.disabled = false; label.textContent = 'Submit review';
      }
    });
  }

  /* ------------------------------------------------------------------
     MENU, NAV SPY, COUNT-UP
     ------------------------------------------------------------------ */
  function setMenu(open) {
    body.classList.toggle('menu-open', open);
    $('#menuBtn').setAttribute('aria-expanded', String(open));
    $('#menu').setAttribute('aria-hidden', String(!open));
    if (open) header.classList.remove('is-hidden');
  }

  function initMenu() {
    $('#menuBtn').addEventListener('click', () => setMenu(!body.classList.contains('menu-open')));
    $$('#menu nav a').forEach(a => a.addEventListener('click', () => setMenu(false)));
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape') setMenu(false); });
    matchMedia('(min-width: 1001px)').addEventListener('change', (e) => { if (e.matches) setMenu(false); });
  }

  function initNavSpy() {
    const links = $$('.main-nav a[data-nav]');
    const secs = links.map(a => document.getElementById(a.dataset.nav)).filter(Boolean);
    if (!('IntersectionObserver' in window)) return;
    const io = new IntersectionObserver((entries) => {
      entries.forEach(en => { if (en.isIntersecting) links.forEach(a => a.classList.toggle('active', a.dataset.nav === en.target.id)); });
    }, { rootMargin: '-45% 0px -50% 0px' });
    secs.forEach(s => io.observe(s));
  }

  function countUp(el, target) {
    if (reduce || !('IntersectionObserver' in window)) { el.textContent = target; return; }
    el.textContent = '0';
    const io = new IntersectionObserver((entries) => {
      if (!entries[0].isIntersecting) return;
      io.disconnect();
      const t0 = performance.now();
      const step = (now) => {
        const p = clamp((now - t0) / 1400, 0, 1);
        el.textContent = Math.round((1 - Math.pow(1 - p, 3)) * target);
        if (p < 1) requestAnimationFrame(step);
      };
      requestAnimationFrame(step);
    }, { threshold: 0.4 });
    io.observe(el);
  }

  /* ------------------------------------------------------------------
     INIT
     ------------------------------------------------------------------ */
  function init() {
    startLoader();
    $('#year').textContent = new Date().getFullYear();

    initManifesto();
    initPointer();
    initMenu();
    initNavSpy();
    initViewer();
    initReviewForm();
    observeReveals();

    window.addEventListener('scroll', () => requestAnimationFrame(onScroll), { passive: true });
    track.addEventListener('scroll', () => { if (!pinned) readScroll(); }, { passive: true });
    let rt;
    window.addEventListener('resize', () => { clearTimeout(rt); rt = setTimeout(() => { measure(); onScroll(); }, 120); });
    window.addEventListener('load', queueMeasure);

    onScroll();
    requestAnimationFrame(frame);

    loadSettings().finally(() => { loadGallery().then(() => { queueMeasure(); }); });
    loadTestimonials().then(observeReveals);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
