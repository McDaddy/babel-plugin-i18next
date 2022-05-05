function i18nPlugin() {
  return {
    name: "i18n-plugin",
    async transform(code: string, id: string) {
      console.log("code: ", code.slice(0, 50), id);
    },
  };
}

export default i18nPlugin;
