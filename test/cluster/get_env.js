/* Copyright (c) 2013-2014 YunZhongXiaoNiao Tech */
"use strict";

process.on('message', function(msg) {
	process.send(
		[
			null,
			{ key: msg, value: process.env[msg] }
		]
	);
});
