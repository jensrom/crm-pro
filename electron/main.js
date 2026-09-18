/**
 * CRM-Pro som Windows-program — installeret eller portabelt.
 *
 * Hovedprocessen gør tre ting i rækkefølge:
 *   1. finder ud af hvor data skal ligge
 *   2. klargør databasen og starter Next-serveren på en ledig port
 *   3. åbner vinduet mod den port
 *
 * Serveren kører som en underproces med Electrons egen node-runtime, så der
 * ikke skal være Node installeret på maskinen.
 */
const { app, BrowserWindow, Menu, dialog, shell, nativeImage, ipcMain } = require("electron");
const { fork } = require("node:child_process");
const { createServer } = require("node:net");
const { existsSync, mkdirSync, readFileSync, writeFileSync } = require("node:fs");
const path = require("node:path");

// ---------- hvor tingene ligger ----------

const erPakket = app.isPackaged;

/** Programmets filer: i pakket tilstand ligger de udpakket ved siden af asar-arkivet. */
const appMappe = erPakket ? path.join(process.resourcesPath, "app") : path.join(__dirname, "..");

/**
 * Datamappen — hvor crm-pro.config.json og en lokal database bor.
 *
 * Portabel udgave: electron-builder sætter PORTABLE_EXECUTABLE_DIR til mappen
 * hvor exe-filen ligger, så alt følger med USB-nøglen.
 *
 * Installeret udgave: brugerens egen mappe (%APPDATA%\CRM-Pro). Programmappen
 * duer ikke — den kan ligge i Program Files hvor der ikke må skrives, og den
 * bliver ryddet ved en opdatering.
 */
const portabelMappe = process.env.PORTABLE_EXECUTABLE_DIR?.trim();
const dataMappe = !erPakket
  ? path.join(__dirname, "..")
  : portabelMappe
    ? path.join(portabelMappe, "CRM-Pro-data")
    : app.getPath("userData");

mkdirSync(dataMappe, { recursive: true });

const vinduesfil = path.join(dataMappe, "vindue.json");

// ---------- én instans ad gangen ----------
// To vinduer mod samme SQLite-fil er en god måde at ødelægge den på.
if (!app.requestSingleInstanceLock()) {
  app.quit();
  process.exit(0);
}

let vindue = null;
let serverProces = null;
let serverPort = 0;
let lukkerNed = false;

app.on("second-instance", () => {
  if (vindue) {
    if (vindue.isMinimized()) vindue.restore();
    vindue.focus();
  }
});

// ---------- hjælpere ----------

function findLedigPort() {
  return new Promise((resolve, reject) => {
    const s = createServer();
    s.unref();
    s.on("error", reject);
    s.listen(0, "127.0.0.1", () => {
      const p = s.address().port;
      s.close(() => resolve(p));
    });
  });
}

function prismaMiljoe() {
  // Motoren ligger udpakket ved siden af arkivet. Findes den, peger vi Prisma
  // direkte på den — ellers leder klienten forgæves inde i asar-filen.
  const motorMappe = path.join(appMappe, "node_modules", ".prisma", "client");
  const miljoe = {};
  if (existsSync(motorMappe)) {
    for (const navn of [
      "query_engine-windows.dll.node",
      "libquery_engine-debian-openssl-3.0.x.so.node",
      "libquery_engine-darwin.dylib.node",
      "libquery_engine-darwin-arm64.dylib.node",
    ]) {
      const fuld = path.join(motorMappe, navn);
      if (existsSync(fuld)) {
        miljoe.PRISMA_QUERY_ENGINE_LIBRARY = fuld;
        break;
      }
    }
    miljoe.PRISMA_SCHEMA_PATH = path.join(appMappe, "prisma", "schema.prisma");
  }
  return miljoe;
}

function basisMiljoe() {
  return {
    ...process.env,
    ...prismaMiljoe(),
    NODE_ENV: "production",
    ELECTRON_RUN_AS_NODE: "1",
    CRMPRO_APP_DIR: appMappe,
    CRMPRO_DATA_DIR: dataMappe,
    // Bruges af lib/version.ts til "Om CRM-Pro" og opdateringstjekket i
    // Indstillinger → Opdatering — så Next-serveren ikke selv skal gætte
    // hvilken version den bygget app.getVersion() faktisk er.
    CRMPRO_VERSION: app.getVersion(),
  };
}

