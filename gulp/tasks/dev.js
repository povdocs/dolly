'use strict';

var gulp = require('gulp');
var webpack = require('gulp-webpack');
var config = require('../../config');

gulp.task('dev', function () {
	return gulp.src('src/index.js')
		.pipe(webpack(config.dev))
		.pipe(gulp.dest('dist'));
});