<template>
    <!-- Remove this component to get started! -->
    <!--    <NuxtWelcome />-->
    <q-layout view="hHh lpR fFf">

      <q-header elevated class="bg-primary text-white" height-hint="98">
        <q-toolbar>
          <q-btn dense flat round icon="menu" @click="toggleLeftDrawer" />

          <q-toolbar-title>
            新ピクチャレ大会 ver.3.00 beta 1
          </q-toolbar-title>
        </q-toolbar>

        <q-tabs align="center">
          <q-route-tab to="/total/10" label="ピクミン" />
          <q-route-tab to="/total/20" label="ピクミン2" />
          <q-route-tab to="/total/30" label="ピクミン3" />
          <q-route-tab to="/total/40" label="ピクミン4" />
          <q-route-tab to="/total/80" label="期間限定" />
          <q-route-tab to="/total/91" label="本編地下RTA" />
        </q-tabs>
      </q-header>

      <q-drawer show-if-above v-model="leftDrawerOpen" side="left" bordered>
        <!-- drawer content -->
      </q-drawer>

      <q-page-container>
        <router-view />
      </q-page-container>

    </q-layout>
</template>

<script setup>
 import { ref } from 'vue';

 const toggleLeftDrawer = ref(false);

</script>
