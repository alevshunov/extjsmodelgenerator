exports.get = function(name, defaultValue) {
    defaultValue = defaultValue || '';
    for (var i=0; i<process.argv.length-1; i++) {
        if (process.argv[i] == name) {
            return process.argv[i+1];
        }
    }
    return defaultValue;
};