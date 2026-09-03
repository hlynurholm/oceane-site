function opField(proj, field) {
  if (window.opLang === 'is') {
    var v = proj[field + '_is'];
    if (v) return v;
  }
  return proj[field] || '';
}

function opFs(proj, field) {
  var s = proj.styles && proj.styles[field];
  if (!s) return '';
  var parts = [];
  if (s.fontSize) parts.push('font-size:' + s.fontSize);
  if (s.width)    parts.push('width:' + s.width);
  if (s.maxWidth) parts.push('max-width:' + s.maxWidth);
  return parts.length ? ' style="' + parts.join(';') + '"' : '';
}

// Cloudflare Stream serves a still for any video, so we can show a poster
// wherever a live player isn't worth its cost.
function opStreamThumb(uid, height) {
  return 'https://videodelivery.net/' + uid + '/thumbnails/thumbnail.jpg?time=1s' +
         (height ? '&height=' + height : '');
}

function opStreamEmbed(uid, poster) {
  return 'https://iframe.videodelivery.net/' + uid +
         '?autoplay=true&muted=true&loop=true&controls=false&preload=auto&playsinline=true' +
         (poster ? '&poster=' + encodeURIComponent(poster) : '');
}

// Mobile browsers cap how many videos they will decode at once. The page used
// to mount 25 Stream players on load, which pushed every one of them past that
// cap and made them all fail with "an unknown error occurred". Players are now
// mounted only while their tile is near the viewport and torn down when it
// leaves, so at most one or two are ever live.
// Mount/unmount one tile's player. Split out from the observer so the decision
// and the DOM work can be exercised independently.
function opSetCoverPlaying(el, playing) {
  var live = el.querySelector('iframe');
  if (playing) {
    if (live) return false;
    var ar = parseFloat(el.getAttribute('data-ar')) || 16 / 9;
    var uid = el.getAttribute('data-stream-uid');
    var f = document.createElement('iframe');
    f.src = opStreamEmbed(uid, opStreamThumb(uid, 720));
    f.setAttribute('allow', 'autoplay; encrypted-media');
    f.setAttribute('tabindex', '-1');
    // Start transparent so the tile's own poster shows through while the player
    // boots, then fade the video in. Without this the player's black background
    // flashes over the poster the moment the iframe mounts.
    f.style.cssText =
      'border:none;position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);' +
      'width:' + (ar * 100).toFixed(4) + 'vh;height:' + (100 / ar).toFixed(4) + 'vw;' +
      'min-width:100%;min-height:100%;pointer-events:none;' +
      'opacity:0;transition:opacity .5s ease';
    f.addEventListener('load', function () {
      setTimeout(function () { f.style.opacity = '1'; }, 300);
    });
    el.appendChild(f);
    return true;
  }
  if (!live) return false;
  live.remove();
  return true;
}

// True when the tile is close enough to the viewport to be worth playing.
function opCoverInRange(el, margin) {
  var r = el.getBoundingClientRect();
  var pad = (margin === undefined ? 1 : margin) * window.innerHeight;
  return r.top < window.innerHeight + pad && r.bottom > -pad;
}

// Which way the reader is travelling, so the tile they are about to reach gets
// the player rather than the one they just left.
var opLastScrollY = 0;
var opScrollDir = 1;

// Hard ceiling on how many players may be live at once. Phones fail well
// before this; the cap is what actually guarantees we never approach it again.
function opMaxCoverPlayers() {
  return window.innerWidth <= 768 ? 2 : 4;
}

function opSyncCoverVideos() {
  var y = window.pageYOffset || document.documentElement.scrollTop || 0;
  if (y !== opLastScrollY) { opScrollDir = y > opLastScrollY ? 1 : -1; opLastScrollY = y; }

  var covers = [].slice.call(document.querySelectorAll('.op-proj-cover-video'));
  // Aim half a viewport ahead of centre, so the next tile wins a slot before it
  // scrolls into view and has time to start playing off-screen.
  var focus = window.innerHeight * (0.5 + opScrollDir * 0.5);
  var wanted = covers
    .filter(function (el) { return opCoverInRange(el); })
    .map(function (el) {
      var r = el.getBoundingClientRect();
      return { el: el, dist: Math.abs((r.top + r.bottom) / 2 - focus) };
    })
    .sort(function (a, b) { return a.dist - b.dist; })
    .slice(0, opMaxCoverPlayers())
    .map(function (x) { return x.el; });

  covers.forEach(function (el) {
    opSetCoverPlaying(el, wanted.indexOf(el) !== -1);
  });
}

