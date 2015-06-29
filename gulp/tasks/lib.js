'use strict';

var gulp = require('gulp');
var babel = require('gulp-babel');

gulp.task('lib', function () {
	return gulp.src('src/index.js')
		.pipe(babel())
		.pipe(gulp.dest('dist'));
});