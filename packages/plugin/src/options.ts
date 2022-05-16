import { some } from "lodash";
import fs from 'fs';

export const status = { initialized: false };
export let pluginOptions: PluginConfig | null = null;
export let localeFileNames: string[] = [];

export interface Config {
  localePath: string | string[];
  primaryLng: string;
  defaultNS: string;
  languages: { code: string, specialCode?: string }[];
  customProps: any;
  include: string[];
  exclude?: string[];
  translateApi?: { type: 'youdao' | 'google', secretFile: string }
}

export interface PluginConfig extends Config {
  localePath: string[];
}

export const optionChecker = (option: Config) => {
  if (status.initialized) {
    return;
  }
  const { primaryLng, languages, defaultNS, localePath, include, translateApi } = option ?? {};
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
  if (typeof localePath !== 'string' && (!Array.isArray(localePath) || some(localePath, p => typeof p !== 'string'))) {
    throw new Error('localePath type must be string array or string');
  }
  if (!include) {
    throw new Error('include is required option for babel-plugin-i18next');
  }
  if (!Array.isArray(include) || !include.length) {
    throw new Error('include must be string array and should has at least one element');
  }
  if (translateApi) {
    if (!['youdao', 'google'].includes(translateApi.type)) {
      throw new Error('translateApi type could only be `youdao` or `google`');
    }
    if (!translateApi.secretFile) {
      throw new Error('translateApi secretFile is required option for babel-plugin-i18next when translateApi is not empty');
    }
    if (!fs.existsSync(translateApi.secretFile)) {
      throw new Error(`translateApi secretFile ${translateApi.secretFile} is not exists`);
    }
  }
  localeFileNames = languages.map((lng) => lng.code);

  const _localePaths = Array.isArray(localePath) ? localePath : [localePath];
  pluginOptions = { ...option, localePath: _localePaths };
};
