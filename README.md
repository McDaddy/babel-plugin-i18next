# babel-plugin-i18next

a `babel` plugin for automating internationalization

## Feature

- 🚀 &nbsp; Automatic translation from one language to another language
- 💼 &nbsp; Automated namespace management
- 🤝 &nbsp; Compatible with your existing i18n implementation
- 🛴 &nbsp; Say goodbye to manually scripting `i18next-scanner`
- 🍻 &nbsp; Support Google and Youdao translation API



![demo.gif](https://kuimo-markdown-pic.oss-cn-hangzhou.aliyuncs.com/Kapture 2022-06-01 at 16.27.29.gif)



## Precondition

- Project must use [i18next](https://www.npmjs.com/package/i18next) as the internationalization framework



## Installation

```bash
pnpm install babel-plugin-i18next -D
```



## Demo

1. fork this repository
2. `pnpm i`
3. `cd packages/demo`
4. `pnpm serve`
5. [localhost:8080](http://localhost:8080)



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

- primaryLng `string` - （required）primary language

- include `string | string[]` - （required）the source files should be scaned for i18n, should be `glob`

- defaultNs `string` - 默认的命名空间

   默认： 从`ns`属性中取第一个

- apiKey `string` - 当不配置此项时，插件会调用免费的谷歌翻译库[@vitalets/google-translate-api](https://www.npmjs.com/package/@vitalets/google-translate-api)进行翻译，但在此情况下，无法保证翻译的稳定性，在同一网关调用多次翻译后可能会出现403/429等错误，表示被谷歌限制。建议使用者申请一个[Google Cloud](https://cloud.google.com/translate/docs/)的账号，每月50万字符的免费流量基本可以保障一个中大型前端应用使用。完成申请后创建一个API凭证，即API key，配置之后就可以稳定翻译了。

- timeout `number` - 谷歌翻译超时时间

   默认： `5000` （5秒）

- customProps `Object` - 自定义的`i18next-scanner`[配置](https://github.com/i18next/i18next-scanner#options)，可以配置是否去除无用翻译，是否排序等属性

 

## 注意

1. 不支持带变量的国际化即[Interpolation](https://www.i18next.com/translation-function/interpolation)，如： `i18n.t('add {name}', { name: i18n.t('caller') })`
2. 不支持运行时的变量翻译，如： `i18n.s(isMale ? '他': '她')` 或 `i18n.s(variable)`
3. 不支持[Trans](https://react.i18next.com/latest/trans-component)组件， [Plurals](https://www.i18next.com/translation-function/plurals)
4. 手动修改locale文件不会自动发起重编译，此时刷新页面并不会出现修改后的内容，此时请在源文件上任意添加一个新词翻译或者重启项目来触发重编译
5. 在`defaultLng`为`en`的情况下，两个不同的中文可能会对应相同的自动翻译结果，此时插件会提示翻译发生了冲突，并将新翻译的词后加上`__CONFLICT__`，如下图。此时就需要使用者手动去修改locale文件。

![image-20210218135345022](https://kuimo-markdown-pic.oss-cn-hangzhou.aliyuncs.com/image-20210218135345022.png)