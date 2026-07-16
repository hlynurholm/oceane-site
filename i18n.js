(function () {
  'use strict';

  // ── Translations ──────────────────────────────────────────────────────────────
  // Edit the 'is' block to update Icelandic copy for static page text.
  // Project titles / descriptions / kinds are stored in data/projects.json
  // as title_is, description_is, kind_is, services_is fields.
  window.opTranslations = {
    en: {
      nav_contact:      'contact',
      hero_h1:          'Professional production,<br>made simple.',
      hero_sub:         'Direct, efficient production for brands who want results without the overhead. Streamlined from first call to delivery. Based in Iceland, working worldwide.',
      footer_tag:       "07 / 06 — let’s talk",
      footer_h2:        'Got a shoot coming up?',
      footer_note:      'Budgets are small. Egos are too.',
      footer_cta:       'contact',
      contact_tag:      'get in touch',
      contact_h1:       "Let’s make<br>something.",
      contact_back:     '← back to work',
      detail_back:      '← All projects',
      detail_services:  'Services',
      detail_year:      'Year',
    },
    is: {
      nav_contact:      'hafa samband',
      hero_h1:          'Fagleg framleiðsla,<br>gerð einföld.',
      hero_sub:         'Bein og skilvirk framleiðsla fyrir vörumerki sem vilja niðurstöður. Frá fyrsta símtali til afhendingar. Með aðsetur á Íslandi, vinnur um heim allan.',
      footer_tag:       '07 / 06 — við tökum í gegn',
      footer_h2:        'Ertu með tökur í uppsiglingu?',
      footer_note:      'Fjárhagsáætlanir eru litlar. Egóið líka.',
      footer_cta:       'hafa samband',
      contact_tag:      'hafðu samband',
      contact_h1:       'Við skulum gera<br>eitthvað.',
      contact_back:     '← til baka',
      detail_back:      '← Öll verkefni',
      detail_services:  'Þjónusta',
      detail_year:      'Ár',
    }
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
