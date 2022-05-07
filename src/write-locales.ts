import scanner from "i18next-scanner";
import vfs from "vinyl-fs";
import fs from "fs";
import path from "path";
import { differenceWith, isEqual, unset, merge, invert, get, map, find, pick } from "lodash";
import flattenObjectKeys from "i18next-scanner/lib/flatten-object-keys";
import omitEmptyObject from "i18next-scanner/lib/omit-empty-object";
import chalk from "chalk";
import { localeFileNames, pluginOptions } from "./options";
import { fileMapping, getLngCache, getValue, isExistingWord, namespaces, setLngCache } from "./locale-cache";

// See options at https://github.com/i18next/i18next-scanner#options
const getOptions = (customProps: any) => {
  return {
    removeUnusedKeys: true,
    sort: true,
    func: {
      // 此配置不能改变
      list: ["i18next.t", "i18n.t"],
      extensions: [".js", ".jsx", ".ts", ".tsx"],
    },
    defaultValue: "__NOT_TRANSLATED__",
    resource: {
      jsonIndent: 2,
      lineEnding: "\n",
    },
    ...customProps,
    lngs: localeFileNames, // 此配置不能改变
    ns: namespaces,
    trans: false,
    keySeparator: false, // key separator if working with a flat json, it's recommended to set keySeparator to false
    defaultNs: pluginOptions?.defaultNS,
  };
};

function customTransform(file: { path: string }, enc: any, done: Function) {
  // @ts-ignore
  const { parser } = this;
  const content = fs.readFileSync(file.path, enc);

  parser.parseFuncFromString(
    content,
    { list: [`i18n.s`] },
    (word: string, opts: any) => {
      // extract all i18n.s
      const namespace = opts.ns || pluginOptions?.defaultNS;
      if (isExistingWord(pluginOptions!.primaryLng, word, namespace, false)) { // TODO
        // enValue 存在说明这个中文的翻译存在于老的资源或者这次翻译的结果， 否则这就是一段被注释的代码， 不需要加入
        opts.defaultValue = '__NOT_TRANSLATED__';
        parser.set(word, opts);
      }
    }
  );
  done();
}

function getCustomFlush(newTranslateSource: Map<string, Obj>) {
  function customFlush(done: Function) {
    // @ts-ignore
    const { resStore } = this.parser;
    // @ts-ignore
    const { resource, removeUnusedKeys, sort, defaultValue } = this.parser.options;
  
    for (let index = 0; index < Object.keys(resStore).length; index++) {
      const lng = Object.keys(resStore)[index];
      const nsResource = resStore[lng]; // 所有被抠出来的英文key，对应的都是__not_translated，需要跟后面的source合并
      // 未翻译的英文的value和key保持一致
      if (lng === pluginOptions?.primaryLng) {
        Object.keys(nsResource).forEach((_ns) => {
          const obj = nsResource[_ns];
          Object.keys(obj).forEach((k) => {
            if (obj[k] === defaultValue) {
              obj[k] = k.replace('&#58;', ':'); // 转义冒号，免得和分割符冲突
            }
          });
        });
      }
  
      let oldContent = getLngCache(lng);
  
      // 移除废弃的key
      if (removeUnusedKeys) {
        const oldContentKeys = flattenObjectKeys(oldContent);
        const unusedKeys = differenceWith(
          oldContentKeys,
          namespaces,
          isEqual,
        );
  
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
      if (lng !== pluginOptions?.primaryLng) {
        const translatedWords = newTranslateSource.get(lng)!;
        Object.keys(output).forEach((_ns) => {
          const obj = output[_ns];
          Object.keys(obj).forEach((k) => {
            if (obj[k] === defaultValue) {
              obj[k] = translatedWords[k];
            }
          });
        });
      }
  
      if (isEqual(oldContent, output) && (index + 1) === Object.keys(resStore).length) {
        console.log(chalk.yellow('locale内容无改动...'));
        done();
        return;
      }

      for (let i = 0; i < pluginOptions?.localePath.length!; i++) {
        const filePath = path.resolve(pluginOptions?.localePath[i]! , `${lng}.json`);
        const fileNs = find(fileMapping, ({ path: _path }) =>  _path === filePath);
        if (fileNs) {
          const _output = pick(output, fileNs.ns)
          fs.writeFileSync(filePath, JSON.stringify(_output, null, resource.jsonIndent), 'utf8');
        }
      }
      setLngCache(lng, output);
    }
    console.log(chalk.green('完成写入locale文件...'));
  
    done();
  }
  return customFlush;
}



const FILE_EXTENSION = "/**/*.{ts,tsx}";

export const writeLocale = async (
  newTranslateSource: Map<string, Obj>
) => {
  let paths = [`${process.cwd()}${FILE_EXTENSION}`];
  // if (include) {
  //   paths = include.map((p) => `${p}${FILE_EXTENSION}`);
  // }
  // if (exclude.length > 0) {
  //   const excludePaths = exclude.map((p) => `!${p}${FILE_EXTENSION}`);
  //   paths = paths.concat(excludePaths);
  // }

  new Promise((resolve) => {
    //   vfs.src(paths)
    vfs
      .src([`${process.cwd()}/app/App-vite.tsx`])
      .pipe(scanner(getOptions(pluginOptions?.customProps), customTransform, getCustomFlush(newTranslateSource)))
      .pipe(vfs.dest("./"))
      .on("end", () => {
        resolve("");
      });
  });

};


function sortObject(unordered: { [k:string] : Obj } | Obj) {
  const ordered: { [k:string] : Obj } | Obj = {};
  Object.keys(unordered)
    .sort()
    .forEach((key) => {
      if (typeof unordered[key] === 'object') {
        (ordered as { [k:string] : Obj })[key] = sortObject(unordered[key] as Obj) as Obj;
      } else {
        ordered[key] = unordered[key];
      }
    });
  return ordered;
}