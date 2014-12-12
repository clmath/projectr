var request = require("https").request;
var q = require("promised-io/promise");

function getOptions(path, method) {
	var options = {
		hostname: "api.github.com",
		path: path,
		method: method,
		headers: {
			"user-agent": "nodejs",
			"accept": "application/vnd.github.v3.raw+json",
		}
	};

	if (GLOBAL.username && GLOBAL.password) {
		options.auth = GLOBAL.username + ":" + GLOBAL.password;
	}

	return options;
}

function promiseRequest(path, method, data, cb) {
	var deferred = new q.Deferred();

	if (data) {
		data = JSON.stringify(data);
	}

	request(getOptions(path, method), function (res) {
		cb(res, deferred);
	}).on("error", function (e) {
		console.log(JSON.stringify(e));
		deferred.reject(JSON.stringify(e));
	}).end(data);

	return deferred.promise;
}


module.exports = {
	get: function (path) {
		return promiseRequest(path, "GET", undefined, function (res, deferred) {
			var statusCode = res.statusCode;
			if (statusCode === 404) {
				deferred.resolve();
			} else if (statusCode === 200) {
				var data = "";
				res.on("data", function (chunk) {
					data += chunk.toString();
				});

				res.on("end", function () {
					deferred.resolve(data);
				});
			} else {
				console.log(path + ": " + "HTTP GET Error " + statusCode);
				deferred.reject(res);
			}
		});
	},

	getJSON: function (path) {
		return this.get(path).then(function (data) {
			return JSON.parse(data);
		});
	},

	post: function (path, data) {
		return promiseRequest(path, "POST", data, function (res, deferred) {
			var statusCode = res.statusCode;
			if (statusCode === 200 || statusCode === 201) {
				deferred.resolve();
			} else {
				console.log(path + ": " + "HTTP POST Error " + statusCode);
				deferred.reject(res);
			}
		});
	}
};
