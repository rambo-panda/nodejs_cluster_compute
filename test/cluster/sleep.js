/* Copyright (c) 2013-2014 YunZhongXiaoNiao Tech */
"use strict";

var ClusterEvent = require('../../../lib/cluster_event'),
	sleep =  function(ms){
		var now_ms;

		for(now_ms = Date.now(); Date.now() - now_ms <= ms;);
	};

process.on('message', function(ms) {

	setTimeout(function() {
		sleep(ms);
		ClusterEvent.send(null, 'sleep is okay');
	}, ms);

});
