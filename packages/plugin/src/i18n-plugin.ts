import { isExistingWord, isExistNs, loadLocale, addNamespaceCache } from './locale-cache';
import { CallExpression } from '@babel/types';
import * as t from '@babel/types';
import { addToTranslateQueue } from './translate';
import { Config, status, optionChecker, pluginOptions } from './options';
import { find } from 'lodash';
import { log } from './utils';
import chalk from 'chalk';
import { addNamespace } from './write-locales';

const getInterpolationRegex = (prefix: string, suffix: string) => new RegExp(`${prefix}(.+?)${suffix}`, 'g'); // interpolations

function i18nPlugin() {
  return {
    visitor: {
      CallExpression: {
        enter(path: { node: CallExpression }, state: { opts: Config; filename: string }) {
          const { node } = path;
          const { opts, filename } = state;
          if (!status.initialized) {
            optionChecker(opts);
          }
          const { languages, defaultNS, localePath } = pluginOptions!;
          if (filename.includes('node_modules')) {
            return;
          }

          if (
            t.isMemberExpression(node.callee) &&
            t.isIdentifier(node.callee.object) &&
            node.callee.object.name === 'i18n' &&
            t.isIdentifier(node.callee.property) &&
            node.callee.property.name === 's'
          ) {
            if (!status.initialized) {
              status.initialized = true;
              loadLocale(localePath, languages);
            }

            const textArgument = node.arguments[0];
            const secondArgument = node.arguments[1];
            const thirdArgument = node.arguments[2];
            if (t.isStringLiteral(textArgument)) {
              const text = textArgument.value;
              if (!text) {
                return;
              }
              let ns = defaultNS;
              // means its default ns, pass options directly
              if (t.isObjectExpression(secondArgument)) {
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
              }

              if (thirdArgument && t.isObjectExpression(thirdArgument)) {
                thirdArgument.properties.push(t.objectProperty(t.identifier('ns'), t.stringLiteral(ns)));
                // move third opts param to second
                node.arguments[1] = thirdArgument;
              }

              const isExistingNs = isExistNs(ns);

              if (isExistingNs) {
                const { matched, notTranslated } = isExistingWord(text, ns);
                if (!matched || notTranslated) {
                  if (process.env.NODE_ENV === 'production') {
                    throw new Error(
                      !matched
                        ? `Can't find translation for ${text} with namespace ${ns}`
                        : `Word ${text} with namespace ${ns} is not translated`,
                    );
                  }
                  const interpolations = checkWordInterpolation(text);
                  addToTranslateQueue(text, ns, filename, interpolations);
                }
              } else {
                if (process.env.NODE_ENV === 'production') {
                  throw new Error(`Can't find namespace ${ns}`);
                }
                log(chalk.red(`Can't find namespace ${ns}, will create it at ${localePath[0]}`));
                addNamespace(ns, localePath[0]);
                addNamespaceCache(ns, localePath[0]);
                const interpolations = checkWordInterpolation(text);
                addToTranslateQueue(text, ns, filename, interpolations);
              }
            }
            node.callee.property.name = 't';
          }
        },
      },
    },
  };
}

const checkWordInterpolation = (text: string) => {
  const interpolationRegex = getInterpolationRegex(
    pluginOptions?.interpolation?.prefix ?? '{{',
    pluginOptions?.interpolation?.suffix ?? '}}',
  );
  let match = interpolationRegex.exec(text);
  const interpolations: string[] = [];
  while (match) {
    interpolations.push(match[0]);
    match = interpolationRegex.exec(text);
  }
  return interpolations;
}

export default i18nPlugin;
