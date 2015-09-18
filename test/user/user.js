var common = require('../common');
var request = common.request;
var should = common.should;
var assert = common.assert;
var crypto = common.crypto;
var url = common.url;
var DELAY = common.DELAY;

var appIDsha256 = common.appIDsha256;

var deviceIdentification;
var invalidUDID = 'invalid';
var appIDsha256 =  '2a80f1666442062debc4fbc0055d8ba5efc29232a27868c0a8eb76dec23df794';
var authValue;
var token;
var userID;
var userEmail = "user6@example.com";
var userEmail2 = "user"+ Math.round(Math.random()*1000000)+1000 +"@example.com";
      
before(function(done){
  console.log("Executing user before...");
  var clientrequest = {
    "info": {
      "os": "Android",
      "version": "4.4.3",
      "sdk_level": 19,
      "manufacturer": "HTC",
      "model": "HTC One_M8",
      "udid": invalidUDID
    },
    "persistent": {
    "type": "android",
    "token": "android pn token"
    }
  }
  
  request(url)
  .post('/device/register')
  .set('X-BLGREQ-SIGN', appIDsha256)
  .set('X-BLGREQ-UDID', '')
  .set('X-BLGREQ-APPID',appID)
  .send(clientrequest)
  .end(function(err, res) {
    deviceIdentification =  res.body.content.identifier;
    done();
  });
  
});

// it('should return an error response to indicate that the user has NOT logged via FACEBOOK because of missing access token', function(done) {

  // var clientrequest = {};

  // request(url)
  // .post('/user/login')
  // .set('Content-type','application/json')
  // .set('X-BLGREQ-SIGN', appIDsha256 )
  // .set('X-BLGREQ-APPID', 1 )
  // .set('X-BLGREQ-UDID', 'd244854a-ce93-4ba3-a1ef-c4041801ce28' )
  // .send(clientrequest)
  // .end(function(err, res) {
    // res.statusCode.should.be.equal(400);
    // done();
  // });
// });

it('should return a success response to indicate that the user has logged in via user & password', function(done) {
  var clientrequest = {
    "email": userEmail,
    "password": "secure_password1337",
    "name": "John Smith"
  };
  request(url)
  .post('/user/register')
  .set('Content-type','application/json')
  .set('X-BLGREQ-SIGN', appIDsha256 )
  .set('X-BLGREQ-APPID', appID )
  .set('X-BLGREQ-UDID', 'd244854a-ce93-4ba3-a1ef-c4041801ce28' )
  .send(clientrequest)
  .end(function(err, res) {
    setTimeout(function() {
      request(url)
      .post('/user/login_password')
      .set('Content-type','application/json')
      .set('X-BLGREQ-SIGN', appIDsha256 )
      .set('X-BLGREQ-APPID', appID )
      .set('X-BLGREQ-UDID', 'd244854a-ce93-4ba3-a1ef-c4041801ce28' )
      .send(clientrequest)
      .end(function(err, res) {
        token = res.body.content.token;
        userID = res.body.content.user.id;
        authValue = 'Bearer ' + token;
        res.statusCode.should.be.equal(200);
        done();
      });
    }, DELAY);
  });
});

it('should return a success response to indicate that the user info was retrived', function(done) {
  request(url)
  .get('/user/me')
  .set('Content-type','application/json')
  .set('X-BLGREQ-SIGN', appIDsha256 )
  .set('X-BLGREQ-APPID', appID )
  .set('X-BLGREQ-UDID', 'd244854a-ce93-4ba3-a1ef-c4041801ce28' )
  .set('Authorization', authValue )
  .send()
  .end(function(err, res) {
    res.statusCode.should.be.equal(200);
    done();
  });
});

it('should return an error response to indicate that the user has NOT logged in via user & password because of Invalid Credentials', function(done) {
  var clientrequest = {
    "email": userEmail,
    "password": "secure_password",
    "name": "John Smith"
  };
  request(url)
  .post('/user/login_password')
  .set('Content-type','application/json')
  .set('X-BLGREQ-SIGN', appIDsha256 )
  .set('X-BLGREQ-APPID', appID )
  .set('X-BLGREQ-UDID', 'd244854a-ce93-4ba3-a1ef-c4041801ce28' )
  .send(clientrequest)
  .end(function(err, res) {
    res.statusCode.should.be.equal(401);
    done();
  });
});

it('should return an error response to indicate that the user has NOT logged in via user & password because user not found', function(done) {
  var clientrequest = {
    "email": 'user'+Math.round(Math.random()*1000000)+'@example.com',
    "password": "secure_password",
    "name": "John Smith"
  };
  request(url)
  .post('/user/login_password')
  .set('Content-type','application/json')
  .set('X-BLGREQ-SIGN', appIDsha256 )
  .set('X-BLGREQ-APPID', appID )
  .set('X-BLGREQ-UDID', 'd244854a-ce93-4ba3-a1ef-c4041801ce28' )
  .send(clientrequest)
  .end(function(err, res) {
    res.statusCode.should.be.equal(404);
    done();
  });
});

