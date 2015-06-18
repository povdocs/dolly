/*!
 * dolly - A JavaScript library for objects to follow other objects in 3D space
 * @version v0.0.1
 * @link https://github.com/povdocs/dolly
 * @license MIT
 */
(function webpackUniversalModuleDefinition(root, factory) {
	if(typeof exports === 'object' && typeof module === 'object')
		module.exports = factory();
	else if(typeof define === 'function' && define.amd)
		define(factory);
	else if(typeof exports === 'object')
		exports["Dolly"] = factory();
	else
		root["Dolly"] = factory();
})(this, function() {
return /******/ (function(modules) { // webpackBootstrap
/******/ 	// The module cache
/******/ 	var installedModules = {};
/******/
/******/ 	// The require function
/******/ 	function __webpack_require__(moduleId) {
/******/
/******/ 		// Check if module is in cache
/******/ 		if(installedModules[moduleId])
/******/ 			return installedModules[moduleId].exports;
/******/
/******/ 		// Create a new module (and put it into the cache)
/******/ 		var module = installedModules[moduleId] = {
/******/ 			exports: {},
/******/ 			id: moduleId,
/******/ 			loaded: false
/******/ 		};
/******/
/******/ 		// Execute the module function
/******/ 		modules[moduleId].call(module.exports, module, module.exports, __webpack_require__);
/******/
/******/ 		// Flag the module as loaded
/******/ 		module.loaded = true;
/******/
/******/ 		// Return the exports of the module
/******/ 		return module.exports;
/******/ 	}
/******/
/******/
/******/ 	// expose the modules object (__webpack_modules__)
/******/ 	__webpack_require__.m = modules;
/******/
/******/ 	// expose the module cache
/******/ 	__webpack_require__.c = installedModules;
/******/
/******/ 	// __webpack_public_path__
/******/ 	__webpack_require__.p = "";
/******/
/******/ 	// Load entry module and return exports
/******/ 	return __webpack_require__(0);
/******/ })
/************************************************************************/
/******/ ([
/* 0 */
/***/ function(module, exports, __webpack_require__) {

	'use strict';
	
	//dependencies
	var Vector = __webpack_require__(1);
	var assign = __webpack_require__(4); //todo: use babel
	var eventEmitter = __webpack_require__(5);
	
	var propId = 0;
	
	//scratch vectors so we don't have to re-allocate all the time (too slow)
	var scratch = new Vector();
	var totalWeight = new Vector();
	
	function makeVector(arg) {
		function V() {
			return Vector.apply(this, arg);
		}
	
		if (typeof arg === 'number') {
			return new Vector(arg, arg, arg);
		}
	
		if (Array.isArray(arg)) {
			V.prototype = Vector.prototype;
			return new V();
		}
	
		if (arg instanceof Vector) {
			return Vector.clone(arg);
		}
	
		if (arg && typeof arg === 'object') {
			return new Vector(arg.x || 0, arg.y || 0, arg.z || 0);
		}
	
		return new Vector();
	}
	
	function safeDivide(a, b) {
		var va = a.vec,
		    vb = b.vec,
		    i,
		    denom;
		for (i = 0; i < 3; i++) {
			denom = vb[i];
			if (denom) {
				va[i] = va[i] / denom;
			}
		}
	}
	
	function Prop(opts) {
		var options = opts || {};
	
		this.lastUpdate = -1;
		this.id = propId++;
	
		this.name = options.name || 'prop' + this.id;
	
		this.position = makeVector(options.position);
		this.minBounds = makeVector(options.minBounds === undefined ? -Infinity : options.minBounds);
		this.maxBounds = makeVector(options.maxBounds === undefined ? Infinity : options.maxBounds);
		this.lag = typeof options.lag === 'number' && !isNaN(options.lag) ? options.lag : 0;
		this.maxSpeed = typeof options.maxSpeed === 'number' && !isNaN(options.maxSpeed) ? options.maxSpeed : Infinity;
	
		this.goal = new Vector();
		this.attractorGoal = new Vector();
		this.velocity = new Vector();
		this.lastPosition = Vector.clone(this.position);
		this.targets = [];
		this.attractors = [];
	
		eventEmitter(this);
	}
	
	Prop.prototype.follow = function (prop, options) {
		var target;
		var self = this;
		var weight;
	
		if (Array.isArray(prop)) {
			prop.forEach(function (p) {
				self.follow(p, options);
			});
			return;
		}
	
		if (!(prop instanceof Prop)) {
			throw new Error('Attempt to follow object that is not a Prop');
		}
	
		weight = options && options.weight;
		if (weight === undefined || isNaN(weight) && typeof weight === 'number') {
			weight = 1;
		}
	
		target = assign({
			radius: 0,
			// minDistance: 0, //not implemented yet
			// maxDistance: Infinity, //not implemented yet
			weight: 1
		}, options, {
			prop: prop,
			weight: makeVector(weight),
			offset: makeVector(options && options.offset),
			offsetPosition: new Vector()
		});
	
		this.targets.push(target);
	
		return this;
	};
	
	Prop.prototype.attract = function (prop, subject, options) {
		var attractor;
		var self = this;
	
		if (Array.isArray(prop)) {
			prop.forEach(function (p) {
				self.attract(p, options);
			});
			return;
		}
	
		if (!(prop instanceof Prop) || !(subject instanceof Prop)) {
			throw new Error('Attempt to follow object that is not a Prop');
		}
	
		attractor = assign({
			innerRadius: 0,
			outerRadius: 0,
			weight: 1
		}, options, {
			prop: prop, //the object that moves
			subject: subject, //the point of interest
			offset: makeVector(options && options.offset),
			offsetPosition: new Vector(),
			attraction: 0
		});
	
		this.attractors.push(attractor);
	
		return this;
	};
	
	Prop.prototype.update = function (delta, tick) {
		var _this = this;
	
		var totalAttractionWeight = 0;
		var totalAttraction = 0;
	
		//prevent infinite loops if follower graph is cyclical
		if (this.lastUpdate >= tick || tick === undefined) {
			return;
		}
	
		this.lastUpdate = tick;
	
		this.lastPosition.copyVector(this.position);
	
		this.emit('updatestart', this.position);
	
		if (!this.targets.length && !this.attractors.length) {
			return;
		}
	
		this.attractorGoal.zero();
		this.attractors.forEach(function (attractor) {
			var distance;
			var attraction = 0;
			var lastAttraction = attractor.attraction;
	
			attractor.prop.update(delta, tick);
			attractor.subject.update(delta, tick);
	
			distance = attractor.prop.position.distance(attractor.subject.position);
			if (distance < attractor.outerRadius) {
				attraction = Math.min(1, (attractor.outerRadius - distance) / (attractor.outerRadius - attractor.innerRadius));
				totalAttraction = Math.max(totalAttraction, attraction * attractor.weight);
				totalAttractionWeight += attractor.weight;
	
				attractor.offsetPosition.copyVector(attractor.subject.position).add(attractor.offset);
				_this.attractorGoal.scaleAndAdd(attractor.offsetPosition, attractor.weight);
	
				attractor.attraction = attraction;
				if (!lastAttraction) {
					_this.emit('enterattractor', attractor.prop, attractor.subject, attraction);
				} else if (lastAttraction !== attraction) {
					_this.emit('moveattractor', attractor.prop, attractor.subject, attraction);
				}
			} else if (attractor.attraction) {
				attractor.attraction = attraction;
				_this.emit('leaveattractor', attractor.prop, attractor.subject);
			}
		});
		if (totalAttractionWeight) {
			this.attractorGoal.scale(1 / totalAttractionWeight);
		}
	
		totalWeight.zero();
		this.goal.zero();
		if (totalAttraction < 1) {
			this.targets.forEach(function (target) {
				var distance;
	
				target.prop.update(delta, tick);
	
				target.offsetPosition.copyVector(target.prop.position).add(target.offset);
	
				scratch.copyVector(target.offsetPosition).subtract(_this.position); //vector towards target
	
				target.offsetPosition.copyVector(_this.position);
				distance = scratch.length();
				if (distance > target.radius) {
					scratch.normalize().scale(distance - target.radius);
					target.offsetPosition.add(scratch);
				}
	
				target.offsetPosition.multiply(target.weight);
				_this.goal.add(target.offsetPosition);
				totalWeight.add(target.weight);
			});
			if (totalWeight.length()) {
				safeDivide(this.goal, totalWeight);
			}
			if (totalAttraction) {
				this.goal.lerp(this.attractorGoal, totalAttraction);
			}
		} else {
			this.goal.copyVector(this.attractorGoal);
		}
	
		this.velocity.copyVector(this.goal).subtract(this.position);
		if (this.lag) {
			this.velocity.scale(Math.pow(delta, this.lag));
		}
	
		//cap velocity to maxSpeed
		if (this.maxSpeed && this.maxSpeed < Infinity && this.maxSpeed < this.velocity.length()) {
			this.velocity.normalize().scale(this.maxSpeed);
		}
	
		this.emit('update', this.position, this.velocity);
	
		this.position.add(this.velocity);
	
		//fit within bounds
		this.position.min(this.maxBounds).max(this.minBounds);
	
		this.emit('updated', this.position);
	
		return this;
	};
	
	Prop.prototype.active = function (epsilon) {
		return this.position.distance(this.lastPosition) > (epsilon || 0.00001);
	};
	
	function Dolly() {
		var tick = -1;
		var props = [];
		var updating = false;
		var self = this;
	
		this.update = function (delta) {
			if (updating) {
				return;
			}
			updating = true;
	
			tick++;
			props.forEach(function (prop) {
				prop.update(delta, tick);
			});
	
			updating = false;
	
			return self;
		};
	
		this.prop = function (options) {
			var prop = new Prop(options);
			props.push(prop);
			return prop;
		};
	
		this.active = function (epsilon) {
			var i;
			for (i = 0; i < props.length; i++) {
				if (props[i].active(epsilon)) {
					return true;
				}
			}
			return false;
		};
	}
	
	module.exports = Dolly;

/***/ },
/* 1 */
/***/ function(module, exports, __webpack_require__) {

	'use strict';
	
	//dependencies
	var vec3 = __webpack_require__(2);
	
	function Vector(x, y, z) {
		var _this = this;
	
		this.vec = vec3.fromValues(x || 0, y || 0, z || 0);
	
		Object.defineProperties(this, {
			x: {
				writeable: true,
				enumerable: true,
				get: function get() {
					return _this.vec[0];
				},
				set: function set(val) {
					return _this.vec[0] = val;
				}
			},
			y: {
				writeable: true,
				enumerable: true,
				get: function get() {
					return _this.vec[1];
				},
				set: function set(val) {
					return _this.vec[1] = val;
				}
			},
			z: {
				writeable: true,
				enumerable: true,
				get: function get() {
					return _this.vec[2];
				},
				set: function set(val) {
					return _this.vec[2] = val;
				}
			}
		});
	}
	
	Vector.prototype.toString = function () {
		return vec3.str(this.vec);
	};
	
	Vector.prototype.clone = function (v) {
		return new Vector(v.x, v.y, v.z);
	};
	
	Vector.prototype.copy = function (v) {
		if (v instanceof Vector) {
			vec3.copy(this.vec, v.vec);
		} else if (typeof v === 'object' && v) {
			this.set(v.x || 0, v.y || 0, v.z || 0);
		}
		return this;
	};
	
	Vector.prototype.copyVector = function (v) {
		vec3.copy(this.vec, v.vec);
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
	['add', 'cross', 'divide', 'max', 'min', 'multiply', 'subtract'].forEach(function (key) {
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
	['distance', 'dot', 'squaredDistance'].forEach(function (key) {
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

/***/ },
/* 2 */
/***/ function(module, exports, __webpack_require__) {

	/* Copyright (c) 2013, Brandon Jones, Colin MacKenzie IV. All rights reserved.
	
	Redistribution and use in source and binary forms, with or without modification,
	are permitted provided that the following conditions are met:
	
	  * Redistributions of source code must retain the above copyright notice, this
	    list of conditions and the following disclaimer.
	  * Redistributions in binary form must reproduce the above copyright notice,
	    this list of conditions and the following disclaimer in the documentation 
	    and/or other materials provided with the distribution.
	
	THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS IS" AND
	ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE IMPLIED
	WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE 
	DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT HOLDER OR CONTRIBUTORS BE LIABLE FOR
	ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES
	(INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES;
	LOSS OF USE, DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND ON
	ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT
	(INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE OF THIS
	SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE. */
	
	/**
	 * @class 3 Dimensional Vector
	 * @name vec3
	 */
	var vec3 = {};
	
	var GLMAT_ARRAY_TYPE = __webpack_require__(3).GLMAT_ARRAY_TYPE;
	var GLMAT_RANDOM = __webpack_require__(3).GLMAT_RANDOM;
	
	/**
	 * Creates a new, empty vec3
	 *
	 * @returns {vec3} a new 3D vector
	 */
	vec3.create = function() {
	    var out = new GLMAT_ARRAY_TYPE(3);
	    out[0] = 0;
	    out[1] = 0;
	    out[2] = 0;
	    return out;
	};
	
	/**
	 * Creates a new vec3 initialized with values from an existing vector
	 *
	 * @param {vec3} a vector to clone
	 * @returns {vec3} a new 3D vector
	 */
	vec3.clone = function(a) {
	    var out = new GLMAT_ARRAY_TYPE(3);
	    out[0] = a[0];
	    out[1] = a[1];
	    out[2] = a[2];
	    return out;
	};
	
	/**
	 * Creates a new vec3 initialized with the given values
	 *
	 * @param {Number} x X component
	 * @param {Number} y Y component
	 * @param {Number} z Z component
	 * @returns {vec3} a new 3D vector
	 */
	vec3.fromValues = function(x, y, z) {
	    var out = new GLMAT_ARRAY_TYPE(3);
	    out[0] = x;
	    out[1] = y;
	    out[2] = z;
	    return out;
	};
	
	/**
	 * Copy the values from one vec3 to another
	 *
	 * @param {vec3} out the receiving vector
	 * @param {vec3} a the source vector
	 * @returns {vec3} out
	 */
	vec3.copy = function(out, a) {
	    out[0] = a[0];
	    out[1] = a[1];
	    out[2] = a[2];
	    return out;
	};
	
	/**
	 * Set the components of a vec3 to the given values
	 *
	 * @param {vec3} out the receiving vector
	 * @param {Number} x X component
	 * @param {Number} y Y component
	 * @param {Number} z Z component
	 * @returns {vec3} out
	 */
	vec3.set = function(out, x, y, z) {
	    out[0] = x;
	    out[1] = y;
	    out[2] = z;
	    return out;
	};
	
	/**
	 * Adds two vec3's
	 *
	 * @param {vec3} out the receiving vector
	 * @param {vec3} a the first operand
	 * @param {vec3} b the second operand
	 * @returns {vec3} out
	 */
	vec3.add = function(out, a, b) {
	    out[0] = a[0] + b[0];
	    out[1] = a[1] + b[1];
	    out[2] = a[2] + b[2];
	    return out;
	};
	
	/**
	 * Subtracts vector b from vector a
	 *
	 * @param {vec3} out the receiving vector
	 * @param {vec3} a the first operand
	 * @param {vec3} b the second operand
	 * @returns {vec3} out
	 */
	vec3.subtract = function(out, a, b) {
	    out[0] = a[0] - b[0];
	    out[1] = a[1] - b[1];
	    out[2] = a[2] - b[2];
	    return out;
	};
	
	/**
	 * Alias for {@link vec3.subtract}
	 * @function
	 */
	vec3.sub = vec3.subtract;
	
	/**
	 * Multiplies two vec3's
	 *
	 * @param {vec3} out the receiving vector
	 * @param {vec3} a the first operand
	 * @param {vec3} b the second operand
	 * @returns {vec3} out
	 */
	vec3.multiply = function(out, a, b) {
	    out[0] = a[0] * b[0];
	    out[1] = a[1] * b[1];
	    out[2] = a[2] * b[2];
	    return out;
	};
	
	/**
	 * Alias for {@link vec3.multiply}
	 * @function
	 */
	vec3.mul = vec3.multiply;
	
	/**
	 * Divides two vec3's
	 *
	 * @param {vec3} out the receiving vector
	 * @param {vec3} a the first operand
	 * @param {vec3} b the second operand
	 * @returns {vec3} out
	 */
	vec3.divide = function(out, a, b) {
	    out[0] = a[0] / b[0];
	    out[1] = a[1] / b[1];
	    out[2] = a[2] / b[2];
	    return out;
	};
	
	/**
	 * Alias for {@link vec3.divide}
	 * @function
	 */
	vec3.div = vec3.divide;
	
	/**
	 * Returns the minimum of two vec3's
	 *
	 * @param {vec3} out the receiving vector
	 * @param {vec3} a the first operand
	 * @param {vec3} b the second operand
	 * @returns {vec3} out
	 */
	vec3.min = function(out, a, b) {
	    out[0] = Math.min(a[0], b[0]);
	    out[1] = Math.min(a[1], b[1]);
	    out[2] = Math.min(a[2], b[2]);
	    return out;
	};
	
	/**
	 * Returns the maximum of two vec3's
	 *
	 * @param {vec3} out the receiving vector
	 * @param {vec3} a the first operand
	 * @param {vec3} b the second operand
	 * @returns {vec3} out
	 */
	vec3.max = function(out, a, b) {
	    out[0] = Math.max(a[0], b[0]);
	    out[1] = Math.max(a[1], b[1]);
	    out[2] = Math.max(a[2], b[2]);
	    return out;
	};
	
	/**
	 * Scales a vec3 by a scalar number
	 *
	 * @param {vec3} out the receiving vector
	 * @param {vec3} a the vector to scale
	 * @param {Number} b amount to scale the vector by
	 * @returns {vec3} out
	 */
	vec3.scale = function(out, a, b) {
	    out[0] = a[0] * b;
	    out[1] = a[1] * b;
	    out[2] = a[2] * b;
	    return out;
	};
	
	/**
	 * Adds two vec3's after scaling the second operand by a scalar value
	 *
	 * @param {vec3} out the receiving vector
	 * @param {vec3} a the first operand
	 * @param {vec3} b the second operand
	 * @param {Number} scale the amount to scale b by before adding
	 * @returns {vec3} out
	 */
	vec3.scaleAndAdd = function(out, a, b, scale) {
	    out[0] = a[0] + (b[0] * scale);
	    out[1] = a[1] + (b[1] * scale);
	    out[2] = a[2] + (b[2] * scale);
	    return out;
	};
	
	/**
	 * Calculates the euclidian distance between two vec3's
	 *
	 * @param {vec3} a the first operand
	 * @param {vec3} b the second operand
	 * @returns {Number} distance between a and b
	 */
	vec3.distance = function(a, b) {
	    var x = b[0] - a[0],
	        y = b[1] - a[1],
	        z = b[2] - a[2];
	    return Math.sqrt(x*x + y*y + z*z);
	};
	
	/**
	 * Alias for {@link vec3.distance}
	 * @function
	 */
	vec3.dist = vec3.distance;
	
	/**
	 * Calculates the squared euclidian distance between two vec3's
	 *
	 * @param {vec3} a the first operand
	 * @param {vec3} b the second operand
	 * @returns {Number} squared distance between a and b
	 */
	vec3.squaredDistance = function(a, b) {
	    var x = b[0] - a[0],
	        y = b[1] - a[1],
	        z = b[2] - a[2];
	    return x*x + y*y + z*z;
	};
	
	/**
	 * Alias for {@link vec3.squaredDistance}
	 * @function
	 */
	vec3.sqrDist = vec3.squaredDistance;
	
	/**
	 * Calculates the length of a vec3
	 *
	 * @param {vec3} a vector to calculate length of
	 * @returns {Number} length of a
	 */
	vec3.length = function (a) {
	    var x = a[0],
	        y = a[1],
	        z = a[2];
	    return Math.sqrt(x*x + y*y + z*z);
	};
	
	/**
	 * Alias for {@link vec3.length}
	 * @function
	 */
	vec3.len = vec3.length;
	
	/**
	 * Calculates the squared length of a vec3
	 *
	 * @param {vec3} a vector to calculate squared length of
	 * @returns {Number} squared length of a
	 */
	vec3.squaredLength = function (a) {
	    var x = a[0],
	        y = a[1],
	        z = a[2];
	    return x*x + y*y + z*z;
	};
	
	/**
	 * Alias for {@link vec3.squaredLength}
	 * @function
	 */
	vec3.sqrLen = vec3.squaredLength;
	
	/**
	 * Negates the components of a vec3
	 *
	 * @param {vec3} out the receiving vector
	 * @param {vec3} a vector to negate
	 * @returns {vec3} out
	 */
	vec3.negate = function(out, a) {
	    out[0] = -a[0];
	    out[1] = -a[1];
	    out[2] = -a[2];
	    return out;
	};
	
	/**
	 * Normalize a vec3
	 *
	 * @param {vec3} out the receiving vector
	 * @param {vec3} a vector to normalize
	 * @returns {vec3} out
	 */
	vec3.normalize = function(out, a) {
	    var x = a[0],
	        y = a[1],
	        z = a[2];
	    var len = x*x + y*y + z*z;
	    if (len > 0) {
	        //TODO: evaluate use of glm_invsqrt here?
	        len = 1 / Math.sqrt(len);
	        out[0] = a[0] * len;
	        out[1] = a[1] * len;
	        out[2] = a[2] * len;
	    }
	    return out;
	};
	
	/**
	 * Calculates the dot product of two vec3's
	 *
	 * @param {vec3} a the first operand
	 * @param {vec3} b the second operand
	 * @returns {Number} dot product of a and b
	 */
	vec3.dot = function (a, b) {
	    return a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
	};
	
	/**
	 * Computes the cross product of two vec3's
	 *
	 * @param {vec3} out the receiving vector
	 * @param {vec3} a the first operand
	 * @param {vec3} b the second operand
	 * @returns {vec3} out
	 */
	vec3.cross = function(out, a, b) {
	    var ax = a[0], ay = a[1], az = a[2],
	        bx = b[0], by = b[1], bz = b[2];
	
	    out[0] = ay * bz - az * by;
	    out[1] = az * bx - ax * bz;
	    out[2] = ax * by - ay * bx;
	    return out;
	};
	
	/**
	 * Performs a linear interpolation between two vec3's
	 *
	 * @param {vec3} out the receiving vector
	 * @param {vec3} a the first operand
	 * @param {vec3} b the second operand
	 * @param {Number} t interpolation amount between the two inputs
	 * @returns {vec3} out
	 */
	vec3.lerp = function (out, a, b, t) {
	    var ax = a[0],
	        ay = a[1],
	        az = a[2];
	    out[0] = ax + t * (b[0] - ax);
	    out[1] = ay + t * (b[1] - ay);
	    out[2] = az + t * (b[2] - az);
	    return out;
	};
	
	/**
	 * Generates a random vector with the given scale
	 *
	 * @param {vec3} out the receiving vector
	 * @param {Number} [scale] Length of the resulting vector. If ommitted, a unit vector will be returned
	 * @returns {vec3} out
	 */
	vec3.random = function (out, scale) {
	    scale = scale || 1.0;
	
	    var r = GLMAT_RANDOM() * 2.0 * Math.PI;
	    var z = (GLMAT_RANDOM() * 2.0) - 1.0;
	    var zScale = Math.sqrt(1.0-z*z) * scale;
	
	    out[0] = Math.cos(r) * zScale;
	    out[1] = Math.sin(r) * zScale;
	    out[2] = z * scale;
	    return out;
	};
	
	/**
	 * Transforms the vec3 with a mat4.
	 * 4th vector component is implicitly '1'
	 *
	 * @param {vec3} out the receiving vector
	 * @param {vec3} a the vector to transform
	 * @param {mat4} m matrix to transform with
	 * @returns {vec3} out
	 */
	vec3.transformMat4 = function(out, a, m) {
	    var x = a[0], y = a[1], z = a[2];
	    out[0] = m[0] * x + m[4] * y + m[8] * z + m[12];
	    out[1] = m[1] * x + m[5] * y + m[9] * z + m[13];
	    out[2] = m[2] * x + m[6] * y + m[10] * z + m[14];
	    return out;
	};
	
	/**
	 * Transforms the vec3 with a mat3.
	 *
	 * @param {vec3} out the receiving vector
	 * @param {vec3} a the vector to transform
	 * @param {mat4} m the 3x3 matrix to transform with
	 * @returns {vec3} out
	 */
	vec3.transformMat3 = function(out, a, m) {
	    var x = a[0], y = a[1], z = a[2];
	    out[0] = x * m[0] + y * m[3] + z * m[6];
	    out[1] = x * m[1] + y * m[4] + z * m[7];
	    out[2] = x * m[2] + y * m[5] + z * m[8];
	    return out;
	};
	
	/**
	 * Transforms the vec3 with a quat
	 *
	 * @param {vec3} out the receiving vector
	 * @param {vec3} a the vector to transform
	 * @param {quat} q quaternion to transform with
	 * @returns {vec3} out
	 */
	vec3.transformQuat = function(out, a, q) {
	    // benchmarks: http://jsperf.com/quaternion-transform-vec3-implementations
	
	    var x = a[0], y = a[1], z = a[2],
	        qx = q[0], qy = q[1], qz = q[2], qw = q[3],
	
	        // calculate quat * vec
	        ix = qw * x + qy * z - qz * y,
	        iy = qw * y + qz * x - qx * z,
	        iz = qw * z + qx * y - qy * x,
	        iw = -qx * x - qy * y - qz * z;
	
	    // calculate result * inverse quat
	    out[0] = ix * qw + iw * -qx + iy * -qz - iz * -qy;
	    out[1] = iy * qw + iw * -qy + iz * -qx - ix * -qz;
	    out[2] = iz * qw + iw * -qz + ix * -qy - iy * -qx;
	    return out;
	};
	
	/*
	* Rotate a 3D vector around the x-axis
	* @param {vec3} out The receiving vec3
	* @param {vec3} a The vec3 point to rotate
	* @param {vec3} b The origin of the rotation
	* @param {Number} c The angle of rotation
	* @returns {vec3} out
	*/
	vec3.rotateX = function(out, a, b, c){
	   var p = [], r=[];
		  //Translate point to the origin
		  p[0] = a[0] - b[0];
		  p[1] = a[1] - b[1];
	  	p[2] = a[2] - b[2];
	
		  //perform rotation
		  r[0] = p[0];
		  r[1] = p[1]*Math.cos(c) - p[2]*Math.sin(c);
		  r[2] = p[1]*Math.sin(c) + p[2]*Math.cos(c);
	
		  //translate to correct position
		  out[0] = r[0] + b[0];
		  out[1] = r[1] + b[1];
		  out[2] = r[2] + b[2];
	
	  	return out;
	};
	
	/*
	* Rotate a 3D vector around the y-axis
	* @param {vec3} out The receiving vec3
	* @param {vec3} a The vec3 point to rotate
	* @param {vec3} b The origin of the rotation
	* @param {Number} c The angle of rotation
	* @returns {vec3} out
	*/
	vec3.rotateY = function(out, a, b, c){
	  	var p = [], r=[];
	  	//Translate point to the origin
	  	p[0] = a[0] - b[0];
	  	p[1] = a[1] - b[1];
	  	p[2] = a[2] - b[2];
	  
	  	//perform rotation
	  	r[0] = p[2]*Math.sin(c) + p[0]*Math.cos(c);
	  	r[1] = p[1];
	  	r[2] = p[2]*Math.cos(c) - p[0]*Math.sin(c);
	  
	  	//translate to correct position
	  	out[0] = r[0] + b[0];
	  	out[1] = r[1] + b[1];
	  	out[2] = r[2] + b[2];
	  
	  	return out;
	};
	
	/*
	* Rotate a 3D vector around the z-axis
	* @param {vec3} out The receiving vec3
	* @param {vec3} a The vec3 point to rotate
	* @param {vec3} b The origin of the rotation
	* @param {Number} c The angle of rotation
	* @returns {vec3} out
	*/
	vec3.rotateZ = function(out, a, b, c){
	  	var p = [], r=[];
	  	//Translate point to the origin
	  	p[0] = a[0] - b[0];
	  	p[1] = a[1] - b[1];
	  	p[2] = a[2] - b[2];
	  
	  	//perform rotation
	  	r[0] = p[0]*Math.cos(c) - p[1]*Math.sin(c);
	  	r[1] = p[0]*Math.sin(c) + p[1]*Math.cos(c);
	  	r[2] = p[2];
	  
	  	//translate to correct position
	  	out[0] = r[0] + b[0];
	  	out[1] = r[1] + b[1];
	  	out[2] = r[2] + b[2];
	  
	  	return out;
	};
	
	/**
	 * Perform some operation over an array of vec3s.
	 *
	 * @param {Array} a the array of vectors to iterate over
	 * @param {Number} stride Number of elements between the start of each vec3. If 0 assumes tightly packed
	 * @param {Number} offset Number of elements to skip at the beginning of the array
	 * @param {Number} count Number of vec3s to iterate over. If 0 iterates over entire array
	 * @param {Function} fn Function to call for each vector in the array
	 * @param {Object} [arg] additional argument to pass to fn
	 * @returns {Array} a
	 * @function
	 */
	vec3.forEach = (function() {
	    var vec = vec3.create();
	
	    return function(a, stride, offset, count, fn, arg) {
	        var i, l;
	        if(!stride) {
	            stride = 3;
	        }
	
	        if(!offset) {
	            offset = 0;
	        }
	        
	        if(count) {
	            l = Math.min((count * stride) + offset, a.length);
	        } else {
	            l = a.length;
	        }
	
	        for(i = offset; i < l; i += stride) {
	            vec[0] = a[i]; vec[1] = a[i+1]; vec[2] = a[i+2];
	            fn(vec, vec, arg);
	            a[i] = vec[0]; a[i+1] = vec[1]; a[i+2] = vec[2];
	        }
	        
	        return a;
	    };
	})();
	
	/**
	 * Returns a string representation of a vector
	 *
	 * @param {vec3} vec vector to represent as a string
	 * @returns {String} string representation of the vector
	 */
	vec3.str = function (a) {
	    return 'vec3(' + a[0] + ', ' + a[1] + ', ' + a[2] + ')';
	};
	
	module.exports = vec3;
	


/***/ },
/* 3 */
/***/ function(module, exports) {

	/* Copyright (c) 2013, Brandon Jones, Colin MacKenzie IV. All rights reserved.
	
	Redistribution and use in source and binary forms, with or without modification,
	are permitted provided that the following conditions are met:
	
	  * Redistributions of source code must retain the above copyright notice, this
	    list of conditions and the following disclaimer.
	  * Redistributions in binary form must reproduce the above copyright notice,
	    this list of conditions and the following disclaimer in the documentation 
	    and/or other materials provided with the distribution.
	
	THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS IS" AND
	ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE IMPLIED
	WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE 
	DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT HOLDER OR CONTRIBUTORS BE LIABLE FOR
	ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES
	(INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES;
	LOSS OF USE, DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND ON
	ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT
	(INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE OF THIS
	SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE. */
	
	if(!GLMAT_EPSILON) {
	    var GLMAT_EPSILON = 0.000001;
	}
	
	if(!GLMAT_ARRAY_TYPE) {
	    var GLMAT_ARRAY_TYPE = (typeof Float32Array !== 'undefined') ? Float32Array : Array;
	}
	
	if(!GLMAT_RANDOM) {
	    var GLMAT_RANDOM = Math.random;
	}
	
	/**
	 * @class Common utilities
	 * @name glMatrix
	 */
	var glMatrix = {};
	
	/**
	 * Sets the type of array used when creating new vectors and matricies
	 *
	 * @param {Type} type Array type, such as Float32Array or Array
	 */
	glMatrix.setMatrixArrayType = function(type) {
	    GLMAT_ARRAY_TYPE = type;
	}
	
	
	var degree = Math.PI / 180;
	
	/**
	* Convert Degree To Radian
	*
	* @param {Number} Angle in Degrees
	*/
	glMatrix.toRadian = function(a){
	     return a * degree;
	}
	
	module.exports = {
	  GLMAT_EPSILON : GLMAT_EPSILON,
	  GLMAT_ARRAY_TYPE : GLMAT_ARRAY_TYPE,
	  GLMAT_RANDOM : GLMAT_RANDOM,
	  glMatrix : glMatrix
	};


/***/ },
/* 4 */
/***/ function(module, exports) {

	'use strict';
	var propIsEnumerable = Object.prototype.propertyIsEnumerable;
	
	function ToObject(val) {
		if (val == null) {
			throw new TypeError('Object.assign cannot be called with null or undefined');
		}
	
		return Object(val);
	}
	
	function ownEnumerableKeys(obj) {
		var keys = Object.getOwnPropertyNames(obj);
	
		if (Object.getOwnPropertySymbols) {
			keys = keys.concat(Object.getOwnPropertySymbols(obj));
		}
	
		return keys.filter(function (key) {
			return propIsEnumerable.call(obj, key);
		});
	}
	
	module.exports = Object.assign || function (target, source) {
		var from;
		var keys;
		var to = ToObject(target);
	
		for (var s = 1; s < arguments.length; s++) {
			from = arguments[s];
			keys = ownEnumerableKeys(Object(from));
	
			for (var i = 0; i < keys.length; i++) {
				to[keys[i]] = from[keys[i]];
			}
		}
	
		return to;
	};


/***/ },
/* 5 */
/***/ function(module, exports, __webpack_require__) {

	'use strict';
	
	var d        = __webpack_require__(6)
	  , callable = __webpack_require__(19)
	
	  , apply = Function.prototype.apply, call = Function.prototype.call
	  , create = Object.create, defineProperty = Object.defineProperty
	  , defineProperties = Object.defineProperties
	  , hasOwnProperty = Object.prototype.hasOwnProperty
	  , descriptor = { configurable: true, enumerable: false, writable: true }
	
	  , on, once, off, emit, methods, descriptors, base;
	
	on = function (type, listener) {
		var data;
	
		callable(listener);
	
		if (!hasOwnProperty.call(this, '__ee__')) {
			data = descriptor.value = create(null);
			defineProperty(this, '__ee__', descriptor);
			descriptor.value = null;
		} else {
			data = this.__ee__;
		}
		if (!data[type]) data[type] = listener;
		else if (typeof data[type] === 'object') data[type].push(listener);
		else data[type] = [data[type], listener];
	
		return this;
	};
	
	once = function (type, listener) {
		var once, self;
	
		callable(listener);
		self = this;
		on.call(this, type, once = function () {
			off.call(self, type, once);
			apply.call(listener, this, arguments);
		});
	
		once.__eeOnceListener__ = listener;
		return this;
	};
	
	off = function (type, listener) {
		var data, listeners, candidate, i;
	
		callable(listener);
	
		if (!hasOwnProperty.call(this, '__ee__')) return this;
		data = this.__ee__;
		if (!data[type]) return this;
		listeners = data[type];
	
		if (typeof listeners === 'object') {
			for (i = 0; (candidate = listeners[i]); ++i) {
				if ((candidate === listener) ||
						(candidate.__eeOnceListener__ === listener)) {
					if (listeners.length === 2) data[type] = listeners[i ? 0 : 1];
					else listeners.splice(i, 1);
				}
			}
		} else {
			if ((listeners === listener) ||
					(listeners.__eeOnceListener__ === listener)) {
				delete data[type];
			}
		}
	
		return this;
	};
	
	emit = function (type) {
		var i, l, listener, listeners, args;
	
		if (!hasOwnProperty.call(this, '__ee__')) return;
		listeners = this.__ee__[type];
		if (!listeners) return;
	
		if (typeof listeners === 'object') {
			l = arguments.length;
			args = new Array(l - 1);
			for (i = 1; i < l; ++i) args[i - 1] = arguments[i];
	
			listeners = listeners.slice();
			for (i = 0; (listener = listeners[i]); ++i) {
				apply.call(listener, this, args);
			}
		} else {
			switch (arguments.length) {
			case 1:
				call.call(listeners, this);
				break;
			case 2:
				call.call(listeners, this, arguments[1]);
				break;
			case 3:
				call.call(listeners, this, arguments[1], arguments[2]);
				break;
			default:
				l = arguments.length;
				args = new Array(l - 1);
				for (i = 1; i < l; ++i) {
					args[i - 1] = arguments[i];
				}
				apply.call(listeners, this, args);
			}
		}
	};
	
	methods = {
		on: on,
		once: once,
		off: off,
		emit: emit
	};
	
	descriptors = {
		on: d(on),
		once: d(once),
		off: d(off),
		emit: d(emit)
	};
	
	base = defineProperties({}, descriptors);
	
	module.exports = exports = function (o) {
		return (o == null) ? create(base) : defineProperties(Object(o), descriptors);
	};
	exports.methods = methods;


/***/ },
/* 6 */
/***/ function(module, exports, __webpack_require__) {

	'use strict';
	
	var assign        = __webpack_require__(7)
	  , normalizeOpts = __webpack_require__(14)
	  , isCallable    = __webpack_require__(15)
	  , contains      = __webpack_require__(16)
	
	  , d;
	
	d = module.exports = function (dscr, value/*, options*/) {
		var c, e, w, options, desc;
		if ((arguments.length < 2) || (typeof dscr !== 'string')) {
			options = value;
			value = dscr;
			dscr = null;
		} else {
			options = arguments[2];
		}
		if (dscr == null) {
			c = w = true;
			e = false;
		} else {
			c = contains.call(dscr, 'c');
			e = contains.call(dscr, 'e');
			w = contains.call(dscr, 'w');
		}
	
		desc = { value: value, configurable: c, enumerable: e, writable: w };
		return !options ? desc : assign(normalizeOpts(options), desc);
	};
	
	d.gs = function (dscr, get, set/*, options*/) {
		var c, e, options, desc;
		if (typeof dscr !== 'string') {
			options = set;
			set = get;
			get = dscr;
			dscr = null;
		} else {
			options = arguments[3];
		}
		if (get == null) {
			get = undefined;
		} else if (!isCallable(get)) {
			options = get;
			get = set = undefined;
		} else if (set == null) {
			set = undefined;
		} else if (!isCallable(set)) {
			options = set;
			set = undefined;
		}
		if (dscr == null) {
			c = true;
			e = false;
		} else {
			c = contains.call(dscr, 'c');
			e = contains.call(dscr, 'e');
		}
	
		desc = { get: get, set: set, configurable: c, enumerable: e };
		return !options ? desc : assign(normalizeOpts(options), desc);
	};


/***/ },
/* 7 */
/***/ function(module, exports, __webpack_require__) {

	'use strict';
	
	module.exports = __webpack_require__(8)()
		? Object.assign
		: __webpack_require__(9);


/***/ },
/* 8 */
/***/ function(module, exports) {

	'use strict';
	
	module.exports = function () {
		var assign = Object.assign, obj;
		if (typeof assign !== 'function') return false;
		obj = { foo: 'raz' };
		assign(obj, { bar: 'dwa' }, { trzy: 'trzy' });
		return (obj.foo + obj.bar + obj.trzy) === 'razdwatrzy';
	};


/***/ },
/* 9 */
/***/ function(module, exports, __webpack_require__) {

	'use strict';
	
	var keys  = __webpack_require__(10)
	  , value = __webpack_require__(13)
	
	  , max = Math.max;
	
	module.exports = function (dest, src/*, …srcn*/) {
		var error, i, l = max(arguments.length, 2), assign;
		dest = Object(value(dest));
		assign = function (key) {
			try { dest[key] = src[key]; } catch (e) {
				if (!error) error = e;
			}
		};
		for (i = 1; i < l; ++i) {
			src = arguments[i];
			keys(src).forEach(assign);
		}
		if (error !== undefined) throw error;
		return dest;
	};


/***/ },
/* 10 */
/***/ function(module, exports, __webpack_require__) {

	'use strict';
	
	module.exports = __webpack_require__(11)()
		? Object.keys
		: __webpack_require__(12);


/***/ },
/* 11 */
/***/ function(module, exports) {

	'use strict';
	
	module.exports = function () {
		try {
			Object.keys('primitive');
			return true;
		} catch (e) { return false; }
	};


/***/ },
/* 12 */
/***/ function(module, exports) {

	'use strict';
	
	var keys = Object.keys;
	
	module.exports = function (object) {
		return keys(object == null ? object : Object(object));
	};


/***/ },
/* 13 */
/***/ function(module, exports) {

	'use strict';
	
	module.exports = function (value) {
		if (value == null) throw new TypeError("Cannot use null or undefined");
		return value;
	};


/***/ },
/* 14 */
/***/ function(module, exports) {

	'use strict';
	
	var forEach = Array.prototype.forEach, create = Object.create;
	
	var process = function (src, obj) {
		var key;
		for (key in src) obj[key] = src[key];
	};
	
	module.exports = function (options/*, …options*/) {
		var result = create(null);
		forEach.call(arguments, function (options) {
			if (options == null) return;
			process(Object(options), result);
		});
		return result;
	};


/***/ },
/* 15 */
/***/ function(module, exports) {

	// Deprecated
	
	'use strict';
	
	module.exports = function (obj) { return typeof obj === 'function'; };


/***/ },
/* 16 */
/***/ function(module, exports, __webpack_require__) {

	'use strict';
	
	module.exports = __webpack_require__(17)()
		? String.prototype.contains
		: __webpack_require__(18);


/***/ },
/* 17 */
/***/ function(module, exports) {

	'use strict';
	
	var str = 'razdwatrzy';
	
	module.exports = function () {
		if (typeof str.contains !== 'function') return false;
		return ((str.contains('dwa') === true) && (str.contains('foo') === false));
	};


/***/ },
/* 18 */
/***/ function(module, exports) {

	'use strict';
	
	var indexOf = String.prototype.indexOf;
	
	module.exports = function (searchString/*, position*/) {
		return indexOf.call(this, searchString, arguments[1]) > -1;
	};


/***/ },
/* 19 */
/***/ function(module, exports) {

	'use strict';
	
	module.exports = function (fn) {
		if (typeof fn !== 'function') throw new TypeError(fn + " is not a function");
		return fn;
	};


/***/ }
/******/ ])
});
;
//# sourceMappingURL=dolly.js.map