var express = require('express');
var router = express.Router();
var FB = require('facebook-node');
var async = require('async');
var Models = require('telepat-models');
var security = require('./security');
var jwt = require('jsonwebtoken');
var crypto = require('crypto');
var microtime = require('microtime-nodejs');

var options = {
	client_id:          '1086083914753251',
	client_secret:      '40f626ca66e4472e0d11c22f048e9ea8'
};

FB.options(options);

router.use(security.deviceIdValidation);
router.use(security.applicationIdValidation);
router.use(security.apiKeyValidation);

router.use(['/logout', '/me', '/update', '/update_immediate', '/delete'], security.tokenValidation);

/**
 * @api {post} /user/login Login
 * @apiDescription Log in the user through facebook User is not created immediately.
 * @apiName UserLogin
 * @apiGroup User
 * @apiVersion 0.2.3
 *
 * @apiHeader {String} Content-type application/json
 * @apiHeader {String} X-BLGREQ-APPID Custom header which contains the application ID
 * @apiHeader {String} X-BLGREQ-SIGN Custom header containing the SHA256-ed API key of the application
 * @apiHeader {String} X-BLGREQ-UDID Custom header containing the device ID (obtained from devie/register)
 *
 * @apiParam {String} access_token Facebook access token.
 *
 * @apiExample {json} Client Request
 * 	{
 * 		"access_token": "fb access token"
 * 	}
 *
 * 	@apiSuccessExample {json} Success Response
 * 	{
 * 		"status": 200,
 * 		"content": {
 * 			"token": "eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJlbWFpbCI6ImdhYmlAYXBwc2NlbmQuY29tIiwiaXNBZG1pbiI6dHJ1ZSwi
 * 			aWF0IjoxNDMyOTA2ODQwLCJleHAiOjE0MzI5MTA0NDB9.knhPevsK4cWewnx0LpSLrMg3Tk_OpchKu6it7FK9C2Q"
 * 			"user": {
 * 				 "id": 31,
 *				"type": "user",
 * 				"email": "abcd@appscend.com",
 * 				"fid": "facebook_id",
 * 				"devices": [
 *					"466fa519-acb4-424b-8736-fc6f35d6b6cc"
 *				],
 *				"friends": [],
 *				"password": "acb8a9cbb479b6079f59eabbb50780087859aba2e8c0c397097007444bba07c0"
 *			}
 * 		}
 * 	}
 *
 * 	@apiError 400 [028]InsufficientFacebookPermissions User email is not publicly available
 * 	(insufficient facebook permissions)
 * 	@apiError 404 [023]UserNotFound User not found
 *
 */
router.post('/login', function(req, res, next) {
	if (!req.body.access_token)
		return next(new Models.TelepatError(Models.TelepatError.errors.MissingRequiredField, ['access_token']));

	var accessToken = req.body.access_token;
	var email = null;
	var userProfile = null;
	var fbProfile = null;
	var deviceId = req._telepat.device_id;
	var appId = req._telepat.applicationId;

	async.waterfall([
		//Retrieve facebook information
		function(callback) {
			FB.napi('/me', {access_token: accessToken}, function(err, result) {
				if (err) return callback(err);
				email = result.email;
				fbProfile = result;

				if (!email) {
					callback(new Models.TelepatError(Models.TelepatError.errors.InsufficientFacebookPermissions));
				}

				callback();
			});
		},
		function(callback) {
			//try and get user profile from DB
			Models.User(email, appId, function(err, result) {
				if (err && err.status == 404) {
					callback(new Models.TelepatError(Models.TelepatError.errors.UserNotFound));
				}
				else if (err)
					callback(err);
				else {
					userProfile = result;
					callback();
				}
			});
		},
		//update user with deviceID if it already exists
		function(callback) {
			if (userProfile.devices) {
				var idx = userProfile.devices.indexOf(deviceId);
				if (idx === -1)
					userProfile.devices.push(deviceId);
			} else {
				userProfile.devices = [deviceId];
			}
			var patches = [];
			patches.push(Models.Delta.formPatch(userProfile, 'replace', {devices: userProfile.devices}));

			if (userProfile.name != fbProfile.name)
				patches.push(Models.Delta.formPatch(userProfile, 'replace', {name: fbProfile.name}));
			if (userProfile.gender != fbProfile.gender)
				patches.push(Models.Delta.formPatch(userProfile, 'replace', {gender: fbProfile.gender}));

			Models.User.update(userProfile.email, appId, patches, callback);

			//user first logged in with password then with fb
			/*if (!userProfile.fid) {
				var key = 'blg:'+Models.User._model.namespace+':fid:'+fbProfile.id;
				Models.Application.bucket.insert(key, userProfile.email, function() {
					userProfile.fid = fbProfile.id;
					userProfile.name = fbProfile.name;
					userProfile.gender = fbProfile.gender;

					Models.User.update(userProfile.email, userProfile, callback);
				});
			} else {
				callback(null, true);
			}*/
		}
		//final step: send authentification token
	], function(err, results) {
		if (err)
			return next(err);
		else {
			var token = jwt.sign({email: userProfile.email, id: userProfile.id}, security.authSecret,
				{ expiresInMinutes: 60 });
			res.json({status: 200, content: {token: token, user: userProfile}}).end();
		}
	});
});

