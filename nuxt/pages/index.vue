<template>
  <div>
    <!-- Remove this component to get started! -->
    <!--    <NuxtWelcome />-->
    仮リンク<br>
    <NuxtLink to="/stage/201">こてしらべの洞窟</NuxtLink><br>
    <NuxtLink to="/stage/202">新参者の試練場</NuxtLink><br>
    <NuxtLink to="/stage/203">神々のおもちゃ箱</NuxtLink>
  </div>
</template>

<script setup>
const { data } = await useFetch('http://laravel:8000/api/test');

</script>
