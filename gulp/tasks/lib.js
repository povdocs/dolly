'use strict';

var gulp = require('gulp');
var webpack = require('gulp-webpack');

gulp.task('lib', function () {
	var config = require('../../config');

	return gulp.src('src/index.js')
		.pipe(webpack(config.lib))
		.pipe(gulp.dest('dist'));
});