/**
 * @api {post} /user/register Register
 * @apiDescription Registers a new user using a fb token or directly with an email and password. User is not created
 * immediately.
 * @apiName UserRegister
 * @apiGroup User
 * @apiVersion 0.2.3
 *
 * @apiHeader {String} Content-type application/json
 * @apiHeader {String} X-BLGREQ-APPID Custom header which contains the application ID
 * @apiHeader {String} X-BLGREQ-SIGN Custom header containing the SHA256-ed API key of the application
 * @apiHeader {String} X-BLGREQ-UDID Custom header containing the device ID (obtained from devie/register)
 *
 * @apiParam {String} access_token Facebook access token.
 *
 * @apiExample {json} Facebook Request
 * 	{
 * 		"access_token": "fb access token"
 * 	}
 *
 * @apiExample {json} Client Request (with password)
 *
 * {
 * 		"email": "example@appscend.com",
 * 		"password": "secure_password1337",
 * 		"name": "John Smith"
 * }
 *
 * 	@apiSuccessExample {json} Success Response
 * 	{
 * 		"status": 202,
 * 		"content": "User created"
 * 	}
 *
 * 	@apiError 400 [028]InsufficientFacebookPermissions User email is not publicly available
 * 	(insufficient facebook permissions)
 * 	@apiError 409 [029]UserAlreadyExists User with that email address already exists
 *
 */
router.post('/register', function(req, res, next) {
	if (Object.getOwnPropertyNames(req.body).length === 0) {
		return next(new Models.TelepatError(Models.TelepatError.errors.RequestBodyEmpty));
	}

	var userProfile = req.body;
	var accessToken = req.body.access_token;
	var fbFriends = [];
	var deviceId = req._telepat.device_id;
	var appId = req._telepat.applicationId;

	async.waterfall([
		function(callback) {
			if (accessToken) {
				FB.napi('/me', {access_token: accessToken}, function(err, result) {
					if (err) return callback(err);

					userProfile = result;

					if (!userProfile.email) {
						callback(new Models.TelepatError(Models.TelepatError.errors.InsufficientFacebookPermissions));
					}

					callback();
				});
			} else {
				callback();
			}
		},
		function(callback) {
			//get his/her friends
			if (accessToken) {
				FB.napi('/me/friends', {access_token: accessToken}, function(err, result) {
					if (err) return callback(err);

					for(var f in result.data) {
						fbFriends.push(result.data[f].id);
					}
					callback();
				});
			} else
				callback();
		},
		function(callback) {
			if (!userProfile.email) {
				return callback(new Models.TelepatError(Models.TelepatError.errors.MissingRequiredField,
					['email or access_token']));
			}

			Models.User(userProfile.email, appId, function(err, result) {
				if (!err) {
					callback(new Models.TelepatError(Models.TelepatError.errors.UserAlreadyExists));
				}
				else if (err && err.status != 404)
					callback(err);
				else {
					callback();
				}
			});
		},
		//send message to kafka if user doesn't exist in order to create it
		function(callback) {
			/*var props = {
			 email: userProfile.email,
			 fid: userProfile.id,
			 name: userProfile.name,
			 gender: userProfile.gender,
			 friends: fbFriends,
			 devices: [deviceId]
			 };*/

			userProfile.friends = fbFriends;
			userProfile.type = 'user';
			userProfile.devices = [deviceId];

			if (userProfile.password)
				security.encryptPassword(userProfile.password, callback);
			else
				callback(null, false);

		}, function(hash, callback) {
			if (hash !== false)
				userProfile.password = hash;

			//request came from facebook
			if (accessToken) {
				userProfile.fid = userProfile.id;
				delete userProfile.id;
			}

			app.messagingClient.send([JSON.stringify({
				op: 'add',
				object: userProfile,
				applicationId: req._telepat.applicationId,
				isUser: true
			})], 'aggregation', callback);
		},
		//add this user to his/her friends array
		function(callback) {
			if (fbFriends.length) {
				app.messagingClient.send([JSON.stringify({fid: userProfile.id, friends: fbFriends})],
					'update_friends', callback);
			} else
				callback();
		}
	], function(err) {
		if (err) return next(err);

		res.status(202).json({status: 202, content: 'User created'}).end();
	});
});

