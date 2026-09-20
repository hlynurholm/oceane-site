(function(){
  var header = document.getElementById('op-header');
  if(!header) return;
  function onScroll(){ header.classList.toggle('op-scrolled', window.scrollY > 8); }
  window.addEventListener('scroll', onScroll);
  onScroll();
})();

(function(){
  var nav = document.querySelector('.op-header-nav');
  var right = document.querySelector('.op-header-right');
  if (!nav || !right) return;

  // Hamburger button
  var btn = document.createElement('button');
  btn.className = 'op-hamburger';
  btn.setAttribute('aria-label', 'Menu');
  btn.innerHTML = '<span></span><span></span><span></span>';
  right.appendChild(btn);

  // Menu panel — clone links from the nav pill so active state carries over
  var menu = document.createElement('div');
  menu.className = 'op-mob-nav';

  // Close button (X) at top of menu
  var closeBtn = document.createElement('button');
  closeBtn.className = 'op-mob-nav-x';
  closeBtn.setAttribute('aria-label', 'Close menu');
  closeBtn.innerHTML = '<span></span><span></span><span></span>';
  menu.appendChild(closeBtn);

  nav.querySelectorAll('.op-nav-link').forEach(function(link) {
    var a = link.cloneNode(true);
    a.addEventListener('click', close);
    menu.appendChild(a);
  });
  document.body.appendChild(menu);

  var isOpen = false;
  function open() {
    var r = btn.getBoundingClientRect();
    menu.style.top   = r.top + 'px';
    menu.style.right = (window.innerWidth - r.right) + 'px';
    isOpen = true;
    menu.classList.add('op-mob-nav-open');
    btn.style.opacity = '0';
    btn.style.pointerEvents = 'none';
  }
  function close() {
    isOpen = false;
    menu.classList.remove('op-mob-nav-open');
    btn.style.opacity = '1';
    btn.style.pointerEvents = '';
  }

  closeBtn.addEventListener('click', function(e) { e.stopPropagation(); close(); });
  btn.addEventListener('click', function(e) {
    e.stopPropagation();
    isOpen ? close() : open();
  });
  document.addEventListener('click', function(e) {
    if (isOpen && !menu.contains(e.target)) close();
  });
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

  // Reveal as soon as the things the intro actually depends on are ready: the
  // fonts, and the logo images it crossfades (it measures the hero logo's box,
  // which is zero-width until that image loads). Everything else — photos,
  // video players — keeps loading behind the revealed site.
  //
  // This used to wait for window.load, which fires only after every image and
  // all ~25 video players finish. That was ~6s on a cold visit.

  function imgReady(img) {
    if (!img || (img.complete && img.naturalWidth)) return Promise.resolve();
    return new Promise(function (res) {
      img.addEventListener('load', res, { once: true });
      img.addEventListener('error', res, { once: true });
    });
  }

  var revealed = false;
  function revealOnce() { if (revealed) return; revealed = true; reveal(); }

  // render.js fires this once the hero strip is in the DOM. Capped so a slow
  // projects.json fetch can't hold the page.
  var heroReady = new Promise(function (res) {
    document.addEventListener('op-hero-ready', res, { once: true });
    setTimeout(res, 1500);
  });

  Promise.all([
    document.fonts ? document.fonts.ready : Promise.resolve(),
    imgReady(document.getElementById('op-pre-blue')),
    imgReady(document.getElementById('op-pre-white')),
    imgReady(document.querySelector('.op-hero-logo')),
    heroReady
  ]).then(revealOnce);

  // Hard cap — never hold the page longer than this, whatever is still in flight.
  setTimeout(revealOnce, 2500);
})();

