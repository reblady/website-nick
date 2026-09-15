(function () {
  'use strict';

  var html = document.documentElement;

  var reduceMotionMQ = matchMedia('(prefers-reduced-motion: reduce)');
  var isNarrow = function () { return window.innerWidth < 760; };

  /* ---------------- theme toggle ---------------- */

  function initThemeToggle() {
    var btn = document.getElementById('themeToggle');
    if (!btn) return;

    btn.addEventListener('click', function () {
      var next = html.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
      html.setAttribute('data-theme', next);
      try { localStorage.setItem('reblady-theme', next); } catch (e) {}
    });
  }

  /* ---------------- low-power toggle (manual, guaranteed fallback) ---------------- */

  function initLowPowerToggle() {
    var btn = document.getElementById('lowPowerToggle');
    if (!btn) return;

    var sync = function () {
      var active = html.classList.contains('low-power');
      btn.setAttribute('aria-pressed', String(active));
    };
    sync();

    btn.addEventListener('click', function () {
      var next = !html.classList.contains('low-power');
      html.classList.toggle('low-power', next);
      try { localStorage.setItem('reblady-low-power', next ? '1' : '0'); } catch (e) {}
      sync();
      applyGalleryMode();
    });
  }

  /* ---------------- mini header + is-scrolling, driven by one rAF loop ---------------- */

  var miniHeader = document.getElementById('miniHeader');
  var hero = document.getElementById('hero');
  var scrollTicking = false;
  var scrollStopTimer = null;

  function onScrollFrame() {
    scrollTicking = false;
    var y = window.scrollY;

    if (miniHeader && hero) {
      var threshold = hero.offsetHeight * 0.7;
      miniHeader.classList.toggle('is-visible', y > threshold);
    }

    updateGalleryScrub(y);
  }

  function onScroll() {
    if (!html.classList.contains('is-scrolling')) {
      html.classList.add('is-scrolling');
    }
    clearTimeout(scrollStopTimer);
    scrollStopTimer = setTimeout(function () {
      html.classList.remove('is-scrolling');
    }, 160);

    if (!scrollTicking) {
      scrollTicking = true;
      requestAnimationFrame(onScrollFrame);
    }
  }

  /* ---------------- pinned horizontal gallery ---------------- */

  var galleryPin = document.getElementById('galleryPin');
  var gallerySticky = galleryPin ? galleryPin.querySelector('.gallery-pin__sticky') : null;
  var galleryTrack = document.getElementById('galleryTrack');
  var galleryScrollDistance = 0;
  var galleryPinned = false;

  function shouldUseSimpleGallery() {
    return reduceMotionMQ.matches || isNarrow() || html.classList.contains('low-power');
  }

  function setupPinnedGallery() {
    if (!galleryPin || !galleryTrack) return;
    var buffer = 40;
    galleryScrollDistance = Math.max(0, galleryTrack.scrollWidth - window.innerWidth + buffer);
    galleryPin.style.height = (window.innerHeight + galleryScrollDistance) + 'px';
    galleryTrack.style.transform = 'translateX(0px)';
  }

  function teardownPinnedGallery() {
    if (!galleryPin || !galleryTrack) return;
    galleryPin.style.height = '';
    galleryTrack.style.transform = '';
  }

  function applyGalleryMode() {
    if (!galleryPin) return;
    var simple = shouldUseSimpleGallery();
    galleryPin.classList.toggle('gallery-pin--simple', simple);
    galleryPinned = !simple;
    if (galleryPinned) {
      setupPinnedGallery();
    } else {
      teardownPinnedGallery();
    }
  }

  function updateGalleryScrub(y) {
    if (!galleryPinned || !galleryTrack || !galleryPin || galleryScrollDistance <= 0) return;
    var sectionTop = galleryPin.offsetTop;
    var progress = (y - sectionTop) / galleryScrollDistance;
    progress = Math.min(1, Math.max(0, progress));
    galleryTrack.style.transform = 'translateX(' + (-progress * galleryScrollDistance) + 'px)';
  }

  var resizeTimer = null;
  function onResize() {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(function () {
      applyGalleryMode();
      onScrollFrame();
    }, 150);
  }

  /* ---------------- adaptive low-power detection ---------------- */
  /* measures real frame times; if the device keeps dropping frames while
     scrolling, permanently switch to blur-free faux-glass everywhere */

  function initAdaptiveLowPower() {
    if (html.classList.contains('low-power')) return;

    var samples = [];
    var lastTime = null;
    var maxSamples = 90;
    var active = false;

    function sample(time) {
      if (lastTime !== null) {
        samples.push(time - lastTime);
        if (samples.length > maxSamples) samples.shift();
      }
      lastTime = time;

      if (samples.length >= maxSamples) {
        var jankyCount = samples.filter(function (d) { return d > 32; }).length;
        if (jankyCount / samples.length > 0.25) {
          html.classList.add('low-power');
          try { localStorage.setItem('reblady-low-power', '1'); } catch (e) {}
          var btn = document.getElementById('lowPowerToggle');
          if (btn) btn.setAttribute('aria-pressed', 'true');
          applyGalleryMode();
          active = false;
          return;
        }
        samples.length = 0;
      }

      if (active) requestAnimationFrame(sample);
    }

    var startedOnce = false;
    window.addEventListener('scroll', function () {
      if (startedOnce || html.classList.contains('low-power')) return;
      startedOnce = true;
      active = true;
      requestAnimationFrame(sample);
      setTimeout(function () { active = false; }, 8000);
    }, { passive: true, once: true });
  }

  /* ---------------- Discord live presence (Lanyard) ----------------
     Fill in your Discord user id below to enable the status chip.
     Requires membership in the Lanyard Discord server to work. */

  var DISCORD_USER_ID = 'REPLACE_WITH_DISCORD_USER_ID';

  function initDiscordStatus() {
    var box = document.getElementById('discordStatus');
    var dot = document.getElementById('discordStatusDot');
    var text = document.getElementById('discordStatusText');
    if (!box || DISCORD_USER_ID === 'REPLACE_WITH_DISCORD_USER_ID') return;

    fetch('https://api.lanyard.rest/v1/users/' + DISCORD_USER_ID)
      .then(function (res) { return res.json(); })
      .then(function (json) {
        if (!json || !json.success) return;
        var status = json.data.discord_status || 'offline';
        var labels = { online: 'Online', idle: 'Abwesend', dnd: 'Nicht stören', offline: 'Offline' };
        if (text) text.textContent = labels[status] || status;
        if (dot) dot.style.background = status === 'offline' ? 'var(--text-2)' : '';
        box.hidden = false;
      })
      .catch(function () { /* status chip stays hidden on failure */ });
  }

  /* ---------------- misc ---------------- */

  function initDiscordInvitePlaceholder() {
    var link = document.getElementById('discordInviteLink');
    if (!link) return;
    if (link.getAttribute('href') === '#') {
      link.addEventListener('click', function (e) {
        e.preventDefault();
        console.info('[reblady] Discord invite link is still a placeholder — set the real invite URL in index.html.');
      });
    }
  }

  /* ---------------- boot ---------------- */

  document.addEventListener('DOMContentLoaded', function () {
    initThemeToggle();
    initLowPowerToggle();
    initDiscordInvitePlaceholder();
    initDiscordStatus();

    applyGalleryMode();
    onScrollFrame();

    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onResize);

    reduceMotionMQ.addEventListener('change', applyGalleryMode);

    if (!reduceMotionMQ.matches) initAdaptiveLowPower();
  });
})();
