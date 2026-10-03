const header = document.getElementById('siteHeader');
const progress = document.getElementById('scrollProgress');
const heroImg = document.getElementById('heroImage');
const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

// One rAF-throttled scroll handler: header state, progress bar, hero parallax
let ticking = false;
function onScroll() {
  const y = window.scrollY;
  header.classList.toggle('scrolled', y > 40);

  const max = document.documentElement.scrollHeight - window.innerHeight;
  progress.style.transform = `scaleX(${max > 0 ? Math.min(y / max, 1) : 0})`;

  if (!reduceMotion && heroImg && y < window.innerHeight) {
    heroImg.style.setProperty('--parallax', `${(y * 0.18).toFixed(1)}px`);
  }
  ticking = false;
}
window.addEventListener('scroll', () => {
  if (!ticking) { ticking = true; requestAnimationFrame(onScroll); }
}, { passive: true });
window.addEventListener('resize', onScroll);
onScroll();

// Mobile menu
const menuToggle = document.getElementById('menuToggle');
const mobileMenu = document.getElementById('mobileMenu');
function setMenu(open) {
  document.body.classList.toggle('menu-open', open);
  menuToggle.setAttribute('aria-expanded', String(open));
  menuToggle.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
  mobileMenu.setAttribute('aria-hidden', String(!open));
}
menuToggle.addEventListener('click', () => setMenu(!document.body.classList.contains('menu-open')));
mobileMenu.querySelectorAll('nav a').forEach(a => a.addEventListener('click', () => setMenu(false)));
document.addEventListener('keydown', (e) => { if (e.key === 'Escape') setMenu(false); });
window.matchMedia('(min-width: 961px)').addEventListener('change', (e) => { if (e.matches) setMenu(false); });

// Highlight the nav link of the section currently in view
const navLinks = document.querySelectorAll('.main-nav a[data-nav]');
const sections = [...navLinks].map(a => document.getElementById(a.dataset.nav)).filter(Boolean);
if ('IntersectionObserver' in window && sections.length) {
  const spy = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        navLinks.forEach(a => a.classList.toggle('active', a.dataset.nav === entry.target.id));
      }
    });
  }, { rootMargin: '-45% 0px -50% 0px' });
  sections.forEach(s => spy.observe(s));
}

// Footer year
document.getElementById('year').textContent = new Date().getFullYear();
