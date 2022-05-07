import freeTranslate from "@vitalets/google-translate-api";
import { reduce } from "lodash";
import { namespaces } from "./locale-cache";
import { pluginOptions } from "./options";
import { writeLocale } from './write-locales';

interface Word {
  text: string;
  ns: string;
  fileName: string;
}

const pendingQueue: Word[] = [];

export const addToTranslateQueue = (
  text: string,
  ns: string,
  fileName: string
) => {
  if (!namespaces.includes(ns)) {
    console.error(`Namespace ${ns} doesn't exist in current locale files. Please manually add it.`);
    return;
  }

  const isExist = pendingQueue.some(
    ({ ns, text }) => ns === ns && text === text
  );

  if (!isExist) {
    pendingQueue.push({
      text,
      ns,
      fileName,
    });
  }
};

const freeTranslateCall = async (word: string, from: string, to: string) => {
  try {
    const result = await freeTranslate(word, { from, to });
    return { from: word, to: result.text };
  } catch (error) {
    console.error(`Failed to translate word ${word}`, error);
    return { from: word, to: "__NOT_TRANSLATED__" };
  }
};

export const translateTask = async () => {
  if (!pendingQueue.length) {
    return;
  }
  const { fileList, words } = pendingQueue.reduce(
    (acc, item) => {
      acc.fileList.add(item.fileName);
      acc.words.add(item.text);
      return acc;
    },
    { fileList: new Set<string>(), words: new Set<string>() }
  );
  const toLngList = pluginOptions!.languages
    .filter((lng) => lng.code !== pluginOptions?.primaryLng)
    .map((lng) => lng.code);
  const toLngFileList = pluginOptions!.languages
    .filter((lng) => lng.code !== pluginOptions?.primaryLng)
    .map((lng) => lng.fileName);
  const resultMap = new Map<string, Obj>();
  for (let i = 0; i < toLngList.length; i++) {
    const toLng = toLngList[i];
    
    const promises = Array.from(words).map((word) =>
      freeTranslateCall(word, pluginOptions!.primaryLng, toLng)
    );
    const results = await Promise.all(promises);
    const resultKVs = reduce(results, (acc, item) =>{
      acc[item.from] = item.to;
      return acc;
    }, {} as Obj)
    resultMap.set(toLngFileList[i]!, resultKVs)
  }
  writeLocale(resultMap);
  pendingQueue.length = 0;
};
