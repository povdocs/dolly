'use strict';

//dependencies
var Vector = require('./vector');
var assign = require('object-assign'); //todo: use babel
var eventEmitter = require('event-emitter');

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
	for (i = 0; i <3; i++) {
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

	target = assign(
		{
			prop: prop,
			radius: 0,
			minDistance: 0,
			maxDistance: Infinity,
			weight: 1
		},
		options,
		{
			weight: makeVector(weight),
			offset: makeVector(options && options.offset),
			offsetPosition: new Vector()
		}
	);

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

	attractor = assign(
		{
			prop: prop, //the object that moves
			subject: subject, //the point of interest
			innerRadius: 0,
			outerRadius: 0,
			weight: 1
		},
		options,
		{
			offset: makeVector(options && options.offset),
			offsetPosition: new Vector(),
			attraction: 0
		}
	);

	this.attractors.push(attractor);

	return this;
};

Prop.prototype.update = function (delta, tick) {
	var totalAttractionWeight = 0;
	var totalAttraction = 0;

	//prevent infinite loops if follower graph is cyclical
	if (this.lastUpdate >= tick || tick === undefined) {
		return;
	}

	this.lastUpdate = tick;

	this.emit('updatestart', this.position);

	if (!this.targets.length) {
		return;
	}

	this.attractorGoal.zero();
	this.attractors.forEach((attractor) => {
		var distance;
		var attraction = 0;
		var lastAttraction = attractor.attraction;

		attractor.prop.update(delta, tick);
		attractor.subject.update(delta, tick);

		distance = attractor.prop.position.distance(attractor.subject.position);
		if (distance < attractor.outerRadius) {
			attraction = Math.min(1, (attractor.outerRadius - distance) / (attractor.outerRadius - attractor.innerRadius));
			totalAttraction += attraction * attractor.weight;
			totalAttractionWeight += attractor.weight;

			attractor.offsetPosition.copyVector(attractor.subject.position).add(attractor.offset);
			this.attractorGoal.scaleAndAdd(attractor.offsetPosition, attractor.weight);

			attractor.attraction = attraction;
			if (!lastAttraction) {
				attractor.prop.emit('enterattractor', attractor.subject, attraction);
			} else if (lastAttraction !== attraction) {
				attractor.prop.emit('moveattractor', attractor.subject, attraction);
			}
		} else if (attractor.attraction) {
			attractor.attraction = attraction;
			attractor.prop.emit('leaveattractor', attractor.subject);
		}
	});
	if (totalAttractionWeight) {
		this.attractorGoal.scale(1 / totalAttractionWeight);
		totalAttraction /= totalAttractionWeight;
	}

	totalWeight.zero();
	this.goal.zero();
	if (totalAttraction < 1) {
		this.targets.forEach((target) => {
			var distance;

			target.prop.update(delta, tick);

			target.offsetPosition.copyVector(target.prop.position).add(target.offset);

			scratch.copyVector(target.offsetPosition).subtract(this.position); //vector towards target

			target.offsetPosition.copyVector(this.position);
			distance = scratch.length();
			if (distance > target.radius) {
				scratch.normalize().scale(distance - target.radius);
				target.offsetPosition.add(scratch);
			}

			target.offsetPosition.multiply(target.weight);
			this.goal.add(target.offsetPosition);
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
}

module.exports.Dolly = Dolly;