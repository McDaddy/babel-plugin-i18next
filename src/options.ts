export const status = { initialized: false };
export let pluginOptions: PluginConfig | null = null;
export let localeFileNames: string[] = [];

export interface Config {
  localePath: string | string[];
  primaryLng: string;
  defaultNS: string;
  languages: { localeName: string; code: string }[];
  customProps: any;
}

export interface PluginConfig extends Config {
  localePath: string[];
}

export const optionChecker = (option: Config) => {
  if (status.initialized) {
    return;
  }
  const { primaryLng, languages, defaultNS, localePath } = option ?? {};
  if (!languages || languages.length <= 1) {
    throw new Error('languages config is required and must be more than one type of language');
  }
  if (!primaryLng) {
    throw new Error('primaryLng is required option for babel-plugin-i18next');
  }
  if (!defaultNS) {
    throw new Error('defaultNS is required option for babel-plugin-i18next');
  }
  if (!localePath) {
    throw new Error('localePath is required option for babel-plugin-i18next');
  }
  localeFileNames = languages.map((lng) => lng.localeName);

  const _localePaths = Array.isArray(localePath) ? localePath : [localePath];
  pluginOptions = { ...option, localePath: _localePaths };
};
