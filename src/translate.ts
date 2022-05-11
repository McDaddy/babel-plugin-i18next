import freeTranslate from '@vitalets/google-translate-api';
import { reduce } from 'lodash';
import { googleTranslate } from './google-translate';
import { namespaces } from './locale-cache';
import { pluginOptions, status } from './options';
import { writeLocale } from './write-locales';
import { youdaoTranslate } from './youdao-translate';

interface Word {
  text: string;
  ns: string;
  code: string;
}

const pendingQueue: Word[] = [];

export const addToTranslateQueue = (text: string, ns: string, code: string) => {
  if (!namespaces.includes(ns)) {
    console.error(`Namespace ${ns} doesn't exist in current locale files. Please manually add it.`);
    return;
  }

  const isExist = pendingQueue.some(({ ns: _ns, text: _text }) => _ns === ns && _text === text);

  if (!isExist) {
    pendingQueue.push({
      text,
      ns,
      code,
    });
  }
};

const localeMap: Obj = {
  zh: 'zh-CN',
};

const freeTranslateCall = async (word: string, from: string, to: string) => {
  try {
    const timeoutPromise = new Promise((_resolve, reject) => {
      setTimeout(() => {
        reject('timeout');
      }, 3000);
    });
    const result = (await Promise.race([
      freeTranslate(word, { from: localeMap[from] ?? from, to: localeMap[to] ?? to }),
      timeoutPromise,
    ])) as Awaited<ReturnType<typeof freeTranslate>>;
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
      acc.fileList.add(item.code);
      acc.words.add(item.text);
      return acc;
    },
    { fileList: new Set<string>(), words: new Set<string>() },
  );
  const toLngList = pluginOptions!.languages
    .filter((lng) => lng.code !== pluginOptions?.primaryLng)
    .map((lng) => lng.code);
  const resultMap = new Map<string, Obj>();
  const translateMethod = pluginOptions?.translateApi?.type ?? 'free';
  for (let i = 0; i < toLngList.length; i++) {
    const toLng = toLngList[i];
    const fromSpecialCode = pluginOptions?.languages?.find(
      (lng) => lng.code === pluginOptions?.primaryLng!,
    )?.specialCode;
    const toSpecialCode = pluginOptions?.languages?.find((lng) => lng.code === toLng)?.specialCode;
    const fromLngCode = fromSpecialCode ?? pluginOptions?.primaryLng!;
    const toLngCode = toSpecialCode ?? toLng;
    const promises =
      translateMethod === 'free'
        ? Promise.all(Array.from(words).map((word) => freeTranslateCall(word, fromLngCode, toLngCode)))
        : translateMethod === 'google'
        ? Promise.all(Array.from(words).map((word) => googleTranslate(word, fromLngCode, toLngCode)))
        : youdaoTranslate(Array.from(words), fromLngCode, toLngCode);
    const results = await promises;
    const resultKVs = reduce(
      results,
      (acc, item) => {
        acc[item.from] = item.to;
        return acc;
      },
      {} as Obj,
    );
    resultMap.set(toLngList[i]!, resultKVs);
  }
  writeLocale(resultMap);
  pendingQueue.length = 0;
};
