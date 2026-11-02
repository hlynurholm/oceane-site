(function () {
  'use strict';

  // ── Translations ──────────────────────────────────────────────────────────────
  // Edit the 'is' block to update Icelandic copy for static page text.
  // Project titles / descriptions / kinds are stored in data/projects.json
  // as title_is, description_is, kind_is, services_is fields.
  window.opTranslations = {
    en: {
      nav_home:         'home',
      nav_about:        'about',
      nav_contact:      'contact',
      hero_h1:          'Professional production,<br>made simple.',
      hero_sub:         'Commercials, documentaries and social content. Small crew, honest timelines, one point of contact from first call to delivery. Based in Iceland, working worldwide.',
      footer_tag:       "07 / 06 — let's talk",
      footer_h2:        'Got a shoot coming up?',
      footer_cta:       'Tell me about your shoot',
      detail_back:      '← All projects',
      detail_services:  'Services',
      detail_year:      'Year',
      clients_label:    'Selected clients',
      footer_privacy:   'privacy',
      notfound_tag:     '404',
      notfound_h1:      "This page doesn't exist.",
      notfound_back:    '← back to work',
      privacy_tag:      'privacy',
      privacy_h1:       'What this site collects.',
      privacy_p1:       'Almost nothing. There are no analytics, no advertising trackers, and no cookies set by this site.',
      privacy_p2:       'On your first visit, your IP address is sent to ipapi.co to guess your country, so the site can open in Icelandic for visitors in Iceland. The result is saved in your browser as a language preference. Nothing else is stored.',
      privacy_p3:       'The site is hosted on Cloudflare and videos are streamed through Cloudflare Stream. Cloudflare keeps standard server logs, including IP addresses, for security. See the Cloudflare privacy policy for details.',
      privacy_p4:       'If you email hlynur@oceane.is, your message is handled like any other email and is not added to any list.',
      privacy_back:     '← back to work',
    },
    is: {
      nav_home:         'heim',
      nav_about:        'um',
      nav_contact:      'samband',
      footer_tag:       '07 / 06 — við tökum í gegn',
      footer_cta:       'Segðu mér frá tökunum',
      detail_back:      '← Öll verkefni',
      detail_services:  'Þjónusta',
      detail_year:      'Ár',
      clients_label:    'Meðal viðskiptavina',
      footer_privacy:   'persónuvernd',
      notfound_tag:     '404',
      notfound_h1:      'Þessi síða er ekki til.',
      notfound_back:    '← til baka',
      privacy_tag:      'persónuvernd',
      privacy_h1:       'Hvað þessi síða safnar.',
      privacy_p1:       'Nánast engu. Hér er engin vefgreining, engir auglýsingarekjarar og síðan setur engar vafrakökur.',
      privacy_p2:       'Í fyrstu heimsókn er IP-tala þín send til ipapi.co til að giska á land, svo síðan geti opnast á íslensku fyrir gesti á Íslandi. Niðurstaðan er vistuð í vafranum þínum sem tungumálaval. Ekkert annað er geymt.',
      privacy_p3:       'Síðan er hýst hjá Cloudflare og myndbönd eru streymd í gegnum Cloudflare Stream. Cloudflare heldur hefðbundnar þjónaskrár, þar á meðal IP-tölur, af öryggisástæðum. Sjá persónuverndarstefnu Cloudflare.',
      privacy_p4:       'Ef þú sendir tölvupóst á hlynur@oceane.is er honum svarað eins og hverjum öðrum pósti og hann er ekki settur á neinn lista.',
      privacy_back:     '← til baka',
    }
  };

  // ── Shared page-copy loader ───────────────────────────────────────────────────
  // data/pages.json holds the about/contact copy and the Icelandic overrides for
  // the homepage. _headers sends no-cache for /data/*, so no cache-buster needed.
  window.opLoadPages = function () {
    if (window.__opPagesOverride) return Promise.resolve(window.__opPagesOverride);
    if (window.__opPagesCache)    return Promise.resolve(window.__opPagesCache);
    return fetch('data/pages.json')
      .then(function (r) { return r.json(); })
      .then(function (d) { window.__opPagesCache = d; return d; });
  };

  // ── Language state ────────────────────────────────────────────────────────────
  var stored = localStorage.getItem('op-lang');
  window.opLang = stored || 'en';

  // ── DOM apply ─────────────────────────────────────────────────────────────────
  function applyTranslations() {
    var t = window.opTranslations[window.opLang];
    if (!t) return;
    document.querySelectorAll('[data-i18n]').forEach(function (el) {
      var key = el.dataset.i18n;
      if (t[key] !== undefined) el.innerHTML = t[key];
    });
    document.documentElement.lang = window.opLang === 'is' ? 'is' : 'en';
    var toggle = document.getElementById('op-lang-toggle');
    if (toggle) toggle.textContent = window.opLang === 'is' ? 'EN' : 'IS';
  }

  // ── Public API ────────────────────────────────────────────────────────────────
  window.opSetLang = function (lang) {
    window.opLang = lang;
    localStorage.setItem('op-lang', lang);
    applyTranslations();
    if (typeof opRenderHome   === 'function') opRenderHome();
    if (typeof opRenderDetail === 'function') opRenderDetail();
  };

  // ── Init ──────────────────────────────────────────────────────────────────────
  document.addEventListener('DOMContentLoaded', function () {
    var toggle = document.getElementById('op-lang-toggle');
    if (toggle) {
      toggle.addEventListener('click', function () {
        window.opSetLang(window.opLang === 'is' ? 'en' : 'is');
      });
    }
    applyTranslations();

    // Geo-detect only on first visit (no stored pref)
    if (!stored) {
      fetch('https://ipapi.co/json/')
        .then(function (r) { return r.json(); })
        .then(function (d) { if (d.country_code === 'IS') window.opSetLang('is'); })
        .catch(function () {});
    }
  });
})();
