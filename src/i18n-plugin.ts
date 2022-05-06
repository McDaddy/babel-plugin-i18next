// import babelParser from "@babel/parser";
// import traverse from "@babel/traverse";
// import generate from "@babel/generator";
import { isExistingWord, loadLocale } from "./locale-cache";

interface Config {
  localePath: string | string[];
  primaryLng: string;
  defaultNs?: string;
  languages: { fileName: string; code: string }[];
}

function i18nPlugin({ localePath, languages, primaryLng, defaultNs }: Config) {
  console.log("init plugin");

  if (!languages || languages.length <= 1) {
    throw new Error(
      "languages config is required and must be more than one type of language"
    );
  }
  loadLocale(localePath, languages);
  return {
    visitor: {
        CallExpression(path, state) {
            console.log('path: ', path);

        }
    }
    // async transform(code: string, id: string) {
    //   if (id.includes("node_modules")) {
    //     return;
    //   }
    //   let isTarget = false;
    //   const ast = babelParser.parse(code, { sourceType: "module" });
    //   traverse(ast, {
    //     enter(path) {
    //       if (
    //         path.node.type === "CallExpression" &&
    //         path.node.callee.type === "MemberExpression" &&
    //         path.node.callee.object.type === "Identifier" &&
    //         path.node.callee.object.name === "i18n" &&
    //         path.node.callee.property.type === "Identifier" &&
    //         path.node.callee.property.name === "s"
    //       ) {
    //         path.node.callee.property.name = "t";
    //         const textArgument = path.node.arguments[0];
    //         const nsArgument = path.node.arguments[1];
    //         if (textArgument.type === "StringLiteral") {
    //           const text = textArgument.value;
    //           const ns =
    //             nsArgument && nsArgument.type === "StringLiteral"
    //               ? nsArgument.value
    //               : defaultNs;
    //           isExistingWord(primaryLng, text, ns!);
    //         }
    //         isTarget = true;
    //       }
    //     },
    //   });

    //   if (!isTarget) {
    //     return;
    //   }
    //   const { code: _code } = generate(ast, {});
    //   return _code;
    // },
  };
}

export default i18nPlugin;
