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
    var blue = document.getElementById('op-pre-blue');
    var white = document.getElementById('op-pre-white');
    var sections = [
      document.querySelector('.op-header'),
      document.querySelector('.op-hero'),
      document.getElementById('op-projects'),
      document.querySelector('.op-footer')
    ].filter(Boolean);

    var hero = document.querySelector('.op-hero');

    // Pin sections at opacity:0; skip translateY on hero so its logo stays
    // exactly aligned with the preloader logo throughout the crossfade
    sections.forEach(function(el) {
      el.style.opacity = '0';
      if (el !== hero) el.style.transform = 'translateY(-10px)';
    });
    document.body.classList.remove('op-loading');

    // Snap preloader logos to the exact rendered position of the hero logo
    var heroLogo = document.querySelector('.op-hero-logo');
    if (heroLogo) {
      var r = heroLogo.getBoundingClientRect();
      var cx = (r.left + r.right) / 2;
      var cy = (r.top + r.bottom) / 2;
      [blue, white].forEach(function(img) {
        if (!img) return;
        img.style.top = cy + 'px';
        img.style.left = cx + 'px';
        img.style.height = r.height + 'px';
        img.style.width = 'auto';
        img.style.transform = 'translate(-50%, -50%)';
      });
    }

    // Hold on blue for 500ms, then simultaneously:
    // - crossfade blue → white (1s)
    // - fade out the preloader overlay (1s) so the site rises up behind the logo
    // - cascade sections in underneath
    setTimeout(function() {
      if (blue) blue.style.opacity = '0';

      pre.style.transition = 'opacity 1s ease';
      pre.style.opacity = '0';
      pre.style.pointerEvents = 'none';

      sections.forEach(function(el, i) {
        var hasTranslate = el !== hero;
        setTimeout(function() {
          el.style.transition = hasTranslate
            ? 'opacity 0.7s ease, transform 0.7s ease'
            : 'opacity 0.7s ease';
          el.style.opacity = '1';
          if (hasTranslate) el.style.transform = 'translateY(0)';
        }, i * 130);
      });

      setTimeout(function() { if (pre.parentNode) pre.remove(); }, 1100);
    }, 500);
  }

  window.addEventListener('load', function() {
    (document.fonts ? document.fonts.ready : Promise.resolve()).then(reveal);
  });
})();
