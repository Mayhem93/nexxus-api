/* jshint maxlen: 120 */

var express = require('express');
var router = express.Router();

var security = require('../security');
var Models = require('telepat-models');
var microtime = require('microtime-nodejs');

router.use('/',
	security.tokenValidation,
	security.applicationIdValidation,
	security.adminAppValidation);

var getAllContexts = function (req, res, next) {
	var appId = req._telepat.applicationId;
	var offset = req.body ? req.body.offset : undefined;
	var limit = req.body ? req.body.limit : undefined;

	Models.Context.getAll(appId, offset, limit, function (err, res1) {
		if (err)
			next(err);
		else {
			res.status(200).json({status: 200, content: res1});
		}
	});
};

/**
 * @api {post} /admin/context/all GetContexts
 * @apiDescription Get all contexts
 * @apiName AdminGetContexts
 * @apiGroup Admin
 * @apiVersion 0.4.0
 *
 * @apiHeader {String} Content-type application/json
 * @apiHeader {String} Authorization
                       The authorization token obtained in the login endpoint.
                       Should have the format: <i>Bearer $TOKEN</i>
 * @apiHeader {String} X-BLGREQ-APPID Custom header which contains the application ID
 *
 * @apiParam {Number} offset (optional) Starting offset (default: 0)
 * @apiParam {Number} limit (optional) Number of objects to return (default: depends on API configuration)
 *
 * @apiExample {json} Client Request
 * 	{
 * 		"offset": 0,
 * 		"limit": 64
 * 	}
 *
 * @apiSuccessExample {json} Success Response
 * 	{
 * 		"status": 200,
 * 		"content": [{
 * 			"name": "Episode 1",
 * 			"state": 0,
 * 			"meta": {},
 * 			"type": "context",
 * 			"application_id": "20"
 * 		},
 * 		...
 * 		]
 * 	}
 *
 */
router.post('/all', getAllContexts);

/** @deprecated: Use the post version of this endpoint **/
router.get('/all', getAllContexts);

/**
 * @api {post} /admin/context GetContext
 * @apiDescription Retrieves a context
 * @apiName AdminGetContext
 * @apiGroup Admin
 * @apiVersion 0.4.0
 *
 * @apiHeader {String} Content-type application/json
 * @apiHeader {String} Authorization
                       The authorization token obtained in the login endpoint.
                       Should have the format: <i>Bearer $TOKEN</i>
 * @apiHeader {String} X-BLGREQ-APPID Custom header which contains the application ID
 *
 * @apiParam {Number} id ID of the context to get
 *
 * @apiExample {json} Client Request
 * 	{
 * 		"id": 1
 * 	}
 *
 * 	@apiSuccessExample {json} Success Response
 * 	{
 * 		"status": 200,
 * 		"content": {
 * 			"name": "Episode 1",
 * 			"state": 0,
 * 			"meta": {},
 * 			"type": "context",
 * 			"application_id": "20"
 * 		}
 * 	}
 *
 * 	@apiError 404 [020]ContextNotFound ContextNotFound
 *
 * 	@apiErrorExample {json} Error Response
 * 	{
 *		"code": "020",
 *		"status": 404,
 *		"message": "Context not found"
 * 	}
 *
 */
router.post('/', function (req, res, next) {
	if (!req.body.id) {
		return next(new Models.TelepatError(Models.TelepatError.errors.MissingRequiredField, ['id']));
	}

	Models.Context(req.body.id, function (err, res1) {
		if (err && err.status == 404)
			next(new Models.TelepatError(Models.TelepatError.errors.ContextNotFound));
		else if (err)
			next(err);
		else {
			res.status(200).json({status: 200, content: res1});
		}
	});
});

router.use('/add',
	security.tokenValidation,
	security.applicationIdValidation,
	security.adminAppValidation);
/**
 * @api {post} /admin/context/add CreateContext
 * @apiDescription Creates a new context
 * @apiName AdminCreateContext
 * @apiGroup Admin
 * @apiVersion 0.4.0
 *
 * @apiHeader {String} Content-type application/json
 * @apiHeader {String} Authorization
                       The authorization token obtained in the login endpoint.
                       Should have the format: <i>Bearer $TOKEN</i>
 * @apiHeader {String} X-BLGREQ-APPID Custom header which contains the application ID
 *
 * @apiParam {Number} appId ID of the application
 *
 * @apiExample {json} Client Request
 * 	{
 * 		"name": "Episode 2",
 * 		"meta": {"info": "some meta info"}
 * 	}
 *
 * 	@apiSuccessExample {json} Success Response
 * 	{
 * 		"status": 200,
 * 		"content": {
 * 			"name": "Episode 2",
 * 			"state": 0,
 * 			"meta": {"info": "some meta info"},
 * 			"type": "context",
 * 			"application_id": "20"
 * 		}
 * 	}
 *
 */
router.post('/add', function (req, res, next) {
	if (Object.getOwnPropertyNames(req.body).length === 0)
		return next(new Models.TelepatError(Models.TelepatError.errors.RequestBodyEmpty));

	var newContext = req.body;
	var appId = req._telepat.applicationId;
	var modifiedMicrotime = microtime.now();
	newContext['application_id'] = req._telepat.applicationId;

	Models.Context.create(newContext, function (err, res1) {
		if (err)
			next(err);
		else {
			var delta = new Models.Delta({
				op: 'create',
				object: res1,
				application_id: appId,
				timestamp: modifiedMicrotime
			}, ['blg:'+appId+':context:'+res1.id]);

			app.messagingClient.send([JSON.stringify({
				deltas: [delta.toObject()],
				_broadcast: true
			})], 'transport_manager', function(err) {
				if (err)
					Models.Application.logger.warning(app.getFailedRequestMessage(req, res, err));
			});
			res.status(200).json({status: 200, content: res1});
		}
	});
});

