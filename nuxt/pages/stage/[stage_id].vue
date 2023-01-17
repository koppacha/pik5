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
  <br>
  記録<br>
  <ul>
    <li v-for="item in items" :key="item.post_id">
      {{ item.user_name }}

    </li>
  </ul>

  仮リンク<br>
  <NuxtLink to="/stage/201">こてしらべの洞窟</NuxtLink><br>
  <NuxtLink to="/stage/202">新参者の試練場</NuxtLink><br>
  <NuxtLink to="/stage/203">神々のおもちゃ箱</NuxtLink>
  <br>
  ログイン<br>
  メールアドレス<v-text-field v-model="emails"/>
  パスワード<v-text-field v-model="passwords"/>
  <v-btn color="primary" @click="login()">送信</v-btn><br>

  Logged In?<br>
  <span>{{ loggedIn ? 'yes':'no' }}</span><br>
  <div v-if="loggedIn">
    Users name?<br>
    <span>{{ user.name }}</span>
  </div>

</template>

<script setup>

// 変数名.value = ref(型定義)で同名のv-modelの値を取得できるようになる
import {ref} from "vue";
import {useFetch} from "#app";

const { $sanctumAuth } = useNuxtApp()
const errors = ref([])

const route = useRoute();

const confirm = ref(false);
const posts = ref(false);
const prompt = ref(false);
const names = ref('');
const details = ref('');
const emails = ref('');
const passwords = ref('');
let resp = ref('');
let { stage_id } = route.params;

const post = await function (){
  return useFetch('http://localhost:8000/api/record',
      {
        method: "POST",
        body: {
          name: names,
          detail: details
        }
      });
}
const login = async () => {
  try {
    await $sanctumAuth.login({
      email: 'test1@pik5.net',
      password: 'password'
    })
  } catch (e){
    errors.value = e.errors
  }
}
const logout = async () => {
  await $sanctumAuth.logout()
}

const { user, loggedIn } = useState('auth').value

const { data: items, refresh, error } = await useFetch(`http://localhost:8000/api/record/${stage_id}`);

// ルートがアップデートされたら遷移前と遷移後をオブジェクトで取得する
onBeforeRouteUpdate(async (to) => {
  stage_id = to.params.stage_id
});

</script>