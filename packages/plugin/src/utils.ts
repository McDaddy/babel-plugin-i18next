import { find } from "lodash";

const regex = new RegExp('.+(_[^_]+)+$', 'g'); // key_one_two

export const includedWord = (keyWordList: string[], k: string) => {
  if (keyWordList.includes(k)) {
    return k;
  }
  return find(keyWordList, (keyWord) => (keyWord.startsWith(k) && regex.test(keyWord)));
};

export const log = (content: string) => {
  // eslint-disable-next-line no-console
  console.log(content);
}