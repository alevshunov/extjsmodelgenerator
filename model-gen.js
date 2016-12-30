var magic = require('./tools/dbconverter');
var cfg = require('./tools/config');

var errorHandler = console.log.bind(console);

var dumpArgs = {
    path: cfg.get('-f', 'model/'),
    namespace: cfg.get('-n', 'App.model'),
    baseModel: cfg.get('-b', 'Ext.data.Model'),
    dumbBaseModel: cfg.get('-ibm', 'true') == 'true',
    dumpModel: cfg.get('-im', 'false') == 'true'
};

magic
    .load(cfg.get('name'))
    .then(function(data) {
        return data.dump(dumpArgs);
    }, errorHandler)
    .then(function() {
        console.log('Success');
    }, errorHandler);