// Mobile browsers cap how many videos they will decode at once. The page used
// to mount 25 Stream players on load, which pushed every one of them past that
// cap and made them all fail with "an unknown error occurred". Players are now
// mounted only while their tile is near the viewport and torn down when it
// leaves, so at most one or two are ever live.
//
// IntersectionObserver does the work; a throttled scroll listener backs it up
// so a tile can never sit frozen on its poster if the observer stays quiet.
function opMountCoverVideos() {
  var covers = document.querySelectorAll('.op-proj-cover-video');
  if (!covers.length) return;

  if ('IntersectionObserver' in window) {
    // Route through opSyncCoverVideos so the cap is enforced in one place.
    var io = new IntersectionObserver(opSyncCoverVideos, { rootMargin: '25% 0px' });
    covers.forEach(function (c) { io.observe(c); });
  }

  var ticking = false;
  function onScroll() {
    if (ticking) return;
    ticking = true;
    window.requestAnimationFrame(function () { ticking = false; opSyncCoverVideos(); });
  }
  window.addEventListener('scroll', onScroll, { passive: true });
  window.addEventListener('resize', onScroll);
  opSyncCoverVideos();
}

function opGroupMedia(items) {
  var groups = [], buffer = [], bufferIdxs = [];
  items.forEach(function(item, i) {
    if (item.type === 'image') { buffer.push(item); bufferIdxs.push(i); }
    else {
      if (buffer.length) { groups.push({ kind: 'images', items: buffer, idxs: bufferIdxs }); buffer = []; bufferIdxs = []; }
      groups.push({ kind: 'video', item: item, idx: i });
    }
  });
  if (buffer.length) groups.push({ kind: 'images', items: buffer, idxs: bufferIdxs });
  return groups;
}

function opLoadProjects() {
  if (window.__opProjectsOverride) return Promise.resolve(window.__opProjectsOverride);
  if (window.__opProjectsCache)    return Promise.resolve(window.__opProjectsCache);
  return fetch('data/projects.json').then(function(r) { return r.json(); }).then(function(d) {
    window.__opProjectsCache = d;
    return d;
  });
}

function opProjTile(p, index, total) {
  var num = p.n || String(index + 1).padStart(2, '0');
  var tot = String(total).padStart(2, '0');
  var alignRight = index % 2 === 1;
  var side = alignRight ? 'right' : 'left';
  var scrimClass = alignRight ? 'op-proj-scrim-r' : 'op-proj-scrim-l';
  var timecode = '00:' + num + ':14:0' + ((index % 9) + 1);

  var mediaEl;
  if (p.coverStreamUid) {
    var ar = (p.coverWidth && p.coverHeight) ? p.coverWidth / p.coverHeight : 16 / 9;
    mediaEl = '<div class="op-proj-media op-proj-cover-video"' +
                ' data-stream-uid="' + p.coverStreamUid + '"' +
                ' data-ar="' + ar.toFixed(4) + '"' +
                ' style="background-color:#141310;background-image:url(' + opStreamThumb(p.coverStreamUid, 720) + ')"></div>';
  } else {
    var cover = p.media && p.media.length
      ? (p.media[0].type === 'video' ? p.media[0].poster : p.media[0].src)
      : '';
    var bgPos  = p.bgPosition || 'center';
    var bgStyle = cover
      ? 'background-image:url(assets/photos/' + cover + ');background-position:' + bgPos
      : 'background:#2a2824';
    mediaEl = '<div class="op-proj-media" style="' + bgStyle + '"></div>';
  }

  return '' +
    '<a class="op-proj" href="project.html?p=' + p.slug + '" id="work-' + p.slug + '">' +
      mediaEl +
      '<div class="op-proj-ruler" style="' + side + ':0"></div>' +
      '<div class="' + scrimClass + '"></div>' +
      '<span class="op-proj-n" style="' + side + ':clamp(20px,4vw,56px)"><span class="op-proj-n-dot"></span>' + num + ' / ' + tot + '</span>' +
      '<span class="op-proj-timecode" style="' + side + ':clamp(20px,4vw,56px)">' + timecode + '</span>' +
      '<div class="op-proj-watermark" style="' + (alignRight ? 'left' : 'right') + ':2vw">' + num + '</div>' +
      '<div class="op-proj-info" style="' + side + ':clamp(20px,4vw,56px)' + (alignRight ? ';text-align:right' : '') + '">' +
        '<div class="op-proj-rule"' + (alignRight ? ' style="margin-left:auto"' : '') + '></div>' +
        '<div class="op-proj-title" data-op-field="tileTitle"' + opFs(p,'tileTitle') + '>' + opField(p,'title') + '</div>' +
        '<div class="op-proj-kind">' + opField(p,'kind') + '</div>' +
      '</div>' +
    '</a>';
}

