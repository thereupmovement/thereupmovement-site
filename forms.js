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
    ".nf-other{margin-top:6px}.nf-photo img{display:block;max-width:100%;max-height:260px;border-radius:12px;margin-top:8px}" +
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
    if (/zip/.test(t)) return ' type="text" inputmode="numeric" autocomplete="postal-code"';
    if (/^(your )?(first and last )?name$|^your name/.test(t)) return ' type="text" autocomplete="name"';
    if (/address/.test(t)) return ' type="text" autocomplete="street-address"';
    return ' type="text"';
  }

  /* opts: load() -> Promise(def), send(answers, photo, website) -> Promise({done}), team (bool), onDone(). */
  function mount(root, opts) {
    var id = "nf" + (++uid), D = null, A = {}, photo = "", sending = false;
    root.innerHTML = '<div class="vs"><p class="vs-lead">Loading...</p></div>';
    opts.load().then(function (d) { D = d; prefill(); draw(); }, function () {
      root.innerHTML = '<div class="vs"><p class="vs-lead">This form could not load right now. Check your connection and try again.</p>' +
        '<div class="vs-row"><button type="button" class="vs-btn" data-nf-retry>Try again</button>' +
        (opts.fallback ? '<a class="vs-btn ghost" href="' + esc(opts.fallback) + '" target="_blank" rel="noopener">Open the Google Form instead</a>' : "") + "</div></div>";
      root.querySelector("[data-nf-retry]").onclick = function () { mount(root, opts); };
    });
    function prefill() {
      if (!opts.team || !D.me) return;
      D.sections.forEach(function (s) { s.items.forEach(function (q) { if (q.type === "text" && /sorted by|logged by|your name|who (drove|sorted|is filling)|driver/i.test(q.title) && !A[q.id]) A[q.id] = D.me; }); });
    }
    function field(q) {
      var n = id + q.id, req = q.req ? "" : ' <span class="nf-req">(optional)</span>';
      var lab = "<span>" + esc(q.title) + req + "</span>" + (q.help ? "<small>" + rich(q.help) + "</small>" : "");
      var v = A[q.id], opt = function (type, val, on) { return '<label class="vs-opt"><input type="' + type + '" name="' + n + '" value="' + esc(val) + '"' + (on ? " checked" : "") + "><span>" + esc(val) + "</span></label>"; };
      switch (q.type) {
        case "note": return '<p class="nf-note"><b>' + esc(q.title) + "</b>" + (q.help ? "<br>" + rich(q.help) : "") + "</p>";
        case "text":
          var list = /pickup id/i.test(q.title) && D.pickups && D.pickups.length ? ' list="' + n + 'l"' : "";
          return '<label class="vs-field">' + lab + "<input" + kind(q.title) + ' data-q="' + q.id + '" maxlength="500" value="' + esc(v || "") + '"' + list + ">" +
            (list ? '<datalist id="' + n + 'l">' + D.pickups.map(function (p) { return '<option value="' + esc(p) + '">'; }).join("") + "</datalist>" : "") + "</label>";
        case "para": return '<label class="vs-field">' + lab + '<textarea rows="4" maxlength="5000" data-q="' + q.id + '">' + esc(v || "") + "</textarea></label>";
        case "date": return '<label class="vs-field">' + lab + '<input type="date" data-q="' + q.id + '" value="' + esc(v || "") + '"></label>';
        case "time": return '<label class="vs-field">' + lab + '<input type="time" data-q="' + q.id + '" value="' + esc(v || "") + '"></label>';
        case "list":
          if (q.choices.length <= 6) return '<div class="vs-field" role="radiogroup" aria-label="' + esc(q.title) + '">' + lab + '<div class="vs-opts" data-qr="' + q.id + '">' + q.choices.map(function (c) { return opt("radio", c.v, v === c.v); }).join("") + "</div></div>";
          return '<label class="vs-field">' + lab + '<select class="nf-sel" data-q="' + q.id + '"><option value="">Pick one</option>' + q.choices.map(function (c) { return '<option' + (v === c.v ? " selected" : "") + ">" + esc(c.v) + "</option>"; }).join("") + "</select></label>";
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
          return '<div class="vs-field nf-photo">' + lab + '<label class="vs-btn ghost" style="text-align:center">' + (photo ? "Take a different photo" : "Take or choose a photo") +
            '<input type="file" accept="image/*" capture="environment" data-qp="' + q.id + '" hidden></label>' + (photo ? '<img src="' + photo + '" alt="The photo you picked">' : "") + "</div>";
      }
      return "";
    }
    function draw() {
      if (D.unsupported && D.url) {
        root.innerHTML = '<div class="vs"><h3 class="vs-h">' + esc(D.title) + '</h3><p class="vs-note">This form has a question the app cannot show yet.</p><a class="vs-btn" href="' + esc(D.url) + '" target="_blank" rel="noopener">Open the form</a></div>';
        return;
      }
      var p = path(D, A, true);
      root.innerHTML = '<form class="vs" novalidate>' + (opts.hideTitle ? "" : '<h3 class="vs-h">' + esc(D.title) + "</h3>") + (D.help ? '<p class="vs-note">' + rich(D.help) + "</p>" : "") +
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
        if (t.dataset && t.dataset.qp && t.files && t.files[0]) {
          shrink(t.files[0]).then(function (d) { photo = d; redraw(); }, function (err) { form.querySelector(".vs-err").textContent = err.message; });
          return;
        }
        // A choice can change which sections come next, and "Other" shows its box.
        var box = t.closest && t.closest("[data-qr],[data-qc]");
        if (box) { var o = root.querySelector('[data-qo="' + (box.dataset.qr || box.dataset.qc) + '"]'); if (o) { var on = !!box.querySelector('input[value="Other"]:checked'); o.hidden = !on; if (on && t.value === "Other") o.focus(); } }
        if (t.type === "radio" || t.tagName === "SELECT") { if (path(D, A, true).join() !== p.join()) redraw(); }
      });
      form.addEventListener("submit", submit);
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
    function submit(ev) {
      ev.preventDefault();
      if (sending) return;
      read();
      var form = root.querySelector("form"), err = form.querySelector(".vs-err"), miss = null;
      path(D, A).forEach(function (si) { D.sections[si].items.forEach(function (q) {
        if (miss || !q.req || q.type === "note") return;
        if (q.type === "photo" ? !photo : empty(A[q.id])) miss = q;
      }); });
      if (miss) {
        err.textContent = miss.type === "photo" ? "Add a photo." : 'Answer "' + miss.title + '".';
        var el = root.querySelector('[data-q="' + miss.id + '"],[data-qr="' + miss.id + '"] input,[data-qc="' + miss.id + '"] input,[data-qg="' + miss.id + '"] input,[data-qp="' + miss.id + '"]');
        if (el) { (el.type === "file" ? el.parentNode : el).scrollIntoView({ behavior: "smooth", block: "center" }); try { el.focus({ preventScroll: true }); } catch (e) {} }
        return;
      }
      // Only the questions on the path go to the form.
      var send = {}; path(D, A).forEach(function (si) { D.sections[si].items.forEach(function (q) { if (!empty(A[q.id])) send[q.id] = A[q.id]; }); });
      err.textContent = ""; sending = true;
      var b = form.querySelector('button[type="submit"]'); b.disabled = true; b.textContent = "Sending...";
      opts.send(send, photo, form.elements.website.value).then(function (r) {
        sending = false;
        root.innerHTML = '<div class="vs vs-done"><h3 class="vs-h" tabindex="-1">Thank you.</h3><p>' + rich((r && r.done) || "It was sent.") + '</p><button type="button" class="vs-btn ghost" data-nf-again>Send another</button></div>';
        root.querySelector("[data-nf-again]").onclick = function () { A = {}; photo = ""; prefill(); draw(); };
        var h = root.querySelector(".vs-h"); if (h) { h.focus(); h.scrollIntoView({ block: "start" }); }
        if (opts.onDone) opts.onDone(r);
      }, function (e) {
        sending = false; b.disabled = false; b.textContent = "Send";
        var m = String((e && e.message) || "");
        err.textContent = /^(Answer|Add|Check|That|Lots of|The photo)/.test(m) ? m : "That didn't send. Check your connection and try again. Your answers are still here.";
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