function koerBootstrap() {
  return new Promise((resolve, reject) => {
    const p = fork(path.join(appMappe, "electron", "bootstrap.mjs"), [], {
      env: basisMiljoe(),
      cwd: appMappe,
      stdio: ["ignore", "pipe", "pipe", "ipc"],
    });
    let fejltekst = "";
    p.stdout?.on("data", (d) => process.stdout.write(String(d)));
    p.stderr?.on("data", (d) => {
      fejltekst += String(d);
      process.stderr.write(String(d));
    });
    p.on("error", reject);
    p.on("exit", (kode) =>
      kode === 0 ? resolve() : reject(new Error(fejltekst.trim() || `Klargøringen stoppede med kode ${kode}`))
    );
  });
}

function startServer(port) {
  return new Promise((resolve, reject) => {
    const standalone = path.join(appMappe, ".next", "standalone");
    const serverfil = path.join(standalone, "server.js");
    if (!existsSync(serverfil)) {
      reject(new Error(`Finder ikke serveren: ${serverfil}`));
      return;
    }

    serverProces = fork(serverfil, [], {
      cwd: standalone,
      env: { ...basisMiljoe(), PORT: String(port), HOSTNAME: "127.0.0.1" },
      stdio: ["ignore", "pipe", "pipe", "ipc"],
    });

    let startet = false;
    let fejltekst = "";

    serverProces.stdout?.on("data", (d) => {
      const t = String(d);
      process.stdout.write(t);
      if (!startet && /Ready|started server|Local:/i.test(t)) {
        startet = true;
        resolve();
      }
    });
    serverProces.stderr?.on("data", (d) => {
      fejltekst += String(d);
      process.stderr.write(String(d));
    });
    serverProces.on("error", reject);
    serverProces.on("exit", (kode) => {
      if (!startet) reject(new Error(fejltekst.trim() || `Serveren stoppede med kode ${kode}`));
      else if (!lukkerNed) {
        dialog.showErrorBox("CRM-Pro", "Serveren stoppede uventet. Programmet lukker.");
        app.quit();
      }
    });

    // Reagerer serveren ikke på beskeder, prøver vi porten direkte.
    const frist = setInterval(async () => {
      if (startet) return clearInterval(frist);
      try {
        const svar = await fetch(`http://127.0.0.1:${port}/login`, { redirect: "manual" });
        if (svar) {
          startet = true;
          clearInterval(frist);
          resolve();
        }
      } catch {
        /* endnu ikke klar */
      }
    }, 400);

    setTimeout(() => {
      if (!startet) {
        clearInterval(frist);
        reject(new Error("Serveren svarede ikke inden for 60 sekunder."));
      }
    }, 60_000);
  });
}

function laesVinduestilstand() {
  try {
    const t = JSON.parse(readFileSync(vinduesfil, "utf8"));
    if (typeof t.width === "number" && typeof t.height === "number") return t;
  } catch {
    /* første start, eller filen er væk */
  }
  return { width: 1440, height: 920 };
}

function gemVinduestilstand() {
  if (!vindue || vindue.isDestroyed()) return;
  try {
    const b = vindue.getNormalBounds();
    writeFileSync(
      vinduesfil,
      JSON.stringify({ ...b, maximized: vindue.isMaximized() }, null, 2),
      "utf8"
    );
  } catch {
    /* skrivebeskyttet medie — ikke værd at afbryde for */
  }
}

function byggMenu() {
  Menu.setApplicationMenu(
    Menu.buildFromTemplate([
      {
        label: "Filer",
        submenu: [
          {
            label: "Åbn datamappen",
            click: () => shell.openPath(dataMappe),
          },
          {
            label: "Åbn i browser",
            click: () => shell.openExternal(`http://127.0.0.1:${serverPort}/dashboard`),
          },
          { type: "separator" },
          { role: "quit", label: "Afslut" },
        ],
      },
      {
        label: "Vis",
        submenu: [
          { role: "reload", label: "Genindlæs" },
          { role: "forceReload", label: "Genindlæs helt" },
          { type: "separator" },
          { role: "resetZoom", label: "Normal størrelse" },
          { role: "zoomIn", label: "Zoom ind" },
          { role: "zoomOut", label: "Zoom ud" },
          { type: "separator" },
          { role: "togglefullscreen", label: "Fuld skærm" },
          { role: "toggleDevTools", label: "Udviklerværktøjer" },
        ],
      },
      {
        label: "Rediger",
        submenu: [
          { role: "undo", label: "Fortryd" },
          { role: "redo", label: "Gentag" },
          { type: "separator" },
          { role: "cut", label: "Klip" },
          { role: "copy", label: "Kopiér" },
          { role: "paste", label: "Sæt ind" },
          { role: "selectAll", label: "Markér alt" },
        ],
      },
      {
        label: "Hjælp",
        submenu: [
          {
            label: "Om CRM-Pro",
            click: () =>
              dialog.showMessageBox(vindue, {
                type: "info",
                title: "Om CRM-Pro",
                message: `CRM-Pro ${app.getVersion()}`,
                detail:
                  `Data: ${dataMappe}\n` +
                  `Server: http://127.0.0.1:${serverPort}\n\n` +
                  "Hele databasen er én fil i datamappen. Luk programmet og kopiér den — det er hele sikkerhedskopien.",
                buttons: ["Luk"],
              }),
          },
        ],
      },
    ])
  );
}

