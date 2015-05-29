'use strict';

var gulp = require('gulp');
var webpack = require('gulp-webpack');

gulp.task('dist', function () {
	var config = require('../../config');

	return gulp.src('src/index.js')
		.pipe(webpack(config.production))
		.pipe(gulp.dest('dist'));
});