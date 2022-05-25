/* eslint-disable no-param-reassign */
import scanner from '@kuimo/i18next-scanner';
import vfs from 'vinyl-fs';
import fs from 'fs';
import path from 'path';
import { differenceWith, isEqual, unset, merge, get, find, pick, cloneDeep, map } from 'lodash';
import flattenObjectKeys from '@kuimo/i18next-scanner/lib/flatten-object-keys';
import omitEmptyObject from '@kuimo/i18next-scanner/lib/omit-empty-object';
import chalk from 'chalk';
import { localeFileNames, pluginOptions } from './options';
import { fileMapping, getLngCache, includedFiles, isExistingWord, namespaces } from './locale-cache';
import { log } from './utils';

const UN_TRANSLATE_WORD = '__NOT_TRANSLATED__';

const translationMap = new Map<string, Obj>(); // { en: { hello: hello } }
let existingTranslationMap = new Map<string, Obj>(); // { hello: { en: hello } }

export const addTranslationResult = (resultMap: Map<string, Obj>) => {
  for (const key of resultMap.keys()) {
    translationMap.set(key, { ...translationMap.get(key), ...resultMap.get(key) });
  }
}

export const addExistingTranslationMap = (currentTranslationMap:  Map<string, Obj>) => {
  existingTranslationMap = new Map([...existingTranslationMap, ...currentTranslationMap]);
}

// See options at https://github.com/i18next/i18next-scanner#options
const getOptions = (customProps: any) => {
  return {
    removeUnusedKeys: true,
    sort: true,
    func: {
      list: ['i18next.t', 'i18n.t'],
      extensions: ['.js', '.jsx', '.ts', '.tsx', '.vue'],
    },
    defaultValue: UN_TRANSLATE_WORD,
    resource: {
      jsonIndent: 2,
      lineEnding: '\n',
    },
    ...customProps,
    lngs: localeFileNames,
    ns: namespaces,
    trans: false,
    keySeparator: false, // key separator if working with a flat json, it's recommended to set keySeparator to false
    defaultNs: pluginOptions?.defaultNS,
  };
};

function customTransform(file: { path: string }, enc: any, done: Function) {
  // @ts-ignore this
  const { parser } = this;
  const content = fs.readFileSync(file.path, enc);
  
  parser.parseFuncFromString(content, { list: ['i18n.s', 'i18next.s'] }, (word: string, opts: any) => {
    // extract all i18n.s
    const namespace = opts.ns || pluginOptions?.defaultNS;
    
    if (
      isExistingWord(word, namespace, false).matched ||
      (translationMap.size && get(translationMap.values().next().value, word)) ||
      (existingTranslationMap.has(word))
    ) {
      // means this word is included in the new translated list or the word is already in the old locale file
      // and it's not a comment word
      opts.defaultValue = UN_TRANSLATE_WORD;
      parser.set(word, { ...opts, nsSeparator: false });
    }
  });
  done();
}

