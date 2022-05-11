import chalk from 'chalk';
import { pluginOptions } from './options';
import dotenv from 'dotenv';

const translate = require('translate');

export const googleTranslate = async (word: string, from: string, to: string) => {
  try {
    const filePath = pluginOptions?.translateApi?.secretFile;
    const { parsed } = dotenv.config({ path: filePath });

    if (!parsed?.secretKey) {
      throw new Error(`secretKey is not defined in translate api file ${filePath}`);
    }

    const result = await translate(word, {
      from,
      to,
      engine: 'google',
      key: parsed.secretKey,
    });
    console.log(chalk.green(`translate ${word} -> ${result}`));
    return { from: word, to: result };
  } catch (error) {
    console.log(chalk.red(`Failed to translate word ${word}: ${error}`));
    throw error;
  }
};