function opBuildHeroStrip(projects) {
  var media = document.querySelector('.op-hero-media');
  if (!media) return;

  // Collect up to 5 items per project: real video iframes + images
  var items = [];
  projects.forEach(function(proj) {
    var count = 0;
    (proj.media || []).forEach(function(m) {
      if (count >= 5) return;
      if (m.streamUid) {
        items.push({ type: 'video', uid: m.streamUid, ar: (m.width && m.height) ? m.width / m.height : 1.778 });
        count++;
      } else if (m.type === 'image' && m.src) {
        items.push({ type: 'image', src: 'assets/photos/' + m.src, ar: (m.width && m.height) ? m.width / m.height : 1.5 });
        count++;
      }
    });
  });
  if (!items.length) return;

  // Fresh random shuffle every page load
  for (var i = items.length - 1; i > 0; i--) {
    var j = Math.floor(Math.random() * (i + 1));
    var t = items[i]; items[i] = items[j]; items[j] = t;
  }

  var totalAR = items.reduce(function(s, it) { return s + it.ar; }, 0);
  var duration = Math.max(40, Math.round(totalAR * 6));

  // The strip is duplicated for a seamless loop, so every video in it costs two
  // players. On phones that budget is better spent on the tile covers, and the
  // strip is blurred anyway — use Stream's stills there instead.
  var stripPlaysVideo = window.matchMedia('(min-width: 769px)').matches;

  function makeItem(it) {
    if (it.type === 'video') {
      if (!stripPlaysVideo) {
        return '<img src="' + opStreamThumb(it.uid, 400) + '" alt="">';
      }
      return '<div class="op-hero-strip-video" style="aspect-ratio:' + it.ar.toFixed(4) +
               ';background:#141310 url(' + opStreamThumb(it.uid, 400) + ') center/cover">' +
               '<iframe src="' + opStreamEmbed(it.uid, opStreamThumb(it.uid, 400)) + '" allow="autoplay; encrypted-media" tabindex="-1"></iframe>' +
             '</div>';
    }
    return '<img src="' + it.src + '" alt="">';
  }

  var inner = items.map(makeItem).join('');

  // Duplicate for seamless loop; translateX(-50%) = one full copy width
  var strip = document.createElement('div');
  strip.className = 'op-hero-strip';
  strip.style.animationDuration = duration + 's';
  strip.innerHTML = inner + inner;

  var wrap = document.createElement('div');
  wrap.className = 'op-hero-strip-wrap';
  wrap.appendChild(strip);

  var vid = media.querySelector('.op-hero-video');
  if (vid) vid.remove();
  media.insertBefore(wrap, media.firstChild);

  // Hold the static background photo underneath until the strip has something
  // to show. The page now reveals before the strip's images have loaded, so
  // clearing it immediately would flash an empty hero.
  var bg = media.querySelector('.op-hero-media-img');
  var firstImg = strip.querySelector('img');
  function clearBg() { if (bg) bg.style.backgroundImage = ''; }
  if (!firstImg || (firstImg.complete && firstImg.naturalWidth)) {
    clearBg();
  } else {
    firstImg.addEventListener('load', clearBg, { once: true });
    firstImg.addEventListener('error', clearBg, { once: true });
    setTimeout(clearBg, 3000);
  }

  document.dispatchEvent(new Event('op-hero-ready'));
}

function opRenderHome() {
  var root = document.getElementById('op-projects');
  if (!root) return;
  opLoadProjects().then(function(projects) {
    var total = projects.length;
    root.innerHTML = projects.map(function(p, i) { return opProjTile(p, i, total); }).join('');
    opMountCoverVideos();
    opBuildHeroStrip(projects);
    if (window.opUpdateDotGrids) window.opUpdateDotGrids();
  });
}

function opVideoBlockHtml(item, idx) {
  var idxAttr = idx !== undefined ? ' data-op-media-idx="' + idx + '"' : '';
  var src = 'https://iframe.videodelivery.net/' + item.streamUid +
            '?controls=true&muted=false&autoplay=false&loop=false&preload=metadata';
  var arStyle = (item.width && item.height)
    ? ' style="aspect-ratio:' + item.width + '/' + item.height + '"'
    : '';
  return '' +
    '<div class="op-d-video op-d-stream"' + idxAttr + arStyle + '>' +
      '<iframe src="' + src + '" allow="autoplay; fullscreen; picture-in-picture" allowfullscreen style="border:none;width:100%;height:100%;position:absolute;inset:0"></iframe>' +
    '</div>';
}

