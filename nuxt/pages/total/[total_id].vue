<template>
この総合ページIDは{{ total_id }}

  <NuxtLink to="/">トップに戻る</NuxtLink>
</template>

<script setup>
const route = useRoute();
let { total_id } = route.params;

// TODO ページ遷移してもrouteの値が反映されない問題暫定解決
// ルートがアップデートされたら遷移前と遷移後をオブジェクトで取得する
onBeforeRouteUpdate(async (to) => {
  total_id = to.params.total_id;
});
</script>