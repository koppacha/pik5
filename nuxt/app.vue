<template>
  <div>
    <!-- Remove this component to get started! -->
    <!--    <NuxtWelcome />-->
    名前<br>
    <q-input model-value="" v-model="names"/><br>
    <br>
    内容<br>
    <q-input model-value="" v-model="details"/><br>
    <q-btn label="Confirm" color="primary" @click="confirm = true"></q-btn>
    <q-dialog v-model="confirm" persistent>
      <q-card>
        <q-card-section class="row items-center">
          <span class="q-ml-sm">本当に送信していいですか？</span>
        </q-card-section>
        <q-card-actions align="right">
          <q-btn flat label="キャンセル" color="primary" v-close-popup></q-btn>
          <q-btn flat label="送信" color="primary" v-close-popup @click="post();refresh()"></q-btn>
        </q-card-actions>
      </q-card>
    </q-dialog>

    {{ data }}
  </div>
</template>

<script setup>
 import { ref } from 'vue';
 import {useFetch} from "nuxt/app";

 let id = 0;
 let confirm = ref(false);

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
  const { data, refresh } = useFetch('/api/product');

</script>
