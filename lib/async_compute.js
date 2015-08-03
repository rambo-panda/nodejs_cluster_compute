
"use strict";

// 依赖插件
var _     = require('lodash'),
	async = require('async');

/**
* 一个函数减缓的辅助函数
* @param  fn      Function : 要执行的函数
* @param  over_cb Function : 该系列函数执行完毕后，最终调用的函数
* @param  delay   Number   : 多少时间后执行 单位ms
* @param  scope   Object   : 指定上下文
*
* @return Function
*/
var intermediate_run = function(fn, over_cb, delay, scope) {

	delay ||(delay = 10);

	var index = 0,
		done_fn_args = { },
		delay_timer = null,
		actual_run_count = 0;

	over_cb = _.isFunction(over_cb) ? over_cb : _.noop;

	return function () {

		done_fn_args[actual_run_count] = _.toArray(arguments);

		actual_run_count++;

		var context = scope || this,
			done_fn = function(immediate){

				var args =  done_fn_args[index];

				index++;

				fn.apply(context, args);

				if(index >= actual_run_count){

					clearInterval(delay_timer);

					delay_timer = null;

					over_cb.apply(context, args);

					return;

				}

			};

		delay_timer === null && (delay_timer = setInterval(done_fn, delay));

	};

};

/**
* 将数组分割成新的数组[二维数组]
* @param array 需要分割的数组
* @param size  分割每个子数组的长度
*
* @return [ [x,y,z], [a,b,c] ...] 分割后的二维数组
*
* @TODO 该函数只是 [弱引用] 因此如果你想保证你的数据完整性 使用前自行决定是否clone  (btw: Mongoose Object can not use lodash clone)
*
*/
var new_array_slice_array_by_size = function(array, size){

	size = +size;

	if( ! ( size > 0 && _.isArray(array) && array.length > size ) ){
		return [array];
	}

	var slice_length= parseInt(array.length / size),
		remain = array.length % size;  // 剩余量

	var built_array = [],
		slice_total_length = remain === 0 ? slice_length : (slice_length + 1), // 共分多少份
		index = 1;

	for ( ; index <= slice_total_length; index++) {
		var start = size * (index-1),
			end=(index > slice_length ) ?
				(index-1) * size + remain :  // 剩余量的判断
				index * size;

		built_array.push(array.slice(start, end));
	}

	return built_array;
};

Array.prototype.slice_by_size = function(size){
	return new_array_slice_array_by_size(this, size);
};

/**
* @description   用来将大量计算利用分片化成间歇式操作
*
* @param array         Array    操作数据
* @param action_fn     Function 操作动作              default : _.noop
* @param over_cb       Function 全部完成后的回调函数  default : _.noop
* @param slice_length  Number   分片时 每片分多少?    default 500
*
* @return Function
*
*/
var intermediate_by_array = function(array, action_fn, over_cb, slice_length){

	if( ! (_.isArray(array) && array.length > 0) ){
		return over_cb(array);
	}

	var slice_array = array.slice_by_size(slice_length || 500),
		intermediate_run_fn = intermediate_run(
			action_fn || _.noop
		),
		_over_cb = function(){
			(over_cb || _.noop).apply(this, arguments);

			intermediate_run_fn = null;  // 强制触发GC回收
		};

	async.eachLimit(slice_array, 1, intermediate_run_fn, _over_cb);

};


_.extend(module.exports, {
	intermediate_by_array  : intermediate_by_array
});
