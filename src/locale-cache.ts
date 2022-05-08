import fs from 'fs';
import path from 'path';
import { pluginOptions } from './options';

/**
 * structure like this:
 * {
 *  'en': {
 *     'fileMapping': [{ path: 'path1', ns: ['ns1', 'ns2']}, { path: 'path2', ns: ['ns3', 'ns4']} ],
 *     'content': { 'ns1': { 'key1': 'value1' }, 'ns2': { 'key2': 'value2' } }
 *   },
 *  'zh': {
 *     'fileMapping': [{ path: 'path1', ns: ['ns1', 'ns2']}, { path: 'path2', ns: ['ns3', 'ns4']} ],
 *     'content': { 'ns1': { 'key1': 'value1' }, 'ns2': { 'key2': 'value2' } }
 *   }
 * }
 */
const localeCache = new Map<string, { [k: string]: Obj }>();
export const namespaces: string[] = [];
export const fileMapping: { path: string; ns: string[] }[] = [];

export const loadLocale = (localePaths: string[], languages: { fileName: string; code: string }[]) => {
  languages.forEach(({ fileName }) => {
    localeCache.set(fileName, {});
  });
  let parseNsDone = false;
  for (const language of languages) {
    const { fileName } = language;
    for (const localePath of localePaths) {
      const fileDirPath = path.isAbsolute(localePath) ? localePath : path.join(process.cwd(), localePath);
      const localeFilePath = path.join(fileDirPath, `${fileName}.json`);
      const fileContent = fs.readFileSync(localeFilePath).toString('utf8');
      const localeObj = JSON.parse(fileContent);
      const lngCache = localeCache.get(fileName);
      localeCache.set(fileName, { ...lngCache, ...localeObj });
      const fileNamespaces = Object.keys(localeObj);
      fileMapping.push({
        path: localeFilePath,
        ns: fileNamespaces,
      });
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
  const isExist = pluginOptions?.languages.every(({ fileName }) => {
    const cache = localeCache.get(fileName)!;
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

export const setLngCache = (lng: string, value: { [key: string]: Obj }) => {
  localeCache.set(lng, value);
};
