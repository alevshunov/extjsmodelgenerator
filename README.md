# extjsmodelgenerator
Generation of a extjs model set for usage in restfull application.


Converter of MySql Database metadata to ExtJs Model metadata.

The result of execution is the set of base models (under base folder) and user models.
User models are inherited from base models and are used for adding custom fields, validation and functions. And usually shouldn't to be recreated by this tool.

Arguments:
* Database host (default: localhost): -h localhost
* Database user name (default: user): -u username
* Database password (default: password): -p password
* Database name (default: database): -d database
* Target directory, should be exists, should to have '/' in the end (default: model/): -f model/
* ExtJS model namespace (default App.model): -n MyApp.model
* ExtJS base model (default Ext.data.Model): -b MyApp.model.base.BaseModel
* Regenerate base models (default true): -ibm true
* Regenerate enduser models (default false): -im true

Usage:
    node model-gen.js -d myapp -n AppName.model -b AppName.model.base.BaseModel -tm true
