'use strict';

var gulp = require('gulp');
var webpack = require('gulp-webpack');
var config = require('../../config');

gulp.task('watch', function () {
	gulp.watch(['src/**/*', 'config/*'], ['dev']);
});