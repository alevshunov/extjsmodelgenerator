var mysql = require('mysql');
var Promise = require('promise');
var configLoader = require('./config');
var fs = require('fs');

var pool  = mysql.createPool({
    host     : configLoader.get('-h', 'localhost'),
    user     : configLoader.get('-u', 'user'),
    password : configLoader.get('-p', 'password'),
    database : configLoader.get('-d', 'database')
});

var ignoredTables = {
    'DATABASECHANGELOG': true,
    'DATABASECHANGELOGLOCK': true
};

var Logger = {
    log: console.log.bind(console)
};

String.prototype.upperFirstLetter = function() {
    return this.charAt(0).toUpperCase() + this.slice(1);
};

String.prototype.lowerFirstLetter = function() {
    return this.charAt(0).toLowerCase() + this.slice(1);
};

function DbMeta(name) {
    Logger.log('Preparing database parser: ' + name);
    this.name = name;
    this.tables = [];
}

DbMeta.prototype = {
    name: undefined,
    tables: undefined,

    load: function() {
        var me = this;

        Logger.log('Loading database: ' + me.name);

        return new Promise(function(resolve, reject) {
            var tableNameFieldName;

            pool.query('show tables')
                .on('error', reject)
                .on('fields', function(fields) { tableNameFieldName = fields[0].name; })
                .on('result', function(data) {
                    var tableName = data[tableNameFieldName];
                    if (ignoredTables[tableName]) {
                        Logger.log('Ignoring ' + tableName);
                        return;
                    }

                    Logger.log('Found new table: ' + tableName);

                    me.tables.push(new TableMeta(tableName));
                })
                .on('end', function() {
                    Logger.log('Parsing tables...');
                    me._loadTables().then(resolve, reject);
                });
        })
    },

    _loadTables: function() {
        var me = this;
        return new Promise(function(resolve, reject) {
            loadNextTable();

            function loadNextTable(index) {
                index = index || 0;

                if (index == me.tables.length) {
                    Logger.log('All tables parsed.');
                    resolve();
                    return;
                }

                var tableToLoad = me.tables[index];
                Logger.log('Preparing to parse table: ' + tableToLoad.name);
                tableToLoad.load()
                    .then(function() {
                        Logger.log('NEXT');
                        loadNextTable(index+1);
                    }, reject);
            }
        });
    },

    dump: function (options) {
        var me = this;
        Logger.log('Preparing to dump.');

        return new Promise(function(resolve, reject) {
            if (!options.path) {
                reject('Path is required.');
                return;
            }

            Logger.log('Creating folder ', options.path, 'and', options.path + 'base/');
            try {
                fs.mkdirSync(options.path);
                fs.mkdirSync(options.path + 'base/');
                Logger.log('Created');
            } catch(e) {
                // reject(e);
                Logger.log(e);
                Logger.log('Probably folders already exists. Ignoring.');
            }

            Logger.log('Start dump.');
            dumpNextTable();

            function dumpNextTable(index) {
                index = index || 0;
                if (index == me.tables.length) {
                    resolve();
                    return;
                }

                me.tables[index].dump(options).then(
                    function () {
                        dumpNextTable(index+1);
                    }, reject);
            }
        });
    }
};

function TableMeta(name) {
    Logger.log('Preparing table data: ' + name);
    this.name = name;
    this.fields = [];
}

