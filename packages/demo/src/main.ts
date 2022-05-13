import { createApp } from "vue";
import App from "./App.vue";
import i18n from "./common/i18n";
import zh from "./locales/zh.json";
import en from "./locales/en.json";
import de from "./locales/de.json";
import ja from "./locales/ja.json";
import ko from "./locales/ko.json";

i18n
  .init({
    defaultNS: "default",
    interpolation: {
      prefix: "{",
      suffix: "}",
      formatSeparator: ",",
    },
    resources: {
      zh,
      en,
      de,
      ja,
      ko,
    },
  })
  .then(() => {
    createApp(App).mount("#app");
  });
