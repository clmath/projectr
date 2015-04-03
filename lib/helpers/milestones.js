/**
 * This module provides helper to interact with Github milestones.
 * @module lib/helpers/milestones
 * @type {Object}
 */
/**
 * @external https
 */
var https = require("./https");

module.exports = {
	/**
	 * @promise Close
	 * @resolve {undefined} If the milestone was successfully closed.
	 * @reject {string} If there was an error while sending the request.
	 * @reject {https.IncomingMessage} If something wrong happens on the server while closing the milestone.
	 */
	/**
	 * @typedef {Object} Milestone
	 * @property number {string}
	 */
	/**
	 * Close a Github milestone.
 	 * @param user {string}
	 * @param repoName {string}
	 * @param milestone {Milestone}
	 * @returns {Close}
	 */
	close: function (user, repoName, milestone) {
		var data = {state: "closed"};
		return https.post("/repos/" + user + "/" + repoName + "/milestones/" + milestone.number, data);

	}
};