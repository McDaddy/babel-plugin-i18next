import chalk from 'chalk';
import { pluginOptions } from './options';
import dotenv from 'dotenv';
import { log } from './utils';

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
      }, 3000);
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
    log(chalk.green(`[translation]: ${word} -> ${result}`));
    return { from: word, to: result };
  } catch (error) {
    log(chalk.red(`[translation failed]: ${word}, due to ${error}`));
    throw error;
  }
};
