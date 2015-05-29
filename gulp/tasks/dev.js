'use strict';

var gulp = require('gulp');
var webpack = require('gulp-webpack');

gulp.task('dev', function () {
	var config = require('../../config');

	return gulp.src('src/index.js')
		.pipe(webpack(config.dev))
		.pipe(gulp.dest('dist'));
});