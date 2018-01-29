class LogsStreamsService {
    constructor ($q, $translate, OvhApiDbaas, ServiceHelper, CloudPoll, LogsOptionsService) {
        this.$q = $q;
        this.$translate = $translate;
        this.ServiceHelper = ServiceHelper;
        this.LogsApiService = OvhApiDbaas.Logs().Lexi();
        this.StreamsApiService = OvhApiDbaas.Logs().Stream().Lexi();
        this.StreamsAapiService = OvhApiDbaas.Logs().Stream().Aapi();
        this.AccountingAapiService = OvhApiDbaas.Logs().Accounting().Aapi();
        this.OperationApiService = OvhApiDbaas.Logs().Operation().Lexi();
        this.CloudPoll = CloudPoll;
        this.LogsOptionsService = LogsOptionsService;
        // map to get count of streams assigned to each option
        this.optionStreamMap = null;

        this.initializeData();
    }

    initializeData () {
        this.compressionAlgorithms = [
            {
                value: "GZIP",
                name: this.$translate.instant("logs_stream_compression_gzip")
            },
            {
                value: "DEFLATED",
                name: this.$translate.instant("logs_stream_compression_zip")
            },
            {
                value: "LZMA",
                name: this.$translate.instant("logs_stream_compression_lzma")
            },
            {
                value: "ZSTD",
                name: this.$translate.instant("logs_stream_compression_zstd")
            }
        ];

        this.storageDurations = [
            {
                value: 1,
                name: this.$translate.instant("logs_stream_retention_1y")
            },
            {
                value: 2,
                name: this.$translate.instant("logs_stream_retention_2y")
            },
            {
                value: 5,
                name: this.$translate.instant("logs_stream_retention_5y")
            },
            {
                value: 10,
                name: this.$translate.instant("logs_stream_retention_10y")
            }
        ];
    }

    /**
     * returns array of streams with details of logged in user
     *
     * @param {any} serviceName
     * @returns promise which will be resolve to array of streams. each stream will have all details populated.
     * @memberof LogsStreamsService
     */
    getStreams (serviceName) {
        this.optionStreamMap = {};
        return this.getStreamDetails(serviceName)
            .then(streams => streams.map(stream => this._transformStream(serviceName, stream)))
            .catch(this.ServiceHelper.errorHandler("logs_streams_get_error"));
    }

    /**
     * gets stream details for each stream in array
     *
     * @param {any} serviceName
     * @returns promise which will be resolve to array of streams
     * @memberof LogsStreamsService
     */
    getStreamDetails (serviceName) {
        return this.getAllStreams(serviceName)
            .then(streams => {
                const promises = streams.map(stream => this.getStream(serviceName, stream));
                return this.$q.all(promises);
            });
    }

    /**
     * returns details of a stream
     *
     * @param {any} serviceName
     * @param {any} streamId
     * @returns promise which will be resolve to stream object
     * @memberof LogsStreamsService
     */
    getStream (serviceName, streamId) {
        return this.StreamsApiService.get({ serviceName, streamId })
            .$promise.catch(this.ServiceHelper.errorHandler("logs_stream_get_error"));
    }

    /**
     * returns details of a stream making call to Aapi (2api) service
     *
     * @param {any} serviceName
     * @param {any} streamId
     * @returns promise which will be resolve to stream object
     * @memberof LogsStreamsService
     */
    getAapiStream (serviceName, streamId) {
        return this.StreamsAapiService.get({ serviceName, streamId })
            .$promise.catch(this.ServiceHelper.errorHandler("logs_stream_get_error"));
    }

    /**
     * delete stream
     *
     * @param {any} serviceName
     * @param {any} stream, stream object to be deleted
     * @returns promise which will be resolve to operation object
     * @memberof LogsStreamsService
     */
    deleteStream (serviceName, stream) {
        return this.StreamsApiService.delete({ serviceName, streamId: stream.streamId }, stream)
            .$promise
            .then(operation => {
                this._resetAllCache();
                return this._handleSuccess(serviceName, operation.data, "logs_stream_delete_success");
            })
            .catch(this.ServiceHelper.errorHandler("logs_stream_delete_error"));
    }

    /**
     * create new stream
     *
     * @param {any} serviceName
     * @param {any} stream, stream object to be created
     * @returns promise which will be resolve to operation object
     * @memberof LogsStreamsService
     */
    createStream (serviceName, stream) {
        return this.StreamsApiService.create({ serviceName }, stream)
            .$promise
            .then(operation => {
                this._resetAllCache();
                return this._handleSuccess(serviceName, operation.data, "logs_stream_create_success");
            })
            .catch(this.ServiceHelper.errorHandler("logs_stream_create_error"));
    }

    /**
     * update stream
     *
     * @param {any} serviceName
     * @param {any} stream, stream object to be updated
     * @returns promise which will be resolve to operation object
     * @memberof LogsStreamsService
     */
    updateStream (serviceName, stream) {
        return this.StreamsApiService.update({ serviceName, streamId: stream.streamId }, stream)
            .$promise
            .then(operation => this._handleSuccess(serviceName, operation.data, "logs_stream_update_success"))
            .catch(this.ServiceHelper.errorHandler("logs_stream_update_error"));
    }

    /**
     * returns array of stream id's of logged in user
     *
     * @param {any} serviceName
     * @returns promise which will be resolve to array of stream id's
     * @memberof LogsStreamsService
     */
    getAllStreams (serviceName) {
        return this.LogsApiService.streams({ serviceName }).$promise;
    }

    /**
     * returns all notifications configured for a given stream
     *
     * @param {any} serviceName
     * @param {any} streamId
     * @returns promise which will be resolve to array of notifications
     * @memberof LogsStreamsService
     */
    getNotifications (serviceName, streamId) {
        return this.StreamsApiService.notifications({ serviceName, streamId })
            .$promise
            .catch(this.ServiceHelper.errorHandler("logs_streams_notifications_get_error"));
    }

    /**
     * returns all archives configured for a given stream
     *
     * @param {any} serviceName
     * @param {any} streamId
     * @returns promise which will be resolve to array of archives
     * @memberof LogsStreamsService
     */
    getArchives (serviceName, streamId) {
        return this.StreamsApiService.archives({ serviceName, streamId })
            .$promise
            .catch(this.ServiceHelper.errorHandler("logs_streams_archives_get_error"));
    }

    /**
     * returns objecy containing total number of streams and total number of streams used
     *
     * @param {any} serviceName
     * @returns quota object containing V (total number streams) and configured (number of streams used)
     * @memberof LogsStreamsService
     */
    getQuota (serviceName) {
        return this.AccountingAapiService.me({ serviceName }).$promise
            .then(me => {
                const quota = {
                    max: me.total.maxNbStream,
                    configured: me.total.curNbStream,
                    currentUsage: me.total.curNbStream * 100 / me.total.maxNbStream
                };
                return quota;
            }).catch(this.ServiceHelper.errorHandler("logs_streams_quota_get_error"));
    }

    getCompressionAlgorithms () {
        return this.compressionAlgorithms;
    }

    getStorageDurations () {
        return this.storageDurations;
    }

    getSubscribedOptions (serviceName) {
        return this.LogsOptionsService.getStreamSubscribedOptions(serviceName);
    }

    /**
     * creates new stream with default values
     *
     * @returns stream object with default values
     * @memberof LogsStreamsService
     */
    getNewStream () {
        return {
            data: {
                coldStorageCompression: this.compressionAlgorithms[0].value,
                coldStorageRetention: this.storageDurations[0].value,
                coldStorageNotifyEnabled: true,
                coldStorageEnabled: false,
                webSocketEnabled: true
            }
        };
    }

    /**
     * returns number of streams assigned for given operation
     *
     * @param {any} operationId
     * @returns number of streams assigned for given operation
     * @memberof LogsStreamsService
     */
    _getNumberOfStreamsAssigned (serviceName, operationId) {
        const defer = this.$q.defer();
        if (this.optionStreamMap) {
            defer.resolve(this.optionStreamMap[operationId] ? this.optionStreamMap[operationId] : 0);
        } else {
            this.getStreams(serviceName).then(() => defer.resolve(this.optionStreamMap[operationId] ? this.optionStreamMap[operationId] : 0));
        }
        return defer.promise;
    }

    /**
     * add additional data to stream before sending back to controller
     * 1. asynchronously gets notifications of a stream
     * 2. asynchronously gets archives of a stream
     * 3. updates operationStreamMap to get number of streams assigned to each operation
     *
     * @param {any} serviceName
     * @param {any} stream
     * @returns stream object after adding notifications
     * @memberof LogsStreamsService
     */
    _transformStream (serviceName, stream) {
        stream.notifications = [];
        // asynchronously fetch all notification of a stream
        this.getNotifications(serviceName, stream.streamId)
            .then(notifications => {
                stream.notifications = notifications;
            });
        // asynchronously fetch all archives of a stream
        this.getArchives(serviceName, stream.streamId)
            .then(archives => {
                stream.archives = archives;
            });
        if (stream.optionId && this.optionStreamMap[stream.optionId]) {
            this.optionStreamMap[stream.optionId]++;
        } else if (stream.optionId) {
            this.optionStreamMap[stream.optionId] = 1;
        }
        return stream;
    }

    /**
     * handles success state for create, delete and update streams.
     * Repetedly polls for operation untill it returns SUCCESS message.
     *
     * @param {any} serviceName
     * @param {any} operation, operation to poll
     * @param {any} successMessage, message to show on UI
     * @returns promise which will be resolved to operation object
     * @memberof LogsStreamsService
     */
    _handleSuccess (serviceName, operation, successMessage) {
        this.poller = this._pollOperation(serviceName, operation);
        return this.poller.$promise
            .then(this.ServiceHelper.successHandler(successMessage));
    }

    _killPollar () {
        if (this.poller) {
            this.poller.kill();
        }
    }

    _resetAllCache () {
        this.LogsApiService.resetAllCache();
        this.StreamsApiService.resetAllCache();
        this.AccountingAapiService.resetAllCache();
    }

    _pollOperation (serviceName, operation) {
        this._killPollar();
        const pollar = this.CloudPoll.poll({
            item: operation,
            pollFunction: opn => this.OperationApiService.get({ serviceName, operationId: opn.operationId }).$promise,
            stopCondition: opn => opn.state === "FAILURE" || opn.state === "SUCCESS"
        });
        return pollar;
    }
}

angular.module("managerApp").service("LogsStreamsService", LogsStreamsService);