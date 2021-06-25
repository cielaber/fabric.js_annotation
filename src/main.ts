import { createApp } from 'vue';
import ElementPlus from 'element-plus';
import App from './App.vue';

import './assets/iconfont/iconfont.css';
import './assets/iconfont/iconfont';

import 'element-plus/lib/theme-chalk/index.css';

createApp(App).use(ElementPlus).mount('#app');
