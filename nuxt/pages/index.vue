<template>
  <div>
    <!-- Remove this component to get started! -->
    <!--    <NuxtWelcome />-->
    仮リンク<br>
    <NuxtLink to="/stage/101">こてしらべの洞窟</NuxtLink>
  </div>
</template>

<script setup>
const { data } = await useFetch('http://laravel:8000/api/test');
</script>
