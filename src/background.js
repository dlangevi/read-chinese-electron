import {
  app, Menu, protocol, BrowserWindow,
} from 'electron';
import { createProtocol } from 'vue-cli-plugin-electron-builder/lib';
import installExtension, { VUEJS3_DEVTOOLS } from 'electron-devtools-installer';
import path from 'path';

import appMenuTemplate from './menu/app_menu_template';
import editMenuTemplate from './menu/edit_menu_template';
import devMenuTemplate from './menu/dev_menu_template';
import { syncWords } from './background/knownWords';
import { loadDictionaries } from './background/dictionaries';
import { preloadWords } from './background/segmentation';
import { initIpcMain } from './ipcLoader';
import {
  updateTimesRan,
  getTimesRan,
  initializeDatabase,
} from './background/database';

const isDevelopment = process.env.NODE_ENV !== 'production';

// Scheme must be registered before the app is ready
protocol.registerSchemesAsPrivileged([
  { scheme: 'app', privileges: { secure: true, standard: true } },
]);

function setApplicationMenu() {
  const menus = [appMenuTemplate, editMenuTemplate];
  // if (isDevelopment) {
  menus.push(devMenuTemplate);
  // }
  Menu.setApplicationMenu(Menu.buildFromTemplate(menus));
}

async function createWindow() {
  // Create the browser window.
  updateTimesRan();
  console.log(`Ran ${getTimesRan()}`);
  console.log(`Data stored at ${app.getPath('userData')}`);
  const win = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {

      // Required for Spectron testing
      enableRemoteModule: !!process.env.IS_TEST,

      // Use pluginOptions.nodeIntegration, leave this alone
      // See nklayman.github.io/vue-cli-plugin-electron-builder
      // /guide/security.html#node-integration for more info
      nodeIntegration: process.env.ELECTRON_NODE_INTEGRATION,
      contextIsolation: !process.env.ELECTRON_NODE_INTEGRATION,
      preload: path.join(__dirname, 'preload.js'),
    },
  });
  if (isDevelopment) {
    win.webContents.openDevTools({ mode: 'detach' });
  }

  if (process.env.WEBPACK_DEV_SERVER_URL) {
    // Load the url of the dev server if in development mode
    await win.loadURL(process.env.WEBPACK_DEV_SERVER_URL);
    // if (!process.env.IS_TEST) win.webContents.openDevTools();
  } else {
    createProtocol('app');
    // Load the index.html when not in development
    win.loadURL('app://./index.html');
  }
}

// Quit when all windows are closed.
app.on('window-all-closed', () => {
  // On macOS it is common for applications and their menu bar
  // to stay active until the user quits explicitly with Cmd + Q
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  // On macOS it's common to re-create a window in the app when the
  // dock icon is clicked and there are no other windows open.
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});

app.whenReady().then(() => {
  console.log('register protocol');
  protocol.interceptFileProtocol(
    'atom',
    (request, callback) => {
      const pathname = request.url.replace('atom:///', '');
      callback(pathname);
    },
  );
});

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.on('ready', async () => {
  // TODO can this be moved further up?
  await initializeDatabase();
  if (isDevelopment && !process.env.IS_TEST) {
    // Install Vue Devtools
    try {
      await installExtension(VUEJS3_DEVTOOLS);
    } catch (e) {
      console.error('Vue Devtools failed to install:', e.toString());
    }
  }

  try {
    await syncWords();
    setApplicationMenu();
    initIpcMain();
    await createWindow();
    await loadDictionaries();
    preloadWords();
  } catch (e) {
    console.error('Error in init', e.stack);
  }
});

// Exit cleanly on request from parent process in development mode.
if (isDevelopment) {
  if (process.platform === 'win32') {
    process.on('message', (data) => {
      if (data === 'graceful-exit') {
        app.quit();
      }
    });
  } else {
    process.on('SIGTERM', () => {
      app.quit();
    });
  }
}
