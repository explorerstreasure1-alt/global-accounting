"use strict";
/*
 * Defterdar - HIZLI baslatici (masaustu ikonunun hedefi)
 *
 * Neden Node: eski surum PowerShell ile calisiyordu. PowerShell'in soguk baslangici
 * (~600 ms) + ilk dosya sistemi erisimi (~900 ms, antivurus filtresi) + yavas
 * Get-NetTCPConnection/Get-CimInstance/netsh cagrilari toplam 6-12 saniye
 * bekletiyordu. Node ~90 ms'de ayaga kaliyor ve ayni isi saniyenin altinda bitiriyor.
 *
 * Masaustu kisayolu DEGISMEDI: Defterdar.lnk -> Defterdar.vbs -> bu dosya.
 */

const fs = require("fs");
const os = require("os");
const path = require("path");
const http = require("http");
const { spawn, spawnSync } = require("child_process");

const PROJE = path.resolve(__dirname, "..");
const PORT = 3001;
const NEXT = path.join(PROJE, "node_modules", "next", "dist", "bin", "next");
const LOG = path.join(PROJE, "server.log");
const HATA_LOG = path.join(PROJE, "server-hata.log");

const DURUM = path.join(os.tmpdir(), `defterdar-${PORT}.durum`);
const PID_KAYIT = path.join(os.tmpdir(), `defterdar-${PORT}.pid`);
const DUVAR = path.join(os.tmpdir(), "defterdar-duvar.tamam");

// ---------------------------------------------------------------- yardimcilar

function kurulumGerekliMi() {
  return (
    !fs.existsSync(path.join(PROJE, "node_modules")) ||
    !fs.existsSync(path.join(PROJE, ".next", "BUILD_ID"))
  );
}

function npm(args) {
  const sonuc = spawnSync("npm.cmd", args, { cwd: PROJE, stdio: "inherit", shell: true });
  if (sonuc.status !== 0) process.exit(1);
}

/** Sunucu gercekten HTTP 200 donuyor mu? (Ollama/DB/dosya taramasi YOK) */
function sunucuVar(geri) {
  // onemli: http.request bir kez daha 'error' tetikleyebilir (destroy sonrasi
  // ECONNRESET). Geri cagirmayi yalnizca ilk sonucta bir kez cagir.
  let bitti = false;
  const birKez = (sonuc) => {
    if (bitti) return;
    bitti = true;
    geri(sonuc);
  };

  const istek = http.request(
    { host: "127.0.0.1", port: PORT, path: "/api/ping", method: "GET", timeout: 4000 },
    (yanit) => {
      yanit.resume();
      birKez(yanit.statusCode === 200);
    }
  );
  istek.on("error", () => birKez(false));
  istek.on("timeout", () => {
    istek.destroy();
    birKez(false);
  });
  istek.end();
}

function hazirOlanaKadarBekle(geri) {
  const baslangic = Date.now();
  let deneme = 0;
  const dene = () => {
    if (Date.now() - baslangic > 60000) return geri(false);
    deneme++;
    sunucuVar((ok) => {
      if (ok) {
        T(`sunucu hazir (${deneme}. deneme)`);
        return geri(true);
      }
      setTimeout(dene, 400);
    });
  };
  dene();
}

/** Build, sunucudan yeni mi? (GUNCELLE.bat zaten yeniden baslatir; bu sadece ek guvence) */
function bayatMi() {
  try {
    const derlemeZamani = fs.statSync(path.join(PROJE, ".next", "BUILD_ID")).mtimeMs;
    const parcalar = fs.readFileSync(DURUM, "utf8").split("|");
    const baslatma = Date.parse(parcalar[1]);
    return Number.isFinite(baslatma) && derlemeZamani > baslatma;
  } catch {
    return false;
  }
}

function eskiSunucuyuDurdur(geri) {
  let hedef = 0;
  try {
    hedef = parseInt(fs.readFileSync(PID_KAYIT, "utf8").trim(), 10) || 0;
  } catch {
    /* kayit yok */
  }
  if (hedef > 0) {
    try {
      process.kill(hedef);
    } catch {
      /* zaten kapali */
    }
  }
  // Kayit yanlis/eskis olabilir (orn. GUNCELLE.bat sunucuyu kendisi yenilemisse).
  // Bu yuzden sunucunun gercekten dustugunu dogrula; dustuyse yenisini baslat.
  const baslangic = Date.now();
  const dogrula = () =>
    sunucuVar((halaAyakta) => {
      if (!halaAyakta) return geri(true); // gercekten kapandi -> yenisi baslatilabilir
      if (Date.now() - baslangic > 4000) return geri(false); // kapanmadi -> oldugunu varsay
      setTimeout(dogrula, 300);
    });
  dogrula();
}

