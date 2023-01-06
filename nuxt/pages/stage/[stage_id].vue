<template>
  ステージIDは {{ stage_id }}<br>
  <v-btn color="primary" @click="posts = true">投稿する</v-btn>
  <v-dialog v-model="posts" persistent>
    <v-card style="min-width: 500px">
      <v-card-item>
        <div class="text-h6">投稿フォーム</div>
      </v-card-item>

      <v-card-item class="q-pt-none">
        ユーザー名<br>
        <v-text-field v-model="names" autofocus/>
      </v-card-item>

      <v-card-item class="q-pt-none">
        内容<br>
        <v-text-field v-model="details"/>
      </v-card-item>

      <v-card-actions>
        <v-btn color="primary" flat @click="posts = false">キャンセル</v-btn>
        <v-btn color="primary" flat @click="posts = false;confirm = true">投稿する</v-btn>
      </v-card-actions>
      <br>
    </v-card>
  </v-dialog>
  <v-dialog v-model="confirm" persistent>
    <v-card>
      <v-card-item class="row items-center">
        <span class="q-ml-sm">本当に送信していいですか？</span>
      </v-card-item>
      <v-card-actions>
        <v-btn color="primary" right flat @click="confirm = false">キャンセル</v-btn>
        <v-btn color="primary" right flat @click="post();refresh();confirm = false">送信</v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
  記録<br>
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
let { stage_id } = route.params;
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

// ルートがアップデートされたら遷移前と遷移後をオブジェクトで取得する
onBeforeRouteUpdate(async (to) => {
  stage_id = to.params.stage_id;
});
</script>