TableMeta.prototype = {
    name: undefined,
    fields: undefined,

    load: function () {
        var me = this;

        return new Promise(function(resolve, reject) {
            Logger.log('Parsing table: ', me.name);

            pool.query('show columns from ' + me.name)
                .on('error', reject)
                .on('result', function(data) {
                    me.fields.push(new FieldMeta().parse(data));
                })
                .on('end', resolve);
        });
    },

    dump: function(options) {
        var me = this;
        return new Promise(function(resolve, reject) {
            Logger.log('Dumping of a table: ', me.name);

            if (!options.namespace) {
                reject('Namespace is required.');
                return;
            }

            if (!options.baseModel) {
                reject('BaseModel is required.');
                return;
            }

            Promise.all(
                [
                    me._dumpBaseModel(options),
                    me._dumpModel(options)
                ])
                .then(resolve, reject);
        });
    },

    _dumpBaseModel: function(options) {
        var me = this;
        return new Promise(function(resolve, reject) {
            if (!options.dumbBaseModel) {
                Logger.log('Base model dump ignored. Use "-ibm true" parameter.');
                resolve();
                return;
            }
            var content = [];
            content.push("Ext.define('" + options.namespace + '.base.Base' + me._asModelName() + "', {");
            content.push("  extend: '" + options.baseModel + "',");
            content.push("  fields: [");

            var fieldsContent = [];

            for (var i=0; i<me.fields.length; i++) {
                fieldsContent.push("    " + me.fields[i].asModelString());
            }

            content.push(fieldsContent.join(',\n'));
            content.push("  ]");
            content.push("});");

            try {
                fs.writeFile(options.path + 'base/Base' + me._asModelName() + '.js', content.join('\n'), function () {
                    resolve();
                });
            } catch(e) {
                reject(e);
            }
        });
    },

    _dumpModel: function(options) {
        var me = this;

        return new Promise(function(resolve, reject) {
            if (!options.dumpModel) {
                Logger.log('Model dump ignored. Use "-im true" parameter.');
                resolve();
                return;
            }

            var content = [];
            content.push("Ext.define('" + options.namespace + "." + me._asModelName() + "', {");
            content.push("  extend: '" + options.namespace + '.base.Base' + me._asModelName() + "',");
            content.push("  entityName: '" + me._asModelName() + "'");
            content.push("});");

            try {
                fs.writeFile(options.path + me._asModelName() + '.js', content.join('\n'), function () {
                    resolve();
                });
            } catch(e) {
                reject(e);
            }
        });
    },

    _asModelName: function() {
        return this.name.split('_')
            .map(function(s) { return s.upperFirstLetter();})
            .join('');
    }
};

function FieldMeta() {

}

FieldMeta.prototype = {
    name: undefined,
    type: undefined,
    key: undefined,
    notnull: undefined,

    parse: function(data) {
        this.name = data['Field'];
        this.type = data['Type'];
        this.key = data['Key'];
        this.notnull = data['Null'] == 'NO';

        Logger.log(' --> Field:', this.name, this.type, this.notnull ? 'NN' : 'NULL', this.key);
        return this;
    },

    asModelString: function() {
        var result = "{ name: '" + this._getModelFieldName() + "'";


        if (this._isReference()) {
            result += ", reference: '" + this._getModelRefName() + "'";
        } else {
            result += ", type: '" + this._getModelTypeName() + "'"
        }

        result += "}";

        return result;
    },

    _getModelFieldName: function() {
        return this.name
            .split('_')
            .map(function(s) { return s.upperFirstLetter();})
            .join('')
            .lowerFirstLetter();
    },

    _getModelRefName: function() {
        var data = this.name.split('_');
        data.pop();
        return data.map(function(s) { return s.upperFirstLetter(); }).join('');
    },

    _getModelTypeName: function() {
        if (this.type.indexOf('varchar') == 0) {
            return 'string';
        }

        if (this.type.indexOf('int') == 0) {
            return 'int';
        }

        if (this.type.indexOf('bigint') == 0) {
            return 'int';
        }

        if (this.type.indexOf('text') == 0) {
            return 'string';
        }

        if (this.type.indexOf('date') == 0) {
            return 'date';
        }

        if (this.type.indexOf('tinyint(1)') == 0) {
            return 'boolean';
        }

        return 'auto';
    },

    _isReference: function() {
        return this.key == 'MUL';
    }
};

exports.load = function(dbName) {
    var dbMeta = new DbMeta(dbName);

    return dbMeta.load().then(function() {
        pool.end();
        return dbMeta;
    });
};