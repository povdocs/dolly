'use strict';

var gulp = require('gulp');
var webpack = require('gulp-webpack');
var config = require('../../config');

gulp.task('dist', function () {
	return gulp.src('src/index.js')
		.pipe(webpack(config.production))
		.pipe(gulp.dest('dist'));
});