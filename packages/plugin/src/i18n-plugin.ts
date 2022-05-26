import chalk from 'chalk';
import { CallExpression } from '@babel/types';
import { find } from 'lodash';
import * as t from '@babel/types';
import { isExistingWord, isExistNs, loadLocale, addWatchFile } from './locale-cache';
import { addToTranslateQueue } from './translate';
import { Config, status, optionChecker, pluginOptions, eventEmitter } from './options';
import { logger } from './utils';
import { addNamespace } from './write-locales';

let compileTimer: null | NodeJS.Timeout = null;

function i18nPlugin() {
  return {
    visitor: {
      Program: {
        enter() {
          if (compileTimer) {
            clearTimeout(compileTimer);
          }
          status.compiling = true;
          compileTimer = setTimeout(() => {
            status.compiling = false;
          }, 1200);
        },
      },
      CallExpression: {
        enter(path: { node: CallExpression }, state: { opts: Config; filename: string }) {
          const { node } = path;
          const { opts, filename } = state;
          if (!status.initialized) {
            // initialize plugin options
            optionChecker(opts);
          }
          const { languages, defaultNS, localePath } = pluginOptions!;
          // exclude node_modules
          if (filename.includes('node_modules')) {
            return;
          }

          // e.g. find code `i18n.s()` or `i18next.s()`
          if (
            t.isMemberExpression(node.callee) &&
            t.isIdentifier(node.callee.object) &&
            ['i18n', 'i18next'].includes(node.callee.object.name) &&
            t.isIdentifier(node.callee.property) &&
            (['s', 't'].includes(node.callee.property.name))
          ) {
            addWatchFile(filename);

            if (node.callee.property.name === 't') {
              return;
            }
            if (!status.initialized) {
              status.initialized = true;
              loadLocale(localePath, languages);
              eventEmitter.emit('rescan');
            }

            const textArgument = node.arguments[0]; // e.g. `i18n.s('hello')` it will be `hello`
            // second param could be a string or an Object
            // if it's an Object, then the third param will be ignored
            const secondArgument = node.arguments[1]; // e.g. `i18n.s('hello', 'dop')` it will be `dop` namespace, otherwise it should be empty or Object as third param
            const thirdArgument = node.arguments[2]; // e.g. `i18n.s('hello {{name}}', 'dop', { name: 'Mike' })` it will be `{ name: 'Mike' }`
            if (t.isStringLiteral(textArgument)) {
              const text = textArgument.value;
              if (!text) {
                return;
              }
              let ns = defaultNS; // if second param is not string and third param doesn't provide ns property, then use defaultNS
              if (t.isObjectExpression(secondArgument)) {
                // pass options directly, also means there is no third param
                const nsProperty = find(
                  secondArgument.properties,
                  (property) => t.isProperty(property) && t.isIdentifier(property.key) && property.key.name === 'ns',
                );
                if (nsProperty && t.isProperty(nsProperty) && t.isStringLiteral(nsProperty.value)) {
                  ns = nsProperty.value!.value;
                }
              } else if (t.isStringLiteral(secondArgument)) {
                // means its string value in second param, this is ns input
                ns = secondArgument.value;
                if (t.isObjectExpression(thirdArgument)) {
                  thirdArgument.properties.push(t.objectProperty(t.identifier('ns'), t.stringLiteral(ns)));
                  // move third opts param to second
                  node.arguments[1] = thirdArgument;
                } else {
                  // if third param is not object, then create a new object with ns property
                  node.arguments[1] = t.objectExpression([t.objectProperty(t.identifier('ns'), t.stringLiteral(ns))]);
                }
              } else {
                // if only first text param is passed, then need manually create second param
                node.arguments[1] = t.objectExpression([t.objectProperty(t.identifier('ns'), t.stringLiteral(ns))]);
              }
              if (t.isObjectExpression(node.arguments[1])) {
                node.arguments[1].properties.push(t.objectProperty(t.identifier('nsSeparator'), t.booleanLiteral(false)));
              }

              node.arguments.splice(2, 1); // remove third param if needed

              // check if this is existing namespace
              const isExistingNs = isExistNs(ns);

              if (isExistingNs) {
                const { matched, notTranslated } = isExistingWord(text, ns);
                if (!matched || notTranslated) {
                  if (process.env.NODE_ENV === 'production') {
                    // throw error when not found translation in production
                    throw new Error(
                      !matched
                        ? `Can't find translation for ${text} with namespace ${ns}`
                        : `Word ${text} with namespace ${ns} is not translated`,
                    );
                  }
                  addToTranslateQueue(text, ns, filename);
                }
              } else {
                if (process.env.NODE_ENV === 'production') {
                  throw new Error(`Can't find namespace ${ns}`);
                }
                logger.warn(chalk.red(`Can't find namespace ${ns}, will create it at ${localePath[0]}`));
                addNamespace(ns, localePath[0]);
                addToTranslateQueue(text, ns, filename);
              }
              
              node.callee.property.name = 't'; // i18n.s => i18n.t
            }
          }
        },
      },
    },
  };
}

export default i18nPlugin;
