import scanner from 'i18next-scanner';
import vfs from 'vinyl-fs';
import fs from 'fs';
import path from 'path';
import { differenceWith, isEqual, unset, merge, get, find, pick, cloneDeep } from 'lodash';
import flattenObjectKeys from 'i18next-scanner/lib/flatten-object-keys';
import omitEmptyObject from 'i18next-scanner/lib/omit-empty-object';
import chalk from 'chalk';
import { localeFileNames, pluginOptions } from './options';
import { fileMapping, getLngCache, isExistingWord, namespaces } from './locale-cache';

const UN_TRANSLATE_WORD = '__NOT_TRANSLATED__';

// See options at https://github.com/i18next/i18next-scanner#options
const getOptions = (customProps: any) => {
  return {
    removeUnusedKeys: true,
    sort: true,
    func: {
      // 此配置不能改变
      list: ['i18next.t', 'i18n.t'],
      extensions: ['.js', '.jsx', '.ts', '.tsx'],
    },
    defaultValue: UN_TRANSLATE_WORD,
    resource: {
      jsonIndent: 2,
      lineEnding: '\n',
    },
    ...customProps,
    lngs: localeFileNames, // 此配置不能改变
    ns: namespaces,
    trans: false,
    keySeparator: false, // key separator if working with a flat json, it's recommended to set keySeparator to false
    defaultNs: pluginOptions?.defaultNS,
  };
};

function getCustomTransform(newTranslateSource: Map<string, Obj> | null) {
  function customTransform(file: { path: string }, enc: any, done: Function) {
    // @ts-ignore
    const { parser } = this;
    const content = fs.readFileSync(file.path, enc);

    parser.parseFuncFromString(content, { list: [`i18n.s`] }, (word: string, opts: any) => {
      // extract all i18n.s
      const namespace = opts.ns || pluginOptions?.defaultNS;

      // console.log('opts: ', opts);
      // if (opts.plurals) {
      //   console.log('opts.plurals: ', opts.plurals);
        
      // }

      if (
        isExistingWord(word, namespace, false).matched ||
        (newTranslateSource && newTranslateSource.size && get(newTranslateSource.values().next().value, word))
      ) {
        // means this word is included in the new translated list or the word is already in the old locale file
        // and it's not a comment word
        opts.defaultValue = UN_TRANSLATE_WORD;
        parser.set(word, opts);
      }
    });
    done();
  }
  return customTransform;
}

function getCustomFlush(newTranslateSource: Map<string, Obj> | null) {
  function customFlush(done: Function) {
    // @ts-ignore
    const { resStore } = this.parser;
    const { resource, removeUnusedKeys, sort } =
      // @ts-ignore
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

      // 移除废弃的key
      if (removeUnusedKeys) {
        const namespaceKeys = flattenObjectKeys(nsResource);
        const oldContentKeys = flattenObjectKeys(oldContent);
        const unusedKeys = differenceWith(oldContentKeys, namespaceKeys, isEqual);

        for (let i = 0; i < unusedKeys.length; ++i) {
          unset(oldContent, unusedKeys[i]);
        }

        oldContent = omitEmptyObject(oldContent);
      }

      // 合并旧的内容
      let output = merge(nsResource, oldContent);
      if (sort) {
        output = sortObject(output);
      }

      // 已有翻译就替换
      if (lng !== pluginOptions?.primaryLng && newTranslateSource) {
        const translatedWords = newTranslateSource.get(lng)!;
        Object.keys(output).forEach((_ns) => {
          const obj = output[_ns];
          Object.keys(obj).forEach((k) => {
            if (obj[k] === UN_TRANSLATE_WORD) {
              obj[k] = translatedWords[k] ?? UN_TRANSLATE_WORD;
            }
          });
        });
      }

      for (let i = 0; i < pluginOptions?.localePath.length!; i++) {
        const filePath = path.resolve(pluginOptions?.localePath[i]!, `${lng}.json`);
        const fileNs = find(fileMapping, ({ path: _path }) => _path === filePath);
        if (fileNs) {
          const _output = pick(output, fileNs.ns);
          const _oldContent = pick(getLngCache(lng), fileNs.ns);
          if (!Object.keys(_output).length && !Object.keys(_oldContent).length) {
            // means this locale file has no ns for this change
            continue;
          }

          if (isEqual(_oldContent, _output)) {
            // means no content changed
            continue;
          }

          fs.writeFileSync(filePath, JSON.stringify(_output, null, resource.jsonIndent), 'utf8');
          console.log(chalk.green(`Updated content to ${filePath}`));
        }
      }
    }

    done();
  }
  return customFlush;
}

export const writeLocale = async (newTranslateSource: Map<string, Obj> | null) => {
  let paths = pluginOptions?.include;
  // if (exclude.length > 0) {
  //   const excludePaths = exclude.map((p) => `!${p}${FILE_EXTENSION}`);
  //   paths = paths.concat(excludePaths);
  // }

  new Promise((resolve) => {
    vfs
      .src(paths!)
      .pipe(
        scanner(
          getOptions(pluginOptions?.customProps),
          getCustomTransform(newTranslateSource),
          getCustomFlush(newTranslateSource),
        ),
      )
      .pipe(vfs.dest('./'))
      .on('end', () => {
        resolve('');
      });
  });
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
