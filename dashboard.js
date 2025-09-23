// Initialize icons
lucide.createIcons();

// Mobile sidebar toggle
const menuBtn = document.getElementById('menuBtn');
const sidebar = document.getElementById('sidebar');
menuBtn?.addEventListener('click', () => {
    const open = !sidebar.classList.contains('-translate-x-full');
    sidebar.classList.toggle('-translate-x-full', open);
});

// Close sidebar when clicking outside on small screens
document.addEventListener('click', (e) => {
    const withinSidebar = sidebar.contains(e.target);
    const withinBtn = menuBtn && menuBtn.contains(e.target);
    if (!withinSidebar && !withinBtn && window.innerWidth < 768) {
        sidebar.classList.add('-translate-x-full');
    }
});

// Accessibility: close on Esc
document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && window.innerWidth < 768) {
        sidebar.classList.add('-translate-x-full');
    }
});