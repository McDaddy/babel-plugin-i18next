<template>
  <div class="hello">
    <div>
      <button>English</button>
      <button>Chinese</button>
      <button>Japanese</button>
      <button>Korean</button>
      <button>Germany</button>
    </div>
     <div>
       {{ content}}
     </div>
  </div>
</template>

<script lang="ts">
import i18n from '../common/i18n.ts';
export default {
  name: 'HelloWorld',
  props: {
    msg: String
  },
  data() {
    return {
      content: i18n.s('hello')
    }
  }
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
</style>
