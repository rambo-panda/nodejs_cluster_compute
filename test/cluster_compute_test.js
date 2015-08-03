/*global suite:true, test: true */
/* Copyright (c) 2013-2014 YunZhongXiaoNiao Tech */
"use strict";

var ClusterEvent = require('../../lib/cluster_event'),

	path = require('path'),
	_ = require('lodash'),
	should = require('should');

suite('lib cluster_event', function(){

	this.timeout(10000);

	var base_path = path.join( __dirname, './../fixture/cluster');

	test('sleep should success if normal', function(done){

		var ce = new ClusterEvent(
			{
				base_path : base_path,
				file_name : 'sleep.js'
			}
		);

		ce.enqueue(
			1000,
			function(err, result){
				should.equal(null, err);
				should.equal(result, 'sleep is okay');
				ce.exit();
				done();
			}
		);

	});

	test('get_env_process should success if normal', function(done){
		var ce = new ClusterEvent(
			{
				base_path : base_path,
				file_name : 'get_env.js'
			}
		);

		should.equal(true, _.isObject(ce));

		process.env.UNIT_TEST = 'GET_ENV';

		ce.enqueue('UNIT_TEST', function(err, obj){
			obj.should.be.eql({
				key : 'UNIT_TEST',
				value : 'GET_ENV'
			});
			ce.exit();
			done();
		});
	});

});