function lavVindue() {
  const t = laesVinduestilstand();
  vindue = new BrowserWindow({
    width: t.width,
    height: t.height,
    x: t.x,
    y: t.y,
    minWidth: 1024,
    minHeight: 680,
    show: false,
    backgroundColor: "#0F172A",
    title: "CRM-Pro",
    icon: nativeImage.createFromPath(path.join(appMappe, "build", "icon.png")),
    autoHideMenuBar: false,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      spellcheck: false,
      preload: path.join(__dirname, "preload.js"),
    },
  });

  if (t.maximized) vindue.maximize();

  // Eksterne links hører hjemme i browseren, ikke i programvinduet.
  const eksternt = (url) => !url.startsWith(`http://127.0.0.1:${serverPort}`);
  vindue.webContents.setWindowOpenHandler(({ url }) => {
    if (eksternt(url)) shell.openExternal(url);
    return { action: "deny" };
  });
  vindue.webContents.on("will-navigate", (e, url) => {
    if (eksternt(url)) {
      e.preventDefault();
      shell.openExternal(url);
    }
  });

  vindue.on("close", gemVinduestilstand);
  vindue.on("closed", () => (vindue = null));
  vindue.once("ready-to-show", () => vindue.show());
  return vindue;
}

function visStartfejl(fejl) {
  dialog.showErrorBox(
    "CRM-Pro kunne ikke starte",
    `${fejl?.message ?? fejl}\n\n` +
      `Data: ${dataMappe}\n` +
      `Program: ${appMappe}\n\n` +
      "Ligger databasen på et netværksdrev, så tjek at drevet er tilgængeligt."
  );
}

// ---------- native stifinder ----------
// Kaldes fra siden via electron/preload.js's window.crmProNative.vaelgFil().
// Bruges til database- og opdaterings-stierne, så man kan klikke sig frem i
// stedet for at skulle skrive/indsætte en fuld sti (og evt. et UNC-drev)
// i hånden.
ipcMain.handle("vaelg-fil", async (event, opts = {}) => {
  const afsenderVindue = BrowserWindow.fromWebContents(event.sender) ?? vindue;
  const filtre =
    Array.isArray(opts?.filters) && opts.filters.length ? opts.filters : [{ name: "Alle filer", extensions: ["*"] }];

  if (opts?.mode === "save") {
    const res = await dialog.showSaveDialog(afsenderVindue, {
      title: opts.titel || "Vælg placering",
      defaultPath: opts.standardSti || undefined,
      filters: filtre,
    });
    return res.canceled || !res.filePath ? null : res.filePath;
  }

  const res = await dialog.showOpenDialog(afsenderVindue, {
    title: opts?.titel || "Vælg fil",
    defaultPath: opts?.standardSti || undefined,
    properties: ["openFile"],
    filters: filtre,
  });
  return res.canceled || res.filePaths.length === 0 ? null : res.filePaths[0];
});

// ---------- opstart ----------

app.whenReady().then(async () => {
  try {
    serverPort = await findLedigPort();
    await koerBootstrap();
    await startServer(serverPort);
    byggMenu();
    lavVindue().loadURL(`http://127.0.0.1:${serverPort}/dashboard`);
  } catch (fejl) {
    visStartfejl(fejl);
    app.quit();
  }
});

app.on("window-all-closed", () => app.quit());

app.on("before-quit", () => {
  lukkerNed = true;
  gemVinduestilstand();
  if (serverProces && !serverProces.killed) serverProces.kill();
});

process.on("exit", () => {
  if (serverProces && !serverProces.killed) serverProces.kill();
});
