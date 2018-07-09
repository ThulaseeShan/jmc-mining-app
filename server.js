var appInsights = require('applicationinsights');
appInsights.setup();
appInsights.start();

var express = require('express'),
    app = express(),
    bodyParser = require('body-parser'),
    MongoClient = require('mongodb').MongoClient,
    redisClient = require('redis').createClient,
    engines = require('consolidate'),
    assert = require('assert'),
    ObjectId = require('mongodb').ObjectID,
    url = 'mongodb://jmc-mining:gCKVvbUFY53dJL0ou0IEMkjARiSBOEIZDKaM3PCuwiklWpkwReTqtVUisjVbP23OYPcwne92ooVqbYO7FhPSRw==@jmc-mining.documents.azure.com:10255/simplemean?ssl=true&replicaSet=globaldb';

app.use(express.static(__dirname + "/public"));

app.use(bodyParser.urlencoded({extended: true}));
app.use(bodyParser.json());

app.engine('html', engines.nunjucks);
app.set('view engine', 'html');
app.set('views', __dirname + '/views');

var redis = redisClient(6379, 
    process.env.REDIS_URI || 'samplets.redis.cache.windows.net', 
    {auth_pass: process.env.REDIS_PASSKEY || 'HVN8eqBVCTUSNSTxPed7nuQKZJLWfYlrGOdonahCZ8Q='});

var platformId = process.env.PLATFORM_ID || 'Dev';

function errorHandler(err, req, res, next) {
    console.error(err.message);
    console.error(err.stack);
    res.status(500).render("error_template", { error: err});
}

function loadRecords(records_collection, callback){
    redis.get(platformId, function(err, reply){
        if (err) 
            callback(null);
        else if (reply) {//Book exists in cache
            console.log(JSON.parse(reply));    
            callback(JSON.parse(reply));
        }
        else{
            records_collection.find({}).toArray(function(err, records){
                if(err) throw err;
        
                if(records.length < 1) {
                    console.log("No records found.");
                }
        
                // console.log(records);
                redis.set(platformId, JSON.stringify(records), function () {
                    callback(records);
                });
            });
        }
    })
}

MongoClient.connect(process.env.MONGODB_URI || url,function(err, db){
    assert.equal(null, err);
    console.log('Successfully connected to MongoDB.');

    var records_collection = db.collection('records');

    app.get('/records', function(req, res, next) {
        loadRecords(records_collection, function(records){
            res.json(records);
        });
    });

    app.post('/records', function(req, res, next){
        console.log(req.body);
        records_collection.insert(req.body, function(err, doc) {
            if(err) throw err;
            console.log(doc);
            //clearing the cache since the cache invalid
            redis.del(platformId);
            res.json(doc);
        });
    });

    app.delete('/records/:id', function(req, res, next){
        var id = req.params.id;
        console.log("delete " + id);
        records_collection.deleteOne({'_id': new ObjectId(id)}, function(err, results){
            console.log(results);
            res.json(results);
        });
    });

    app.put('/records/:id', function(req, res, next){
        var id = req.params.id;
        records_collection.updateOne(
            {'_id': new ObjectId(id)},
            { $set: {
                'name' : req.body.name,
                'email': req.body.email,
                'phone': req.body.phone
                }
            }, function(err, results){
                console.log(results);
                res.json(results);
        });
    });

    app.use(errorHandler);
    var server = app.listen(process.env.PORT || 3000, function() {
        var port = server.address().port;
        console.log('Express server listening on port %s.', port);
    })
})
