import freeTranslate from '@vitalets/google-translate-api';
import { reduce } from 'lodash';
import { namespaces } from './locale-cache';
import { pluginOptions, status } from './options';
import { writeLocale } from './write-locales';

interface Word {
  text: string;
  ns: string;
  localeName: string;
}

const pendingQueue: Word[] = [];

export const addToTranslateQueue = (text: string, ns: string, localeName: string) => {
  if (!namespaces.includes(ns)) {
    console.error(`Namespace ${ns} doesn't exist in current locale files. Please manually add it.`);
    return;
  }

  const isExist = pendingQueue.some(({ ns: _ns, text: _text }) => _ns === ns && _text === text);

  if (!isExist) {
    pendingQueue.push({
      text,
      ns,
      localeName,
    });
  }
};

const freeTranslateCall = async (word: string, from: string, to: string) => {
  try {
    const timeoutPromise = new Promise((resolve, reject) => {
      setTimeout(() => {
        reject('timeout');
      }, 3000);
    });
    const result = (await Promise.race([freeTranslate(word, { from, to }), timeoutPromise])) as Awaited<
      ReturnType<typeof freeTranslate>
    >;
    return { from: word, to: result.text };
  } catch (error) {
    console.error(`Failed to translate word ${word}`, error);
    return { from: word, to: '__NOT_TRANSLATED__' };
  }
};

export const translateTask = async () => {
  if (!status.initialized) {
    return;
  }
  if (!pendingQueue.length) {
    writeLocale(null);
    return;
  }
  const { fileList, words } = pendingQueue.reduce(
    (acc, item) => {
      acc.fileList.add(item.localeName);
      acc.words.add(item.text);
      return acc;
    },
    { fileList: new Set<string>(), words: new Set<string>() },
  );
  const toLngList = pluginOptions!.languages
    .filter((lng) => lng.code !== pluginOptions?.primaryLng)
    .map((lng) => lng.code);
  const toLngFileList = pluginOptions!.languages
    .filter((lng) => lng.code !== pluginOptions?.primaryLng)
    .map((lng) => lng.localeName);
  const resultMap = new Map<string, Obj>();
  for (let i = 0; i < toLngList.length; i++) {
    const toLng = toLngList[i];

    const promises = Array.from(words).map((word) => freeTranslateCall(word, pluginOptions!.primaryLng, toLng));
    const results = await Promise.all(promises);
    const resultKVs = reduce(
      results,
      (acc, item) => {
        acc[item.from] = item.to;
        return acc;
      },
      {} as Obj,
    );
    resultMap.set(toLngFileList[i]!, resultKVs);
  }
  writeLocale(resultMap);
  pendingQueue.length = 0;
};
