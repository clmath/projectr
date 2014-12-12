function objectUtilsGenerator(func) {
	return function (object, cb) {
		if (typeof object[func] === "function") {
			return object[func](cb);
		} else {
			return Object.keys(object)[func](cb);
		}
	};
}

var forEach = objectUtilsGenerator("forEach");

module.exports = {
	isEmpty: function (object) {
		return Object.keys(object).length === 0;
	},

	mixin: function (dest, src) {
		forEach(src, function (prop) {
			dest[prop] = src[prop];
		});
		return dest;
	},

	forEach: forEach,
	map: objectUtilsGenerator("map")
};
