import { find } from 'lodash';
import * as winston from 'winston';

const regex = new RegExp('.+(_[^_]+)+$', 'g'); // key_one_two

export const includedWord = (keyWordList: string[], k: string) => {
  if (keyWordList.includes(k)) {
    return k;
  }
  return find(keyWordList, (keyWord) => keyWord.startsWith(k) && regex.test(keyWord));
};

const { printf } = winston.format;

const customFormat = printf(({ level, message }) => {
  return `[babel-plugin-i18next][${level.toUpperCase()}]: ${message}`;
});

export const logger = winston.createLogger({
  level: 'info',
  format: customFormat,
  transports: [new winston.transports.Console()],
});
