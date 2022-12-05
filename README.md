# babel-plugin-i18next

a `babel` plugin for automating internationalization

## Feature

- 🚀 &nbsp; Automatic translation from one language to another language
- 💼 &nbsp; Automated namespace management
- 🤝 &nbsp; Compatible with your existing i18n implementation
- 🛴 &nbsp; Say goodbye to manually scripting `i18next-scanner`
- 🍻 &nbsp; Support Google and Youdao translation API



![demo](demo.png)



## Precondition

- Project must use [i18next](https://www.npmjs.com/package/i18next) as the internationalization framework



## Installation

```bash
pnpm install babel-plugin-i18next -D
```



## Demo

1. fork this repository
2. `pnpm i`
3. `pnpm build`
4. `cd packages/demo`
5. `pnpm serve`
6. [localhost:8080](http://localhost:8080)



## Quick Start

1. in babel config file `babel.config.js` 

```javascript
module.exports = {
  presets: [...],
  plugins: [
    [
      "i18next",
      {
        localePath: path.resolve(__dirname, "src", "locales"),
        languages: [
          { code: "en" },
          { code: "zh" },
        ],
        primaryLng: "en",
        defaultNS: "default",
        include: [`${path.resolve(__dirname, 'src')}/**/*.{js,jsx,ts,tsx,vue}`],
        translateApi: { type: 'google', secretFile: path.resolve(__dirname, '.translaterc') },
        interpolation: {
          prefix: '{{',
          suffix: '}}',
        },
      },
    ],
    ...
  ],
};
```

2. Add one extra function in your i18n module and export it

```javascript
// i18n.ts
import i18next from 'i18next';

export default {
  ...i18next,
  s: (text: string, ns?: { [key: string]: any } | string, opts?: { [key: string]: any }) => text,
};

```

3. In your source code, wrap the text which needs to be translated with `i18n.s` or `i18next.s`

```javascript
// souce code
import i18n from 'i18n';
// import i18next from 'i18n'; // i18next is also ok
...

// after compile it will be 
// const title = i18n.t('myNs:title');
const title = i18n.s('title', 'myNs');
```

4. if in `development` mode, will translate the text which not found in locale source, or untranslated. Meanwhile will transform `i18n.s` –> `i18n.t`
5. If in `production` mode, will transform `i18n.s` –> `i18n.t`, if find untranslated text, will throw error and exit built. 



## API

- localePath `string | string[]` - （required）The absolute path of the multilingual locale source folder, please make sure that there are source files names as  `lngCode.json` in the path
- Languages `{ code: string }[]` - （required）language with its code
- primaryLng `string` - （required）primary language
- include `string | string[]` - （required）the source files should be scaned for i18n, should be `glob`
- defaultNs `string` - （required） default namespace

- translateApi `{ type: 'google' | 'youdao', secretFile: string }` - When this option is not configured, the plugin will call the free Google Translate library [@vitalets/google-translate-api](https://www.npmjs.com/package/@vitalets/google-translate-api) for translation, However, in this case, the stability of translation cannot be guaranteed, and errors such as 403/429 may occur after calling multiple translations on the same gateway, indicating that it is restricted by Google. It is recommended that users apply for a [Google Cloud](https://cloud.google.com/translate/docs/) account. The monthly free traffic of 500,000 characters can basically guarantee the use of a medium-to-large front-end application. After completing the application, create an API credential, that is, an API key. After configuration, stable translation can be performed. Meanwhile [Youdao](https://ai.youdao.com/product-fanyi-text.s) is also an option for it

 

