window.Vue = require('vue');

Vue.component('test-component',require('./components/TestComponent.vue'));


var app = new Vue({
    el: "#app"
});