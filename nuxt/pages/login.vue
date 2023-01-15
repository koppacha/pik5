<template>
  <div
      class="relative flex flex-col justify-center min-h-screen overflow-hidden"
  >
    <div class="w-full p-6 m-auto bg-white rounded shadow-lg lg:max-w-md">
      <h1 class="text-3xl font-semibold text-center text-purple-700">
        Sign In
      </h1>
      <form class="mt-6" @submit.prevent="login">
        <div>
          <label for="email" class="block text-sm text-gray-800">Email</label>
          <input
              v-model="form.email"
              name="email"
              type="email"
              class="block w-full px-4 py-2 mt-2 text-purple-700 bg-white border rounded-md focus:border-purple-400 focus:ring-purple-300 focus:outline-none focus:ring focus:ring-opacity-40"
          />
        </div>
        <div class="mt-4">
          <div>
            <label for="password" class="block text-sm text-gray-800"
            >Password</label
            >
            <input
                v-model="form.password"
                name="password"
                type="password"
                class="block w-full px-4 py-2 mt-2 text-purple-700 bg-white border rounded-md focus:border-purple-400 focus:ring-purple-300 focus:outline-none focus:ring focus:ring-opacity-40"
            />
          </div>
          <div class="mt-6">
            <button
                type="submit"
                class="w-full px-4 py-2 tracking-wide text-white transition-colors duration-200 transform bg-purple-700 rounded-md hover:bg-purple-600 focus:outline-none focus:bg-purple-600"
            >
              Login
            </button>
          </div>
        </div>
      </form>
    </div>
  </div>
</template>

<script>
export default {
  auth: "guest",
  data() {
    return {
      form: {
        email: null,
        password: null,
      },
    };
  },
  mounted() {
    this.$axios.$get("/sanctum/csrf-cookie");
  },
  methods: {
    async login() {
      this.$nuxt.$loading.start();
      try {
        await this.$auth.loginWith("laravelSanctum", { data: this.form });
        this.$router.push({
          path: "/",
        });
      } catch (err) {
        console.log(err);
      }
      this.$nuxt.$loading.finish();
    },
  },
};
</script>