/**
 * @api {get} /user/me Me
 * @apiDescription Info about logged user
 * @apiName UserMe
 * @apiGroup User
 * @apiVersion 0.2.3
 *
 * @apiHeader {String} Content-type application/json
 * @apiHeader {String} Authorization The authorization token obtained in the login endpoint.
 * Should have the format: <i>Bearer $TOKEN</i>
 * @apiHeader {String} X-BLGREQ-APPID Custom header which contains the application ID
 * @apiHeader {String} X-BLGREQ-SIGN Custom header containing the SHA256-ed API key of the application
 * @apiHeader {String} X-BLGREQ-UDID Custom header containing the device ID (obtained from devie/register)
 *
 * @apiParam {String} password The password
 * @apiParam {String} email The email
 *
 * 	@apiSuccessExample {json} Success Response
 * 	{
 * 		"content": {
 *			"id": 31,
 *			"type": "user",
 * 			"email": "abcd@appscend.com",
 * 			"fid": "",
 * 			"devices": [
 *				"466fa519-acb4-424b-8736-fc6f35d6b6cc"
 *			],
 *			"friends": []
 * 		}
 * 	}
 *
 */
router.get('/me', function(req, res, next) {
	Models.User(req.user.email, req._telepat.applicationId, function(err, result) {
		if (err && err.status == 404) {
			return next(new Models.TelepatError(Models.TelepatError.errors.UserNotFound));
		}
		else if (err)
			next(err);
		else
			delete result.password;
			res.status(200).json({status: 200, content: result}).end();
	});
});

/**
 * @api {post} /user/login_password Password login
 * @apiDescription Logs in the user with a password
 * @apiName UserLoginPassword
 * @apiGroup User
 * @apiVersion 0.2.3
 *
 * @apiHeader {String} Content-type application/json
 * @apiHeader {String} X-BLGREQ-APPID Custom header which contains the application ID
 * @apiHeader {String} X-BLGREQ-SIGN Custom header containing the SHA256-ed API key of the application
 * @apiHeader {String} X-BLGREQ-UDID Custom header containing the device ID (obtained from devie/register)
 *
 * @apiParam {String} password The password
 * @apiParam {String} email The email
 *
 * @apiExample {json} Client Request
 * 	{
 * 		"email": "user@example.com",
 * 		"password": "magic-password1337"
 * 	}
 *
 * 	@apiSuccessExample {json} Success Response
 * 	{
 * 		"content": {
 * 			"token": "eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJlbWFpbCI6ImdhYmlAYXBwc2NlbmQuY29tIiwiaXNBZG1pbiI6dHJ1ZSwi
 * 			aWF0IjoxNDMyOTA2ODQwLCJleHAiOjE0MzI5MTA0NDB9.knhPevsK4cWewnx0LpSLrMg3Tk_OpchKu6it7FK9C2Q"
 * 			"user": {
 * 				"id": 31,
 *				"type": "user",
 * 				"email": "abcd@appscend.com",
 * 				"fid": "",
 * 				"devices": [
 *					"466fa519-acb4-424b-8736-fc6f35d6b6cc"
 *				],
 *				"friends": [],
 *				"password": "acb8a9cbb479b6079f59eabbb50780087859aba2e8c0c397097007444bba07c0"
 * 			}
 * 		}
 * 	}
 *
 * 	@apiError 401 [031]UserBadLogin User email and password did not match
 *
 */
router.post('/login_password', function(req, res, next) {
	if (!req.body.email)
		return next(new Models.TelepatError(Models.TelepatError.errors.MissingRequiredField, ['email']));

	if (!req.body.password)
		return next(new Models.TelepatError(Models.TelepatError.errors.MissingRequiredField, ['password']));

	var userProfile = null;
	var email = req.body.email;
	var password = req.body.password.toString();
	var deviceId = req._telepat.device_id;
	var appId = req._telepat.applicationId;

	var hashedPassword = null;

	async.series([
		function(callback) {
			//try and get user profile from DB
			Models.User(email, appId, function(err, result) {
				if (err && err.status == 404) {
					callback(new Models.TelepatError(Models.TelepatError.errors.UserNotFound));
				}
				else if (err)
					callback(err);
				else {
					userProfile = result;
					callback();
				}
			});
		},
		function(callback) {
			security.encryptPassword(req.body.password, function(err, hash) {
				if (err)
					return callback(err);

				hashedPassword = hash;

				callback();
			});
		}
	], function(err) {
		if (err)
			return next(err);

		if (hashedPassword != userProfile.password) {
			return next(new Models.TelepatError(Models.TelepatError.errors.UserBadLogin));
		}

		delete userProfile.password;

		var token = jwt.sign({email: email, id: userProfile.id}, security.authSecret, { expiresInMinutes: 60 });
		res.json({status: 200, content: {user: userProfile, token: token }}).end();
	});
});

