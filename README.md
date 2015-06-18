# Dolly

A JavaScript library representing a set of objects that can follow each other in 3D space. It was conceived for virtual camera control, but can be used to control any object.

Dolly is inspired by [The Theory and Practice of Cameras in Side-Scrollers](https://docs.google.com/document/d/1iNSQIyNpVGHeak6isbP6AHdHD50gs8MNXF1GCf08efg/pub) and [Insanely Twisted Shadow Planet](https://www.youtube.com/watch?v=aAKwZt3aXQM).

## Examples

- [Line Chart](https://povdocs.github.io/dolly-chart-example) ([source](https://github.com/povdocs/dolly-chart-example)) using 2d canvas

## Installation

### Install with npm

```
npm install --save dolly
```

### Download

The following files are available to download and include in your html. The minified script is recommended.

- [dolly.js](https://raw.githubusercontent.com/povdocs/dolly/master/dist/dolly.js) (unminified script)
- [dolly.js.map](https://raw.githubusercontent.com/povdocs/dolly/master/dist/dolly.js.map) (source map for unminified script)
- [dolly.min.js](https://raw.githubusercontent.com/povdocs/dolly/master/dist/dolly.min.js) (unminified script)
- [dolly.min.js.map](https://raw.githubusercontent.com/povdocs/dolly/master/dist/dolly.min.js.map) (source map for unminified script)

## Usage

Three kinds of objects are included: `Dolly`, `Prop` and `Vector`. `Dolly` manages the scene and includes all props. `Prop` represents an object within the scene. Any prop can behave as a follower, a target or an attractor of other props. Certain properties on the `Prop` objects, like position and velocity, are represented as `Vector` objects.

### `Dolly`

Constructor for creating a new `Dolly` instance, which will manage all objects in a scene.

### Methods

#### `update(delta)`

Updates all objects, moving each one closer to its target position. It's typically called at the beginning of a render function.

##### Parameters
- `delta` - Number of seconds since the last update

#### `prop(options)`

Creates a new prop object. Takes one parameter, an object representing a hash of options.

##### Options
- `name` - An optional string. Doesn't do anything but is useful for tracking the prop in a debugger.
- `position` - the initial position of the prop. A 3D vector, specified either as array of numbers (`[x, y, z]`) or as an object (`{ x: x, y: y: z: z}`).
- `minBounds` - vector representing the minimum bounds of a cube outside of which the prop cannot travel.
- `maxBounds` - vector representing the maximum bounds of a cube outside of which the prop cannot travel.
- `lag` - (number) how much the prop lags behind other props it's following. Default is 0, which matches the target prop exactly.
- `maxSpeed` - (number) the maximum speed (unit distance per second) the prop can move to follow its targets.

### Methods

#### `active(epsilon)`

Returns a boolean indicating whether any props have moved in the last update. It's useful to avoid unnecessarily re-rendering a scene that may not have changed.

##### Parameters
- `epsilon` - An optional margin of error used to determine whether an object has moved. Sometimes props move a very small amount that won't show up in the output. Default is `0.00001`.

### `Prop`

Prop objects cannot be created with a constructor. They are created by calling the `.prop` method on a `Dolly` object.

### Methods

All methods except `active` return the object, so calls can be chained.

#### `follow(prop, options)`

Takes one parameter, an object representing a hash of options.

##### Parameters
- `prop` - The target prop to follow. Can be a single object or an array of `Prop` objects to all be followed with the same set of options.
- `options`
    + `weight` - when following multiple props, the target position will be a weighted average of all the different props. This can be specified as a number or as a vector, to use different weights on different axes. Default: `[1, 1, 1]`
    + `radius` - (number) as long as the prop is within this distance of the target position, it will have no effect. i.e., don't start following the target until it moves a certain distance away. Default: `0`
    + `offset` - (vector) places the target point to a position relative to the prop being followed. Useful if you always want to maintain a fixed distance from the target in any direction.

#### `attract(prop, subject, options)`

Sets up an attractor, which takes control over from the followed target(s) as an object approaches it and draws the follower to a fixed position.

##### Parameters
- `prop` - the prop that is being tracked. As this object approaches the `subject`, the attractor takes over.
- `subject` - the prop that becomes the attractor. As `prop` approaches `subject`, the object on which `.attract` was called gets drawn to the subject.
- `options`
    + `weight` - when attracted multiple props, the target position will be a weighted average of all the different props. This can be specified as a number or as a vector, to use different weights on different axes. Default: `[1, 1, 1]`
    + `outerRadius` - (number) when the `prop` is farther away from `subject` than `outerRadius`, the attractor has no effect.
    + `innerRadius` - (number) when the `prop` is clsoer to `subject` than `innerRadius`, the attractor has full effect and any other targets set up by `follow` are ignored. Between `outerRadius` and `innerRadius`, there is a gradual linear transition between the two effects.
    + `offset` - (vector) places the target point to a position relative to the subject.

#### `active(epsilon)`

Returns a boolean indicating whether this prop has moved in the last update.

##### Parameters
- `epsilon` - An optional margin of error used to determine whether an object has moved. Sometimes props move a very small amount that won't show up in the output. Default is `0.00001`.

### Events

`Prop` objects support a number of event callbacks, which can be registered using the [event emitter](https://github.com/medikoo/event-emitter) interface.

#### updatestart

Fires before this prop is about to be updated. This is a good place to set the position of an object that is being followed, when it's being determined by other code, like a physics engine or keyboard/mouse controls.

##### Callback parameters

- `position` - a vector representing the position of this prop

#### update

A prop's target position has been calculated, and it is about to be moved toward it. The callback is passed the current position and projected velocity, which may be modified before the prop is moved.

##### Callback parameters

- `position` - a vector representing the position of this prop
- `velocity` - a vector representing the velocity of this prop towards its target

#### updated

The prop has been moved and is done being updated for this cycle.

##### Callback parameters

- `position` - a vector representing the updated position of this prop

#### enterattractor

Fires when a follow prop has entered the `outerRadius` of an attractor and this prop has begun being affected by it.

##### Callback parameters

- `prop` - the prop that approached the attractor
- `subject` - the prop doing the attracting
- `attraction` - a number from 0 to 1 representing the fraction of the distance between `outerRadius` and `innerRadius`, or the amount that the attractor affecting the position of the target prop.

#### enterattractor

Fires when a follow prop moves within the `outerRadius` of an attractor and the attraction amount changes.

##### Callback parameters

- `prop` - the prop that approached the attractor
- `subject` - the prop doing the attracting
- `attraction` - a number from 0 to 1 representing the fraction of the distance between `outerRadius` and `innerRadius`, or the amount that the attractor affecting the position of the target prop.

#### leaveattractor

Fires when a follow prop moves outside the `outerRadius` of an attractor and the effect no longer applies.

##### Callback parameters

- `prop` - the prop that left the attractor
- `subject` - the prop doing the attracting

## Roadmap
- Support for matching orientation as well as position
- Define object constraints by their own local coordinates, accounting for rotation
- Move along a Z axis to keep multiple targets in view

## License
Original code is made avalable under [MIT License](http://www.opensource.org/licenses/mit-license.php), Copyright (c) 2015 American Documentary Inc.

## Author
Code, concept and design by [Brian Chirls](https://github.com/brianchirls), [POV](http://www.pbs.org/pov/) Digital Technology Fellow
