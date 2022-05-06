import i18nPlugin from "./i18n-plugin";

if (process.env.NODE_ENV !== "production") {
  setInterval(async () => {
    console.log(123123123);
  }, 5000);
}

export default i18nPlugin;
