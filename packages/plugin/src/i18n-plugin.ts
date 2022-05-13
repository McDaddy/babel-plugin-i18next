import { isExistingWord, loadLocale } from './locale-cache';
import { CallExpression } from '@babel/types';
import * as t from '@babel/types';
import { addToTranslateQueue } from './translate';
import { Config, status, optionChecker, pluginOptions } from './options';
import { find } from 'lodash';

const holderRegex = new RegExp('\{(.+?)\}', 'g');

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
            const optsArgument = node.arguments[1];
            if (t.isStringLiteral(textArgument)) {
              const text = textArgument.value;
              if (!text) {
                return;
              }
              let ns = defaultNS;
              if (t.isObjectExpression(optsArgument)) {
                const nsProperty = find(
                  optsArgument.properties,
                  (property) => t.isProperty(property) && t.isIdentifier(property.key) && property.key.name === 'ns',
                );
                if (nsProperty && t.isProperty(nsProperty) && t.isStringLiteral(nsProperty.value)) {
                  ns = nsProperty.value!.value;
                }
              }
              const { matched, notTranslated } = isExistingWord(text, ns);
              if (!matched || notTranslated) {
                if (process.env.NODE_ENV === 'production') {
                  throw new Error(!matched ? `Can't find translation for ${text} with namespace ${ns}` : `Word ${text} with namespace ${ns} is not translated`);
                }
                let match = holderRegex.exec(text);
                const interpolations: string[] = [];
                while(match) {
                  interpolations.push(match[0]);
                  match = holderRegex.exec(text);
                }
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

export default i18nPlugin;