"use strict";

var util          = require('util'),
	existsSync    = require('fs').existsSync,
	child_process = require('child_process'),
	events        = require('events'),
	path          = require('path'),
	os            = require('os'),

	isFunction = function(fn){
		return fn && Object.prototype.toString.call(fn).toUpperCase() === '[OBJECT FUNCTION]';
	},
	get_now_ms = function(date_tag){
		return +new Date();
	},
	get_env_for_worker_by_process = function(){
		var env = {},
			key,
			process_envs = process.env;

		for(key in process_envs){
			if(
				//env.NODE_WORKER_ID; Node.js cluster worker marker for v0.6
				//env.NODE_UNIQUE_ID; Node.js cluster worker marker for v0.7
				process_envs.hasOwnProperty(key) && ['NODE_UNIQUE_ID', 'NODE_WORKER_ID'].indexOf(key) === -1
			){
				env[key] = process_envs[key];
			}
		}

		return env;
	};


var MAX_ALLOW_WORK_COUNT = 100;

var ClusterCompute = function(options){

	options || (options = {});

	var self = this;

	self.base_path =  options.base_path || path.join( __dirname, './large_calculation');
	self.file_path = path.join(self.base_path, options.file_name);
	if(!existsSync(self.file_path)){
		throw "file_name doesn't exist: " + self.file_path;
	}

	// an array of child processes
	self._kids = {};
	self._MAX_KIDS = ( +options.max_processes || Math.ceil(os.cpus().length * 1.25));
	self.worker_queue = [];



	self.max_queue = +options.max_queue || self._MAX_KIDS * 10;
	self.timeout_ms = +options.time_out || 0;
	self.work_duration = 0;
	self.amount_worked = 0;

	events.EventEmitter.call(self);

};

ClusterCompute.send = function(){
	process.send(
		Array.prototype.slice.call(arguments)
	);
};

util.inherits(ClusterCompute, events.EventEmitter);

ClusterCompute.prototype.get_free_worker = function(){

	var self = this,
		_kids = self._kids,
		kids_keys = Object.keys(_kids),
		key;

	for (key in _kids ){
		if(_kids.hasOwnProperty(key) && !_kids[key].job){
			return _kids[key];
		}
	}

	// no workers!  can we spawn one?
	if(kids_keys.length < this._MAX_KIDS){

		var worker = {
				worker: child_process.fork(
					self.file_path,
					[],
					{ env: get_env_for_worker_by_process() }
				)
			},
			pid = worker.worker.pid;

		self._kids[pid] = worker;

		return worker;
	}

	// TODO return default worker;

};

ClusterCompute.prototype.run_work_on_worker = function(work, worker){

	var self = this,
		startTime = get_now_ms();  // FIXME use moment

	worker.worker.once('message', function(msg){

		// clear the in-progress job
		var cb = worker.job.cb;

		worker.job = null;

		// start the next
		self.dequeue();

		// call our client's callback
		isFunction(cb) && cb.apply(self, msg);

		var ms_diff = (get_now_ms() - startTime);

		if(self.timeout_ms && self.amount_worked >= (2 * self._MAX_KIDS)){

			var history = (self.amount_worked > MAX_ALLOW_WORK_COUNT) ? MAX_ALLOW_WORK_COUNT : self.amount_worked;

			self.work_duration = ((self.work_duration * history) + ms_diff) / (history + 1);

		}

		self.amount_worked++;
	});

	worker.worker.send(work.job);
	worker.job = work;
};

ClusterCompute.prototype.dequeue = function(){
	var self = this,
		worker_queue = self.worker_queue;

	while(worker_queue.length > 0){

		var worker = self.get_free_worker();

		if(!worker){
			break;
		}

		self.run_work_on_worker(
			worker_queue.shift(),
			worker
		);
	}
};

ClusterCompute.prototype.enqueue = function(args, cb){

	var self = this,
		numWorkers = Object.keys(self._kids).length,
		worker_queue = self.worker_queue;

	if(!isFunction(cb)){
		return self;
	}

	// maximum allowed request time check
	if(
		self.timeout_ms &&
		self.amount_worked > (2 * self._MAX_KIDS) &&
		numWorkers > 0
	){

		// how long would self work take?
		var expected = ( worker_queue.length / numWorkers * self.work_duration + self.work_duration ) / 1000.0;

		if(expected > self.timeout_ms){

			process.nextTick(function(){
				cb("cannot enqueue work: maximum expected work duration exceeded (" + expected + "s)");
			});
			return self;
		}
	}

	// backlog size check
	var max_queue = self.max_queue;

	if(max_queue > 0 && worker_queue.length >= max_queue){

		process.nextTick(function(){
			cb("cannot enqueue work: maximum backlog exceeded (" + max_queue + ")");
		});

		return self;
	}

	self.worker_queue.push(
		{
			job: args,
			cb: cb
		}
	);

	self.dequeue();

	return self;
};

ClusterCompute.prototype.exit = function(){

	var self = this,
		_kids = self._kids,
		_kids_length = Object.keys(_kids).length;

	if(_kids_length > 0){

		var key;

		for(key in _kids){
			if(_kids.hasOwnProperty(key)){
				_kids[key].worker.kill();
			}
		}

		self._kids = {};
	}

	self = null;

};

module.exports = ClusterCompute;
