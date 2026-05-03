(function () {
  function init() {
    const header = document.querySelector('.site-header');
    const nav = header && header.querySelector('.main-nav');
    if (!header || !nav) return;

    const btn = document.createElement('button');
    btn.className = 'hamburger-btn';
    btn.id = 'hamburgerBtn';
    btn.setAttribute('aria-label', 'Open menu');
    btn.setAttribute('aria-expanded', 'false');
    btn.innerHTML = '<span></span><span></span><span></span>';
    header.appendChild(btn);

    const overlay = document.createElement('div');
    overlay.className = 'side-menu-overlay';
    overlay.id = 'sideMenuOverlay';

    const aside = document.createElement('aside');
    aside.className = 'side-menu';
    aside.id = 'sideMenu';
    aside.setAttribute('aria-hidden', 'true');

    const menuHeader = document.createElement('div');
    menuHeader.className = 'side-menu-header';
    menuHeader.innerHTML = '<span class="side-menu-title">Menu</span>' +
      '<button class="side-menu-close" id="sideMenuClose" aria-label="Close menu">&times;</button>';

    const sideNav = document.createElement('nav');
    sideNav.className = 'side-menu-nav';
    nav.querySelectorAll('a').forEach(a => {
      const link = document.createElement('a');
      link.href = a.getAttribute('href');
      link.textContent = a.textContent;
      link.className = 'side-nav-link' + (a.classList.contains('active') ? ' active' : '');
      sideNav.appendChild(link);
    });

    aside.appendChild(menuHeader);
    aside.appendChild(sideNav);
    document.body.appendChild(overlay);
    document.body.appendChild(aside);

    function open() {
      aside.classList.add('open');
      overlay.classList.add('open');
      btn.classList.add('open');
      aside.setAttribute('aria-hidden', 'false');
      btn.setAttribute('aria-expanded', 'true');
    }
    function close() {
      aside.classList.remove('open');
      overlay.classList.remove('open');
      btn.classList.remove('open');
      aside.setAttribute('aria-hidden', 'true');
      btn.setAttribute('aria-expanded', 'false');
    }
    btn.addEventListener('click', () => {
      aside.classList.contains('open') ? close() : open();
    });
    document.getElementById('sideMenuClose').addEventListener('click', close);
    overlay.addEventListener('click', close);
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && aside.classList.contains('open')) close();
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
