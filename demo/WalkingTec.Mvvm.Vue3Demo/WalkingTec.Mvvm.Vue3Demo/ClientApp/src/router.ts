import lodash from 'lodash';
import { BindAll } from 'lodash-decorators';
import { action, observable } from 'mobx';
import error from './layouts/pages/error/index.vue';
import home from './layouts/pages/home/index.vue';
import webview from './layouts/pages/webview/index.vue';
import { BehaviorSubject } from 'rxjs';
import { createRouter, createWebHistory, RouteLocationNormalized, Router, RouteRecordRaw } from 'vue-router';
import { $i18n } from './client';
// Vue.registerHooks([
//   'beforeRouteEnter',
//   'beforeRouteLeave',
//   'beforeRouteUpdate'
// ])
@BindAll()
class AppRouter {
  readonly lazy = false;
  readonly PageFiles = require.context('./pages', true, /\.vue$/, 'sync') // 根据目录结构去搜索文件
  readonly PagePath = this.PageFiles.keys().filter(file => !lodash.includes(file, 'views'));
  /**
   * 路由的文件信息
   * @type {Array<any>}
   * @memberof AppRouter
   */
  RouterFiles: Array<any>;
  /**
   * 创建的路由
   * @type {Router}
   * @memberof AppRouter
   */
  Router: Router;
  /**
   * 路由配置
   * @type {Array<RouteRecordRaw>}
   * @memberof AppRouter
   */
  RouterConfig: Array<RouteRecordRaw>;
  /**
   * 已开 页面缓存列表
   * @memberof AppRouter
   */
  PagesCache = new Map<string, RouteLocationNormalized>();
  /**
   * 订阅事件
   * @memberof AppRouter
   */
  RouterBehaviorSubject = new BehaviorSubject(this.toArray());
  /**
   * 全局前置守卫
   * @param to 
   * @param from 
   * @doc https://next.router.vuejs.org/zh/guide/advanced/navigation-guards.html
   */
  async beforeEach(to: RouteLocationNormalized, from: RouteLocationNormalized) {
    console.log('')
    console.group(to.path)
    // console.log("beforeEach", to, from)
  }
  /**
   * 全局解析守卫
   * @param to 
   * @param from 
   * @doc https://next.router.vuejs.org/zh/guide/advanced/navigation-guards.html
   */
  async beforeResolve(to: RouteLocationNormalized) {
    // console.log("beforeResolve", to)
  }
  /**
   * 全局后置钩子
   * @param to 
   * @param from 
   * @doc https://next.router.vuejs.org/zh/guide/advanced/navigation-guards.html
   */
  afterEach(to: RouteLocationNormalized, from: RouteLocationNormalized) {
    console.log("afterEach", to, from)
    // webview 取 src
    let pageKey = to.path;
    const pageTo = lodash.assign({ pageKey }, to)
    if (lodash.eq(to.name, 'webview')) {
      pageKey = `${to.path}_${lodash.get(to.query, 'src')}`;
      lodash.set(pageTo, 'pageKey', pageKey)
    }
    this.PagesCache.set(pageKey, pageTo)
    this.RouterBehaviorSubject.next(this.toArray())
    console.groupEnd()
    console.log('')
  }

  onInit() {
    this.RouterConfig = lodash.concat([
      {
        path: '/',
        name: 'home',
        component: home
      },
      {
        path: '/webview',
        name: 'webview',
        component: webview
      }
    ], this.createRouters(), [
      {
        path: '/:pathMatch(.*)*',
        name: 'NotFound',
        component: error
      }
    ])
    this.Router = createRouter({
      history: createWebHistory(process.env.BASE_URL),
      routes: this.RouterConfig
    })
    this.Router.beforeEach(this.beforeEach)
    this.Router.beforeResolve(this.beforeResolve)
    this.Router.afterEach(this.afterEach)
    this.PagesCache.set('/', {
      pageKey: '/',
      path: '/',
      name: 'home',
    } as any)
    console.log('')
    console.group('Router')
    console.log(this)
    console.groupEnd()
    console.log('')
  }
  /**
   * 获取带有 controller 属性的 页面
   * @returns 
   */
  async onGetRequest(): Promise<Array<{ label: string, value: string } & RouteRecordRaw>> {
    return lodash.map(lodash.filter(this.RouterFiles, 'component.controller'), item => {
      return lodash.assign({ label: $i18n.t(`PageName.${lodash.get(item, 'name')}`), value: lodash.get(item, 'component.controller') }, item)
    })
  }
  toArray() {
    let PagesCache = []
    this.PagesCache.forEach(x => {
      PagesCache = lodash.concat(PagesCache, x)
    })
    return PagesCache
  }
  createRouters() {
    const map = this.PagePath.reduce((map, cur) => {
      let dislodge = cur.match(/\/(.+?)\.vue$/)[1] // 只匹配纯文件名的字符串
      let key = dislodge.split('/')[0]; // 拿到一级文件的名称
      (map[key] || (map[key] = [])).push(cur)
      return map
    }, {})
    return this.getRoutes(map)
  }
  getRoutes(map) {
    // console.log("LENG: getRoutes -> map", map)
    const routes: Array<any> = [];
    lodash.map(map, (value, key) => {
      // 所有 页面 只取 index.tsx 结尾页面
      value = lodash.filter(value, item => lodash.endsWith(item, 'index.vue'))
      // 子页面
      const childrenPage = lodash.filter(value, rem => lodash.includes(rem, `/children/`));
      // 根页面
      const page = lodash.filter(value, rem => !lodash.includes(rem, `/children/`));
      lodash.forEach(page, item => {
        routes.push(this.getRoute(item, childrenPage))
      })
    })
    this.RouterFiles = routes
    // console.log("LENG: getRoutes -> routes", routes)
    return routes
  }
  getRoute(item, childrenPage) {
    const name = this.getRouteItemName(item);
    const path = this.getRouteItemPath(item);
    const route = {
      name,
      path,
      component: this.getComponent(item),
      exact: true,
    }
    return route
  }
  getComponent(item) {
    const component = this.PageFiles(item);
    return component.default
  }
  /**
   * 获取路由name
   * @param {*} file type：string （文件完整的目录）
   */
  getRouteItemName(file) {
    let match = file.match(/\/(.+?)\.vue$/)[1] // 去除相对路径与.tsx
    let res = match.replace(/_/ig, '').replace(/\//ig, '-') // 把下划线去除， 改变/为-拼接
    return res.replace('-index', '').replace('-children', '')
  }

  /**
  * 获取路由path
  * @param {*} file String （目录，一级路由则为完整目录，多级为自身目录名称）
  */
  getRouteItemPath(file) {
    return file
      .replace('/index.vue', '')
      // .replace(/_/g, ':')
      .replace(/\./g, '') || '/'
  }
}
export default new AppRouter()