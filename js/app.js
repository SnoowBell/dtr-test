(function () {
  var KEY = "",
    SKEY = "",
    $ = function (i) {
      return document.getElementById(i);
    };
  var recs = [],
    open = null;
  var branchDelIdx = -1;
  var admRecDel = { branchId: "", index: -1 };
  function load() {
    try {
      var r = localStorage.getItem(KEY);
      if (r) {
        var d = JSON.parse(r);
        recs = d.recs || [];
        open = d.open || null;
      }
    } catch (e) {}
  }
  function save() {
    if (!KEY) return;
    try {
      localStorage.setItem(KEY, JSON.stringify({ recs: recs, open: open }));
      note();
    } catch (e) {}
  }
  // Auto-save is always on: every change is written to storage right away
  function auto() {
    save();
  }
  function note() {
    var e = $("saveNote");
    if (!e) return;
    var n = new Date();
    e.textContent = "Saved " + p(n.getHours()) + ":" + p(n.getMinutes());
  }
  function p(n) {
    return String(n).padStart(2, "0");
  }
  function iso(d) {
    return d.getFullYear() + "-" + p(d.getMonth() + 1) + "-" + p(d.getDate());
  }
  function hm(d) {
    return p(d.getHours()) + ":" + p(d.getMinutes());
  }
  function mins(a, b, br) {
    var x = a.split(":"),
      y = b.split(":"),
      m = +y[0] * 60 + +y[1] - (+x[0] * 60 + +x[1]);
    if (m < 0) m += 1440;
    return Math.max(0, m - (+br || 0));
  }
  function fmt(m) {
    return Math.floor(m / 60) + "h " + p(Math.round(m % 60)) + "m";
  }
  var sel = null;
  function cutoff() {
    var n = new Date();
    return cof(
      sel ? sel.y : n.getFullYear(),
      sel ? sel.m : n.getMonth(),
      sel ? sel.h : n.getDate() <= 15 ? 1 : 2,
    );
  }
  function cof(y, m, h) {
    var n = new Date();
    var last = new Date(y, m + 1, 0).getDate(),
      mo =
        new Date(y, m, 1).toLocaleDateString(undefined, {
          month: "long",
        }) + (y !== n.getFullYear() ? " " + y : "");
    return h === 1
      ? {
          a: iso(new Date(y, m, 1)),
          b: iso(new Date(y, m, 15)),
          t: mo + " 1–15",
          y: y,
          m: m,
          h: 1,
        }
      : {
          a: iso(new Date(y, m, 16)),
          b: iso(new Date(y, m, last)),
          t: mo + " 16–" + last,
          y: y,
          m: m,
          h: 2,
        };
  }

  function buildSel(id, st, includeAll) {
    var useSel =
        id === "recCo"
          ? recSel
          : id === "gvSel"
            ? gvSel
            : id === "coSel"
              ? sel
              : st,
      s = $(id || "coSel"),
      n = new Date(),
      y = n.getFullYear(),
      m = n.getMonth(),
      h = n.getDate() <= 15 ? 1 : 2;
    if (!s) return;
    s.innerHTML = "";
    function add(v, t) {
      var o = document.createElement("option");
      o.value = v;
      o.textContent = t;
      s.appendChild(o);
    }
    if (includeAll) {
      add("all", "All Cut-offs");
    }
    add("auto", cof(y, m, h).t);

    // Step back for the loop to avoid duplicate entries
    var hy = y,
      hm = m,
      hh = h;
    if (hh === 2) {
      hh = 1;
    } else {
      hh = 2;
      hm--;
      if (hm < 0) {
        hm = 11;
        hy--;
      }
    }

    for (var i = 0; i < 23; i++) {
      add(hy + "-" + hm + "-" + hh, cof(hy, hm, hh).t);
      if (hh === 2) {
        hh = 1;
      } else {
        hh = 2;
        hm--;
        if (hm < 0) {
          hm = 11;
          hy--;
        }
      }
    }
    if (includeAll && useSel === "all") {
      s.value = "all";
    } else if (!includeAll && useSel === null && id === "recCo") {
      s.value = "auto";
    } else {
      s.value =
        useSel && typeof useSel === "object"
          ? useSel.y + "-" + useSel.m + "-" + useSel.h
          : includeAll && useSel === "all"
            ? "all"
            : "auto";
    }
  }

  function render() {
    if (branch && branch.role === "admin") {
      renderAdmin();
      return;
    }
    buildSel("recCo", recSel, true);
    var coVal = $("recCo").value;
    if (coVal === "all") recSel = "all";
    else if (coVal === "auto") recSel = null;
    else {
      var a = coVal.split("-");
      recSel = { y: +a[0], m: +a[1], h: +a[2] };
    }

    var tb = $("rows");
    tb.innerHTML = "";
    var c =
      recSel === "all"
        ? null
        : recSel
          ? cof(recSel.y, recSel.m, recSel.h)
          : cof(
              new Date().getFullYear(),
              new Date().getMonth(),
              new Date().getDate() <= 15 ? 1 : 2,
            );
    var filteredRecs = recs
      .slice()
      .map(function (r, origIdx) {
        return { r: r, idx: origIdx };
      })
      .filter(function (item) {
        return recSel === "all" || (item.r.date >= c.a && item.r.date <= c.b);
      })
      .sort(function (a, b) {
        return a.r.date < b.r.date ? 1 : -1;
      });

    filteredRecs.forEach(function (item) {
      var r = item.r;
      var tr = document.createElement("tr");
      [r.date, r.shift, r.staff || "Unknown", r.tin, r.note || "—"].forEach(
        function (v) {
          var td = document.createElement("td");
          td.textContent = v;
          tr.appendChild(td);
        },
      );
      var a = document.createElement("td");
      a.className = "t";
      var b = document.createElement("button");
      b.className = "btn del";
      b.textContent = "Delete";
      b.onclick = function () {
        branchDelIdx = branchDelIdx === item.idx ? -1 : item.idx;
        render();
      };
      a.appendChild(b);
      tr.appendChild(a);
      tb.appendChild(tr);

      if (branchDelIdx === item.idx) {
        var trPanel = document.createElement("tr");
        var tdPanel = document.createElement("td");
        tdPanel.colSpan = 6;
        tdPanel.style.padding = "0 8px 14px";
        var panel = document.createElement("div");
        panel.className = "panel";
        panel.style.margin = "0";
        var msg = document.createElement("div");
        msg.style.marginBottom = "12px";
        msg.textContent = "Delete this daily record? This cannot be undone.";
        panel.appendChild(msg);
        var btnsDiv = document.createElement("div");
        btnsDiv.className = "btns";
        var yesBtn = mkBtn(
          "Yes, delete",
          function () {
            recs = recs.filter(function (x, i) {
              return i !== item.idx;
            });
            branchDelIdx = -1;
            auto();
            render();
          },
          "9px 16px",
        );
        yesBtn.style.color = "var(--bad)";
        btnsDiv.appendChild(yesBtn);
        btnsDiv.appendChild(
          mkBtn(
            "Cancel",
            function () {
              branchDelIdx = -1;
              render();
            },
            "9px 16px",
          ),
        );
        panel.appendChild(btnsDiv);
        tdPanel.appendChild(panel);
        trPanel.appendChild(tdPanel);
        tb.appendChild(trPanel);
      }
    });
    $("none").style.display = filteredRecs.length ? "none" : "block";
    var curCut = cutoff(),
      cur = recs.filter(function (r) {
        return r.date >= curCut.a && r.date <= curCut.b;
      }),
      by = {};
    cur.forEach(function (r) {
      var k = r.staff || "Unknown";
      by[k] = (by[k] || 0) + 1;
    });
    var names = Object.keys(by).sort(function (x, y) {
      return by[y] - by[x] || x.localeCompare(y);
    });
    buildSel();
    $("coTot").textContent = cur.length + " Shifts";
    renderGrid();
    var sl = $("staffList");
    sl.innerHTML = "";
    if (!names.length) {
      var e = document.createElement("div");
      e.className = "empty";
      e.textContent = "No time ins yet for this cut-off.";
      sl.appendChild(e);
    }
    names.forEach(function (n) {
      var d = document.createElement("div");
      d.className = "stat";
      var a = document.createElement("span");
      a.textContent = "🖥 " + n;
      var b = document.createElement("span");
      b.textContent = by[n] + " Shifts";
      d.appendChild(a);
      d.appendChild(b);
      sl.appendChild(d);
    });
    var lr = recs[recs.length - 1];
    $("status").textContent = lr
      ? "Last: " + (lr.staff || "Unknown") + " at " + lr.tin
      : "Ready";
    $("status").className = "tag";
  }
  var curDay;

  function tick() {
    var n = new Date();
    var k = iso(n);
    if (k !== curDay) {
      curDay = k;
      render();
    }
    $("clk").textContent =
      p(n.getHours()) + ":" + p(n.getMinutes()) + ":" + p(n.getSeconds());
    var s = n.toLocaleDateString(undefined, {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
    });
    $("dt").textContent = s;
    $("todayLbl").textContent = (branch ? branch.name + " · " : "") + s;
  }

  $("bIn").onclick = function () {
    var s = $("staff").value.trim();
    if (!s) {
      $("staff").focus();
      return;
    }
    var n = new Date();
    addRec({
      date: iso(n),
      shift: $("shift").value,
      staff: s,
      tin: hm(n),
    });
    $("staff").value = "";
    auto();
    render();
  };
  // 24-hour time picker for Manual entry (clock button + editable HH:MM, no AM/PM)
  function normTime(v) {
    v = String(v).trim();
    var h, m;
    if (v.indexOf(":") > -1) {
      var a = v.split(":");
      h = parseInt(a[0], 10);
      m = parseInt(a[1] === "" ? "0" : a[1], 10);
    } else {
      var d = v.replace(/[^0-9]/g, "");
      if (!d) return null;
      if (d.length <= 2) {
        h = parseInt(d, 10);
        m = 0;
      } else {
        h = parseInt(d.slice(0, d.length - 2), 10);
        m = parseInt(d.slice(-2), 10);
      }
    }
    if (isNaN(h) || isNaN(m) || h < 0 || h > 23 || m < 0 || m > 59) return null;
    return p(h) + ":" + p(m);
  }
  var tpLast = "08:00";
  function tpBuild() {
    [
      ["tpH", 24],
      ["tpM", 60],
    ].forEach(function (c) {
      var col = $(c[0]);
      col.innerHTML = "";
      for (var i = 0; i < c[1]; i++) {
        var b = document.createElement("button");
        b.type = "button";
        b.textContent = p(i);
        b.dataset.v = i;
        col.appendChild(b);
      }
    });
  }
  function tpSync(scroll) {
    var t = normTime($("mIn").value) || tpLast,
      hh = t.slice(0, 2),
      mm = t.slice(3);
    [
      ["tpH", hh],
      ["tpM", mm],
    ].forEach(function (c) {
      var col = $(c[0]);
      Array.prototype.forEach.call(col.children, function (b) {
        var on = b.textContent === c[1];
        b.classList.toggle("on", on);
        if (on && scroll)
          col.scrollTop =
            b.offsetTop - col.clientHeight / 2 + b.offsetHeight / 2;
      });
    });
  }
  function tpOpen(o) {
    $("tpPop").hidden = !o;
    $("tpBtn").setAttribute("aria-expanded", String(o));
    if (o) tpSync(true);
  }
  function tpCommit() {
    var n = normTime($("mIn").value);
    if (n) {
      $("mIn").value = n;
      tpLast = n;
    } else {
      $("mIn").value = tpLast;
    }
    tpSync(false);
  }
  tpBuild();
  $("tpBtn").onclick = function (e) {
    e.preventDefault();
    tpOpen($("tpPop").hidden);
  };
  $("tpH").onclick = function (e) {
    var b = e.target.closest("button");
    if (!b) return;
    var t = normTime($("mIn").value) || tpLast;
    $("mIn").value = p(b.dataset.v) + ":" + t.slice(3);
    tpCommit();
  };
  $("tpM").onclick = function (e) {
    var b = e.target.closest("button");
    if (!b) return;
    var t = normTime($("mIn").value) || tpLast;
    $("mIn").value = t.slice(0, 2) + ":" + p(b.dataset.v);
    tpCommit();
    tpOpen(false);
  };
  // Segment editing like a native time field: click/tab selects the hour or minute,
  // typing overwrites it, arrows step it, left/right/tab/colon move between segments
  var tpSeg = 0,
    tpBuf = "";
  function tpMark(seg) {
    try {
      $("mIn").setSelectionRange(seg * 3, seg * 3 + 2);
    } catch (e) {}
  }
  function tpSel(seg) {
    tpSeg = seg;
    tpBuf = "";
    tpMark(seg);
  }
  function tpGet() {
    var t = normTime($("mIn").value) || tpLast;
    return [+t.slice(0, 2), +t.slice(3)];
  }
  function tpSet(h, m) {
    var v = p(h) + ":" + p(m);
    $("mIn").value = v;
    tpLast = v;
    if (!$("tpPop").hidden) tpSync(true);
  }
  function tpStep(d) {
    var t = tpGet();
    if (tpSeg === 0) t[0] = (t[0] + d + 24) % 24;
    else t[1] = (t[1] + d + 60) % 60;
    tpSet(t[0], t[1]);
    tpMark(tpSeg);
  }
  function tpDigit(dg) {
    var t = tpGet(),
      max = tpSeg === 0 ? 23 : 59,
      lead = tpSeg === 0 ? 2 : 5,
      v,
      done;
    tpBuf += dg;
    if (tpBuf.length >= 2) {
      v = Math.min(max, parseInt(tpBuf.slice(-2), 10));
      done = true;
    } else {
      v = +dg;
      done = v > lead;
    }
    if (tpSeg === 0) t[0] = v;
    else t[1] = v;
    tpSet(t[0], t[1]);
    if (done) tpSel(1);
    else tpMark(tpSeg);
  }
  $("mIn").addEventListener("beforeinput", function (e) {
    var t = e.inputType || "";
    if (t === "insertText" && /^[0-9]$/.test(e.data || "")) {
      e.preventDefault();
      tpDigit(e.data);
    } else if (t === "insertText" && e.data === ":") {
      e.preventDefault();
      tpSel(1);
    } else if (t.indexOf("delete") === 0) {
      e.preventDefault();
      var h = tpGet();
      if (tpSeg === 0) h[0] = 0;
      else h[1] = 0;
      tpSet(h[0], h[1]);
      tpSel(tpSeg);
    } else {
      e.preventDefault();
    }
  });
  $("mIn").addEventListener("paste", function (e) {
    e.preventDefault();
    var n = normTime(
      (e.clipboardData && e.clipboardData.getData("text")) || "",
    );
    if (n) {
      tpSet(+n.slice(0, 2), +n.slice(3));
      tpSel(tpSeg);
    }
  });
  $("mIn").onfocus = function () {
    setTimeout(function () {
      if (document.activeElement === $("mIn")) tpSel(0);
    }, 0);
  };
  $("mIn").onclick = function () {
    tpSel(this.selectionStart >= 3 ? 1 : 0);
  };
  $("mIn").onblur = tpCommit;
  $("mIn").onkeydown = function (e) {
    if (e.key === "Enter") {
      e.preventDefault();
      tpCommit();
      tpOpen(false);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      tpStep(1);
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      tpStep(-1);
    } else if (e.key === "ArrowLeft") {
      e.preventDefault();
      tpSel(0);
    } else if (e.key === "ArrowRight") {
      e.preventDefault();
      tpSel(1);
    } else if (e.key === "Tab") {
      if (!e.shiftKey && tpSeg === 0) {
        e.preventDefault();
        tpSel(1);
      } else if (e.shiftKey && tpSeg === 1) {
        e.preventDefault();
        tpSel(0);
      }
    }
  };
  document.addEventListener("click", function (e) {
    if (!$("tpPop").hidden && !e.target.closest(".tpick")) tpOpen(false);
  });
  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape") tpOpen(false);
  });

  $("mAdd").onclick = function () {
    var d = $("mDate").value,
      s = $("mStaff").value.trim();
    if (!d) {
      $("mDate").focus();
      return;
    }
    if (!s) {
      $("mStaff").focus();
      return;
    }
    var tv = normTime($("mIn").value);
    if (!tv) {
      $("mIn").focus();
      return;
    }
    addRec({
      date: d,
      shift: $("mShift").options[$("mShift").selectedIndex].value,
      staff: s,
      tin: tv,
      note: $("mNote").value.trim(),
    });
    $("mStaff").value = "";
    $("mNote").value = "";
    auto();
    render();
  };
  var staff = [];
  var staffEditIdx = -1;
  var staffDelIdx = -1;
  var admStaffEdit = { branchId: "", index: -1 };
  var admStaffDel = { branchId: "", index: -1 };

  function loadStaff() {
    try {
      var r = localStorage.getItem(SKEY);
      if (r) staff = JSON.parse(r) || [];
    } catch (e) {}
  }
  function saveStaff() {
    if (!SKEY) return;
    try {
      localStorage.setItem(SKEY, JSON.stringify(staff));
      note();
    } catch (e) {}
  }

  function renderStaff() {
    if (branch && branch.role === "admin") {
      renderStaffAdmin();
      return;
    }
    var l = $("sfList");
    l.innerHTML = "";
    $("sfCount").textContent = staff.length;
    if (!staff.length) {
      var e = document.createElement("div");
      e.className = "empty";
      e.textContent = "No staff registered yet.";
      l.appendChild(e);
    }
    staff.forEach(function (n, i) {
      var d = document.createElement("div");
      d.className = "srow";
      var s = document.createElement("span");
      s.textContent = n;
      var bt = document.createElement("div");
      bt.className = "btns";
      bt.appendChild(
        mkBtn("Edit", function () {
          staffEditIdx = staffEditIdx === i ? -1 : i;
          staffDelIdx = -1;
          renderStaff();
        }),
      );
      var delBtn = mkBtn("Delete", function () {
        staffDelIdx = staffDelIdx === i ? -1 : i;
        staffEditIdx = -1;
        renderStaff();
      });
      delBtn.style.color = "var(--bad)";
      bt.appendChild(delBtn);

      d.appendChild(s);
      d.appendChild(bt);
      l.appendChild(d);

      if (staffEditIdx === i) {
        var f = document.createElement("div");
        f.className = "panel";
        f.style.margin = "0 0 12px";
        f.innerHTML =
          '<label class="lbl" style="display:block">Staff name<input id="stN" type="text" autocomplete="off"></label><div id="stE" role="alert" style="color:var(--bad);min-height:20px;margin:8px 0 4px;font-size:13px"></div><div class="btns"></div>';
        f.querySelector("#stN").value = n;
        var fb = f.querySelector(".btns");
        var sv = mkBtn(
          "Save changes",
          function () {
            var nn = f.querySelector("#stN").value.trim();
            if (!nn) {
              f.querySelector("#stE").textContent = "Enter staff name.";
              return;
            }
            if (
              staff.some(function (x, idx) {
                return idx !== i && x.toLowerCase() === nn.toLowerCase();
              })
            ) {
              f.querySelector("#stE").textContent =
                "Staff name already exists.";
              return;
            }
            var oldName = staff[i];
            staff[i] = nn;
            recs.forEach(function (r) {
              if (r.staff === oldName) r.staff = nn;
            });
            saveStaff();
            save();
            staffEditIdx = -1;
            renderStaff();
            render();
          },
          "9px 16px",
        );
        sv.className = "btn pri";
        fb.appendChild(sv);
        fb.appendChild(
          mkBtn(
            "Cancel",
            function () {
              staffEditIdx = -1;
              renderStaff();
            },
            "9px 16px",
          ),
        );
        l.appendChild(f);
      }

      if (staffDelIdx === i) {
        var g = document.createElement("div");
        g.className = "panel";
        g.style.margin = "0 0 12px";
        var m = document.createElement("div");
        m.style.marginBottom = "12px";
        m.textContent = "Delete " + n + "?";
        g.appendChild(m);
        var gb = document.createElement("div");
        gb.className = "btns";
        var yes = mkBtn(
          "Yes, delete",
          function () {
            var removedName = staff[i];
            staff.splice(i, 1);
            recs = recs.filter(function (r) {
              return r.staff !== removedName;
            });
            saveStaff();
            save();
            staffDelIdx = -1;
            renderStaff();
            render();
          },
          "9px 16px",
        );
        yes.style.color = "var(--bad)";
        gb.appendChild(yes);
        gb.appendChild(
          mkBtn(
            "Cancel",
            function () {
              staffDelIdx = -1;
              renderStaff();
            },
            "9px 16px",
          ),
        );
        g.appendChild(gb);
        l.appendChild(g);
      }
    });
    ["staff", "mStaff"].forEach(function (id) {
      var s = $(id),
        cur = s.value;
      s.innerHTML = "";
      var ph = document.createElement("option");
      ph.value = "";
      ph.textContent = staff.length ? "Select staff" : "No staff yet";
      s.appendChild(ph);
      staff.forEach(function (n) {
        var o = document.createElement("option");
        o.value = n;
        o.textContent = n;
        s.appendChild(o);
      });
      s.value = staff.indexOf(cur) > -1 ? cur : "";
    });
  }

  function addStaff() {
    if (isAd()) {
      addStaffAd();
      return;
    }
    var inp = $("sfName"),
      v = inp.value.trim();
    if (!v) {
      inp.focus();
      return;
    }
    if (
      !staff.some(function (x) {
        return x.toLowerCase() === v.toLowerCase();
      })
    ) {
      staff.push(v);
      saveStaff();
      renderStaff();
    }
    inp.value = "";
    inp.focus();
  }
  $("sfAdd").onclick = addStaff;
  $("sfName").onkeydown = function (e) {
    if (e.key === "Enter") addStaff();
  };
  $("coSel").onchange = function () {
    var v = this.value;
    if (v === "auto") {
      sel = null;
    } else {
      var a = v.split("-");
      sel = { y: +a[0], m: +a[1], h: +a[2] };
    }
    render();
  };
  $("bSave").onclick = function () {
    save();
    var b = $("bSave");
    b.textContent = "Saved";
    setTimeout(function () {
      b.textContent = "Save Data";
    }, 1200);
  };
  $("bPrint").onclick = function () {
    window.print();
  };
  $("bClear").onclick = function () {
    if (recs.length && !confirm("Delete all records?")) return;
    recs = [];
    open = null;
    auto();
    render();
  };
  // Light mode is the default; Dark Mode is an option and the choice is remembered
  function applyTheme(t) {
    document.documentElement.setAttribute("data-theme", t);
    $("theme").classList.toggle("on", t === "dark");
    $("theme").setAttribute("aria-pressed", String(t === "dark"));
  }
  $("theme").onclick = function () {
    var t =
      document.documentElement.getAttribute("data-theme") === "light"
        ? "dark"
        : "light";
    applyTheme(t);
    try {
      localStorage.setItem("dtr-theme", t);
    } catch (e) {}
  };
  var savedTheme = "light";
  try {
    savedTheme =
      localStorage.getItem("dtr-theme") === "dark" ? "dark" : "light";
  } catch (e) {}
  applyTheme(savedTheme);

  var keys = ["clock", "log", "sum"];
  function go(v) {
    document.querySelectorAll("#nav button").forEach(function (b) {
      b.classList.toggle("on", b.dataset.v === v);
    });
    document.querySelectorAll(".view").forEach(function (s) {
      s.classList.toggle("on", s.id === "v-" + v);
    });
  }
  document.querySelectorAll("#nav button").forEach(function (b) {
    b.onclick = function () {
      go(b.dataset.v);
    };
  });
  document.addEventListener("keydown", function (e) {
    var i = ["F1", "F2", "F3"].indexOf(e.key);
    if (i > -1) {
      e.preventDefault();
      go(keys[i]);
    }
  });

  var branch = null;
  function getAccs() {
    try {
      return JSON.parse(localStorage.getItem("dtr-accounts")) || {};
    } catch (e) {
      return {};
    }
  }
  function putAccs(a) {
    try {
      localStorage.setItem("dtr-accounts", JSON.stringify(a));
    } catch (e) {}
  }
  function hex(b) {
    return Array.from(new Uint8Array(b))
      .map(function (x) {
        return x.toString(16).padStart(2, "0");
      })
      .join("");
  }
  function hash(pw, salt) {
    return crypto.subtle
      .digest("SHA-256", new TextEncoder().encode(salt + ":" + pw))
      .then(hex);
  }
  function authErr(t) {
    $("authErr").textContent = t;
  }

  function showAuth() {
    document.body.classList.remove("admin");
    gvSel = null;
    gvBr = "";
    admCo = "";
    admRec = "";
    recSel = "all";
    $("auth").hidden = false;
    authErr("");
    $("auName").focus();
  }

  function start(id, name) {
    var ac = getAccs()[id] || {},
      ad = ac.role === "admin";
    branch = { id: id, name: name, role: ad ? "admin" : "branch" };
    KEY = ad ? "" : "dtr-records:" + id;
    SKEY = ad ? "" : "dtr-staff:" + id;
    recs = [];
    open = null;
    staff = [];
    sel = null;
    document.body.classList.toggle("admin", ad);
    $("coTot").hidden = ad;
    $("coBr").hidden = !ad;
    if (!ad) {
      load();
      loadStaff();
    }
    renderStaff();
    render();
    $("auth").hidden = true;
    tick();
  }

  function login(id, name) {
    try {
      sessionStorage.setItem("dtr-session", id);
    } catch (e) {}
    $("auPw").value = "";
    start(id, name);
  }
  $("authGo").onclick = function () {
    var name = $("auName").value.trim(),
      pw = $("auPw").value,
      id = name.toLowerCase(),
      a = getAccs()[id];
    authErr("");
    if (!name || !pw) {
      authErr("Enter your account name and password.");
      return;
    }
    if (!a) {
      authErr("Incorrect account name or password.");
      return;
    }
    hash(pw, a.salt)
      .then(function (h) {
        if (h === a.hash) login(id, a.name);
        else authErr("Incorrect account name or password.");
      })
      .catch(function () {
        authErr("Sign-in is not available in this browser.");
      });
  };
  ["auName", "auPw"].forEach(function (i) {
    $(i).onkeydown = function (e) {
      if (e.key === "Enter") $("authGo").click();
    };
  });

  // Default admin account (user: admin / password: admin123), created once if no admin exists
  function ensureAdmin() {
    var a = getAccs();
    var has = Object.keys(a).some(function (k) {
      return a[k].role === "admin";
    });
    if (has || a["admin"]) return Promise.resolve();
    var salt = hex(crypto.getRandomValues(new Uint8Array(8)));
    return hash("admin123", salt).then(function (h) {
      var b = getAccs();
      b["admin"] = { name: "admin", salt: salt, hash: h, role: "admin" };
      putAccs(b);
    });
  }

  // Branch account registration (Admin only, Staff List > Accounts)
  function rgMsg(t, ok) {
    var e = $("rgErr");
    e.textContent = t;
    e.style.color = ok ? "var(--acc)" : "var(--bad)";
  }
  $("rgAdd").onclick = function () {
    if (!isAd()) return;
    var name = $("rgName").value.trim(),
      pw = $("rgPw").value,
      id = name.toLowerCase();
    rgMsg("");
    if (!name || !pw) {
      rgMsg("Enter an account name and password.");
      return;
    }
    if (pw.length < 6) {
      rgMsg("Password must be at least 6 characters.");
      return;
    }
    if (pw !== $("rgPw2").value) {
      rgMsg("Passwords do not match.");
      return;
    }
    if (getAccs()[id]) {
      rgMsg("That account name is already used.");
      return;
    }
    var salt = hex(crypto.getRandomValues(new Uint8Array(8)));
    hash(pw, salt)
      .then(function (h) {
        var a2 = getAccs();
        a2[id] = { name: name, salt: salt, hash: h, role: "branch" };
        putAccs(a2);
        $("rgName").value = "";
        $("rgPw").value = "";
        $("rgPw2").value = "";
        rgMsg('Account "' + name + '" registered.', true);
        renderStaff();
        render();
      })
      .catch(function () {
        rgMsg("Could not register the account in this browser.");
      });
  };
  ["rgName", "rgPw", "rgPw2"].forEach(function (i) {
    $(i).onkeydown = function (e) {
      if (e.key === "Enter") $("rgAdd").click();
    };
  });
  var admCo = "",
    admRec = "",
    admTgt = "",
    recSel = "all",
    acEdit = "",
    acDel = "";

  function moveKey(p, a, b) {
    try {
      var v = localStorage.getItem(p + a);
      if (v !== null) {
        localStorage.setItem(p + b, v);
        localStorage.removeItem(p + a);
      }
    } catch (e) {}
  }

  function mkBtn(txt, fn, pad) {
    var b = document.createElement("button");
    b.className = "btn";
    b.textContent = txt;
    b.style.padding = pad || "7px 14px";
    b.onclick = fn;
    return b;
  }

  function renderAccts() {
    var l = $("acList");
    if (!l) return;
    l.innerHTML = "";
    var a = getAccs(),
      ks = Object.keys(a).sort(function (x, y) {
        return a[x].name.localeCompare(a[y].name);
      });
    if (!ks.length) {
      var em = document.createElement("div");
      em.className = "empty";
      em.textContent = "No accounts yet.";
      l.appendChild(em);
    }
    ks.forEach(function (k) {
      var ac = a[k],
        ad = ac.role === "admin",
        row = document.createElement("div");
      row.className = "srow";
      row.style.flexWrap = "wrap";
      row.style.gap = "10px";
      var s = document.createElement("span");
      s.textContent = ac.name;
      var t = document.createElement("span");
      t.className = "tag" + (ad ? "" : " o");
      t.textContent = ad ? "Admin" : "Branch";
      t.style.marginLeft = "10px";
      s.appendChild(t);
      var bt = document.createElement("div");
      bt.className = "btns";
      bt.appendChild(
        mkBtn("Edit", function () {
          acEdit = acEdit === k ? "" : k;
          acDel = "";
          renderAccts();
        }),
      );
      if (!ad) {
        var d = mkBtn("Delete", function () {
          acDel = acDel === k ? "" : k;
          acEdit = "";
          renderAccts();
        });
        d.style.color = "var(--bad)";
        bt.appendChild(d);
      }
      row.appendChild(s);
      row.appendChild(bt);
      l.appendChild(row);
      if (acEdit === k) {
        var f = document.createElement("div");
        f.className = "panel";
        f.style.margin = "0 0 12px";
        f.innerHTML =
          '<label class="lbl" style="display:block">Account name<input id="acN" type="text" autocomplete="off"></label><label class="lbl" style="display:block;margin-top:12px">New password<input id="acP" type="password" autocomplete="new-password" placeholder="Leave blank to keep current"></label><div id="acE" role="alert" style="color:var(--bad);min-height:20px;margin:8px 0 4px;font-size:13px"></div><div class="btns"></div>';
        f.querySelector("#acN").value = ac.name;
        var fb = f.querySelector(".btns");
        var sv = mkBtn(
          "Save changes",
          function () {
            saveAcct(k);
          },
          "9px 16px",
        );
        sv.className = "btn pri";
        fb.appendChild(sv);
        fb.appendChild(
          mkBtn(
            "Cancel",
            function () {
              acEdit = "";
              renderAccts();
            },
            "9px 16px",
          ),
        );
        l.appendChild(f);
      }
      if (acDel === k) {
        var g = document.createElement("div");
        g.className = "panel";
        g.style.margin = "0 0 12px";
        var m = document.createElement("div");
        m.style.marginBottom = "12px";
        m.textContent =
          "Delete " +
          ac.name +
          " and all of its records and staff list? This cannot be undone.";
        g.appendChild(m);
        var gb = document.createElement("div");
        gb.className = "btns";
        var yes = mkBtn(
          "Yes, delete",
          function () {
            delAcct(k);
          },
          "9px 16px",
        );
        yes.style.color = "var(--bad)";
        gb.appendChild(yes);
        gb.appendChild(
          mkBtn(
            "Cancel",
            function () {
              acDel = "";
              renderAccts();
            },
            "9px 16px",
          ),
        );
        g.appendChild(gb);
        l.appendChild(g);
      }
    });
  }

  // Attendance Visual Grid (own area below Manual entry, with its own cut-off and branch selectors)
  var gvSel = null,
    gvBr = "";
  function gvCut() {
    var n = new Date();
    return cof(
      gvSel ? gvSel.y : n.getFullYear(),
      gvSel ? gvSel.m : n.getMonth(),
      gvSel ? gvSel.h : n.getDate() <= 15 ? 1 : 2,
    );
  }
  function renderGrid() {
    var w = $("vgWrap");
    if (!w) return;
    w.innerHTML = "";
    if (!branch) return;
    var ad = isAd(),
      c = gvCut(),
      sb = $("gvBr"),
      staffList,
      recList;
    buildSel("gvSel", gvSel);
    sb.hidden = !ad;
    if (ad) {
      var bs = branches().reverse(); // Latest created branch at the top
      sb.innerHTML = "";
      bs.forEach(function (b) {
        var o = document.createElement("option");
        o.value = b.id;
        o.textContent = b.name;
        sb.appendChild(o);
      });
      if (
        !bs.some(function (b) {
          return b.id === gvBr;
        })
      )
        gvBr = bs.length ? bs[0].id : "";
      sb.value = gvBr;
      $("vgStatus").textContent = statusText(gvBr ? latestTimeIn(gvBr) : null);
      if (!gvBr) {
        var e0 = document.createElement("div");
        e0.className = "empty";
        e0.textContent = "No branch accounts yet.";
        w.appendChild(e0);
        return;
      }
      var bd = bData(gvBr);
      staffList = bd.staff;
      recList = bd.recs;
    } else {
      staffList = staff;
      recList = recs;
    }
    var cols = [],
      seen = {},
      cnt = {},
      sh = {};
    function addCol(k) {
      if (!seen[k]) {
        seen[k] = 1;
        cols.push(k);
      }
    }
    staffList.forEach(addCol);
    recList.forEach(function (r) {
      if (r.date < c.a || r.date > c.b) return;
      var k = r.staff || "Unknown";
      addCol(k);
      cnt[k] = cnt[k] || {};
      sh[k] = sh[k] || {};
      cnt[k][r.date] = (cnt[k][r.date] || 0) + 1;
      (sh[k][r.date] = sh[k][r.date] || []).push(r.shift);
    });
    if (!cols.length) {
      var e = document.createElement("div");
      e.className = "empty";
      e.textContent = "No staff to display.";
      w.appendChild(e);
      return;
    }
    // Horizontal layout: one row per staff, one column per date of the cut-off
    var t0 = iso(new Date()),
      dates = [],
      dd = new Date(+c.a.slice(0, 4), +c.a.slice(5, 7) - 1, +c.a.slice(8));
    while (iso(dd) <= c.b) {
      dates.push({ ds: iso(dd), day: dd.getDate() });
      dd.setDate(dd.getDate() + 1);
    }
    var tbl = document.createElement("table");
    tbl.className = "vg";
    var hr = document.createElement("tr");
    var th0 = document.createElement("th");
    th0.textContent = "Name";
    hr.appendChild(th0);
    dates.forEach(function (x) {
      var th = document.createElement("th");
      th.textContent = x.day;
      if (x.ds === t0) th.className = "today";
      hr.appendChild(th);
    });
    var hd = document.createElement("thead");
    hd.appendChild(hr);
    tbl.appendChild(hd);
    var tb = document.createElement("tbody");
    cols.forEach(function (k) {
      var tr = document.createElement("tr"),
        nm = document.createElement("td");
      nm.className = "nm";
      nm.textContent = k;
      tr.appendChild(nm);
      dates.forEach(function (x) {
        var td = document.createElement("td"),
          n = (cnt[k] && cnt[k][x.ds]) || 0;
        if (x.ds === t0) td.className = "today";
        if (n) {
          td.textContent = "I".repeat(n);
          td.title = sh[k][x.ds].join(", ");
        }
        tr.appendChild(td);
      });
      tb.appendChild(tr);
    });
    tbl.appendChild(tb);
    w.appendChild(tbl);
  }

  function delAcct(k) {
    var a = getAccs();
    delete a[k];
    putAccs(a);
    try {
      localStorage.removeItem("dtr-records:" + k);
      localStorage.removeItem("dtr-staff:" + k);
    } catch (e) {}
    acDel = "";
    acEdit = "";
    renderStaff();
    render();
  }

  function saveAcct(k) {
    var a = getAccs(),
      ac = a[k],
      nm = $("acN").value.trim(),
      pw = $("acP").value,
      id = nm.toLowerCase(),
      err = function (t) {
        $("acE").textContent = t;
      };
    if (!nm) {
      err("Enter an account name.");
      return;
    }
    if (id !== k && a[id]) {
      err("That account name is already used.");
      return;
    }
    if (pw && pw.length < 6) {
      err("Password must be at least 6 characters.");
      return;
    }
    var fin = function () {
      if (id !== k) {
        delete a[k];
        moveKey("dtr-records:", k, id);
        moveKey("dtr-staff:", k, id);
        try {
          if (sessionStorage.getItem("dtr-session") === k)
            sessionStorage.setItem("dtr-session", id);
        } catch (e) {}
        if (branch && branch.id === k) branch.id = id;
        if (admTgt === k) admTgt = id;
        if (admCo === k) admCo = id;
        if (admRec === k) admRec = id;
      }
      ac.name = nm;
      a[id] = ac;
      putAccs(a);
      if (branch && branch.id === id) branch.name = nm;
      acEdit = "";
      renderStaff();
      render();
    };
    if (pw) {
      var salt = hex(crypto.getRandomValues(new Uint8Array(8)));
      hash(pw, salt)
        .then(function (h) {
          ac.salt = salt;
          ac.hash = h;
          fin();
        })
        .catch(function () {
          err("Could not update the password.");
        });
    } else {
      fin();
    }
  }

  function isAd() {
    return !!branch && branch.role === "admin";
  }

  function setStaff(id, arr) {
    try {
      localStorage.setItem("dtr-staff:" + id, JSON.stringify(arr));
    } catch (e) {}
  }

  // Latest Time In submitted across all branches (uses the submit time when known)
  function statusText(lt) {
    return lt
      ? (lt.r.staff || "Unknown") +
          " \u00b7 " +
          lt.b +
          " \u00b7 " +
          lt.r.shift +
          " \u00b7 " +
          new Date(lt.r.date + "T00:00").toLocaleDateString(undefined, {
            month: "short",
            day: "numeric",
          }) +
          ", " +
          lt.r.tin
      : "No time ins yet";
  }
  function latestTimeIn(only) {
    var best = null,
      bk = -1;
    branches().forEach(function (b) {
      if (only && only !== b.id) return;
      bData(b.id).recs.forEach(function (r) {
        var k = r.ts || Date.parse(r.date + "T" + (r.tin || "00:00")) || 0;
        if (k >= bk) {
          bk = k;
          best = { r: r, b: b.name };
        }
      });
    });
    return best;
  }
  function addRec(r) {
    r.ts = Date.now();
    if (isAd()) {
      if (!admTgt) return;
      var d = bData(admTgt);
      d.recs.push(r);
      try {
        localStorage.setItem(
          "dtr-records:" + admTgt,
          JSON.stringify({ recs: d.recs, open: null }),
        );
      } catch (e) {}
    } else {
      recs.push(r);
    }
  }

  function addStaffAd() {
    var inp = $("sfName"),
      v = inp.value.trim();
    if (!v || !admTgt) {
      inp.focus();
      return;
    }
    var l = bData(admTgt).staff;
    if (
      !l.some(function (x) {
        return x.toLowerCase() === v.toLowerCase();
      })
    ) {
      l.push(v);
      setStaff(admTgt, l);
    }
    inp.value = "";
    renderStaff();
    render();
    inp.focus();
  }

  function fillTgt() {
    var bs = branches().reverse(); // Latest created branch at the top
    ["tBr", "mBr", "sfBr"].forEach(function (id) {
      var s = $(id);
      s.innerHTML = "";
      bs.forEach(function (b) {
        var o = document.createElement("option");
        o.value = b.id;
        o.textContent = b.name;
        s.appendChild(o);
      });
    });
    if (
      !bs.some(function (b) {
        return b.id === admTgt;
      })
    )
      admTgt = bs.length ? bs[0].id : "";
    ["tBr", "mBr", "sfBr"].forEach(function (id) {
      $(id).value = admTgt;
    });
    $("status").textContent = statusText(latestTimeIn());
    $("status").className = "tag";
    var list = admTgt ? bData(admTgt).staff : [];
    ["staff", "mStaff"].forEach(function (id) {
      var s = $(id),
        cur = s.value;
      s.innerHTML = "";
      var ph = document.createElement("option");
      ph.value = "";
      ph.textContent = list.length ? "Select staff" : "No staff yet";
      s.appendChild(ph);
      list.forEach(function (n) {
        var o = document.createElement("option");
        o.value = n;
        o.textContent = n;
        s.appendChild(o);
      });
      s.value = list.indexOf(cur) > -1 ? cur : "";
    });
  }

  function bData(id) {
    var o = { recs: [], staff: [] };
    try {
      var r = localStorage.getItem("dtr-records:" + id);
      if (r) o.recs = JSON.parse(r).recs || [];
      var s = localStorage.getItem("dtr-staff:" + id);
      if (s) o.staff = JSON.parse(s) || [];
    } catch (e) {}
    return o;
  }

  function branches() {
    var a = getAccs();
    return Object.keys(a)
      .filter(function (k) {
        return a[k].role !== "admin";
      })
      .map(function (k) {
        return { id: k, name: a[k].name };
      });
  }

  function allItems(f) {
    var out = [];
    branches().forEach(function (b) {
      if (f && f !== b.id) return;
      bData(b.id).recs.forEach(function (r, index) {
        out.push({ r: r, b: b.name, branchId: b.id, index: index });
      });
    });
    return out;
  }

  function fillBr(id, val) {
    var s = $(id),
      bs = branches().reverse(), // Latest created branch at the top, without "All Branches"
      ids = [];
    s.innerHTML = "";
    function add(v, t) {
      var o = document.createElement("option");
      o.value = v;
      o.textContent = t;
      s.appendChild(o);
    }
    bs.forEach(function (b) {
      add(b.id, b.name);
      ids.push(b.id);
    });
    s.value = ids.indexOf(val) > -1 ? val : ids.length ? ids[0] : "";
  }

  function renderStaffAdmin() {
    var l = $("sfList");
    l.innerHTML = "";
    var t = 0,
      bs = branches();
    bs.forEach(function (b) {
      var d = bData(b.id);
      t += d.staff.length;
      var h = document.createElement("div");
      h.className = "lbl";
      h.style.cssText = "margin:14px 0 4px;color:var(--acc)";
      h.textContent = b.name + " (" + d.staff.length + ")";
      l.appendChild(h);
      if (!d.staff.length) {
        var e = document.createElement("div");
        e.className = "empty";
        e.style.padding = "10px 0";
        e.textContent = "No staff registered.";
        l.appendChild(e);
      }
      d.staff.forEach(function (n, idx) {
        var r = document.createElement("div");
        r.className = "srow";
        var s = document.createElement("span");
        s.textContent = n;
        var bt = document.createElement("div");
        bt.className = "btns";
        bt.appendChild(
          mkBtn("Edit", function () {
            if (admStaffEdit.branchId === b.id && admStaffEdit.index === idx) {
              admStaffEdit = { branchId: "", index: -1 };
            } else {
              admStaffEdit = { branchId: b.id, index: idx };
            }
            admStaffDel = { branchId: "", index: -1 };
            renderStaff();
          }),
        );
        var delBtn = mkBtn("Delete", function () {
          if (admStaffDel.branchId === b.id && admStaffDel.index === idx) {
            admStaffDel = { branchId: "", index: -1 };
          } else {
            admStaffDel = { branchId: b.id, index: idx };
          }
          admStaffEdit = { branchId: "", index: -1 };
          renderStaff();
        });
        delBtn.style.color = "var(--bad)";
        bt.appendChild(delBtn);

        r.appendChild(s);
        r.appendChild(bt);
        l.appendChild(r);

        if (admStaffEdit.branchId === b.id && admStaffEdit.index === idx) {
          var f = document.createElement("div");
          f.className = "panel";
          f.style.margin = "0 0 12px";
          f.innerHTML =
            '<label class="lbl" style="display:block">Staff name<input id="astN" type="text" autocomplete="off"></label><div id="astE" role="alert" style="color:var(--bad);min-height:20px;margin:8px 0 4px;font-size:13px"></div><div class="btns"></div>';
          f.querySelector("#astN").value = n;
          var fb = f.querySelector(".btns");
          var sv = mkBtn(
            "Save changes",
            function () {
              var nn = f.querySelector("#astN").value.trim();
              if (!nn) {
                f.querySelector("#astE").textContent = "Enter staff name.";
                return;
              }
              if (
                d.staff.some(function (x, i) {
                  return i !== idx && x.toLowerCase() === nn.toLowerCase();
                })
              ) {
                f.querySelector("#astE").textContent =
                  "Staff name already exists.";
                return;
              }
              var oldName = d.staff[idx];
              d.staff[idx] = nn;
              setStaff(b.id, d.staff);

              var recData = bData(b.id);
              recData.recs.forEach(function (rc) {
                if (rc.staff === oldName) rc.staff = nn;
              });
              try {
                localStorage.setItem(
                  "dtr-records:" + b.id,
                  JSON.stringify({ recs: recData.recs, open: null }),
                );
              } catch (e) {}

              admStaffEdit = { branchId: "", index: -1 };
              renderStaff();
              render();
            },
            "9px 16px",
          );
          sv.className = "btn pri";
          fb.appendChild(sv);
          fb.appendChild(
            mkBtn(
              "Cancel",
              function () {
                admStaffEdit = { branchId: "", index: -1 };
                renderStaff();
              },
              "9px 16px",
            ),
          );
          l.appendChild(f);
        }

        if (admStaffDel.branchId === b.id && admStaffDel.index === idx) {
          var g = document.createElement("div");
          g.className = "panel";
          g.style.margin = "0 0 12px";
          var m = document.createElement("div");
          m.style.marginBottom = "12px";
          m.textContent = "Delete " + n + " from " + b.name + "?";
          g.appendChild(m);
          var gb = document.createElement("div");
          gb.className = "btns";
          var yes = mkBtn(
            "Yes, delete",
            function () {
              var removedName = d.staff[idx];
              var newStaffList = d.staff.filter(function (z, i) {
                return i !== idx;
              });
              setStaff(b.id, newStaffList);

              var recData = bData(b.id);
              var newRecs = recData.recs.filter(function (rc) {
                return rc.staff !== removedName;
              });
              try {
                localStorage.setItem(
                  "dtr-records:" + b.id,
                  JSON.stringify({ recs: newRecs, open: null }),
                );
              } catch (e) {}

              admStaffDel = { branchId: "", index: -1 };
              renderStaff();
              render();
            },
            "9px 16px",
          );
          yes.style.color = "var(--bad)";
          gb.appendChild(yes);
          gb.appendChild(
            mkBtn(
              "Cancel",
              function () {
                admStaffDel = { branchId: "", index: -1 };
                renderStaff();
              },
              "9px 16px",
            ),
          );
          g.appendChild(gb);
          l.appendChild(g);
        }
      });
    });
    if (!bs.length) {
      var e2 = document.createElement("div");
      e2.className = "empty";
      e2.textContent = "No branch accounts yet.";
      l.appendChild(e2);
    }
    $("sfCount").textContent = t;
    renderAccts();
  }

  function renderAdmin() {
    fillTgt();
    fillBr("coBr", admCo);
    admCo = $("coBr").value;
    fillBr("recBr", admRec);
    admRec = $("recBr").value;
    buildSel("recCo", recSel, true);
    var coVal = $("recCo").value;
    if (coVal === "all") recSel = "all";
    else if (coVal === "auto") recSel = null;
    else {
      var a = coVal.split("-");
      recSel = { y: +a[0], m: +a[1], h: +a[2] };
    }

    var tb = $("rows");
    tb.innerHTML = "";
    var c =
      recSel === "all"
        ? null
        : recSel
          ? cof(recSel.y, recSel.m, recSel.h)
          : cof(
              new Date().getFullYear(),
              new Date().getMonth(),
              new Date().getDate() <= 15 ? 1 : 2,
            );
    var items = allItems(admRec)
      .filter(function (i) {
        return recSel === "all" || (i.r.date >= c.a && i.r.date <= c.b);
      })
      .sort(function (a, b) {
        return a.r.date < b.r.date
          ? 1
          : a.r.date > b.r.date
            ? -1
            : (b.r.tin || "").localeCompare(a.r.tin || "");
      });
    items.forEach(function (it) {
      var r = it.r,
        tr = document.createElement("tr");
      [
        it.b,
        r.date,
        r.shift,
        r.staff || "Unknown",
        r.tin,
        r.note || "\u2014",
      ].forEach(function (v) {
        var td = document.createElement("td");
        td.textContent = v;
        tr.appendChild(td);
      });
      var actTd = document.createElement("td");
      actTd.className = "t";
      var delBtn = document.createElement("button");
      delBtn.className = "btn del";
      delBtn.textContent = "Delete";
      delBtn.onclick = function () {
        if (
          admRecDel.branchId === it.branchId &&
          admRecDel.index === it.index
        ) {
          admRecDel = { branchId: "", index: -1 };
        } else {
          admRecDel = { branchId: it.branchId, index: it.index };
        }
        renderAdmin();
      };
      actTd.appendChild(delBtn);
      tr.appendChild(actTd);
      tb.appendChild(tr);

      if (admRecDel.branchId === it.branchId && admRecDel.index === it.index) {
        var trPanel = document.createElement("tr");
        var tdPanel = document.createElement("td");
        tdPanel.colSpan = 7;
        tdPanel.style.padding = "0 8px 14px";
        var panel = document.createElement("div");
        panel.className = "panel";
        panel.style.margin = "0";
        var msg = document.createElement("div");
        msg.style.marginBottom = "12px";
        msg.textContent = "Delete this daily record? This cannot be undone.";
        panel.appendChild(msg);
        var btnsDiv = document.createElement("div");
        btnsDiv.className = "btns";
        var yesBtn = mkBtn(
          "Yes, delete",
          function () {
            var bd = bData(it.branchId);
            bd.recs.splice(it.index, 1);
            try {
              localStorage.setItem(
                "dtr-records:" + it.branchId,
                JSON.stringify({ recs: bd.recs, open: null }),
              );
            } catch (e) {}
            admRecDel = { branchId: "", index: -1 };
            renderAdmin();
          },
          "9px 16px",
        );
        yesBtn.style.color = "var(--bad)";
        btnsDiv.appendChild(yesBtn);
        btnsDiv.appendChild(
          mkBtn(
            "Cancel",
            function () {
              admRecDel = { branchId: "", index: -1 };
              renderAdmin();
            },
            "9px 16px",
          ),
        );
        panel.appendChild(btnsDiv);
        tdPanel.appendChild(panel);
        trPanel.appendChild(tdPanel);
        tb.appendChild(trPanel);
      }
    });
    $("none").style.display = items.length ? "none" : "block";
    var curCut = cutoff(),
      cur = allItems(admCo).filter(function (i) {
        return i.r.date >= curCut.a && i.r.date <= curCut.b;
      }),
      by = {};
    cur.forEach(function (i) {
      var k = i.r.staff || "Unknown";
      by[k] = (by[k] || 0) + 1;
    });
    var names = Object.keys(by).sort(function (x, y) {
      return by[y] - by[x] || x.localeCompare(y);
    });
    buildSel();
    var sl = $("staffList");
    sl.innerHTML = "";
    if (!names.length) {
      var e = document.createElement("div");
      e.className = "empty";
      e.textContent = "No time ins yet for this cut-off.";
      sl.appendChild(e);
    }
    names.forEach(function (n) {
      var d = document.createElement("div");
      d.className = "stat";
      var a = document.createElement("span");
      a.textContent = "\ud83d\udda5 " + n;
      var b = document.createElement("span");
      b.textContent = by[n] + " Shifts";
      d.appendChild(a);
      d.appendChild(b);
      sl.appendChild(d);
    });
    renderGrid();
  }
  ["tBr", "mBr", "sfBr"].forEach(function (id) {
    $(id).onchange = function () {
      admTgt = this.value;
      renderStaff();
      render();
    };
  });
  $("gvSel").onchange = function () {
    var v = this.value;
    if (v === "auto") gvSel = null;
    else {
      var a = v.split("-");
      gvSel = { y: +a[0], m: +a[1], h: +a[2] };
    }
    renderGrid();
  };
  $("gvBr").onchange = function () {
    gvBr = this.value;
    renderGrid();
  };
  $("coBr").onchange = function () {
    admCo = this.value;
    render();
  };
  $("recBr").onchange = function () {
    admRec = this.value;
    render();
  };
  $("recCo").onchange = function () {
    var v = this.value;
    if (v === "all") recSel = "all";
    else if (v === "auto") recSel = null;
    else {
      var a = v.split("-");
      recSel = { y: +a[0], m: +a[1], h: +a[2] };
    }
    render();
  };
  $("bOut2").onclick = function () {
    try {
      sessionStorage.removeItem("dtr-session");
    } catch (e) {}
    branch = null;
    KEY = "";
    SKEY = "";
    recs = [];
    open = null;
    staff = [];
    sel = null;
    $("auPw").value = "";
    renderStaff();
    render();
    showAuth();
  };
  $("mDate").value = iso(new Date());
  tick();
  setInterval(tick, 1000);
  var ss = null;
  try {
    ss = sessionStorage.getItem("dtr-session");
  } catch (e) {}
  // Dropdowns that always open downward (a native select opens upward near the bottom of the window)
  var ddOpen = null;
  function ddClose() {
    if (!ddOpen) return;
    ddOpen.classList.remove("open");
    ddOpen.querySelector(".dd-menu").hidden = true;
    ddOpen.querySelector(".dd-btn").setAttribute("aria-expanded", "false");
    ddOpen = null;
  }
  document.addEventListener("click", function (e) {
    if (ddOpen && !e.target.closest(".dd")) ddClose();
  });
  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape") ddClose();
  });
  function enhance(sel) {
    var wrap = document.createElement("div");
    wrap.className =
      "dd" + (sel.classList.contains("adm-only") ? " adm-only" : "");
    wrap.hidden = sel.hidden;
    var btn = document.createElement("button");
    btn.type = "button";
    btn.className = "dd-btn";
    btn.setAttribute("aria-haspopup", "listbox");
    btn.setAttribute("aria-expanded", "false");
    if (sel.getAttribute("aria-label"))
      btn.setAttribute("aria-label", sel.getAttribute("aria-label"));
    var lbl = document.createElement("span");
    btn.appendChild(lbl);
    btn.insertAdjacentHTML(
      "beforeend",
      '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m6 9 6 6 6-6"/></svg>',
    );
    var menu = document.createElement("div");
    menu.className = "dd-menu";
    menu.setAttribute("role", "listbox");
    menu.hidden = true;
    sel.parentNode.insertBefore(wrap, sel);
    wrap.appendChild(btn);
    wrap.appendChild(menu);
    wrap.appendChild(sel);
    sel.classList.add("dd-src");
    function pick(v) {
      sel.value = v;
      ddClose();
      sel.dispatchEvent(new Event("change", { bubbles: true }));
      btn.focus();
    }
    function refresh() {
      var o = sel.options[sel.selectedIndex];
      lbl.textContent = o ? o.text : "";
      menu.innerHTML = "";
      Array.prototype.forEach.call(sel.options, function (op, i) {
        var b = document.createElement("button"),
          on = i === sel.selectedIndex;
        b.type = "button";
        b.setAttribute("role", "option");
        b.setAttribute("aria-selected", String(on));
        b.className = on ? "on" : "";
        b.textContent = op.text;
        b.onclick = function () {
          pick(op.value);
        };
        menu.appendChild(b);
      });
    }
    var desc = Object.getOwnPropertyDescriptor(
      HTMLSelectElement.prototype,
      "value",
    );
    Object.defineProperty(sel, "value", {
      configurable: true,
      get: function () {
        return desc.get.call(sel);
      },
      set: function (v) {
        desc.set.call(sel, v);
        refresh();
      },
    });
    new MutationObserver(function () {
      wrap.hidden = sel.hidden;
      refresh();
    }).observe(sel, {
      childList: true,
      attributes: true,
      attributeFilter: ["hidden"],
    });
    btn.onclick = function () {
      var willOpen = !wrap.classList.contains("open");
      ddClose();
      if (!willOpen) return;
      wrap.classList.add("open");
      menu.hidden = false;
      btn.setAttribute("aria-expanded", "true");
      ddOpen = wrap;
      var on = menu.querySelector(".on");
      if (on) menu.scrollTop = on.offsetTop - 6;
      if (menu.scrollIntoView) menu.scrollIntoView({ block: "nearest" });
    };
    wrap.addEventListener("keydown", function (e) {
      if (e.key !== "ArrowDown" && e.key !== "ArrowUp") return;
      e.preventDefault();
      if (!wrap.classList.contains("open")) btn.click();
      var items = Array.prototype.slice.call(menu.children),
        cur = items.indexOf(document.activeElement),
        n;
      if (cur < 0) {
        var s = menu.querySelector(".on");
        n = s ? items.indexOf(s) : 0;
      } else {
        n =
          e.key === "ArrowDown"
            ? Math.min(items.length - 1, cur + 1)
            : Math.max(0, cur - 1);
      }
      if (items[n]) items[n].focus();
    });
    refresh();
  }
  Array.prototype.forEach.call(
    document.querySelectorAll("select.cosel"),
    enhance,
  );

  // Keep the Admin view current when a branch saves in another tab
  function refreshFromStorage() {
    if (!branch) return;
    if (!isAd()) {
      load();
      loadStaff();
    }
    renderStaff();
    render();
  }
  window.addEventListener("storage", refreshFromStorage);
  // Changes made on another device (cloud sync)
  window.addEventListener("dtr-remote", refreshFromStorage);
  (window.DTRCloud ? window.DTRCloud.ready : Promise.resolve())
    .catch(function () {})
    .then(ensureAdmin)
    .catch(function () {})
    .then(function () {
      var accs0 = getAccs();
      if (ss && accs0[ss]) start(ss, accs0[ss].name);
      else showAuth();
    });
})();
