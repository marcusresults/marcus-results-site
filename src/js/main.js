/* Marcus Results — Site JS
   FAQ accordions, mobile nav, sticky CTA, scroll reveals, form validation
   ============================================================ */

(function () {
  'use strict';

  // ---------- Mobile nav toggle ----------
  document.querySelectorAll('.nav-toggle').forEach(function (btn) {
    btn.addEventListener('click', function () {
      var nav = document.querySelector('.main-nav');
      if (nav) nav.classList.toggle('open');
    });
  });

  // ---------- FAQ accordions ----------
  document.querySelectorAll('.faq-item').forEach(function (item) {
    var q = item.querySelector('.faq-q');
    var a = item.querySelector('.faq-a');
    if (!q || !a) return;
    q.addEventListener('click', function () {
      var open = item.classList.contains('open');
      // close others in same group
      var group = item.closest('.faq');
      if (group) {
        group.querySelectorAll('.faq-item.open').forEach(function (other) {
          if (other !== item) {
            other.classList.remove('open');
            var oa = other.querySelector('.faq-a');
            if (oa) oa.style.maxHeight = '0px';
          }
        });
      }
      if (open) {
        item.classList.remove('open');
        a.style.maxHeight = '0px';
      } else {
        item.classList.add('open');
        a.style.maxHeight = a.scrollHeight + 'px';
      }
    });
  });

  // ---------- Sticky CTA bar ----------
  var stickyCta = document.querySelector('.sticky-cta');
  if (stickyCta) {
    var heroEl = document.querySelector('.hero');
    var heroH = heroEl ? heroEl.offsetHeight : 600;
    var footerEl = document.querySelector('.site-footer');
    var raf = null;
    function onScroll() {
      if (raf) return;
      raf = requestAnimationFrame(function () {
        raf = null;
        var y = window.scrollY;
        var docH = document.documentElement.scrollHeight;
        var winH = window.innerHeight;
        var nearFooter = footerEl ? (y + winH > docH - footerEl.offsetHeight - 100) : false;
        if (y > heroH * 0.7 && !nearFooter) {
          stickyCta.classList.add('show');
        } else {
          stickyCta.classList.remove('show');
        }
      });
    }
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
  }

  // ---------- Scroll reveal ----------
  if ('IntersectionObserver' in window) {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (e.isIntersecting) {
          e.target.classList.add('in');
          io.unobserve(e.target);
        }
      });
    }, { threshold: 0.12, rootMargin: '0px 0px -40px 0px' });
    document.querySelectorAll('.reveal').forEach(function (el) { io.observe(el); });
  } else {
    document.querySelectorAll('.reveal').forEach(function (el) { el.classList.add('in'); });
  }

  // ---------- Chip groups (form selects) ----------
  document.querySelectorAll('[data-chip-group]').forEach(function (group) {
    var multi = group.dataset.multi === 'true';
    group.querySelectorAll('.chip').forEach(function (chip) {
      chip.addEventListener('click', function () {
        if (multi) {
          chip.classList.toggle('active');
        } else {
          group.querySelectorAll('.chip').forEach(function (c) { c.classList.remove('active'); });
          chip.classList.add('active');
        }
        var input = group.querySelector('input[type="hidden"]');
        if (input) {
          var vals = [];
          group.querySelectorAll('.chip.active').forEach(function (c) { vals.push(c.dataset.value); });
          input.value = vals.join(',');
        }
      });
    });
  });

  // ---------- Form validation + submit ----------
  document.querySelectorAll('form[data-validate]').forEach(function (form) {
    form.addEventListener('submit', async function (e) {
      e.preventDefault();
      var valid = true;
      form.querySelectorAll('[required]').forEach(function (input) {
        var field = input.closest('.field');
        if (!input.value || (input.type === 'email' && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(input.value))) {
          if (field) field.classList.add('invalid');
          valid = false;
        } else {
          if (field) field.classList.remove('invalid');
        }
      });
      if (!valid) return;

      var btn = form.querySelector('button[type="submit"]');
      var originalText = btn ? btn.textContent : '';
      if (btn) { btn.textContent = 'Sending...'; btn.disabled = true; }

      var endpoint = form.getAttribute('action') || '/api/submit';
      var redirect = form.dataset.redirect || '/thanks';

      try {
        var fd = new FormData(form);
        var res = await fetch(endpoint, { method: 'POST', body: fd });
        var data = await res.json().catch(function () { return {}; });
        if (res.ok && data.ok) {
          window.location.href = redirect;
          return;
        }
        throw new Error(data.error || 'Submit failed');
      } catch (err) {
        if (btn) { btn.textContent = originalText; btn.disabled = false; }
        var errBox = form.querySelector('.form-error');
        if (errBox) {
          errBox.textContent = 'Couldn\u2019t send \u2014 please call 0457 765 928 or email marcus@mrcusresults.com';
          errBox.style.display = 'block';
        }
        // reset turnstile if present
        if (window.turnstile && form.dataset.turnstileWidget) {
          try { window.turnstile.reset(form.dataset.turnstileWidget); } catch(_){}
        }
        return;
      }
    });

    form.querySelectorAll('input, textarea').forEach(function (input) {
      input.addEventListener('input', function () {
        var field = input.closest('.field');
        if (field) field.classList.remove('invalid');
      });
    });
  });

})();
