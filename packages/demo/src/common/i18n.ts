import i18next from 'i18next';

export default {
  ...i18next,
  s: (text: string, ns?: { [key: string]: any } | string, opts?: { [key: string]: any }) => text,
};
