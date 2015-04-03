/**
 * This module provides helper to send https request to the github api.
 * @module lib/helpers/https
 * @type {Object}
 */

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
	/**
	 * @promise MyPromise
	 * @resolve {URI} the company URI
	 * @reject {String} if name is empty
	 * @reject {NetworkError} if a network error occurs while making the request
	 */

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
	/**
	 * @typedef https/poste {Promise}
	 * @property resolve {undefined} If the request was successfully executed.
	 * @property reject {string} If there was an error while sending the request.
	 * @property reject {https.IncomingMessage} If the server replied with an error statuscode.
	 */
	/**
	 * Make a post request to the github api and return a promise with the result.
	 * @param path {string} Path to send the request to.
	 * @param data {Object} Data to send in the request.
	 * @returns {https/poste}
	 */
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
