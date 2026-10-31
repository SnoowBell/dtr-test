/*
 * Cloud sync for DTR Shift Recorder.
 *
 * The app reads/writes localStorage synchronously. This layer keeps that
 * working and mirrors every "dtr-*" key to a Supabase table (dtr_kv), so all
 * browsers and devices share the same data:
 *   - on load: pull the cloud copy into localStorage (before the app starts)
 *   - on change: push the key to the cloud (queued + retried if offline)
 *   - realtime: other devices' changes arrive live and the UI refreshes
 * If Supabase is not configured, everything stays local (old behaviour).
 */
(function () {
  var cfg = window.DTR_CONFIG || {};
  var TABLE = "dtr_kv";
  var PENDING_KEY = "dtr-sync-pending";
  var INIT_KEY = "dtr-sync-init";
  var enabled =
    !!window.supabase &&
    /^https?:\/\//.test(cfg.SUPABASE_URL || "") &&
    !!cfg.SUPABASE_ANON_KEY &&
    cfg.SUPABASE_ANON_KEY.indexOf("YOUR_") !== 0;

  var nat = {
    get: Storage.prototype.getItem,
    set: Storage.prototype.setItem,
    remove: Storage.prototype.removeItem,
  };
  var applying = false;

  function synced(k) {
    return (
      typeof k === "string" &&
      k.indexOf("dtr-") === 0 &&
      k !== "dtr-theme" &&
      k !== "dtr-session" &&
      k.indexOf("dtr-sync") !== 0
    );
  }
  function status(state, text) {
    var el = document.getElementById("syncNote");
    if (el) {
      el.textContent = text;
      el.setAttribute("data-state", state);
    }
  }
  function getPending() {
    try {
      return JSON.parse(nat.get.call(localStorage, PENDING_KEY)) || {};
    } catch (e) {
      return {};
    }
  }
  function setPending(p) {
    try {
      nat.set.call(localStorage, PENDING_KEY, JSON.stringify(p));
    } catch (e) {}
  }
  function applyRemote(key, value) {
    applying = true;
    try {
      if (value === null) nat.remove.call(localStorage, key);
      else nat.set.call(localStorage, key, value);
    } finally {
      applying = false;
    }
  }

  var client = null;
  var flushing = false;
  var flushTimer = null;

  function queue(key, value) {
    var p = getPending();
    p[key] = value; // string = upsert, null = delete
    setPending(p);
    clearTimeout(flushTimer);
    flushTimer = setTimeout(flush, 250);
  }

  function flush() {
    if (!client || flushing) return;
    var p = getPending();
    var keys = Object.keys(p);
    if (!keys.length) {
      status("online", "Synced");
      return;
    }
    flushing = true;
    status("busy", "Saving…");
    var chain = Promise.resolve();
    keys.forEach(function (k) {
      chain = chain.then(function () {
        var v = p[k];
        var req =
          v === null
            ? client.from(TABLE).delete().eq("key", k)
            : client
                .from(TABLE)
                .upsert(
                  { key: k, value: v, updated_at: new Date().toISOString() },
                  { onConflict: "key" },
                );
        return req.then(function (r) {
          if (r.error) throw r.error;
          var cur = getPending();
          // only clear if it wasn't changed again while we were sending
          if (cur[k] === v) {
            delete cur[k];
            setPending(cur);
          }
        });
      });
    });
    chain
      .then(function () {
        flushing = false;
        var left = Object.keys(getPending()).length;
        if (left) setTimeout(flush, 100);
        else status("online", "Synced");
      })
      .catch(function () {
        flushing = false;
        status("offline", "Offline");
        setTimeout(flush, 8000); // retry
      });
  }

  function pull() {
    return client
      .from(TABLE)
      .select("key,value")
      .then(function (r) {
        if (r.error) throw r.error;
        var pending = getPending();
        var cloud = {};
        r.data.forEach(function (row) {
          cloud[row.key] = row.value;
        });
        var firstSync = nat.get.call(localStorage, INIT_KEY) !== "1";
        // cloud -> local
        Object.keys(cloud).forEach(function (k) {
          if (!synced(k) || k in pending) return;
          if (nat.get.call(localStorage, k) !== cloud[k])
            applyRemote(k, cloud[k]);
        });
        // local-only keys
        var inserts = [];
        for (var i = localStorage.length - 1; i >= 0; i--) {
          var k = localStorage.key(i);
          if (!synced(k) || k in cloud || k in pending) continue;
          if (firstSync) {
            // first time on this browser: upload what only exists here
            inserts.push({
              key: k,
              value: nat.get.call(localStorage, k),
              updated_at: new Date().toISOString(),
            });
          } else {
            applyRemote(k, null); // deleted from the cloud by another device
          }
        }
        var done = Promise.resolve();
        if (inserts.length)
          done = client
            .from(TABLE)
            .upsert(inserts, { onConflict: "key", ignoreDuplicates: true })
            .then(function (x) {
              if (x.error) throw x.error;
            });
        return done.then(function () {
          nat.set.call(localStorage, INIT_KEY, "1");
        });
      });
  }

  function subscribe() {
    client
      .channel("dtr-kv-sync")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: TABLE },
        function (pl) {
          var pending = getPending();
          if (pl.eventType === "DELETE") {
            var dk = pl.old && pl.old.key;
            if (!synced(dk) || dk in pending) return;
            applyRemote(dk, null);
          } else {
            var row = pl.new;
            if (!row || !synced(row.key) || row.key in pending) return;
            if (nat.get.call(localStorage, row.key) === row.value) return;
            applyRemote(row.key, row.value);
          }
          window.dispatchEvent(new CustomEvent("dtr-remote"));
        },
      )
      .subscribe();
  }

  var api = { enabled: enabled, ready: Promise.resolve() };
  window.DTRCloud = api;

  if (!enabled) {
    status("local", "Local only");
    return;
  }

  client = window.supabase.createClient(
    cfg.SUPABASE_URL,
    cfg.SUPABASE_ANON_KEY,
    {
      auth: { persistSession: false },
    },
  );

  // Mirror writes made by the app
  Storage.prototype.setItem = function (k, v) {
    nat.set.call(this, k, v);
    if (this === window.localStorage && synced(k) && !applying)
      queue(k, String(v));
  };
  Storage.prototype.removeItem = function (k) {
    nat.remove.call(this, k);
    if (this === window.localStorage && synced(k) && !applying) queue(k, null);
  };

  status("busy", "Connecting…");
  var timeout = new Promise(function (res) {
    setTimeout(res, 6000); // never block the app if offline/slow
  });
  var first = pull()
    .then(function () {
      status("online", "Synced");
      subscribe();
      flush();
    })
    .catch(function () {
      status("offline", "Offline");
      setTimeout(function () {
        pull()
          .then(function () {
            subscribe();
            flush();
            status("online", "Synced");
            window.dispatchEvent(new CustomEvent("dtr-remote"));
          })
          .catch(function () {});
      }, 8000);
    });
  api.ready = Promise.race([first, timeout]);

  window.addEventListener("online", flush);
  // safety net in case a realtime message was missed
  setInterval(function () {
    if (!client || flushing || Object.keys(getPending()).length) return;
    pull()
      .then(function () {
        window.dispatchEvent(new CustomEvent("dtr-remote"));
      })
      .catch(function () {});
  }, 30000);
})();
