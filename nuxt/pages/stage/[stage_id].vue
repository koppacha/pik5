<template>
  ステージIDは {{ stage_id }}<br>
  <q-btn label="投稿する" color="primary" @click="posts = true"></q-btn>
  <q-dialog v-model="posts" persistent>
    <q-card style="min-width: 500px">
      <q-card-section>
        <div class="text-h6">投稿フォーム</div>
      </q-card-section>

      <q-card-section class="q-pt-none">
        ユーザー名<br>
        <q-input dense v-model="names" autofocus @keyup.enter="prompt = false" />
      </q-card-section>

      <q-card-section class="q-pt-none">
        内容<br>
        <q-input dense v-model="details" autofocus @keyup.enter="prompt = false" />
      </q-card-section>

      <q-card-actions align="right" class="text-primary">
        <q-btn flat label="キャンセル" v-close-popup />
        <q-btn flat label="投稿する" v-close-popup @click="confirm = true" />
      </q-card-actions>
      <br>
    </q-card>
  </q-dialog>
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
  <ul>
    <li v-for="item in items" :key="item.post_id">
      {{ item.user_name }}
    </li>
  </ul>
</template>

<script setup>

// 変数名.value = ref(型定義)で同名のv-modelの値を取得できるようになる
import {ref} from "vue";
import {useFetch} from "#app";

const route = useRoute();

const confirm = ref(false);
const posts = ref(false);
const prompt = ref(false);
const names = ref('');
const details = ref('');
const { stage_id } = route.params;
const post = await function (){
  return useFetch('/api/record',
      {
        method: "POST",
        body: {
          name: names,
          detail: details
        }
      });
}
const { data: items, refresh, error } = await useFetch('/api/record');

</script>