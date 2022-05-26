import chalk from 'chalk';
import { pluginOptions } from './options';
import dotenv from 'dotenv';
import { logger } from './utils';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const translate = require('translate');

export const googleTranslate = async (word: string, from: string, to: string) => {
  const filePath = pluginOptions?.translateApi?.secretFile;
  const { parsed } = dotenv.config({ path: filePath });

  if (!parsed?.secretKey) {
    throw new Error(`secretKey is not defined in translate api file ${filePath}`);
  }
  try {
    const timeoutPromise = new Promise((_resolve, reject) => {
      setTimeout(() => {
        reject(Error('timeout'));
      }, 10000);
    });
    const result = await Promise.race([
      translate(word, {
        from,
        to,
        engine: 'google',
        key: parsed.secretKey,
      }),
      timeoutPromise,
    ]);
    logger.info(chalk.green(`${word} -> ${result}`));
    return { from: word, to: result };
  } catch (error) {
    logger.error(chalk.red(`translation failed for ${word}, due to ${error}`));
    return { from: word, to: '__NOT_TRANSLATED__' };
  }
};