/**
 * @api {get} /user/logout Logout
 * @apiDescription Logs out the user removing the device from his array of devices.
 * @apiName UserLogout
 * @apiGroup User
 * @apiVersion 0.2.3
 *
 * @apiHeader {String} Content-type application/json
 * @apiHeader {String} X-BLGREQ-APPID Custom header which contains the application ID
 * @apiHeader {String} X-BLGREQ-SIGN Custom header containing the SHA256-ed API key of the application
 * @apiHeader {String} X-BLGREQ-UDID Custom header containing the device ID (obtained from devie/register)
 *
 * 	@apiSuccessExample {json} Success Response
 * 	{
 * 		"status": 200,
 * 		"content": "Logged out of device"
 * 	}
 */
router.get('/logout', function(req, res, next) {
	var deviceId = req._telepat.device_id;
	var email = req.user.email;
	var appID = req._telepat.applicationId;

	async.waterfall([
		function(callback) {
			Models.User(email, appID, callback);
		},
		function(user, callback) {
			if (user.devices) {
				var idx = user.devices.indexOf(deviceId);
				if (idx >= 0)
					user.devices.splice(idx, 1);

				Models.User.update(email, appID, [
		      {
		        "op": "replace",
		        "path": "user/"+email+"/devices",
		        "value": user.devices
		      }
		    ], callback);
			} else {
				callback();
			}
		}
	], function(err, result) {
		if (err) return next(err);

		res.status(200).json({status: 200, content: "Logged out of device"}).end();
	});
});


/**
 * @api {get} /user/refresh_token Refresh Token
 * @apiDescription Sends a new authentification token to the user. The old token must be provide (and it may or not
 * may not be aleady expired).
 * @apiName RefreshToken
 * @apiGroup User
 * @apiVersion 0.2.3
 *
 * @apiHeader {String} Content-type application/json
 * @apiHeader {String} Authorization The authorization token obtained in the login endpoint.
 * Should have the format: <i>Bearer $TOKEN</i>
 * @apiHeader {String} X-BLGREQ-APPID Custom header which contains the application ID
 * @apiHeader {String} X-BLGREQ-SIGN Custom header containing the SHA256-ed API key of the application
 * @apiHeader {String} X-BLGREQ-UDID Custom header containing the device ID (obtained from devie/register)
 *
 * @apiSuccessExample {json} Success Response
 * 	{
 * 		"status": 200,
 * 		"content": {
 * 			token: "eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJlbWFpbCI6ImdhYmlAYXBwc2NlbmQuY29tIiwiaXNBZG1pbiI6dHJ1ZSwiaW
 * 			F0IjoxNDMyOTA2ODQwLCJleHAiOjE0MzI5MTA0NDB9.knhPevsK4cWewnx0LpSLrMg3Tk_OpchKu6it7FK9C2Q"
 * 		}
 * 	}
 *
 * @apiError 400 [013]AuthorizationMissing  If authorization header is missing
 * @apiError 400 [039]ClientBadRequest Error decoding auth token
 * @apiError 400 [040]MalformedAuthorizationToken Auth token is malformed
 * @apiError 400 [014]InvalidAuthorization Authorization header is invalid
 */
router.get('/refresh_token', function(req, res, next) {
	if (!req.get('Authorization')) {
		return next(new Models.TelepatError(Models.TelepatError.errors.AuthorizationMissing));
	}

	var authHeader = req.get('Authorization').split(' ');
	if (authHeader[0] == 'Bearer' && authHeader[1]) {
		try {
			var decoded = jwt.decode(authHeader[1]);
		} catch (e) {
			return next(new Models.TelepatError(Models.TelepatError.errors.ClientBadRequest, [e.message]));
		}

		if (!decoded) {
			return next(new Models.TelepatError(Models.TelepatError.errors.MalformedAuthorizationToken));
		}

		var newToken = jwt.sign(decoded, security.authSecret, {expiresInMinutes: 60});

		return res.status(200).json({status: 200, content: {token: newToken}}).end();
	} else {
		return next(new Models.TelepatError(Models.TelepatError.errors.InvalidAuthorization, ['header invalid']));
	}
});

