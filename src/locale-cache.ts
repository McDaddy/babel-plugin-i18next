import fs from 'fs';
import path from 'path';
import { pluginOptions } from './options';

/**
 * structure like this:
 * {
 *  'en': { 'ns1': { 'key1': 'value1' }, 'ns2': { 'key2': 'value2' } },
 *  'zh': { 'ns1': { 'key1': 'value1' }, 'ns2': { 'key2': 'value2' } }
 * }
 */
const localeCache = new Map<string, { [k: string]: Obj }>();
export const namespaces: string[] = [];
export const fileMapping: { path: string; ns: string[] }[] = [];

// load all locale content into cache when init
export const loadLocale = (localePaths: string[], languages: { localeName: string; code: string }[]) => {
  languages.forEach(({ localeName }) => {
    localeCache.set(localeName, {});
  });
  let parseNsDone = false;
  for (const language of languages) {
    const { localeName } = language;
    for (const localePath of localePaths) {
      const fileDirPath = path.isAbsolute(localePath) ? localePath : path.join(process.cwd(), localePath);
      const localeFilePath = path.join(fileDirPath, `${localeName}.json`);
      const fileContent = fs.readFileSync(localeFilePath).toString('utf8');
      const localeObj = JSON.parse(fileContent);
      localeCache.set(localeName, localeObj);
      const fileNamespaces = Object.keys(localeObj);
      fileMapping.push({
        path: localeFilePath,
        ns: fileNamespaces,
      });
      fs.watch(localeFilePath, () => {
        updateFileCache(localeFilePath);
      }) 
      if (!parseNsDone) {
        namespaces.push(...fileNamespaces);
      }
    }
    parseNsDone = true;
  }
  const duplicateNs = namespaces.filter((ns) => namespaces.indexOf(ns) !== namespaces.lastIndexOf(ns));
  if (duplicateNs.length) {
    throw Error('Duplicate namespace: ' + duplicateNs.join(', '));
  }
};

export const isExistingWord = (text: string, ns: string, alert?: boolean) => {
  const isExist = pluginOptions?.languages.every(({ localeName }) => {
    const cache = localeCache.get(localeName)!;
    const nsContent = cache[ns];
    if (nsContent && nsContent[text]) {
      return true;
    }
    return false;
  });
  if (!isExist && alert !== false) {
    console.log(`word: ${text} not found in namespace: ${ns}`);
  }
  return isExist;
};

export const getValue = (lng: string, ns: string, text: string) => {
  return localeCache.get(lng)![ns][text];
};

export const getLngCache = (lng: string) => {
  return localeCache.get(lng);
};

export const updateFileCache = (filePath: string) => {
  const fileName = path.basename(filePath);
  const localeName = fileName.split('.')[0];
  const fileContent = fs.readFileSync(filePath).toString('utf8');
  const localeObj = JSON.parse(fileContent);
  localeCache.set(localeName, { ...localeCache.get(localeName), ...localeObj }); 
}