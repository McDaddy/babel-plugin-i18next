import i18nPlugin from './i18n-plugin';
import { translateTask } from './translate';
import { status, eventEmitter } from './options';
import { writeLocale } from './write-locales';

let timer: null | NodeJS.Timeout = null; // for debounce
let rescanTimer: null | NodeJS.Timeout = null; // for debounce
let taskSignal = false; // to keep only one task will be executed, when more than one event emitted

// only when env is production, this plugin will trigger auto translation and auto rescan
if (process.env.NODE_ENV !== 'production') {
  eventEmitter.on('translation', () => {
    if (timer) {
      clearTimeout(timer);
    }
    timer = setTimeout(() => {
      if (status.initialized) {
        translateTask();
      }
    }, 1000);
  })
  eventEmitter.on('rescan', () => {
    if (taskSignal) {
      return;
    }
    taskSignal = true;
    if (rescanTimer) {
      clearTimeout(rescanTimer);
    }
    rescanTimer = setTimeout(() => {
      taskSignal = false;
      if (status.initialized && !status.translating && !status.compiling) {
        writeLocale();
      } else {
        setTimeout(() => { eventEmitter.emit('rescan') }, 2000)
      }
    }, 2000);
  })
}

export default i18nPlugin;
