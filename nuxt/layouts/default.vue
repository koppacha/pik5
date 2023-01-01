<template>
  <v-app>
    <!-- ヘッダー -->
    <v-app-bar
        app
        flat
        border
        class="px-md-6"
    >
      <v-app-bar-nav-icon
          @click="switchNavigationDisplay"
          class="mr-md-4"
      />

      <v-app-bar-title class="font-weight-bold">
        Nuxt3 + Vuetify3 Example 🚀
      </v-app-bar-title>

      <v-spacer />

      <v-icon icon="mdi-account" class="mr-1" />
      <p class="font-weight-bold">demo.user</p>
    </v-app-bar>
    <!-- /ヘッダー -->

    <!-- ナビゲーション -->
    <v-navigation-drawer
        v-model="isNavigationShown"
        app
        floating
        class="px-6 py-4"
    >
      <v-list>
        <v-list-item
            v-for="item in $C.NAVIGATION_ITEMS"
            active-color="primary"
            :to="item.path"
            class="py-3"
        >
          <v-icon :icon="item.icon" class="mr-6" />
          <v-list-item-title
              class="font-weight-bold"
              v-text="item.title"
          />
        </v-list-item>
      </v-list>
    </v-navigation-drawer>
    <!-- /ナビゲーション -->

    <v-main>
      <v-container class="pa-6 pa-md-9">
        <slot />
      </v-container>
    </v-main>
  </v-app>
</template>

<script setup lang="ts">
// ナビゲーションの表示・非表示を制御
const isNavigationShown = useState('isNavigationShown', () => true)
const switchNavigationDisplay = () => {
  isNavigationShown.value = !isNavigationShown.value
}
</script>

<style scoped lang="scss">
// .v-list-item がアクティブ時の背景色を消す方法が分からなかったので無理やり対応😭
::v-deep(.v-list-item__overlay) {
  display: none;
}
</style>
