'use strict';

//dependencies
var vec3 = require('gl-matrix-vec3');

function Vector(x, y, z) {
	this.vec = vec3.fromValues(x || 0, y || 0, z || 0);

	Object.defineProperties(this, {
		x: {
			writeable: true,
			enumerable: true,
			get: () => this.vec[0],
			set: (val) => this.vec[0] = val
		},
		y: {
			writeable: true,
			enumerable: true,
			get: () => this.vec[1],
			set: (val) => this.vec[1] = val
		},
		z: {
			writeable: true,
			enumerable: true,
			get: () => this.vec[2],
			set: (val) => this.vec[2] = val
		}
	});
}

Vector.prototype.toString = function() {
	return vec3.str(this.vec);
};

Vector.prototype.clone = function (v) {
	return new Vector(v.x, v.y, v.z);
};

Vector.prototype.copy = function (v) {
	if (v instanceof Vector) {
		vec3.copy(this.vec, v.vec);
	} else if (typeof v === 'object' && v) {
		this.set(v.x, v.y, v.z);
	}
	return this;
};

Vector.prototype.zero = function () {
	vec3.set(this.vec, 0, 0, 0);
	return this;
};

Vector.prototype.set = function (x, y, z) {
	vec3.set(this.vec, x, y, z);
	return this;
};

Vector.prototype.negate = function () {
	vec3.negate(this.vec, this.vec);
	return this;
};

Vector.prototype.normalize = function () {
	vec3.normalize(this.vec, this.vec);
	return this;
};

Vector.prototype.scale = function (scale) {
	vec3.scale(this.vec, this.vec, scale);
	return this;
};

Vector.prototype.scaleAndAdd = function (v, scale) {
	vec3.scaleAndAdd(this.vec, this.vec, v.vec, scale);
	return this;
};

Vector.prototype.lerp = function (v, t) {
	vec3.lerp(this.vec, this.vec, v.vec, t);
	return this;
};

//wrap functions that operate on `this` and another vector
[
	'add',
	'cross',
	'divide',
	'max',
	'min',
	'multiply',
	'subtract'
].forEach(function (key) {
	var fn = vec3[key];
	Vector.prototype[key] = function (v) {
		fn(this.vec, this.vec, v.vec);
		return this;
	};
});

Vector.prototype.length = function () {
	return vec3.length(this.vec);
};

Vector.prototype.squaredLength = function () {
	return vec3.squaredLength(this.vec);
};

//wrap functions that return a number based on this and another vector
[
	'distance',
	'dot',
	'squaredDistance'
].forEach(function (key) {
	var fn = vec3[key];
	Vector.prototype[key] = function (v) {
		return fn(this.vec, v.vec);
	};
});

Vector.fromArray = function (array) {
	return new Vector.apply(null, array);
};

Vector.clone = function (v) {
	return new Vector(v.x, v.y, v.z);
};

module.exports = Vector;