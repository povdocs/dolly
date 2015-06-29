(function webpackUniversalModuleDefinition(root, factory) {
	if(typeof exports === 'object' && typeof module === 'object')
		module.exports = factory(require("gl-matrix-vec3"), require("object-assign"), require("event-emitter"));
	else if(typeof define === 'function' && define.amd)
		define(["gl-matrix-vec3", "object-assign", "event-emitter"], factory);
	else if(typeof exports === 'object')
		exports["Dolly"] = factory(require("gl-matrix-vec3"), require("object-assign"), require("event-emitter"));
	else
		root["Dolly"] = factory(root["gl-matrix-vec3"], root["object-assign"], root["event-emitter"]);
})(this, function(__WEBPACK_EXTERNAL_MODULE_2__, __WEBPACK_EXTERNAL_MODULE_3__, __WEBPACK_EXTERNAL_MODULE_4__) {
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
	var assign = __webpack_require__(3); //todo: use babel
	var eventEmitter = __webpack_require__(4);
	
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
/***/ function(module, exports) {

	module.exports = __WEBPACK_EXTERNAL_MODULE_2__;

/***/ },
/* 3 */
/***/ function(module, exports) {

	module.exports = __WEBPACK_EXTERNAL_MODULE_3__;

/***/ },
/* 4 */
/***/ function(module, exports) {

	module.exports = __WEBPACK_EXTERNAL_MODULE_4__;

/***/ }
/******/ ])
});
;
//# sourceMappingURL=index.js.map