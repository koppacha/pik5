<template>
  <div>
    <!-- Remove this component to get started! -->
    <!--    <NuxtWelcome />-->
    <q-input model-value="" v-model="names"/><br>
    <q-input model-value="" v-model="details"/><br>
    <q-btn color="black" label="送信" @click="post" />
    {{ names }}
  </div>
</template>

<script setup>
 import { ref } from 'vue';
 import {useFetch} from "nuxt/app";

 let id = 0;

 const names = ref('');
 const details = ref('');

  const post = await function (){
    return useFetch('/api/product',
        {
          method: "POST",
          body: {
            name: names,
            detail: details
          }
        });
  }

  // const { data, error } = await useFetch('/api/product');

</script>
