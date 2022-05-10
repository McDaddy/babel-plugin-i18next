import crypto from 'crypto';
import fs from 'fs';
import axios from 'axios';
import path from 'path';
import dotenv from 'dotenv';
import { pluginOptions } from './options';

const localeCodeMap: Obj = {
  'zh-CN': 'zh-CHS',
  'zh-TW': 'zh-CHT',
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
  const configFilePath = pluginOptions?.translateApi?.secretFile;
  const { parsed } = dotenv.config({ path: configFilePath });

  const invokeTranslate = translate(parsed as { appKey: string; secretKey: string }, from, to);
  const result = await invokeTranslate(wordList.join('\n'));
  const translationResult = result.split('\n');
  const translatedList = wordList.reduce<Array<{ from: string; to: string }>>((acc, word, i) => {
    acc.push({ to: translationResult[i], from: word });
    return acc;
  }, []);

  console.log('translatedList: ', translatedList);
  return translatedList;
};
