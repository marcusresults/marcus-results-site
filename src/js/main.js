/* Marcus Results — Site JS
   FAQ accordions, mobile nav, sticky CTA, scroll reveals, form validation
   ============================================================ */

(function () {
  'use strict';

  // ---------- Mobile nav toggle ----------
  document.querySelectorAll('.nav-toggle').forEach(function (btn) {
    btn.addEventListener('click', function () {
      var nav = document.querySelector('.main-nav');
      if (nav) {
        nav.classList.toggle('open');
        btn.setAttribute('aria-expanded', nav.classList.contains('open') ? 'true' : 'false');
      }
    });
  });

  // ---------- FAQ accordions ----------
  document.querySelectorAll('.faq-item').forEach(function (item) {
    var q = item.querySelector('.faq-q');
    var a = item.querySelector('.faq-a');
    if (!q || !a) return;
    q.setAttribute('aria-expanded', 'false');
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
            var oq = other.querySelector('.faq-q');
            if (oq) oq.setAttribute('aria-expanded', 'false');
          }
        });
      }
      if (open) {
        item.classList.remove('open');
        a.style.maxHeight = '0px';
        q.setAttribute('aria-expanded', 'false');
      } else {
        item.classList.add('open');
        a.style.maxHeight = a.scrollHeight + 'px';
        q.setAttribute('aria-expanded', 'true');
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
    // Stamp when the form became available. A submit that arrives milliseconds
    // later was not typed by a person.
    var stamp = form.querySelector('[name="ts"]');
    if (stamp) stamp.value = String(Date.now());

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

      var errBox = form.querySelector('.form-error');
      if (errBox) { errBox.textContent = ''; errBox.style.display = 'none'; }

      // If the captcha widget is on the page, make sure it has actually solved
      // before we post — otherwise the server just bounces it back as a 400.
      var captcha = form.querySelector('.cf-turnstile');
      if (captcha) {
        var tokenField = form.querySelector('[name="cf-turnstile-response"]');
        if (!tokenField || !tokenField.value) {
          if (errBox) {
            errBox.textContent = 'Please tick the human-check box, then hit send.';
            errBox.style.display = 'block';
          }
          return;
        }
      }

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
        if (errBox) {
          errBox.textContent = 'Couldn\u2019t send \u2014 please call 0457 765 928 or email marcus@marcusresults.com.au';
          errBox.style.display = 'block';
        }
        // Captcha tokens are single use \u2014 reset so a retry isn't dead on arrival.
        if (window.turnstile && captcha) {
          try { window.turnstile.reset(captcha); } catch (_) {}
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

  // ---------- Booking month (one month ahead of the viewer's date) ----------
  var bookingEl = document.getElementById('booking-month');
  if (bookingEl) {
    var bNow = new Date();
    var bNext = new Date(bNow.getFullYear(), bNow.getMonth() + 1, 1);
    var B_MONTHS = ['JANUARY', 'FEBRUARY', 'MARCH', 'APRIL', 'MAY', 'JUNE', 'JULY', 'AUGUST', 'SEPTEMBER', 'OCTOBER', 'NOVEMBER', 'DECEMBER'];
    bookingEl.textContent = B_MONTHS[bNext.getMonth()] + ' ' + bNext.getFullYear();
  }

})();
