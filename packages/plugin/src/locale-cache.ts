import chalk from 'chalk';
import fs from 'fs';
import { filter, find, unset } from 'lodash';
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
// all existing namespaces
export let namespaces: string[] = [];
// file ns mapping
// e.g. /xxx/locales -> [ns1, ns2]
export const fileMapping: Array<{ path: string; ns: string[] }> = [];

// load all locale content into cache when init
export const loadLocale = (localePaths: string[], languages: Array<{ code: string }>) => {
  languages.forEach(({ code }) => {
    localeCache.set(code, {});
  });
  for (const localePath of localePaths) {
    const fileDirPath = path.isAbsolute(localePath) ? localePath : path.join(process.cwd(), localePath);
    const primaryLng = pluginOptions?.primaryLng;
    const localeFilePath = path.join(fileDirPath, `${primaryLng}.json`);
    const fileContent = fs.readFileSync(localeFilePath).toString('utf8');
    const localeObj = JSON.parse(fileContent);
    const fileNamespaces = Object.keys(localeObj);
    fileMapping.push({
      path: localePath,
      ns: fileNamespaces,
    });
    namespaces.push(...fileNamespaces);
    localeCache.set(primaryLng!, { ...localeCache.get(primaryLng!), ...localeObj });
    fs.watch(localeFilePath, () => {
      updateFileCache(localeFilePath);
    });
    for (const language of languages) {
      const { code } = language;
      if (code === primaryLng) {
        continue;
      }
      const filePath = path.join(fileDirPath, `${code}.json`);
      const content = fs.readFileSync(filePath).toString('utf8');
      const obj = JSON.parse(content);
      localeCache.set(code, { ...localeCache.get(code), ...obj });
      fs.watch(filePath, () => {
        updateFileCache(filePath);
      });
    }
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
  const fileNs = find(fileMapping, { path: path.dirname(filePath)}) ;
  if (fileNs) {
    const { ns } = fileNs;
    const oldContent = localeCache.get(code);
    for (const _ns of ns) {
      unset(oldContent, _ns); 
    }
    localeCache.set(code, { ...oldContent, ...localeObj });
    const filteredNs = filter(namespaces, (item) => !ns.includes(item) );
    namespaces = [...filteredNs, ...Object.keys(localeObj)];
  }
};

export const isExistNs = (ns: string) => {
  if (ns === '') {
    log(chalk.yellow('namespace should not be empty string'));
  }
  return namespaces.includes(ns);
};

export const addNamespaceCache = (ns: string, localePath: string) => {
  if (!isExistNs(ns)) {
    namespaces.push(ns);
  }

  const mapping = find(fileMapping, { path: localePath });
  if (mapping) {
    mapping.ns.push(ns);
  }

  for (const key of localeCache.keys()) {
    const content = localeCache.get(key);
    localeCache.set(key, { ...content, ...{ [ns]: {} } });
  }
};
