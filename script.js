(function(){
  var header = document.getElementById('op-header');
  if(!header) return;
  function onScroll(){ header.classList.toggle('op-scrolled', window.scrollY > 8); }
  window.addEventListener('scroll', onScroll);
  onScroll();
})();

(function(){
  var canvas = document.createElement('canvas');
  canvas.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;pointer-events:none;mix-blend-mode:difference;z-index:5';
  document.body.appendChild(canvas);
  var ctx = canvas.getContext('2d');
  var GRID = 28, R = 1, raf = null;

  function resize() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    schedule();
  }

  function drawDots(clipX, clipY, clipW, clipH, alphaFn) {
    var vw = canvas.width, vh = canvas.height;
    var cx = Math.max(0, clipX), cy = Math.max(0, clipY);
    var cx2 = Math.min(vw, clipX + clipW), cy2 = Math.min(vh, clipY + clipH);
    if (cx2 <= cx || cy2 <= cy) return;
    ctx.save();
    ctx.beginPath();
    ctx.rect(cx, cy, cx2 - cx, cy2 - cy);
    ctx.clip();
    var x0 = Math.floor(cx / GRID) * GRID;
    var y0 = Math.floor(cy / GRID) * GRID;
    for (var y = y0; y <= cy2 + GRID; y += GRID) {
      for (var x = x0; x <= cx2 + GRID; x += GRID) {
        var alpha = alphaFn ? alphaFn(y) : 1;
        if (alpha <= 0) continue;
        ctx.globalAlpha = alpha;
        ctx.beginPath();
        ctx.arc(x, y, R, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    ctx.globalAlpha = 1;
    ctx.restore();
  }

  function draw() {
    raf = null;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = '#fffcf9';

    var hero = document.querySelector('.op-hero');
    if (hero) {
      var r = hero.getBoundingClientRect();
      drawDots(0, r.top, canvas.width, r.height / 2);
    }

    document.querySelectorAll('.op-proj').forEach(function(el, i) {
      var r = el.getBoundingClientRect();
      var x = (i % 2 === 1) ? canvas.width / 2 : 0;
      drawDots(x, r.top, canvas.width / 2, r.height);
    });

    var footer = document.querySelector('.op-footer');
    if (footer) {
      var r = footer.getBoundingClientRect();
      var fs = r.top + r.height * 0.18, fe = r.top + r.height * 0.42;
      drawDots(0, r.top, canvas.width, r.height * 0.42, function(y) {
        if (y <= fs) return 1;
        if (y >= fe) return 0;
        return 1 - (y - fs) / (fe - fs);
      });
    }

    var about = document.querySelector('.op-about');
    if (about) {
      var r = about.getBoundingClientRect();
      var fs = r.top + r.height * 0.18, fe = r.top + r.height * 0.42;
      drawDots(0, r.top, canvas.width, r.height * 0.42, function(y) {
        if (y <= fs) return 1;
        if (y >= fe) return 0;
        return 1 - (y - fs) / (fe - fs);
      });
    }

    var contact = document.querySelector('.op-contact');
    if (contact) {
      var r = contact.getBoundingClientRect();
      var fs = r.top + r.height * 0.18, fe = r.top + r.height * 0.42;
      drawDots(0, r.top, canvas.width, r.height * 0.42, function(y) {
        if (y <= fs) return 1;
        if (y >= fe) return 0;
        return 1 - (y - fs) / (fe - fs);
      });
    }
  }

  function schedule() { if (!raf) raf = requestAnimationFrame(draw); }

  window.opUpdateDotGrids = schedule;
  window.addEventListener('scroll', schedule, {passive: true});
  window.addEventListener('resize', resize);
  window.addEventListener('load', schedule);
  setTimeout(schedule, 300);
  resize();
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
          if (hasTranslate) {
            el.style.transform = 'translateY(0)';
            setTimeout(function() { el.style.transform = ''; el.style.transition = ''; }, 700);
          }
        }, i * 130);
      });

      setTimeout(function() { if (pre.parentNode) pre.remove(); }, 1100);
    }, 500);
  }

  window.addEventListener('load', function() {
    (document.fonts ? document.fonts.ready : Promise.resolve()).then(reveal);
  });
})();
