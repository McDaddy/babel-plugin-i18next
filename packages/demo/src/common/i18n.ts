import i18next from 'i18next';

const s = (...args: any) => {
  return ''
}

export default { s, t: i18next.t, init: i18next.init, changeLanguage: i18next.changeLanguage };