'use strict';

//dependencies
var Vector = require('./vector');
var assign = require('object-assign'); //todo: use babel
var eventEmitter = require('event-emitter');

var propId = 0;
var scratch = new Vector();

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

function Prop(opts) {
	var options = opts || {};

	this.lastUpdate = -1;
	this.id = propId++;

	this.name = options.name || 'prop' + this.id;

	this.position = makeVector(options.position);
	this.minBounds = makeVector(options.minBounds === undefined ? -Infinity : options.minBounds);
	this.maxBounds = makeVector(options.maxBounds === undefined ? Infinity : options.maxBounds);
	this.lag = typeof options.lag === 'number' && !isNaN(options.lag) ? options.lag : 0;

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

	if (Array.isArray(prop)) {
		prop.forEach(function (p) {
			self.follow(p, options);
		});
		return;
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
			offset: makeVector(options && options.offset),
			offsetPosition: new Vector()
		}
	);

	this.targets.push(target);
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
			offsetPosition: new Vector()
		}
	);

	this.attractors.push(attractor);
};

Prop.prototype.update = function (delta, tick) {
	var totalWeight = 0;
	var totalAttraction = 0;

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
		// attractor.offsetPosition.copy(attractor.prop.position).add(attractor.offset);
		distance = attractor.prop.position.distance(attractor.subject.position);
		if (distance < attractor.outerRadius) {
			attraction = Math.min(1, (attractor.outerRadius - distance) / (attractor.outerRadius - attractor.innerRadius));
			totalAttraction += attraction * attractor.weight;
			totalWeight += attractor.weight;

			attractor.offsetPosition.copy(attractor.subject.position).add(attractor.offset);
			this.attractorGoal.scaleAndAdd(attractor.offsetPosition, attractor.weight);
		}
	});
	if (totalWeight) {
		this.attractorGoal.scale(1 / totalWeight);
		totalAttraction /= totalWeight;
	}

	totalWeight = 0;
	this.goal.zero();
	if (totalAttraction < 1) {
		this.targets.forEach((target) => {
			var distance;

			target.offsetPosition.copy(target.prop.position).add(target.offset);

			scratch.copy(target.offsetPosition).subtract(this.position); //vector towards target

			target.offsetPosition.copy(this.position);
			distance = scratch.length();
			if (distance > target.radius) {
				scratch.normalize().scale(distance - target.radius);
				target.offsetPosition.add(scratch);
			}

			this.goal.scaleAndAdd(target.offsetPosition, target.weight);
			totalWeight += target.weight;
		});
		if (totalWeight) {
			this.goal.scale(1 / totalWeight);
		}
		if (totalAttraction) {
			this.goal.lerp(this.attractorGoal, totalAttraction);
		}
	} else {
		this.goal.copy(this.attractorGoal);
	}

	this.velocity.copy(this.goal).subtract(this.position);
	if (this.lag) {
		this.velocity.scale(Math.pow(delta, this.lag));
	}

	//todo: cap velocity to maxSpeed

	this.emit('update', this.position, this.velocity);

	this.position.add(this.velocity);

	//fit within bounds
	this.position.min(this.maxBounds).max(this.minBounds);

	this.emit('updated', this.position);
};

function Dolly() {
	var tick = -1;
	var props = [];
	var updating = false;

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
	};

	this.prop = function (options) {
		var prop = new Prop(options);
		props.push(prop);
		return prop;
	};
}

module.exports.Dolly = Dolly;