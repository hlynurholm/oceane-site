(function(){
  var header = document.getElementById('op-header');
  if(!header) return;
  function onScroll(){ header.classList.toggle('op-scrolled', window.scrollY > 8); }
  window.addEventListener('scroll', onScroll);
  onScroll();
})();

(function(){
  var pre = document.getElementById('op-preloader');
  if (!pre) return;

  function reveal() {
    var logo = document.getElementById('op-pre-logo');
    var sections = [
      document.querySelector('.op-header'),
      document.querySelector('.op-hero'),
      document.getElementById('op-projects'),
      document.querySelector('.op-footer')
    ].filter(Boolean);

    // Pin sections at opacity:0 before removing the CSS class
    sections.forEach(function(el) {
      el.style.opacity = '0';
      el.style.transform = 'translateY(-10px)';
    });
    document.body.classList.remove('op-loading');

    // Blue logo → white logo (matches hero logo already in DOM)
    if (logo) logo.src = 'assets/logo-offwhite.png';

    setTimeout(function() {
      pre.style.transition = 'opacity 0.5s ease';
      pre.style.opacity = '0';
      pre.style.pointerEvents = 'none';
      setTimeout(function() { if (pre.parentNode) pre.remove(); }, 600);

      // Reveal header → hero → projects → footer
      sections.forEach(function(el, i) {
        setTimeout(function() {
          el.style.transition = 'opacity 0.7s ease, transform 0.7s ease';
          el.style.opacity = '1';
          el.style.transform = 'translateY(0)';
        }, i * 130);
      });
    }, 250);
  }

  window.addEventListener('load', function() {
    (document.fonts ? document.fonts.ready : Promise.resolve()).then(reveal);
  });
})();