/**
 * @api {post} /user/update Update
 * @apiDescription Updates the user information. This operation is not immediate.
 * @apiName UserUpdate
 * @apiGroup User
 * @apiVersion 0.2.3
 *
 * @apiParam {Object[]} patches Array of patches that describe the modifications
 *
 * @apiExample {json} Client Request
 * 	{
 * 		"patches": [
 * 			{
 * 				"op": "replace",
 * 				"path": "user/user_id/field_name",
 * 				"value": "new value
 * 			}
 * 		]
 * 	}
 *
 *
 * @apiSuccessExample {json} Success Response
 * 	{
 * 		"status": 202,
 * 		"content": "User updated"
 * 	}
 *
 * 	@apiError [042]400 InvalidPatch Invalid patch supplied
 *
 */
router.post('/update', function(req, res, next) {
	if (Object.getOwnPropertyNames(req.body).length === 0) {
		return next(new Models.TelepatError(Models.TelepatError.errors.RequestBodyEmpty));
	} else if (!Array.isArray(req.body.patches)) {
		return next(new Models.TelepatError(Models.TelepatError.errors.InvalidFieldValue,
			['"patches" is not an array']));
	} else if (req.body.patches.length == 0) {
		return next(new Models.TelepatError(Models.TelepatError.errors.InvalidFieldValue,
			['"patches" array is empty']));
	}

	var patches = req.body.patches;
	var id = req.user.id;
	var email = req.user.email;
	var modifiedMicrotime = microtime.now();

	var i = 0;
	async.eachSeries(patches, function(p, c) {
		patches[i].email = email;

		if (patches[i].path.split('/')[2] == 'password') {

			security.encryptPassword(patches[i].value, function(err, hash) {
				patches[i].value = hash;
				i++;
				c();
			});
		} else {
			i++;
			c();
		}
	}, function() {
		async.eachSeries(patches, function(patch, c) {
			var patchUserId = patch.path.split('/')[1];

			if (patchUserId != id) {
				return c(new Models.TelepatError(Models.TelepatError.errors.InvalidPatch,
					['Invalid ID in one of the patches']));
			}

			app.messagingClient.send([JSON.stringify({
				op: 'update',
				object: patch,
				id: id,
				applicationId: req._telepat.applicationId,
				isUser: true,
				ts: modifiedMicrotime
			})], 'aggregation', c);
		}, function(err) {
			if (err) return next(err);

			res.status(202).json({status: 202, content: "User updated"}).end();
		});
	});
});

router.post('/update_immediate', function(req, res, next) {
	var user = req.body;
	var appId = req._telepat.applicationId;

	req.user.type = 'user';

	async.waterfall([
		function(callback) {
			if (user.password)
				security.encryptPassword(user.password, callback);
			else
				callback(null, false);
		},
		function(hash, callback) {
			if (hash)
				user.password = hash;

			var patches = [];

			async.each(Object.keys(user), function(prop, c) {
				var property = {};
				property[prop] = user[prop];
				patches.push(Models.Delta.formPatch(req.user, 'replace', property));
				c();
			}, function() {
				Models.User.update(req.user.email, appId, patches, callback);
			});
		}
	], function(err) {
		if (err) return next(err);

		res.status(200).json({status: 200, content: "User updated"}).end();
	});
});

/**
 * @api {post} /user/delete Delete
 * @apiDescription Deletes a user
 * @apiName UserDelete
 * @apiGroup User
 * @apiVersion 0.2.3
 *
 * @apiHeader {String} Content-type application/json
 * @apiHeader {String} Authorization The authorization token obtained in the login endpoint. Should have the format: <i>Bearer $TOKEN</i>
 * @apiHeader {String} X-BLGREQ-APPID Custom header which contains the application ID
 * @apiHeader {String} X-BLGREQ-SIGN Custom header containing the SHA256-ed API key of the application
 *
 * @apiParam {number} id ID of the user
 * @apiParam {string} email Email of the user
 *
 * @apiSuccessExample {json} Success Response
 * 	{
 * 		"status": 202,
 * 		"content": "User deleted"
 * 	}
 *
 */
router.post('/delete', function(req, res, next) {
	var id = req.user.id;
	var email = req.user.email;

	app.messagingClient.send([JSON.stringify({
		op: 'delete',
		object: {path: 'user/'+id, email: email},
		applicationId: req._telepat.applicationId,
		isUser: true
	})], 'aggregation', function(err) {
		if (err) return next(err);

		res.status(202).json({status: 202, content: "User deleted"}).end();
	});
});

module.exports = router;
