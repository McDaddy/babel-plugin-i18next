import fs from "fs";
import path from "path";

interface LocaleCache {
  fileMapping: { path: string; ns: string[] }[];
  content: { [key: string]: any };
}

/**
 * structure like this:
 * {
 *  'en': {
 *     'fileMapping': [{ path: 'path1', ns: ['ns1', 'ns2']}, { path: 'path2', ns: ['ns1', 'ns2']} ],
 *     'content': { 'ns1': { 'key1': 'value1' }, 'ns2': { 'key2': 'value2' } }
 *   },
 *  'zh': {
 *     'fileMapping': [{ path: 'path1', ns: ['ns1', 'ns2']}, { path: 'path2', ns: ['ns1', 'ns2']} ],
 *     'content': { 'ns1': { 'key1': 'value1' }, 'ns2': { 'key2': 'value2' } }
 *   }
 * }
 */
const localeCache = new Map<string, LocaleCache>();
const namespaces: string[] = [];

export const loadLocale = (
  localePath: string | string[],
  languages: { fileName: string; code: string }[]
) => {
  languages.forEach(({ code }) => {
    localeCache.set(code, { fileMapping: [], content: {} });
  });
  const localePaths = Array.isArray(localePath) ? localePath : [localePath];
  let parseNsDone = false;
  for (const language of languages) {
    const { code, fileName } = language;
    for (const localePath of localePaths) {
      const fileDirPath = path.isAbsolute(localePath)
        ? localePath
        : path.join(process.cwd(), localePath);
      const localeFilePath = path.join(
        fileDirPath,
        fileName.endsWith(".json") ? fileName : `${fileName}.json`
      );
      const fileContent = fs.readFileSync(localeFilePath).toString("utf8");
      const localeObj = JSON.parse(fileContent);
      const lngCache = localeCache.get(code);
      const { content } = lngCache!;
      lngCache!.content = { ...content, ...localeObj };
      const fileNamespaces = Object.keys(localeObj);
      lngCache!.fileMapping.push({
        path: localeFilePath,
        ns: fileNamespaces,
      });
      !parseNsDone && namespaces.push(...fileNamespaces);
    }
    parseNsDone = true;
  }
  const duplicateNs = namespaces.filter(
    (ns) => namespaces.indexOf(ns) !== namespaces.lastIndexOf(ns)
  );
  if (duplicateNs.length) {
    throw Error("Duplicate namespace: " + duplicateNs.join(", "));
  }
};

export const isExistingWord = (lng: string, text: string, ns: string) => {
  const { content } = localeCache.get(lng)!;
  const nsContent = content[ns];
  if (!nsContent || !nsContent[text]) {
      console.log(`word: ${text} not found in namespace: ${ns}`);
      return false;
  }
  return true;
}