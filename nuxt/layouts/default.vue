<template>
  <div>
    <nav class="container flex justify-around py-8 mx-auto bg-white">
      <div>
        <h3 class="text-2xl font-medium text-blue-500">LOGO</h3>
      </div>
      <div class="flex space-x-8">
        <NuxtLink to="/">Home</NuxtLink>
        <NuxtLink to="/login" v-if="!$auth.loggedIn">Login</NuxtLink>
        <NuxtLink to="/register" v-if="!$auth.loggedIn">Register</NuxtLink>
        <div v-if="$auth.loggedIn">
          <button
              type="button"
              @click="logout"
          >
            Logout
          </button>
        </div>
      </div>
    </nav>
    <Nuxt />
  </div>
</template>
<script>
export default {
  middleware: "auth",
  methods: {
    async logout() {
      this.$nuxt.$loading.start();
      this.$auth.logout();
      this.$nuxt.$loading.finish();
      this.$router.push("/login");
    },
  },
};
</script>