// it('should return an succes response to indicate that the user has logged in via FACEBOOK', function(done) {
  // //TODO
  // var clientrequest = {
    // "user" : "testuser1",
    // "password" : "1234test"        
  // };   
  
  // request(url)
  // .post('/user/login')
  // .set('X-BLGREQ-SIGN', appIDsha256)
  // .set('X-BLGREQ-UDID', deviceIdentification)
  // .set('X-BLGREQ-APPID',1)
  // .send(clientrequest)
  // .end(function(err, res) {
    // res.statusCode.should.be.equal(200);
    // done();
  // });
// });

it('should return a success response to indicate that the user was updated', function(done) {
  var clientrequest = {
    "email": userEmail,
    "password": "secure_password1337",
    "patches" : [
      {
      "name": "Johnny Smith"
      }
    ]
  };
  request(url)
  .post('/user/update')
  .set('Content-type','application/json')
  .set('X-BLGREQ-SIGN', appIDsha256 )
  .set('X-BLGREQ-APPID', appID )
  .set('X-BLGREQ-UDID', 'd244854a-ce93-4ba3-a1ef-c4041801ce28' )
  .set('Authorization', authValue )
  .send(clientrequest)
  .end(function(err, res) {
    res.statusCode.should.be.equal(200);
    done();
  });
});

it('should return a success response to indicate that the token was updated', function(done) {
  request(url)
  .get('/user/refresh_token')
  .set('Content-type','application/json')
  .set('X-BLGREQ-SIGN', appIDsha256)
  .set('X-BLGREQ-UDID', deviceIdentification)
  .set('X-BLGREQ-APPID',appID)
  .set('Authorization', authValue )
  .send()
  .end(function(err, res) {
    token = res.body.content.token;
    authValue = 'Bearer ' + token;
    res.statusCode.should.be.equal(200);
    done();
  });
});

it('should return an error response to indicate that the token was NOT updated because of bad Authorization', function(done) {
  var authValue = "something";
  request(url)
  .get('/user/refresh_token')
  .set('Content-type','application/json')
  .set('X-BLGREQ-SIGN', appIDsha256)
  .set('X-BLGREQ-UDID', deviceIdentification)
  .set('X-BLGREQ-APPID',appID)
  .set('Authorization', authValue )
  .send()
  .end(function(err, res) {
    res.statusCode.should.be.equal(400);
    res.body.message.should.be.equal("Token not present or authorization header is invalid");
    done();
  });
});

it('should return an error response to indicate that the token was NOT updated because of bad token', function(done) {
  var authValue = 'Bearer something';
  request(url)
  .get('/user/refresh_token')
  .set('Content-type','application/json')
  .set('X-BLGREQ-SIGN', appIDsha256)
  .set('X-BLGREQ-UDID', deviceIdentification)
  .set('X-BLGREQ-APPID',appID)
  .set('Authorization', authValue )
  .send()
  .end(function(err, res) {
    res.statusCode.should.be.equal(400);
    res.body.message.should.be.equal("Malformed authorization token");
    done();
  });
});

it('should return a success response to indicate that the user logged out', function(done) {
  var clientrequest = {
    "token" : token   
  };
  request(url)
  .get('/user/logout')
  .set('Content-type','application/json')
  .set('X-BLGREQ-SIGN', appIDsha256)
  .set('X-BLGREQ-UDID', deviceIdentification)
  .set('X-BLGREQ-APPID',appID)
  .set('Authorization', authValue )
  .send()
  .end(function(err, res) {
    res.statusCode.should.be.equal(200);
    done();
  });
});

it('should return a success response to indicate that the user has registered', function(done) {
  var clientrequest = {
    "email": userEmail2,
    "password": "secure_password1337",
    "name": "John Smith"
  };
  request(url)
  .post('/user/register')
  .set('Content-type','application/json')
  .set('X-BLGREQ-SIGN', appIDsha256 )
  .set('X-BLGREQ-APPID', appID )
  .set('X-BLGREQ-UDID', 'd244854a-ce93-4ba3-a1ef-c4041801ce28' )
  .send(clientrequest)
  .end(function(err, res) {
    res.statusCode.should.be.equal(202);
    done();
  });
});

it('should return a success response to indicate that the user has NOT registered', function(done) {
  var clientrequest = {
    "email": userEmail,
    "password": "secure_password1337",
    "name": "John Smith"
  };
  request(url)
  .post('/user/register')
  .set('Content-type','application/json')
  .set('X-BLGREQ-SIGN', appIDsha256 )
  .set('X-BLGREQ-APPID', appID)
  .set('X-BLGREQ-UDID', 'd244854a-ce93-4ba3-a1ef-c4041801ce28' )
  .send(clientrequest)
  .end(function(err, res) {
    res.statusCode.should.be.equal(409);
    done();
  });
});

it('should return a success response to indicate that the user was deleted', function(done) {
  var clientrequest = {
    "id" : userID,
    "email" : userEmail       
  };
  request(url)
  .post('/user/delete')
  .set('X-BLGREQ-SIGN', appIDsha256)
  .set('X-BLGREQ-UDID', deviceIdentification)
  .set('X-BLGREQ-APPID',appID)
  .send(clientrequest)
  .end(function(err, res) {
    res.statusCode.should.be.equal(202);
    done();
  });
});