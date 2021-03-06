var enigma = require('enigma.js');
var enigmaInstance = require('./enigmaInstance');
var Promise = require('bluebird');
var config = require('../config/config');
var itemCount = require('./checkRepo');
var fs = require('fs');
var logger = require('./logger');

var deleteMetrics = {
    deleteAllMasterItems: function(appId) {
        return new Promise(function(resolve, reject) {
                logger.info('deleteAllMasterItems::Deleting all MasterItem dimensions and measures from app: ' + appId, { module: 'deletemetrics' });
                var stuff = {};
                stuff.appId = appId;
                var session = enigma.create(enigmaInstance(config));
                session.open()
                    .then(function(global) {
                        stuff.global = global;
                        return global;
                    })
                    .then(function(global) {
                        return global.openDoc(appId, '', '', '', true);
                    })
                    .then(function(app) {
                        stuff.app = app;
                        return app.getAppLayout();
                    })
                    .then(function(appLayout) {
                        stuff.appRef = {
                            "name": appLayout.qTitle
                        };
                        return stuff.measureList = stuff.app.createSessionObject(deleteMetrics.measureListDef());
                    })
                    .then(function(obj) {

                        return obj.getLayout();
                    })
                    .then(function(layout) {

                        var items = layout.qMeasureList.qItems;
                        var mList = items.filter(filterMasterItems);

                        return Promise.map(mList, function(listItem) {
                            return stuff.app.destroyMeasure(listItem.qInfo.qId)
                                .then(function(success) {
                                    var measureInfo = listItem.qMeta.title + ':' + listItem.qInfo.qId;
                                    logger.info('deleteAllMasterItems::destroyMeasure::' + measureInfo + ' succeeded', { module: 'deletemetrics' });
                                    return listItem;
                                });
                        });
                    })
                    .then(function(measureArray) {

                        logger.info("Destroyed " + measureArray.length + " measures from " + stuff.appRef.name, { module: 'deletemetrics', app: stuff.appRef.name });
                        logger.info("Waiting for notification service to inform that the repository is clean", { module: 'deletemetrics', app: stuff.appRef.name });
                    })
                    .then(function() {
                        return stuff.dimensionList = stuff.app.createSessionObject(deleteMetrics.dimensionListDef());
                    })
                    .then(function(obj) {
                        return obj.getLayout();
                    })
                    .then(function(layout) {
                        var items = layout.qDimensionList.qItems;
                        var dList = items.filter(filterMasterItems);

                        return Promise.map(dList, function(listItem) {
                            return stuff.app.destroyDimension(listItem.qInfo.qId)
                                .then(function(success) {
                                    var dimInfo = listItem.qMeta.title + ':' + listItem.qInfo.qId;
                                    logger.info('deleteAllMasterItems::destroyDimension::' + dimInfo + ' succeeded', { module: 'deletemetrics' });
                                    return listItem;
                                });
                        });
                    })
                    .then(function(dimensionArray) {
                        logger.info("Destroyed " + dimensionArray.length + " measures from " + stuff.appRef.name, { module: 'deletemetrics', app: stuff.appRef.name });
                        logger.info("Waiting for notification service to inform that the repository is clean", { module: 'deletemetrics', app: stuff.appRef.name });
                    })
                    .then(function() {
                        logger.info('deleteAllMasterItems::saveObjects::Master Items removed.', { module: 'deletemetrics' });
                        var res = {
                            result: 'delete complete!'
                        };
                        session.close()
                            .then(function() {
                                logger.info('deleteAllMasterItems::Engine connection terminated', { module: 'deletemetrics' });
                                resolve(res);
                            });
                    })
                    .catch(function(error) {
                        session.close()
                            .then(function() {
                                logger.error('deleteAllMasterItems::enigma error::' + error, { module: 'deletemetrics' });
                                reject(new Error(error));
                            })

                    });
            })
            .catch(function(error) {
                logger.error('deleteAllMasterItems::Config error::' + error, { module: 'deletemetrics' });
                reject(new Error(error));
            });
    },
    measureListDef: function() {
        var measureList = {
            qInfo: {
                qType: "MeasureList"
            },
            qMeasureListDef: {
                qType: "measure",
                qData: {
                    title: "/title",
                    tags: "/tags"
                }
            }
        };
        return measureList;
    },
    dimensionListDef: function() {
        var dimensionList = {
            qInfo: {
                qType: "DimensionList"
            },
            qDimensionListDef: {
                qType: "dimension",
                qData: {
                    title: "/title",
                    tags: "/tags"
                }
            }
        };
        return dimensionList;
    }
}

function filterMasterItems(items) {
    //console.log(items.qMeta.tags);
    if (items.qMeta.tags.indexOf("MasterItem") != -1) {
        //console.log('Found One!');
        return true;
    } else {
        //console.log('Not a MasterItem');
        return false;
    }
};

module.exports = deleteMetrics;


var promiseWhile = Promise.method(function(condition, action) {
    if (!condition()) return;
    return action().then(promiseWhile.bind(null, condition, action));
});