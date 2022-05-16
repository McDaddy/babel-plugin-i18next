import chalk from 'chalk';
import fs from 'fs';
import path from 'path';
import { pluginOptions } from './options';
import { includedWord, log } from './utils';

/**
 * structure like this:
 * {
 *  'en': { 'ns1': { 'key1': 'value1' }, 'ns2': { 'key2': 'value2' } },
 *  'zh': { 'ns1': { 'key1': 'value1' }, 'ns2': { 'key2': 'value2' } }
 * }
 */
const localeCache = new Map<string, { [k: string]: Obj }>();
export const namespaces: string[] = [];
export const fileMapping: Array<{ path: string; ns: string[] }> = [];

// load all locale content into cache when init
export const loadLocale = (localePaths: string[], languages: Array<{ code: string }>) => {
  languages.forEach(({ code }) => {
    localeCache.set(code, {});
  });
  let parseNsDone = false;
  for (const language of languages) {
    const { code } = language;
    for (const localePath of localePaths) {
      const fileDirPath = path.isAbsolute(localePath) ? localePath : path.join(process.cwd(), localePath);
      const localeFilePath = path.join(fileDirPath, `${code}.json`);
      const fileContent = fs.readFileSync(localeFilePath).toString('utf8');
      const localeObj = JSON.parse(fileContent);
      localeCache.set(code, { ...localeCache.get(code), ...localeObj });
      const fileNamespaces = Object.keys(localeObj);
      fileMapping.push({
        path: localeFilePath,
        ns: fileNamespaces,
      });
      fs.watch(localeFilePath, () => {
        updateFileCache(localeFilePath);
      });
      if (!parseNsDone) {
        namespaces.push(...fileNamespaces);
      }
    }
    parseNsDone = true;
  }
  const duplicateNs = namespaces.filter((ns) => namespaces.indexOf(ns) !== namespaces.lastIndexOf(ns));
  if (duplicateNs.length) {
    throw Error(`Duplicate namespace: ${duplicateNs.join(', ')}`);
  }
};

// check if exist in current locale by text + ns
export const isExistingWord = (text: string, ns: string, alert?: boolean) => {
  let notTranslated = false;
  const matched = pluginOptions?.languages.every(({ code }) => {
    const cache = localeCache.get(code)!;
    const nsContent = cache[ns];
    if (nsContent && includedWord(Object.keys(nsContent), text)) {
      if (nsContent[text] === '__NOT_TRANSLATED__') {
        notTranslated = true;
      }
      return true;
    }
    return false;
  });
  if (!matched && alert !== false) {
    log(chalk.yellow(`[translation]: word ${text} not found in namespace: ${ns}`));
  }
  return { notTranslated, matched };
};

export const getValue = (lng: string, ns: string, text: string) => {
  return localeCache.get(lng)![ns][text];
};

export const getValues = (ns: string, text: string) => {
  const values: Obj = {};
  for (const lng of localeCache.keys()) {
    values[lng] = localeCache.get(lng)![ns][text];
  }
  return values;
};

export const getLngCache = (lng: string) => {
  return localeCache.get(lng);
};

export const updateFileCache = (filePath: string) => {
  const fileName = path.basename(filePath);
  const code = fileName.split('.')[0];
  const fileContent = fs.readFileSync(filePath).toString('utf8');
  const localeObj = JSON.parse(fileContent);
  localeCache.set(code, { ...localeCache.get(code), ...localeObj });
};
