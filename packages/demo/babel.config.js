const path = require("path");

module.exports = {
  presets: ["@vue/cli-plugin-babel/preset"],
  plugins: [
    [
      "i18next",
      {
        localePath: path.resolve(__dirname, "src", "locales"),
        languages: [
          { code: "en" },
          { code: "zh" },
          { code: "de" },
          { code: "ja" },
          { code: "ko" },
        ],
        primaryLng: "en",
        defaultNS: "default",
        include: [`${path.resolve(__dirname, "src")}/**/*.{js,jsx,ts,tsx,vue}`],
        translateApi: { type: 'google', secretFile: path.resolve(__dirname, '.translaterc') }
      },
    ],
  ],
};
