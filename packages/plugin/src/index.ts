import i18nPlugin from './i18n-plugin';
import { translateTask } from './translate';
import { status, eventEmitter } from './options';
import { writeLocale } from './write-locales';

let timer: null | NodeJS.Timeout = null; // for debounce
let removeTimer: null | NodeJS.Timeout = null; // for debounce

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
    if (removeTimer) {
      clearTimeout(removeTimer);
    }
    removeTimer = setTimeout(async () => {
      if (status.initialized) {
        writeLocale(null);
      }
    }, 3000);
  })
}

export default i18nPlugin;
