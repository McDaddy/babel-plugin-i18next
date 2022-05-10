import i18nPlugin from './i18n-plugin';
import { translateTask } from './translate';
import { status } from './options'

if (process.env.NODE_ENV !== 'production') {
  setInterval(async () => {
    if (status.initialized) {
      console.log('Translate task is running...!!!');
      
      translateTask();
    }
  }, 5000);
}

export default i18nPlugin;
