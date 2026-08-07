import { contextBridge, ipcRenderer } from 'electron';

/**
 * The only bridge between the overlay page and Electron. Node stays out of
 * the renderer; the page gets a fixed, tiny surface instead.
 */
const api = {
  getConfig: () => ipcRenderer.invoke('overlay:config'),
  hide: () => ipcRenderer.invoke('overlay:hide'),
  setInteractive: (value: boolean) => ipcRenderer.invoke('overlay:set-interactive', value),
  resize: (height: number) => ipcRenderer.invoke('overlay:resize', { height }),
  quit: () => ipcRenderer.invoke('overlay:quit'),

  onHotkey: (handler: (action: string) => void) => {
    const listener = (_e: unknown, payload: { action: string }) => handler(payload.action);
    ipcRenderer.on('hotkey', listener);
    return () => ipcRenderer.off('hotkey', listener);
  },
  onInteractiveChange: (handler: (interactive: boolean) => void) => {
    const listener = (_e: unknown, payload: { interactive: boolean }) =>
      handler(payload.interactive);
    ipcRenderer.on('interactive', listener);
    return () => ipcRenderer.off('interactive', listener);
  },
  onVisibilityChange: (handler: (visible: boolean) => void) => {
    const listener = (_e: unknown, payload: { visible: boolean }) => handler(payload.visible);
    ipcRenderer.on('visibility', listener);
    return () => ipcRenderer.off('visibility', listener);
  },
};

contextBridge.exposeInMainWorld('overlay', api);

export type OverlayApi = typeof api;
