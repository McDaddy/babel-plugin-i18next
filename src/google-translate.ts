import chalk from 'chalk';
import { pluginOptions } from './options';
import dotenv from 'dotenv';

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
        reject('timeout');
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
    console.log(chalk.green(`[translation]: ${word} -> ${result}`));
    return { from: word, to: result };
  } catch (error) {
    console.log(chalk.red(`[translation failed]: ${word}, due to ${error}`));
    throw error;
  }
};
