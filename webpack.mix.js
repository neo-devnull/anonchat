var mix = require('laravel-mix');

mix.js('resources/js/app.js','public/javascripts/')
    .sass('resources/sass/app.scss','public/stylesheets')