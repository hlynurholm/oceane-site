function opGroupMedia(items) {
  var groups = [], buffer = [];
  items.forEach(function(item){
    if (item.type === 'image') buffer.push(item);
    else { if (buffer.length) { groups.push({ kind: 'images', items: buffer }); buffer = []; } groups.push({ kind: 'video', item: item }); }
  });
  if (buffer.length) groups.push({ kind: 'images', items: buffer });
  return groups;
}

function opLoadProjects() {
  return fetch('data/projects.json').then(function(r){ return r.json(); });
}

function opProjTile(p, index) {
  var alignRight = index % 2 === 1;
  var side = alignRight ? 'right' : 'left';
  var scrimClass = alignRight ? 'op-proj-scrim-r' : 'op-proj-scrim-l';
  var timecode = '00:0' + p.n[1] + ':14:0' + ((index % 9) + 1);
  var cover = p.media[0].type === 'video' ? p.media[0].poster : p.media[0].src;
  return '' +
    '<a class="op-proj" href="project.html?p=' + p.slug + '" id="work-' + p.slug + '">' +
      '<div class="op-proj-media" style="background-image:url(assets/photos/' + cover + ')"></div>' +
      '<div class="op-proj-dotgrid" style="' + side + ':0"></div>' +
      '<div class="op-proj-ruler" style="' + side + ':0"></div>' +
      '<div class="' + scrimClass + '"></div>' +
      '<span class="op-proj-n" style="' + side + ':clamp(20px,4vw,56px)"><span class="op-proj-n-dot"></span>' + p.n + ' / 06</span>' +
      '<span class="op-proj-timecode" style="' + side + ':clamp(20px,4vw,56px)">' + timecode + '</span>' +
      '<div class="op-proj-watermark" style="' + (alignRight ? 'left' : 'right') + ':2vw">' + p.n + '</div>' +
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
  opLoadProjects().then(function(projects){
    root.innerHTML = projects.map(opProjTile).join('');
  });
}

function opVideoBlockHtml(item) {
  return '' +
    '<div class="op-d-video">' +
      '<div class="op-d-video-media" style="background-image:url(assets/photos/' + item.poster + ')"></div>' +
      '<div class="op-d-video-scrim"></div>' +
      '<div class="op-d-play"><img src="assets/icons/play.svg" alt=""></div>' +
    '</div>';
}

function opImagesBlockHtml(items) {
  var cols = Math.min(items.length, 3);
  var imgs = items.map(function(it){
    var ratio = items.length === 1 ? '16/9' : '4/3';
    return '<img src="assets/photos/' + it.src + '" alt="" style="aspect-ratio:' + ratio + '">';
  }).join('');
  return '<div class="op-d-images" style="grid-template-columns:repeat(' + cols + ',1fr)">' + imgs + '</div>';
}

function opRenderDetail() {
  var root = document.getElementById('op-detail-root');
  if (!root) return;
  opLoadProjects().then(function(projects){
    var order = projects.map(function(p){ return p.slug; });
    var params = new URLSearchParams(window.location.search);
    var slug = order.indexOf(params.get('p')) >= 0 ? params.get('p') : order[0];
    var proj = projects.filter(function(p){ return p.slug === slug; })[0];
    var idx = order.indexOf(slug);
    var prev = projects[(idx - 1 + projects.length) % projects.length];
    var next = projects[(idx + 1) % projects.length];
    var groups = opGroupMedia(proj.media);
    var galleryHtml = groups.map(function(g){
      return g.kind === 'video' ? opVideoBlockHtml(g.item) : opImagesBlockHtml(g.items);
    }).join('');

    document.title = 'Oceane Productions \u2014 ' + proj.title;

    root.innerHTML = '' +
      '<div class="op-d-top">' +
        '<div class="op-d-topbar">' +
          '<a class="op-d-back" href="index.html">&larr; All projects</a>' +
          '<div class="op-d-n"><span class="op-d-n-dot"></span>' + proj.n + ' / 06</div>' +
        '</div>' +
        '<div class="op-d-client">' + proj.client + '</div>' +
        '<div class="op-d-title">' + proj.title + ' \u2014 ' + proj.kind + '</div>' +
        '<div class="op-d-meta-row">' +
          '<div class="op-d-meta-item"><span class="op-d-meta-label">Services</span><span class="op-d-meta-value">' + proj.services + '</span></div>' +
          '<div class="op-d-meta-item"><span class="op-d-meta-label">Year</span><span class="op-d-meta-value">' + proj.year + '</span></div>' +
        '</div>' +
        '<div class="op-d-desc"><p>' + proj.description + '</p></div>' +
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
