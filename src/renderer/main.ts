import { createApp } from 'vue';
import { createRouter, createWebHistory } from 'vue-router';
import { createPinia } from 'pinia';
import UserSettings from '@shared/userSettings';

import BookLibrary from '@/pages/BookLibrary.vue';
import AboutPage from '@/pages/AboutPage.vue';
import GlobalSettings from '@/pages/GlobalSettings.vue';
import UserStats from '@/pages/UserStats.vue';
import WordLists from '@/pages/WordLists.vue';
import FlashCards from '@/pages/FlashCards.vue';
import BookStats from '@/pages/BookStats.vue';

import App from './App.vue';

const router = createRouter({
  history: createWebHistory(),
  routes: [
    {
      path: '/BookLibrary',
      name: 'BookLibrary',
      component: BookLibrary,
    },
    {
      path: '/About',
      name: 'About',
      component: AboutPage,
    },
    {
      path: '/Settings',
      name: 'Settings',
      component: GlobalSettings,
    },
    {
      path: '/Stats',
      name: 'Stats',
      component: UserStats,
    },
    {
      path: '/WordLists',
      name: 'WordLists',
      component: WordLists,
    },
    {
      path: '/FlashCards',
      name: 'FlashCards',
      component: FlashCards,
    },
    {
      path: '/book/:bookId',
      name: 'BookStats',
      component: BookStats,
      props: true,
    },
  ],
});

const pinia = createPinia();
const app = createApp(App);
app.provide('userSettings', UserSettings);
app.use(router);
app.use(pinia);
app.mount('#app');