import crypto from 'crypto';
import axios from 'axios';
import dotenv from 'dotenv';
import { pluginOptions } from './options';
import chalk from 'chalk';
import { forEach } from 'lodash';
import { logger } from './utils';

const localeCodeMap: Obj = {
  'zh': 'zh-CHS',
};

const truncate = (q: string) => {
  const len = q.length;
  if (len <= 20) return q;
  return `${q.substring(0, 10)}${len}${q.substring(len - 10, len)}`;
};

const translate = (config: { appKey: string; secretKey: string }, from: string, to: string) => async (q: string) => {
  const hash = crypto.createHash('sha256'); // sha256
  const { appKey, secretKey: key } = config;
  const salt = new Date().getTime();
  const curtime = Math.round(salt / 1000);
  const signStr = `${appKey}${truncate(q)}${salt}${curtime}${key}`;

  hash.update(signStr);

  const sign = hash.digest('hex');

  const res = await axios.get<{ translation: string[] }>('https://openapi.youdao.com/api', {
    params: {
      from,
      to: localeCodeMap[to] ?? to,
      q,
      appKey,
      salt,
      curtime,
      signType: 'v3',
      sign,
    },
  });
  return res.data.translation[0];
};

/**
 * translate words by youdao api
 * */
export const youdaoTranslate = async (wordList: string[], from: string, to: string) => {
  if (!wordList.length) {
    return;
  }
  const configFilePath = pluginOptions?.translateApi?.secretFile;
  const { parsed } = dotenv.config({ path: configFilePath });

  try {
    const invokeTranslate = translate(parsed as { appKey: string; secretKey: string }, from, to);
    const timeoutPromise = new Promise((_resolve, reject) => {
      setTimeout(() => {
        reject(Error('timeout'));
      }, 10000);
    });
    const result = await Promise.race([invokeTranslate(wordList.join('\n')), timeoutPromise])  as Awaited<ReturnType<typeof invokeTranslate>  >;
    const translationResult = result.split('\n');
    const translatedList = wordList.reduce<Array<{ from: string; to: string }>>((acc, word, i) => {
      acc.push({ to: translationResult[i], from: word });
      return acc;
    }, []);
  
    forEach(translatedList, ({ from: _from, to: _to }) => {
      logger.info(chalk.green(`${_from} -> ${_to}`));
    })
    return translatedList;
  } catch (error) {
    logger.error(chalk.red(`translation failed for ${wordList.join(', ')}, due to ${error}`));
    return wordList.reduce<Array<{ from: string; to: string }>>((acc, word) => {
      acc.push({ to: '__NOT_TRANSLATED__', from: word });
      return acc;
    }, []);
  }
};