function opImagesBlockHtml(items, idxs) {
  if (items.length === 1) {
    var idx0 = idxs ? idxs[0] : 0;
    return '<div class="op-img-cell op-img-solo" data-op-media-idx="' + idx0 + '">' +
             '<img src="assets/photos/' + items[0].src + '" alt="">' +
           '</div>';
  }

  // Greedy row packing: accumulate images until total AR hits target (~2.8).
  // Each row gets padding-bottom = 100/totalAR % so every cell's AR exactly
  // matches the image — no uniform columns, varied compositions, no cropping.
  // Shuffle using seeded deterministic order (slug as seed keeps it stable on reload)
  var slots = items.map(function(it, i) {
    return { it: it, ar: (it.width && it.height) ? it.width / it.height : 1.5, idx: idxs ? idxs[i] : i };
  });
  for (var si = slots.length - 1; si > 0; si--) {
    var sj = Math.abs(Math.sin(si * 9301 + 49297) * 233280 | 0) % (si + 1);
    var tmp = slots[si]; slots[si] = slots[sj]; slots[sj] = tmp;
  }

  var TARGET = 2.8;
  var rows = [];
  var cur = [], curAR = 0;
  slots.forEach(function(s) {
    cur.push(s); curAR += s.ar;
    if (curAR >= TARGET || cur.length >= 4) {
      rows.push({ slots: cur.slice(), totalAR: curAR });
      cur = []; curAR = 0;
    }
  });
  if (cur.length) rows.push({ slots: cur, totalAR: curAR });

  var rowsHtml = rows.map(function(row) {
    var pct = Math.min(100 / row.totalAR, 72).toFixed(3);
    var cells = row.slots.map(function(s) {
      return '<div class="op-img-cell" data-op-media-idx="' + s.idx + '" style="flex:' + s.ar.toFixed(4) + '">' +
               '<img src="assets/photos/' + s.it.src + '" alt="">' +
             '</div>';
    }).join('');
    return '<div class="op-d-row" style="padding-bottom:' + pct + '%"><div class="op-d-row-inner">' + cells + '</div></div>';
  }).join('');
  return '<div class="op-d-image-group">' + rowsHtml + '</div>';
}

function opRenderDetail() {
  var root = document.getElementById('op-detail-root');
  if (!root) return;
  opLoadProjects().then(function(projects) {
    var total = projects.length;
    var tot = String(total).padStart(2, '0');
    var order = projects.map(function(p) { return p.slug; });
    var params = new URLSearchParams(window.location.search);
    var slug = order.indexOf(params.get('p')) >= 0 ? params.get('p') : order[0];
    var proj = projects.filter(function(p) { return p.slug === slug; })[0];
    if (!proj) return;
    var idx = order.indexOf(slug);
    var prev = projects[(idx - 1 + total) % total];
    var next = projects[(idx + 1) % total];
    var num = proj.n || String(idx + 1).padStart(2, '0');
    var groups = opGroupMedia(proj.media);
    var galleryHtml = groups.map(function(g) {
      return g.kind === 'video' ? opVideoBlockHtml(g.item, g.idx) : opImagesBlockHtml(g.items, g.idxs);
    }).join('');

    document.title = 'Oceane Productions — ' + opField(proj, 'title');
    var tr = (window.opTranslations && window.opTranslations[window.opLang || 'en']) || {};

    root.innerHTML = '' +
      '<div class="op-d-top">' +
        '<div class="op-d-topbar">' +
          '<a class="op-d-back" href="index.html">' + (tr.detail_back || '&larr; All projects') + '</a>' +
          '<div class="op-d-n"><span class="op-d-n-dot"></span>' + num + ' / ' + tot + '</div>' +
        '</div>' +
        '<div class="op-d-client" data-op-field="title"' + opFs(proj,'title') + '>' + opField(proj,'title') + '</div>' +
        '<div class="op-d-title" data-op-field="kind"' + opFs(proj,'kind') + '>' + opField(proj,'kind') + '</div>' +
        '<div class="op-d-meta-row">' +
          '<div class="op-d-meta-item"><span class="op-d-meta-label">' + (tr.detail_services || 'Services') + '</span><span class="op-d-meta-value" data-op-field="services">' + opField(proj,'services') + '</span></div>' +
          '<div class="op-d-meta-item"><span class="op-d-meta-label">' + (tr.detail_year || 'Year') + '</span><span class="op-d-meta-value" data-op-field="year">' + opField(proj,'year') + '</span></div>' +
        '</div>' +
        '<div class="op-d-desc"><p data-op-field="description"' + opFs(proj,'description') + '>' + opField(proj,'description') + '</p></div>' +
      '</div>' +
      (groups.length ? '<div class="op-d-gallery">' + galleryHtml + '</div>' : '') +
      '<div class="op-d-nav">' +
        '<a href="project.html?p=' + prev.slug + '">&larr; ' + opField(prev,'title') + '</a>' +
        '<a href="project.html?p=' + next.slug + '">' + opField(next,'title') + ' &rarr;</a>' +
      '</div>';
  });
}

opRenderHome();
opRenderDetail();