router.use('/remove',
	security.tokenValidation,
	security.applicationIdValidation,
	security.adminAppValidation);
/**
 * @api {delete} /admin/context/remove RemoveContext
 * @apiDescription Removes a context and all associated objects
 * @apiName AdminRemoveContext
 * @apiGroup Admin
 * @apiVersion 0.4.0
 *
 * @apiHeader {String} Content-type application/json
 * @apiHeader {String} Authorization
                       The authorization token obtained in the login endpoint.
                       Should have the format: <i>Bearer $TOKEN</i>
 * @apiHeader {String} X-BLGREQ-APPID Custom header which contains the application ID
 *
 * @apiParam {Number} id ID of the context to remove
 *
 * @apiExample {json} Client Request
 * 	{
 * 		"id": 1
 * 	}
 *
 * 	@apiError 404 [020]ContextNotFound ContextNotFound
 *
 * 	@apiErrorExample {json} Error Response
 * 	{
 *		"code": "020",
 *		"status": 404,
 *		"message": "Context not found"
 * 	}
 *
 */
router.delete('/remove', function (req, res, next) {
	if (!req.body.id) {
		return next(new Models.TelepatError(Models.TelepatError.errors.MissingRequiredField, ['id']));
	}

	var appId = req._telepat.applicationId;
	var modifiedMicrotime = microtime.now();

	Models.Context(req.body.id, function(err, context) {
		if (err && err.status == 404)
			next(new Models.TelepatError(Models.TelepatError.errors.ContextNotFound));
		else if (err)
			next(err);
		else {
			Models.Context.delete(req.body.id, function (err1) {
				if (err1) return next(err1);

				var delta = new Models.Delta({
					op: 'delete',
					object: {id: req.body.id, model: 'context'},
					application_id: appId,
					timestamp: modifiedMicrotime
				}, ['blg:'+appId+':context:'+req.body.id]);

				app.messagingClient.send([JSON.stringify({
					_broadcast: true,
					deltas: [delta.toObject()]
				})], 'transport_manager');

				res.status(200).json({status: 200, content: 'Context removed'});
			});
		}
	});
});

router.use('/update',
	security.tokenValidation,
	security.applicationIdValidation,
	security.adminAppValidation);
/**
 * @api {post} /admin/context/update UpdateContext
 * @apiDescription Updates the context object
 * @apiName AdminUpdateContext
 * @apiGroup Admin
 * @apiVersion 0.4.0
 *
 * @apiHeader {String} Content-type application/json
 * @apiHeader {String} Authorization
                       The authorization token obtained in the login endpoint.
                       Should have the format: <i>Bearer $TOKEN</i>
 * @apiHeader {String} X-BLGREQ-APPID Custom header which contains the application ID
 *
 * @apiParam {Number} id ID of the context to update
 * @apiParam {Array} patches An array of patches
 *
 * @apiExample {json} Client Request
 * 	{
 * 		"id": 1,
 * 		"patches": [
 * 			{
 * 				"op": "replace",
 * 				"path": "context/context_id/field_name",
 * 				"value" "New value"
 * 			}
 * 		]
 * 	}
 *
 * 	@apiError 404 [020]ContextNotFound ContextNotFound
 * 	@apiError 403 [021]ContextNotAllowed This context doesn't belong to you
 *
 * 	@apiErrorExample {json} Error Response
 * 	{
 *		"code": "020",
 *		"status": 404,
 *		"message": "Context not found"
 * 	}
 *
 */
router.post('/update', function (req, res, next) {
	if (Object.getOwnPropertyNames(req.body).length === 0) {
		return next(new Models.TelepatError(Models.TelepatError.errors.RequestBodyEmpty));
	} else if (!Array.isArray(req.body.patches)) {
		return next(new Models.TelepatError(Models.TelepatError.errors.InvalidFieldValue,
			['"patches" is not an array']));
	} else if (req.body.patches.length == 0) {
		return next(new Models.TelepatError(Models.TelepatError.errors.InvalidFieldValue,
			['"patches" array is empty']));
	} else if (!req.body.id) {
		return next(new Models.TelepatError(Models.TelepatError.errors.MissingRequiredField, ['id']));
	} else {
		var context = null;
		async.series([
			function(callback) {
				Models.Context(req.body.id, function(err, result) {
					if (err) return callback(err);
					context = result;
					callback();
				});
			},
			function(callback) {
				if (Models.Application.loadedAppModels[context.application_id].admins.indexOf(req.user.id) === -1) {
					callback(new Models.TelepatError(Models.TelepatError.errors.ContextNotAllowed));
				} else {
					Models.Context.update(req.body.patches, callback);
				}
			}
		], function (err) {
			if (err && err.status == 404)
				next(new Models.TelepatError(Models.TelepatError.errors.ContextNotFound));
			else {
				var modifiedMicrotime = microtime.now();
				var patchesToSend = [];
				var appId = req._telepat.applicationId;

				async.each(req.body.patches, function(patch, c) {
					var delta = new Models.Delta({
						op: 'update',
						patch: patch,
						application_id: appId,
						timestamp: modifiedMicrotime
					}, ['blg:'+appId+':context:'+req.body.id]);

					console.log(appId);

					patchesToSend.push(delta);
					c();
				}, function() {
					app.messagingClient.send([JSON.stringify({
						deltas: patchesToSend,
						_broadcast: true
					})], 'transport_manager', function(err) {
						if (err)
							Models.Application.logger.warning(app.getFailedRequestMessage(req, res, err));
					});
				});
				res.status(200).json({status: 200, content: 'Context updated'});
			}
		});
	}
});

module.exports = router;
