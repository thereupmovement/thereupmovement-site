/* ReUp forms inside the app.
   One screen for every Google Form ReUp uses (needs, story, community donor, sort an item, pallet pickup,
   add a past volunteer). It reads the questions from the Google Form through the Hub server and sends the answers
   back through the same Google Form, so the sheets, columns and form triggers stay exactly as they were.
   Used by the community page (index.html, direct links like thereupmovement.org/?f=needs) and the Team Hub.
   Styling uses the "vs-" classes both pages already have for the volunteer sign-up. No team data lives here. */
(function () {
  "use strict";
  var uid = 0;
  var esc = function (s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); };
  // Help text from the Google Form: keep line breaks and make web addresses tappable.
  var rich = function (s) { return esc(s).replace(/(https?:\/\/[^\s<]+[^\s<.,)])/g, '<a href="$1" target="_blank" rel="noopener">$1</a>').replace(/\n/g, "<br>"); };

  var css = ".nf-sel{font:inherit;color:var(--ink);background:var(--surface);border:1.5px solid var(--line);border-radius:12px;padding:12px 14px;min-height:48px;width:100%;box-sizing:border-box}" +
    ".nf-sec{display:grid;gap:14px;border:0;margin:0;padding:0}.nf-sec>legend{font-weight:800;font-size:18px;padding:0;margin-bottom:6px}" +
    ".nf-note{margin:0;font-size:15px}.nf-grid{display:grid;gap:10px}.nf-row{display:grid;gap:6px}.nf-row>b{font-weight:700;font-size:15px}" +
    ".nf-other{margin-top:6px}.nf-photo img{display:block;width:100%;height:120px;object-fit:cover;border-radius:12px}.nf-pics{display:grid;grid-template-columns:repeat(auto-fill,minmax(120px,1fr));gap:8px;margin-top:8px}.nf-q{padding:10px 12px;border-radius:12px;border:1px solid currentColor;margin:0 0 14px;line-height:1.45}.nf-q:empty{display:none}.nf-q p{margin:6px 0 0}.nf-q button,.nf-same{margin-top:6px;padding:8px 12px;border-radius:10px;border:1px solid currentColor;background:none;color:inherit;font:inherit;font-size:15px;cursor:pointer}.nf-pic button{width:100%;margin-top:4px;padding:8px;border-radius:10px;border:1px solid currentColor;background:none;color:inherit;font:inherit;font-size:14px;cursor:pointer}" +
    ".nf-req{color:var(--muted);font-weight:400;font-size:14px}.vs-field input[type=date],.vs-field input[type=time],.vs-field input[type=number]{font:inherit;color:var(--ink);background:var(--surface);border:1.5px solid var(--line);border-radius:12px;padding:12px 14px;min-height:48px;width:100%;box-sizing:border-box}";
  if (!document.getElementById("nf-css")) { var st = document.createElement("style"); st.id = "nf-css"; st.textContent = css; document.head.appendChild(st); }

  // Which sections someone goes through, given their answers. The server uses the same rule.
  // wait: on screen, stop at a section whose answer decides where to go next until that answer is picked.
  function path(def, ans, wait) {
    var seen = {}, out = [], s = 0;
    while (s < def.sections.length && !seen[s]) {
      seen[s] = 1; out.push(s);
      var nav = def.sections[s].after, open = false;
      def.sections[s].items.forEach(function (it) {
        if ((it.type === "radio" || it.type === "list") && ans[it.id]) {
          var c = (it.choices || []).filter(function (c) { return c.v === ans[it.id]; })[0];
          if (c && c.go) nav = c.go;
        }
        if (wait && (it.type === "radio" || it.type === "list") && !ans[it.id] && (it.choices || []).some(function (c) { return c.go; })) open = true;
      });
      if (open || (nav && nav.t === "end")) break;
      s = nav && nav.t === "go" ? nav.to : s + 1;
    }
    return out;
  }
  // A phone photo, made smaller before it is sent.
  function shrink(file) {
    return new Promise(function (ok, no) {
      var img = new Image(), url = URL.createObjectURL(file);
      img.onload = function () {
        var k = Math.min(1, 1600 / Math.max(img.width, img.height)), c = document.createElement("canvas");
        c.width = Math.round(img.width * k); c.height = Math.round(img.height * k);
        c.getContext("2d").drawImage(img, 0, 0, c.width, c.height); URL.revokeObjectURL(url);
        ok(c.toDataURL("image/jpeg", 0.82));
      };
      img.onerror = function () { URL.revokeObjectURL(url); no(new Error("That photo could not be opened. Try another one.")); };
      img.src = url;
    });
  }
  function kind(title) {
    var t = String(title).toLowerCase();
    if (/phone|cell/.test(t)) return ' type="tel" inputmode="tel" autocomplete="tel"';
    if (/e-?mail/.test(t)) return ' type="email" inputmode="email" autocomplete="email"';
    if (/^(quantity|items per unit)$|how many/.test(t)) return ' type="text" inputmode="numeric"';
    if (/zip/.test(t)) return ' type="text" inputmode="numeric" autocomplete="postal-code"';
    if (/^(your )?(first and last )?name$|^your name/.test(t)) return ' type="text" autocomplete="name"';
    if (/address/.test(t)) return ' type="text" autocomplete="street-address"';
    return ' type="text"';
  }

  /* opts: load() -> Promise(def), send(answers, photos (a list), website, event) -> Promise({done}), team (bool), onDone(),
     keep (a name: pickup, sorted by, location and event stay for the next entry on this phone for 12 hours). */
  function mount(root, opts) {
    var id = "nf" + (++uid), D = null, A = {}, photos = [], sending = false, MAXP = 10, EV = "", pkOther = false, kept = false, LAST = null, Q = [], qBusy = false, qFail = [], qDone = 0;
    root.innerHTML = '<div class="vs"><p class="vs-lead">Loading...</p></div>';
    opts.load().then(function (d) { D = d; prefill(); draw(); }, function () {
      root.innerHTML = '<div class="vs"><p class="vs-lead">This form could not load right now. Check your connection and try again.</p>' +
        '<div class="vs-row"><button type="button" class="vs-btn" data-nf-retry>Try again</button>' +
        (opts.fallback ? '<a class="vs-btn ghost" href="' + esc(opts.fallback) + '" target="_blank" rel="noopener">Open the Google Form instead</a>' : "") + "</div></div>";
      root.querySelector("[data-nf-retry]").onclick = function () { mount(root, opts); };
    });
    // Sort an item, to make logging fast (20 Nov 2026): the pickup, who sorted, the location and the event stay from the
    // last item (on this phone, for 12 hours), because a whole box is usually logged in one go.
    var KEEP = /pickup id|sorted by|^location$/i;
    function keepLoad() {
      if (!opts.keep) return;
      try { var k = JSON.parse(localStorage.getItem(opts.keep) || "null"); if (!k || Date.now() - k.at > 12 * 3600e3) return;
        Object.keys(k.a || {}).forEach(function (q) { A[q] = k.a[q]; }); EV = k.ev || ""; LAST = k.last || null; kept = true; } catch (e) {}
    }
    function keepSave() {
      if (!opts.keep) return {};
      var a = {}; D.sections.forEach(function (s) { s.items.forEach(function (q) { if (KEEP.test(q.title) && A[q.id]) a[q.id] = A[q.id]; }); });
      LAST = JSON.parse(JSON.stringify(A));
      try { localStorage.setItem(opts.keep, JSON.stringify({ at: Date.now(), a: a, ev: EV, last: LAST })); } catch (e) {}
      return a;
    }
    function qid(re) { var c = null; D.sections.forEach(function (s) { s.items.forEach(function (q) { if (re.test(q.title)) c = q.id; }); }); return c; }
    function catId() { return qid(/^category$/i); }
    // Set an answer by question title, only to one of that question's own choices.
    function setT(re, val) { D.sections.forEach(function (s) { s.items.forEach(function (q) { if (re.test(q.title) && val && (!q.choices || q.choices.some(function (c) { return c.v === val; }))) A[q.id] = val; }); }); }
    function prefill() {
      keepLoad();
      // The usual Unit and Condition from the Item Log, picked already (they can be changed).
      if (D.usual) Object.keys(D.usual).forEach(function (t) { var id2 = qid(new RegExp("^" + t + "$", "i")); if (id2 && !A[id2]) setT(new RegExp("^" + t + "$", "i"), D.usual[t]); });
      if (!opts.team || !D.me) return;
      D.sections.forEach(function (s) { s.items.forEach(function (q) { if (q.type === "text" && /sorted by|logged by|your name|who (drove|sorted|is filling)|driver/i.test(q.title) && !A[q.id]) A[q.id] = D.me; }); });
    }
    function field(q) {
      var n = id + q.id, req = q.req ? "" : ' <span class="nf-req">(optional)</span>';
      var lab = "<span>" + esc(q.title) + req + "</span>" + (q.help ? "<small>" + rich(q.help) + "</small>" : "");
      var v = A[q.id], opt = function (type, val, on, shown) { return '<label class="vs-opt"><input type="' + type + '" name="' + n + '" value="' + esc(val) + '"' + (on ? " checked" : "") + "><span>" + esc(shown || val) + "</span></label>"; };
      switch (q.type) {
        case "note": return '<p class="nf-note"><b>' + esc(q.title) + "</b>" + (q.help ? "<br>" + rich(q.help) : "") + "</p>";
        case "text":
          if (/pickup id/i.test(q.title) && D.pickupLabels && D.pickups && D.pickups.length) {
            // A dropdown of the pickups, newest first, by date and donor. "Not on the list" opens the box to type an ID.
            var typing = pkOther || (v && D.pickups.indexOf(v) < 0), seen = {};
            D.pickups.forEach(function (x) { var l = D.pickupLabels[x] || x; seen[l] = (seen[l] || 0) + 1; });
            var ev = D.events ? '<label class="vs-field"><span>Set aside for an event?</span><small>Most items are general stock. Pick an event only if this item is saved for it.</small>' +
              '<select class="nf-sel" data-ev="1"><option value="">General stock, any event</option>' + D.events.map(function (e) { var k = e.date + "|" + e.name; return '<option value="' + esc(k) + '"' + (EV === k ? " selected" : "") + ">" + esc(e.label) + "</option>"; }).join("") + "</select></label>" : "";
            return '<div class="vs-field">' + lab + '<select class="nf-sel" data-pk="' + q.id + '" aria-label="' + esc(q.title) + '"><option value="">Pick the pickup</option>' +
              D.pickups.map(function (x) { var l = D.pickupLabels[x] || x; return '<option value="' + esc(x) + '"' + (!typing && v === x ? " selected" : "") + ">" + esc(seen[l] > 1 ? l + " (" + x + ")" : l) + "</option>"; }).join("") +
              '<option value="__other"' + (typing ? " selected" : "") + ">Not on the list: type the pickup ID</option></select>" +
              "<input" + kind(q.title) + ' data-q="' + q.id + '" maxlength="60" placeholder="For example RMA-2026-11-19-01" aria-label="Pickup ID" value="' + esc(v || "") + '"' + (typing ? "" : " hidden") + "></div>" + ev;
          }
          if (/^location$/i.test(q.title) && D.locations && D.locations.length) {
            // The storage locations used lately, as buttons; the box below still takes anything else.
            return '<div class="vs-field" role="group" aria-label="' + esc(q.title) + '">' + lab + '<div class="vs-opts vs-chips" data-ql="' + q.id + '">' + D.locations.map(function (l) { return opt("radio", l, v === l); }).join("") + "</div>" +
              "<input" + kind(q.title) + ' data-q="' + q.id + '" maxlength="200" placeholder="Or type where it is" aria-label="' + esc(q.title) + '" value="' + esc(v || "") + '" style="margin-top:8px"></div>';
          }
          if (/^item description$/i.test(q.title) && D.past && D.past.length) {
            // Names logged before; picking one fills in its category, subcategory and unit.
            return '<label class="vs-field">' + lab.replace("</span>", "</span><small>Start typing. A name logged before fills in its category and unit.</small>") + "<input" + kind(q.title) + ' data-q="' + q.id + '" maxlength="500" autocomplete="off" list="' + n + 'd" value="' + esc(v || "") + '">' +
              '<datalist id="' + n + 'd">' + D.past.map(function (x) { return '<option value="' + esc(x[0]) + '">'; }).join("") + "</datalist></label>";
          }
          var list = /pickup id/i.test(q.title) && D.pickups && D.pickups.length ? ' list="' + n + 'l"' : "";
          return '<label class="vs-field">' + lab + "<input" + kind(q.title) + ' data-q="' + q.id + '" maxlength="500" value="' + esc(v || "") + '"' + list + ">" +
            (list ? '<datalist id="' + n + 'l">' + D.pickups.map(function (p) { return '<option value="' + esc(p) + '">'; }).join("") + "</datalist>" : "") + "</label>";
        case "para": return '<label class="vs-field">' + lab + '<textarea rows="4" maxlength="5000" data-q="' + q.id + '">' + esc(v || "") + "</textarea></label>";
        case "date": return '<label class="vs-field">' + lab + '<input type="date" data-q="' + q.id + '" value="' + esc(v || "") + '"></label>';
        case "time": return '<label class="vs-field">' + lab + '<input type="time" data-q="' + q.id + '" value="' + esc(v || "") + '"></label>';
        case "list":
          var ch = q.choices.map(function (c) { return { v: c.v, t: c.v }; }), cat = /subcategory/i.test(q.title) && catId() ? A[catId()] : "";
          if (cat) {
            // Subcategory shows only the ones under the picked category ("Home Goods — Cookware" shows as "Cookware").
            var sub = ch.filter(function (c) { return c.v.indexOf(cat + " — ") === 0 || c.v.indexOf(cat + " - ") === 0; }).map(function (c) { return { v: c.v, t: c.v.slice(cat.length + 3) }; });
            if (sub.length) ch = sub;
          }
          if (ch.length <= 6) return '<div class="vs-field" role="radiogroup" aria-label="' + esc(q.title) + '">' + lab + '<div class="vs-opts" data-qr="' + q.id + '">' + ch.map(function (c) { return opt("radio", c.v, v === c.v, c.t); }).join("") + "</div></div>";
          return '<label class="vs-field">' + lab + '<select class="nf-sel" data-q="' + q.id + '"><option value="">Pick one</option>' + ch.map(function (c) { return '<option value="' + esc(c.v) + '"' + (v === c.v ? " selected" : "") + ">" + esc(c.t) + "</option>"; }).join("") + "</select></label>";
        case "radio":
          var isOther = v && !q.choices.some(function (c) { return c.v === v; });
          return '<div class="vs-field" role="radiogroup" aria-label="' + esc(q.title) + '">' + lab + '<div class="vs-opts" data-qr="' + q.id + '">' + q.choices.map(function (c) { return opt("radio", c.v, v === c.v); }).join("") +
            (q.other ? opt("radio", "Other", isOther) : "") + "</div>" + (q.other ? '<input class="nf-other" type="text" data-qo="' + q.id + '" placeholder="Tell us" aria-label="Other" value="' + esc(isOther ? v : "") + '"' + (isOther ? "" : " hidden") + ">" : "") + "</div>";
        case "check":
          var arr = Array.isArray(v) ? v : [], oth = arr.filter(function (x) { return !q.choices.some(function (c) { return c.v === x; }); })[0];
          return '<div class="vs-field" role="group" aria-label="' + esc(q.title) + '">' + lab + '<div class="vs-opts vs-chips" data-qc="' + q.id + '">' + q.choices.map(function (c) { return opt("checkbox", c.v, arr.indexOf(c.v) >= 0); }).join("") +
            (q.other ? opt("checkbox", "Other", !!oth) : "") + "</div>" + (q.other ? '<input class="nf-other" type="text" data-qo="' + q.id + '" placeholder="Tell us" aria-label="Other" value="' + esc(oth || "") + '"' + (oth ? "" : " hidden") + ">" : "") + "</div>";
        case "scale":
          var nums = []; for (var i = q.lo; i <= q.hi; i++) nums.push(String(i));
          return '<div class="vs-field" role="radiogroup" aria-label="' + esc(q.title) + '">' + lab + (q.loL || q.hiL ? "<small>" + esc(q.lo + " = " + (q.loL || "") + ", " + q.hi + " = " + (q.hiL || "")) + "</small>" : "") +
            '<div class="vs-opts vs-chips" data-qr="' + q.id + '">' + nums.map(function (x) { return opt("radio", x, String(v) === x); }).join("") + "</div></div>";
        case "grid": case "cgrid":
          var g = Array.isArray(v) ? v : [], multi = q.type === "cgrid";
          return '<div class="vs-field">' + lab + '<div class="nf-grid">' + q.rows.map(function (r, ri) {
            return '<div class="nf-row" role="' + (multi ? "group" : "radiogroup") + '" aria-label="' + esc(r) + '"><b>' + esc(r) + '</b><div class="vs-opts vs-chips" data-qg="' + q.id + '" data-row="' + ri + '">' +
              q.cols.map(function (c) { var on = multi ? (Array.isArray(g[ri]) && g[ri].indexOf(c) >= 0) : g[ri] === c; return '<label class="vs-opt"><input type="' + (multi ? "checkbox" : "radio") + '" name="' + n + "r" + ri + '" value="' + esc(c) + '"' + (on ? " checked" : "") + "><span>" + esc(c) + "</span></label>"; }).join("") + "</div></div>";
          }).join("") + "</div></div>";
        case "photo":
          // Up to 10 photos, like the Google Form. Each can be taken out again.
          return '<div class="vs-field nf-photo">' + lab + (photos.length ? '<div class="nf-pics">' + photos.map(function (ph, i) { return '<div class="nf-pic"><img src="' + ph + '" alt="Photo ' + (i + 1) + '"><button type="button" data-pr="' + i + '">Remove</button></div>'; }).join("") + "</div>" : "") +
            (photos.length < MAXP ? '<label class="vs-btn ghost" style="text-align:center;margin-top:8px">' + (photos.length ? "Add another photo" : "Take or choose photos") +
            '<input type="file" accept="image/*" multiple data-qp="' + q.id + '" hidden></label>' : '<small>That is the most photos one item can have (' + MAXP + ').</small>') + "</div>";
      }
      return "";
    }
    function draw() {
      if (D.unsupported && D.url) {
        root.innerHTML = '<div class="vs"><h3 class="vs-h">' + esc(D.title) + '</h3><p class="vs-note">This form has a question the app cannot show yet.</p><a class="vs-btn" href="' + esc(D.url) + '" target="_blank" rel="noopener">Open the form</a></div>';
        return;
      }
      var p = path(D, A, true);
      root.innerHTML = '<form class="vs" novalidate>' + (opts.hideTitle || !(opts.title || D.title) ? "" : '<h3 class="vs-h">' + esc(opts.title || D.title) + "</h3>") + (D.help ? '<p class="vs-note">' + rich(D.help) + "</p>" : "") + (opts.keep ? '<div class="nf-q" aria-live="polite"></div>' : "") + (opts.keep && LAST && !A[qid(/^item description$/i)] ? '<button type="button" class="nf-same" data-same>Same as last item' + (LAST[qid(/^item description$/i)] ? ": " + esc(LAST[qid(/^item description$/i)]) : "") + "</button>" : "") + (kept ? '<p class="vs-note"><b>Kept from your last item:</b> the pickup, who sorted, the location and the event. Change any that are different for this one.</p>' : "") +
        '<input class="vs-hp" type="text" name="website" tabindex="-1" autocomplete="off" aria-hidden="true">' +
        p.map(function (si) {
          var s = D.sections[si];
          return '<fieldset class="nf-sec">' + (s.title ? "<legend>" + esc(s.title) + "</legend>" : "") + (s.help ? '<p class="vs-note">' + rich(s.help) + "</p>" : "") + s.items.map(field).join("") + "</fieldset>";
        }).join("") +
        '<p class="vs-err" role="alert" aria-live="assertive"></p><button type="submit" class="vs-btn">Send</button></form>';
      var form = root.querySelector("form");
      form.addEventListener("input", read);
      form.addEventListener("change", function (e) {
        read();
        var t = e.target;
        if (t.dataset && t.dataset.ev) { EV = t.value; return; }
        var lb = t.closest && t.closest("[data-ql]");
        if (lb) { root.querySelector('[data-q="' + lb.dataset.ql + '"]').value = t.value; read(); return; }
        if (t.dataset && t.dataset.q && D.past && t.dataset.q === qid(/^item description$/i)) {
          var hit = D.past.filter(function (x) { return x[0].toLowerCase() === t.value.trim().toLowerCase(); })[0];
          if (hit) {
            setT(/^category$/i, hit[1]); setT(/^subcategory$/i, hit[2]); setT(/^unit$/i, hit[3]);
            // Redraw after the field lets go of focus, or the browser trips over the box being replaced.
            setTimeout(function () { redraw(); var qn = root.querySelector('[data-q="' + qid(/^quantity$/i) + '"]'); if (qn) qn.focus(); }, 0);
            return;
          }
        }
        if (t.dataset && t.dataset.pk) {
          var inp = root.querySelector('[data-q="' + t.dataset.pk + '"]');
          pkOther = t.value === "__other"; inp.value = pkOther ? "" : t.value; inp.hidden = !pkOther; read();
          if (pkOther) inp.focus();
          return;
        }
        if (t.dataset && t.dataset.q && t.dataset.q === catId()) {
          // A new category: clear a subcategory from another category, and show only this one's.
          D.sections.forEach(function (s) { s.items.forEach(function (q) { if (/subcategory/i.test(q.title) && A[q.id] && String(A[q.id]).indexOf(t.value + " ") !== 0) A[q.id] = ""; }); });
          redraw(); return;
        }
        if (t.dataset && t.dataset.qp && t.files && t.files.length) {
          var fl = Array.prototype.slice.call(t.files, 0, MAXP - photos.length);
          fl.reduce(function (pr, f) { return pr.then(function () { return shrink(f).then(function (d) { photos.push(d); }); }); }, Promise.resolve())
            .then(redraw, function (err) { redraw(); form = root.querySelector("form"); form.querySelector(".vs-err").textContent = err.message; });
          return;
        }
        // A choice can change which sections come next, and "Other" shows its box.
        var box = t.closest && t.closest("[data-qr],[data-qc]");
        if (box) { var o = root.querySelector('[data-qo="' + (box.dataset.qr || box.dataset.qc) + '"]'); if (o) { var on = !!box.querySelector('input[value="Other"]:checked'); o.hidden = !on; if (on && t.value === "Other") o.focus(); } }
        if (t.type === "radio" || t.tagName === "SELECT") { if (path(D, A, true).join() !== p.join()) redraw(); }
      });
      form.addEventListener("submit", submit);
      form.addEventListener("click", function (e) {
        var b = e.target.closest && e.target.closest("[data-pr],[data-same],[data-qf]"); if (!b) return;
        if (b.dataset.pr != null) { photos.splice(+b.dataset.pr, 1); redraw(); return; }
        if (b.dataset.same != null) {
          // Same as last item: everything but the count, the expiry date, notes and photos.
          Object.keys(LAST || {}).forEach(function (k) { A[k] = LAST[k]; });
          [/^quantity$/i, /^items per unit$/i, /expiry/i, /^notes$/i].forEach(function (re) { var k = qid(re); if (k) delete A[k]; });
          photos = []; redraw();
          var qn = root.querySelector('[data-q="' + qid(/^quantity$/i) + '"]'); if (qn) qn.focus();
          return;
        }
        // A failed item goes back into the form to fix and send again.
        var j = qFail.splice(+b.dataset.qf, 1)[0]; if (!j) return;
        A = j.A; photos = j.photos; EV = j.ev; draw(); qShow(); root.scrollIntoView({ block: "start" });
      });
      qShow();
    }
    function redraw() { var y = window.scrollY; draw(); window.scrollTo(0, y); }
    function read() {
      root.querySelectorAll("[data-q]").forEach(function (el) { A[el.dataset.q] = el.value; });
      root.querySelectorAll("[data-qr]").forEach(function (box) {
        var c = box.querySelector("input:checked"), qid = box.dataset.qr, o = root.querySelector('[data-qo="' + qid + '"]');
        A[qid] = c ? (c.value === "Other" && o ? o.value.trim() : c.value) : "";
      });
      root.querySelectorAll("[data-qc]").forEach(function (box) {
        var qid = box.dataset.qc, o = root.querySelector('[data-qo="' + qid + '"]');
        A[qid] = [].map.call(box.querySelectorAll("input:checked"), function (x) { return x.value === "Other" && o ? o.value.trim() : x.value; }).filter(Boolean);
      });
      var grids = {};
      root.querySelectorAll("[data-qg]").forEach(function (box) {
        var qid = box.dataset.qg, ri = +box.dataset.row, on = [].map.call(box.querySelectorAll("input:checked"), function (x) { return x.value; });
        grids[qid] = grids[qid] || []; grids[qid][ri] = box.querySelector('input[type="checkbox"]') ? on : (on[0] || "");
      });
      Object.keys(grids).forEach(function (k) { A[k] = grids[k]; });
    }
    function empty(v) { return v == null || v === "" || (Array.isArray(v) && !v.some(function (x) { return Array.isArray(x) ? x.length : x; })); }
    /* Sort an item (forms with opts.keep): Send does not wait. The item goes into a line that sends one at a time in the
       background while the next item is logged; network problems are retried, and an item the server turns down can be
       put back in the form to fix. Leaving the page while items are still sending asks first. (20 Nov 2026) */
    function evObj(e) { return e ? { date: e.split("|")[0], name: e.split("|").slice(1).join("|") } : null; }
    function queueSend(send) {
      Q.push({ send: send, photos: photos.slice(), ev: EV, A: JSON.parse(JSON.stringify(A)), tries: 0, name: A[qid(/^item description$/i)] || "Item" });
      keepSave();
      A = {}; photos = []; pkOther = false; prefill(); draw();
      root.scrollIntoView({ block: "start" });
      qRun();
    }
    function qRun() {
      qShow();
      if (qBusy || !Q.length) return;
      qBusy = true;
      var j = Q[0];
      opts.send(j.send, j.photos, "", evObj(j.ev)).then(function (r) {
        Q.shift(); qBusy = false; qDone++;
        if (opts.onDone) opts.onDone(r);
        qRun();
      }, function (e) {
        qBusy = false;
        var m = String((e && e.message) || ""), theirs = /^(Answer|Add|Check|That|Lots of|The photo|Pick|Tell)/.test(m);
        if (!theirs && j.tries < 5) { j.tries++; qShow(); setTimeout(qRun, 3000 * j.tries); return; }
        Q.shift(); j.err = theirs ? m : "It didn't send. Check your signal."; qFail.push(j); qRun();
      });
    }
    function qShow() {
      var box = root.querySelector(".nf-q"); if (!box) return;
      var h = "";
      if (Q.length) h += "<b>Sending " + Q.length + (Q.length === 1 ? " item" : " items") + "...</b> Keep logging. Keep this page open until it says saved." + (Q[0].tries ? " (Weak signal, trying again.)" : "");
      else if (qDone && !qFail.length) h += "<b>All saved.</b> " + qDone + (qDone === 1 ? " item" : " items") + " logged.";
      qFail.forEach(function (j, i) { h += '<p><b>' + esc(j.name) + "</b> did not save: " + esc(j.err) + ' <button type="button" data-qf="' + i + '">Put it back in the form</button></p>'; });
      box.innerHTML = h;
    }
    window.addEventListener("beforeunload", function (e) { if (Q.length) { e.preventDefault(); e.returnValue = ""; } });
    function submit(ev) {
      ev.preventDefault();
      if (sending) return;
      read();
      var form = root.querySelector("form"), err = form.querySelector(".vs-err"), miss = null;
      path(D, A).forEach(function (si) { D.sections[si].items.forEach(function (q) {
        if (miss || !q.req || q.type === "note") return;
        if (q.type === "photo" ? !photos.length : empty(A[q.id])) miss = q;
      }); });
      if (miss) {
        err.textContent = miss.type === "photo" ? "Add a photo." : 'Answer "' + miss.title + '".';
        var el = root.querySelector('[data-pk="' + miss.id + '"],[data-q="' + miss.id + '"],[data-qr="' + miss.id + '"] input,[data-qc="' + miss.id + '"] input,[data-qg="' + miss.id + '"] input,[data-qp="' + miss.id + '"]');
        if (el) { (el.type === "file" ? el.parentNode : el).scrollIntoView({ behavior: "smooth", block: "center" }); try { el.focus({ preventScroll: true }); } catch (e) {} }
        return;
      }
      // Only the questions on the path go to the form.
      var send = {}; path(D, A).forEach(function (si) { D.sections[si].items.forEach(function (q) { if (!empty(A[q.id])) send[q.id] = A[q.id]; }); });
      if (opts.keep) return queueSend(send);
      err.textContent = ""; sending = true;
      var b = form.querySelector('button[type="submit"]'); b.disabled = true; b.textContent = "Sending...";
      var ev = EV ? { date: EV.split("|")[0], name: EV.split("|").slice(1).join("|") } : null;
      opts.send(send, photos, form.elements.website.value, ev).then(function (r) {
        keepSave();
        sending = false;
        root.innerHTML = '<div class="vs vs-done"><h3 class="vs-h" tabindex="-1">Thank you.</h3><p>' + rich((r && r.done) || "It was sent.") + '</p><button type="button" class="vs-btn ghost" data-nf-again>Send another</button></div>';
        root.querySelector("[data-nf-again]").onclick = function () { A = {}; photos = []; pkOther = false; prefill(); draw(); };
        var h = root.querySelector(".vs-h"); if (h) { h.focus(); h.scrollIntoView({ block: "start" }); }
        if (opts.onDone) opts.onDone(r);
      }, function (e) {
        sending = false; b.disabled = false; b.textContent = "Send";
        var m = String((e && e.message) || "");
        err.textContent = /^(Answer|Add|Check|That|Lots of|The photo|Pick|Tell|Team roles|We already)/.test(m) ? m : "That didn't send. Check your connection and try again. Your answers are still here.";
      });
    }
  }
  // Google Form id -> the short name the server knows it by. A link to one of these forms opens the app's own screen.
  var IDS = { "17XLjoQmw3SyPAfC3RamPLLaviX0YSaq7W3wK7IvtB1o": "needs", "14_aPnbLVI1894VDPiEzVpDVJoOAWoY4Rl2gdf_0tTdU": "story", "1iiz6ir2zw8bhG-74VOKR7H2Ohla6DgJtGnj7l5P0gNU": "give",
    "1jjuyrnhoRJo1SK195Lb1WWfDmFu7OcwkPlrWQg0-p7c": "sort", "1iDblSHbgcCh3e_K5ILSX_gYO6GrqC7JLIkQNBp3zC-A": "pickup", "1h3gmmUdbuscp3Wh5sANZ3WikWuPzBGE1Ol9hntWVNjc": "pastvol" };
  var nameOf = function (url) { var m = String(url || "").match(/forms\/d\/([\w-]{20,})/); return m ? IDS[m[1]] || "" : ""; };
  var PUBLIC = { needs: 1, story: 1, give: 1 };
  window.ReUpForms = { mount: mount, nameOf: nameOf, isPublic: function (n) { return !!PUBLIC[n]; }, path: path };
})();
