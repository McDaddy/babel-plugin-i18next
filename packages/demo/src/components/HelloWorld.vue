<template>
  <div class="hello">
    <h1>{{ msg }}</h1>
    <div>
      <button @click="changeLanguage('en')">English</button>
      <button @click="changeLanguage('zh')">Chinese</button>
      <button @click="changeLanguage('ja')">Japanese</button>
      <button @click="changeLanguage('ko')">Korean</button>
      <button @click="changeLanguage('de')">Germany</button>
    </div>
    <div class="content">
      {{ content }}
    </div>
  </div>
</template>

<script lang="ts">
import { Options, Vue } from 'vue-class-component';
import i18n from '../common/i18n';
import { text } from '../common/utils';
console.log('utilWord: ', text);

@Options({
  props: {
    msg: String,
  },
  computed: {
    content() {
      return `${this.lang}: ${i18n.s('hello world')}`;
    },
    // plural() {
    //   return `${this.lang}: ${i18n.s('we have {{count}} goals', { count: 11 })}`;
    // },
  },
  data() {
    return { lang: 'en' };
  },
  methods: {
    changeLanguage(lang: string) {
      this.lang = lang;
      i18n.changeLanguage(lang);
    },
  },
})
export default class HelloWorld extends Vue {
  msg!: string;
  content!: string;
  plural!: string;
  // eslint-disable-next-line no-unused-vars
  changeLanguage!: (lang: string) => void;
}
</script>

<!-- Add "scoped" attribute to limit CSS to this component only -->
<style scoped>
h3 {
  margin: 40px 0 0;
}
ul {
  list-style-type: none;
  padding: 0;
}
li {
  display: inline-block;
  margin: 0 10px;
}
a {
  color: #42b983;
}
.content {
  margin-top: 20px;
}
</style>