// Hero sky: the still image in assets/hero-sky.jpg, bent by two slow noise
// fields so the clouds drift and fold like smoke, with film grain that is
// regenerated every grain frame. The same image is the CSS background of
// .op-hero-media, and this canvas stays transparent until it has really drawn,
// so every failure (no WebGL, shader won't start, GPU lost) leaves the still.
(function(){
  var canvas = document.getElementById('op-hero-sky');
  if (!canvas) return;

  var SPEED = 1, AMOUNT = 0.12, GRAIN = 0.10, GRAIN_FPS = 24, CROP = 0.5;

  var FRAG = [
    'precision highp float;',
    'uniform sampler2D IMG; uniform vec2 R; uniform float T, W, G, F, A, D;',
    'float hash(vec2 p){ vec3 p3 = fract(vec3(p.xyx) * .1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y) * p3.z); }',
    'float noise(vec2 p){ vec2 i = floor(p), f = fract(p); f = f * f * (3. - 2. * f);',
    '  return mix(mix(hash(i), hash(i + vec2(1., 0.)), f.x), mix(hash(i + vec2(0., 1.)), hash(i + vec2(1., 1.)), f.x), f.y); }',
    'float fbm(vec2 p){ return .67 * noise(p) + .33 * noise(p * 2.1 + 7.3); }',
    'void main(){',
    '  vec2 px = vec2(gl_FragCoord.x, R.y - gl_FragCoord.y);',
    '  float sc = max(R.x / 2048., R.y / 1506.);',                                  // cover-fit, like the CSS background
    '  vec2 uv = (vec2((2048. - R.x / sc) * .5, (1506. - R.y / sc) * A) + px / sc) / vec2(2048., 1506.);',
    '  vec2 q = uv * vec2(1.36, 1.) * 2.2;',
    '  vec2 bend = vec2(fbm(q + vec2(T * .030, T * .017)), fbm(q + vec2(5.2 - T * .021, 1.3 + T * .026))) - .5;',
    '  uv = (uv - .5) * (1. - W * .7) + .5 + W * bend;',                             // slight zoom keeps bent lookups on the image
    '  vec3 col = texture2D(IMG, uv).rgb;',
    '  float g = hash(floor(px / D) + F * vec2(17., 59.));',                         // one grain cell per CSS pixel
    '  vec3 ov = mix(2. * col * g, 1. - 2. * (1. - col) * (1. - g), step(.5, col));', // overlay blend
    '  gl_FragColor = vec4(mix(col, ov, G), 1.);',
    '}'
  ].join('\n');

  function heroReady() { document.dispatchEvent(new Event('op-hero-ready')); }   // the preloader waits on this

  var img = new Image();
  img.onerror = heroReady;
  img.onload = function () { heroReady(); try { start(); } catch (e) {} };
  img.src = 'assets/hero-sky.jpg';

  function start() {
    var gl = canvas.getContext('webgl', { antialias: false, alpha: false });
    if (!gl) return;
    function sh(type, src) {
      var s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s);
      if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s));
      return s;
    }
    var prog = gl.createProgram();
    gl.attachShader(prog, sh(gl.VERTEX_SHADER, 'attribute vec2 a;void main(){gl_Position=vec4(a,0.,1.);}'));
    gl.attachShader(prog, sh(gl.FRAGMENT_SHADER, FRAG));
    gl.linkProgram(prog); gl.useProgram(prog);
    gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1,-1, 3,-1, -1,3]), gl.STATIC_DRAW);
    gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
    var U = {}; ['R','T','W','G','F','A','D'].forEach(function (n) { U[n] = gl.getUniformLocation(prog, n); });

    gl.bindTexture(gl.TEXTURE_2D, gl.createTexture());
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGB, gl.RGB, gl.UNSIGNED_BYTE, img);
    // Not a power-of-two image, so WebGL1 needs clamping and no mipmaps.
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);

    var dpr = 1, clock = 0, prev = 0, last = 0, lost = false;
    function draw(now) {
      gl.uniform2f(U.R, canvas.width, canvas.height);
      gl.uniform1f(U.T, clock);
      gl.uniform1f(U.W, AMOUNT);
      gl.uniform1f(U.G, GRAIN);
      gl.uniform1f(U.F, Math.floor(now / 1000 * GRAIN_FPS) % 1000);
      gl.uniform1f(U.A, CROP);
      gl.uniform1f(U.D, dpr);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
    }
    function fit() {
      if (lost) return;
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = canvas.clientWidth * dpr; canvas.height = canvas.clientHeight * dpr;
      gl.viewport(0, 0, canvas.width, canvas.height);
      draw(performance.now());
    }
    // ponytail: capped at 30fps — the drift is slow and the grain is 24fps, so
    // 60 would only burn battery. Raise the 33 if it ever looks steppy.
    function loop(now) {
      if (lost) return;
      if (now - last >= 33) {
        clock += (prev ? Math.min(now - prev, 100) / 1000 : 0) * SPEED;
        prev = last = now;
        if (canvas.getBoundingClientRect().bottom > 0) draw(now);   // nothing to paint once scrolled past
      }
      requestAnimationFrame(loop);   // rAF stops by itself in background tabs
    }
    // ponytail: a lost GPU context falls back to the still for the rest of the
    // visit. Rebuild on 'webglcontextrestored' if that ever proves common.
    canvas.addEventListener('webglcontextlost', function () { lost = true; canvas.classList.remove('op-live'); });
    window.addEventListener('resize', fit);

    fit();
    canvas.classList.add('op-live');
    if (!window.matchMedia('(prefers-reduced-motion: reduce)').matches) requestAnimationFrame(loop);
  }
})();
