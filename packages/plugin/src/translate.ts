import freeTranslate from '@vitalets/google-translate-api';
import chalk from 'chalk';
import fs from 'fs';
import dotenv from 'dotenv';
import { find, map, reduce, filter, some } from 'lodash';
import { googleTranslate } from './google-translate';
import { getPossibleTranslationByWord } from './locale-cache';
import { eventEmitter, pluginOptions, status } from './options';
import { logger } from './utils';
import { addExistingTranslationMap, addTranslationResult } from './write-locales';
import { youdaoTranslate } from './youdao-translate';

interface Word {
  text: string;
  ns: string;
  fileName: string;
  interpolations: string[];
}

const pendingQueue: Word[] = [];

const getInterpolationRegex = (prefix: string, suffix: string) => new RegExp(`${prefix}(.+?)${suffix}`, 'g'); // interpolations

// extract interpolations from word text
const getWordInterpolation = (text: string) => {
  const interpolationRegex = getInterpolationRegex(
    pluginOptions?.interpolation?.prefix ?? '{{',
    pluginOptions?.interpolation?.suffix ?? '}}',
  );
  let match = interpolationRegex.exec(text);
  const interpolations: string[] = [];
  while (match) {
    interpolations.push(match[0]);
    match = interpolationRegex.exec(text);
  }
  return interpolations;
};

/**
 * add not translated word to pending queue
 */
export const addToTranslateQueue = (text: string, ns: string, fileName: string) => {
  const isExist = pendingQueue.some(({ ns: _ns, text: _text }) => _ns === ns && _text === text);

  const interpolations = getWordInterpolation(text);

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
      }, 10000);
    });
    const result = (await Promise.race([
      freeTranslate(word, { from: localeMap[from] ?? from, to: localeMap[to] ?? to }),
      timeoutPromise,
    ])) as Awaited<ReturnType<typeof freeTranslate>>;
    return { from: word, to: result.text };
  } catch (error) {
    logger.error(chalk.red(`Failed to translate word ${word}`, error));
    logger.info(chalk.blue('Recommend to use Google Translate API or Youdao Translate API instead'));
    return { from: word, to: '__NOT_TRANSLATED__' };
  }
};

export const translateTask = async () => {
  if (!status.initialized || status.translating || !pendingQueue.length) {
    return;
  }
  status.translating = true;
  const currentQueue = [...pendingQueue]; // cp pendingQueue in case new word added while translating
  pendingQueue.length = 0;
  // extract all toTranslate words
  // if contains interpolations, e.g. `get {{name}}` => `get @0`
  const { words } = currentQueue.reduce<{
    words: Array<{ text: string; toTranslateText: string; interpolations?: string[] }>;
  }>(
    (acc, item) => {
      const { text, interpolations } = item;
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
    { words: [] },
  );

  const toLngList = pluginOptions!.languages
    .filter((lng) => lng.code !== pluginOptions?.primaryLng)
    .map((lng) => lng.code);
  const resultMap = new Map<string, Obj>();
  const currentTranslationMap = new Map<string, Obj>();
  let filteredWords = words;

  if (pluginOptions?.preferExistingTranslation) {
    // if existing word (just switch ns)
    filteredWords = filter(words, ({ text }) => {
      const possibleResult = getPossibleTranslationByWord(text);
      if (possibleResult && !some(possibleResult.values, (v) => v === '__NOT_TRANSLATED__')) {
        logger.info(
          chalk.green(
            `Find same keyword [${text}] at namespace ${possibleResult.ns}, will reuse it and skip translation.`,
          ),
        );
        currentTranslationMap.set(possibleResult.text, possibleResult.values);
        return false;
      }
      return true;
    });
  }

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
    filteredWords.forEach((item) => {
      const j = uniqueWords.findIndex(
        (_item) => _item.text === item.text && _item.toTranslateText === item.toTranslateText,
      );
      if (j < 0) {
        uniqueWords.push(item);
      }
    });
    const translateFunc = translateMethodMap[translateMethod];
    const promises = translateFunc(uniqueWords, fromLngCode!, toLngCode);

    // eslint-disable-next-line no-await-in-loop
    const results = await promises;
    // in order to restore interpolations
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
  if (resultMap.size) {
    addTranslationResult(resultMap);
  }
  if (currentTranslationMap.size) {
    addExistingTranslationMap(currentTranslationMap);
  }
  if (resultMap.size || currentTranslationMap.size) {
    eventEmitter.emit('rescan');
  }
  // eslint-disable-next-line require-atomic-updates
  status.translating = false;
};

const translateMethodMap = {
  free: (words: Array<{ toTranslateText: string }>, from: string, to: string) => {
    return Promise.all(words.map(({ toTranslateText }) => freeTranslateCall(toTranslateText, from, to)));
  },
  google: (words: Array<{ toTranslateText: string }>, from: string, to: string) => {
    let downgrade = false;
    const filePath = pluginOptions?.translateApi?.secretFile;
    if (!filePath || !fs.existsSync(filePath)) {
      logger.warn(chalk.yellow('secretFile is not configured for google translate API or file not exists, will downgrade to free translate'));
      downgrade = true;
    } else {
      const { parsed } = dotenv.config({ path: filePath });
      if (!parsed?.secretKey) {
        logger.warn(chalk.yellow('secretKey does not exists in secretFile, will downgrade to free translate'))
        downgrade = true;
      }
    }

    return downgrade ? translateMethodMap.free(words, from, to) : Promise.all(words.map(({ toTranslateText }) => googleTranslate(toTranslateText, from, to)));
  },
  youdao: (words: Array<{ toTranslateText: string }>, from: string, to: string) => {
    let downgrade = false;
    const filePath = pluginOptions?.translateApi?.secretFile;
    if (!filePath || !fs.existsSync(filePath)) {
      logger.warn(chalk.yellow('secretFile is not configured for google translate API or file not exists, will downgrade to free translate'));
      downgrade = true;
    } else {
      const { parsed } = dotenv.config({ path: filePath });
      if (!parsed?.secretKey || !parsed?.appKey) {
        logger.warn(chalk.yellow('secretKey or appKey does not exists in secretFile, will downgrade to free translate'));
        downgrade = true;
      }
    }

    return downgrade ? translateMethodMap.free(words, from, to) :  youdaoTranslate(map(words, 'toTranslateText'), from, to);
  },
};
