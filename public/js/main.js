// Header background toggle on scroll
const header = document.getElementById('siteHeader');
function onScroll() {
  if (window.scrollY > 40) {
    header.classList.add('scrolled');
  } else {
    header.classList.remove('scrolled');
  }
}
window.addEventListener('scroll', onScroll, { passive: true });
onScroll();

// Footer year
document.getElementById('year').textContent = new Date().getFullYear();
