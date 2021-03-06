declare module '@kuimo/i18next-scanner';
declare module '@kuimo/i18next-scanner/lib/flatten-object-keys';
declare module '@kuimo/i18next-scanner/lib/omit-empty-object';

declare module '*.json' {
  const value: any;
  export default value;
}

interface Obj {
  [k: string]: string;
}
