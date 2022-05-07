import i18nPlugin from "./i18n-plugin";
import { translateTask } from "./translate";

if (process.env.NODE_ENV !== "production") {
  setInterval(async () => {
    translateTask();
  }, 5000);
}

export default i18nPlugin;
