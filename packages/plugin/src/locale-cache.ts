import chalk from 'chalk';
import fs from 'fs';
import chokidar, { FSWatcher } from 'chokidar';
import { filter, unset } from 'lodash';
import path from 'path';
import { eventEmitter, pluginOptions } from './options';
import { includedWord, logger } from './utils';

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
export const fileMapping: Map<string, string[]> = new Map();
export const includedFiles: Set<string> = new Set();

let watcher: FSWatcher | null = null;

export const addWatchFile = (fileName: string) => {
  if (!watcher) {
    watcher = chokidar
      .watch(fileName)
      .on('change', () => eventEmitter.emit('rescan'))
      .on('unlink', (filename: string) => {
        eventEmitter.emit('rescan');
        includedFiles.delete(filename);
      });
  } else if (!includedFiles.has(fileName)) {
    watcher.add(fileName);
  }
  includedFiles.add(fileName);
};

// load all locale content into cache when init
export const loadLocale = () => {
  const { languages, localePath: localePaths } = pluginOptions!;
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
    fileMapping.set(localePath, fileNamespaces);
    namespaces.push(...fileNamespaces);
    localeCache.set(primaryLng!, { ...localeCache.get(primaryLng!), ...localeObj });
    // chokidar.watch(localeFilePath).on('change', () => {
    //   updateFileCache(localeFilePath);
    // });
    for (const language of languages) {
      const { code } = language;
      if (code === primaryLng) {
        continue;
      }
      const filePath = path.join(fileDirPath, `${code}.json`);
      const content = fs.readFileSync(filePath).toString('utf8');
      const obj = JSON.parse(content);
      localeCache.set(code, { ...localeCache.get(code), ...obj });
      // chokidar.watch(filePath).on('change', () => {
      //   updateFileCache(filePath);
      // });
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
    logger.warn(chalk.yellow(`Word [${text}] not found in namespace: ${ns}`));
  }
  return { notTranslated, matched };
};

/**
 * if word + ns not found in cache, then try to find word + any ns in cache, to reuse the translation
 */
export const getPossibleTranslationByWord = (text: string) => {
  const lngSource = localeCache.get(pluginOptions!.primaryLng)!;
  const ns = Object.keys(lngSource).find((_ns: string) => includedWord(Object.keys(lngSource[_ns]), text));
  if (ns) {
    return { text, ns, values: getValues(ns, text) };
  }
  return null;
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
  const fileNs = fileMapping.get(path.dirname(filePath));
  if (fileNs) {
    const oldContent = localeCache.get(code);
    for (const _ns of fileNs) {
      unset(oldContent, _ns);
    }
    localeCache.set(code, { ...oldContent, ...localeObj });
    const filteredNs = filter(namespaces, (item) => !fileNs.includes(item));
    namespaces = [...filteredNs, ...Object.keys(localeObj)];
    fileMapping.set(path.dirname(filePath), Object.keys(localeObj));
  }
};

export const isExistNs = (ns: string) => {
  if (ns === '') {
    logger.warn(chalk.yellow('namespace should not be empty string'));
  }
  return namespaces.includes(ns);
};
