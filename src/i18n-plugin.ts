import { isExistingWord, loadLocale } from './locale-cache';
import { CallExpression } from '@babel/types';
import * as t from '@babel/types';
import { addToTranslateQueue } from './translate';
import { Config, status, optionChecker, pluginOptions } from './options';
import { find } from 'lodash';

function i18nPlugin() {
  return {
    visitor: {
      CallExpression: {
        enter(path: { node: CallExpression }, state: { opts: Config; filename: string }) {
          const { node } = path;
          const { opts, filename } = state;
          optionChecker(opts);
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
              loadLocale(localePath, languages);
            }
            status.initialized = true;
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
              if (!isExistingWord(text, ns)) {
                if (process.env.NODE_ENV === 'production') {
                  throw new Error(`Can't find translation for ${text} with namespace ${ns}`);
                }
                addToTranslateQueue(text, ns, filename);
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