/** Firewall izni: eskiden HER tiklamada yeni kural ekleniyordu (5 kopya birikti). Artik bir kez. */
function duvarIzniBirKez() {
  if (fs.existsSync(DUVAR)) return;
  spawnSync(
    "netsh",
    ["advfirewall", "firewall", "add", "rule", "name=Defterdar", "dir=in", "action=allow", "protocol=TCP", `localport=${PORT}`],
    { stdio: "ignore", windowsHide: true }
  );
  try {
    fs.writeFileSync(DUVAR, new Date().toISOString());
  } catch {
    /* yazilamazsa bir sonraki acilista tekrar dener */
  }
}

function sunucuyuBaslat() {
  const cikti = fs.openSync(LOG, "a");
  const hata = fs.openSync(HATA_LOG, "a");
  const cocuk = spawn(process.execPath, [NEXT, "start", "-p", String(PORT), "-H", "0.0.0.0"], {
    cwd: PROJE,
    detached: true,
    stdio: ["ignore", cikti, hata],
    windowsHide: true,
  });
  cocuk.unref();
  try {
    fs.writeFileSync(PID_KAYIT, String(cocuk.pid));
  } catch {
    /* yazilamazsa sadece bayat sunucu kapatilamaz */
  }
}

function tarayiciBul() {
  const pf = process.env.ProgramFiles || "";
  const pf86 = process.env["ProgramFiles(x86)"] || "";
  const yerel = process.env.LOCALAPPDATA || "";
  const adaylar = [
    path.join(pf, "Microsoft", "Edge", "Application", "msedge.exe"),
    path.join(pf86, "Microsoft", "Edge", "Application", "msedge.exe"),
    path.join(yerel, "Microsoft", "Edge", "Application", "msedge.exe"),
    path.join(pf, "Google", "Chrome", "Application", "chrome.exe"),
    path.join(pf86, "Google", "Chrome", "Application", "chrome.exe"),
    path.join(yerel, "Google", "Chrome", "Application", "chrome.exe"),
  ];
  return adaylar.find((exe) => fs.existsSync(exe)) || null;
}

function pencereyiAc() {
  const adres = `http://localhost:${PORT}/`;
  const exe = tarayiciBul();
  if (exe) {
    const profil = path.join(process.env.APPDATA || os.homedir(), "Defterdar", "PencereProfili-Edge");
    spawn(exe, [`--app=${adres}`, `--user-data-dir=${profil}`], {
      detached: true,
      stdio: "ignore",
      windowsHide: true,
    }).unref();
  } else {
    spawn("cmd", ["/c", "start", "", adres], { detached: true, stdio: "ignore", windowsHide: true }).unref();
  }
}

function durumYaz() {
  try {
    fs.writeFileSync(DURUM, `calisiyor|${new Date().toISOString()}`);
  } catch {
    /* gecici dosya yazilamiyorsa bayatlik kontrolu devre disi kalir */
  }
}

// ---------------------------------------------------------------------- akis

// DEFTERDAR_SURE=1 ile konsola zamanlama basilir (tanilama icin).
const BAS = Date.now();
const SURE = process.env.DEFTERDAR_SURE === "1";
function T(ad) {
  if (SURE) process.stderr.write(`  ${ad.padEnd(26)} ${String(Date.now() - BAS).padStart(6)} ms\n`);
}

function main() {
  T("script basladi");
  if (kurulumGerekliMi()) {
    if (!fs.existsSync(path.join(PROJE, "node_modules"))) npm(["install", "--no-audit", "--no-fund"]);
    if (!fs.existsSync(path.join(PROJE, ".next", "BUILD_ID"))) npm(["run", "build"]);
  }

  duvarIzniBirKez();
  T("kurulum + duvar");

  sunucuVar((calisiyor) => {
    T("sunucu kontrolu");
    if (!calisiyor) return baslatVeAc();
    if (!bayatMi()) {
      durumYaz();
      pencereyiAc();
      T("pencere istendi");
      return;
    }

    // Derleme sunucudan yeni: eskisini kapat, yenisini baslat.
    eskiSunucuyuDurdur((kapandi) => {
      if (kapandi) return baslatVeAc();
      // Sunucu kapanmadi ama calisiyor gorunuyor; yenisini baslatmak port cakismasi yaratir.
      durumYaz();
      pencereyiAc();
      T("sunucu kapanmadi, mevcut surum kullanildi");
    });
  });
}

function baslatVeAc() {
  sunucuyuBaslat();
  hazirOlanaKadarBekle(() => {
    durumYaz();
    pencereyiAc();
    T("sunucu kalkti + pencere");
  });
}

main();