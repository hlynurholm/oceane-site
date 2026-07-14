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
  return fetch('data/projects.json?v=' + Date.now()).then(function(r) { return r.json(); });
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
    var src = 'https://iframe.videodelivery.net/' + p.coverStreamUid +
              '?autoplay=true&muted=true&loop=true&controls=false&preload=auto';
    mediaEl = '<div class="op-proj-media" style="background:#141310">' +
                '<iframe src="' + src + '" allow="autoplay" tabindex="-1" ' +
                'style="border:none;position:absolute;inset:0;width:100%;height:100%;pointer-events:none"></iframe>' +
              '</div>';
  } else {
    var cover = p.media && p.media.length
      ? (p.media[0].type === 'video' ? p.media[0].poster : p.media[0].src)
      : '';
    var bgStyle = cover ? 'background-image:url(assets/photos/' + cover + ')' : 'background:#2a2824';
    mediaEl = '<div class="op-proj-media" style="' + bgStyle + '"></div>';
  }

  return '' +
    '<a class="op-proj" href="project.html?p=' + p.slug + '" id="work-' + p.slug + '">' +
      mediaEl +
      '<div class="op-proj-dotgrid" style="' + side + ':0"></div>' +
      '<div class="op-proj-ruler" style="' + side + ':0"></div>' +
      '<div class="' + scrimClass + '"></div>' +
      '<span class="op-proj-n" style="' + side + ':clamp(20px,4vw,56px)"><span class="op-proj-n-dot"></span>' + num + ' / ' + tot + '</span>' +
      '<span class="op-proj-timecode" style="' + side + ':clamp(20px,4vw,56px)">' + timecode + '</span>' +
      '<div class="op-proj-watermark" style="' + (alignRight ? 'left' : 'right') + ':2vw">' + num + '</div>' +
      '<div class="op-proj-info" style="' + side + ':clamp(20px,4vw,56px)' + (alignRight ? ';text-align:right' : '') + '">' +
        '<div class="op-proj-rule"' + (alignRight ? ' style="margin-left:auto"' : '') + '></div>' +
        '<div class="op-proj-title">' + p.title + '</div>' +
        '<div class="op-proj-kind">' + p.kind + '</div>' +
      '</div>' +
    '</a>';
}

function opRenderHome() {
  var root = document.getElementById('op-projects');
  if (!root) return;
  opLoadProjects().then(function(projects) {
    var total = projects.length;
    root.innerHTML = projects.map(function(p, i) { return opProjTile(p, i, total); }).join('');
  });
}

function opVideoBlockHtml(item, idx) {
  var idxAttr = idx !== undefined ? ' data-op-media-idx="' + idx + '"' : '';
  // Cloudflare Stream: embed as an autoplay/muted/loop iframe
  if (item.streamUid) {
    var src = 'https://iframe.videodelivery.net/' + item.streamUid +
              '?autoplay=true&muted=true&loop=true&controls=false&preload=auto';
    return '' +
      '<div class="op-d-video op-d-stream"' + idxAttr + '>' +
        '<iframe src="' + src + '" allow="autoplay; fullscreen; picture-in-picture" allowfullscreen style="border:none;width:100%;height:100%;position:absolute;inset:0"></iframe>' +
      '</div>';
  }
  // Fallback: static poster + play button
  var playEl = item.url
    ? '<a class="op-d-play" href="' + item.url + '" target="_blank" rel="noopener"><img src="assets/icons/play.svg" alt="Play"></a>'
    : '<div class="op-d-play"><img src="assets/icons/play.svg" alt=""></div>';
  return '' +
    '<div class="op-d-video"' + idxAttr + '>' +
      '<div class="op-d-video-media" style="background-image:url(assets/photos/' + (item.poster || '') + ')"></div>' +
      '<div class="op-d-video-scrim"></div>' +
      playEl +
    '</div>';
}

function opImagesBlockHtml(items, idxs) {
  var cols = Math.min(items.length, 3);
  var cells = items.map(function(it, i) {
    var ratio = items.length === 1 ? '16/9' : '4/3';
    var idx = idxs ? idxs[i] : i;
    return '<div class="op-img-cell" data-op-media-idx="' + idx + '"><img src="assets/photos/' + it.src + '" alt="" style="aspect-ratio:' + ratio + '"></div>';
  }).join('');
  return '<div class="op-d-images" style="grid-template-columns:repeat(' + cols + ',1fr)">' + cells + '</div>';
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

    document.title = 'Oceane Productions — ' + proj.title;

    root.innerHTML = '' +
      '<div class="op-d-top">' +
        '<div class="op-d-topbar">' +
          '<a class="op-d-back" href="index.html">&larr; All projects</a>' +
          '<div class="op-d-n"><span class="op-d-n-dot"></span>' + num + ' / ' + tot + '</div>' +
        '</div>' +
        '<div class="op-d-client" data-op-field="title">' + proj.title + '</div>' +
        '<div class="op-d-title" data-op-field="kind">' + proj.kind + '</div>' +
        '<div class="op-d-meta-row">' +
          '<div class="op-d-meta-item"><span class="op-d-meta-label">Client</span><span class="op-d-meta-value" data-op-field="client">' + proj.client + '</span></div>' +
          '<div class="op-d-meta-item"><span class="op-d-meta-label">Services</span><span class="op-d-meta-value" data-op-field="services">' + proj.services + '</span></div>' +
          '<div class="op-d-meta-item"><span class="op-d-meta-label">Year</span><span class="op-d-meta-value" data-op-field="year">' + proj.year + '</span></div>' +
        '</div>' +
        '<div class="op-d-desc"><p data-op-field="description">' + proj.description + '</p></div>' +
      '</div>' +
      (groups.length ? '<div class="op-d-gallery">' + galleryHtml + '</div>' : '') +
      '<div class="op-d-nav">' +
        '<a href="project.html?p=' + prev.slug + '">&larr; ' + prev.title + '</a>' +
        '<a href="project.html?p=' + next.slug + '">' + next.title + ' &rarr;</a>' +
      '</div>';
  });
}

opRenderHome();
opRenderDetail();
