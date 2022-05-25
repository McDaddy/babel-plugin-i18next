import i18nPlugin from './i18n-plugin';
import { translateTask } from './translate';
import { status, eventEmitter } from './options';
import { writeLocale } from './write-locales';

let timer: null | NodeJS.Timeout = null; // for debounce
let rescanTimer: null | NodeJS.Timeout = null; // for debounce

// only when env is production, this plugin will trigger auto translation and auto rescan
if (process.env.NODE_ENV !== 'production') {
  eventEmitter.on('translation', () => {
    if (timer) {
      clearTimeout(timer);
    }
    timer = setTimeout(async () => {
      if (status.initialized) {
        translateTask();
      }
    }, 1000);
  })
  eventEmitter.on('rescan', () => {
    if (rescanTimer) {
      clearTimeout(rescanTimer);
    }
    rescanTimer = setTimeout(async () => {
      if (status.initialized && !status.inProgress) {
        writeLocale();
      }
    }, 3000);
  })
}

export default i18nPlugin;
