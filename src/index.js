'use strict';

//dependencies
var Vector = require('./vector');
var assign = require('object-assign'); //todo: use babel
var eventEmitter = require('event-emitter');

var propId = 0;

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
	this.speed = typeof options.speed === 'number' && !isNaN(options.speed) ? options.speed : 1;

	this.goal = new Vector();
	this.velocity = new Vector();
	this.targets = [];

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
			innerRadius: 0,
			outerRadius: 0,
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

Prop.prototype.update = function (delta, tick) {
	var totalWeight = 0;
	if (this.lastUpdate >= tick || tick === undefined) {
		return;
	}

	this.lastUpdate = tick;

	this.emit('updatestart', this.position);

	if (!this.targets.length) {
		return;
	}

	this.goal.zero();
	this.targets.forEach((target) => {
		totalWeight += target.weight;
		target.offsetPosition.copy(target.prop.position).add(target.offset);
		this.goal.scaleAndAdd(target.offsetPosition, target.weight);
	});
	if (totalWeight) {
		this.goal.scale(1 / totalWeight);
	}

	//todo: set velocity toward goal and
	this.velocity.copy(this.goal).scaleAndAdd(this.position, -1);
	this.velocity.scale(this.speed); //todo: replace with 1 / lag?, make sure we don't go past

	this.emit('update', this.position, this.velocity);

	this.position.scaleAndAdd(this.velocity, delta);

	//todo: lerp with Points of Interest/Attractors

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