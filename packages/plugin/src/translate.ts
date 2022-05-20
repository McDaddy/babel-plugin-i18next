import freeTranslate from '@vitalets/google-translate-api';
import chalk from 'chalk';
import { find, map, reduce } from 'lodash';
import { googleTranslate } from './google-translate';
import { eventEmitter, pluginOptions, status } from './options';
import { log } from './utils';
import { writeLocale } from './write-locales';
import { youdaoTranslate } from './youdao-translate';

interface Word {
  text: string;
  ns: string;
  fileName: string;
  interpolations: string[];
}

const pendingQueue: Word[] = [];
let inProgress = false;

export const addToTranslateQueue = (text: string, ns: string, fileName: string, interpolations: string[]) => {
  const isExist = pendingQueue.some(({ ns: _ns, text: _text }) => _ns === ns && _text === text);

  if (!isExist) {
    pendingQueue.push({
      text,
      ns,
      fileName,
      interpolations,
    });
    eventEmitter.emit('translation');
  }
};

const localeMap: Obj = {
  zh: 'zh-CN',
};

const freeTranslateCall = async (word: string, from: string, to: string) => {
  try {
    const timeoutPromise = new Promise((_resolve, reject) => {
      setTimeout(() => {
        reject(Error('timeout'));
      }, 3000);
    });
    const result = (await Promise.race([
      freeTranslate(word, { from: localeMap[from] ?? from, to: localeMap[to] ?? to }),
      timeoutPromise,
    ])) as Awaited<ReturnType<typeof freeTranslate>>;
    return { from: word, to: result.text };
  } catch (error) {
    log(chalk.red(`Failed to translate word ${word}`, error));
    return { from: word, to: '__NOT_TRANSLATED__' };
  }
};

export const translateTask = async () => {
  if (!status.initialized || inProgress || !pendingQueue.length) {
    return;
  }
  inProgress = true;
  const currentQueue = [...pendingQueue]; // cp pendingQueue in case new word added while translating
  pendingQueue.length = 0;
  const { words } = currentQueue.reduce<{
    fileList: Set<string>;
    words: Array<{ text: string; toTranslateText: string; interpolations?: string[] }>;
  }>(
    (acc, item) => {
      const { fileName, text, interpolations } = item;
      acc.fileList.add(fileName);
      if (interpolations) {
        let toTranslateText = text;
        for (let i = 0; i < interpolations.length; i++) {
          const interpolation = interpolations[i];
          toTranslateText = toTranslateText.replace(interpolation, `@${i}`);
        }
        acc.words.push({ text, toTranslateText, interpolations });
      } else {
        acc.words.push({ text, toTranslateText: text });
      }
      return acc;
    },
    { fileList: new Set<string>(), words: [] },
  );

  const toLngList = pluginOptions!.languages
    .filter((lng) => lng.code !== pluginOptions?.primaryLng)
    .map((lng) => lng.code);
  const resultMap = new Map<string, Obj>();
  const translateMethod = pluginOptions?.translateApi?.type ?? 'free';
  for (let i = 0; i < toLngList.length; i++) {
    const toLng = toLngList[i];
    const fromSpecialCode = pluginOptions?.languages?.find(
      (lng) => lng.code === pluginOptions?.primaryLng,
    )?.specialCode;
    const toSpecialCode = pluginOptions?.languages?.find((lng) => lng.code === toLng)?.specialCode;
    const fromLngCode = fromSpecialCode ?? pluginOptions?.primaryLng;
    const toLngCode = toSpecialCode ?? toLng;
    const uniqueWords: Array<{ text: string; toTranslateText: string; interpolations?: string[] }> = [];
    words.filter((item) => {
      const j = uniqueWords.findIndex(
        (_item) => _item.text === item.text && _item.toTranslateText === item.toTranslateText,
      );
      if (j < 0) {
        uniqueWords.push(item);
      }
      return null;
    });
    const promises =
      translateMethod === 'free'
        ? Promise.all(
            uniqueWords.map(({ toTranslateText }) => freeTranslateCall(toTranslateText, fromLngCode!, toLngCode)),
          )
        : translateMethod === 'google'
        ? Promise.all(
            uniqueWords.map(({ toTranslateText }) => googleTranslate(toTranslateText, fromLngCode!, toLngCode)),
          )
        : youdaoTranslate(map(uniqueWords, 'toTranslateText'), fromLngCode!, toLngCode);
    // eslint-disable-next-line no-await-in-loop
    const results = await promises;
    const resultKVs = reduce(
      results,
      (acc, item) => {
        const _word = find(uniqueWords, ({ toTranslateText }) => toTranslateText === item.from);
        if (_word?.interpolations) {
          for (let x = 0; x < _word?.interpolations.length; x++) {
            const interpolation = _word?.interpolations[x];
            // eslint-disable-next-line no-param-reassign
            item.to = item.to.replace(`@${x}`, interpolation);
          }
        }
        acc[_word!.text] = item.to;
        return acc;
      },
      {} as Obj,
    );
    resultMap.set(toLngList[i]!, resultKVs);
  }
  await writeLocale(resultMap);
  // eslint-disable-next-line require-atomic-updates
  inProgress = false;
};