function customFlush(done: Function) {
  // @ts-ignore this
  const { resStore } = this.parser;
  const { resource, removeUnusedKeys, sort } =
    // @ts-ignore this
    this.parser.options;

  for (let index = 0; index < Object.keys(resStore).length; index++) {
    const lng = Object.keys(resStore)[index];
    // contains all keys with untranslated values
    const nsResource = resStore[lng]; // 所有被抠出来的英文key，对应的都是__not_translated，需要跟后面的source合并

    let oldContent = cloneDeep(getLngCache(lng));

    // 未翻译的英文的value和key保持一致
    if (lng === pluginOptions?.primaryLng) {
      Object.keys(nsResource).forEach((_ns) => {
        const obj = nsResource[_ns];
        const oldNsValues = oldContent![_ns];
        Object.keys(obj).forEach((k) => {
          if (obj[k] === UN_TRANSLATE_WORD) {
            obj[k] = oldNsValues[k] ?? k;
          }
        });
      });
    }

    // remove unused keys
    if (removeUnusedKeys) {
      const namespaceKeys = flattenObjectKeys(nsResource);
      const oldContentKeys = flattenObjectKeys(oldContent);
      const unusedKeys = differenceWith(oldContentKeys, namespaceKeys, isEqual);

      for (let i = 0; i < unusedKeys.length; ++i) {
        unset(oldContent, unusedKeys[i]);
      }

      oldContent = omitEmptyObject(oldContent);
    }

    // merge old contents
    let output = merge(nsResource, oldContent);
    if (sort) {
      output = sortObject(output);
    }

    // if new translations exist, then merge it
    if (lng !== pluginOptions?.primaryLng && translationMap.size) {
      const translatedWords = translationMap.get(lng)!;
      const newTranslationKeys = Object.keys(translatedWords);
      Object.keys(output).forEach((_ns) => {
        const obj = output[_ns];
        Object.keys(obj).forEach((k) => {
          if (obj[k] === UN_TRANSLATE_WORD) {
            const regex = new RegExp('.+(_[^_]+)+$', 'g');
            const possibleKey = find(newTranslationKeys, (keyWord) => k.startsWith(keyWord) && regex.test(k));
            obj[k] = translatedWords[possibleKey ?? k] ?? UN_TRANSLATE_WORD;
          }
        });
      });
    }

    // if there is translation in other ns, the replace it
    if (lng !== pluginOptions?.primaryLng && existingTranslationMap.size) {
      existingTranslationMap.forEach((values, key) => {
        Object.keys(output).forEach((_ns) => {
          const obj = output[_ns];
          Object.keys(obj).forEach((k) => {
            if (obj[k] === UN_TRANSLATE_WORD && key === k) {
              obj[k] = values[lng];
            }
          });
        });
      });
    }

    // write locales by path one by one
    for (let i = 0; i < pluginOptions!.localePath.length; i++) {
      const localePath = pluginOptions!.localePath[i];
      const fileNs = fileMapping.get(localePath);
      const filePath = path.resolve(localePath, `${lng}.json`);
      if (fileNs) {
        const _output = omitEmptyObject(pick(output, fileNs));
        const _oldContent = pick(getLngCache(lng), fileNs);
        if (!Object.keys(_output).length && !Object.keys(_oldContent).length) {
          // means this locale file has no ns for this change
          continue;
        }

        if (isEqual(_oldContent, _output)) {
          // means no content changed
          continue;
        }

        fs.writeFileSync(filePath, JSON.stringify(_output, null, resource.jsonIndent), 'utf8');
        log(chalk.green(`locale content updated: ${filePath}`));
      }
    }
  }
  done();
}

export const writeLocale = async () => {
  if (process.env.NODE_ENV === 'production') {
    return;
  }
  const paths = Array.from(includedFiles);

  Promise.resolve(
    new Promise((resolve: Function) => {
      vfs
        .src(paths!)
        .pipe(
          scanner(
            getOptions(pluginOptions?.customProps),
            customTransform,
            customFlush,
          ),
        )
        .pipe(vfs.dest('./'))
        .on('end', () => {
          existingTranslationMap.clear();
          translationMap.clear();
          resolve('');
        });
    }),
  );
};

function sortObject(unordered: { [k: string]: Obj } | Obj) {
  const ordered: { [k: string]: Obj } | Obj = {};
  Object.keys(unordered)
    .sort()
    .forEach((key) => {
      if (typeof unordered[key] === 'object') {
        (ordered as { [k: string]: Obj })[key] = sortObject(unordered[key] as Obj) as Obj;
      } else {
        ordered[key] = unordered[key];
      }
    });
  return ordered;
}

// add an empty ns
export const addNamespace = (ns: string, localePath: string) => {
  const codes = map(pluginOptions?.languages, 'code');
  for (let j = 0; j < codes.length; j++) {
    const filePath = path.resolve(localePath, `${codes[j]}.json`);
    const fileContent = fs.readFileSync(filePath, 'utf8');
    const fileObj = JSON.parse(fileContent);
    fs.writeFileSync(filePath, JSON.stringify({ ...fileObj, ...{ [ns]: {} } }, null, 2), 'utf8');
  }
};
